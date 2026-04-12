/**
 * 완전 자동화 블로그 작성 파이프라인
 *
 * POST /api/auto-blog/run
 *
 * Body:
 *   geo           지역 코드 (기본 'KR')
 *   seoPlatform   'naver' | 'google' (기본 'naver')
 *   tone          문체 (기본 'friendly')
 *   minLength     최소 글자수 (기본 1500)
 *   autoPublish   자동 발행 여부 (기본 false)
 *   publishPlatform 발행 플랫폼 (기본 'wordpress')
 *
 * 파이프라인 단계:
 *   1. 트렌드 수집       구글 트렌드 + 네이버 DataLab
 *   2. AI 주제 선정      LLM이 블로그 적합 주제 선별
 *   3. 키워드 리서치     네이버 검색광고 API (검색량 + 경쟁도)
 *   4. 경쟁 포스트 크롤링 Naver 블로그 검색 상위 3개
 *   5. SEO 글 작성       LLM + SEO 체크리스트
 *   6. 자동 발행         (autoPublish=true 일 때)
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import crypto from 'crypto';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';

// Vercel 타임아웃 연장
export const maxDuration = 60;

// ─── 타입 ─────────────────────────────────────────────────────────────────────
type StepStatus = 'pending' | 'running' | 'done' | 'skipped' | 'error';

interface PipelineStep {
  id:      string;
  label:   string;
  status:  StepStatus;
  data?:   unknown;
  error?:  string;
}

interface TrendItem    { title: string; traffic?: string }
interface KeywordData  { keyword: string; monthlyTotal: number; competition: number; opportunity: number }
interface CompetitorPost { title: string; url: string; content: string; length: number }

// ─── LLM 호출 ─────────────────────────────────────────────────────────────────
async function callLLM(
  provider: string,
  apiKey: string,
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
  maxTokens = 4000,
): Promise<string> {
  if (provider === 'anthropic') {
    const { Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey });
    const sys      = messages.find(m => m.role === 'system')?.content ?? '';
    const userMsgs = messages
      .filter(m => m.role !== 'system')
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));
    const res = await client.messages.create({
      model: 'claude-sonnet-4-6', max_tokens: maxTokens,
      system: sys, messages: userMsgs,
    });
    return res.content[0]?.type === 'text' ? res.content[0].text : '';
  }
  if (provider === 'qwen') {
    const res = await fetch('https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'qwen-plus', messages, max_tokens: maxTokens, temperature: 0.7 }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`Qwen 오류: ${JSON.stringify(data)}`);
    return data.choices?.[0]?.message?.content ?? '';
  }
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({ apiKey });
  const res = await client.chat.completions.create({
    model: 'gpt-4o', messages, max_tokens: maxTokens, temperature: 0.7,
  });
  return res.choices[0]?.message?.content ?? '';
}

// ─── RSS XML 파싱 헬퍼 ────────────────────────────────────────────────────────
function extractTag(tag: string, xml: string): string {
  const cdataRe = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, 'i');
  const plainRe = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = cdataRe.exec(xml) ?? plainRe.exec(xml);
  return m ? m[1].trim() : '';
}

// ─── 1단계: 트렌드 수집 — Google Trends RSS ───────────────────────────────────
async function fetchTrends(geo: string): Promise<TrendItem[]> {
  try {
    const url = `https://trends.google.com/trending/rss?geo=${geo}&hl=ko`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
        'Accept-Language': 'ko-KR,ko;q=0.9',
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`RSS ${res.status}`);
    const xml = await res.text();

    const itemBlocks = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
    return itemBlocks.slice(0, 20).map(block => ({
      title:   extractTag('title', block),
      traffic: extractTag('ht:approx_traffic', block),
    })).filter(t => t.title);
  } catch {
    return [];
  }
}

// ─── 2단계: AI 주제 선정 ──────────────────────────────────────────────────────
async function selectTopic(
  provider: string,
  apiKey: string,
  trends: TrendItem[],
  seoPlatform: string,
): Promise<{ topic: string; keyword: string; relatedKeywords: string[]; reason: string }> {
  const trendList = trends
    .slice(0, 20)
    .map((t, i) => `${i + 1}. ${t.title}${t.traffic ? ` (${t.traffic})` : ''}`)
    .join('\n');

  const prompt = `다음은 오늘의 급상승 검색어 목록입니다:

${trendList}

위 트렌드 중 ${seoPlatform === 'naver' ? '네이버 블로그' : '구글 블로그'}에 올리기 좋은 주제를 선정하세요.

선정 기준:
- 정보성 콘텐츠로 만들 수 있는 주제 (단순 사건/사고 제외)
- 검색량이 높고 경쟁이 상대적으로 낮을 것으로 예상되는 주제
- 롱폼 블로그 글(1500자 이상)을 작성할 수 있는 주제

반드시 아래 JSON 형식으로만 응답하세요:
{
  "topic": "선정된 블로그 주제",
  "keyword": "메인 SEO 키워드 (2~4단어)",
  "relatedKeywords": ["연관키워드1", "연관키워드2", "연관키워드3", "연관키워드4", "연관키워드5"],
  "reason": "선정 이유 (한 문장)"
}`;

  const raw = await callLLM(provider, apiKey, [
    { role: 'system', content: 'SEO 전문가로서 블로그 주제를 선정합니다. JSON만 응답하세요.' },
    { role: 'user', content: prompt },
  ], 800);

  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('주제 선정 JSON 파싱 실패');
  return JSON.parse(match[0]);
}

// ─── 3단계: 키워드 리서치 (네이버 검색광고) ──────────────────────────────────
function makeNaverAdsSignature(
  secretKey: string, method: string, path: string,
): { timestamp: string; signature: string } {
  const timestamp = Date.now().toString();
  const message   = `${timestamp}.${method}.${path}`;
  const signature = crypto.createHmac('sha256', secretKey).update(message).digest('base64');
  return { timestamp, signature };
}

function parseVolume(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    if (v === '< 10' || v === '<10') return 5;
    return parseInt(v.replace(/[^0-9]/g, ''), 10) || 0;
  }
  return 0;
}

async function fetchKeywordVolume(
  keyword: string,
  customerId: string,
  accessLicense: string,
  secretKey: string,
): Promise<KeywordData | null> {
  const path   = '/keywordstool';
  const { timestamp, signature } = makeNaverAdsSignature(secretKey, 'GET', path);
  const url    = `https://api.naver.com${path}?hintKeywords=${encodeURIComponent(keyword)}&showDetail=1`;
  try {
    const res  = await fetch(url, {
      headers: {
        'X-Timestamp':       timestamp,
        'X-API-KEY':         accessLicense,
        'X-Customer':        customerId,
        'X-Signature':       signature,
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const items: Record<string, unknown>[] = data?.keywordList ?? [];
    const match = items.find(i => String(i.relKeyword) === keyword) ?? items[0];
    if (!match) return null;

    const pc     = parseVolume(match.monthlyPcQcCnt);
    const mobile = parseVolume(match.monthlyMobileQcCnt);
    const total  = pc + mobile;
    const comp   = typeof match.compIdx === 'string'
      ? { '낮음': 0.2, '중간': 0.5, '높음': 0.9 }[match.compIdx as string] ?? 0.5
      : Number(match.compIdx ?? 0.5);
    const opportunity = Math.round(Math.min(total / 100000, 1) * (1 - comp * 0.7) * 100);

    return { keyword, monthlyTotal: total, competition: comp, opportunity };
  } catch { return null; }
}

// ─── 4단계: 경쟁 포스트 크롤링 ───────────────────────────────────────────────
async function crawlSinglePost(url: string): Promise<CompetitorPost | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept':          'text/html,application/xhtml+xml,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9',
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const html    = await res.text();
    const dom     = new JSDOM(html, { url });
    const reader  = new Readability(dom.window.document);
    const article = reader.parse();
    if (!article?.textContent) return null;

    const content = article.textContent
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim()
      .slice(0, 3000);

    return { title: article.title ?? '', url, content, length: content.length };
  } catch { return null; }
}

async function crawlCompetitors(keyword: string, maxCount = 3): Promise<CompetitorPost[]> {
  try {
    // 네이버 블로그 검색 결과 페이지 크롤링
    const searchUrl = `https://search.naver.com/search.naver?where=blog&query=${encodeURIComponent(keyword)}&display=10`;
    const searchRes = await fetch(searchUrl, {
      headers: {
        'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'ko-KR,ko;q=0.9',
        'Referer':         'https://www.naver.com/',
      },
      signal: AbortSignal.timeout(10000),
    });
    const html = await searchRes.text();

    // 블로그 URL 추출 (blog.naver.com + tistory)
    const urlPattern = /https?:\/\/(?:blog\.naver\.com\/[^"'\s<>?]+|[a-z0-9-]+\.tistory\.com\/[^"'\s<>?]+)/g;
    const rawUrls    = html.match(urlPattern) ?? [];
    // 중복 제거 + 짧은 URL 제외 (프로필/카테고리 페이지)
    const urls = [...new Set(rawUrls)]
      .filter(u => u.length > 40)
      .slice(0, maxCount * 2);

    // 병렬 크롤링
    const results = await Promise.all(urls.slice(0, maxCount + 2).map(crawlSinglePost));
    return results.filter((r): r is CompetitorPost => r !== null && r.length > 200).slice(0, maxCount);
  } catch { return []; }
}

// ─── 5단계: SEO 글 작성 ──────────────────────────────────────────────────────
interface WriteParams {
  provider:        string;
  apiKey:          string;
  keyword:         string;
  relatedKeywords: string[];
  seoPlatform:     string;
  tone:            string;
  minLength:       number;
  competitors:     CompetitorPost[];
  monthlyVolume:   number;
}

async function writeSeoPost(params: WriteParams): Promise<{
  title: string; content: string; metaTitle: string; metaDescription: string;
  slug: string; tags: string[]; seoScore: number;
}> {
  const {
    provider, apiKey, keyword, relatedKeywords, seoPlatform, tone, minLength, competitors, monthlyVolume,
  } = params;

  const competitorSummary = competitors.length
    ? `\n\n## 경쟁 포스트 분석 (상위 ${competitors.length}개)\n` +
      competitors.map((c, i) =>
        `### ${i + 1}. ${c.title}\n${c.content.slice(0, 500)}...`
      ).join('\n\n')
    : '';

  const volumeHint = monthlyVolume > 0
    ? `\n※ 월간 검색량 약 ${monthlyVolume.toLocaleString()}회. ${
        monthlyVolume > 50000 ? '경쟁 치열 — 독창적 앵글로 차별화 필수.' :
        monthlyVolume > 10000 ? '적당한 검색량 — 충실한 정보로 경쟁 우위 확보.' :
        '롱테일 키워드 — 전문적이고 구체적인 내용으로 타겟 공략.'
      }`
    : '';

  const seoGuide = seoPlatform === 'naver'
    ? `네이버 C-RANK+DIA 최적화: 제목 맨 앞에 "${keyword}", 소제목에 연관 키워드, 최소 ${minLength}자, 이미지 삽입 안내 포함, 공감/댓글 유도`
    : `구글 E-E-A-T 최적화: H1에 "${keyword}", H2에 연관 검색어, FAQ 섹션, 160자 이내 메타 설명, 내부 링크 제안`;

  const systemPrompt = `당신은 SEO 블로그 작가입니다. ${seoGuide}

반드시 아래 JSON 형식으로만 응답하세요:
{
  "title": "SEO 제목",
  "metaTitle": "메타 title (60자 이내)",
  "metaDescription": "메타 설명 (160자 이내)",
  "content": "## 마크다운 본문...",
  "tags": ["태그1","태그2","태그3","태그4","태그5","태그6","태그7","태그8","태그9","태그10"]
}
content는 마크다운, 최소 ${minLength}자 이상.`;

  const toneMap: Record<string, string> = {
    friendly: '친근하고 대화체', professional: '전문적이고 권위 있는',
    casual: '자유로운', educational: '교육적인',
  };

  const userPrompt = `메인 키워드: ${keyword}
연관 키워드: ${relatedKeywords.join(', ')}
문체: ${toneMap[tone] ?? '친근하고 대화체'}
최소 글자수: ${minLength}자 이상${volumeHint}${competitorSummary}

경쟁 포스트와 차별화되는 고품질 SEO 블로그 글을 작성해주세요. JSON만 응답하세요.`;

  const raw = await callLLM(provider, apiKey, [
    { role: 'system', content: systemPrompt },
    { role: 'user',   content: userPrompt },
  ], 5000);

  let parsed: { title: string; metaTitle: string; metaDescription: string; content: string; tags: string[] };
  try {
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('JSON 없음');
    parsed = JSON.parse(m[0]);
  } catch {
    parsed = {
      title:           `${keyword} 완벽 가이드`,
      metaTitle:       `${keyword} 완벽 가이드`.slice(0, 60),
      metaDescription: `${keyword}에 대한 모든 것`.slice(0, 160),
      content:         raw,
      tags:            [keyword, ...relatedKeywords.slice(0, 9)],
    };
  }

  // SEO 간단 점수
  const checks = [
    parsed.title.includes(keyword),
    parsed.content.split('\n').slice(0, 5).join(' ').includes(keyword),
    parsed.content.length >= minLength,
    (parsed.content.match(/^#{1,3}\s/gm) ?? []).length >= 3,
    (parsed.content.match(new RegExp(keyword, 'g')) ?? []).length >= 3,
    seoPlatform === 'naver' ? parsed.content.includes('[이미지') : parsed.content.includes('FAQ') || parsed.content.includes('자주 묻는'),
  ];
  const seoScore = Math.round((checks.filter(Boolean).length / checks.length) * 100);

  // slug
  const ascii = keyword.replace(/[^a-zA-Z0-9\s-]/g, '').trim().toLowerCase().replace(/\s+/g, '-');
  const slug  = (ascii.length > 2 ? ascii : 'post') + '-' + Date.now().toString(36);

  return {
    title:           parsed.title,
    metaTitle:       (parsed.metaTitle ?? parsed.title).slice(0, 60),
    metaDescription: (parsed.metaDescription ?? '').slice(0, 160),
    content:         parsed.content,
    tags:            (parsed.tags ?? [keyword]).slice(0, 10),
    slug,
    seoScore,
  };
}

// ─── POST Handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });

    const meta = user.user_metadata ?? {};

    const {
      geo             = 'KR',
      seoPlatform     = 'naver',
      tone            = 'friendly',
      minLength       = 1500,
      autoPublish     = false,
      publishPlatform = 'wordpress',
    } = await req.json() as {
      geo?:             string;
      seoPlatform?:     'naver' | 'google';
      tone?:            string;
      minLength?:       number;
      autoPublish?:     boolean;
      publishPlatform?: string;
    };

    // ── LLM 제공자 선택 ────────────────────────────────────────────────────────
    let provider = '';
    let apiKey   = '';
    for (const [p, k] of [
      ['anthropic', meta.anthropic_api_key],
      ['openai',    meta.openai_api_key],
      ['qwen',      meta.qwen_api_key],
    ] as [string, string][]) {
      if (k) { provider = p; apiKey = k; break; }
    }
    if (!provider) {
      return NextResponse.json({ error: 'AI API 키가 필요합니다. 설정에서 Anthropic / OpenAI / Qwen 키를 등록해주세요.' }, { status: 400 });
    }

    const steps: PipelineStep[] = [
      { id: 'trends',   label: '트렌드 수집',        status: 'pending' },
      { id: 'topic',    label: 'AI 주제 선정',        status: 'pending' },
      { id: 'keywords', label: '키워드 리서치',       status: 'pending' },
      { id: 'crawl',    label: '경쟁 포스트 크롤링',  status: 'pending' },
      { id: 'write',    label: 'SEO 글 작성',         status: 'pending' },
      { id: 'publish',  label: '자동 발행',           status: autoPublish ? 'pending' : 'skipped' },
    ];

    const update = (id: string, status: StepStatus, data?: unknown, error?: string) => {
      const s = steps.find(s => s.id === id);
      if (s) { s.status = status; if (data !== undefined) s.data = data; if (error) s.error = error; }
    };

    // ── 1. 트렌드 수집 ──────────────────────────────────────────────────────────
    update('trends', 'running');
    let trends: TrendItem[] = [];
    try {
      trends = await fetchTrends(geo.toUpperCase());
      update('trends', 'done', { count: trends.length, sample: trends.slice(0, 5).map(t => t.title) });
    } catch (e) {
      update('trends', 'error', undefined, (e as Error).message);
      return NextResponse.json({ steps, error: '트렌드 수집 실패' }, { status: 500 });
    }

    if (trends.length === 0) {
      update('trends', 'error', undefined, '트렌드 데이터 없음');
      return NextResponse.json({ steps, error: '트렌드 데이터를 가져오지 못했습니다' }, { status: 500 });
    }

    // ── 2. AI 주제 선정 ─────────────────────────────────────────────────────────
    update('topic', 'running');
    let topicResult: { topic: string; keyword: string; relatedKeywords: string[]; reason: string };
    try {
      topicResult = await selectTopic(provider, apiKey, trends, seoPlatform);
      update('topic', 'done', topicResult);
    } catch (e) {
      update('topic', 'error', undefined, (e as Error).message);
      return NextResponse.json({ steps, error: '주제 선정 실패' }, { status: 500 });
    }

    // ── 3. 키워드 리서치 ────────────────────────────────────────────────────────
    update('keywords', 'running');
    let keywordData: KeywordData | null = null;
    const customerId     = meta.naver_ads_customer_id;
    const accessLicense  = meta.naver_ads_access_license;
    const adsSecretKey   = meta.naver_ads_secret_key;

    if (customerId && accessLicense && adsSecretKey) {
      try {
        keywordData = await fetchKeywordVolume(
          topicResult.keyword, customerId, accessLicense, adsSecretKey,
        );
        update('keywords', 'done', keywordData ?? { message: '해당 키워드 데이터 없음' });
      } catch (e) {
        update('keywords', 'skipped', { message: `키워드 리서치 실패: ${(e as Error).message}` });
      }
    } else {
      update('keywords', 'skipped', { message: '네이버 검색광고 API 키 미설정 — 건너뜀' });
    }

    // ── 4. 경쟁 포스트 크롤링 ───────────────────────────────────────────────────
    update('crawl', 'running');
    let competitors: CompetitorPost[] = [];
    try {
      competitors = await crawlCompetitors(topicResult.keyword, 3);
      update('crawl', 'done', {
        count: competitors.length,
        titles: competitors.map(c => c.title),
      });
    } catch (e) {
      update('crawl', 'skipped', { message: `크롤링 실패 — 참고 없이 작성: ${(e as Error).message}` });
    }

    // ── 5. SEO 글 작성 ──────────────────────────────────────────────────────────
    update('write', 'running');
    let post: Awaited<ReturnType<typeof writeSeoPost>>;
    try {
      post = await writeSeoPost({
        provider,
        apiKey,
        keyword:         topicResult.keyword,
        relatedKeywords: topicResult.relatedKeywords,
        seoPlatform,
        tone,
        minLength,
        competitors,
        monthlyVolume:   keywordData?.monthlyTotal ?? 0,
      });
      update('write', 'done', {
        title:    post.title,
        seoScore: post.seoScore,
        length:   post.content.length,
      });
    } catch (e) {
      update('write', 'error', undefined, (e as Error).message);
      return NextResponse.json({ steps, error: '글 작성 실패' }, { status: 500 });
    }

    // ── 6. 자동 발행 ────────────────────────────────────────────────────────────
    let publishResult: { success: boolean; link?: string } | null = null;
    if (autoPublish) {
      update('publish', 'running');
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/api/blog/publish`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            platform:      publishPlatform,
            title:         post.title,
            content:       post.content,
            statusOverride: 'draft',
          }),
        });
        const data = await res.json() as { link?: string; postUrl?: string; error?: string };
        if (!res.ok) throw new Error(data.error ?? '발행 실패');
        publishResult = { success: true, link: data.link ?? data.postUrl };
        update('publish', 'done', publishResult);
      } catch (e) {
        update('publish', 'error', undefined, (e as Error).message);
        publishResult = { success: false };
      }
    }

    return NextResponse.json({
      steps,
      topic:       topicResult,
      keywordData,
      competitors: competitors.map(c => ({ title: c.title, url: c.url, length: c.length })),
      post,
      publishResult,
      provider,
    });
  } catch (err: unknown) {
    console.error('[auto-blog/run]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '파이프라인 실행 실패' },
      { status: 500 },
    );
  }
}
