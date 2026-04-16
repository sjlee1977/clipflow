/**
 * Naver Search Ads API — 키워드 월간 실검색량
 *
 * GET /api/seo/naver-volume?keyword=홈트레이닝
 *
 * Ads API /keywordstool 에서 직접 반환되는 monthlyPcQcCnt / monthlyMobileQcCnt 값을
 * 그대로 사용한다. DataLab 기반 캘리브레이션은 비상업 키워드에 대해 오차가 크므로 제거.
 * "< 10" 응답은 0으로 처리한다.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import crypto from 'crypto';

const ADS_API = 'https://api.naver.com';

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
  if (t === '< 10' || t === '<10') return 0;
  return parseInt(t.replace(/[^0-9]/g, ''), 10) || 0;
}

function normalizeCompIdx(raw: unknown): '낮음' | '중간' | '높음' {
  const s = String(raw ?? '').toLowerCase();
  if (s.includes('높') || s === 'high')                   return '높음';
  if (s.includes('중') || s === 'medium' || s === 'mid')  return '중간';
  return '낮음';
}

// ─── GET Handler ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });

    const meta          = user.user_metadata ?? {};
    const customerId    = process.env.NAVER_ADS_CUSTOMER_ID?.trim()    || meta.naver_ads_customer_id?.trim();
    const accessLicense = process.env.NAVER_ADS_ACCESS_LICENSE?.trim() || meta.naver_ads_access_license?.trim();
    const secretKey     = process.env.NAVER_ADS_SECRET_KEY?.trim()     || meta.naver_ads_secret_key?.trim();

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

    return NextResponse.json({ keyword, results });
  } catch (err: unknown) {
    console.error('[naver-volume]', err);
    if (err instanceof Error && err.name === 'TimeoutError') {
      return NextResponse.json({ error: 'Naver Ads API 타임아웃' }, { status: 408 });
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : '검색량 조회 실패' }, { status: 500 });
  }
}
