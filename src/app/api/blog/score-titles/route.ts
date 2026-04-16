/**
 * SEO 제목 독립 채점 에이전트
 *
 * POST /api/blog/score-titles
 *
 * 채점 기준 출처:
 *   - CoSchedule Headline Analyzer (word balance, emotional content, power words)
 *   - MonsterInsights Headline Analyzer (7개 차원 100점제)
 *   - Advanced Marketing Institute EMV Formula (Emotional Marketing Value %)
 *   - Naver C-Rank SEO 알고리즘 (키워드 위치, 명확성, 사용자 의도)
 *   - GitHub: dtran320/Headline-Score-App, kuldeeps48/Headline-Analyzer 방법론
 *
 * 생성 에이전트와 독립적으로 실행 — 같은 모델이어도 제목만 보고 재채점.
 *
 * Body:
 *   titles        채점할 제목 배열 (필수)
 *   keyword       메인 키워드 (필수)
 *   seoPlatform   'naver' | 'google'
 *   llmModelId    사용할 AI 모델 (선택)
 */
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase-server';

// ── 채점 기준 (8개 차원 × 12.5점 = 100점, 플랫폼별 분리) ────────────────────
// 출처: CoSchedule + MonsterInsights + AMI EMV + Naver C-Rank + Google SEO Best Practices
const SCORING_RUBRIC_NAVER = `
## 네이버 SEO 제목 채점 루브릭 (8개 차원 × 12.5점 = 100점)
플랫폼: 네이버 VIEW 탭 / 블로그 검색 최적화

### 1. 길이 최적화 (12.5점) — 네이버 VIEW 탭 표시 기준
- 28~45자: 12.5점 (네이버 검색 결과 완전 표시 + 모바일 최적)
- 20~27자 또는 46~55자: 9점
- 15~19자 또는 56~65자: 5점
- 15자 미만 또는 65자 초과: 2점

### 2. 키워드 배치 (12.5점) — 네이버 C-Rank 알고리즘
- 정확한 키워드 + 제목 앞 1/3 이내 배치: 12.5점
- 정확한 키워드 포함 (위치 무관): 9점
- 키워드 일부 변형 포함 (조사 제외 일치): 5점
- 키워드 없음: 0점

### 3. 훅 강도 (12.5점) — 네이버 사용자 클릭 패턴 (CoSchedule)
네이버는 정보성·공감형 훅이 효과적:
- 공감형·질문형 ("혹시 이런 경험?", "왜 ~일까요?"): 11~12.5점
- 충격형·도발적 ("아무도 모르는", "착각"): 10~11점
- 숫자형 (구체적 숫자): 9~11점
- 약속형 (시간, 단계, 완전정복): 9~10점
- 비교형 (A vs B): 7~9점
- 일반형 (훅 없음): 0~5점

### 4. 감정 유발력 (12.5점) — AMI EMV + 네이버 생활밀착형
EMV = 감정 단어 수 / 전체 단어 수 × 100
네이버는 생활 공감·감성 어필이 CTR에 직접 영향:
- EMV 40% 이상 + 파워워드: 12.5점
- EMV 20~40%: 8~10점
- EMV 10~20%: 4~7점
- EMV 10% 미만: 0~3점

**네이버 파워워드**: 완전정복, 비밀, 진실, 충격, 결국, 진짜, 이유, 방법, 무료, 즉시, 핵심, 공개
**네이버 공감어**: 불안, 기대, 희망, 두려움, 절박, 안도, 허탈, 억울, 다행

### 5. 검색 의도 일치 (12.5점) — 네이버 정보성 중심
네이버 검색자는 정보성(Know) 의도 비중이 압도적으로 높음:
- 정보성(Know) 키워드 + 정보 제공형 제목: 12.5점
- 생활밀착형(Do) 키워드 + 실천 가이드형 제목: 11점
- 의도 부분 일치: 6~9점
- 정보성 키워드에 상업적 제목: 0~4점

### 6. 클릭 심리 자극 (12.5점) — FOMO + 공감 (MonsterInsights)
네이버 사용자는 공감과 FOMO에 민감:
- 강한 FOMO ("아직도 모르세요?", "지금 안 하면"): 11~12.5점
- 공감형 호기심 ("혹시 ~때문에 힘드세요?"): 10~11점
- 이익 제시 ("~하는 법", "~완전정복"): 8~10점
- 수동적 제목: 0~5점

### 7. 명확성 (12.5점) — IsItWP Clarity Score
- 1초 안에 내용 파악 + 모호한 표현 없음: 12.5점
- 대략 파악 가능, 일부 모호: 7~10점
- 내용 파악 어려움: 0~5점

### 8. 차별성 (12.5점) — CoSchedule Uniqueness Factor
- 흔하지 않은 각도/관점/구조: 11~12.5점
- 다소 독창적: 7~10점
- "~완벽 정리", "~총정리" 같은 네이버 포화 구조: 0~5점
`;

const SCORING_RUBRIC_GOOGLE = `
## 구글 SEO 제목 채점 루브릭 (8개 차원 × 12.5점 = 100점)
플랫폼: 구글 SERP (검색결과 페이지) CTR 최적화

### 1. 길이 최적화 (12.5점) — 구글 SERP 픽셀 제한 (580px ≈ 한글 25~32자)
- 25~32자: 12.5점 (구글 SERP 완전 표시 + 데스크톱/모바일 모두 안전)
- 20~24자 또는 33~40자: 9점
- 15~19자 또는 41~50자: 5점
- 15자 미만 또는 50자 초과: 2점 (잘림 현상으로 CTR 손실)

### 2. 키워드 배치 (12.5점) — 구글 Title Tag SEO (더 엄격한 앞배치)
- 정확한 키워드 + 제목 맨 앞(첫 단어~1/4): 12.5점
- 정확한 키워드 + 앞 1/2 이내: 9점
- 정확한 키워드 포함 (뒤쪽 배치): 5점
- 키워드 없음: 0점

### 3. 훅 강도 (12.5점) — 구글 CTR 최적화 (명확한 혜택/숫자 우선)
구글은 명확한 가치 제시형과 숫자형이 CTR 최고:
- 숫자형 + 명확한 혜택 ("7가지 방법", "30일 만에"): 11~12.5점
- How-to형 명확한 가이드 ("~하는 방법"): 10~11점
- 충격형·도발적: 9~11점
- 약속형 (시간, 단계): 8~10점
- 질문형 (구글에서는 상대적으로 낮음): 7~9점
- 일반형 (훅 없음): 0~5점

### 4. 감정 유발력 (12.5점) — AMI EMV (구글은 신뢰성 병행)
구글 사용자는 감정보다 **정보 신뢰성 + 약한 감정** 조합이 효과적:
- 신뢰성 높은 파워워드 + EMV 20~35%: 12.5점 (최적 균형)
- EMV 35% 초과 (감정 과잉): 8~10점 (신뢰도 저하 가능)
- EMV 10~20%: 7~9점
- EMV 10% 미만: 0~5점

**구글 신뢰형 파워워드**: 검증된, 완전한, 전문가, 실증, 가이드, 핵심, 공식, 무료
**구글 감정어**: 확실한, 쉬운, 빠른, 효과적인, 최고의, 완벽한

### 5. 검색 의도 일치 (12.5점) — 구글 4가지 의도 균등 평가
구글은 Know / Do / Navigate / Decide 4가지 의도 모두 동등하게 중요:
- 키워드 의도 ↔ 제목 의도 완벽 일치 (4가지 모두): 12.5점
- 부분 일치 또는 의도 불명확: 6~9점
- 의도 불일치 (정보성 키워드에 상업 제목 등): 0~4점

### 6. 클릭 심리 자극 (12.5점) — 명확한 이익 제시 (MonsterInsights)
구글은 명확한 혜택 제시가 FOMO보다 CTR에 더 효과적:
- 명확한 이익 + 구체적 수치 ("N가지 방법으로 ~% 개선"): 11~12.5점
- 호기심 격차 ("왜 ~일까", "~의 이유"): 10~11점
- FOMO ("지금 안 하면"): 8~10점 (구글에서는 상대적으로 낮음)
- 수동적 제목: 0~5점

### 7. 명확성 (12.5점) — 구글 SERP 즉시 판단 (최우선 지표)
구글 사용자는 0.5초 내에 클릭 여부 결정:
- 0.5초 내 내용 파악 + 모호함 없음: 12.5점
- 1초 내 파악, 소폭 모호: 7~10점
- 내용 파악에 2초 이상 필요: 0~5점

### 8. 차별성 (12.5점) — 구글 경쟁도 반영 (CoSchedule, 더 중요)
구글은 경쟁이 네이버보다 훨씬 치열하므로 차별성 가중치 높음:
- 완전히 새로운 각도/프레임/관점: 11~12.5점
- 다소 독창적: 7~10점
- "~완전 가이드", "~총정리" 같은 구글 포화 구조: 0~4점
`;

export interface TitleScore {
  title:      string;
  totalScore: number;   // 0~100
  grade:      'S' | 'A' | 'B' | 'C' | 'D';
  dimensions: {
    name:       string;
    score:      number;   // 0~12.5
    maxScore:   12.5;
    reason:     string;
  }[];
  strengths:  string[];
  weaknesses: string[];
}

// ── LLM 호출 ─────────────────────────────────────────────────────────────────
async function callModel(
  model:   string,
  apiKeys: Record<string, string>,
  system:  string,
  user:    string,
  maxTokens = 4000,
): Promise<string> {
  const isClaude = model.startsWith('claude');
  const isQwen   = model.startsWith('qwen');

  if (isClaude) {
    const client = new Anthropic({ apiKey: apiKeys.anthropic });
    const res = await client.messages.create({
      model, max_tokens: maxTokens, temperature: 0.1,  // 낮은 온도 = 일관된 채점
      system,
      messages: [{ role: 'user', content: user }],
    });
    return res.content[0]?.type === 'text' ? res.content[0].text : '';
  }
  if (isQwen) {
    const res = await fetch('https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKeys.qwen}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model, max_tokens: maxTokens, temperature: 0.1,
        response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`Qwen 오류: ${data?.error?.message ?? res.status}`);
    return data.choices?.[0]?.message?.content ?? '';
  }
  // Gemini
  const ai = new GoogleGenAI({ apiKey: apiKeys.gemini });
  const response = await ai.models.generateContent({
    model,
    contents: [{ role: 'user', parts: [{ text: user }] }],
    config: {
      systemInstruction: system,
      maxOutputTokens: maxTokens,
      temperature: 0.1,
      responseMimeType: 'application/json',
    },
  });
  return response.text ?? '';
}

function safeJson<T>(raw: string, fallback: T): T {
  const cleaned = raw.replace(/```json?\s*/gi, '').replace(/```\s*/g, '').trim();
  const match = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (!match) return fallback;
  try { return JSON.parse(match[0]) as T; } catch { return fallback; }
}

function calcGrade(score: number): 'S' | 'A' | 'B' | 'C' | 'D' {
  if (score >= 88) return 'S';
  if (score >= 75) return 'A';
  if (score >= 60) return 'B';
  if (score >= 45) return 'C';
  return 'D';
}

// ── POST Handler ──────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { titles, keyword, seoPlatform = 'naver', llmModelId } = await req.json();

    if (!titles?.length || !keyword?.trim()) {
      return NextResponse.json({ error: '제목 배열과 키워드가 필요합니다' }, { status: 400 });
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
      else return NextResponse.json({ error: 'API 키가 없습니다' }, { status: 400 });
    }

    const platform = seoPlatform === 'naver' ? '네이버' : '구글';
    const rubric   = seoPlatform === 'naver' ? SCORING_RUBRIC_NAVER : SCORING_RUBRIC_GOOGLE;

    const systemPrompt = `당신은 SEO 헤드라인 분석 전문가입니다.
CoSchedule Headline Analyzer, MonsterInsights, AMI(Advanced Marketing Institute) EMV 공식,
${seoPlatform === 'naver' ? 'Naver C-Rank 알고리즘' : 'Google Search Console CTR 최적화 원칙'}에 기반한
전문 채점 기준으로 ${platform} SEO 제목을 독립적으로 평가합니다.

[중요] 당신의 역할은 제목을 만든 사람이 아니라 독립적인 심사위원입니다.
편견 없이, 기준에만 근거하여 냉정하게 채점하세요.
점수가 낮아도 솔직하게 주세요.

${rubric}

반드시 순수 JSON만 출력. 마크다운 코드블록 없이.`;

    const titleList = (titles as string[]).map((t, i) => `${i + 1}. "${t}"`).join('\n');

    const userPrompt = `
메인 키워드: "${keyword.trim()}"
SEO 플랫폼: ${platform}

아래 제목들을 위의 8개 차원 루브릭으로 각각 독립 채점하세요.
각 제목은 다른 제목과 비교하지 말고, 루브릭 기준으로만 평가합니다.

제목 목록:
${titleList}

JSON 출력:
{
  "scores": [
    {
      "title": "제목 텍스트",
      "totalScore": 0~100,
      "dimensions": [
        { "name": "길이 최적화",    "score": 0~12.5, "maxScore": 12.5, "reason": "근거 (20자 이내)" },
        { "name": "키워드 배치",    "score": 0~12.5, "maxScore": 12.5, "reason": "..." },
        { "name": "훅 강도",        "score": 0~12.5, "maxScore": 12.5, "reason": "..." },
        { "name": "감정 유발력",    "score": 0~12.5, "maxScore": 12.5, "reason": "..." },
        { "name": "검색 의도 일치", "score": 0~12.5, "maxScore": 12.5, "reason": "..." },
        { "name": "클릭 심리 자극", "score": 0~12.5, "maxScore": 12.5, "reason": "..." },
        { "name": "명확성",         "score": 0~12.5, "maxScore": 12.5, "reason": "..." },
        { "name": "차별성",         "score": 0~12.5, "maxScore": 12.5, "reason": "..." }
      ],
      "strengths":  ["강점1", "강점2"],
      "weaknesses": ["약점1", "약점2"]
    }
  ]
}`;

    let rawScores: TitleScore[] = [];
    try {
      const raw    = await callModel(model, apiKeys, systemPrompt, userPrompt, 4000);
      const parsed = safeJson<{ scores?: unknown[] }>(raw, { scores: [] });

      rawScores = ((parsed.scores ?? []) as TitleScore[]).map(s => {
        // totalScore를 dimensions에서 재계산 (AI 계산 오류 방지)
        const dimTotal = (s.dimensions ?? []).reduce((sum, d) => sum + (Number(d.score) || 0), 0);
        const total    = Math.round(Math.min(100, dimTotal));
        return {
          ...s,
          totalScore: total,
          grade:      calcGrade(total),
          dimensions: (s.dimensions ?? []).map(d => ({
            ...d,
            score:    Math.min(12.5, Math.max(0, Math.round(Number(d.score) * 10) / 10)),
            maxScore: 12.5 as const,
          })),
        };
      });
    } catch (e) {
      console.error('[score-titles] LLM 오류:', e);
      // LLM 실패 시 null scores 반환 (UI에서 처리)
      return NextResponse.json({ scores: [] });
    }

    return NextResponse.json({ scores: rawScores, model });
  } catch (err: unknown) {
    console.error('[blog/score-titles]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '채점 실패' },
      { status: 500 },
    );
  }
}
