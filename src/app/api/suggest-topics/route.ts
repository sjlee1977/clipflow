/**
 * POST /api/suggest-topics
 *
 * 키워드를 받아 실제 트렌드 데이터 기반 7개 주제 후보를 반환한다.
 *
 * 트렌드 소스 (순서대로 시도):
 *   1. Google Trends 급상승 + 연관 검색어 (API 키 불필요)
 *   2. Naver DataLab 검색 트렌드 (API 키 있을 때만)
 *   3. 둘 다 실패 시 → LLM 자체 추론으로 폴백
 *
 * Body: { keyword: string, category?: string, model?: string }
 * Response: { suggestions: TopicSuggestion[], trendSource: string }
 */
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase-server';
import fs from 'fs';
import path from 'path';

interface TopicSuggestion {
  title:   string;
  angle:   string;
  type:    string;
  whyNow:  string;
  hook:    string;
}

// ── World State ────────────────────────────────────────────────────────────────
function getWorldState(): Record<string, unknown> | null {
  try {
    const filePath = path.join(process.cwd(), 'src/app/api/world-state/current.json');
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch { return null; }
}

// ── Google Trends: 급상승 검색어 (RSS) ────────────────────────────────────────
function decodeHtml(s: string) {
  return s
    .replace(/&amp;/g, '&').replace(/&apos;/g, "'").replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, (_, c) => String.fromCharCode(Number(c)));
}
function extractCdata(tag: string, xml: string): string {
  const m = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, 'i').exec(xml)
    ?? new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i').exec(xml);
  return m ? decodeHtml(m[1].trim()) : '';
}

async function fetchGoogleTrending(geo = 'KR'): Promise<string[]> {
  try {
    const res = await fetch(
      `https://trends.google.com/trending/rss?geo=${geo}&hl=ko`,
      {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'ko-KR,ko;q=0.9' },
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!res.ok) return [];
    const xml   = await res.text();
    const items = [...xml.matchAll(/<item>[\s\S]*?<\/item>/gi)];
    return items.map(m => extractCdata('title', m[0])).filter(Boolean).slice(0, 10);
  } catch { return []; }
}

// ── Google 자동완성 — 연관 검색어 ─────────────────────────────────────────────
async function fetchGoogleRelated(keyword: string): Promise<string[]> {
  try {
    const url = `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(keyword)}&hl=ko&gl=kr`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'ko-KR' },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return [];
    const data = await res.json() as [string, string[]];
    return (data[1] ?? []).filter((s: string) => s !== keyword).slice(0, 8);
  } catch { return []; }
}

// ── Naver DataLab — 검색 트렌드 ───────────────────────────────────────────────
async function fetchNaverTrend(
  keyword: string,
  clientId: string,
  clientSecret: string,
): Promise<{ rising: boolean; latestRatio: number } | null> {
  try {
    const now   = new Date();
    const end   = now.toISOString().slice(0, 10);
    const start = new Date(now.setMonth(now.getMonth() - 1)).toISOString().slice(0, 10);
    const res = await fetch('https://openapi.naver.com/v1/datalab/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Naver-Client-Id':     clientId,
        'X-Naver-Client-Secret': clientSecret,
      },
      body: JSON.stringify({
        startDate: start, endDate: end, timeUnit: 'week',
        keywordGroups: [{ groupName: keyword, keywords: [keyword] }],
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const points: { period: string; ratio: number }[] = data.results?.[0]?.data ?? [];
    if (points.length < 2) return null;
    const last   = points[points.length - 1].ratio;
    const prev   = points[points.length - 2].ratio;
    return { rising: last > prev * 1.1, latestRatio: last };
  } catch { return null; }
}

// ── LLM 호출 ──────────────────────────────────────────────────────────────────
async function callLLM(
  model: string, apiKeys: Record<string, string>,
  systemPrompt: string, userPrompt: string,
): Promise<string> {
  const isClaude = model.startsWith('claude');
  const isQwen   = model.startsWith('qwen');

  if (isClaude) {
    const key = apiKeys.anthropic;
    if (!key) throw new Error('Anthropic API 키 없음');
    const c = new Anthropic({ apiKey: key });
    const r = await c.messages.create({
      model, max_tokens: 2500, temperature: 0.75,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });
    return r.content[0]?.type === 'text' ? r.content[0].text : '';
  }

  if (isQwen) {
    const key = apiKeys.qwen;
    if (!key) throw new Error('Qwen API 키 없음');
    const r = await fetch('https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model, max_tokens: 2500, temperature: 0.75,
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
      }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(`Qwen: ${d?.error?.message ?? r.status}`);
    return d.choices?.[0]?.message?.content ?? '';
  }

  // Gemini (기본)
  const key = apiKeys.gemini;
  if (!key) throw new Error('Gemini API 키 없음');
  const ai = new GoogleGenAI({ apiKey: key });
  const r  = await ai.models.generateContent({
    model,
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    config: { systemInstruction: systemPrompt, maxOutputTokens: 2500, temperature: 0.75 },
  });
  return r.text ?? '';
}

// ── POST Handler ───────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { keyword, category = 'general', model: reqModel } = await req.json();
    if (!keyword?.trim()) {
      return NextResponse.json({ error: '키워드가 필요합니다' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });

    const meta    = user.user_metadata ?? {};
    const apiKeys = {
      gemini:    meta.gemini_api_key    ?? '',
      anthropic: meta.anthropic_api_key ?? '',
      qwen:      meta.qwen_api_key      ?? '',
    };

    // 사용할 모델 결정
    let model = reqModel ?? '';
    if (!model) {
      if (apiKeys.gemini)    model = 'gemini-2.5-flash';
      else if (apiKeys.anthropic) model = 'claude-haiku-4-5-20251001';
      else if (apiKeys.qwen) model = 'qwen3.5-flash';
      else throw new Error('사용 가능한 AI API 키가 없습니다. 설정에서 등록해주세요.');
    }

    // ── 트렌드 데이터 수집 (병렬) ──────────────────────────────────────────────
    const [googleTrending, googleRelated, naverTrend, worldState] = await Promise.all([
      fetchGoogleTrending('KR'),
      fetchGoogleRelated(keyword.trim()),
      (meta.naver_client_id && meta.naver_client_secret)
        ? fetchNaverTrend(keyword.trim(), meta.naver_client_id, meta.naver_client_secret)
        : Promise.resolve(null),
      Promise.resolve(getWorldState()),
    ]);

    const trendSources: string[] = [];
    if (googleTrending.length > 0 || googleRelated.length > 0) trendSources.push('Google Trends');
    if (naverTrend) trendSources.push('Naver DataLab');
    const trendSource = trendSources.join(' + ') || 'AI 자체 추론';

    // ── 트렌드 컨텍스트 조합 ───────────────────────────────────────────────────
    const trendContext = [
      googleTrending.length > 0
        ? `[Google 급상승 검색어 (오늘 KR)]\n${googleTrending.slice(0, 8).map((t, i) => `${i + 1}. ${t}`).join('\n')}`
        : '',
      googleRelated.length > 0
        ? `[Google 연관 검색어 — "${keyword}"]\n${googleRelated.map((q, i) => `${i + 1}. ${q}`).join('\n')}`
        : '',
      naverTrend
        ? `[Naver 트렌드 — "${keyword}"]\n최근 검색량 지수: ${naverTrend.latestRatio} / 추세: ${naverTrend.rising ? '📈 상승 중' : '→ 보합'}`
        : '',
      worldState
        ? `[현재 세계 상황]\n${JSON.stringify(worldState, null, 2).slice(0, 600)}`
        : '',
    ].filter(Boolean).join('\n\n');

    // ── 카테고리 채널 성격 ─────────────────────────────────────────────────────
    const CATEGORY_CONTEXT: Record<string, string> = {
      economy:    '경제/주식/투자 채널 — 시청자는 돈과 직결된 정보와 투자 인사이트를 원한다',
      horror:     '공포/미스터리 채널 — 소름 돋는 실화와 미설명 사건을 찾는다',
      psychology: '심리학 채널 — 인간 행동의 숨겨진 원리와 자기계발에 관심있다',
      health:     '건강/의학 채널 — 신뢰할 수 있는 건강 정보를 원한다',
      history:    '역사 채널 — 잊혀진 사건과 숨겨진 진실을 발굴한다',
      general:    '일반 교양/정보 채널',
    };

    const systemPrompt = `당신은 유튜브 콘텐츠 기획 전문가입니다.
키워드와 실제 트렌드 데이터를 받아 지금 올리면 잘 될 영상 주제 7개를 제안합니다.

채널 성격: ${CATEGORY_CONTEXT[category] ?? CATEGORY_CONTEXT.general}

규칙:
- 7개는 각각 다른 유형 (충격/비교/예측/인사이더/스토리/논쟁/교육 중 하나씩)
- 제목은 실제 유튜브에서 클릭하고 싶어지는 형식 (15~40자 한국어)
- 트렌드 데이터의 연관 키워드를 제목에 자연스럽게 녹인다
- 지금 이 시점에 올려야 하는 이유가 있는 주제 우선
- JSON 배열만 출력, 다른 텍스트 절대 없음`;

    const userPrompt = `입력 키워드: "${keyword.trim()}"
카테고리: ${category}

${trendContext || '(트렌드 데이터 없음 — 자체 추론으로 생성)'}

위 트렌드 데이터를 최대한 반영해서, 지금 이 키워드로 유튜브에 올리면 잘 될 영상 주제 7개를 만들어주세요.

출력 (JSON 배열, 정확히 7개):
[
  {
    "title": "클릭하고 싶은 유튜브 제목 (15~40자)",
    "angle": "이 주제의 핵심 각도 한 줄",
    "type": "충격 | 비교 | 예측 | 인사이더 | 스토리 | 논쟁 | 교육",
    "whyNow": "왜 지금 이 주제가 화제인가 (트렌드 데이터 근거 포함, 1~2문장)",
    "hook": "영상 첫 15초 대사 예시"
  }
]`;

    const raw = await callLLM(model, apiKeys, systemPrompt, userPrompt);

    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('주제 생성 파싱 실패');
    const suggestions: TopicSuggestion[] = JSON.parse(match[0]);

    return NextResponse.json({
      suggestions,
      keyword:     keyword.trim(),
      category,
      trendSource,
      trendData: {
        googleTrending: googleTrending.slice(0, 5),
        googleRelated:  googleRelated.slice(0, 5),
        naverTrend,
      },
    });

  } catch (err: unknown) {
    console.error('[suggest-topics]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '주제 추천 실패' },
      { status: 500 },
    );
  }
}
