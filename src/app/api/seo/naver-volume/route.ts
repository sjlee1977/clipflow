/**
 * Naver Search Ads API — 키워드 월간 실검색량
 *
 * GET /api/seo/naver-volume?keyword=홈트레이닝
 *
 * 상업 키워드: Ads API /keywordstool 직접 반환
 * 비상업 키워드 (< 10): DataLab 캘리브레이션으로 추정
 *   1. 앵커 키워드("다이어트") Ads API 실검색량 조회
 *   2. DataLab에서 [keyword, "다이어트"] 동시 조회 → 공유 비율 획득
 *   3. 추정량 = (keyword_ratio / anchor_ratio) × anchor_volume
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import crypto from 'crypto';

const ADS_API      = 'https://api.naver.com';
const DATALAB_URL  = 'https://openapi.naver.com/v1/datalab/search';
const ANCHOR_KW    = '다이어트'; // 안정적 상업 키워드

// ─── HMAC 서명 생성 ────────────────────────────────────────────────────────────
function makeSignature(secretKey: string, method: string, path: string) {
  const timestamp = Date.now().toString();
  const message   = `${timestamp}.${method}.${path}`;
  const signature = crypto.createHmac('sha256', secretKey).update(message).digest('base64');
  return { timestamp, signature };
}

function parseVolume(raw: unknown): number {
  if (typeof raw === 'number') return raw;
  if (typeof raw !== 'string') return 0;
  const t = raw.trim();
  if (t === '< 10' || t === '<10') return 0; // 0으로 처리 → 캘리브레이션 트리거
  return parseInt(t.replace(/[^0-9]/g, ''), 10) || 0;
}

function normalizeCompIdx(raw: unknown): '낮음' | '중간' | '높음' {
  const s = String(raw ?? '').toLowerCase();
  if (s.includes('높') || s === 'high')                    return '높음';
  if (s.includes('중') || s === 'medium' || s === 'mid')   return '중간';
  return '낮음';
}

// ─── Ads API 단일 키워드 검색량 조회 ─────────────────────────────────────────
async function fetchAdsVolume(
  keyword: string,
  customerId: string, accessLicense: string, secretKey: string,
): Promise<{ pc: number; mobile: number }> {
  const path = '/keywordstool';
  const { timestamp, signature } = makeSignature(secretKey, 'GET', path);
  const hint = keyword.replace(/\s+/g, '');
  const qs   = `hintKeywords=${encodeURIComponent(hint)}&showDetail=1&includeHintKeywords=1`;

  const res = await fetch(`${ADS_API}${path}?${qs}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Timestamp':  timestamp,
      'X-API-KEY':    accessLicense,
      'X-Customer':   customerId,
      'X-Signature':  signature,
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) return { pc: 0, mobile: 0 };
  const data = await res.json().catch(() => ({}));
  const list = (data.keywordList ?? []) as Record<string, unknown>[];

  // 정확히 일치하는 키워드 우선, 없으면 첫 번째
  const item = list.find((i) => String(i.relKeyword ?? '') === keyword) ?? list[0];
  if (!item) return { pc: 0, mobile: 0 };
  return {
    pc:     parseVolume(item.monthlyPcQcCnt),
    mobile: parseVolume(item.monthlyMobileQcCnt),
  };
}

// ─── DataLab 캘리브레이션 ─────────────────────────────────────────────────────
async function calibrateVolume(
  keyword: string,
  anchorVolume: number,
  clientId: string, clientSecret: string,
): Promise<{ pc: number; mobile: number } | null> {
  const now      = new Date();
  const endDate  = now.toISOString().slice(0, 10);
  const start    = new Date(now);
  start.setMonth(start.getMonth() - 3);
  const startDate = start.toISOString().slice(0, 10);

  const body = {
    startDate, endDate,
    timeUnit: 'month',
    keywordGroups: [
      { groupName: keyword,    keywords: [keyword] },
      { groupName: ANCHOR_KW,  keywords: [ANCHOR_KW] },
    ],
  };

  const res = await fetch(DATALAB_URL, {
    method: 'POST',
    headers: {
      'Content-Type':          'application/json',
      'X-Naver-Client-Id':     clientId,
      'X-Naver-Client-Secret': clientSecret,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  if (!data?.results || data.results.length < 2) return null;

  // 마지막 1개월 데이터 평균
  const avgRatio = (r: { data: { ratio: number }[] }) =>
    r.data.slice(-1).reduce((s: number, d: { ratio: number }) => s + d.ratio, 0) /
    Math.max(r.data.slice(-1).length, 1);

  const kwResult     = data.results.find((r: { title: string }) => r.title === keyword);
  const anchorResult = data.results.find((r: { title: string }) => r.title === ANCHOR_KW);
  if (!kwResult || !anchorResult) return null;

  const kwRatio     = avgRatio(kwResult);
  const anchorRatio = avgRatio(anchorResult);
  if (anchorRatio === 0) return null;

  const estimatedTotal = Math.round((kwRatio / anchorRatio) * anchorVolume);
  // PC:모바일 비율은 앵커 키워드 기준 6:4 추정 (다이어트 통계 기반)
  return {
    pc:     Math.round(estimatedTotal * 0.18),
    mobile: Math.round(estimatedTotal * 0.82),
  };
}

// ─── GET Handler ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });

    const meta           = user.user_metadata ?? {};
    const customerId     = process.env.NAVER_ADS_CUSTOMER_ID?.trim()    || meta.naver_ads_customer_id?.trim();
    const accessLicense  = process.env.NAVER_ADS_ACCESS_LICENSE?.trim() || meta.naver_ads_access_license?.trim();
    const secretKey      = process.env.NAVER_ADS_SECRET_KEY?.trim()     || meta.naver_ads_secret_key?.trim();
    const clientId       = process.env.NAVER_CLIENT_ID?.trim()          || meta.naver_client_id?.trim();
    const clientSecret   = process.env.NAVER_CLIENT_SECRET?.trim()      || meta.naver_client_secret?.trim();

    if (!customerId || !accessLicense || !secretKey) {
      return NextResponse.json({ error: 'Naver Search Ads API 키가 설정되지 않았습니다.' }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const keyword = searchParams.get('keyword')?.trim();
    if (!keyword) return NextResponse.json({ error: 'keyword 파라미터가 필요합니다' }, { status: 400 });

    const path = '/keywordstool';
    const { timestamp, signature } = makeSignature(secretKey, 'GET', path);
    const hint = keyword.replace(/\s+/g, '');
    const qs   = `hintKeywords=${encodeURIComponent(hint)}&showDetail=1&includeHintKeywords=1`;

    const res = await fetch(`${ADS_API}${path}?${qs}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Timestamp':  timestamp,
        'X-API-KEY':    accessLicense,
        'X-Customer':   customerId,
        'X-Signature':  signature,
      },
      signal: AbortSignal.timeout(15000),
    });

    const rawText = await res.text();
    if (!res.ok) {
      return NextResponse.json(
        { error: `Naver Ads API 오류 [${res.status}]: ${rawText.slice(0, 200)}` },
        { status: res.status },
      );
    }

    let data: { keywordList?: unknown[] };
    try { data = JSON.parse(rawText); }
    catch { return NextResponse.json({ error: 'API 응답 파싱 실패' }, { status: 500 }); }

    const keywordList = (data.keywordList ?? []) as Record<string, unknown>[];

    const results = keywordList.map(item => {
      const pcVol     = parseVolume(item.monthlyPcQcCnt);
      const mobileVol = parseVolume(item.monthlyMobileQcCnt);
      const total     = pcVol + mobileVol;
      const compIdx   = normalizeCompIdx(item.compIdx);
      const compPenalty = compIdx === '높음' ? 0.3 : compIdx === '중간' ? 0.65 : 1.0;
      const opportunity = Math.round(Math.min(total / 100000, 1) * compPenalty * 100);
      return {
        keyword:       String(item.relKeyword ?? ''),
        monthlyPc:     pcVol,
        monthlyMobile: mobileVol,
        monthlyTotal:  total,
        compIdx,
        plAvgDepth:    Number(item.plAvgDepth ?? 0),
        opportunity,
      };
    });

    results.sort((a, b) => {
      if (a.keyword === keyword) return -1;
      if (b.keyword === keyword) return 1;
      return b.monthlyTotal - a.monthlyTotal;
    });

    // ── 비상업 키워드: DataLab 캘리브레이션 ──────────────────────────────────
    const mainItem = results[0];
    const isLowVolume = !mainItem || mainItem.monthlyTotal < 10;

    if (isLowVolume && clientId && clientSecret) {
      // 앵커 키워드("다이어트") Ads API 볼륨 조회
      const anchorVol   = await fetchAdsVolume(ANCHOR_KW, customerId, accessLicense, secretKey);
      const anchorTotal = anchorVol.pc + anchorVol.mobile;

      if (anchorTotal > 0) {
        const estimated = await calibrateVolume(keyword, anchorTotal, clientId, clientSecret);
        if (estimated) {
          const estTotal = estimated.pc + estimated.mobile;
          // PC/모바일 비율은 앵커 키워드 실제 비율 사용
          const pcRatio     = anchorVol.pc / anchorTotal;
          const mobileRatio = anchorVol.mobile / anchorTotal;
          const compIdx: '낮음' | '중간' | '높음' = '낮음';
          const opportunity = Math.round(Math.min(estTotal / 100000, 1) * 100);
          const estimatedItem = {
            keyword,
            monthlyPc:     Math.round(estTotal * pcRatio),
            monthlyMobile: Math.round(estTotal * mobileRatio),
            monthlyTotal:  estTotal,
            compIdx,
            plAvgDepth:    0,
            opportunity,
            estimated: true,
          };
          const idx = results.findIndex(r => r.keyword === keyword);
          if (idx >= 0) results[idx] = estimatedItem;
          else results.unshift(estimatedItem);
        }
      }
    }

    return NextResponse.json({ keyword, results });
  } catch (err: unknown) {
    console.error('[naver-volume]', err);
    if (err instanceof Error && err.name === 'TimeoutError') {
      return NextResponse.json({ error: 'Naver Ads API 타임아웃' }, { status: 408 });
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : '검색량 조회 실패' }, { status: 500 });
  }
}
