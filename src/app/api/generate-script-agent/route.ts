/**
 * 대본 멀티에이전트 파이프라인
 * ViMax(역할분리) + FilmAgent(CoT 핸드오프) + YouTube Automation Agent(SEO) 패턴 적용
 *
 * POST /api/generate-script-agent
 *
 * 4개 에이전트 순서:
 *   Agent 1 — 감독  : 전략 설계 + CoT 이유 포함
 *   Agent 2 — 작가  : 감독 CoT 받아 초고 작성
 *   토론             : 감독 검토 → 작가 수정 (FilmAgent 1-round)
 *   Agent 3 — 프로듀서: 품질 점검 + 외과적 수정
 *   Agent 4 — SEO   : 제목/썸네일/설명/태그 패키지
 *
 * Body:
 *   topic      영상 주제 (필수)
 *   category   economy | psychology | horror | health | history | general
 *   model      gemini-2.5-flash | claude-* | qwen-* (기본: gemini-2.5-flash)
 *   tone       카테고리 고정 톤 or 사용자 선택
 *   minLength  최소 글자 수 (기본: 3000)
 *   apiKeys    { gemini?, anthropic?, qwen? }
 */
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase-server';
import fs from 'fs';
import path from 'path';

// ── Wiki 로더 ──────────────────────────────────────────────────────────────────
const WIKI_DIR   = path.join(process.cwd(), 'wiki', 'script');
const wikiCache  = new Map<string, string>();

async function readWiki(relativePath: string): Promise<string> {
  if (wikiCache.has(relativePath)) return wikiCache.get(relativePath)!;
  try {
    const content = await fs.promises.readFile(path.join(WIKI_DIR, relativePath), 'utf-8');
    wikiCache.set(relativePath, content);
    return content;
  } catch { return ''; }
}

async function getLatestFeedback(category: string): Promise<string> {
  try {
    const dir   = path.join(WIKI_DIR, 'feedback', category);
    const files = (await fs.promises.readdir(dir)).filter(f => f.endsWith('.md')).sort().reverse();
    if (!files.length) return '';
    return await fs.promises.readFile(path.join(dir, files[0]), 'utf-8');
  } catch { return ''; }
}

// ── LLM 호출 공통 함수 ─────────────────────────────────────────────────────────
async function callLLM(
  model:    string,
  apiKeys:  Record<string, string>,
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
  maxTokens = 4000,
  temperature = 0.5,
): Promise<string> {
  const isClaude = model.startsWith('claude');
  const isQwen   = model.startsWith('qwen');

  if (isClaude) {
    const key = apiKeys.anthropic;
    if (!key) throw new Error('Anthropic API 키가 없습니다 (설정 > API 키 확인)');
    const client  = new Anthropic({ apiKey: key });
    const sys     = messages.find(m => m.role === 'system')?.content ?? '';
    const userMsg = messages.filter(m => m.role !== 'system')
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));
    const res = await client.messages.create({
      model, max_tokens: maxTokens, temperature, system: sys, messages: userMsg,
    });
    return res.content[0]?.type === 'text' ? res.content[0].text : '';
  }

  if (isQwen) {
    const key = apiKeys.qwen;
    if (!key) throw new Error('Qwen API 키가 없습니다 (설정 > API 키 확인)');
    const res = await fetch('https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`Qwen 오류: ${data?.error?.message ?? JSON.stringify(data)}`);
    return data.choices?.[0]?.message?.content ?? '';
  }

  // Gemini — generate-script와 동일한 방식 사용
  const key = apiKeys.gemini;
  if (!key) throw new Error('Gemini API 키가 없습니다 (설정 > API 키 확인)');
  const ai       = new GoogleGenAI({ apiKey: key });
  const sys      = messages.find(m => m.role === 'system')?.content ?? '';
  const contents = messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role:  m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));
  const response = await ai.models.generateContent({
    model,
    contents,
    config: { systemInstruction: sys, maxOutputTokens: maxTokens, temperature },
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

// ── 카테고리 위키 로딩 ─────────────────────────────────────────────────────────
interface CategoryWiki {
  identity:            string;
  tone:                string;
  structure:           string;
  stageNotes:          string;
  principles:          string;
  feedback:            string;
  hookWriting:         string;
  narrativeTechniques: string;
  writerPersona:       string;
  emotionalFlow:       string;
  ctaWriting:          string;
  evaluationRubric:    string;
}

async function loadCategoryWiki(category: string): Promise<CategoryWiki> {
  const cat = category || 'general';
  const [
    identity, tone, structure, stageNotes, principles,
    hookWriting, narrativeTechniques, writerPersona,
    emotionalFlow, ctaWriting, evaluationRubric, feedback,
  ] = await Promise.all([
    readWiki(`${cat}/identity.md`),
    readWiki(`${cat}/tone.md`),
    readWiki('_shared/7-stage-structure.md'),
    readWiki(`${cat}/stage-notes.md`),
    readWiki(`${cat}/principles.md`),
    readWiki('hook-writing.md'),
    readWiki('narrative-techniques.md'),
    readWiki('writer-persona.md'),
    readWiki('emotional-flow.md'),
    readWiki('cta-writing.md'),
    readWiki('evaluation-rubric.md'),
    getLatestFeedback(cat),
  ]);
  return {
    identity, tone, structure, stageNotes, principles,
    hookWriting, narrativeTechniques, writerPersona,
    emotionalFlow, ctaWriting, evaluationRubric, feedback,
  };
}

// ── Agent 1: 감독 ──────────────────────────────────────────────────────────────
async function runDirector(
  model: string, apiKeys: Record<string, string>,
  topic: string, category: string, wiki: CategoryWiki,
  minLength: number,
): Promise<{ strategy: DirectorStrategy }> {

  // ── Perplexity 웹 리서치 (키 있을 때만) ─────────────────────────────────────
  let webResearch = '';
  if (apiKeys.perplexity) {
    try {
      const q = `"${topic}" 관련 최신 이슈, 통계, 실제 사례, 시청자 관심 포인트 (유튜브 콘텐츠 제작용, 2024~2025년)`;
      const { answer, citations } = await callPerplexity(apiKeys.perplexity, q, 700);
      if (answer) {
        webResearch = answer;
        if (citations.length) webResearch += `\n\n[출처] ${citations.join(' | ')}`;
      }
    } catch { /* Perplexity 실패 시 무시 */ }
  }

  const systemPrompt = `당신은 유튜브 콘텐츠 감독입니다. 100편 이상의 영상을 기획했습니다.
주제를 받으면 어떤 각도로 가야 바이럴이 되는지 즉시 압니다.
모든 결정에는 반드시 "왜(Why)"를 포함합니다. 이유 없는 지시는 작가가 판단할 수 없습니다.

채널 정체성:
${wiki.identity || `카테고리: ${category}`}

7단계 구조 참고:
${wiki.structure || '도입훅 → 팩트체크 → 개념번역 → 인사이트 → 시나리오 → 리스크 → 클로징'}

카테고리 특화 지침:
${wiki.stageNotes || '기본 구조 사용'}

훅 전략 원칙:
${wiki.hookWriting}

감정 흐름 설계 원칙:
${wiki.emotionalFlow}

JSON만 출력. 다른 텍스트 없음.`;

  const userPrompt = `주제: "${topic}"
카테고리: ${category}
목표 길이: 최소 ${minLength}자
${webResearch ? `\n## 실시간 웹 리서치 결과 (전략에 반드시 반영)\n${webResearch}\n` : ''}
이 주제로 최고의 유튜브 대본을 만들기 위한 전략을 설계하세요.

출력 형식:
{
  "coreAngle": "이 주제를 어떤 각도로 접근할지 (1~2문장)",
  "whyCoreAngle": "왜 이 각도인가 — 시청자 심리와 경쟁 채널 대비 이유",
  "hookStrategy": "첫 15초 훅 전략 (구체적 문장 or 장면 묘사)",
  "whyHook": "왜 이 훅인가",
  "stageplan": [
    { "stage": 1, "title": "단계명", "content": "이 단계에서 다룰 내용", "why": "왜 이 내용인가" },
    { "stage": 2, "title": "단계명", "content": "...", "why": "..." },
    { "stage": 3, "title": "단계명", "content": "...", "why": "..." },
    { "stage": 4, "title": "단계명", "content": "...", "why": "..." },
    { "stage": 5, "title": "단계명", "content": "...", "why": "..." },
    { "stage": 6, "title": "단계명", "content": "...", "why": "..." },
    { "stage": 7, "title": "단계명", "content": "...", "why": "..." }
  ],
  "targetEmotion": "시청자가 영상 끝에 느껴야 할 감정",
  "keyData": ["반드시 포함할 데이터/사례 1", "데이터/사례 2", "데이터/사례 3"]
}`;

  const raw = await callLLM(model, apiKeys,
    [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
    2500, 0.3,
  );

  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`감독 JSON 파싱 실패 — 응답: ${raw.slice(0, 200)}`);
  try {
    return { strategy: JSON.parse(match[0]) };
  } catch {
    throw new Error(`감독 JSON 파싱 오류 — ${match[0].slice(0, 200)}`);
  }
}

// ── Agent 2: 작가 ──────────────────────────────────────────────────────────────
async function runWriter(
  model: string, apiKeys: Record<string, string>,
  topic: string, category: string, wiki: CategoryWiki,
  strategy: DirectorStrategy, minLength: number,
): Promise<{ draft: string }> {

  const stageplanText = strategy.stageplan.map(s =>
    `${s.stage}단계 [${s.title}]: ${s.content}\n  → 감독 지시 이유: ${s.why}`
  ).join('\n\n');

  const systemPrompt = `당신은 유튜브 대본 전문 작가입니다.
감독의 전략과 이유를 완벽히 이해하고, 그 의도를 살려 실제 대본으로 구현합니다.

채널 정체성:
${wiki.identity || `카테고리: ${category}`}

톤 & 말투:
${wiki.tone || '친근한 반말 (해라체)'}

나레이터 페르소나 & 금지 표현:
${wiki.writerPersona}

훅 작성 원칙:
${wiki.hookWriting}

서사 기법:
${wiki.narrativeTechniques}

감정 흐름 설계:
${wiki.emotionalFlow}

CTA 작성 원칙:
${wiki.ctaWriting}

${wiki.principles && !wiki.principles.includes('비워둠') ? `축적된 원칙:\n${wiki.principles}` : ''}
${wiki.feedback ? `최근 피드백 (반드시 반영):\n${wiki.feedback}` : ''}

절대 규칙:
- 마크다운 없이 순수 텍스트만 (제목, 굵게, 기호 금지)
- 단락 구분은 줄바꿈만
- 존댓말/방송앵커 언어 금지
- 최소 ${minLength}자 이상 작성
- 모든 어려운 개념은 일상 비유로 치환
- 숫자 없는 주장 금지 (%, 날짜, 수치 필수)

대본만 출력. 단계 제목, 메모, 설명 없음.`;

  const userPrompt = `주제: "${topic}"

감독의 전략:
핵심 각도: ${strategy.coreAngle}
이유: ${strategy.whyCoreAngle}

훅 전략: ${strategy.hookStrategy}
이유: ${strategy.whyHook}

단계별 설계:
${stageplanText}

목표 감정: ${strategy.targetEmotion}
반드시 포함할 데이터: ${strategy.keyData.join(', ')}

위 감독 지시를 완벽히 따라 대본을 작성하세요. 최소 ${minLength}자.`;

  const draft = await callLLM(model, apiKeys,
    [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
    5000, 0.85,
  );

  return { draft };
}

// ── 감독 ↔ 작가 토론 (FilmAgent 1-round) ──────────────────────────────────────
async function runDiscussion(
  model: string, apiKeys: Record<string, string>,
  strategy: DirectorStrategy, draft: string, _category: string,
): Promise<{ revisedDraft: string; directorFeedback: string[] }> {

  // 감독 검토
  const directorReview = await callLLM(model, apiKeys, [{
    role: 'system',
    content: `당신은 엄격한 유튜브 콘텐츠 감독입니다. 초고를 검토하고 정확히 2~3개의 개선 지시만 내립니다.
모든 지시에는 반드시 이유를 포함합니다. JSON만 출력.`,
  }, {
    role: 'user',
    content: `원래 전략:
핵심 각도: ${strategy.coreAngle}
목표 감정: ${strategy.targetEmotion}

초고:
${draft.slice(0, 3000)}

검토 후 개선 지시 (2~3개):
{
  "feedback": [
    { "issue": "문제점", "location": "어느 부분", "instruction": "구체적 수정 지시", "why": "왜 수정해야 하는가" }
  ]
}`,
  }], 1000, 0.2);

  let feedbackItems: Array<{ issue: string; location: string; instruction: string; why: string }> = [];
  try {
    const match = directorReview.match(/\{[\s\S]*\}/);
    if (match) feedbackItems = JSON.parse(match[0]).feedback ?? [];
  } catch { /* 파싱 실패 시 원본 유지 */ }

  if (!feedbackItems.length) return { revisedDraft: draft, directorFeedback: [] };

  const feedbackText = feedbackItems.map((f, i) =>
    `${i + 1}. [${f.location}] ${f.instruction}\n   이유: ${f.why}`
  ).join('\n\n');

  // 작가 수정
  const revisedDraft = await callLLM(model, apiKeys, [{
    role:    'system',
    content: '당신은 대본 작가입니다. 감독의 피드백을 받아 지적된 부분만 수정합니다. 전체 재작성 금지. 대본 전문만 출력.',
  }, {
    role:    'user',
    content: `감독 피드백:\n${feedbackText}\n\n원본 대본:\n${draft}\n\n위 피드백을 반영해 수정된 대본 전체를 출력하세요.`,
  }], 5000, 0.7);

  return {
    revisedDraft,
    directorFeedback: feedbackItems.map(f => `[${f.location}] ${f.instruction}`),
  };
}

// ── Agent 3: 프로듀서 ──────────────────────────────────────────────────────────
async function runProducer(
  model: string, apiKeys: Record<string, string>,
  draft: string, minLength: number,
  wiki: CategoryWiki,
): Promise<{ finalScript: string; producerNotes: string[] }> {

  const raw = await callLLM(model, apiKeys, [{
    role:    'system',
    content: `당신은 유튜브 콘텐츠 프로듀서입니다. 시청자 이탈 구간을 본능적으로 압니다.
대본의 훅/전환/클로징을 점검하고 약한 부분만 수정합니다. 전체 재작성 금지.

채점 루브릭 (점검 기준으로 활용):
${wiki.evaluationRubric}

JSON만 출력.`,
  }, {
    role:    'user',
    content: `대본 (최소 ${minLength}자 요구됨, 현재 ${draft.length}자):
${draft}

점검 항목:
1. 첫 15초 훅이 시청자를 붙잡는가? (훅 강도 기준 적용)
2. 각 단계 전환이 자연스러운가?
3. 금지 표현이 없는가? (writer-persona 기준)
4. 클로징이 구독 CTA로 자연스럽게 연결되는가?
5. 길이가 ${minLength}자 이상인가?

출력:
{
  "producerNotes": ["수정 항목1", "수정 항목2"],
  "finalScript": "수정된 최종 대본 전체"
}`,
  }], 6000, 0.2);

  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('파싱 실패');
    const parsed = JSON.parse(match[0]);
    return {
      finalScript:   parsed.finalScript   ?? draft,
      producerNotes: parsed.producerNotes ?? [],
    };
  } catch {
    return { finalScript: draft, producerNotes: ['프로듀서 응답 파싱 실패 — 원본 사용'] };
  }
}

// ── Agent 4: SEO 최적화 ────────────────────────────────────────────────────────
async function runSEO(
  model: string, apiKeys: Record<string, string>,
  topic: string, category: string, script: string,
): Promise<SEOPackage> {

  const raw = await callLLM(model, apiKeys, [{
    role:    'system',
    content: `당신은 YouTube SEO 전문가입니다. CTR(클릭률)과 검색 노출을 동시에 최적화합니다.
대본을 분석해서 SEO 패키지를 생성합니다. JSON만 출력.`,
  }, {
    role:    'user',
    content: `주제: ${topic}
카테고리: ${category}
대본 첫 500자: ${script.slice(0, 500)}

출력:
{
  "titles": [
    { "title": "제목안 1 (호기심 유발형)", "reason": "이 제목이 클릭되는 이유" },
    { "title": "제목안 2 (숫자/데이터형)", "reason": "..." },
    { "title": "제목안 3 (반전/충격형)",   "reason": "..." }
  ],
  "thumbnailText": "썸네일 텍스트 (5~8자, 강렬하게)",
  "description": "영상 설명문 첫 3줄 (검색 노출용, 핵심 키워드 포함)",
  "hashtags": ["#태그1", "#태그2", "#태그3", "#태그4", "#태그5", "#태그6", "#태그7", "#태그8", "#태그9", "#태그10"],
  "searchKeywords": ["검색 키워드1", "검색 키워드2", "검색 키워드3", "검색 키워드4", "검색 키워드5"]
}`,
  }], 800, 0.4);

  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('파싱 실패');
    return JSON.parse(match[0]);
  } catch {
    return {
      titles:          [{ title: topic, reason: 'SEO 파싱 실패' }],
      thumbnailText:   topic.slice(0, 8),
      description:     '',
      hashtags:        [],
      searchKeywords:  [],
    };
  }
}

// ── 타입 ───────────────────────────────────────────────────────────────────────
interface DirectorStrategy {
  coreAngle:     string;
  whyCoreAngle:  string;
  hookStrategy:  string;
  whyHook:       string;
  stageplan:     { stage: number; title: string; content: string; why: string }[];
  targetEmotion: string;
  keyData:       string[];
}

interface SEOPackage {
  titles:         { title: string; reason: string }[];
  thumbnailText:  string;
  description:    string;
  hashtags:       string[];
  searchKeywords: string[];
}

interface AgentStep {
  agent:   string;
  status:  'done' | 'error';
  summary: string;
}

// ── POST Handler ───────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const {
      topic, category = 'general', model = 'gemini-2.5-flash',
      tone = 'friendly_casual', minLength = 3000,
    } = await req.json();

    if (!topic) return NextResponse.json({ error: '주제(topic)가 필요합니다' }, { status: 400 });

    // 사용자 API 키 로드
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

    const wiki  = await loadCategoryWiki(category);
    const steps: AgentStep[] = [];

    // ── Agent 1: 감독 ────────────────────────────────────────────────────────
    let strategy: DirectorStrategy;
    try {
      const res  = await runDirector(model, apiKeys, topic, category, wiki, minLength);
      strategy   = res.strategy;
      steps.push({ agent: '감독', status: 'done', summary: `각도: ${strategy.coreAngle.slice(0, 60)}${apiKeys.perplexity ? ' [Perplexity 리서치 적용]' : ''}` });
    } catch (e) {
      const msg = (e as Error).message;
      steps.push({ agent: '감독', status: 'error', summary: msg });
      return NextResponse.json({ error: `감독 에이전트 실패: ${msg}`, steps }, { status: 500 });
    }

    // ── Agent 2: 작가 ────────────────────────────────────────────────────────
    let draft: string;
    try {
      const res  = await runWriter(model, apiKeys, topic, category, wiki, strategy, minLength);
      draft      = res.draft;
      steps.push({ agent: '작가', status: 'done', summary: `초고 ${draft.length}자 작성` });
    } catch (e) {
      const msg = (e as Error).message;
      steps.push({ agent: '작가', status: 'error', summary: msg });
      return NextResponse.json({ error: `작가 에이전트 실패: ${msg}`, steps }, { status: 500 });
    }

    // ── 감독 ↔ 작가 토론 ─────────────────────────────────────────────────────
    let directorFeedback: string[] = [];
    try {
      const res       = await runDiscussion(model, apiKeys, strategy, draft, category);
      draft           = res.revisedDraft;
      directorFeedback = res.directorFeedback;
      steps.push({
        agent:   '토론',
        status:  'done',
        summary: directorFeedback.length
          ? `감독 피드백 ${directorFeedback.length}개 반영`
          : '피드백 없음 — 초고 유지',
      });
    } catch (e) {
      steps.push({ agent: '토론', status: 'error', summary: (e as Error).message });
      // 토론 실패 시 초고 그대로 진행
    }

    // ── Agent 3: 프로듀서 ─────────────────────────────────────────────────────
    let finalScript: string;
    let producerNotes: string[];
    try {
      const res   = await runProducer(model, apiKeys, draft, minLength, wiki);
      finalScript  = res.finalScript;
      producerNotes = res.producerNotes;
      steps.push({
        agent:   '프로듀서',
        status:  'done',
        summary: `${producerNotes.length}개 항목 수정 / 최종 ${finalScript.length}자`,
      });
    } catch (e) {
      finalScript   = draft;
      producerNotes = [];
      steps.push({ agent: '프로듀서', status: 'error', summary: (e as Error).message });
    }

    // ── Agent 4: SEO ──────────────────────────────────────────────────────────
    let seo: SEOPackage;
    try {
      seo = await runSEO(model, apiKeys, topic, category, finalScript);
      steps.push({
        agent:   'SEO',
        status:  'done',
        summary: `제목 ${seo.titles.length}개 / 해시태그 ${seo.hashtags.length}개`,
      });
    } catch (e) {
      seo = { titles: [], thumbnailText: '', description: '', hashtags: [], searchKeywords: [] };
      steps.push({ agent: 'SEO', status: 'error', summary: (e as Error).message });
    }

    return NextResponse.json({
      script:          finalScript,
      strategy,
      directorFeedback,
      producerNotes,
      seo,
      steps,
      meta: { category, model, tone, length: finalScript.length },
    });

  } catch (err: unknown) {
    console.error('[generate-script-agent]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '파이프라인 실행 실패' },
      { status: 500 }
    );
  }
}
