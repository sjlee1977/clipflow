/**
 * POST /api/blog/write-multi-platform
 *
 * 하나의 주제로 3개 플랫폼(네이버/워드프레스/개인) 버전을 동시 생성.
 * - 리서처·팩트체커는 1회만 실행 (비용 절감)
 * - 작가·편집자는 플랫폼별 3회 실행 (포맷·문체 차별화)
 * - 워드프레스 버전 기준으로 품질 평가 → 80점 미달 시 3개 모두 리파인
 * - generateImages=true면 [IMAGE: 설명] 마커를 FLUX 이미지로 교체
 */
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase-server';
import { generateFalImage } from '@/lib/fal-image';
import fs from 'fs';
import path from 'path';

// ── 타입 ──────────────────────────────────────────────────────────────────────
export type Platform = 'naver' | 'wordpress' | 'personal';

interface Outline {
  painPoint: string; uniqueAngle: string; hookType: string;
  emotionalArc: string;
  structure: { act1: string; act2: string; act3: string; act4: string; act5: string };
  keyPoints: string[];
}

interface DimensionResult {
  name: string; nameKo: string; score: number; reason: string; suggestion: string;
}

interface EvalResult {
  dimensions: DimensionResult[]; totalScore: number;
  grade: 'S' | 'A' | 'B' | 'C' | 'D'; suggestions: string[]; passed: boolean;
}

interface FactCheckResult {
  claims: { text: string; type: string; risk: string; reason: string; suggestion: string }[];
  riskLevel: string; summary: string;
}

export interface PlatformVersion {
  title: string; content: string;
  images: { marker: string; url: string; alt: string }[];
}

export interface MultiPlatformResult {
  naver:     PlatformVersion;
  wordpress: PlatformVersion;
  personal:  PlatformVersion;
  outline:   Outline;
  factCheck: FactCheckResult;
  evaluation: EvalResult;
  refinementRounds: number;
  steps: { agent: string; status: 'done' | 'error'; summary: string }[];
  postId?: string;
}

// ── 위키 로더 ─────────────────────────────────────────────────────────────────
const WIKI = path.join(process.cwd(), 'wiki');
function wiki(p: string) { try { return fs.readFileSync(path.join(WIKI, p), 'utf-8'); } catch { return ''; } }

function latestFeedback() {
  try {
    const dir = path.join(WIKI, 'feedback');
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.md')).sort().reverse();
    return files.length ? fs.readFileSync(path.join(dir, files[0]), 'utf-8') : '';
  } catch { return ''; }
}

// ── 플랫폼별 작성 가이드 ──────────────────────────────────────────────────────
const PLATFORM_GUIDE: Record<Platform, { lengthDesc: string; maxTokens: number; guide: string }> = {
  naver: {
    lengthDesc: '800~1200자 (모바일 최적화)',
    maxTokens: 3000,
    guide: `## 네이버 블로그 특화 원칙
- 목표 길이: 800~1200자 — 모바일에서 스크롤 3회 이내로 읽히는 길이
- 문체: 친근한 구어체 ("~해요", "~거든요", "~더라고요")
- 문단: 최대 3줄 (모바일 가독성)
- 소제목: ## 2~3개만 (네이버 VIEW 탭 최적화)
- SEO: 키워드를 첫 문단 50자 이내 자연스럽게 배치
- 이미지: 글 전체에 2~3곳에 [IMAGE: 한국어 장면 설명] 삽입 (필수)
- 구성: 훅 → 핵심 내용 → 실용 팁 1~2개 → 짧은 마무리`,
  },
  wordpress: {
    lengthDesc: '1500~2500자 (구글 SEO 최적)',
    maxTokens: 7000,
    guide: `## 워드프레스 SEO 특화 원칙
- 목표 길이: 1500~2500자 (구글 검색 상위 랭킹 기준)
- 문체: 전문적이고 신뢰감 있는 표현
- 구조: H2로 주요 섹션 3~4개, H3으로 세부 내용
- SEO: 키워드 밀도 1~2%, 첫 문단 150자가 메타 설명 역할
- 이미지: 각 H2 섹션 후 1개씩 [IMAGE: 한국어 장면 설명] 삽입
- 링크: "관련 글:", "참고:" 형식의 내부 링크 구조 언급
- 마무리: 명확한 결론 + 독자 행동 유도 (댓글/공유/구독)`,
  },
  personal: {
    lengthDesc: '1000~1500자 (개인 브랜딩 최적)',
    maxTokens: 4500,
    guide: `## 개인 웹사이트 브랜딩 특화 원칙
- 목표 길이: 1000~1500자 (집중된 인사이트)
- 문체: 1인칭 개인 관점 ("저는", "제 경험으로는", "솔직히 말하면")
- 핵심: 네이버/워드프레스와 다른 독창적 각도나 결론 제시
- 이미지: 1~2곳에만 [IMAGE: 한국어 장면 설명] 삽입
- 차별화: 데이터보다 개인 경험·인사이트·가치관 중심
- 마무리: 독자와 대화 유도 ("여러분은 어떻게 생각하시나요?")`,
  },
};

// ── LLM 공통 호출 ─────────────────────────────────────────────────────────────
async function llm(
  model: string, apiKeys: Record<string, string>,
  system: string, messages: { role: 'user' | 'assistant'; content: string }[],
  maxTokens = 3500, temp = 0.7, json = false,
): Promise<string> {
  const isClaude = model.startsWith('claude');
  const isQwen   = model.startsWith('qwen');
  const isOpenAI = model.startsWith('gpt');
  const sys = json && !model.startsWith('gemini')
    ? `${system}\n\n반드시 유효한 JSON만 출력. 마크다운 코드블록 없이.`
    : system;

  if (isClaude) {
    const client = new Anthropic({ apiKey: apiKeys.anthropic });
    const res = await client.messages.create({ model, max_tokens: maxTokens, temperature: temp, system: sys, messages });
    return res.content[0]?.type === 'text' ? res.content[0].text : '';
  }
  if (isOpenAI) {
    const body: Record<string, unknown> = {
      model, max_tokens: maxTokens, temperature: temp,
      messages: [{ role: 'system', content: sys }, ...messages],
    };
    if (json) body.response_format = { type: 'json_object' };
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKeys.openai}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`OpenAI 오류: ${data?.error?.message ?? res.status}`);
    return data.choices?.[0]?.message?.content ?? '';
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
  const config: Record<string, unknown> = { systemInstruction: sys, maxOutputTokens: maxTokens, temperature: temp };
  if (json) config.responseMimeType = 'application/json';
  const response = await ai.models.generateContent({
    model,
    contents: messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
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

function calcGrade(score: number): 'S' | 'A' | 'B' | 'C' | 'D' {
  if (score >= 90) return 'S';
  if (score >= 75) return 'A';
  if (score >= 60) return 'B';
  if (score >= 40) return 'C';
  return 'D';
}

function extractTitle(content: string, fallback: string): string {
  const m = content.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : fallback;
}

// ── Agent 1: 리서처 (1회 실행) ────────────────────────────────────────────────
async function runResearcher(
  model: string, apiKeys: Record<string, string>,
  title: string, keyword: string,
  ctx: { seoPlatform: string; searchVolume?: number; competition?: string; relatedKeywords?: string[] },
): Promise<Outline> {
  const structure = wiki('blog/structure.md');
  const hooks     = wiki('blog/hook-writing.md');

  const sys = `당신은 10년 경력의 콘텐츠 전략가입니다.
구조 원칙:\n${structure || '5막 구조: 훅→갈등→반전→증명→해소'}
훅 유형:\n${hooks || 'A형(도발적 질문), B형(충격 수치), C형(착각 지적)'}`;

  const contextLines = [
    ctx.searchVolume  ? `월간 검색량: ${ctx.searchVolume.toLocaleString()}회` : '',
    ctx.competition   ? `경쟁도: ${ctx.competition}` : '',
    ctx.relatedKeywords?.length ? `연관 키워드: ${ctx.relatedKeywords.slice(0, 5).join(', ')}` : '',
  ].filter(Boolean).join('\n');

  const user = `제목: "${title}"\n키워드: "${keyword}"\n${contextLines}
아래 JSON으로 5막 아웃라인을 설계하세요:
{
  "painPoint": "독자 핵심 고통 (1~2문장)",
  "uniqueAngle": "차별화 관점 (1~2문장)",
  "hookType": "A형/B형/C형 + 이유",
  "emotionalArc": "긴장→공감→놀람→안도→행동 각 포인트",
  "structure": { "act1": "1막", "act2": "2막", "act3": "3막", "act4": "4막", "act5": "5막" },
  "keyPoints": ["포인트1", "포인트2", "포인트3"]
}`;

  const raw = await llm(model, apiKeys, sys, [{ role: 'user', content: user }], 1200, 0.3, true);
  return safeJson<Outline>(raw, {
    painPoint: '', uniqueAngle: '', hookType: 'A형', emotionalArc: '',
    structure: { act1: '', act2: '', act3: '', act4: '', act5: '' }, keyPoints: [],
  });
}

// ── Agent 2: 플랫폼별 작가 ────────────────────────────────────────────────────
async function runPlatformWriter(
  model: string, apiKeys: Record<string, string>,
  title: string, outline: Outline, platform: Platform,
): Promise<string> {
  const persona   = wiki('blog/writer-persona.md');
  const cta       = wiki('blog/cta-writing.md');
  const emotional = wiki('blog/emotional-flow.md');
  const feedback  = latestFeedback();
  const cfg       = PLATFORM_GUIDE[platform];

  const sys = `당신은 10년 경력의 블로그 전문 작가입니다.
${persona  ? `### 작가 페르소나\n${persona}\n`  : ''}
${emotional ? `### 감정 흐름\n${emotional}\n`   : ''}
${cta       ? `### CTA 원칙\n${cta}\n`          : ''}
${feedback  ? `### 최근 피드백 (반드시 반영)\n${feedback}\n` : ''}

목표 분량: ${cfg.lengthDesc} ← **반드시 목표 분량을 채울 것**

${cfg.guide}

## AI 탐지 금지 표현 (절대 사용 금지)
- "살펴보겠습니다", "알아보겠습니다", "확인해보겠습니다"
- "이상으로 ~에 대해 알아보았습니다", "마치겠습니다"
- "도움이 되셨으면 합니다", "참고가 되셨으면 합니다"
- "또한", "더불어", "이에 따라" (문단 첫 단어로만)

## 반드시 구현할 인간 필기감
- 개인 경험담: "저도 처음엔...", "직접 해봤더니..."
- 구어체: "사실", "솔직히", "근데", "그거 알아요?"
- 짧은 여운: "그게 문제였어요. 진짜로요."
- 독자 질문: "혹시 이런 경험 있으세요?"

출력: 마크다운 블로그 글만 (JSON 없이)`;

  const user = `아래 아웃라인으로 "${title}" 블로그 글을 작성하세요.
---
독자 고통: ${outline.painPoint}
독창적 앵글: ${outline.uniqueAngle}
훅 유형: ${outline.hookType}

1막: ${outline.structure.act1}
2막: ${outline.structure.act2}
3막: ${outline.structure.act3}
4막: ${outline.structure.act4}
5막: ${outline.structure.act5}

핵심 포인트: ${outline.keyPoints.join(', ')}

# 제목으로 시작하는 마크다운 형식으로 작성하세요.`;

  return await llm(model, apiKeys, sys, [{ role: 'user', content: user }], cfg.maxTokens, 0.8);
}

// ── Agent 2.5: 팩트체커 (1회 실행) ───────────────────────────────────────────
async function runFactChecker(
  model: string, apiKeys: Record<string, string>, content: string,
): Promise<FactCheckResult> {
  const sys = `AI 생성 블로그 글의 할루시네이션을 탐지하는 팩트체커.
HIGH: 출처 없는 구체 통계, 가짜 연구/기관 인용, 특정 전문가 발언 조작, 복지/정책 구체 수치
MEDIUM: 불확실한 연도, 과도한 인과관계 단정
LOW: 모호한 일반 상식`;

  const user = `아래 글에서 할루시네이션을 탐지하세요.
---${content.slice(0, 4000)}---
{ "claims": [{ "text": "...", "type": "statistic|study|date|expert|policy|fact", "risk": "high|medium|low", "reason": "...", "suggestion": "..." }], "riskLevel": "high|medium|low|none", "summary": "..." }
없으면: { "claims": [], "riskLevel": "none", "summary": "할루시네이션 없음" }`;

  const raw = await llm(model, apiKeys, sys, [{ role: 'user', content: user }], 1500, 0.1, true);
  return safeJson<FactCheckResult>(raw, { claims: [], riskLevel: 'none', summary: '팩트체크 완료' });
}

// ── Agent 3: 플랫폼별 편집자 ─────────────────────────────────────────────────
async function runPlatformEditor(
  model: string, apiKeys: Record<string, string>,
  draft: string, platform: Platform, factCheck?: FactCheckResult,
): Promise<string> {
  const rubric  = wiki('blog/evaluation-rubric.md');
  const persona = wiki('blog/writer-persona.md');
  const cfg     = PLATFORM_GUIDE[platform];

  const highRisk = (factCheck?.claims ?? []).filter(c => c.risk === 'high');
  const factSection = highRisk.length
    ? `\n=== 팩트체커 HIGH 위험 (수정 필수) ===\n${highRisk.map(c => `- "${c.text.slice(0, 60)}..." → ${c.suggestion}`).join('\n')}\n`
    : '';

  const sys = `당신은 15년 경력의 디지털 미디어 편집장입니다.
채점 기준:\n${rubric || '훅/서사/장면/리듬/감정/CTA/금지표현/에코/인간감/사실'}
${cfg.guide}

## 즉시 제거할 AI 패턴
- "살펴보겠습니다", "알아보겠습니다"
- "이상으로 ~에 대해 알아보았습니다"
- "도움이 되셨으면 합니다"
${persona ? `\n금지 표현: ${persona.split('절대 사용 금지')[1]?.split('##')[0]?.slice(0, 200) ?? ''}` : ''}`;

  const user = `아래 초고를 ${platform} 플랫폼 원칙에 맞게 편집하세요.
${factSection}
---초고---
${draft}

{ "editorNotes": ["수정 항목 + 이유"], "finalContent": "수정된 전체 마크다운" }`;

  const raw    = await llm(model, apiKeys, sys, [{ role: 'user', content: user }], cfg.maxTokens + 1000, 0.2, true);
  const parsed = safeJson<{ finalContent?: string }>(raw, {});
  return parsed.finalContent ?? draft;
}

// ── Agent 4: 평가자 (워드프레스 기준 1회) ────────────────────────────────────
async function runEvaluator(
  model: string, apiKeys: Record<string, string>, content: string,
): Promise<EvalResult> {
  const rubric = wiki('blog/evaluation-rubric.md');

  const sys = `블로그 품질을 냉정하게 평가하는 편집장. 10개 차원 각 10점 만점. JSON만 출력.
${rubric || '훅/서사/장면/리듬/감정/CTA/금지표현/에코/인간감/사실'}`;

  const user = `채점하세요.\n---\n${content.slice(0, 5000)}\n---
{
  "dimensions": [
    { "name": "hook_power",          "nameKo": "훅 강도",    "score": 0, "reason": "", "suggestion": "" },
    { "name": "narrative_structure", "nameKo": "서사 구조",   "score": 0, "reason": "", "suggestion": "" },
    { "name": "show_dont_tell",      "nameKo": "장면 묘사",   "score": 0, "reason": "", "suggestion": "" },
    { "name": "sentence_rhythm",     "nameKo": "문장 리듬",   "score": 0, "reason": "", "suggestion": "" },
    { "name": "emotional_arc",       "nameKo": "감정 흐름",   "score": 0, "reason": "", "suggestion": "" },
    { "name": "cta_quality",         "nameKo": "CTA 품질",    "score": 0, "reason": "", "suggestion": "" },
    { "name": "forbidden_phrases",   "nameKo": "금지 표현",   "score": 0, "reason": "", "suggestion": "" },
    { "name": "closing_echo",        "nameKo": "클로징 에코", "score": 0, "reason": "", "suggestion": "" },
    { "name": "human_feel",          "nameKo": "인간 필기감", "score": 0, "reason": "", "suggestion": "" },
    { "name": "factual_accuracy",    "nameKo": "사실 정확성", "score": 0, "reason": "", "suggestion": "" }
  ]
}`;

  const raw    = await llm(model, apiKeys, sys, [{ role: 'user', content: user }], 3000, 0.2, true);
  const parsed = safeJson<{ dimensions?: DimensionResult[] }>(raw, { dimensions: [] });
  const dims   = (parsed.dimensions ?? []).map(d => ({
    ...d, score: Math.min(10, Math.max(0, Math.round(Number(d.score) || 0))),
  }));
  if (dims.length === 0) throw new Error('평가자 응답 파싱 실패');
  const rawScore   = dims.reduce((s, d) => s + d.score, 0);
  const totalScore = Math.round((rawScore / (dims.length * 10)) * 100);
  const grade      = calcGrade(totalScore);
  return {
    dimensions: dims, totalScore, grade,
    suggestions: dims.filter(d => d.score < 7).sort((a, b) => a.score - b.score).map(d => `[${d.nameKo}] ${d.suggestion}`),
    passed: grade === 'S' || grade === 'A',
  };
}

// ── Agent 5: 리파이너 (모든 플랫폼 동시) ─────────────────────────────────────
async function runPlatformRefiner(
  model: string, apiKeys: Record<string, string>,
  content: string, evaluation: EvalResult, platform: Platform,
): Promise<string> {
  const weakItems = evaluation.dimensions
    .filter(d => d.score < 7)
    .map(d => `• ${d.nameKo} (${d.score}/10): ${d.suggestion}`)
    .join('\n');

  if (!weakItems) return content;

  const cfg = PLATFORM_GUIDE[platform];
  const sys = `블로그 편집 작가. 아래 약점만 외과적으로 수정. 전체 재작성 금지.
${cfg.guide}`;

  const user = `=== 약점 수정 대상 ===\n${weakItems}\n\n=== 현재 글 ===\n${content}\n\n수정된 전체 마크다운 출력:`;
  const refined = await llm(model, apiKeys, sys, [{ role: 'user', content: user }], cfg.maxTokens + 1000, 0.5);
  return refined.trim() || content;
}

// ── 이미지 생성 ───────────────────────────────────────────────────────────────
async function generateImages(
  content: string, platform: Platform, imageModelId: string, falApiKey: string,
): Promise<{ content: string; images: { marker: string; url: string; alt: string }[] }> {
  const markers = [...content.matchAll(/\[IMAGE:\s*([^\]]+)\]/gi)];
  if (!markers.length) return { content, images: [] };

  const images: { marker: string; url: string; alt: string }[] = [];
  let result = content;

  for (const match of markers) {
    const [fullMatch, description] = match;
    const prompt = buildFluxPrompt(description.trim(), platform);
    try {
      const url = await generateFalImage(prompt, imageModelId, 'landscape', falApiKey);
      result = result.replace(fullMatch, `![${description.trim()}](${url})`);
      images.push({ marker: fullMatch, url, alt: description.trim() });
    } catch {
      result = result.replace(fullMatch, '');
    }
  }

  return { content: result, images };
}

function buildFluxPrompt(desc: string, platform: Platform): string {
  const base = `Korean lifestyle photography, ${desc}, high quality, natural lighting`;
  if (platform === 'naver')     return `${base}, warm colors, mobile-friendly composition, relatable everyday scene`;
  if (platform === 'wordpress') return `${base}, professional editorial style, clean background, informative`;
  return `${base}, personal brand photography, authentic candid style, storytelling`;
}

// ── POST Handler ──────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const {
      title, keyword,
      seoPlatform     = 'naver',
      searchVolume,
      competition,
      relatedKeywords,
      llmModelId,
      imageModelId    = 'fal/flux-schnell',
      generateImgs    = true,
      platforms       = ['naver', 'wordpress', 'personal'] as Platform[],
      saveToDb        = false,
      scheduledAt,
    } = await req.json() as {
      title: string; keyword: string; seoPlatform?: string;
      searchVolume?: number; competition?: string; relatedKeywords?: string[];
      llmModelId?: string; imageModelId?: string; generateImgs?: boolean;
      platforms?: Platform[]; saveToDb?: boolean; scheduledAt?: string;
    };

    if (!title?.trim())   return NextResponse.json({ error: '제목이 필요합니다' },  { status: 400 });
    if (!keyword?.trim()) return NextResponse.json({ error: '키워드가 필요합니다' }, { status: 400 });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });

    const meta    = user.user_metadata ?? {};
    const apiKeys = {
      gemini:    meta.gemini_api_key    ?? '',
      anthropic: meta.anthropic_api_key ?? '',
      openai:    meta.openai_api_key    ?? '',
      qwen:      meta.qwen_api_key      ?? '',
    };
    const falKey = meta.fal_api_key ?? process.env.FAL_KEY ?? '';

    let model = llmModelId ?? '';
    if (!model) {
      if (apiKeys.gemini)         model = 'gemini-2.5-flash';
      else if (apiKeys.anthropic) model = 'claude-sonnet-4-6';
      else if (apiKeys.qwen)      model = 'qwen3.5-plus';
      else return NextResponse.json({ error: 'API 키가 없습니다. 설정에서 등록해주세요.' }, { status: 400 });
    }

    const steps: { agent: string; status: 'done' | 'error'; summary: string }[] = [];

    // ── Agent 1: 리서처 (1회) ────────────────────────────────────────────────
    let outline: Outline;
    try {
      outline = await runResearcher(model, apiKeys, title, keyword, { seoPlatform, searchVolume, competition, relatedKeywords });
      steps.push({ agent: '리서처', status: 'done', summary: `앵글: ${outline.uniqueAngle?.slice(0, 40) || '완료'}` });
    } catch (e) {
      steps.push({ agent: '리서처', status: 'error', summary: (e as Error).message });
      return NextResponse.json({ error: `리서처 실패: ${(e as Error).message}`, steps }, { status: 500 });
    }

    // ── Agent 2.5: 팩트체커 (초안 참고용 — 작가 실행 후 적용) ─────────────────
    // 워드프레스 초고를 먼저 써서 팩트체크 기준으로 활용
    let wpDraft: string;
    try {
      wpDraft = await runPlatformWriter(model, apiKeys, title, outline, 'wordpress');
      steps.push({ agent: '작가(WP 초안)', status: 'done', summary: `${wpDraft.length}자` });
    } catch (e) {
      steps.push({ agent: '작가(WP 초안)', status: 'error', summary: (e as Error).message });
      return NextResponse.json({ error: `작가 실패: ${(e as Error).message}`, steps }, { status: 500 });
    }

    let factCheck: FactCheckResult = { claims: [], riskLevel: 'none', summary: '팩트체크 스킵' };
    try {
      factCheck = await runFactChecker(model, apiKeys, wpDraft);
      steps.push({ agent: '팩트체커', status: 'done', summary: factCheck.summary });
    } catch {
      steps.push({ agent: '팩트체커', status: 'error', summary: '팩트체크 실패 — 계속 진행' });
    }

    // ── Agent 2: 3개 플랫폼 작가 (병렬 실행) ─────────────────────────────────
    let naverDraft = '', personalDraft = '';
    try {
      [naverDraft, personalDraft] = await Promise.all([
        runPlatformWriter(model, apiKeys, title, outline, 'naver'),
        runPlatformWriter(model, apiKeys, title, outline, 'personal'),
      ]);
      steps.push({ agent: '작가(Naver+Personal)', status: 'done', summary: `N:${naverDraft.length}자 / P:${personalDraft.length}자` });
    } catch (e) {
      steps.push({ agent: '작가(Naver+Personal)', status: 'error', summary: (e as Error).message });
      return NextResponse.json({ error: `작가 실패: ${(e as Error).message}`, steps }, { status: 500 });
    }

    // ── Agent 3: 3개 플랫폼 편집 (병렬) ─────────────────────────────────────
    let naverEdited = '', wpEdited = '', personalEdited = '';
    try {
      [naverEdited, wpEdited, personalEdited] = await Promise.all([
        runPlatformEditor(model, apiKeys, naverDraft,    'naver',     factCheck),
        runPlatformEditor(model, apiKeys, wpDraft,       'wordpress', factCheck),
        runPlatformEditor(model, apiKeys, personalDraft, 'personal',  factCheck),
      ]);
      steps.push({ agent: '편집자(3개 플랫폼)', status: 'done', summary: `N:${naverEdited.length}자 / WP:${wpEdited.length}자 / P:${personalEdited.length}자` });
    } catch (e) {
      naverEdited    = naverDraft;
      wpEdited       = wpDraft;
      personalEdited = personalDraft;
      steps.push({ agent: '편집자', status: 'error', summary: '편집 실패 — 초고 유지' });
    }

    // ── Agent 4: 평가 (워드프레스 기준) ─────────────────────────────────────
    let evaluation: EvalResult;
    try {
      evaluation = await runEvaluator(model, apiKeys, wpEdited);
      steps.push({ agent: '평가자', status: 'done', summary: `${evaluation.grade}등급 ${evaluation.totalScore}점` });
    } catch (e) {
      steps.push({ agent: '평가자', status: 'error', summary: (e as Error).message });
      evaluation = {
        dimensions: [], totalScore: 0, grade: 'C', suggestions: [], passed: false,
      };
    }

    // ── Agent 5: 리파인 (80점 미달 시, 최대 2라운드) ─────────────────────────
    let currentNaver    = naverEdited;
    let currentWp       = wpEdited;
    let currentPersonal = personalEdited;
    let currentEval     = evaluation;
    let refinementRounds = 0;

    for (let round = 1; round <= 2; round++) {
      if (currentEval.totalScore >= 80 || currentEval.dimensions.filter(d => d.score < 7).length === 0) break;
      try {
        [currentNaver, currentWp, currentPersonal] = await Promise.all([
          runPlatformRefiner(model, apiKeys, currentNaver,    currentEval, 'naver'),
          runPlatformRefiner(model, apiKeys, currentWp,       currentEval, 'wordpress'),
          runPlatformRefiner(model, apiKeys, currentPersonal, currentEval, 'personal'),
        ]);
        refinementRounds++;
        const newEval = await runEvaluator(model, apiKeys, currentWp);
        const diff = newEval.totalScore - currentEval.totalScore;
        steps.push({ agent: `리파이너 R${round}`, status: 'done', summary: `${newEval.grade}등급 ${newEval.totalScore}점 (${diff >= 0 ? '+' : ''}${diff}점)` });
        currentEval = newEval;
      } catch (e) {
        steps.push({ agent: `리파이너 R${round}`, status: 'error', summary: (e as Error).message });
        break;
      }
    }

    // ── 이미지 생성 ───────────────────────────────────────────────────────────
    const versions: Record<Platform, PlatformVersion> = {
      naver:     { title: extractTitle(currentNaver,    title), content: currentNaver,    images: [] },
      wordpress: { title: extractTitle(currentWp,       title), content: currentWp,       images: [] },
      personal:  { title: extractTitle(currentPersonal, title), content: currentPersonal, images: [] },
    };

    if (generateImgs && falKey) {
      try {
        const [nv, wv, pv] = await Promise.all([
          generateImages(currentNaver,    'naver',     imageModelId, falKey),
          generateImages(currentWp,       'wordpress', imageModelId, falKey),
          generateImages(currentPersonal, 'personal',  imageModelId, falKey),
        ]);
        versions.naver     = { ...versions.naver,     content: nv.content, images: nv.images };
        versions.wordpress = { ...versions.wordpress, content: wv.content, images: wv.images };
        versions.personal  = { ...versions.personal,  content: pv.content, images: pv.images };
        const total = nv.images.length + wv.images.length + pv.images.length;
        steps.push({ agent: '이미지 생성', status: 'done', summary: `총 ${total}개 생성 완료` });
      } catch (e) {
        steps.push({ agent: '이미지 생성', status: 'error', summary: `이미지 생성 실패 — 텍스트만 저장` });
      }
    }

    // ── DB 저장 (saveToDb=true 시) ────────────────────────────────────────────
    let postId: string | undefined;
    if (saveToDb) {
      const { data, error } = await supabase
        .from('scheduled_posts')
        .insert({
          user_id:            user.id,
          topic:              title,
          keyword,
          seo_platform:       seoPlatform,
          search_volume:      searchVolume,
          competition,
          related_keywords:   relatedKeywords ?? [],
          llm_model_id:       model,
          image_model_id:     imageModelId,
          naver_title:        versions.naver.title,
          naver_content:      versions.naver.content,
          naver_images:       versions.naver.images,
          wordpress_title:    versions.wordpress.title,
          wordpress_content:  versions.wordpress.content,
          wordpress_images:   versions.wordpress.images,
          personal_title:     versions.personal.title,
          personal_content:   versions.personal.content,
          personal_images:    versions.personal.images,
          evaluation:         currentEval,
          outline,
          refinement_rounds:  refinementRounds,
          status:             'ready',
          scheduled_at:       scheduledAt ?? null,
        })
        .select('id')
        .single();
      if (!error && data) postId = data.id;
    }

    return NextResponse.json({
      naver:     versions.naver,
      wordpress: versions.wordpress,
      personal:  versions.personal,
      outline, factCheck,
      evaluation: currentEval,
      refinementRounds,
      steps,
      model,
      postId,
    } satisfies MultiPlatformResult & { model: string });

  } catch (err: unknown) {
    console.error('[blog/write-multi-platform]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '파이프라인 실행 실패' },
      { status: 500 },
    );
  }
}
