/**
 * 블로그 글 품질 평가 (독립 재평가용)
 *
 * POST /api/blog/evaluate
 *
 * Body:
 *   content     평가할 블로그 글 (필수)
 *   llmModelId  사용할 모델 ID
 *
 * Response: EvalResult (write-pipeline과 동일 타입)
 */
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase-server';
import fs from 'fs';
import path from 'path';

// ── 위키 로더 ─────────────────────────────────────────────────────────────────
const WIKI_DIR = path.join(process.cwd(), 'wiki');
function readWikiFile(p: string) { try { return fs.readFileSync(path.join(WIKI_DIR, p), 'utf-8'); } catch { return ''; } }

// ── 등급 계산 ─────────────────────────────────────────────────────────────────
function calcGrade(score: number): 'S' | 'A' | 'B' | 'C' | 'D' {
  if (score >= 90) return 'S';
  if (score >= 75) return 'A';
  if (score >= 60) return 'B';
  if (score >= 40) return 'C';
  return 'D';
}

function safeJson<T>(raw: string, fallback: T): T {
  const cleaned = raw.replace(/```json?\s*/gi, '').replace(/```\s*/g, '').trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return fallback;
  try { return JSON.parse(match[0]) as T; } catch { return fallback; }
}

// ── POST Handler ──────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { content, llmModelId } = await req.json();

    if (!content || content.trim().length < 100) {
      return NextResponse.json({ error: '평가할 블로그 글이 너무 짧습니다 (최소 100자)' }, { status: 400 });
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

    let model = llmModelId ?? '';
    if (!model) {
      if (apiKeys.gemini)         model = 'gemini-2.5-flash';
      else if (apiKeys.anthropic) model = 'claude-haiku-4-5-20251001';
      else if (apiKeys.qwen)      model = 'qwen3.5-flash';
      else return NextResponse.json({ error: 'API 키가 없습니다.' }, { status: 400 });
    }

    const rubric = readWikiFile('blog/evaluation-rubric.md');

    const systemPrompt = `당신은 블로그 품질을 냉정하게 평가하는 편집장입니다.
아래 루브릭으로 10개 차원 각 10점 만점 채점. JSON만 출력.

${rubric || '훅강도/서사구조/장면묘사/문장리듬/감정흐름/CTA품질/금지표현/클로징에코/인간필기감/사실정확성'}

## 인간 필기감 채점 기준 (9번째 차원)
AI가 쓴 것 같은 패턴이 얼마나 제거되었는지 평가:
10점: AI 패턴 0개, 개인 경험담 포함, 구어체 자연스러움, 문단 길이 다양
7~9점: AI 패턴 1~2개 있으나 전반적으로 자연스러움
4~6점: AI 패턴 다수(3~5개) 또는 전체 구조가 공식적
1~3점: 전형적 AI 투의 "살펴보겠습니다" 구조, 나열식, 무감정
0점: 거의 모든 문장이 AI 패턴

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

    // ── LLM 호출 ─────────────────────────────────────────────────────────────
    const isClaude = model.startsWith('claude');
    const isQwen   = model.startsWith('qwen');
    let raw = '';

    if (isClaude) {
      if (!apiKeys.anthropic) throw new Error('Anthropic API 키가 없습니다');
      const client = new Anthropic({ apiKey: apiKeys.anthropic });
      const res = await client.messages.create({
        model, max_tokens: 4000, temperature: 0.2,
        system: `${systemPrompt}\n\n반드시 유효한 JSON만 출력. 마크다운 코드블록 없이.`,
        messages: [{ role: 'user', content: userPrompt }],
      });
      raw = res.content[0]?.type === 'text' ? res.content[0].text : '';
    } else if (isQwen) {
      if (!apiKeys.qwen) throw new Error('Qwen API 키가 없습니다');
      const res = await fetch('https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKeys.qwen}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model, max_tokens: 4000, temperature: 0.2,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: `${systemPrompt}\n\n반드시 유효한 JSON만 출력.` },
            { role: 'user',   content: userPrompt },
          ],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(`Qwen 오류: ${data?.error?.message ?? res.status}`);
      raw = data.choices?.[0]?.message?.content ?? '';
    } else {
      // Gemini
      if (!apiKeys.gemini) throw new Error('Gemini API 키가 없습니다');
      const ai = new GoogleGenAI({ apiKey: apiKeys.gemini });
      const response = await ai.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        config: {
          systemInstruction: systemPrompt,
          maxOutputTokens: 4000,
          temperature: 0.2,
          responseMimeType: 'application/json',
        },
      });
      raw = response.text ?? '';
    }

    const parsed = safeJson<{ dimensions?: { name: string; nameKo: string; score: number; reason: string; suggestion: string }[] }>(raw, { dimensions: [] });
    const dims = (parsed.dimensions ?? []).map(d => ({
      ...d, score: Math.min(10, Math.max(0, Math.round(Number(d.score) || 0))),
    }));

    if (dims.length === 0) {
      return NextResponse.json({ error: '평가자 응답 파싱 실패 (빈 dimensions)', raw }, { status: 500 });
    }

    const rawScore   = dims.reduce((s, d) => s + d.score, 0);
    const totalScore = Math.round((rawScore / (dims.length * 10)) * 100);
    const grade      = calcGrade(totalScore);
    const suggestions = dims
      .filter(d => d.score < 7 && d.suggestion)
      .sort((a, b) => a.score - b.score)
      .map(d => `[${d.nameKo}] ${d.suggestion}`);

    return NextResponse.json({ dimensions: dims, totalScore, grade, suggestions, passed: grade === 'S' || grade === 'A' });
  } catch (err: unknown) {
    console.error('[blog/evaluate]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '평가 중 오류가 발생했습니다' },
      { status: 500 },
    );
  }
}
