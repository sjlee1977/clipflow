/**
 * Naver Search API — 블로그/카페 콘텐츠 발행량 조회 (기간 필터)
 *
 * GET /api/seo/naver-content?keyword=다이어트&period=1m&monthlyTotal=50000
 *
 * 쿼리에 날짜 범위 구문 포함: "키워드 from20260316to20260416"
 * → total 필드가 해당 기간 내 게시물 수만 반환
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

const SEARCH_BASE = 'https://openapi.naver.com/v1/search';

function getPeriodDates(period: string): { from: string; to: string } {
  const now   = new Date();
  const to    = now.toISOString().slice(0, 10).replace(/-/g, '');
  const start = new Date(now);
  switch (period) {
    case '1m':  start.setMonth(start.getMonth() - 1);       break;
    case '3m':  start.setMonth(start.getMonth() - 3);       break;
    case '6m':  start.setMonth(start.getMonth() - 6);       break;
    case '1y':  start.setFullYear(start.getFullYear() - 1); break;
    default:    start.setMonth(start.getMonth() - 1);       break;
  }
  const from = start.toISOString().slice(0, 10).replace(/-/g, '');
  return { from, to };
}

async function fetchCount(
  type: 'blog' | 'cafearticle',
  keyword: string,
  from: string,
  to: string,
  clientId: string,
  clientSecret: string,
): Promise<number> {
  // 날짜 범위를 쿼리에 직접 포함
  const query = `${keyword} from${from}to${to}`;
  const url   = `${SEARCH_BASE}/${type}.json?query=${encodeURIComponent(query)}&display=1`;

  const res = await fetch(url, {
    headers: {
      'X-Naver-Client-Id':     clientId,
      'X-Naver-Client-Secret': clientSecret,
    },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return 0;
  const data = await res.json().catch(() => ({}));
  return data.total ?? 0;
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
    const period       = searchParams.get('period') ?? '1m';
    const monthlyTotal = parseInt(searchParams.get('monthlyTotal') ?? '0', 10);

    if (!keyword) return NextResponse.json({ error: 'keyword 파라미터가 필요합니다' }, { status: 400 });

    const { from, to } = getPeriodDates(period);

    const [blogCount, cafeCount] = await Promise.all([
      fetchCount('blog', keyword, from, to, clientId, clientSecret),
      fetchCount('cafearticle', keyword, from, to, clientId, clientSecret),
    ]);

    const total = blogCount + cafeCount;

    const saturation = monthlyTotal > 0
      ? {
          blog:  Math.round((blogCount / monthlyTotal) * 100 * 10) / 10,
          cafe:  Math.round((cafeCount / monthlyTotal) * 100 * 10) / 10,
          total: Math.round((total     / monthlyTotal) * 100 * 10) / 10,
        }
      : { blog: 0, cafe: 0, total: 0 };

    return NextResponse.json({ keyword, blog: blogCount, cafe: cafeCount, total, saturation, period, from, to });
  } catch (err: unknown) {
    console.error('[naver-content]', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : '발행량 조회 실패' }, { status: 500 });
  }
}
