/**
 * 블로그 키워드 분석 & 제목 제안 — 원스톱 API
 *
 * POST /api/blog/keyword-suggest
 * Body: { keyword: string, platform: 'naver' | 'google', llmModelId?: string }
 *
 * 파이프라인:
 *   1. Naver Ads API  → 연관 키워드 10개 + 월간 검색량 + 광고 경쟁도
 *   2. Naver Content  → 메인 키워드 월간 신규 발행량 (포화도)
 *   3. LLM            → 제목 7개 (검색량 ÷ 발행량 기회점수 기반)
 *                       Naver 키 없으면 연관 키워드 10개도 LLM 생성
 *
 * Naver API 키가 없으면 LLM 전용 모드로 폴백 (hasLiveData: false).
 *
 * 응답:
 *   relatedKeywords  — 10개 (검색량 · 경쟁도 · 기회점수 포함)
 *   titles           — 7개 (hookType · seoScore · opportunityScore · reason)
 *   hasLiveData      — Naver 실시간 데이터 사용 여부
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { GoogleGenAI } from '@google/genai';
import Anthropic from '@anthropic-ai/sdk';
import crypto from 'crypto';

// ── 타입 ────────────────────────────────────────────────────────────────────────
export interface RelatedKeyword {
  keyword: string;
  monthlyTotal: number;
  monthlyPc: number;
  monthlyMobile: number;
  compIdx: '낮음' | '중간' | '높음';
  opportunity: number;
}

export interface TitleSuggestion {
  title: string;
  hookType: '질문형' | '숫자형' | '충격형' | '약속형' | '비교형';
  seoScore: number;
  opportunityScore: number;
  reason: string;
}

export interface KeywordSuggestResult {
  keyword: string;
  relatedKeywords: RelatedKeyword[];
  titles: TitleSuggestion[];
  hasLiveData: boolean;
  searchVolume?: number;
  contentSaturation?: number;
  saturationRate?: number;
  model: string;
}

// ── Naver Ads API — HMAC 서명 ───────────────────────────────────────────────────
function makeNaverAdsSignature(secretKey: string, method: string, path: string) {
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
  if (s.includes('높') || s === 'high')                  return '높음';
  if (s.includes('중') || s === 'medium' || s === 'mid') return '중간';
  return '낮음';
}

// ── 초보자 황금구간 기반 기회 점수 계산 ────────────────────────────────────────────
// 벨 커브: 월 2,000~5,000 구간에서 최고점 (대형 키워드 편향 방지)
function calcOpportunity(total: number, compIdx: '낮음' | '중간' | '높음'): number {
  let volumeScore: number;
  if      (total < 300)    volumeScore = 0.10;
  else if (total < 1000)   volumeScore = 0.10 + (total -  300) /  700 * 0.30; // 0.10→0.40
  else if (total < 2000)   volumeScore = 0.40 + (total - 1000) / 1000 * 0.35; // 0.40→0.75
  else if (total <= 5000)  volumeScore = 0.75 + (total - 2000) / 3000 * 0.25; // 0.75→1.00 ← 황금구간
  else if (total <= 15000) volumeScore = 1.00 - (total - 5000) / 10000 * 0.35; // 1.00→0.65
  else if (total <= 50000) volumeScore = 0.65 - (total - 15000) / 35000 * 0.35; // 0.65→0.30
  else                     volumeScore = Math.max(0.10, 0.30 - (total - 50000) / 200000 * 0.20);

  const penalty = compIdx === '높음' ? 0.30 : compIdx === '중간' ? 0.65 : 1.0;
  return Math.round(volumeScore * penalty * 100);
}

// ── 1단계: Naver Ads — 연관 키워드 + 검색량 ─────────────────────────────────────
async function fetchNaverVolume(
  keyword: string,
  customerId: string,
  accessLicense: string,
  secretKey: string,
): Promise<RelatedKeyword[]> {
  const path = '/keywordstool';
  const { timestamp, signature } = makeNaverAdsSignature(secretKey, 'GET', path);
  const hint = keyword.replace(/\s+/g, '');
  const qs   = `hintKeywords=${encodeURIComponent(hint)}&showDetail=1&includeHintKeywords=1`;

  const res = await fetch(`https://api.naver.com${path}?${qs}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Timestamp': timestamp,
      'X-API-KEY':   accessLicense,
      'X-Customer':  customerId,
      'X-Signature': signature,
    },
    signal: AbortSignal.timeout(12000),
  });

  if (!res.ok) return [];
  const data = await res.json().catch(() => ({}));
  const list = (data.keywordList ?? []) as Record<string, unknown>[];

  return list.map(item => {
    const pc      = parseVolume(item.monthlyPcQcCnt);
    const mobile  = parseVolume(item.monthlyMobileQcCnt);
    const total   = pc + mobile;
    const comp    = normalizeCompIdx(item.compIdx);
    const penalty = comp === '높음' ? 0.3 : comp === '중간' ? 0.65 : 1.0;
    return {
      keyword:       String(item.relKeyword ?? ''),
      monthlyPc:     pc,
      monthlyMobile: mobile,
      monthlyTotal:  total,
      compIdx:       comp,
      opportunity:   calcOpportunity(total, comp),
    };
  }).sort((a, b) => b.opportunity - a.opportunity);
}

// ── 2단계: Naver Content — 월간 발행량 추정 ────────────────────────────────────
async function fetchNaverContent(
  keyword: string,
  clientId: string,
  clientSecret: string,
): Promise<number> {
  const headers = {
    'X-Naver-Client-Id':     clientId,
    'X-Naver-Client-Secret': clientSecret,
  };
  const base = `https://openapi.naver.com/v1/search/blog.json?query=${encodeURIComponent(keyword)}&sort=date`;

  const r1 = await fetch(`${base}&display=100`, { headers, signal: AbortSignal.timeout(8000) });
  if (!r1.ok) return 0;
  const d1 = await r1.json().catch(() => ({}));
  const total: number = d1.total ?? 0;
  const items: Record<string, unknown>[] = d1.items ?? [];
  if (items.length === 0 || total === 0) return 0;

  // 최신/기준점 날짜로 발행 속도 계산
  function parseDate(raw: unknown): Date | null {
    const s = String(raw ?? '').trim();
    if (/^\d{8}$/.test(s)) {
      return new Date(parseInt(s.slice(0,4)), parseInt(s.slice(4,6))-1, parseInt(s.slice(6,8)));
    }
    if (s.length > 8) { const d = new Date(s); if (!isNaN(d.getTime())) return d; }
    return null;
  }

  const newestDate = parseDate(items[0]?.postdate ?? items[0]?.pubDate);
  if (!newestDate) return Math.round(total / 12);

  const measureN = Math.min(total, 1000);
  let oldestDate: Date | null = null;

  if (total <= 100) {
    oldestDate = parseDate(items[items.length-1]?.postdate ?? items[items.length-1]?.pubDate);
  } else {
    const r2 = await fetch(`${base}&display=1&start=${measureN}`, { headers, signal: AbortSignal.timeout(8000) });
    if (r2.ok) {
      const d2 = await r2.json().catch(() => ({}));
      const items2: Record<string, unknown>[] = d2.items ?? [];
      if (items2.length > 0) oldestDate = parseDate(items2[0]?.postdate ?? items2[0]?.pubDate);
    }
  }

  if (!oldestDate) return Math.round(total / 12);
  const spanDays = Math.max((newestDate.getTime() - oldestDate.getTime()) / 86400000, 1);
  return Math.round((measureN / spanDays) * 30);
}

// ── 3단계: LLM — 태그 7개 + 제목 7개 생성 ─────────────────────────────────────
async function callLLM(
  model: string,
  apiKeys: Record<string, string>,
  system: string,
  userMsg: string,
): Promise<string> {
  const isClaude = model.startsWith('claude');
  const isQwen   = model.startsWith('qwen');
  const jsonHint = '\n\n반드시 유효한 JSON만 출력하세요. 마크다운 코드블록 없이.';

  if (isClaude) {
    const client = new Anthropic({ apiKey: apiKeys.anthropic });
    const res = await client.messages.create({
      model, max_tokens: 1600, temperature: 0.8,
      system: system + jsonHint,
      messages: [{ role: 'user', content: userMsg }],
    });
    return res.content[0]?.type === 'text' ? res.content[0].text : '';
  }

  if (isQwen) {
    const res = await fetch('https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKeys.qwen}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model, max_tokens: 1600, temperature: 0.8,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system + jsonHint },
          { role: 'user',   content: userMsg },
        ],
      }),
    });
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? '';
  }

  // Gemini
  const ai = new GoogleGenAI({ apiKey: apiKeys.gemini });
  const response = await ai.models.generateContent({
    model,
    contents: [{ role: 'user', parts: [{ text: userMsg }] }],
    config: {
      systemInstruction: system + jsonHint,
      maxOutputTokens: 1600,
      temperature: 0.8,
      responseMimeType: 'application/json',
    },
  });
  return response.text ?? '';
}

function safeJson<T>(raw: string, fallback: T): T {
  const cleaned = raw.replace(/```json?\s*/gi, '').replace(/```\s*/g, '').trim();
  const match   = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return fallback;
  try { return JSON.parse(match[0]) as T; } catch { return fallback; }
}

async function generateSuggestions(
  model: string,
  apiKeys: Record<string, string>,
  keyword: string,
  platform: string,
  relatedKeywords: RelatedKeyword[],
  searchVolume: number,
  contentSaturation: number,
  hasLiveData: boolean,
): Promise<{ titles: TitleSuggestion[]; suggestedKeywords: string[] }> {
  const year = new Date().getFullYear();
  const satRate = searchVolume > 0 ? Math.round((contentSaturation / searchVolume) * 100) : 0;

  const platformHint = platform === 'google'
    ? '구글 SEO: 제목 앞 핵심 키워드 배치, 명확한 혜택/숫자, 50~70자'
    : '네이버 SEO: 질문형·정보성·생활밀착형, 핵심 키워드 자연 포함, 30~50자';

  const systemPrompt = `당신은 한국 블로그 SEO 전문가입니다.
${platformHint}

⚠ 현재 연도: ${year}년. 제목에 연도를 쓸 때 반드시 ${year}년으로 표기하세요.

기회 점수 (opportunityScore) — 초보 블로거 기준:
- 황금 구간: 월 검색량 2,000~5,000 + 낮은 경쟁도 → 최고점 (80~100)
- 검색량 20,000 초과: 네이버·조선일보급 대형 사이트가 독점 → 감점
- 검색량 500 미만: 트래픽이 거의 없어 효과 없음 → 감점
- 포화율(신규발행/검색량): ${satRate}% ${satRate < 30 ? '← 기회 많음' : satRate < 70 ? '← 보통' : '← 포화 주의'}
- 제목은 황금 구간(2K~5K) 키워드 중심으로 설계하세요

훅 유형:
- 질문형: "~를 알고 계신가요?", "왜 ~일까요?"
- 숫자형: "N가지 ~", "N분 만에 ~"
- 충격형: "~의 충격적 진실", "아무도 말 안 하는 ~"
- 약속형: "~하는 방법 완전 정복", "N분이면 ~"
- 비교형: "~ vs ~", "~ 차이점 총정리"`;

  const relKwSummary = relatedKeywords.slice(0, 10)
    .map(k => `${k.keyword}(월${k.monthlyTotal.toLocaleString()}, ${k.compIdx})`)
    .join(', ');

  const needKeywords = !hasLiveData || relatedKeywords.length === 0;

  const userPrompt = `메인 키워드: "${keyword}"
월간 검색량: ${searchVolume > 0 ? searchVolume.toLocaleString() + '회' : '(데이터 없음)'}
월간 신규 발행: ${contentSaturation > 0 ? contentSaturation.toLocaleString() + '건' : '(데이터 없음)'}
포화율: ${satRate > 0 ? satRate + '%' : '(데이터 없음)'}
${relKwSummary ? `연관 키워드: ${relKwSummary}` : ''}
데이터 출처: ${hasLiveData ? '네이버 실시간' : 'AI 추정'}
플랫폼: ${platform === 'google' ? '구글' : '네이버'}

위 데이터를 활용해 아래를 생성하세요:

{
  ${needKeywords ? '"relatedKeywords": ["연관키1", "연관키2", "연관키3", "연관키4", "연관키5", "연관키6", "연관키7", "연관키8", "연관키9", "연관키10"],\n  ' : ''}"titles": [
    { "title": "제목", "hookType": "질문형", "seoScore": 88, "opportunityScore": 75, "reason": "이유 25자 이내" },
    { "title": "제목", "hookType": "숫자형", "seoScore": 85, "opportunityScore": 80, "reason": "이유" },
    { "title": "제목", "hookType": "충격형", "seoScore": 82, "opportunityScore": 70, "reason": "이유" },
    { "title": "제목", "hookType": "약속형", "seoScore": 90, "opportunityScore": 85, "reason": "이유" },
    { "title": "제목", "hookType": "비교형", "seoScore": 79, "opportunityScore": 72, "reason": "이유" },
    { "title": "제목", "hookType": "숫자형", "seoScore": 83, "opportunityScore": 78, "reason": "이유" },
    { "title": "제목", "hookType": "질문형", "seoScore": 86, "opportunityScore": 82, "reason": "이유" }
  ]
}

${needKeywords ? '연관 키워드 규칙: # 없이 순수 키워드만. 메인 키워드 관련 검색어 10개.\n' : ''}제목 규칙: 7개 모두 훅 유형 다르게, 검색 의도 직접 반영, opportunityScore는 높은 검색 + 낮은 경쟁 기준.`;

  const raw = await callLLM(model, apiKeys, systemPrompt, userPrompt);
  const parsed = safeJson<{ titles?: TitleSuggestion[]; relatedKeywords?: string[] }>(raw, {});

  return {
    titles:            (parsed.titles          ?? []).slice(0, 7).filter(t => t.title?.trim()),
    suggestedKeywords: (parsed.relatedKeywords ?? []).slice(0, 10).filter(t => typeof t === 'string' && t.trim()),
  };
}

// ── POST Handler ───────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });

    const body = await req.json();
    const keyword: string    = (body.keyword ?? '').trim();
    const platform: string   = body.platform === 'google' ? 'google' : 'naver';
    const llmModelId: string = body.llmModelId ?? '';

    if (!keyword) return NextResponse.json({ error: 'keyword 필수' }, { status: 400 });

    // 사용자 API 키
    const meta    = user.user_metadata ?? {};
    const apiKeys = {
      gemini:    meta.gemini_api_key    ?? '',
      anthropic: meta.anthropic_api_key ?? '',
      qwen:      meta.qwen_api_key      ?? '',
    };

    // Naver 키 (env 우선, 없으면 사용자 메타)
    const naverAdsCustomerId    = (process.env.NAVER_ADS_CUSTOMER_ID    ?? meta.naver_ads_customer_id    ?? '').trim();
    const naverAdsAccessLicense = (process.env.NAVER_ADS_ACCESS_LICENSE ?? meta.naver_ads_access_license ?? '').trim();
    const naverAdsSecretKey     = (process.env.NAVER_ADS_SECRET_KEY     ?? meta.naver_ads_secret_key     ?? '').trim();
    const naverClientId         = (process.env.NAVER_CLIENT_ID          ?? meta.naver_client_id          ?? '').trim();
    const naverClientSecret     = (process.env.NAVER_CLIENT_SECRET      ?? meta.naver_client_secret      ?? '').trim();

    const hasNaverAds     = !!(naverAdsCustomerId && naverAdsAccessLicense && naverAdsSecretKey);
    const hasNaverContent = !!(naverClientId && naverClientSecret);

    // LLM 모델 결정
    let model = llmModelId;
    if (!model) {
      if (apiKeys.gemini)         model = 'gemini-2.5-flash';
      else if (apiKeys.anthropic) model = 'claude-haiku-4-5-20251001';
      else if (apiKeys.qwen)      model = 'qwen3.5-flash';
      else return NextResponse.json({ error: 'API 키가 없습니다' }, { status: 400 });
    }

    let relatedKeywords: RelatedKeyword[] = [];
    let searchVolume    = 0;
    let contentSaturation = 0;
    let hasLiveData     = false;

    // ── 1단계: Naver Ads 연관 키워드 (병렬 불필요, 단일 호출) ──────────────────
    if (hasNaverAds) {
      try {
        const raw = await fetchNaverVolume(keyword, naverAdsCustomerId, naverAdsAccessLicense, naverAdsSecretKey);
        if (raw.length > 0) {
          // 메인 키워드 검색량 추출
          const main = raw.find(r => r.keyword === keyword);
          searchVolume = main?.monthlyTotal ?? raw[0]?.monthlyTotal ?? 0;
          // 상위 7개 연관 키워드 (메인 키워드 제외, 기회점수 순)
          relatedKeywords = raw
            .filter(r => r.keyword !== keyword)
            .slice(0, 10);
          hasLiveData = true;
        }
      } catch (e) {
        console.error('[keyword-suggest] Naver Ads 오류:', e);
      }
    }

    // ── 2단계: Naver Content 발행량 (메인 키워드만) ──────────────────────────
    if (hasNaverContent && searchVolume > 0) {
      try {
        contentSaturation = await fetchNaverContent(keyword, naverClientId, naverClientSecret);
      } catch (e) {
        console.error('[keyword-suggest] Naver Content 오류:', e);
      }
    }

    // ── 3단계: LLM — 제목 생성 (+ Naver 없을 때 연관 키워드 생성) ──────────────
    const { titles, suggestedKeywords } = await generateSuggestions(
      model, apiKeys, keyword, platform,
      relatedKeywords, searchVolume, contentSaturation, hasLiveData,
    );

    // Naver API 없으면 LLM 생성 키워드로 대체
    if (!hasLiveData || relatedKeywords.length === 0) {
      relatedKeywords = suggestedKeywords.map(t => ({
        keyword: t, monthlyTotal: 0, monthlyPc: 0, monthlyMobile: 0,
        compIdx: '낮음' as const, opportunity: 0,
      }));
    }

    const satRate = searchVolume > 0
      ? Math.round((contentSaturation / searchVolume) * 100)
      : 0;

    return NextResponse.json({
      keyword,
      relatedKeywords: relatedKeywords.slice(0, 10),
      titles,
      hasLiveData,
      searchVolume,
      contentSaturation,
      saturationRate: satRate,
      model,
    } satisfies KeywordSuggestResult);

  } catch (err: unknown) {
    console.error('[blog/keyword-suggest]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '키워드 분석 실패' },
      { status: 500 },
    );
  }
}
