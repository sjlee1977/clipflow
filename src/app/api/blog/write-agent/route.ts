/**
 * 블로그 멀티에이전트 글쓰기 파이프라인
 *
 * POST /api/blog/write-agent
 *
 * 3명의 전문가 에이전트가 순서대로 하나의 글을 완성한다:
 *   Agent 1 (리서처)  : 주제 분석 → 5막 아웃라인 설계
 *   Agent 2 (작가)    : 아웃라인 → 초고 작성
 *   Agent 3 (편집장)  : 초고 → 루브릭 채점 → 약점 수정 → 최종본
 *
 * Body:
 *   content       원본 내용/주제 (필수)
 *   title         참고 제목 (선택)
 *   tone          문체 — 'friendly' | 'professional' | 'casual' | 'educational'
 *   length        분량 — 'short' | 'medium' | 'long'
 *   llmModelId    사용할 AI 모델 (없으면 자동 선택)
 */
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase-server';
import fs from 'fs';
import path from 'path';

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

// ── Agent 1: 리서처 ────────────────────────────────────────────────────────────
async function runResearcher(
  model: string, apiKeys: Record<string, string>,
  content: string, title: string, tone: string, length: string,
): Promise<{ outline: Outline }> {
  const structure = readWikiFile('blog/structure.md');
  const hooks     = readWikiFile('blog/hook-writing.md');

  const toneDesc: Record<string, string> = {
    friendly: '친근하고 대화체', professional: '전문적이고 격식체',
    casual: '편안하고 자유로운', educational: '교육적이고 설명적인',
  };
  const lengthDesc: Record<string, string> = {
    short: '500~800자', medium: '800~1500자', long: '1500~3000자',
  };

  const systemPrompt = `당신은 10년 경력의 콘텐츠 전략가입니다.
주어진 내용을 분석하여 최고 품질의 블로그 아웃라인을 설계합니다.

참고할 구조 원칙:
${structure || '5막 구조: 훅 → 갈등 → 반전 → 증명 → 해소'}

훅 유형:
${hooks || 'A형(도발적 질문), B형(충격 수치), C형(착각 지적)'}

목표 문체: ${toneDesc[tone] ?? '친근하고 대화체'}
목표 분량: ${lengthDesc[length] ?? '800~1500자'}`;

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

  const systemPrompt = `당신은 10년 경력의 블로그 전문 작가입니다.
아래 원칙이 몸에 배어있어 의식하지 않아도 자연스럽게 적용됩니다.

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
async function runEditor(
  model: string, apiKeys: Record<string, string>,
  draft: string,
): Promise<{ finalContent: string; editorNotes: string[] }> {
  const rubric  = readWikiFile('blog/evaluation-rubric.md');
  const persona = readWikiFile('blog/writer-persona.md');

  const systemPrompt = `당신은 15년 경력의 디지털 미디어 편집장입니다.
작가의 의도를 살리면서 약점만 외과적으로 수정합니다. 전체 재작성 금지.

채점 기준:
${rubric || `1.훅강도 2.서사구조 3.Show/Tell 4.문장리듬 5.감정흐름 6.CTA 7.금지표현 8.클로징에코`}

금지 표현 (절대 없어야 함):
${persona ? persona.split('절대 사용 금지')[1]?.split('##')[0]?.slice(0, 300) ?? '' : '지금까지 알아보았습니다, 도움이 됐으면 좋겠습니다'}`;

  const userPrompt = `아래 초고를 편집해주세요. 8개 항목 중 7점 미만인 부분만 수정합니다.

---초고---
${draft}

출력 형식 (JSON):
{
  "editorNotes": ["수정한 항목1: 이유", "수정한 항목2: 이유"],
  "finalContent": "수정된 최종 마크다운 전체"
}`;

  const raw = await callLLM(model, apiKeys, systemPrompt,
    [{ role: 'user', content: userPrompt }], 4500, 0.2, true);

  const parsed = safeParseJson<{ finalContent?: string; editorNotes?: string[] }>(raw, {});
  return {
    finalContent: parsed.finalContent ?? draft,
    editorNotes:  parsed.editorNotes  ?? [],
  };
}

// ── POST Handler ───────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const {
      content, title = '', tone = 'friendly', length = 'medium', llmModelId,
    } = await req.json();

    if (!content) {
      return NextResponse.json({ error: '내용이 필요합니다' }, { status: 400 });
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

    // ── Agent 1: 리서처 ────────────────────────────────────────────────────────
    let outline: Outline;
    try {
      const result = await runResearcher(model, apiKeys, content, title, tone, length);
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
      const result = await runWriter(model, apiKeys, content, title, tone, length, outline);
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
    try {
      const result = await runEditor(model, apiKeys, draft);
      finalContent = result.finalContent;
      editorNotes  = result.editorNotes;
      steps.push({ agent: '편집장', status: 'done', summary: `${editorNotes.length}개 항목 수정 / 최종 ${finalContent.length}자` });
    } catch (e) {
      // 편집장 실패 시 작가 초고를 최종본으로 사용
      finalContent = draft;
      editorNotes  = ['편집장 실패 — 작가 초고를 최종본으로 사용'];
      steps.push({ agent: '편집장', status: 'error', summary: (e as Error).message });
    }

    const titleMatch   = finalContent.match(/^#\s+(.+)$/m);
    const extractedTitle = titleMatch ? titleMatch[1] : title || '블로그 포스트';

    return NextResponse.json({
      content: finalContent,
      title:   extractedTitle,
      outline,
      editorNotes,
      steps,
      model,
    });
  } catch (err: unknown) {
    console.error('[blog/write-agent]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '파이프라인 실행 실패' },
      { status: 500 },
    );
  }
}
