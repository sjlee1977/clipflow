/**
 * Naver Search API — 블로그/카페 월간 신규 발행량 추정
 *
 * GET /api/seo/naver-content?keyword=다이어트&monthlyTotal=50000
 *
 * Naver Open API는 날짜 범위 필터를 지원하지 않음.
 * → sort=date로 최신 게시물을 가져와 게시 속도(rate)로 월간 신규 발행량 추정:
 *   1. display=100, sort=date 로 최신 100건 조회 (newest date + total)
 *   2. start=min(total, 1000), display=1 로 기준 게시물 날짜 조회
 *   3. monthly ≈ 1000(or total) / span_days * 30
 * BlackKiwi와 동일한 월간 신규 발행량 개념에 근사
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

const SEARCH_BASE = 'https://openapi.naver.com/v1/search';

function parsePostDate(item: Record<string, unknown>): Date | null {
  // blog: postdate (YYYYMMDD)
  // cafearticle: postdate (YYYYMMDD) 또는 datetime (ISO/RFC)
  const candidates = [
    item?.postdate,
    item?.datetime,
    item?.pubDate,
    item?.date,
  ].map(v => String(v ?? '').trim()).filter(Boolean);

  for (const raw of candidates) {
    // YYYYMMDD
    if (/^\d{8}$/.test(raw)) {
      const d = new Date(
        parseInt(raw.slice(0, 4)),
        parseInt(raw.slice(4, 6)) - 1,
        parseInt(raw.slice(6, 8)),
      );
      if (!isNaN(d.getTime())) return d;
    }
    // YYYY.MM.DD or YYYY-MM-DD
    if (/^\d{4}[.\-]\d{2}[.\-]\d{2}/.test(raw)) {
      const normalized = raw.slice(0, 10).replace(/\./g, '-');
      const d = new Date(normalized);
      if (!isNaN(d.getTime())) return d;
    }
    // RFC 2822 / ISO
    if (raw.length > 8) {
      const d = new Date(raw);
      if (!isNaN(d.getTime())) return d;
    }
  }
  return null;
}

async function fetchMonthlyRate(
  type: 'blog' | 'cafearticle',
  keyword: string,
  clientId: string,
  clientSecret: string,
): Promise<{ monthly: number; total: number; hitCeiling: boolean }> {
  const headers = {
    'X-Naver-Client-Id':     clientId,
    'X-Naver-Client-Secret': clientSecret,
  };
  const base = `${SEARCH_BASE}/${type}.json?query=${encodeURIComponent(keyword)}&sort=date`;

  // ── 1단계: 최신 100건 조회 (total + newest date) ──────────────────────────
  const r1 = await fetch(`${base}&display=100`, {
    headers,
    signal: AbortSignal.timeout(10000),
  });
  if (!r1.ok) return { monthly: 0, total: 0, hitCeiling: false };
  const d1 = await r1.json().catch(() => ({}));

  const total: number = d1.total ?? 0;
  const items1: Record<string, unknown>[] = d1.items ?? [];
  if (items1.length === 0) return { monthly: 0, total, hitCeiling: false };

  const newestDate = parsePostDate(items1[0]);
  // 날짜 파싱 실패 시: total / 12 로 fallback (월 평균)
  if (!newestDate) return { monthly: Math.round(total / 12), total, hitCeiling: false };

  // ── 2단계: 기준점 게시물 날짜 조회 ───────────────────────────────────────
  // 최대 1000번째 게시물을 기준으로 span 계산 (API 제한: start ≤ 1000)
  const measureN = Math.min(total, 1000);
  let oldestDate: Date | null = null;
  let countUsed = measureN;

  if (total <= 100) {
    // 이미 가져온 items에서 마지막 항목 사용
    oldestDate = parsePostDate(items1[items1.length - 1]);
    countUsed = items1.length;
  } else {
    const r2 = await fetch(`${base}&display=1&start=${measureN}`, {
      headers,
      signal: AbortSignal.timeout(10000),
    });
    if (r2.ok) {
      const d2 = await r2.json().catch(() => ({}));
      const items2: Record<string, unknown>[] = d2.items ?? [];
      if (items2.length > 0) oldestDate = parsePostDate(items2[0]);
    }
  }

  // ── 3단계: 발행 속도 계산 ─────────────────────────────────────────────────
  if (!oldestDate) {
    return { monthly: Math.round(total / 12), total, hitCeiling: false };
  }

  const spanMs   = newestDate.getTime() - oldestDate.getTime();
  const spanDays = spanMs / (1000 * 60 * 60 * 24);

  let effectiveSpan: number;
  let hitCeiling: boolean;

  if (type === 'cafearticle') {
    // 카페: pubDate가 RFC2822(초 단위) → ms 정밀도 그대로 사용, 최소 1시간으로만 제한
    effectiveSpan = Math.max(spanDays, 1 / 24);
    hitCeiling    = spanDays < 1 / 24; // 1시간 미만이면 상한 불확실
  } else {
    // 블로그: postdate가 YYYYMMDD(일 단위)
    if (spanDays === 0) {
      // 1000건 전부 오늘 → 자정부터 현재 시각까지 경과 시간을 분모로 사용 (전략 1)
      const now      = new Date();
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const elapsedDays = (now.getTime() - midnight.getTime()) / (1000 * 60 * 60 * 24);
      effectiveSpan = Math.max(elapsedDays, 1 / 24); // 최소 1시간
      hitCeiling    = true; // 자정 이후만 관측했으므로 상한 불확실
    } else {
      // 날짜가 다른 경우 → 일 단위 정밀도로 충분
      effectiveSpan = Math.max(spanDays, 1);
      hitCeiling    = spanDays <= 1;
    }
  }

  const dailyRate = countUsed / effectiveSpan;
  const monthly   = Math.round(dailyRate * 30);

  return { monthly, total, hitCeiling };
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });

    const meta         = user.user_metadata ?? {};
    const clientId     = process.env.NAVER_CLIENT_ID?.trim()     || meta.naver_client_id?.trim();
    const clientSecret = process.env.NAVER_CLIENT_SECRET?.trim() || meta.naver_client_secret?.trim();

    if (!clientId || !clientSecret) {
      return NextResponse.json({ error: 'Naver API 키가 설정되지 않았습니다.' }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const keyword      = searchParams.get('keyword')?.trim();
    const monthlyTotal = parseInt(searchParams.get('monthlyTotal') ?? '0', 10);

    if (!keyword) return NextResponse.json({ error: 'keyword 파라미터가 필요합니다' }, { status: 400 });

    // blog + cafe 병렬 조회 (각 2회씩 → 총 4 API calls)
    const [blogResult, cafeResult] = await Promise.all([
      fetchMonthlyRate('blog',        keyword, clientId, clientSecret),
      fetchMonthlyRate('cafearticle', keyword, clientId, clientSecret),
    ]);

    const monthly = blogResult.monthly + cafeResult.monthly;

    const saturation = monthlyTotal > 0
      ? {
          blog:  Math.round((blogResult.monthly / monthlyTotal) * 100 * 10) / 10,
          cafe:  Math.round((cafeResult.monthly / monthlyTotal) * 100 * 10) / 10,
          total: Math.round((monthly            / monthlyTotal) * 100 * 10) / 10,
        }
      : { blog: 0, cafe: 0, total: 0 };

    // 포화도 기반 경쟁도 — 임의 기준 없음
    // 근거: 월간 검색 1건당 새 글이 얼마나 올라오는가
    //   total sat > 100% → 공급 > 수요 → 높음
    //   total sat 50~100% → 균형 → 중간
    //   total sat < 50%   → 수요 > 공급 → 낮음
    const totalSat = saturation.total;
    const contentCompIdx: '낮음' | '중간' | '높음' =
      totalSat >= 100 ? '높음' : totalSat >= 50 ? '중간' : '낮음';

    // 기회 점수 — 포화도에서 직접 도출 (100 - 포화%)
    // 포화 0% → 기회 100 / 포화 100%+ → 기회 0
    const opportunity = Math.max(0, Math.round(100 - totalSat));

    return NextResponse.json({
      keyword,
      blog:  blogResult.monthly,
      cafe:  cafeResult.monthly,
      total: monthly,
      totalAccumulated: blogResult.total + cafeResult.total,
      blogHitCeiling: blogResult.hitCeiling ?? false,
      cafeHitCeiling: cafeResult.hitCeiling ?? false,
      saturation,
      contentCompIdx,
      opportunity,
    });
  } catch (err: unknown) {
    console.error('[naver-content]', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : '발행량 조회 실패' }, { status: 500 });
  }
}
