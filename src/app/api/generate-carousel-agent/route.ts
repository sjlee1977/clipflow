/**
 * POST /api/generate-carousel-agent
 *
 * CrewAI 패턴 — 4개 에이전트 순차 실행으로 캐러셀 생성
 *
 * Agent 1 리서처  (temp 0.3) — 입력 분석 → 핵심 메시지·훅·감정 포인트 추출
 * Agent 2 스토리보더 (temp 0.5) — 카드 구성·흐름·타입 설계
 * Agent 3 카피라이터 (temp 0.8) — 카드별 텍스트 작성
 * Agent 4 에디터   (temp 0.4) — AI 패턴 제거·플랫폼 최적화·일관성 검토
 *
 * 입력 방식: topic | script | keywords
 * 플랫폼: instagram | linkedin | common
 * 톤: informative | emotional | humor
 */
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase-server';
import { CAROUSEL_STYLES, getStyle, getStyleList } from '@/lib/carousel-styles';

// ── 타입 ──────────────────────────────────────────────────────────────────────
export type InputType = 'topic' | 'script' | 'keywords';
export type Platform  = 'instagram' | 'linkedin' | 'common';
export type Tone      = 'informative' | 'emotional' | 'humor';
export type CardType  = 'title' | 'keypoint' | 'highlight' | 'quote' | 'data' | 'cta';

export interface CarouselCard {
  index:    number;
  cardType: CardType;
  title:    string;
  subtitle?: string;
  bullets?:  string[];
  stat?:     string;      // highlight 카드용 — "73%" 같은 큰 수치
  statDesc?: string;      // stat 설명
  quote?:    string;      // quote 카드용
  quoteBy?:  string;      // 인용 출처
  emoji?:    string;
  // 스타일 (applyStyle에서 주입)
  bgColor:          string;
  bgGradient?:      string;
  accentColor?:     string;
  accentSecondary?: string;
  textPrimary?:     string;
  textSecondary?:   string;
  textMuted?:       string;
  fontFamily?:      string; // CSS font-family 값
  titleFontWeight?: number;
  letterSpacing?:   string;
  styleId?:         string;
  layout?:          string;
}

interface ResearchResult {
  coreMessage:    string;
  targetAudience: string;
  hookDirection:  string;
  keyPoints:      string[];
  emotionalArc:   string;
  suggestedTone:  string;
}

interface StoryboardCard {
  index:   number;
  cardType: CardType;
  role:    string;   // 이 카드가 담당하는 서사 역할
}

interface Storyboard {
  totalCards: number;
  flow:       string;
  cards:      StoryboardCard[];
}

export interface AgentStep {
  agent:   string;
  status:  'running' | 'done' | 'error';
  summary: string;
}

export interface CarouselAgentResult {
  cards:    CarouselCard[];
  topic:    string;
  platform: Platform;
  steps:    AgentStep[];
  styleId:  string;
  styleNameKo: string;
}

// (배경색 팔레트 제거 — carousel-styles.ts의 StyleDef로 대체)

// ── 플랫폼 가이드 ──────────────────────────────────────────────────────────────
const PLATFORM_GUIDE: Record<Platform, string> = {
  instagram: `플랫폼: 인스타그램
- 제목: 15자 이내 임팩트 있게
- 불릿: 2~3개, 각 15자 이내
- 이모지 적극 활용 (각 카드 1~2개)
- 감성적·시각적 언어 선호
- CTA: 팔로우·저장·공유 유도`,
  linkedin: `플랫폼: 링크드인
- 제목: 20자 이내 전문적으로
- 불릿: 3개, 각 25자 이내
- 이모지 절제 (카드당 1개 이하)
- 데이터·인사이트·전문성 강조
- CTA: 연결·댓글·공유 유도`,
  common: `플랫폼: 공통 (인스타/링크드인 겸용)
- 제목: 20자 이내
- 불릿: 2~3개, 각 20자 이내
- 이모지: 카드당 1개
- 정보성과 감성의 균형`,
};

const TONE_GUIDE: Record<Tone, string> = {
  informative: '정보 전달 중심 — 데이터·수치·실용 팁 강조, 신뢰감 있는 문체',
  emotional:   '감성 스토리 중심 — 공감·경험·감정 표현 풍부하게, 독자와 교감',
  humor:       '유머·위트 중심 — 가볍고 재치 있는 표현, 친근한 구어체, 반전 포인트',
};

// ── LLM 공통 호출 ─────────────────────────────────────────────────────────────
async function llm(
  model: string,
  apiKeys: Record<string, string>,
  system: string,
  messages: { role: 'user' | 'assistant'; content: string }[],
  maxTokens = 2000,
  temp = 0.7,
  json = false,
): Promise<string> {
  const isClaude = model.startsWith('claude');
  const isQwen   = model.startsWith('qwen') || model.startsWith('deepseek');
  const sys = json && !model.startsWith('gemini')
    ? `${system}\n\n반드시 유효한 JSON만 출력. 마크다운 코드블록 없이.`
    : system;

  if (isClaude) {
    const client = new Anthropic({ apiKey: apiKeys.anthropic });
    const res = await client.messages.create({
      model, max_tokens: maxTokens, temperature: temp, system: sys, messages,
    });
    return res.content[0]?.type === 'text' ? res.content[0].text : '';
  }
  if (isQwen) {
    const body: Record<string, unknown> = {
      model, max_tokens: maxTokens, temperature: temp,
      messages: [{ role: 'system', content: sys }, ...messages],
    };
    if (json) body.response_format = { type: 'json_object' };
    const res = await fetch('https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKeys.qwen}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`Qwen 오류: ${data?.error?.message ?? res.status}`);
    return data.choices?.[0]?.message?.content ?? '';
  }
  const ai = new GoogleGenAI({ apiKey: apiKeys.gemini });
  const config: Record<string, unknown> = {
    systemInstruction: sys, maxOutputTokens: maxTokens, temperature: temp,
  };
  if (json) config.responseMimeType = 'application/json';
  const response = await ai.models.generateContent({
    model,
    contents: messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
    config,
  });
  return response.text ?? '';
}

function safeJson<T>(raw: string, fallback: T): T {
  const cleaned = raw.replace(/```json?\s*/gi, '').replace(/```\s*/g, '').trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return fallback;
  try { return JSON.parse(match[0]) as T; } catch { return fallback; }
}

// ── Agent 1: 리서처 ───────────────────────────────────────────────────────────
async function runResearcher(
  model: string,
  apiKeys: Record<string, string>,
  inputType: InputType,
  content: string,
  tone: Tone,
): Promise<ResearchResult> {
  const sys = `당신은 SNS 콘텐츠 전략가입니다. 주어진 입력을 분석해 캐러셀 콘텐츠의 핵심을 추출합니다.
모든 결정에는 독자 심리와 SNS 바이럴 원리를 적용합니다.
목표 톤: ${TONE_GUIDE[tone]}`;

  const inputLabel: Record<InputType, string> = {
    topic:    '주제어',
    script:   '영상 대본',
    keywords: '키워드 목록',
  };

  const user = `[입력 유형: ${inputLabel[inputType]}]
${content}

위 입력을 분석해 아래 JSON으로 응답하세요:
{
  "coreMessage": "캐러셀 전체를 관통하는 핵심 메시지 1문장",
  "targetAudience": "타겟 독자 (나이대·관심사·고민 포함, 2~3문장)",
  "hookDirection": "첫 카드에서 독자를 붙잡을 훅 방향 (질문형/충격형/공감형/수치형 중 선택 + 이유)",
  "keyPoints": ["핵심 포인트 1", "핵심 포인트 2", "핵심 포인트 3", "핵심 포인트 4", "핵심 포인트 5"],
  "emotionalArc": "독자가 카드를 넘기며 느껴야 할 감정 흐름 (호기심→공감→놀람→안도→행동)",
  "suggestedTone": "최적 톤 제안 + 이유"
}`;

  const raw = await llm(model, apiKeys, sys, [{ role: 'user', content: user }], 1000, 0.3, true);
  return safeJson<ResearchResult>(raw, {
    coreMessage: content.slice(0, 50),
    targetAudience: '일반 SNS 사용자',
    hookDirection: '질문형',
    keyPoints: ['포인트 1', '포인트 2', '포인트 3'],
    emotionalArc: '호기심→공감→놀람→안도→행동',
    suggestedTone: tone,
  });
}

// ── Agent 2: 스토리보더 ────────────────────────────────────────────────────────
async function runStoryboarder(
  model: string,
  apiKeys: Record<string, string>,
  research: ResearchResult,
  platform: Platform,
  cardCount: number,
): Promise<Storyboard> {
  const sys = `당신은 SNS 캐러셀 스토리보더입니다. 리서처의 분석을 받아 카드 구성과 흐름을 설계합니다.
각 카드는 독립적으로도 의미 있어야 하고, 전체로 봤을 때 하나의 스토리가 되어야 합니다.
${PLATFORM_GUIDE[platform]}

사용 가능한 카드 타입:
- title: 제목 카드 (1번 카드 전용, 강렬한 훅)
- keypoint: 핵심 포인트 (불릿 2~3개)
- highlight: 수치/통계 강조 (큰 숫자 1개 + 설명)
- quote: 인용문 (명언·전문가·실사용자 후기)
- data: 데이터 포인트 (비교·대조·변화)
- cta: 행동 유도 (마지막 카드 전용)`;

  const user = `리서치 결과:
- 핵심 메시지: ${research.coreMessage}
- 타겟 독자: ${research.targetAudience}
- 훅 방향: ${research.hookDirection}
- 핵심 포인트: ${research.keyPoints.join(' / ')}
- 감정 흐름: ${research.emotionalArc}

총 카드 수: ${cardCount}장

아래 JSON으로 스토리보드를 설계하세요:
{
  "totalCards": ${cardCount},
  "flow": "전체 스토리 흐름 설명 (1~2문장)",
  "cards": [
    { "index": 0, "cardType": "title", "role": "이 카드의 서사 역할" },
    ...
    { "index": ${cardCount - 1}, "cardType": "cta", "role": "이 카드의 서사 역할" }
  ]
}

규칙:
- 0번은 반드시 title
- 마지막은 반드시 cta
- highlight·quote·data 카드를 최소 1장씩 포함할 것
- keypoint가 연속 3장 이상 이어지지 않게 할 것`;

  const raw = await llm(model, apiKeys, sys, [{ role: 'user', content: user }], 1200, 0.5, true);
  const fallbackCards: StoryboardCard[] = Array.from({ length: cardCount }, (_, i) => ({
    index: i,
    cardType: i === 0 ? 'title' : i === cardCount - 1 ? 'cta' : 'keypoint',
    role: i === 0 ? '훅' : i === cardCount - 1 ? 'CTA' : `포인트 ${i}`,
  }));
  return safeJson<Storyboard>(raw, {
    totalCards: cardCount, flow: '정보 전달', cards: fallbackCards,
  });
}

// ── Agent 3: 카피라이터 ────────────────────────────────────────────────────────
async function runCopywriter(
  model: string,
  apiKeys: Record<string, string>,
  research: ResearchResult,
  storyboard: Storyboard,
  platform: Platform,
  tone: Tone,
): Promise<CarouselCard[]> {
  const sys = `당신은 SNS 캐러셀 카피라이터입니다. 스토리보드와 리서치 결과를 받아 각 카드의 텍스트를 작성합니다.
${PLATFORM_GUIDE[platform]}
톤: ${TONE_GUIDE[tone]}

카드 타입별 작성 규칙:
- title: title(강렬한 제목) + subtitle(부제목 1줄) + emoji
- keypoint: title(핵심 문장) + bullets(2~3개) + emoji
- highlight: title(맥락 문장) + stat(핵심 수치, 예: "73%") + statDesc(수치 설명 1줄) + emoji
- quote: title(인용 배경 1줄) + quote(인용 내용) + quoteBy(출처) + emoji
- data: title(데이터 요약) + bullets(비교·대조 항목 2~3개) + emoji
- cta: title(행동 촉구 문장) + subtitle(혜택·이유 1줄) + emoji

절대 금지:
- "살펴보겠습니다", "알아보겠습니다" 등 AI 투명 표현
- 억지스러운 이모지 남용 (카드당 1~2개 이내)
- 카드 간 같은 이모지 반복 사용`;

  const storyboardText = storyboard.cards
    .map(c => `카드 ${c.index + 1} (${c.cardType}): ${c.role}`)
    .join('\n');

  const user = `리서치:
- 핵심 메시지: ${research.coreMessage}
- 핵심 포인트: ${research.keyPoints.join(', ')}
- 감정 흐름: ${research.emotionalArc}

스토리보드:
${storyboardText}

위 스토리보드 순서대로 모든 카드의 텍스트를 작성하세요.

아래 JSON으로 응답하세요:
{
  "cards": [
    {
      "index": 0,
      "cardType": "title",
      "title": "...",
      "subtitle": "...",
      "emoji": "🎯"
    },
    {
      "index": 1,
      "cardType": "keypoint",
      "title": "...",
      "bullets": ["...", "...", "..."],
      "emoji": "💡"
    },
    {
      "index": 2,
      "cardType": "highlight",
      "title": "...",
      "stat": "73%",
      "statDesc": "...",
      "emoji": "📊"
    }
  ]
}

모든 ${storyboard.totalCards}장의 카드를 빠짐없이 작성할 것.`;

  const raw = await llm(model, apiKeys, sys, [{ role: 'user', content: user }], 3000, 0.8, true);
  const parsed = safeJson<{ cards: CarouselCard[] }>(raw, { cards: [] });
  return parsed.cards;
}

// ── Agent 4: 에디터 ───────────────────────────────────────────────────────────
async function runEditor(
  model: string,
  apiKeys: Record<string, string>,
  cards: CarouselCard[],
  platform: Platform,
  research: ResearchResult,
): Promise<CarouselCard[]> {
  const sys = `당신은 SNS 캐러셀 에디터입니다. 카피라이터가 작성한 카드를 검토하고 개선합니다.
${PLATFORM_GUIDE[platform]}

점검 항목:
1. AI 투명 표현 제거 ("살펴보겠습니다" 등)
2. 플랫폼 글자 수 기준 준수
3. 카드 간 톤·문체 일관성
4. 이모지 중복 없이 다양하게
5. 훅(1번 카드)이 충분히 강렬한지
6. CTA(마지막 카드)가 명확한 행동을 유도하는지
7. highlight 카드의 stat 수치가 임팩트 있는지
8. 전체 감정 흐름이 자연스럽게 이어지는지`;

  const cardsJson = JSON.stringify({ cards }, null, 2);
  const user = `핵심 메시지: ${research.coreMessage}

아래 카드들을 검토하고 개선해 동일한 JSON 구조로 반환하세요.
변경이 없는 카드도 반드시 포함해야 합니다.

${cardsJson}

개선된 카드 JSON:
{ "cards": [...] }`;

  const raw = await llm(model, apiKeys, sys, [{ role: 'user', content: user }], 3000, 0.4, true);
  const parsed = safeJson<{ cards: CarouselCard[] }>(raw, { cards: [] });
  return parsed.cards.length > 0 ? parsed.cards : cards;
}

// ── Agent: Stylist — 콘텐츠 분위기에 맞는 스타일 선택 ─────────────────────────
async function runStylist(
  model: string,
  apiKeys: Record<string, string>,
  research: ResearchResult,
  tone: Tone,
  platform: Platform,
): Promise<string> {
  const sys = `당신은 SNS 카드뉴스 디자인 디렉터입니다.
콘텐츠 분석 결과를 보고 가장 어울리는 스타일을 하나 선택합니다.
반드시 제공된 스타일 목록에 있는 id만 반환합니다.`;

  const user = `콘텐츠 분석:
- 핵심 메시지: ${research.coreMessage}
- 타겟 독자: ${research.targetAudience}
- 감정 흐름: ${research.emotionalArc}
- 제안 톤: ${research.suggestedTone}
- 톤 설정: ${tone}
- 플랫폼: ${platform}

사용 가능한 스타일 12가지:
${getStyleList()}

위 콘텐츠에 가장 어울리는 스타일 id 하나만 JSON으로 반환하세요.
선택 이유도 한 줄로 포함하세요.
{"styleId": "스타일-id", "reason": "선택 이유"}`;

  const raw = await llm(model, apiKeys, sys, [{ role: 'user', content: user }], 150, 0.3, true);
  const parsed = safeJson<{ styleId: string }>(raw, { styleId: 'midnight-navy' });
  const valid = CAROUSEL_STYLES.find(s => s.id === parsed.styleId);
  return valid ? parsed.styleId : 'midnight-navy';
}

// ── 스타일 적용 ────────────────────────────────────────────────────────────────
function applyStyle(cards: CarouselCard[], styleId: string): CarouselCard[] {
  const style = getStyle(styleId);
  const fontFamily = style.font.family === 'mono'
    ? "'Courier New', 'JetBrains Mono', monospace"
    : "'Noto Sans KR', sans-serif";

  return cards.map((card, i) => {
    // 카드 타입별 배경색 결정
    const isAlt  = card.cardType === 'title' || card.cardType === 'highlight' || card.cardType === 'quote';
    const isCta  = card.cardType === 'cta';
    const bgColor = isCta ? (style.bgCta ?? style.bg)
                  : isAlt ? (style.bgAlt ?? style.bg)
                  : style.bg;

    return {
      ...card,
      index:           i,
      bgColor,
      bgGradient:      style.bgGradient,
      accentColor:     style.accent,
      accentSecondary: style.accentSecondary,
      textPrimary:     style.textPrimary,
      textSecondary:   style.textSecondary,
      textMuted:       style.textMuted,
      fontFamily,
      titleFontWeight: style.font.titleWeight,
      letterSpacing:   style.font.letterSpacing ?? 'normal',
      styleId,
      layout: style.layout,
    };
  });
}

// ── 주제어 추출 ───────────────────────────────────────────────────────────────
function extractTopic(inputType: InputType, content: string, cards: CarouselCard[]): string {
  if (inputType === 'topic') return content.slice(0, 20);
  if (inputType === 'keywords') return content.split(/[\s,]+/)[0]?.slice(0, 20) ?? '카드뉴스';
  return cards[0]?.title?.slice(0, 20) ?? '카드뉴스';
}

// ── API 핸들러 ────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const {
      inputType = 'topic',
      content,
      platform = 'common',
      tone = 'informative',
      cardCount = 8,
      llmModelId,
    } = await req.json() as {
      inputType: InputType;
      content: string;
      platform: Platform;
      tone: Tone;
      cardCount: number;
      llmModelId: string;
    };

    if (!content?.trim()) {
      return NextResponse.json({ error: '내용을 입력해주세요' }, { status: 400 });
    }

    // ── API 키 로드 ────────────────────────────────────────────────────────────
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });

    const meta = user.user_metadata ?? {};
    const apiKeys: Record<string, string> = {
      gemini:    meta.gemini_api_key    ?? '',
      anthropic: meta.anthropic_api_key ?? '',
      qwen:      meta.qwen_api_key      ?? '',
    };

    const model = llmModelId ?? 'qwen-plus';
    const isClaude = model.startsWith('claude');
    const isQwen   = model.startsWith('qwen') || model.startsWith('deepseek');
    const isGemini = !isClaude && !isQwen;

    if (isClaude && !apiKeys.anthropic) return NextResponse.json({ error: 'Anthropic API 키가 필요합니다', needsKey: true }, { status: 400 });
    if (isQwen   && !apiKeys.qwen)      return NextResponse.json({ error: 'DashScope API 키가 필요합니다', needsKey: true }, { status: 400 });
    if (isGemini && !apiKeys.gemini)    return NextResponse.json({ error: 'Gemini API 키가 필요합니다', needsKey: true }, { status: 400 });

    const clampedCount = Math.min(Math.max(Number(cardCount), 6), 12);
    const steps: AgentStep[] = [];

    // ── Agent 1: 리서처 ────────────────────────────────────────────────────────
    steps.push({ agent: '리서처', status: 'running', summary: '입력 분석 중...' });
    const research = await runResearcher(model, apiKeys, inputType, content, tone);
    steps[steps.length - 1] = { agent: '리서처', status: 'done', summary: `핵심 메시지: ${research.coreMessage}` };

    // ── Agent 2: 스토리보더 ────────────────────────────────────────────────────
    steps.push({ agent: '스토리보더', status: 'running', summary: '카드 구성 설계 중...' });
    const storyboard = await runStoryboarder(model, apiKeys, research, platform, clampedCount);
    steps[steps.length - 1] = { agent: '스토리보더', status: 'done', summary: `${storyboard.totalCards}장 구성 — ${storyboard.flow}` };

    // ── Agent 3: 카피라이터 ────────────────────────────────────────────────────
    steps.push({ agent: '카피라이터', status: 'running', summary: '카드 텍스트 작성 중...' });
    const rawCards = await runCopywriter(model, apiKeys, research, storyboard, platform, tone);
    steps[steps.length - 1] = { agent: '카피라이터', status: 'done', summary: `${rawCards.length}장 텍스트 완성` };

    // ── Agent 4: 에디터 ────────────────────────────────────────────────────────
    steps.push({ agent: '에디터', status: 'running', summary: '일관성 검토 및 최적화 중...' });
    const editedCards = await runEditor(model, apiKeys, rawCards, platform, research);
    steps[steps.length - 1] = { agent: '에디터', status: 'done', summary: '편집 완료' };

    // ── Agent 5: 스타일리스트 ──────────────────────────────────────────────────
    steps.push({ agent: '스타일리스트', status: 'running', summary: '콘텐츠 분위기에 맞는 디자인 선택 중...' });
    const styleId = await runStylist(model, apiKeys, research, tone, platform);
    const selectedStyle = getStyle(styleId);
    steps[steps.length - 1] = {
      agent: '스타일리스트',
      status: 'done',
      summary: `${selectedStyle.nameKo} (${selectedStyle.name}) 스타일 적용`,
    };

    // ── 후처리 ────────────────────────────────────────────────────────────────
    const baseCards  = editedCards.length > 0 ? editedCards : rawCards;
    const finalCards = applyStyle(baseCards, styleId);
    const topic = extractTopic(inputType, content, finalCards);

    const result: CarouselAgentResult = {
      cards: finalCards,
      topic,
      platform,
      steps,
      styleId,
      styleNameKo: selectedStyle.nameKo,
    };

    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
