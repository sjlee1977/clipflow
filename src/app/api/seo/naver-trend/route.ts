/**
 * Naver DataLab — 검색어 트렌드 API
 *
 * POST /api/seo/naver-trend
 * Body: { keywords: string[], period?: '1m'|'3m'|'1y', timeUnit?: 'date'|'week'|'month', device?: 'pc'|'mo', gender?: 'm'|'f', ages?: string[] }
 *
 * 네이버 DataLab 검색어 트렌드는 최대 5개 키워드 그룹을 동시에 비교 가능
 * 각 비율(ratio)은 조회 기간 내 최고값=100 기준 상대수치
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

const DATALAB_SEARCH_URL = 'https://openapi.naver.com/v1/datalab/search';

// ─── 기간 계산 ────────────────────────────────────────────────────────────────
function getPeriodDates(period: string): { startDate: string; endDate: string } {
  const now = new Date();
  const endDate = now.toISOString().slice(0, 10);
  const start = new Date(now);

  switch (period) {
    case '1m':  start.setMonth(start.getMonth() - 1);  break;
    case '3m':  start.setMonth(start.getMonth() - 3);  break;
    case '6m':  start.setMonth(start.getMonth() - 6);  break;
    case '1y':  start.setFullYear(start.getFullYear() - 1); break;
    case '2y':  start.setFullYear(start.getFullYear() - 2); break;
    default:    start.setFullYear(start.getFullYear() - 1); break;
  }

  // DataLab 최소 시작일: 2016-01-01
  if (start < new Date('2016-01-01')) start.setFullYear(2016, 0, 1);

  return { startDate: start.toISOString().slice(0, 10), endDate };
}

// ─── POST Handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });

    const meta = user.user_metadata ?? {};
    const clientId     = process.env.NAVER_CLIENT_ID?.trim()     || meta.naver_client_id?.trim();
    const clientSecret = process.env.NAVER_CLIENT_SECRET?.trim() || meta.naver_client_secret?.trim();

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: 'Naver DataLab API 키가 설정되지 않았습니다.' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const {
      keywords = [],
      period   = '1y',
      timeUnit = 'month',
      device   = '',
      gender   = '',
      ages     = [],
    } = body as {
      keywords: string[];
      period?:  string;
      timeUnit?: 'date' | 'week' | 'month';
      device?:  string;
      gender?:  string;
      ages?:    string[];
    };

    if (!keywords || keywords.length === 0) {
      return NextResponse.json({ error: 'keywords 배열이 필요합니다' }, { status: 400 });
    }

    // 최대 5개 그룹 제한
    const limitedKeywords = keywords.slice(0, 5);
    const { startDate, endDate } = getPeriodDates(period);

    const requestBody = {
      startDate,
      endDate,
      timeUnit,
      keywordGroups: limitedKeywords.map(kw => ({
        groupName: kw,
        keywords:  [kw],
      })),
      ...(device ? { device } : {}),
      ...(gender ? { gender } : {}),
      ...(ages.length > 0 ? { ages } : {}),
    };

    const res = await fetch(DATALAB_SEARCH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Naver-Client-Id':     clientId,
        'X-Naver-Client-Secret': clientSecret,
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(15000),
    });

    const rawText = await res.text();
    if (!res.ok) {
      console.error('[naver-trend]', res.status, rawText.slice(0, 300));
      return NextResponse.json(
        { error: `Naver DataLab 오류 [${res.status}]: ${rawText.slice(0, 200)}` },
        { status: res.status }
      );
    }

    let data: {
      results?: {
        title: string;
        keywords: string[];
        data: { period: string; ratio: number }[];
      }[];
    };
    try { data = JSON.parse(rawText); }
    catch { return NextResponse.json({ error: 'API 응답 파싱 실패' }, { status: 500 }); }

    // 응답 정제: 각 키워드별 period→ratio 배열 반환
    const results = (data.results ?? []).map(r => ({
      keyword: r.title,
      data: r.data.map(d => ({
        period: d.period,
        ratio:  Math.round(d.ratio * 10) / 10,
      })),
      peak: Math.max(...r.data.map(d => d.ratio)),
      latest: r.data[r.data.length - 1]?.ratio ?? 0,
    }));

    return NextResponse.json({
      startDate,
      endDate,
      timeUnit,
      results,
    });
  } catch (err: unknown) {
    console.error('[naver-trend]', err);
    if (err instanceof Error && err.name === 'TimeoutError') {
      return NextResponse.json({ error: 'Naver DataLab API 타임아웃' }, { status: 408 });
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : '트렌드 조회 실패' }, { status: 500 });
  }
}
