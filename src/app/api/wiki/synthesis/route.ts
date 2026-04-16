/**
 * Synthesis Agent — 여러 knowledge 페이지를 인과관계로 엮어 통합 소재 생성
 *
 * POST /api/wiki/synthesis
 * Body: { topics: string[], synthesisGoal?: string }
 *
 * 핵심 과제: "나열"이 아닌 "인과관계 발견"
 * 예) 금리 상승 → 사모대출 폭증 → 중산층 집중 피해
 *     각 주제가 어떻게 연결되는지 LLM이 발견하고 하나의 감정 호로 엮는다.
 *
 * 응답:
 *   synthesis.synthesizedContent — write-agent의 content 파라미터로 바로 사용 가능
 *   synthesis.causalChain        — 인과관계 지도 (디버깅·UI 표시용)
 *   synthesis.suggestedTitle     — 제안 제목
 *   synthesis.emotionalArc       — 감정 흐름 설계
 *   synthesis.uniqueAngle        — 통합했을 때만 나오는 독창적 관점
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { GoogleGenAI } from '@google/genai';
import Anthropic from '@anthropic-ai/sdk';

// ── 타입 ───────────────────────────────────────────────────────────────────────
interface KnowledgePage {
  id: string;
  type: string;
  category: string;
  topic: string;
  title: string;
  content: string;
  tags: string[];
}

export interface CausalLink {
  from: string;
  to: string;
  mechanism: string;
  evidence: string;
}

export interface SynthesisOutput {
  causalChain: CausalLink[];
  centralTension: string;
  synthesizedContent: string;
  suggestedTitle: string;
  emotionalArc: string;
  uniqueAngle: string;
}

// ── LLM 공통 호출 ──────────────────────────────────────────────────────────────
async function callLLM(
  model: string,
  apiKeys: Record<string, string>,
  system: string,
  userMsg: string,
  maxTokens = 2000,
): Promise<string> {
  const isClaude = model.startsWith('claude');
  const isQwen   = model.startsWith('qwen');
  const jsonInstruction = '\n\n반드시 유효한 JSON만 출력하세요. 마크다운 코드블록 없이.';

  if (isClaude) {
    const client = new Anthropic({ apiKey: apiKeys.anthropic });
    const res = await client.messages.create({
      model, max_tokens: maxTokens, temperature: 0.4,
      system: system + jsonInstruction,
      messages: [{ role: 'user', content: userMsg }],
    });
    return res.content[0]?.type === 'text' ? res.content[0].text : '';
  }

  if (isQwen) {
    const res = await fetch('https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKeys.qwen}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model, max_tokens: maxTokens, temperature: 0.4,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system + jsonInstruction },
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
      systemInstruction: system + jsonInstruction,
      maxOutputTokens: maxTokens,
      temperature: 0.4,
      responseMimeType: 'application/json',
    },
  });
  return response.text ?? '';
}

function safeJson<T>(raw: string, fallback: T): T {
  const cleaned = raw.replace(/```json?\s*/gi, '').replace(/```\s*/g, '').trim();
  const match   = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return fallback;
  try { return JSON.parse(match[0]) as T; }
  catch { return fallback; }
}

// ── Synthesis Agent 핵심 로직 ──────────────────────────────────────────────────
async function runSynthesisAgent(
  model: string,
  apiKeys: Record<string, string>,
  pages: KnowledgePage[],
  synthesisGoal: string,
): Promise<SynthesisOutput> {
  // 각 페이지를 소재 블록으로 변환 (최대 1200자 — 너무 길면 핵심이 묻힘)
  const pageBlocks = pages
    .map((p, i) =>
      `### [소재 ${i + 1}] ${p.title}  (${p.category} / ${p.topic})\n${p.content.slice(0, 1200)}`,
    )
    .join('\n\n---\n\n');

  const systemPrompt = `당신은 여러 주제를 하나의 강력한 스토리로 엮는 전문 에디터입니다.

핵심 임무: 인과관계 발견 (나열 금지)
- 금지: "A도 있고 B도 있고 C도 있다"
- 목표: "A가 일어났기 때문에 → B가 폭증했고 → 결국 C가 피해를 입었다"
- 독자가 "아, 이것들이 연결되어 있었구나!" 하는 순간을 설계하세요.

인과관계 발견 3단계:
1. 각 주제에서 핵심 메커니즘(작동 원리, 수치)을 추출
2. 메커니즘들 사이의 연결 고리를 찾기 (공통 원인, 증폭 효과, 연쇄 부작용)
3. 연결 고리를 독자의 실제 삶/걱정과 연결

품질 기준:
- causalChain 각 링크에는 반드시 구체적 메커니즘과 수치 근거가 있어야 함
- synthesizedContent는 인과 서술 중심 — 단순 팩트 나열이 되면 실패
- 연결이 억지스러우면 솔직하게 "약한 연결"로 표시할 것`;

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
      "mechanism": "A가 B를 일으키는 구체적 메커니즘 — 어떤 압력/유인/구조가 연결을 만드는가",
      "evidence": "이를 뒷받침하는 팩트 또는 수치 (없으면 '직접 근거 없음 — 추론'으로 명시)",
      "strength": "strong | moderate | weak"
    }
  ],
  "centralTension": "독자가 느낄 핵심 긴장감 — 이 글이 왜 지금 읽혀야 하는가 (2~3문장)",
  "synthesizedContent": "통합 소재 브리핑 — 인과관계 서술 중심, 600~900자. write-agent의 content 입력으로 사용됨. 수치·사례·인과 메커니즘 포함. 단순 나열 금지.",
  "suggestedTitle": "블로그 제목 — 클릭 유도 + SEO + 인과관계 암시 (40자 이내)",
  "emotionalArc": "긴장→공감→놀람→안도→행동 각 단계에 배치할 감정 포인트 (한 줄씩)",
  "uniqueAngle": "이 소재들을 통합했을 때만 나오는 독창적 관점 (1~2문장) — 각 주제를 개별로 다뤘을 때는 보이지 않던 것"
}`;

  const raw = await callLLM(model, apiKeys, systemPrompt, userPrompt, 2200);

  const parsed = safeJson<Partial<SynthesisOutput>>(raw, {});

  return {
    causalChain:        Array.isArray(parsed.causalChain) ? parsed.causalChain : [],
    centralTension:     parsed.centralTension     ?? '',
    synthesizedContent: parsed.synthesizedContent ?? '',
    suggestedTitle:     parsed.suggestedTitle     ?? '',
    emotionalArc:       parsed.emotionalArc       ?? '',
    uniqueAngle:        parsed.uniqueAngle         ?? '',
  };
}

// ── POST Handler ───────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });

    const body = await req.json();
    const topics: string[]   = Array.isArray(body.topics) ? body.topics : [];
    const synthesisGoal: string = typeof body.synthesisGoal === 'string'
      ? body.synthesisGoal
      : '블로그 글 소재 통합';

    if (topics.length < 2) {
      return NextResponse.json(
        { error: '최소 2개 이상의 topic이 필요합니다 (예: ["private-loans", "loss-aversion"])' },
        { status: 400 },
      );
    }
    if (topics.length > 6) {
      return NextResponse.json(
        { error: 'topic은 최대 6개까지 가능합니다' },
        { status: 400 },
      );
    }

    // API 키 결정
    const meta    = user.user_metadata ?? {};
    const apiKeys = {
      gemini:    meta.gemini_api_key    ?? '',
      anthropic: meta.anthropic_api_key ?? '',
      qwen:      meta.qwen_api_key      ?? '',
    };
    let model = '';
    if (apiKeys.gemini)         model = 'gemini-2.5-flash';
    else if (apiKeys.anthropic) model = 'claude-sonnet-4-6';
    else if (apiKeys.qwen)      model = 'qwen3.5-plus';
    else return NextResponse.json({ error: 'API 키가 없습니다' }, { status: 400 });

    // ── Step 1: 요청된 topic들의 knowledge 페이지 로드 ────────────────────────
    const { data: rawPages, error: dbErr } = await supabase
      .from('user_wiki_pages')
      .select('id, type, category, topic, title, content, tags')
      .eq('user_id', user.id)
      .in('type', ['knowledge', 'source'])
      .in('topic', topics)
      .order('updated_at', { ascending: false });
    if (dbErr) throw dbErr;

    // topic 중복 제거 — 같은 topic은 가장 최신 1개만 사용
    const pageMap = new Map<string, KnowledgePage>();
    for (const p of (rawPages ?? [])) {
      if (!pageMap.has(p.topic)) pageMap.set(p.topic, p as KnowledgePage);
    }
    const pages = Array.from(pageMap.values());

    const foundTopics   = pages.map(p => p.topic);
    const missingTopics = topics.filter(t => !foundTopics.includes(t));

    if (pages.length === 0) {
      return NextResponse.json(
        {
          error:
            '요청한 topic에 해당하는 knowledge 페이지가 없습니다. ' +
            '먼저 해당 주제로 글을 작성하거나 소재를 수집(ingest)해주세요.',
          missingTopics,
        },
        { status: 404 },
      );
    }

    // 1개만 찾힌 경우 경고는 하되 진행 (단일 소재 심화도 의미 있음)
    const warning = pages.length === 1
      ? '1개 소재만 찾혔습니다. 인과관계보다 단일 소재 심화 브리핑이 생성됩니다.'
      : missingTopics.length > 0
        ? `${missingTopics.join(', ')} topic을 찾지 못했습니다. 나머지 ${pages.length}개로 진행합니다.`
        : undefined;

    // ── Step 2: Synthesis Agent 실행 ─────────────────────────────────────────
    const synthesis = await runSynthesisAgent(model, apiKeys, pages, synthesisGoal);

    return NextResponse.json({
      ok:            true,
      synthesis,
      pagesUsed:     pages.length,
      foundTopics,
      missingTopics,
      warning,
      model,
    });

  } catch (err: unknown) {
    console.error('[wiki/synthesis]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '합성 실패' },
      { status: 500 },
    );
  }
}
