/**
 * Naver Search Ads API — 키워드 월간 실검색량
 *
 * GET /api/seo/naver-volume?keyword=홈트레이닝
 *
 * 인증: HMAC-SHA256
 *   timestamp = Date.now()
 *   message   = `${timestamp}.GET./keywordstool`
 *   signature = base64( HMAC-SHA256(secretKey, message) )
 *
 * 헤더:
 *   X-Timestamp, X-API-KEY (accessLicense), X-Customer (customerId), X-Signature
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import crypto from 'crypto';

const ADS_API = 'https://api.naver.com';

// ─── HMAC 서명 생성 ────────────────────────────────────────────────────────────
function makeSignature(secretKey: string, method: string, path: string) {
  const timestamp = Date.now().toString();
  const message = `${timestamp}.${method}.${path}`;
  const signature = crypto
    .createHmac('sha256', secretKey)
    .update(message)
    .digest('base64');
  return { timestamp, signature };
}

// ─── 검색량 숫자 파싱 ("< 10" → 5, "1,000" → 1000) ──────────────────────────
function parseVolume(raw: unknown): number {
  if (typeof raw === 'number') return raw;
  if (typeof raw !== 'string') return 0;
  const trimmed = raw.trim();
  if (trimmed === '< 10' || trimmed === '<10') return 5;  // 10 미만은 5로 추정
  return parseInt(trimmed.replace(/[^0-9]/g, ''), 10) || 0;
}

// ─── 경쟁도 한글 정규화 ──────────────────────────────────────────────────────
function normalizeCompIdx(raw: unknown): '낮음' | '중간' | '높음' {
  const s = String(raw ?? '').toLowerCase();
  if (s.includes('높') || s === 'high') return '높음';
  if (s.includes('중') || s === 'medium' || s === 'mid') return '중간';
  return '낮음';
}

// ─── GET Handler ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });

    const meta = user.user_metadata ?? {};
    const customerId     = meta.naver_ads_customer_id?.trim();
    const accessLicense  = meta.naver_ads_access_license?.trim();
    const secretKey      = meta.naver_ads_secret_key?.trim();

    if (!customerId || !accessLicense || !secretKey) {
      return NextResponse.json(
        { error: 'Naver Search Ads API 키가 설정되지 않았습니다. 설정 → SEO 키워드 리서치에서 등록해주세요.' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(req.url);
    const keyword = searchParams.get('keyword')?.trim();
    if (!keyword) {
      return NextResponse.json({ error: 'keyword 파라미터가 필요합니다' }, { status: 400 });
    }

    const path = '/keywordstool';
    const { timestamp, signature } = makeSignature(secretKey, 'GET', path);

    // 네이버 광고 API: hintKeywords는 공백 미지원 → 공백 제거 후 전송
    // 사용자에게는 원본 keyword로 결과 매칭
    const hintKeyword = keyword.replace(/\s+/g, '');
    const qs = `hintKeywords=${encodeURIComponent(hintKeyword)}&showDetail=1`;

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
      console.error('[naver-volume]', res.status, rawText.slice(0, 300));
      return NextResponse.json(
        { error: `Naver Ads API 오류 [${res.status}]: ${rawText.slice(0, 200)}` },
        { status: res.status }
      );
    }

    let data: { keywordList?: unknown[] };
    try { data = JSON.parse(rawText); }
    catch { return NextResponse.json({ error: 'API 응답 파싱 실패', raw: rawText.slice(0, 200) }, { status: 500 }); }

    const keywordList = (data.keywordList ?? []) as Record<string, unknown>[];

    // 결과 정제
    const results = keywordList.map(item => {
      const pcVol     = parseVolume(item.monthlyPcQcCnt);
      const mobileVol = parseVolume(item.monthlyMobileQcCnt);
      const total     = pcVol + mobileVol;
      const compIdx   = normalizeCompIdx(item.compIdx);

      // SEO 기회 점수: 검색량 높고 경쟁도 낮을수록 높음 (0~100)
      const compPenalty = compIdx === '높음' ? 0.3 : compIdx === '중간' ? 0.65 : 1.0;
      const volScore = Math.min(total / 100000, 1);
      const opportunity = Math.round(volScore * compPenalty * 100);

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

    // 원래 검색 키워드가 첫 번째로 오도록 정렬
    results.sort((a, b) => {
      if (a.keyword === keyword) return -1;
      if (b.keyword === keyword) return 1;
      return b.monthlyTotal - a.monthlyTotal;
    });

    return NextResponse.json({ keyword, results });
  } catch (err: unknown) {
    console.error('[naver-volume]', err);
    if (err instanceof Error && err.name === 'TimeoutError') {
      return NextResponse.json({ error: 'Naver Ads API 타임아웃 (15초 초과)' }, { status: 408 });
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : '검색량 조회 실패' }, { status: 500 });
  }
}
