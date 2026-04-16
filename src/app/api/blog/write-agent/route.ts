/**
 * 블로그 멀티에이전트 글쓰기 파이프라인
 *
 * POST /api/blog/write-agent
 *
 * Agent 0 (Knowledge Gatherer) : 사용자 knowledge DB 쿼리 → context 구성 (LLM 호출 없음)
 * [Synthesis]                  : topics[] 제공 시 — 여러 knowledge 페이지를 인과관계로 통합
 * Agent 1 (리서처)             : knowledge context + 원본 → 5막 아웃라인 설계
 * Agent 2 (작가)               : 아웃라인 → 초고 작성
 * Agent 3 (편집장)             : 초고 → 루브릭 채점 → 약점 수정 → 최종본
 *
 * Body:
 *   content       원본 내용/주제 (필수, topics[] 사용 시 선택)
 *   title         참고 제목 (선택)
 *   tone          문체 — 'friendly' | 'professional' | 'casual' | 'educational'
 *   length        분량 — 'short' | 'medium' | 'long'
 *   llmModelId    사용할 AI 모델 (없으면 자동 선택)
 *   topics        소재 병합 모드 — knowledge topic slug 배열 (예: ["private-loans", "loss-aversion"])
 *                 제공 시 Synthesis Agent가 먼저 실행되어 인과관계로 통합된 소재를 생성함
 */
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase-server';
import fs from 'fs';
import path from 'path';
import type { SynthesisOutput } from '@/app/api/wiki/synthesis/route';

// ── 위키 로더 ──────────────────────────────────────────────────────────────────
const WIKI_DIR = path.join(process.cwd(), 'wiki');

function readWikiFile(relativePath: string): string {
  try { return fs.readFileSync(path.join(WIKI_DIR, relativePath), 'utf-8'); }
  catch { return ''; }
}

function getLatestFeedback(): string {
  try {
    const feedbackDir = path.join(WIKI_DIR, 'feedback');
    const files = fs.readdirSync(feedbackDir).filter(f => f.endsWith('.md')).sort().reverse();
    if (!files.length) return '';
    return fs.readFileSync(path.join(feedbackDir, files[0]), 'utf-8');
  } catch { return ''; }
}

// ── 타입 ───────────────────────────────────────────────────────────────────────
interface Outline {
  painPoint:    string;
  uniqueAngle:  string;
  hookType:     string;
  emotionalArc: string;
  structure: { act1: string; act2: string; act3: string; act4: string; act5: string };
  keyPoints:    string[];
}

interface AgentStep {
  agent:   string;
  status:  'done' | 'error';
  summary: string;
}

// ── LLM 공통 호출 ──────────────────────────────────────────────────────────────
async function callLLM(
  model:      string,
  apiKeys:    Record<string, string>,
  system:     string,
  messages:   { role: 'user' | 'assistant'; content: string }[],
  maxTokens = 3000,
  temperature = 0.7,
  jsonMode    = false,
): Promise<string> {
  const isClaude = model.startsWith('claude');
  const isQwen   = model.startsWith('qwen');

  // JSON 모드일 때 system에 지시 추가
  const systemPrompt = jsonMode && !model.startsWith('gemini')
    ? `${system}\n\n반드시 유효한 JSON만 출력하세요. 마크다운 코드블록(\`\`\`) 없이 순수 JSON만.`
    : system;

  if (isClaude) {
    const key = apiKeys.anthropic;
    if (!key) throw new Error('Anthropic API 키가 없습니다 (설정에서 등록)');
    const client = new Anthropic({ apiKey: key });
    const res = await client.messages.create({
      model, max_tokens: maxTokens, temperature,
      system: systemPrompt, messages,
    });
    return res.content[0]?.type === 'text' ? res.content[0].text : '';
  }

  if (isQwen) {
    const key = apiKeys.qwen;
    if (!key) throw new Error('Qwen API 키가 없습니다 (설정에서 등록)');
    const body: Record<string, unknown> = {
      model, max_tokens: maxTokens, temperature,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
    };
    if (jsonMode) body.response_format = { type: 'json_object' };
    const res = await fetch('https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`Qwen 오류: ${data?.error?.message ?? res.status}`);
    return data.choices?.[0]?.message?.content ?? '';
  }

  // Gemini
  const key = apiKeys.gemini;
  if (!key) throw new Error('Gemini API 키가 없습니다 (설정에서 등록)');
  const ai = new GoogleGenAI({ apiKey: key });
  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
  const config: Record<string, unknown> = {
    systemInstruction: systemPrompt,
    maxOutputTokens: maxTokens,
    temperature,
  };
  if (jsonMode) config.responseMimeType = 'application/json';
  const response = await ai.models.generateContent({ model, contents, config });
  return response.text ?? '';
}

function safeParseJson<T>(raw: string, fallback: T): T {
  // 마크다운 코드블록 제거
  const cleaned = raw.replace(/```json?\s*/gi, '').replace(/```\s*/g, '').trim();
  // 중괄호 블록 추출
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return fallback;
  try { return JSON.parse(match[0]) as T; }
  catch { return fallback; }
}

// ── Agent 0: Knowledge Gatherer (LLM 호출 없음) ────────────────────────────────
// Supabase에서 주제 관련 knowledge/source 페이지를 가져와 문자열 context로 반환.
// 결과가 없으면 빈 문자열 — 파이프라인은 그대로 진행.
async function runKnowledgeGatherer(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  keyword: string,
): Promise<{ knowledgeContext: string; pageCount: number }> {
  if (!keyword.trim()) return { knowledgeContext: '', pageCount: 0 };

  const tokens = keyword.split(/[\s,]+/).filter(t => t.length >= 2).slice(0, 5);
  if (!tokens.length) return { knowledgeContext: '', pageCount: 0 };

  const orClauses = tokens.map(t => `topic.ilike.%${t}%,title.ilike.%${t}%`).join(',');

  const { data } = await supabase
    .from('user_wiki_pages')
    .select('type, category, topic, title, content, updated_at')
    .eq('user_id', userId)
    .in('type', ['knowledge', 'source'])
    .or(orClauses)
    .order('updated_at', { ascending: false })
    .limit(5);

  const pages = data ?? [];
  if (!pages.length) return { knowledgeContext: '', pageCount: 0 };

  // 각 페이지를 압축된 컨텍스트 블록으로 변환 (content 최대 800자)
  const blocks = pages.map(p =>
    `### [${p.type}] ${p.title} (${p.category}/${p.topic})\n${p.content.slice(0, 800)}`,
  );

  const knowledgeContext = [
    `## 사용자 축적 지식 (${pages.length}개 페이지)`,
    '> 아래는 이 주제와 관련해 이전에 쌓아온 지식입니다. 아웃라인 설계 시 적극 활용하세요.',
    '',
    ...blocks,
  ].join('\n\n');

  return { knowledgeContext, pageCount: pages.length };
}

// ── Agent 1: 리서처 ────────────────────────────────────────────────────────────
async function runResearcher(
  model: string, apiKeys: Record<string, string>,
  content: string, title: string, tone: string, length: string,
  knowledgeContext = '',
): Promise<{ outline: Outline }> {
  const structure = readWikiFile('blog/structure.md');
  const hooks     = readWikiFile('blog/hook-writing.md');

  const today = new Date().toISOString().slice(0, 10);
  const year  = today.slice(0, 4);

  const toneDesc: Record<string, string> = {
    friendly: '친근하고 대화체', professional: '전문적이고 격식체',
    casual: '편안하고 자유로운', educational: '교육적이고 설명적인',
  };
  const lengthDesc: Record<string, string> = {
    short: '500~800자', medium: '800~1500자', long: '1500~3000자',
  };

  const systemPrompt = `당신은 10년 경력의 콘텐츠 전략가입니다.
주어진 내용을 분석하여 최고 품질의 블로그 아웃라인을 설계합니다.

⚠ 현재 날짜: ${today} (${year}년 기준으로 독자가 읽는 글입니다)
- 제목이나 아웃라인에 연도를 넣을 때는 반드시 ${year}년을 사용하세요
- "2024년 최신판" 같은 표현은 이미 구식입니다 — 절대 사용하지 마세요
- 원본 내용에 구체적 연도 수치가 없다면 연도를 단정하지 말고 "[기준일 확인 필요]" 표시 권장

참고할 구조 원칙:
${structure || '5막 구조: 훅 → 갈등 → 반전 → 증명 → 해소'}

훅 유형:
${hooks || 'A형(도발적 질문), B형(충격 수치), C형(착각 지적)'}

목표 문체: ${toneDesc[tone] ?? '친근하고 대화체'}
목표 분량: ${lengthDesc[length] ?? '800~1500자'}
${knowledgeContext ? `\n${knowledgeContext}\n\n위 축적 지식의 수치·사례·앵글을 아웃라인에 녹여주세요.` : ''}`;

  const userPrompt = `아래 내용을 바탕으로 블로그 아웃라인을 설계하세요.${title ? `\n참고 제목: ${title}` : ''}

---원본 내용---
${content.slice(0, 4000)}

출력 형식 (JSON):
{
  "painPoint": "독자의 핵심 고통/문제 (1~2문장)",
  "uniqueAngle": "다른 글과 차별화되는 독창적 관점 (1~2문장)",
  "hookType": "A형/B형/C형 중 선택 + 이유",
  "emotionalArc": "긴장→공감→놀람→안도→행동 각 단계에 쓸 감정 포인트",
  "structure": {
    "act1": "1막(훅&세계설정): 구체적 내용",
    "act2": "2막(갈등/문제심화): 구체적 내용",
    "act3": "3막(반전&핵심인사이트): 핵심 주장",
    "act4": "4막(증명&실천): 근거와 실천 방법",
    "act5": "5막(해소&CTA): 클로징 방향"
  },
  "keyPoints": ["핵심 포인트1", "핵심 포인트2", "핵심 포인트3"]
}`;

  const raw = await callLLM(model, apiKeys, systemPrompt,
    [{ role: 'user', content: userPrompt }], 1200, 0.3, true);

  const outline = safeParseJson<Outline>(raw, {
    painPoint: '', uniqueAngle: '', hookType: 'A형', emotionalArc: '',
    structure: { act1: '', act2: '', act3: '', act4: '', act5: '' }, keyPoints: [],
  });
  return { outline };
}

// ── Agent 2: 작가 ──────────────────────────────────────────────────────────────
async function runWriter(
  model: string, apiKeys: Record<string, string>,
  content: string, title: string, tone: string, length: string, outline: Outline,
): Promise<{ draft: string }> {
  const persona   = readWikiFile('blog/writer-persona.md');
  const narrative = readWikiFile('blog/narrative-techniques.md');
  const cta       = readWikiFile('blog/cta-writing.md');
  const emotional = readWikiFile('blog/emotional-flow.md');
  const feedback  = getLatestFeedback();

  const toneDesc: Record<string, string> = {
    friendly: '친근하고 대화체', professional: '전문적이고 격식체',
    casual: '편안하고 자유로운', educational: '교육적이고 설명적인',
  };
  const lengthDesc: Record<string, string> = {
    short: '500~800자', medium: '800~1500자', long: '1500~3000자',
  };

  const today = new Date().toISOString().slice(0, 10);
  const year  = today.slice(0, 4);

  const systemPrompt = `당신은 10년 경력의 블로그 전문 작가입니다.
아래 원칙이 몸에 배어있어 의식하지 않아도 자연스럽게 적용됩니다.

⚠ 현재 날짜: ${today}
- 제목·본문에 연도를 쓸 때 반드시 ${year}년 기준으로 작성하세요
- "2024년 최신판", "2023년 기준" 같은 이미 지난 연도 표현 절대 금지
- 원본 자료에 연도가 명시되지 않은 수치(기준액, 법령 수치 등)는 본문에 "※ 정확한 수치는 공식 기관에서 확인하세요" 안내를 1회 포함할 것

${persona    ? `### 작가 페르소나\n${persona}\n`   : ''}
${narrative  ? `### 서사 기법\n${narrative}\n`     : ''}
${emotional  ? `### 감정 흐름\n${emotional}\n`     : ''}
${cta        ? `### CTA 원칙\n${cta}\n`            : ''}
${feedback   ? `### 최근 피드백 (반드시 반영)\n${feedback}\n` : ''}

목표 문체: ${toneDesc[tone] ?? '친근하고 대화체'}
목표 분량: ${lengthDesc[length] ?? '800~1500자'}
출력: 마크다운 블로그 글만`;

  const userPrompt = `아래 아웃라인을 바탕으로 블로그 초고를 작성하세요.

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

--- 원본 내용 (참고용) ---
${content.slice(0, 3000)}
${title ? `\n참고 제목: ${title}` : ''}

5막 구조를 따르되, 각 막을 생동감 있게 살려주세요. 마크다운 형식으로 제목(#)부터 시작합니다.`;

  const draft = await callLLM(model, apiKeys, systemPrompt,
    [{ role: 'user', content: userPrompt }], 3500, 0.8);
  return { draft };
}

// ── Agent 3: 편집장 ────────────────────────────────────────────────────────────
export interface EditorScores {
  hook: number;         // 1. 훅 강도
  structure: number;    // 2. 서사 구조
  showTell: number;     // 3. Show/Tell 밸런스
  rhythm: number;       // 4. 문장 리듬
  emotionalFlow: number;// 5. 감정 흐름
  cta: number;          // 6. CTA
  forbidden: number;    // 7. 금지 표현 (10 = 없음)
  closing: number;      // 8. 클로징 에코
  freshness: number;    // 9. 정보 신선도 (연도/날짜 적절성)
  uniqueness: number;   // 10. 독창성
}

async function runEditor(
  model: string, apiKeys: Record<string, string>,
  draft: string,
): Promise<{ finalContent: string; editorNotes: string[]; scores: EditorScores; totalScore: number }> {
  const rubric  = readWikiFile('blog/evaluation-rubric.md');
  const persona = readWikiFile('blog/writer-persona.md');

  const systemPrompt = `당신은 15년 경력의 디지털 미디어 편집장입니다.
작가의 의도를 살리면서 약점만 외과적으로 수정합니다. 전체 재작성 금지.

채점 기준 (각 10점 만점, 총 100점):
${rubric || `1.훅강도 2.서사구조 3.Show/Tell 4.문장리듬 5.감정흐름 6.CTA 7.금지표현 8.클로징에코 9.정보신선도 10.독창성`}

금지 표현 (절대 없어야 함 — 있으면 7번 항목 감점):
${persona ? persona.split('절대 사용 금지')[1]?.split('##')[0]?.slice(0, 300) ?? '' : '지금까지 알아보았습니다, 도움이 됐으면 좋겠습니다'}

정보 신선도(9번) 감점 기준:
- 이미 지난 연도("2024년 최신", "2023년 기준" 등)가 제목/본문에 있으면 -3점
- 날짜 없이 "최신" 단어만 사용 시 -1점`;

  const userPrompt = `아래 초고를 채점하고 편집하세요.
7점 미만 항목만 수정합니다 (전체 재작성 금지).

---초고---
${draft}

출력 형식 (JSON):
{
  "scores": {
    "hook": 0~10,
    "structure": 0~10,
    "showTell": 0~10,
    "rhythm": 0~10,
    "emotionalFlow": 0~10,
    "cta": 0~10,
    "forbidden": 0~10,
    "closing": 0~10,
    "freshness": 0~10,
    "uniqueness": 0~10
  },
  "totalScore": 0~100,
  "editorNotes": ["항목명 N점: 수정 이유 또는 '수정 없음'"],
  "finalContent": "수정된 최종 마크다운 전체 (수정 없으면 원문 그대로)"
}`;

  const raw = await callLLM(model, apiKeys, systemPrompt,
    [{ role: 'user', content: userPrompt }], 4500, 0.2, true);

  const parsed = safeParseJson<{
    finalContent?: string;
    editorNotes?: string[];
    scores?: Partial<EditorScores>;
    totalScore?: number;
  }>(raw, {});

  const scores: EditorScores = {
    hook:          parsed.scores?.hook          ?? 0,
    structure:     parsed.scores?.structure     ?? 0,
    showTell:      parsed.scores?.showTell      ?? 0,
    rhythm:        parsed.scores?.rhythm        ?? 0,
    emotionalFlow: parsed.scores?.emotionalFlow ?? 0,
    cta:           parsed.scores?.cta           ?? 0,
    forbidden:     parsed.scores?.forbidden     ?? 0,
    closing:       parsed.scores?.closing       ?? 0,
    freshness:     parsed.scores?.freshness     ?? 0,
    uniqueness:    parsed.scores?.uniqueness    ?? 0,
  };
  const totalScore = parsed.totalScore
    ?? Object.values(scores).reduce((a, b) => a + b, 0);

  return {
    finalContent: parsed.finalContent ?? draft,
    editorNotes:  parsed.editorNotes  ?? [],
    scores,
    totalScore,
  };
}

// ── Journal 자동 저장 ──────────────────────────────────────────────────────────
async function saveJournal(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  params: {
    keyword: string;
    titleUsed: string;
    model: string;
    wordCount: number;
    tone: string;
    length: string;
    outline: Outline;
    editorNotes: string[];
    steps: AgentStep[];
  },
): Promise<void> {
  const { keyword, titleUsed, model, wordCount, tone, length, outline, editorNotes, steps } = params;
  const today = new Date().toISOString().slice(0, 10);

  // 마크다운 일지 내용
  const content = `# ${titleUsed}

**날짜**: ${today}
**키워드**: ${keyword || '—'}
**모델**: ${model}
**최종 분량**: ${wordCount.toLocaleString()}자
**문체**: ${tone} / **길이**: ${length}

## 아웃라인

- **독자 고통**: ${outline.painPoint || '—'}
- **독창적 앵글**: ${outline.uniqueAngle || '—'}
- **훅 유형**: ${outline.hookType || '—'}
- **감정 흐름**: ${outline.emotionalArc || '—'}

| 막 | 내용 |
|---|---|
| 1막 | ${outline.structure?.act1 || '—'} |
| 2막 | ${outline.structure?.act2 || '—'} |
| 3막 | ${outline.structure?.act3 || '—'} |
| 4막 | ${outline.structure?.act4 || '—'} |
| 5막 | ${outline.structure?.act5 || '—'} |

## 편집 기록

${editorNotes.length ? editorNotes.map(n => `- ${n}`).join('\n') : '- (수정 없음)'}

## 에이전트 실행

${steps.map(s => `- ${s.agent} ${s.status === 'done' ? '✓' : '✗'} — ${s.summary}`).join('\n')}
`;

  await supabase.from('user_wiki_pages').insert({
    user_id:  userId,
    type:     'journal',
    category: 'log',
    topic:    (keyword || titleUsed).slice(0, 80),
    title:    `[일지] ${titleUsed}`,
    content,
    metadata: { keyword, title_used: titleUsed, model, word_count: wordCount, tone, length, outline, steps },
  });
}

// ── Knowledge 자동 추출·저장 ────────────────────────────────────────────────────
// 완성된 글에서 LLM이 핵심 지식을 추출해 knowledge 페이지로 자동 저장.
// 같은 topic이 이미 있으면 content를 병합 업데이트(append), 없으면 신규 생성.
async function saveKnowledge(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  model: string,
  apiKeys: Record<string, string>,
  finalContent: string,
  keyword: string,
): Promise<void> {
  // LLM으로 지식 구조 추출
  const systemPrompt = `당신은 콘텐츠에서 재사용 가능한 지식을 추출하는 전문가입니다.
블로그 글을 읽고 다음 글을 쓸 때 참고할 수 있는 핵심 지식을 JSON으로 뽑아냅니다.`;

  const userPrompt = `아래 블로그 글에서 지식을 추출하세요.

---글---
${finalContent.slice(0, 3000)}

출력 (JSON):
{
  "category": "finance | psychology | health | tech | society | general 중 하나",
  "topic": "소문자-영문-슬러그 (예: private-loans, loss-aversion)",
  "title": "한글 주제명 (예: 사모대출 — 핵심 지식)",
  "tags": ["태그1", "태그2", "태그3"],
  "keyFacts": ["수치나 팩트1", "수치나 팩트2"],
  "painPoints": ["독자 고통1", "독자 고통2"],
  "angles": ["차별화 앵글1", "차별화 앵글2"],
  "cautions": ["주의사항 또는 팩트체크 포인트"]
}`;

  const raw = await callLLM(
    model, apiKeys, systemPrompt,
    [{ role: 'user', content: userPrompt }],
    800, 0.1, true,
  );

  interface KnowledgeExtract {
    category?: string; topic?: string; title?: string; tags?: string[];
    keyFacts?: string[]; painPoints?: string[]; angles?: string[]; cautions?: string[];
  }
  const extracted = safeParseJson<KnowledgeExtract>(raw, {});
  if (!extracted.topic) return;

  const category  = extracted.category  ?? 'general';
  const topic     = extracted.topic;
  const title     = extracted.title     ?? keyword;
  const tags      = extracted.tags      ?? [];
  const today     = new Date().toISOString().slice(0, 10);

  // 마크다운 knowledge 페이지 내용
  const content = `---
category: ${category}
topic: ${topic}
tags: [${tags.join(', ')}]
updated: ${today}
---

# ${title}

## 핵심 수치 / 팩트
${(extracted.keyFacts ?? []).map(f => `- ${f}`).join('\n') || '- (없음)'}

## 독자 고통 포인트
${(extracted.painPoints ?? []).map(p => `- ${p}`).join('\n') || '- (없음)'}

## 차별화 앵글
${(extracted.angles ?? []).map(a => `- ${a}`).join('\n') || '- (없음)'}

## 주의 / 팩트체크 포인트
${(extracted.cautions ?? []).map(c => `- ${c}`).join('\n') || '- (없음)'}
`;

  // 같은 topic 페이지가 이미 있으면 content append, 없으면 신규 생성
  const { data: existing } = await supabase
    .from('user_wiki_pages')
    .select('id, content')
    .eq('user_id', userId)
    .eq('type', 'knowledge')
    .eq('topic', topic)
    .single();

  if (existing) {
    const appendedContent = existing.content
      + `\n\n---\n\n## 업데이트 (${today})\n\n`
      + (extracted.keyFacts ?? []).map(f => `- ${f}`).join('\n');
    await supabase
      .from('user_wiki_pages')
      .update({ content: appendedContent, tags, updated_at: new Date().toISOString() })
      .eq('id', existing.id);
  } else {
    await supabase.from('user_wiki_pages').insert({
      user_id: userId, type: 'knowledge',
      category, topic, title, content, tags,
      metadata: { auto_extracted: true, source_keyword: keyword, extracted_at: today },
    });
  }
}

// ── Synthesis 내부 호출 (topics[] 모드) ────────────────────────────────────────
// /api/wiki/synthesis를 외부 fetch 대신 직접 함수로 인라인하여 레이턴시 절약
async function runInternalSynthesis(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  model: string,
  apiKeys: Record<string, string>,
  topics: string[],
  synthesisGoal: string,
): Promise<{ synthesis: SynthesisOutput; pagesUsed: number; warning?: string }> {
  // knowledge 페이지 로드
  const { data: rawPages, error } = await supabase
    .from('user_wiki_pages')
    .select('id, type, category, topic, title, content, tags')
    .eq('user_id', userId)
    .in('type', ['knowledge', 'source'])
    .in('topic', topics)
    .order('updated_at', { ascending: false });
  if (error) throw error;

  // topic 중복 제거
  const pageMap = new Map<string, { id: string; type: string; category: string; topic: string; title: string; content: string; tags: string[] }>();
  for (const p of (rawPages ?? [])) {
    if (!pageMap.has(p.topic)) pageMap.set(p.topic, p);
  }
  const pages = Array.from(pageMap.values());
  if (pages.length === 0) throw new Error('요청한 topic에 해당하는 knowledge 페이지가 없습니다');

  const missingTopics = topics.filter(t => !pages.map(p => p.topic).includes(t));
  const warning = pages.length === 1
    ? '1개 소재만 찾혔습니다. 단일 소재 심화 브리핑으로 진행합니다.'
    : missingTopics.length > 0
      ? `${missingTopics.join(', ')} topic을 찾지 못해 나머지 ${pages.length}개로 진행합니다.`
      : undefined;

  const pageBlocks = pages
    .map((p, i) => `### [소재 ${i + 1}] ${p.title}  (${p.category} / ${p.topic})\n${p.content.slice(0, 1200)}`)
    .join('\n\n---\n\n');

  const jsonInstruction = '\n\n반드시 유효한 JSON만 출력하세요. 마크다운 코드블록 없이.';
  const systemPrompt = `당신은 여러 주제를 하나의 강력한 스토리로 엮는 전문 에디터입니다.

핵심 임무: 인과관계 발견 (나열 금지)
- 금지: "A도 있고 B도 있고 C도 있다"
- 목표: "A가 일어났기 때문에 → B가 폭증했고 → 결국 C가 피해를 입었다"
- 독자가 "아, 이것들이 연결되어 있었구나!" 하는 순간을 설계하세요.

인과관계 발견 3단계:
1. 각 주제에서 핵심 메커니즘(작동 원리, 수치)을 추출
2. 메커니즘들 사이의 연결 고리를 찾기 (공통 원인, 증폭 효과, 연쇄 부작용)
3. 연결 고리를 독자의 실제 삶/걱정과 연결`;

  const userPrompt = `목표: ${synthesisGoal}

아래 ${pages.length}개 소재를 하나의 블로그 글 소재로 통합하세요.

${pageBlocks}

---

출력 (JSON):
{
  "causalChain": [
    {
      "from": "소재-topic-slug",
      "to": "소재-topic-slug",
      "mechanism": "A가 B를 일으키는 구체적 메커니즘",
      "evidence": "뒷받침 팩트/수치 (없으면 '직접 근거 없음 — 추론'으로 명시)",
      "strength": "strong | moderate | weak"
    }
  ],
  "centralTension": "독자가 느낄 핵심 긴장감 (2~3문장)",
  "synthesizedContent": "통합 소재 브리핑 — 인과관계 서술 중심, 600~900자. 수치·사례·인과 메커니즘 포함. 단순 나열 금지.",
  "suggestedTitle": "블로그 제목 — 클릭 유도 + SEO + 인과관계 암시 (40자 이내)",
  "emotionalArc": "긴장→공감→놀람→안도→행동 각 단계 감정 포인트",
  "uniqueAngle": "이 소재들을 통합했을 때만 나오는 독창적 관점 (1~2문장)"
}`;

  let rawResult = '';
  if (model.startsWith('claude')) {
    const client = new Anthropic({ apiKey: apiKeys.anthropic });
    const res = await client.messages.create({
      model, max_tokens: 2200, temperature: 0.4,
      system: systemPrompt + jsonInstruction,
      messages: [{ role: 'user', content: userPrompt }],
    });
    rawResult = res.content[0]?.type === 'text' ? res.content[0].text : '';
  } else if (model.startsWith('qwen')) {
    const res = await fetch('https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKeys.qwen}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model, max_tokens: 2200, temperature: 0.4,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt + jsonInstruction },
          { role: 'user',   content: userPrompt },
        ],
      }),
    });
    const data = await res.json();
    rawResult = data.choices?.[0]?.message?.content ?? '';
  } else {
    const ai = new GoogleGenAI({ apiKey: apiKeys.gemini });
    const response = await ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      config: {
        systemInstruction: systemPrompt + jsonInstruction,
        maxOutputTokens: 2200, temperature: 0.4,
        responseMimeType: 'application/json',
      },
    });
    rawResult = response.text ?? '';
  }

  const parsed = safeParseJson<Partial<SynthesisOutput>>(rawResult, {});
  const synthesis: SynthesisOutput = {
    causalChain:        Array.isArray(parsed.causalChain) ? parsed.causalChain : [],
    centralTension:     parsed.centralTension     ?? '',
    synthesizedContent: parsed.synthesizedContent ?? '',
    suggestedTitle:     parsed.suggestedTitle     ?? '',
    emotionalArc:       parsed.emotionalArc       ?? '',
    uniqueAngle:        parsed.uniqueAngle        ?? '',
  };
  return { synthesis, pagesUsed: pages.length, warning };
}

// ── POST Handler ───────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const {
      content: rawContent = '',
      title = '',
      tone = 'friendly',
      length = 'medium',
      llmModelId,
      topics,                // 소재 병합 모드 — string[] (선택)
      synthesisGoal = '블로그 글 소재 통합',
    } = await req.json();

    const isSynthesisMode = Array.isArray(topics) && topics.length >= 2;

    if (!rawContent && !isSynthesisMode) {
      return NextResponse.json(
        { error: '내용(content)이 필요합니다. 또는 topics[] 배열(2개 이상)을 제공하면 소재 병합 모드로 실행됩니다.' },
        { status: 400 },
      );
    }

    // 사용자 API 키 로드
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });

    const meta    = user.user_metadata ?? {};
    const apiKeys = {
      gemini:    meta.gemini_api_key    ?? '',
      anthropic: meta.anthropic_api_key ?? '',
      qwen:      meta.qwen_api_key      ?? '',
    };

    let model = llmModelId ?? '';
    if (!model) {
      if (apiKeys.gemini)         model = 'gemini-2.5-flash';
      else if (apiKeys.anthropic) model = 'claude-sonnet-4-6';
      else if (apiKeys.qwen)      model = 'qwen3.5-plus';
      else return NextResponse.json(
        { error: 'API 키가 없습니다. 설정 페이지에서 Gemini, Claude, 또는 Qwen API 키를 등록해주세요.' },
        { status: 400 },
      );
    }

    const steps: AgentStep[] = [];
    let synthesisResult: SynthesisOutput | null = null;

    // ── [Synthesis] 소재 병합 모드 — topics[] 제공 시 실행 ────────────────────
    let content = rawContent;
    let effectiveTitle = title;

    if (isSynthesisMode) {
      try {
        const result = await runInternalSynthesis(
          supabase, user.id, model, apiKeys, topics as string[], synthesisGoal,
        );
        synthesisResult = result.synthesis;
        // synthesis 결과를 content / title 로 사용
        content = result.synthesis.synthesizedContent || rawContent;
        if (!effectiveTitle && result.synthesis.suggestedTitle) {
          effectiveTitle = result.synthesis.suggestedTitle;
        }
        steps.push({
          agent: 'Synthesis Agent',
          status: 'done',
          summary: [
            `${result.pagesUsed}개 소재 통합`,
            `인과 체인 ${result.synthesis.causalChain.length}개`,
            result.warning ? `⚠ ${result.warning}` : '',
          ].filter(Boolean).join(' / '),
        });
      } catch (e) {
        const msg = (e as Error).message;
        steps.push({ agent: 'Synthesis Agent', status: 'error', summary: msg });
        // synthesis 실패 시 rawContent로 폴백 (content가 없으면 에러)
        if (!rawContent) {
          return NextResponse.json({ error: `소재 병합 실패: ${msg}`, steps }, { status: 500 });
        }
      }
    }

    // ── Agent 0: Knowledge Gatherer (DB 쿼리, LLM 없음) ───────────────────────
    const keyword = effectiveTitle || title || content.slice(0, 60);
    let knowledgeContext = '';
    try {
      const kg = await runKnowledgeGatherer(supabase, user.id, keyword);
      knowledgeContext = kg.knowledgeContext;
      steps.push({
        agent: 'Knowledge Gatherer',
        status: 'done',
        summary: kg.pageCount > 0
          ? `축적 지식 ${kg.pageCount}개 페이지 로드`
          : '축적 지식 없음 — 기본 모드로 진행',
      });
    } catch (e) {
      // knowledge 로드 실패는 치명적이지 않음 — 빈 context로 계속 진행
      steps.push({ agent: 'Knowledge Gatherer', status: 'error', summary: (e as Error).message });
    }

    // ── Agent 1: 리서처 ────────────────────────────────────────────────────────
    let outline: Outline;
    try {
      const result = await runResearcher(model, apiKeys, content, effectiveTitle, tone, length, knowledgeContext);
      outline = result.outline;
      steps.push({ agent: '리서처', status: 'done', summary: `앵글: ${outline.uniqueAngle?.slice(0, 50) ?? '완료'}` });
    } catch (e) {
      const msg = (e as Error).message;
      steps.push({ agent: '리서처', status: 'error', summary: msg });
      return NextResponse.json({ error: `리서처 실패: ${msg}`, steps }, { status: 500 });
    }

    // ── Agent 2: 작가 ──────────────────────────────────────────────────────────
    let draft: string;
    try {
      const result = await runWriter(model, apiKeys, content, effectiveTitle, tone, length, outline);
      draft = result.draft;
      steps.push({ agent: '작가', status: 'done', summary: `초고 ${draft.length}자 작성 완료` });
    } catch (e) {
      const msg = (e as Error).message;
      steps.push({ agent: '작가', status: 'error', summary: msg });
      return NextResponse.json({ error: `작가 실패: ${msg}`, steps }, { status: 500 });
    }

    // ── Agent 3: 편집장 ────────────────────────────────────────────────────────
    let finalContent: string;
    let editorNotes: string[];
    let scores: EditorScores | null = null;
    let totalScore: number | null   = null;
    try {
      const result = await runEditor(model, apiKeys, draft);
      finalContent = result.finalContent;
      editorNotes  = result.editorNotes;
      scores       = result.scores;
      totalScore   = result.totalScore;
      steps.push({
        agent: '편집장',
        status: 'done',
        summary: `${totalScore}점 / ${editorNotes.length}개 항목 수정 / 최종 ${finalContent.length}자`,
      });
    } catch (e) {
      // 편집장 실패 시 작가 초고를 최종본으로 사용
      finalContent = draft;
      editorNotes  = ['편집장 실패 — 작가 초고를 최종본으로 사용'];
      steps.push({ agent: '편집장', status: 'error', summary: (e as Error).message });
    }

    const titleMatch     = finalContent.match(/^#\s+(.+)$/m);
    const extractedTitle = titleMatch ? titleMatch[1] : effectiveTitle || title || '블로그 포스트';

    // 일지 자동 저장 (fire-and-forget)
    saveJournal(supabase, user.id, {
      keyword,
      titleUsed:   extractedTitle,
      model,
      wordCount:   finalContent.length,
      tone,
      length,
      outline,
      editorNotes,
      steps,
    }).catch(e => console.error('[wiki journal save]', e));

    // Knowledge 자동 추출·저장 (fire-and-forget)
    saveKnowledge(supabase, user.id, model, apiKeys, finalContent, keyword)
      .catch(e => console.error('[wiki knowledge save]', e));

    return NextResponse.json({
      content: finalContent,
      title:   extractedTitle,
      outline,
      editorNotes,
      scores,
      totalScore,
      steps,
      model,
      ...(synthesisResult ? { synthesis: synthesisResult } : {}),
    });
  } catch (err: unknown) {
    console.error('[blog/write-agent]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '파이프라인 실행 실패' },
      { status: 500 },
    );
  }
}
