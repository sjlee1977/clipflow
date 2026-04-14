/**
 * 블로그 글 품질 평가 에이전트 (LLM-as-Judge)
 *
 * POST /api/blog/evaluate
 *
 * Body:
 *   content   평가할 블로그 글 (필수)
 *   model     사용할 모델 (기본: gpt-4o-mini)
 *
 * Response:
 *   dimensions  8개 차원별 점수 + 근거
 *   totalScore  100점 환산 총점
 *   grade       S/A/B/C/D 등급
 *   suggestions 개선 제안 목록
 *   passed      발행 가능 여부 (A 이상)
 */
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase-server';
import fs from 'fs';
import path from 'path';

// ── 루브릭 로더 ────────────────────────────────────────────────────────────────
const WIKI_DIR = path.join(process.cwd(), 'wiki');

function readWikiFile(relativePath: string): string {
  try {
    return fs.readFileSync(path.join(WIKI_DIR, relativePath), 'utf-8');
  } catch {
    return '';
  }
}

// ── 타입 ───────────────────────────────────────────────────────────────────────
interface DimensionResult {
  name:       string;
  nameKo:     string;
  score:      number;   // 0~10
  maxScore:   number;   // 10
  reason:     string;   // 채점 근거
  suggestion: string;   // 개선 제안 (점수 7 미만일 때 의미 있음)
}

interface EvaluationResult {
  dimensions:  DimensionResult[];
  rawScore:    number;   // 합산 (0~80)
  totalScore:  number;   // 100점 환산
  grade:       'S' | 'A' | 'B' | 'C' | 'D';
  suggestions: string[]; // 우선순위 높은 개선사항
  passed:      boolean;  // A 이상이면 발행 가능
  tokens:      number;
}

// ── 등급 계산 ──────────────────────────────────────────────────────────────────
function calcGrade(score: number): 'S' | 'A' | 'B' | 'C' | 'D' {
  if (score >= 90) return 'S';
  if (score >= 75) return 'A';
  if (score >= 60) return 'B';
  if (score >= 40) return 'C';
  return 'D';
}

// ── Judge 프롬프트 빌더 ────────────────────────────────────────────────────────
function buildJudgePrompt(content: string): string {
  const rubric = readWikiFile('blog/evaluation-rubric.md');

  return `당신은 블로그 글 품질을 평가하는 냉정한 편집장입니다.
아래 채점 루브릭에 따라 블로그 글을 8개 차원에서 각 10점 만점으로 채점합니다.

━━━━━━━━━━━━━━━━━━━━━━━━━
채점 루브릭
━━━━━━━━━━━━━━━━━━━━━━━━━
${rubric || `
1. 훅 강도 (Hook Power)
2. 서사 구조 (Narrative Structure)
3. 장면 묘사 / Show Don't Tell
4. 문장 리듬 (Sentence Rhythm)
5. 감정 흐름 (Emotional Arc)
6. CTA 품질 (Call To Action)
7. 금지 표현 준수 (Forbidden Phrases)
8. 클로징 에코 (Closing Echo)
`}

━━━━━━━━━━━━━━━━━━━━━━━━━
평가할 블로그 글
━━━━━━━━━━━━━━━━━━━━━━━━━
${content.slice(0, 6000)}

━━━━━━━━━━━━━━━━━━━━━━━━━
출력 형식 (JSON만 출력, 다른 텍스트 없음)
━━━━━━━━━━━━━━━━━━━━━━━━━
{
  "dimensions": [
    {
      "name": "hook_power",
      "nameKo": "훅 강도",
      "score": 0~10,
      "reason": "채점 근거 (글의 실제 내용을 인용하며 구체적으로)",
      "suggestion": "개선 방법 (점수가 8 미만일 때 구체적으로)"
    },
    {
      "name": "narrative_structure",
      "nameKo": "서사 구조",
      "score": 0~10,
      "reason": "...",
      "suggestion": "..."
    },
    {
      "name": "show_dont_tell",
      "nameKo": "장면 묘사",
      "score": 0~10,
      "reason": "...",
      "suggestion": "..."
    },
    {
      "name": "sentence_rhythm",
      "nameKo": "문장 리듬",
      "score": 0~10,
      "reason": "...",
      "suggestion": "..."
    },
    {
      "name": "emotional_arc",
      "nameKo": "감정 흐름",
      "score": 0~10,
      "reason": "...",
      "suggestion": "..."
    },
    {
      "name": "cta_quality",
      "nameKo": "CTA 품질",
      "score": 0~10,
      "reason": "...",
      "suggestion": "..."
    },
    {
      "name": "forbidden_phrases",
      "nameKo": "금지 표현",
      "score": 0~10,
      "reason": "발견된 금지 표현 목록 또는 '없음'",
      "suggestion": "..."
    },
    {
      "name": "closing_echo",
      "nameKo": "클로징 에코",
      "score": 0~10,
      "reason": "...",
      "suggestion": "..."
    }
  ]
}`;
}

// ── POST Handler ───────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { content, llmModelId } = await req.json();

    if (!content || content.trim().length < 100) {
      return NextResponse.json(
        { error: '평가할 블로그 글이 너무 짧습니다 (최소 100자)' },
        { status: 400 }
      );
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
      else return NextResponse.json(
        { error: 'API 키가 없습니다. 설정 페이지에서 API 키를 등록해주세요.' },
        { status: 400 },
      );
    }

    const judgePrompt = buildJudgePrompt(content);
    const systemMsg = '당신은 블로그 편집장입니다. 지시에 따라 JSON만 출력합니다. 다른 텍스트는 절대 출력하지 않습니다.';

    // ── LLM 호출 ────────────────────────────────────────────────────────────────
    let raw = '';
    const isClaude = model.startsWith('claude');
    const isQwen   = model.startsWith('qwen');

    if (isClaude) {
      const key = apiKeys.anthropic;
      if (!key) throw new Error('Anthropic API 키가 없습니다');
      const client = new Anthropic({ apiKey: key });
      const res = await client.messages.create({
        model, max_tokens: 2500, temperature: 0.2,
        system: systemMsg,
        messages: [{ role: 'user', content: judgePrompt }],
      });
      raw = res.content[0]?.type === 'text' ? res.content[0].text : '{}';
    } else if (isQwen) {
      const key = apiKeys.qwen;
      if (!key) throw new Error('Qwen API 키가 없습니다');
      const res = await fetch('https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model, max_tokens: 2500, temperature: 0.2,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemMsg },
            { role: 'user',   content: judgePrompt },
          ],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(`Qwen 오류: ${data?.error?.message ?? res.status}`);
      raw = data.choices?.[0]?.message?.content ?? '{}';
    } else {
      // Gemini
      const key = apiKeys.gemini;
      if (!key) throw new Error('Gemini API 키가 없습니다');
      const ai = new GoogleGenAI({ apiKey: key });
      const response = await ai.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [{ text: judgePrompt }] }],
        config: {
          systemInstruction: systemMsg,
          maxOutputTokens: 2500,
          temperature: 0.2,
          responseMimeType: 'application/json',
        },
      });
      raw = response.text ?? '{}';
    }

    const tokens = 0; // token count not needed for non-OpenAI

    let parsed: { dimensions?: DimensionResult[] };
    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        { error: 'AI 응답 파싱 실패', raw },
        { status: 500 }
      );
    }

    const dimensions: DimensionResult[] = (parsed.dimensions ?? []).map(d => ({
      ...d,
      maxScore: 10,
      score:    Math.min(10, Math.max(0, Math.round(d.score))),
    }));

    if (dimensions.length === 0) {
      return NextResponse.json(
        { error: '채점 결과를 받지 못했습니다', raw },
        { status: 500 }
      );
    }

    const rawScore   = dimensions.reduce((sum, d) => sum + d.score, 0);
    const maxRaw     = dimensions.length * 10;
    const totalScore = Math.round((rawScore / maxRaw) * 100);
    const grade      = calcGrade(totalScore);

    // 점수 낮은 순으로 개선 제안 정렬 (7점 미만만)
    const suggestions = dimensions
      .filter(d => d.score < 7 && d.suggestion)
      .sort((a, b) => a.score - b.score)
      .map(d => `[${d.nameKo}] ${d.suggestion}`);

    const result: EvaluationResult = {
      dimensions,
      rawScore,
      totalScore,
      grade,
      suggestions,
      passed: grade === 'S' || grade === 'A',
      tokens,
    };

    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error('[blog/evaluate]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '평가 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
