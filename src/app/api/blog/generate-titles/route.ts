/**
 * SEO 최적화 블로그 제목 생성
 *
 * POST /api/blog/generate-titles
 *
 * Body:
 *   keyword           메인 키워드 (필수)
 *   seoPlatform       'naver' | 'google' (기본: 'naver')
 *   searchVolume      월간 검색량 (선택)
 *   competition       광고 경쟁도 '낮음'|'중간'|'높음' (선택)
 *   contentSaturation 월간 신규 발행량 (선택)
 *   trendDirection    '상승'|'하락'|'보합' (선택)
 *   relatedKeywords   연관 키워드 배열 (선택)
 *   llmModelId        AI 모델 ID (선택, 기본 자동)
 */
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase-server';

export interface TitleOption {
  title:    string;
  hookType: '질문형' | '숫자형' | '충격형' | '약속형' | '비교형';
  seoScore: number;
  reason:   string;
}

// ── LLM 호출 ──────────────────────────────────────────────────────────────────
async function callModel(
  model:   string,
  apiKeys: Record<string, string>,
  system:  string,
  user:    string,
): Promise<string> {
  const isClaude = model.startsWith('claude');
  const isQwen   = model.startsWith('qwen');
  const isOpenAI = model.startsWith('gpt');

  if (isClaude) {
    const client = new Anthropic({ apiKey: apiKeys.anthropic });
    const res = await client.messages.create({
      model, max_tokens: 1200, temperature: 0.8,
      system,
      messages: [{ role: 'user', content: user }],
    });
    return res.content[0]?.type === 'text' ? res.content[0].text : '';
  }

  if (isOpenAI) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKeys.openai}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model, max_tokens: 1200, temperature: 0.8,
        response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`OpenAI 오류: ${data?.error?.message ?? res.status}`);
    return data.choices?.[0]?.message?.content ?? '';
  }

  if (isQwen) {
    const res = await fetch('https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKeys.qwen}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model, max_tokens: 1200, temperature: 0.8,
        response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`Qwen 오류: ${data?.error?.message ?? res.status}`);
    return data.choices?.[0]?.message?.content ?? '';
  }

  // Gemini (default)
  const ai = new GoogleGenAI({ apiKey: apiKeys.gemini });
  const response = await ai.models.generateContent({
    model,
    contents: [{ role: 'user', parts: [{ text: user }] }],
    config: {
      systemInstruction: system,
      maxOutputTokens: 1200,
      temperature: 0.8,
      responseMimeType: 'application/json',
    },
  });
  return response.text ?? '';
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
    const {
      keyword,
      seoPlatform       = 'naver',
      searchVolume,
      competition,
      contentSaturation,
      trendDirection,
      relatedKeywords,
      llmModelId,
    } = await req.json();

    if (!keyword?.trim()) {
      return NextResponse.json({ error: '키워드가 필요합니다' }, { status: 400 });
    }

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

    let model = llmModelId ?? '';
    if (!model) {
      if (apiKeys.gemini)         model = 'gemini-2.5-flash';
      else if (apiKeys.anthropic) model = 'claude-haiku-4-5-20251001';
      else if (apiKeys.openai)    model = 'gpt-4.1';
      else if (apiKeys.qwen)      model = 'qwen3.5-flash';
      else return NextResponse.json({ error: 'API 키가 없습니다' }, { status: 400 });
    }

    const platform     = seoPlatform === 'google' ? '구글' : '네이버';
    const platformHint = seoPlatform === 'google'
      ? '구글 SEO 원칙: 제목 앞에 핵심 키워드 배치, 명확한 혜택/숫자 제시, 50~70자 권장'
      : '네이버 SEO 원칙: 질문형·정보성·생활 밀착형, 핵심 키워드 자연스럽게 포함, 30~50자 권장';

    const systemPrompt = `당신은 한국 디지털 마케팅 SEO 전문가입니다.
주어진 키워드와 리서치 데이터를 바탕으로 ${platform} SEO 최적화 블로그 제목 5개를 생성합니다.

${platformHint}

훅 유형 가이드:
- 질문형: "~를 알고 계신가요?", "왜 ~일까요?" — 독자의 호기심 자극
- 숫자형: "N가지 ~", "N개월 만에 ~" — 구체성과 신뢰도 확보
- 충격형: "~의 충격적 진실", "아무도 말 안 하는 ~" — 강렬한 첫 인상
- 약속형: "N분이면 ~", "~하는 방법 완전 정복" — 명확한 가치 제시
- 비교형: "~ vs ~", "~ 차이점 총정리" — 결정을 못하는 독자 공략

SEO 점수 기준 (0~100):
- 키워드 포함 여부 (+20)
- 적정 길이 준수 (+20)
- 클릭 유발 훅 강도 (+30)
- 검색 의도 매칭 (+30)

반드시 순수 JSON만 출력. 마크다운 코드블록 없이.`;

    const lines: string[] = [`키워드: "${keyword.trim()}"`];
    if (searchVolume)      lines.push(`월간 검색량: ${Number(searchVolume).toLocaleString()}회`);
    if (competition)       lines.push(`광고 경쟁도: ${competition}`);
    if (contentSaturation) lines.push(`월간 신규 발행: ${Number(contentSaturation).toLocaleString()}건`);
    if (trendDirection)    lines.push(`트렌드: ${trendDirection}`);
    if (Array.isArray(relatedKeywords) && relatedKeywords.length > 0) {
      lines.push(`연관 키워드: ${relatedKeywords.slice(0, 6).join(', ')}`);
    }

    const userPrompt = `${lines.join('\n')}

위 데이터를 활용해 클릭률 높은 ${platform} SEO 최적화 제목 5개를 생성하세요.

{
  "titles": [
    { "title": "제목 텍스트", "hookType": "질문형", "seoScore": 88, "reason": "이유 (25자 이내)" },
    { "title": "...", "hookType": "숫자형", "seoScore": 85, "reason": "..." },
    { "title": "...", "hookType": "충격형", "seoScore": 82, "reason": "..." },
    { "title": "...", "hookType": "약속형", "seoScore": 90, "reason": "..." },
    { "title": "...", "hookType": "비교형", "seoScore": 79, "reason": "..." }
  ]
}`;

    let titles: TitleOption[] = [];
    try {
      const raw    = await callModel(model, apiKeys, systemPrompt, userPrompt);
      const parsed = safeJson<{ titles?: TitleOption[] }>(raw, { titles: [] });
      titles = (parsed.titles ?? []).slice(0, 5).filter(t => t.title?.trim());
    } catch { /* LLM 실패 시 fallback */ }

    // 제목이 없으면 키워드 기반 기본 제목 반환
    if (titles.length === 0) {
      titles = [
        { title: `${keyword} 완벽 정리 — 핵심만 골라 드립니다`,  hookType: '약속형', seoScore: 72, reason: '키워드 직접 포함' },
        { title: `${keyword}이란? 쉽게 이해하는 5가지 포인트`,   hookType: '숫자형', seoScore: 70, reason: '숫자형 + 질문형' },
        { title: `아직도 ${keyword} 헷갈리세요? 3분 정리`,       hookType: '충격형', seoScore: 75, reason: '공감 + 시간 약속' },
        { title: `${keyword} 신청 방법 A to Z 완전 가이드`,      hookType: '약속형', seoScore: 68, reason: '정보성 제목' },
        { title: `${keyword} vs 차상위계층 차이점 총정리`,        hookType: '비교형', seoScore: 65, reason: '비교형 제목' },
      ] as TitleOption[];
    }

    return NextResponse.json({ titles });
  } catch (err: unknown) {
    console.error('[blog/generate-titles]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '제목 생성 실패' },
      { status: 500 },
    );
  }
}
