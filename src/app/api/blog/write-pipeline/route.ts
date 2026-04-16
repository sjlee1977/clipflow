/**
 * 블로그 완전 자동화 파이프라인
 *
 * POST /api/blog/write-pipeline
 *
 * 흐름:
 *   Agent 1 (리서처)   : 키워드 + 제목 → 5막 아웃라인
 *   Agent 2 (작가)     : 아웃라인 → 초고
 *   Agent 3 (편집자)   : 초고 정제
 *   Agent 4 (평가자)   : 8개 차원 채점
 *   ─ 점수 < 80이면 최대 2라운드 ─
 *   Agent 5+ (리파이너) : 평가자 피드백 → 약점 수정
 *   Agent 6+ (재평가자) : 수정본 재채점
 *
 * Body:
 *   title             선택된 SEO 제목 (필수)
 *   keyword           메인 키워드 (필수)
 *   seoPlatform       'naver' | 'google'
 *   searchVolume      월간 검색량
 *   competition       '낮음'|'중간'|'높음'
 *   contentSaturation 월간 신규 발행량
 *   trendDirection    '상승'|'하락'|'보합'
 *   relatedKeywords   연관 키워드 배열
 *   tone              문체
 *   length            분량
 *   llmModelId        AI 모델 ID
 */
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase-server';
import fs from 'fs';
import path from 'path';

// ── 타입 ──────────────────────────────────────────────────────────────────────
interface Outline {
  painPoint:    string;
  uniqueAngle:  string;
  hookType:     string;
  emotionalArc: string;
  structure:    { act1: string; act2: string; act3: string; act4: string; act5: string };
  keyPoints:    string[];
}

export interface DimensionResult {
  name:       string;
  nameKo:     string;
  score:      number;
  reason:     string;
  suggestion: string;
}

export interface EvalResult {
  dimensions:  DimensionResult[];
  totalScore:  number;
  grade:       'S' | 'A' | 'B' | 'C' | 'D';
  suggestions: string[];
  passed:      boolean;
}

export interface PipelineStep {
  agent:   string;
  status:  'done' | 'error';
  summary: string;
  round?:  number;
}

export interface FactClaim {
  text:       string;
  type:       'statistic' | 'study' | 'date' | 'expert' | 'policy' | 'fact';
  risk:       'high' | 'medium' | 'low';
  reason:     string;
  suggestion: string;
}

export interface FactCheckResult {
  claims:    FactClaim[];
  riskLevel: 'high' | 'medium' | 'low' | 'none';
  summary:   string;
}

// ── 위키 로더 ─────────────────────────────────────────────────────────────────
const WIKI = path.join(process.cwd(), 'wiki');
function wiki(p: string) { try { return fs.readFileSync(path.join(WIKI, p), 'utf-8'); } catch { return ''; } }

function latestFeedback() {
  try {
    const dir = path.join(WIKI, 'feedback');
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.md')).sort().reverse();
    if (!files.length) return '';
    return fs.readFileSync(path.join(dir, files[0]), 'utf-8');
  } catch { return ''; }
}

// ── LLM 공통 호출 ─────────────────────────────────────────────────────────────
async function llm(
  model:      string,
  apiKeys:    Record<string, string>,
  system:     string,
  messages:   { role: 'user' | 'assistant'; content: string }[],
  maxTokens = 3500,
  temp      = 0.7,
  json      = false,
): Promise<string> {
  const isClaude = model.startsWith('claude');
  const isQwen   = model.startsWith('qwen');
  const sys = json && !model.startsWith('gemini')
    ? `${system}\n\n반드시 유효한 JSON만 출력. 마크다운 코드블록 없이.`
    : system;

  if (isClaude) {
    const client = new Anthropic({ apiKey: apiKeys.anthropic });
    const res = await client.messages.create({ model, max_tokens: maxTokens, temperature: temp, system: sys, messages });
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
  // Gemini
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

// ── Perplexity 웹 검색 ────────────────────────────────────────────────────────
async function callPerplexity(apiKey: string, query: string, maxTokens = 700): Promise<{ answer: string; citations: string[] }> {
  const res = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'sonar',
      messages: [
        { role: 'system', content: '정확하고 간결하게 한국어로 답변하세요. 최신 정보와 출처를 포함합니다.' },
        { role: 'user', content: query },
      ],
      max_tokens: maxTokens,
      temperature: 0.2,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(`Perplexity 오류: ${err?.error?.message ?? res.status}`);
  }
  const data = await res.json() as { choices?: { message?: { content?: string } }[]; citations?: string[] };
  return {
    answer:    data.choices?.[0]?.message?.content ?? '',
    citations: (data.citations ?? []).slice(0, 5),
  };
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

// ── Agent 1: 리서처 ───────────────────────────────────────────────────────────
async function runResearcher(
  model:    string,
  apiKeys:  Record<string, string>,
  title:    string,
  keyword:  string,
  context:  { seoPlatform: string; searchVolume?: number; competition?: string; trendDirection?: string; relatedKeywords?: string[]; tone: string; length: string },
): Promise<Outline> {
  const structure = wiki('blog/structure.md');
  const hooks     = wiki('blog/hook-writing.md');
  const toneDesc: Record<string, string> = {
    friendly: '친근하고 대화체', professional: '전문적이고 격식체',
    casual: '편안하고 자유로운', educational: '교육적이고 설명적인',
  };
  const lengthDesc: Record<string, string> = {
    short:    '1000자 미만 (800~999자, 핵심만 간결하게)',
    medium:   '3000~5000자 (충분한 설명, 예시, 실용 정보 포함)',
    long:     '5000~7000자 (풍부한 내용, 상세 사례, 심층 분석)',
    verylong: '7000자 이상 (완전한 가이드, 목차 구성, 전문성 극대화)',
  };

  // ── Perplexity 웹 리서치 (키 있을 때만) ─────────────────────────────────────
  let webResearch = '';
  if (apiKeys.perplexity) {
    try {
      const q = `"${keyword}" 관련 최신 트렌드, 핵심 통계, 실제 사례 (블로그 콘텐츠 제작용, 2024~2025년)`;
      const { answer, citations } = await callPerplexity(apiKeys.perplexity, q, 700);
      if (answer) {
        webResearch = answer;
        if (citations.length) webResearch += `\n\n[출처] ${citations.join(' | ')}`;
      }
    } catch { /* Perplexity 실패 시 무시 — 기존 방식으로 진행 */ }
  }

  const contextLines: string[] = [];
  if (context.searchVolume)    contextLines.push(`월간 검색량: ${context.searchVolume.toLocaleString()}회`);
  if (context.competition)     contextLines.push(`경쟁도: ${context.competition}`);
  if (context.trendDirection)  contextLines.push(`트렌드: ${context.trendDirection}`);
  if (context.relatedKeywords?.length) contextLines.push(`연관 키워드: ${context.relatedKeywords.slice(0, 5).join(', ')}`);

  const systemPrompt = `당신은 10년 경력의 콘텐츠 전략가입니다.
SEO 데이터와 키워드를 바탕으로 최고 품질의 블로그 아웃라인을 설계합니다.

구조 원칙:
${structure || '5막 구조: 훅 → 갈등 → 반전 → 증명 → 해소'}

훅 유형:
${hooks || 'A형(도발적 질문), B형(충격 수치), C형(착각 지적)'}

${context.seoPlatform === 'naver' ? '네이버 SEO: 정보성, 생활 밀착형, 구체적 예시 중심' : '구글 SEO: 명확한 구조, 헤딩 활용, 전문성 중시'}
목표 문체: ${toneDesc[context.tone] ?? '친근하고 대화체'}
목표 분량: ${lengthDesc[context.length] ?? '1000~1800자'}`;

  const userPrompt = `제목: "${title}"
키워드: "${keyword}"
${contextLines.join('\n')}
${webResearch ? `\n## 실시간 웹 리서치 결과 (반드시 아웃라인에 반영)\n${webResearch}\n` : ''}
위 제목과 SEO 데이터를 바탕으로 블로그 아웃라인을 설계하세요.

{
  "painPoint":    "독자의 핵심 고통/문제 (1~2문장)",
  "uniqueAngle":  "다른 글과 차별화되는 독창적 관점 (1~2문장)",
  "hookType":     "A형/B형/C형 중 선택 + 이유",
  "emotionalArc": "긴장→공감→놀람→안도→행동 각 단계 감정 포인트",
  "structure": {
    "act1": "1막 (훅&세계설정): 구체적 내용",
    "act2": "2막 (갈등/문제심화): 구체적 내용",
    "act3": "3막 (반전&핵심인사이트): 핵심 주장",
    "act4": "4막 (증명&실천): 근거와 실천 방법",
    "act5": "5막 (해소&CTA): 클로징 방향"
  },
  "keyPoints": ["핵심 포인트1", "핵심 포인트2", "핵심 포인트3"]
}`;

  const raw = await llm(model, apiKeys, systemPrompt, [{ role: 'user', content: userPrompt }], 1200, 0.3, true);
  return safeJson<Outline>(raw, {
    painPoint: '', uniqueAngle: '', hookType: 'A형', emotionalArc: '',
    structure: { act1: '', act2: '', act3: '', act4: '', act5: '' }, keyPoints: [],
  });
}

// ── Agent 2: 작가 ─────────────────────────────────────────────────────────────
async function runWriter(
  model:   string,
  apiKeys: Record<string, string>,
  title:   string,
  outline: Outline,
  context: { tone: string; length: string },
): Promise<string> {
  const persona   = wiki('blog/writer-persona.md');
  const narrative = wiki('blog/narrative-techniques.md');
  const cta       = wiki('blog/cta-writing.md');
  const emotional = wiki('blog/emotional-flow.md');
  const feedback  = latestFeedback();

  const toneDesc: Record<string, string> = {
    friendly: '친근하고 대화체', professional: '전문적이고 격식체',
    casual: '편안하고 자유로운', educational: '교육적이고 설명적인',
  };
  const lengthDesc: Record<string, string> = {
    short:    '1000자 미만 (800~999자, 핵심만 간결하게)',
    medium:   '3000~5000자 (충분한 설명, 예시, 실용 정보 포함)',
    long:     '5000~7000자 (풍부한 내용, 상세 사례, 심층 분석)',
    verylong: '7000자 이상 (완전한 가이드, 목차 구성, 전문성 극대화)',
  };
  const writerMaxTokens: Record<string, number> = {
    short: 2000, medium: 9000, long: 16000, verylong: 22000,
  };

  const systemPrompt = `당신은 10년 경력의 블로그 전문 작가입니다.

${persona    ? `### 작가 페르소나\n${persona}\n`   : ''}
${narrative  ? `### 서사 기법\n${narrative}\n`     : ''}
${emotional  ? `### 감정 흐름\n${emotional}\n`     : ''}
${cta        ? `### CTA 원칙\n${cta}\n`            : ''}
${feedback   ? `### 최근 피드백 (반드시 반영)\n${feedback}\n` : ''}

목표 문체: ${toneDesc[context.tone] ?? '친근하고 대화체'}
목표 분량: ${lengthDesc[context.length] ?? '3000~5000자'} ← **반드시 목표 분량을 채울 것. 짧게 끝내지 말 것.**
출력: 마크다운 블로그 글만 (JSON 없이)

## 사람이 쓴 글처럼 — 절대 원칙

### AI 탐지 금지 표현 (절대 사용 금지)
- "살펴보겠습니다", "알아보겠습니다", "확인해보겠습니다"
- "이상으로 ~에 대해 알아보았습니다", "마치겠습니다"
- "도움이 되셨으면 합니다", "참고가 되셨으면 합니다"
- "중요합니다" (단독 결론으로 사용), "필요합니다" (단독 강조)
- "또한", "더불어", "이에 따라", "따라서" (문단 첫 단어로만)
- "~에 대해 알아보겠습니다" 형태의 도입부
- "첫째", "둘째", "셋째" 나열 (글 전체를 목록으로 만드는 것)
- 과도한 소제목 남용 (모든 단락에 ## 헤딩 금지)

### 반드시 구현할 인간 필기감 요소
- **개인 경험담 삽입**: "저도 처음엔 몰랐는데요...", "직접 해봤더니 의외로..."
- **자연스러운 구어체**: "사실", "솔직히 말하면", "근데", "그거 알아요?"
- **짧은 문장 + 여운**: "그게 문제였습니다. 진짜로요."
- **감정의 진정성**: "막막했어요", "허탈하더라고요", "의외로 쉽더라고요"
- **독자에게 직접 질문**: "혹시 이런 경험 있으세요?", "맞죠?"
- **구체적 디테일**: "3일 동안", "작년 여름에", "주변 지인이 알려줬는데"
- **문단 길이 불규칙**: 2줄 문단과 6줄 문단이 섞여야 자연스러움
- **한국어 구어 어미**: "~더라고요", "~거든요", "~잖아요", "~더니"
- **불완전한 표현 허용**: "그게... 사실은요.", "뭐랄까, 좀 복잡한데"

## 할루시네이션 방지 — 절대 원칙
사실 확인이 불가능한 내용은 절대 단정적으로 서술 금지:

### 절대 금지 (할루시네이션 고위험)
- 출처 없는 구체적 통계: "80%의 사람들이...", "매년 10만 명이..." → 절대 금지
- 가짜 연구 인용: "하버드 연구에 따르면", "○○연구소 발표" → 실제 확인 불가면 금지
- 실제 없는 전문가 발언: "전문가들은 ~라고 말한다" → 특정 인물 발언 꾸며내기 금지
- 잘못된 정책/법령 수치: 복지 지원금, 세율, 신청 조건 등 구체적 숫자 → 변경 가능성 높음

### 불확실할 때 사용할 표현 (헤징 언어)
- 수치 대신: "많은 사람들이", "상당수가", "대부분의 경우"
- 연구 대신: "일반적으로 알려진 바로는", "통상적으로", "경험적으로"
- 단정 대신: "~는 경우가 많습니다", "~것으로 알려져 있습니다", "~경향이 있습니다"
- 정책 수치: "신청 시점 기준으로 변동될 수 있으니 공식 홈페이지 확인 필수"`;


  const userPrompt = `아래 아웃라인으로 블로그 초고를 작성하세요. 제목은 "${title}".

--- 아웃라인 ---
독자 고통: ${outline.painPoint}
독창적 앵글: ${outline.uniqueAngle}
훅 유형: ${outline.hookType}
감정 흐름: ${outline.emotionalArc}

1막 (훅&세계설정): ${outline.structure.act1}
2막 (갈등/문제심화): ${outline.structure.act2}
3막 (반전&핵심인사이트): ${outline.structure.act3}
4막 (증명&실천): ${outline.structure.act4}
5막 (해소&CTA): ${outline.structure.act5}

핵심 포인트: ${outline.keyPoints.join(', ')}

# 제목으로 시작하는 마크다운 형식으로 작성하세요.`;

  const maxTok = writerMaxTokens[context.length] ?? 9000;
  return await llm(model, apiKeys, systemPrompt, [{ role: 'user', content: userPrompt }], maxTok, 0.8);
}

// ── Agent 2.5: 팩트체커 ──────────────────────────────────────────────────────
async function runFactChecker(
  model:   string,
  apiKeys: Record<string, string>,
  content: string,
): Promise<FactCheckResult> {
  // Perplexity로 주요 사실 사전 검증
  let perplexityVerification = '';
  if (apiKeys.perplexity) {
    try {
      const excerpt = content.slice(0, 900).replace(/\n+/g, ' ');
      const { answer } = await callPerplexity(
        apiKeys.perplexity,
        `다음 블로그 내용의 주요 사실/통계/수치가 정확한지 확인해주세요. 잘못된 내용이 있으면 구체적으로 지적하세요: "${excerpt}"`,
        500,
      );
      if (answer) perplexityVerification = answer;
    } catch { /* 실패 시 무시 */ }
  }

  const systemPrompt = `당신은 AI 생성 블로그 글의 할루시네이션을 탐지하는 팩트체커입니다.
AI 모델은 없는 사실을 그럴듯하게 꾸며내는 경향이 있습니다.
냉정하게, 아래 기준으로 위험 요소를 찾아내세요.

## 할루시네이션 유형별 위험도

### HIGH (즉시 수정 필요)
- 출처 없는 구체적 통계: "83%가", "연간 1조 원", "10명 중 7명"
- 가짜 연구/기관 인용: "하버드 연구", "○○연구소 발표", "과학적으로 증명"
- 특정 전문가 발언 조작: "전문가 A는 ~라고 말했다"
- 복지/정책 구체 수치: 지원금 금액, 소득 기준선, 신청 마감일 등

### MEDIUM (헤징 언어로 완화 필요)
- 불확실한 연도/날짜: "2022년에", "최근 3년간"
- 과도한 인과관계 단정: "~하면 반드시 ~된다"
- 검증 어려운 일반화: "모든 전문가가 동의한다"

### LOW (맥락 확인)
- 다소 모호한 일반 상식: 틀릴 수도 있지만 큰 문제 없는 수준
- 경험담 과장: 약간의 과장은 블로그 글쓰기에서 허용

### 해당 없음
- 작성자 개인 경험/의견 ("저는 ~라고 생각해요")
- 공개된 명백한 사실 ("대한민국의 수도는 서울")
- 일반적 생활 지식`;

  const userPrompt = `아래 블로그 글에서 할루시네이션 위험 요소를 탐지하세요.
${perplexityVerification ? `\n## Perplexity 웹 검증 결과 (참고하여 판단)\n${perplexityVerification}\n` : ''}
---글---
${content.slice(0, 5000)}

JSON 출력:
{
  "claims": [
    {
      "text": "원문에서 문제 문장 (그대로 인용, 너무 길면 앞 50자)",
      "type": "statistic|study|date|expert|policy|fact",
      "risk": "high|medium|low",
      "reason": "왜 위험한지 (20자 이내)",
      "suggestion": "수정 방향 (30자 이내)"
    }
  ],
  "riskLevel": "high|medium|low|none",
  "summary": "전체 요약 (예: 고위험 2개, 중위험 1개 발견)"
}

할루시네이션이 전혀 없으면: { "claims": [], "riskLevel": "none", "summary": "할루시네이션 없음" }`;

  const raw = await llm(model, apiKeys, systemPrompt, [{ role: 'user', content: userPrompt }], 2000, 0.1, true);
  const fallback: FactCheckResult = { claims: [], riskLevel: 'none', summary: '팩트체크 완료' };
  const parsed = safeJson<FactCheckResult>(raw, fallback);
  return {
    claims:    Array.isArray(parsed.claims) ? parsed.claims : [],
    riskLevel: parsed.riskLevel ?? 'none',
    summary:   parsed.summary  ?? '팩트체크 완료',
  };
}

// ── Agent 3: 편집자 ───────────────────────────────────────────────────────────
async function runEditor(
  model:     string,
  apiKeys:   Record<string, string>,
  draft:     string,
  factCheck?: FactCheckResult,
  length:    string = 'medium',
): Promise<string> {
  const rubric  = wiki('blog/evaluation-rubric.md');
  const persona = wiki('blog/writer-persona.md');

  const forbidden = persona
    ? (persona.split('절대 사용 금지')[1]?.split('##')[0]?.slice(0, 400) ?? '')
    : '지금까지 알아보았습니다, 도움이 됐으면 좋겠습니다';

  const systemPrompt = `당신은 15년 경력의 디지털 미디어 편집장입니다.
작가의 문체를 살리면서 약점만 외과적으로 수정합니다. 전체 재작성 금지.

채점 기준:
${rubric || '훅강도 / 서사구조 / Show-Don\'t-Tell / 문장리듬 / 감정흐름 / CTA / 금지표현 / 클로징에코'}

## AI 패턴 탐지 및 인간화 (최우선 편집 작업)

### 즉시 제거할 AI 표현
- "살펴보겠습니다", "알아보겠습니다", "확인해보겠습니다"
- "이상으로 ~에 대해 알아보았습니다"
- "도움이 되셨으면 합니다", "참고가 되셨으면 합니다"
- "중요합니다", "필요합니다" (단독 강조 결론)
- "또한", "더불어", "이에 따라" (문단 첫 단어)
${forbidden ? `\n추가 금지 표현:\n${forbidden}` : ''}

### AI 패턴 → 인간 표현 변환 예시
- "이에 대해 알아보겠습니다" → "실제로 어떤지 한번 볼게요"
- "중요합니다" → "이게 핵심이에요, 진짜로"
- "도움이 되셨으면 합니다" → "저도 이걸 알았을 때 많이 달라졌거든요"
- 모든 단락이 같은 길이 → 짧은 단락(1~2줄)과 긴 단락(4~6줄) 교차
- 과도한 소제목(##) → 필요한 곳에만 2~3개 유지

### 인간 필기감 강화
자연스러운 구어 어미("~더라고요", "~거든요"), 짧은 감탄 문장,
독자 직접 호명("혹시~"), 구체적 경험담이 없으면 추가 삽입 가능`;


  const highRiskClaims = (factCheck?.claims ?? []).filter(c => c.risk === 'high');
  const allClaims      = (factCheck?.claims ?? []);

  const factCheckSection = allClaims.length > 0
    ? `\n=== 팩트체커 지적 사항 (수정 필수) ===
${allClaims.map(c =>
  `- [${c.risk.toUpperCase()}] "${c.text.slice(0, 60)}..."\n  이유: ${c.reason}\n  수정방향: ${c.suggestion}`
).join('\n\n')}
${highRiskClaims.length > 0 ? `\n⚠️ HIGH 위험 ${highRiskClaims.length}개는 반드시 헤징 언어로 완화하거나 제거하세요.` : ''}\n`
    : '';

  const userPrompt = `아래 초고를 편집하세요.
${factCheckSection}
---초고---
${draft}

{
  "editorNotes": ["수정 항목1: 이유", "수정 항목2: 이유"],
  "finalContent": "수정된 최종 마크다운 전체"
}`;

  const editorMaxTokens: Record<string, number> = {
    short: 2500, medium: 10000, long: 18000, verylong: 24000,
  };
  const edMaxTok = editorMaxTokens[length] ?? 10000;
  const raw    = await llm(model, apiKeys, systemPrompt, [{ role: 'user', content: userPrompt }], edMaxTok, 0.2, true);
  const parsed = safeJson<{ finalContent?: string }>(raw, {});
  return parsed.finalContent ?? draft;
}

// ── Agent 4 / 재평가: 평가자 ──────────────────────────────────────────────────
async function runEvaluator(model: string, apiKeys: Record<string, string>, content: string): Promise<EvalResult> {
  const rubric = wiki('blog/evaluation-rubric.md');

  const systemPrompt = `당신은 블로그 품질을 냉정하게 평가하는 편집장입니다.
아래 루브릭으로 10개 차원 각 10점 만점 채점. JSON만 출력.

${rubric || '훅강도/서사구조/장면묘사/문장리듬/감정흐름/CTA품질/금지표현/클로징에코/인간필기감/사실정확성'}

## 인간 필기감 채점 기준 (9번째 차원)
AI가 쓴 것 같은 패턴이 얼마나 제거되었는지 평가:

10점: AI 패턴 0개, 개인 경험담 포함, 구어체 자연스러움, 문단 길이 다양
7~9점: AI 패턴 1~2개 있으나 전반적으로 자연스러움
4~6점: AI 패턴 다수(3~5개) 또는 전체 구조가 공식적
1~3점: 전형적 AI 투의 "살펴보겠습니다" 구조, 나열식, 무감정
0점: 거의 모든 문장이 AI 패턴 (완전 보고서체)

AI 패턴 감지 목록:
- "살펴보겠습니다", "알아보겠습니다", "확인해보겠습니다"
- "이상으로 ~에 대해 알아보았습니다"
- "도움이 되셨으면 합니다", "참고가 되셨으면 합니다"
- 모든 문단이 같은 길이로 균일함
- 개인 경험·감정 표현 전무
- 독자 직접 호명 없음

## 사실 정확성 채점 기준 (10번째 차원)
출처 없는 수치/연구/발언이 있는지 평가:
10점: 검증 불가 수치·연구·발언 0개, 불확실한 내용은 헤징 언어로 처리
7~9점: 헤징 없는 주장 1~2개이나 명백한 허위는 없음
4~6점: 출처 없는 구체적 수치 또는 인용 3개 이상
1~3점: 가짜 연구/통계 다수, 또는 정책 수치 오류 포함
0점: 핵심 내용 자체가 사실 왜곡`;

  const userPrompt = `아래 블로그 글을 채점하세요.

---글---
${content.slice(0, 6000)}

{
  "dimensions": [
    { "name": "hook_power",          "nameKo": "훅 강도",      "score": 0, "reason": "...", "suggestion": "..." },
    { "name": "narrative_structure", "nameKo": "서사 구조",     "score": 0, "reason": "...", "suggestion": "..." },
    { "name": "show_dont_tell",      "nameKo": "장면 묘사",     "score": 0, "reason": "...", "suggestion": "..." },
    { "name": "sentence_rhythm",     "nameKo": "문장 리듬",     "score": 0, "reason": "...", "suggestion": "..." },
    { "name": "emotional_arc",       "nameKo": "감정 흐름",     "score": 0, "reason": "...", "suggestion": "..." },
    { "name": "cta_quality",         "nameKo": "CTA 품질",      "score": 0, "reason": "...", "suggestion": "..." },
    { "name": "forbidden_phrases",   "nameKo": "금지 표현",     "score": 0, "reason": "...", "suggestion": "..." },
    { "name": "closing_echo",        "nameKo": "클로징 에코",   "score": 0, "reason": "...", "suggestion": "..." },
    { "name": "human_feel",          "nameKo": "인간 필기감",   "score": 0, "reason": "AI 패턴 N개 발견 또는 없음", "suggestion": "..." },
    { "name": "factual_accuracy",    "nameKo": "사실 정확성",   "score": 0, "reason": "검증 불가 주장 N개", "suggestion": "..." }
  ]
}`;

  const raw    = await llm(model, apiKeys, systemPrompt, [{ role: 'user', content: userPrompt }], 4000, 0.2, true);
  const parsed = safeJson<{ dimensions?: DimensionResult[] }>(raw, { dimensions: [] });

  const dims = (parsed.dimensions ?? []).map(d => ({
    ...d, score: Math.min(10, Math.max(0, Math.round(Number(d.score) || 0))),
  }));

  // dims가 비어있으면 파싱 실패 — 0점 D등급으로 오인되지 않도록 예외 처리
  if (dims.length === 0) throw new Error('평가자 응답 파싱 실패 (빈 dimensions)');

  const rawScore   = dims.reduce((s, d) => s + d.score, 0);
  const totalScore = Math.round((rawScore / (dims.length * 10)) * 100);
  const grade      = calcGrade(totalScore);
  const suggestions = dims
    .filter(d => d.score < 7 && d.suggestion)
    .sort((a, b) => a.score - b.score)
    .map(d => `[${d.nameKo}] ${d.suggestion}`);

  return { dimensions: dims, totalScore, grade, suggestions, passed: grade === 'S' || grade === 'A' };
}

// ── Agent 5+: 리파이너 (작가 + 평가자 토론) ──────────────────────────────────
async function runRefiner(
  model:      string,
  apiKeys:    Record<string, string>,
  content:    string,
  evaluation: EvalResult,
  round:      number,
  length:     string = 'medium',
): Promise<string> {
  const weakItems = evaluation.dimensions
    .filter(d => d.score < 7)
    .map(d => `• **${d.nameKo}** (${d.score}/10점)\n  문제: ${d.reason}\n  개선방향: ${d.suggestion}`)
    .join('\n\n');

  if (!weakItems) return content; // 약점 없으면 그대로

  const systemPrompt = `당신은 전문 블로그 편집 작가입니다. 라운드 ${round} 수정을 진행합니다.
평가자의 지적 사항을 정확히 반영해 약점 부분만 외과적으로 수정합니다.

원칙:
- 지적된 차원의 해당 구간만 수정 (전체 재작성 금지)
- 작가 고유의 문체와 구조 유지
- 수정 후 해당 차원 점수가 8점 이상이 되도록 개선
- 마크다운 전체 글을 그대로 출력

## 수정 중 인간 필기감 유지 (절대 원칙)
수정하면서 아래 AI 패턴이 새로 생기면 절대 안 됨:
- "살펴보겠습니다", "알아보겠습니다" 계열
- "이상으로 ~에 대해 알아보았습니다"
- "도움이 되셨으면 합니다"
- 문단을 같은 길이로 균일하게 맞추는 것
- 개인 경험·감정 표현을 삭제하는 것

인간 필기감(human_feel) 점수가 낮다면:
AI 패턴 문장을 구어체로 바꾸고, 개인 경험 표현("직접 해봤더니", "저도 처음엔")을 1~2개 추가하세요.`;


  const userPrompt = `=== 평가자 피드백 (이 부분만 수정) ===
${weakItems}

=== 현재 블로그 글 ===
${content}

위 약점을 수정한 전체 마크다운 블로그 글을 출력하세요.`;

  const refinerMaxTokens: Record<string, number> = {
    short: 2500, medium: 10000, long: 18000, verylong: 24000,
  };
  const refMaxTok = refinerMaxTokens[length] ?? 10000;
  const refined = await llm(model, apiKeys, systemPrompt, [{ role: 'user', content: userPrompt }], refMaxTok, 0.5);
  return refined.trim() || content;
}

// ── POST Handler ──────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const {
      title, keyword,
      seoPlatform    = 'naver',
      searchVolume,
      competition,
      contentSaturation,
      trendDirection,
      relatedKeywords,
      tone           = 'friendly',
      length         = 'medium',
      llmModelId,
    } = await req.json();

    if (!title?.trim()) return NextResponse.json({ error: '제목이 필요합니다' },  { status: 400 });
    if (!keyword?.trim()) return NextResponse.json({ error: '키워드가 필요합니다' }, { status: 400 });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });

    const meta    = user.user_metadata ?? {};
    const apiKeys = {
      gemini:     meta.gemini_api_key     ?? '',
      anthropic:  meta.anthropic_api_key  ?? '',
      qwen:       meta.qwen_api_key       ?? '',
      perplexity: meta.perplexity_api_key ?? '',
    };

    let model = llmModelId ?? '';
    if (!model) {
      if (apiKeys.gemini)         model = 'gemini-2.5-flash';
      else if (apiKeys.anthropic) model = 'claude-sonnet-4-6';
      else if (apiKeys.qwen)      model = 'qwen3.5-plus';
      else return NextResponse.json({ error: 'API 키가 없습니다. 설정 페이지에서 등록해주세요.' }, { status: 400 });
    }

    const context = { seoPlatform, searchVolume, competition, trendDirection, relatedKeywords, tone, length };
    const steps: PipelineStep[] = [];

    // ── Agent 1: 리서처 ──────────────────────────────────────────────────────
    let outline: Outline;
    try {
      outline = await runResearcher(model, apiKeys, title, keyword, context);
      steps.push({ agent: '리서처', status: 'done', summary: `앵글: ${outline.uniqueAngle?.slice(0, 40) || '완료'}${apiKeys.perplexity ? ' [Perplexity 리서치 적용]' : ''}` });
    } catch (e) {
      const msg = (e as Error).message;
      steps.push({ agent: '리서처', status: 'error', summary: msg });
      return NextResponse.json({ error: `리서처 실패: ${msg}`, steps }, { status: 500 });
    }

    // ── Agent 2: 작가 ────────────────────────────────────────────────────────
    let draft: string;
    try {
      draft = await runWriter(model, apiKeys, title, outline, { tone, length });
      steps.push({ agent: '작가', status: 'done', summary: `초고 ${draft.length}자 작성 완료` });
    } catch (e) {
      const msg = (e as Error).message;
      steps.push({ agent: '작가', status: 'error', summary: msg });
      return NextResponse.json({ error: `작가 실패: ${msg}`, steps }, { status: 500 });
    }

    // ── Agent 2.5: 팩트체커 ─────────────────────────────────────────────────
    let factCheck: FactCheckResult = { claims: [], riskLevel: 'none', summary: '팩트체크 스킵' };
    try {
      factCheck = await runFactChecker(model, apiKeys, draft);
      const highCount = factCheck.claims.filter(c => c.risk === 'high').length;
      const midCount  = factCheck.claims.filter(c => c.risk === 'medium').length;
      const stepSummary = factCheck.riskLevel === 'none'
        ? `할루시네이션 없음${apiKeys.perplexity ? ' [Perplexity 검증]' : ''}`
        : `${factCheck.summary} (HIGH:${highCount} / MID:${midCount})${apiKeys.perplexity ? ' [Perplexity 검증]' : ''}`;
      steps.push({ agent: '팩트체커', status: 'done', summary: stepSummary });
    } catch {
      steps.push({ agent: '팩트체커', status: 'error', summary: '팩트체크 실패 — 편집 계속' });
    }

    // ── Agent 3: 편집자 ──────────────────────────────────────────────────────
    let edited: string;
    try {
      edited = await runEditor(model, apiKeys, draft, factCheck, length);
      steps.push({ agent: '편집자', status: 'done', summary: `${edited.length}자 정제 완료` });
    } catch {
      edited = draft; // 편집자 실패 → 초고 사용
      steps.push({ agent: '편집자', status: 'error', summary: '편집 실패 — 초고 유지' });
    }

    // ── Agent 4: 평가자 ──────────────────────────────────────────────────────
    let evaluation: EvalResult;
    try {
      evaluation = await runEvaluator(model, apiKeys, edited);
      steps.push({
        agent:   '평가자',
        status:  'done',
        summary: `${evaluation.grade}등급 ${evaluation.totalScore}점 — 약점 ${evaluation.dimensions.filter(d => d.score < 7).length}개`,
      });
    } catch (e) {
      const msg = (e as Error).message;
      steps.push({ agent: '평가자', status: 'error', summary: msg });
      // 평가 실패해도 계속 (편집본을 최종본으로)
      return NextResponse.json({
        content: edited, title: extractTitle(edited, title),
        steps, outline, model,
        evaluation: null, refinementRounds: 0,
      });
    }

    // ── Agent 5~6: 리파이너 + 재평가자 (최대 2라운드) ──────────────────────
    let currentContent = edited;
    let currentEval    = evaluation;
    let refinementRounds = 0;
    const MAX_ROUNDS   = 2;

    for (let round = 1; round <= MAX_ROUNDS; round++) {
      const weakCount = currentEval.dimensions.filter(d => d.score < 7).length;
      if (currentEval.totalScore >= 80 || weakCount === 0) break;

      // 리파이너
      try {
        const refined = await runRefiner(model, apiKeys, currentContent, currentEval, round, length);
        const diff = Math.abs(refined.length - currentContent.length);
        steps.push({
          agent: `리파이너`, status: 'done',
          summary: `R${round}: ${weakCount}개 약점 수정 (${diff > 0 ? '+' : ''}${diff}자)`,
          round,
        });
        currentContent = refined;
        refinementRounds++;
      } catch (e) {
        steps.push({ agent: `리파이너`, status: 'error', summary: `R${round}: ${(e as Error).message}`, round });
        break;
      }

      // 재평가자
      try {
        const newEval = await runEvaluator(model, apiKeys, currentContent);
        const scoreDiff = newEval.totalScore - currentEval.totalScore;
        steps.push({
          agent: `재평가자`, status: 'done',
          summary: `R${round}: ${newEval.grade}등급 ${newEval.totalScore}점 (${scoreDiff >= 0 ? '+' : ''}${scoreDiff}점)`,
          round,
        });
        currentEval = newEval;
      } catch (e) {
        steps.push({ agent: `재평가자`, status: 'error', summary: `R${round}: ${(e as Error).message}`, round });
        break;
      }
    }

    return NextResponse.json({
      content:          currentContent,
      title:            extractTitle(currentContent, title),
      steps,
      outline,
      evaluation:       currentEval,
      factCheck,
      refinementRounds,
      model,
    });
  } catch (err: unknown) {
    console.error('[blog/write-pipeline]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '파이프라인 실행 실패' },
      { status: 500 },
    );
  }
}

function extractTitle(content: string, fallback: string): string {
  const m = content.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : fallback;
}
