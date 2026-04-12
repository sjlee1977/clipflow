/**
 * Google Trends — 급상승 검색어 + 연관 키워드
 *
 * GET /api/seo/google-trends?geo=KR&keyword=홈트레이닝
 *
 * 급상승 검색어: Google Trends RSS 피드 (비공식 JSON API보다 안정적)
 *   https://trends.google.com/trending/rss?geo=KR
 *
 * 연관 검색어: 비공식 explore + widgetdata API (실패 시 빈 배열 반환)
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

const COMMON_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Referer': 'https://trends.google.com/',
};

// ─── HTML 엔티티 디코딩 ───────────────────────────────────────────────────────
function decodeHtml(str: string): string {
  return str
    .replace(/&amp;/g,  '&')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g,  "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g,   '<')
    .replace(/&gt;/g,   '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

// ─── RSS 파싱 유틸 ─────────────────────────────────────────────────────────────
function extractCdata(tag: string, xml: string): string {
  const cdataRe = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, 'i');
  const plainRe = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = cdataRe.exec(xml) ?? plainRe.exec(xml);
  return m ? decodeHtml(m[1].trim()) : '';
}

function extractAll(tag: string, xml: string): string[] {
  const re = new RegExp(`<${tag}[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi');
  return (xml.match(re) ?? []);
}

// ─── 급상승 검색어 — RSS 피드 ─────────────────────────────────────────────────
async function fetchDailyTrends(geo: string): Promise<{
  title: string; traffic: string; articles: { title: string; url: string }[];
}[]> {
  const url = `https://trends.google.com/trending/rss?geo=${geo}&hl=ko`;
  const res = await fetch(url, {
    headers: { ...COMMON_HEADERS, Accept: 'application/rss+xml, application/xml, text/xml, */*' },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`RSS ${res.status}`);
  const xml = await res.text();

  // <item> 블록 추출
  const itemBlocks = extractAll('item', xml);
  return itemBlocks.map(block => {
    const title   = extractCdata('title', block);
    const traffic = extractCdata('ht:approx_traffic', block);

    // 뉴스 아이템
    const newsBlocks = extractAll('ht:news_item', block);
    const articles = newsBlocks.slice(0, 3).map(nb => ({
      title: extractCdata('ht:news_item_title', nb),
      url:   extractCdata('ht:news_item_url', nb),
    })).filter(a => a.title || a.url);

    return { title, traffic, articles };
  }).filter(t => t.title);
}

// ─── 키워드 연관 검색어 — Google 자동완성 API ────────────────────────────────
// suggestqueries.google.com 은 브라우저 자동완성과 동일한 엔드포인트로
// 서버에서도 안정적으로 호출 가능 (explore/widgetdata는 서버 IP 차단됨)
async function fetchRelatedQueries(keyword: string, geo: string): Promise<{
  rising: { query: string; value: number }[];
  top:    { query: string; value: number }[];
}> {
  const lang = geo === 'US' ? 'en' : geo === 'JP' ? 'ja' : 'ko';
  const gl   = geo.toLowerCase();

  // 기본 자동완성
  const baseUrl = `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(keyword)}&hl=${lang}&gl=${gl}`;
  const baseRes = await fetch(baseUrl, {
    headers: { 'User-Agent': COMMON_HEADERS['User-Agent'], 'Accept-Language': COMMON_HEADERS['Accept-Language'] },
    signal: AbortSignal.timeout(8000),
  });
  if (!baseRes.ok) throw new Error(`suggest ${baseRes.status}`);

  // Firefox client는 JSON 배열 반환: [query, [suggestions...]]
  const baseData = await baseRes.json() as [string, string[]];
  const suggestions: string[] = (baseData[1] ?? []).filter(s => s !== keyword);

  // 연관 검색어 확장: "keyword " prefix로 추가 변형 수집
  let extended: string[] = [];
  try {
    const extUrl = `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(keyword + ' ')}&hl=${lang}&gl=${gl}`;
    const extRes = await fetch(extUrl, {
      headers: { 'User-Agent': COMMON_HEADERS['User-Agent'] },
      signal: AbortSignal.timeout(6000),
    });
    if (extRes.ok) {
      const extData = await extRes.json() as [string, string[]];
      extended = (extData[1] ?? []).filter(s => s !== keyword && !suggestions.includes(s));
    }
  } catch { /* silent */ }

  // top: 자동완성 기본 제안 (인기순)
  const top = suggestions.slice(0, 10).map((q, i) => ({
    query: q,
    value: Math.round(((10 - i) / 10) * 100),
  }));

  // rising: 확장 제안 (새로운 변형)
  const rising = extended.slice(0, 8).map((q, i) => ({
    query: q,
    value: Math.round(((8 - i) / 8) * 100),
  }));

  return { rising, top };
}

// ─── GET Handler ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const geo     = searchParams.get('geo')?.toUpperCase() ?? 'KR';
    const keyword = searchParams.get('keyword')?.trim() ?? '';

    const result: {
      geo: string;
      daily: Awaited<ReturnType<typeof fetchDailyTrends>>;
      related: Awaited<ReturnType<typeof fetchRelatedQueries>> | null;
    } = { geo, daily: [], related: null };

    // 급상승 검색어
    try {
      result.daily = await fetchDailyTrends(geo);
    } catch (e) {
      console.warn('[google-trends] dailytrends 실패:', (e as Error).message);
      result.daily = [];
    }

    // 키워드 연관 검색어
    if (keyword) {
      try {
        result.related = await fetchRelatedQueries(keyword, geo);
      } catch (e) {
        console.warn('[google-trends] relatedQueries 실패:', (e as Error).message);
        result.related = { rising: [], top: [] };
      }
    }

    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error('[google-trends]', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Google Trends 조회 실패' }, { status: 500 });
  }
}
