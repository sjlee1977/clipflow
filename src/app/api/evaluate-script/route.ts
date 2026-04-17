/**
 * 유튜브 대본 품질 평가 에이전트 (LLM-as-Judge)
 *
 * POST /api/evaluate-script
 *
 * Body:
 *   script       평가할 대본 (필수, 최소 300자)
 *   category     economy | psychology | horror | health | history | general
 *   llmModelId   사용할 모델 (없으면 자동 선택)
 *
 * Response:
 *   dimensions   8개 차원별 점수 + 근거
 *   totalScore   100점 환산 총점
 *   grade        S/A/B/C/D 등급
 *   suggestions  개선 제안 목록 (8점 미만 항목)
 *   passed       A 이상이면 영상 제작 적합 판정
 */
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase-server';
import fs from 'fs';
import path from 'path';

// ── Wiki 로더 ──────────────────────────────────────────────────────────────────
const WIKI_DIR = path.join(process.cwd(), 'wiki', 'script');

function readWiki(relativePath: string): string {
  try { return fs.readFileSync(path.join(WIKI_DIR, relativePath), 'utf-8'); }
  catch { return ''; }
}

// ── 타입 ───────────────────────────────────────────────────────────────────────
interface DimensionResult {
  name:       string;
  nameKo:     string;
  score:      number;   // 0~10
  maxScore:   number;   // 10
  reason:     string;
  suggestion: string;
}

interface EvaluationResult {
  dimensions:  DimensionResult[];
  rawScore:    number;
  totalScore:  number;
  grade:       'S' | 'A' | 'B' | 'C' | 'D';
  suggestions: string[];
  passed:      boolean;
}

// ── 등급 계산 ──────────────────────────────────────────────────────────────────
function calcGrade(score: number): 'S' | 'A' | 'B' | 'C' | 'D' {
  if (score >= 90) return 'S';
  if (score >= 75) return 'A';
  if (score >= 60) return 'B';
  if (score >= 40) return 'C';
  return 'D';
}

// ── JSON 파싱 헬퍼 ─────────────────────────────────────────────────────────────
function safeParseJson<T>(raw: string, fallback: T): T {
  const cleaned = raw.replace(/```json?\s*/gi, '').replace(/```\s*/g, '').trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return fallback;
  try { return JSON.parse(match[0]) as T; }
  catch { return fallback; }
}

// ── Judge 프롬프트 빌더 ────────────────────────────────────────────────────────
function buildJudgePrompt(script: string, category: string): string {
  const structure = readWiki('_shared/7-stage-structure.md');
  const catStageNotes = readWiki(`${category}/stage-notes.md`);
  const catTone       = readWiki(`${category}/tone.md`);

  return `당신은 유튜브 대본 품질을 평가하는 냉정한 콘텐츠 디렉터입니다.
아래 채점 기준에 따라 대본을 8개 차원에서 각 10점 만점으로 채점합니다.

━━━━━━━━━━━━━━━━━━━━━━━━━
채점 기준 (카테고리: ${category})
━━━━━━━━━━━━━━━━━━━━━━━━━

1. 훅 강도 (Hook Power)
   - 9~10: 인사 없이 첫 문장부터 시작, 도발적 질문 형식(A/B/C형)
   - 6~8: 훅 의도는 있으나 다소 약함
   - 3~5: 배경 설명/정의로 시작
   - 0~2: "안녕하세요", "오늘은 ~에 대해" 등 금지 표현으로 시작

2. 7단계 구조 (Stage Structure)
   - 9~10: 도입훅→팩트→개념번역→인사이트→시나리오→리스크→클로징 흐름 명확
   - 6~8: 구조 있으나 일부 단계 약함
   - 3~5: 정보 나열형, 구조 불명확
   - 0~2: 단계 흐름 없음
${structure ? `\n참고 구조:\n${structure.slice(0, 800)}` : ''}

3. 하드 데이터 (Hard Data)
   - 9~10: 모든 주장에 날짜+수치+퍼센트 포함, "최근 많이 올랐다" 류 표현 없음
   - 6~8: 대부분 수치 있으나 일부 막연한 표현 혼용
   - 3~5: 수치 드물고 추상적 서술 많음
   - 0~2: 거의 모든 주장이 수치 없이 막연

4. 개념 번역 (Concept Translation)
   - 9~10: 어려운 개념을 일상 비유(음식/가게/스포츠 등)로 설명, 초등학생도 이해 가능
   - 6~8: 일부 비유 있으나 전문 용어 그대로 남은 부분 있음
   - 3~5: 비유 거의 없음, 전문 용어 다수 미번역
   - 0~2: 비유 전무, 전문 용어 그대로 나열

5. 긴장감/몰입 (Tension & Engagement)
   - 9~10: 단락마다 "다음은 뭐지?" 유발, 브릿지 멘트 자연스러움
   - 6~8: 일부 구간 이탈 위험 있으나 전반적으로 유지
   - 3~5: 중반 이후 흐름 급격히 늘어짐
   - 0~2: 단조롭고 이탈 유발 구간 다수

6. 대화체 자연스러움 (Conversational Tone)
   - 9~10: 친근한 반말, 방송 앵커/보고서 언어 없음, 시청자를 직접 호명하는 느낌
   - 6~8: 대체로 대화체이나 일부 딱딱한 표현 혼용
   - 3~5: 반말/존댓말 혼용 또는 강의체 다수
   - 0~2: 방송 앵커/보고서 언어 지배적
${catTone ? `\n카테고리 톤 기준:\n${catTone.slice(0, 300)}` : ''}
${catStageNotes ? `\n카테고리 특화 지침:\n${catStageNotes.slice(0, 300)}` : ''}

7. 리스크 점검 (Risk Check)
   - 9~10: 리스크 구간 명확히 존재, 구체적 악재+수치+대응책 포함
   - 6~8: 리스크 언급은 있으나 대응 안전망 부족
   - 3~5: 리스크 구간 매우 약하거나 단순 언급 수준
   - 0~2: 리스크 구간 없음 (무조건 긍정/낙관)

8. CTA / 클로징 (CTA & Closing)
   - 9~10: 투자 철학 한 줄 요약 + 자연스러운 좋아요/구독 유도 + 시그니처 클로징
   - 6~8: CTA 있으나 타이밍 어색하거나 억지스러움
   - 3~5: 클로징 단순 인사 수준
   - 0~2: CTA/클로징 없음

━━━━━━━━━━━━━━━━━━━━━━━━━
평가할 대본
━━━━━━━━━━━━━━━━━━━━━━━━━
${script.slice(0, 6000)}

━━━━━━━━━━━━━━━━━━━━━━━━━
출력 형식 (JSON만 출력, 다른 텍스트 없음)
━━━━━━━━━━━━━━━━━━━━━━━━━
{
  "dimensions": [
    { "name": "hook_power",         "nameKo": "훅 강도",       "score": 0~10, "reason": "대본 실제 내용 인용하며 구체적으로", "suggestion": "8점 미만일 때 개선 방법" },
    { "name": "stage_structure",    "nameKo": "7단계 구조",    "score": 0~10, "reason": "...", "suggestion": "..." },
    { "name": "hard_data",          "nameKo": "하드 데이터",   "score": 0~10, "reason": "...", "suggestion": "..." },
    { "name": "concept_translation","nameKo": "개념 번역",     "score": 0~10, "reason": "...", "suggestion": "..." },
    { "name": "tension_engagement", "nameKo": "긴장감/몰입",   "score": 0~10, "reason": "...", "suggestion": "..." },
    { "name": "conversational_tone","nameKo": "대화체",        "score": 0~10, "reason": "...", "suggestion": "..." },
    { "name": "risk_check",         "nameKo": "리스크 점검",   "score": 0~10, "reason": "...", "suggestion": "..." },
    { "name": "cta_closing",        "nameKo": "CTA/클로징",    "score": 0~10, "reason": "...", "suggestion": "..." }
  ]
}`;
}

// ── POST Handler ───────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { script, category = 'general', llmModelId } = await req.json();

    if (!script || script.trim().length < 300) {
      return NextResponse.json(
        { error: '평가할 대본이 너무 짧습니다 (최소 300자)' },
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

    const judgePrompt = buildJudgePrompt(script, category);
    const systemMsg   = '당신은 유튜브 대본 평가 전문가입니다. 지시에 따라 JSON만 출력합니다. 다른 텍스트는 절대 출력하지 않습니다.';

    // ── LLM 호출 ──────────────────────────────────────────────────────────────
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

    // ── 파싱 ──────────────────────────────────────────────────────────────────
    const parsed = safeParseJson<{ dimensions?: DimensionResult[] }>(raw, {});

    const dimensions: DimensionResult[] = (parsed.dimensions ?? []).map(d => ({
      ...d,
      maxScore: 10,
      score: Math.min(10, Math.max(0, Math.round(d.score))),
    }));

    if (dimensions.length === 0) {
      return NextResponse.json(
        { error: '채점 결과를 받지 못했습니다', raw: raw.slice(0, 300) },
        { status: 500 }
      );
    }
    if (dimensions.length < 8) {
      console.warn(`[evaluate-script] 채점 항목 부족: ${dimensions.length}개 / 기대: 8개`);
    }

    const rawScore   = dimensions.reduce((sum, d) => sum + d.score, 0);
    const totalScore = Math.round((rawScore / 80) * 100); // 항상 80점 만점 기준
    const grade      = calcGrade(totalScore);

    const suggestions = dimensions
      .filter(d => d.score < 8 && d.suggestion)
      .sort((a, b) => a.score - b.score)
      .map(d => `[${d.nameKo}] ${d.suggestion}`);

    const result: EvaluationResult = {
      dimensions,
      rawScore,
      totalScore,
      grade,
      suggestions,
      passed: grade === 'S' || grade === 'A',
    };

    return NextResponse.json(result);

  } catch (err: unknown) {
    console.error('[evaluate-script]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '평가 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
