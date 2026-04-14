import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@/lib/supabase-server';

function getProvider(modelId: string): 'gemini' | 'claude' | 'qwen' {
  if (modelId.startsWith('gemini')) return 'gemini';
  if (modelId.startsWith('claude')) return 'claude';
  return 'qwen';
}

function extractJSON(text: string): string {
  let s = text.trim();
  const match = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) s = match[1].trim();
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start !== -1 && end !== -1) return s.slice(start, end + 1);
  return s;
}

function parseAIError(err: unknown): string {
  if (!(err instanceof Error)) return '분석 중 오류가 발생했습니다';
  try {
    const parsed = JSON.parse(err.message);
    const code = parsed?.error?.code ?? parsed?.error?.status;
    const msg: string = parsed?.error?.message ?? '';
    if (code === 429 || msg.includes('spending cap') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota')) {
      return 'API 월간 사용량이 초과됐습니다. 해당 서비스에서 한도를 확인해주세요.';
    }
    if (code === 401 || code === 403) return 'API 키가 올바르지 않습니다. 설정 페이지에서 확인해주세요.';
    if (msg) return msg;
  } catch { /* not JSON */ }
  const m = err.message;
  if (m.includes('spending cap') || m.includes('RESOURCE_EXHAUSTED') || m.includes('quota')) {
    return 'API 월간 사용량이 초과됐습니다. 해당 서비스에서 한도를 확인해주세요.';
  }
  if (m.includes('401') || m.includes('403') || m.includes('Unauthorized') || m.includes('Forbidden')) {
    return 'API 키가 올바르지 않습니다. 설정 페이지에서 확인해주세요.';
  }
  return m || '분석 중 오류가 발생했습니다';
}

async function callAI(
  modelId: string,
  prompt: string,
  keys: { gemini?: string; claude?: string; qwen?: string }
): Promise<string> {
  const provider = getProvider(modelId);

  if (provider === 'gemini') {
    if (!keys.gemini) throw new Error('Google Gemini API 키가 설정되지 않았습니다. 설정 페이지에서 등록해주세요.');
    const ai = new GoogleGenAI({ apiKey: keys.gemini });
    const res = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: { responseMimeType: 'application/json', temperature: 0.3 },
    });
    return res.text ?? '';
  }

  if (provider === 'claude') {
    if (!keys.claude) throw new Error('Anthropic API 키가 설정되지 않았습니다. 설정 페이지에서 등록해주세요.');
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': keys.claude.trim(),
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: modelId,
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message ?? `Claude 오류 (${res.status})`);
    }
    const data = await res.json();
    return extractJSON(data.content?.[0]?.text ?? '');
  }

  // Qwen (DashScope)
  if (!keys.qwen) throw new Error('Qwen API 키가 설정되지 않았습니다. 설정 페이지에서 등록해주세요.');
  const res = await fetch('https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${keys.qwen.trim()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modelId,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Qwen 오류 (${res.status}): ${errText}`);
  }
  const data = await res.json();
  return extractJSON(data.choices?.[0]?.message?.content ?? '');
}

const CATEGORY_SCHEMAS: Record<string, { description: string; fields: Record<string, string> }> = {
  general: {
    description: '일반 유튜브 채널 대본 요청서',
    fields: {
      topic: '시청자가 클릭하고 싶은 구체적인 제목 형태 (한 줄)',
      angle: '이 영상만의 핵심 인사이트 또는 대부분이 모르는 반전 포인트 (1~3문장)',
      genContent: '영상에서 다루는 주요 내용·사실·데이터·사례를 줄바꿈으로 정리 (없으면 빈 문자열)',
      genPoint1: '영상의 첫 번째 핵심 포인트 (없으면 빈 문자열)',
      genPoint2: '영상의 두 번째 핵심 포인트 (없으면 빈 문자열)',
      genPoint3: '영상의 세 번째 핵심 포인트 (없으면 빈 문자열)',
      genCaution: '영상에서 언급된 주의사항·반론·예외 케이스 (없으면 빈 문자열)',
      genReference: '영상에서 언급된 참고 자료·사례·출처 (없으면 빈 문자열)',
      genAudience: '영상이 타겟하는 시청자층 및 말투/톤 특징 (없으면 빈 문자열)',
      hookStyle: '도입부의 훅 스타일 — "도발적 질문형(A형)", "충격 수치형(B형)", "착각 지적형(C형)" 중 감지된 것과 첫 문장의 핵심 소재를 한 줄로 (없으면 빈 문자열)',
      differentiation: '이 대본만의 독특한 관점이나 차별점 — 유사 콘텐츠와 다르게 접근한 부분을 2~3줄로 (없으면 빈 문자열)',
      videoLength: '대본 분량을 추정하여 아래 보기 중 하나만 정확히 출력: "5분 내외 (3,000자 이상)" 또는 "10분 내외 (5,000자 이상)" 또는 "15분 내외 (7,000자 이상)" 또는 "20분 이상 (9,000자 이상)"',
    },
  },
  economy: {
    description: '경제/주식 유튜브 채널 대본 요청서',
    fields: {
      topic: '시청자가 클릭하고 싶은 구체적인 제목 형태 (한 줄)',
      angle: '대부분이 잘못 알고 있는 것 또는 핵심 인사이트 (1~3문장)',
      econData: '대본에서 언급된 날짜·지수·환율·수급 등 핵심 수치를 줄바꿈으로 정리 (없으면 빈 문자열)',
      econBullish: '대본에서 언급된 낙관적 시나리오 또는 상승 조건 (없으면 빈 문자열)',
      econNeutral: '대본에서 언급된 중립 분석 또는 박스권 전망 (없으면 빈 문자열)',
      econBearish: '대본에서 언급된 비관적 시나리오 또는 하락 리스크 (없으면 빈 문자열)',
      econRisk: '대본에서 언급된 리스크 발동 조건과 영향 경로 (없으면 빈 문자열)',
      econSector: '대본에서 언급된 주목 종목·섹터·자산 (없으면 빈 문자열)',
      econIndicator: '대본에서 언급된 체크해야 할 지표와 기준선 (없으면 빈 문자열)',
      hookStyle: '도입부의 훅 스타일 — "도발적 질문형(A형)", "충격 수치형(B형)", "착각 지적형(C형)" 중 감지된 것과 첫 문장의 핵심 소재를 한 줄로 (없으면 빈 문자열)',
      differentiation: '이 대본만의 독특한 관점이나 차별점 (없으면 빈 문자열)',
      videoLength: '대본 분량을 추정하여 아래 보기 중 하나만 정확히 출력: "5분 내외 (3,000자 이상)" 또는 "10분 내외 (5,000자 이상)" 또는 "15분 내외 (7,000자 이상)" 또는 "20분 이상 (9,000자 이상)"',
    },
  },
  history: {
    description: '역사 유튜브 채널 대본 요청서',
    fields: {
      topic: '시청자가 클릭하고 싶은 구체적인 제목 형태 (한 줄)',
      angle: '이 역사 주제의 핵심 인사이트 또는 대부분이 모르는 반전 (1~3문장)',
      histEra: '대본에서 다루는 시대·사건·배경을 줄바꿈으로 정리',
      histConnect: '이 역사적 사건이 현재 우리에게 왜 중요한지 (없으면 빈 문자열)',
      histPattern: '대본에서 언급된 반복되는 역사 패턴 (없으면 빈 문자열)',
      histFacts: '대본에서 언급된 핵심 수치·팩트를 줄바꿈으로 정리 (없으면 빈 문자열)',
      histLesson: '시청자가 가져갈 교훈 한 줄 (없으면 빈 문자열)',
      hookStyle: '도입부의 훅 스타일 — "도발적 질문형(A형)", "충격 수치형(B형)", "착각 지적형(C형)" 중 감지된 것과 첫 문장의 핵심 소재를 한 줄로 (없으면 빈 문자열)',
      differentiation: '이 대본만의 독특한 관점이나 차별점 (없으면 빈 문자열)',
      videoLength: '대본 분량을 추정하여 아래 보기 중 하나만 정확히 출력: "5분 내외 (3,000자 이상)" 또는 "10분 내외 (5,000자 이상)" 또는 "15분 내외 (7,000자 이상)" 또는 "20분 이상 (9,000자 이상)"',
    },
  },
  psychology: {
    description: '심리학 유튜브 채널 대본 요청서',
    fields: {
      topic: '시청자가 클릭하고 싶은 구체적인 제목 형태 (한 줄)',
      angle: '이 심리 현상의 핵심 인사이트 또는 대부분이 모르는 반전 (1~3문장)',
      psychPhenomenon: '대본에서 다루는 핵심 심리 현상 이름과 정의',
      psychResearch: '대본에서 언급된 연구자명·실험명·연도·결과 수치 (없으면 빈 문자열)',
      psychApplication: '대본에서 언급된 일상 적용 사례 (없으면 빈 문자열)',
      psychBehavior: '대본에서 제안하는 행동 변화 포인트 (없으면 빈 문자열)',
      hookStyle: '도입부의 훅 스타일 — "도발적 질문형(A형)", "충격 수치형(B형)", "착각 지적형(C형)" 중 감지된 것과 첫 문장의 핵심 소재를 한 줄로 (없으면 빈 문자열)',
      differentiation: '이 대본만의 독특한 관점이나 차별점 (없으면 빈 문자열)',
      videoLength: '대본 분량을 추정하여 아래 보기 중 하나만 정확히 출력: "5분 내외 (3,000자 이상)" 또는 "10분 내외 (5,000자 이상)" 또는 "15분 내외 (7,000자 이상)" 또는 "20분 이상 (9,000자 이상)"',
    },
  },
  horror: {
    description: '공포 유튜브 채널 대본 요청서',
    fields: {
      topic: '시청자가 클릭하고 싶은 구체적인 제목 형태 (한 줄)',
      angle: '시청자가 예상 못 한 반전 또는 핵심 공포 포인트 (1~3문장)',
      horrorMaterial: '대본에서 다루는 공포 소재·배경·상황을 줄바꿈으로 정리',
      horrorTwist: '대본의 핵심 반전 포인트 (없으면 빈 문자열)',
      horrorTension: '대본에서 긴장감을 고조시키는 구간 설정 (없으면 빈 문자열)',
      horrorFact: '대본에서 언급된 충격적인 수치·사실 (없으면 빈 문자열)',
      horrorEnding: '대본의 마무리 방향 또는 메시지 한 줄 (없으면 빈 문자열)',
      hookStyle: '도입부의 훅 스타일 — "도발적 질문형(A형)", "충격 수치형(B형)", "착각 지적형(C형)" 중 감지된 것과 첫 문장의 핵심 소재를 한 줄로 (없으면 빈 문자열)',
      differentiation: '이 대본만의 독특한 관점이나 차별점 (없으면 빈 문자열)',
      videoLength: '대본 분량을 추정하여 아래 보기 중 하나만 정확히 출력: "5분 내외 (3,000자 이상)" 또는 "10분 내외 (5,000자 이상)" 또는 "15분 내외 (7,000자 이상)" 또는 "20분 이상 (9,000자 이상)"',
    },
  },
  health: {
    description: '건강 유튜브 채널 대본 요청서',
    fields: {
      topic: '시청자가 클릭하고 싶은 구체적인 제목 형태 (한 줄)',
      angle: '대중의 잘못된 상식을 뒤집는 핵심 인사이트 (1~3문장)',
      healthTopic: '대본에서 다루는 건강 주제와 핵심 현상을 줄바꿈으로 정리',
      healthResearch: '대본에서 언급된 연구기관·논문·수치 (없으면 빈 문자열)',
      healthMisconception: '대본에서 뒤집는 잘못된 상식 (없으면 빈 문자열)',
      healthAction: '대본에서 제안하는 실천 행동 지침 (없으면 빈 문자열)',
      healthCaution: '대본에서 언급된 주의사항·면책 내용 (없으면 빈 문자열)',
      hookStyle: '도입부의 훅 스타일 — "도발적 질문형(A형)", "충격 수치형(B형)", "착각 지적형(C형)" 중 감지된 것과 첫 문장의 핵심 소재를 한 줄로 (없으면 빈 문자열)',
      differentiation: '이 대본만의 독특한 관점이나 차별점 (없으면 빈 문자열)',
      videoLength: '대본 분량을 추정하여 아래 보기 중 하나만 정확히 출력: "5분 내외 (3,000자 이상)" 또는 "10분 내외 (5,000자 이상)" 또는 "15분 내외 (7,000자 이상)" 또는 "20분 이상 (9,000자 이상)"',
    },
  },
};

export async function POST(req: NextRequest) {
  try {
    const { script, category = 'general', modelId = 'gemini-2.5-flash' } = await req.json();
    if (!script || typeof script !== 'string' || !script.trim()) {
      return NextResponse.json({ error: '대본을 입력해주세요' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const meta = user?.user_metadata ?? {};
    const keys = {
      gemini: meta.gemini_api_key as string | undefined,
      claude: meta.anthropic_api_key as string | undefined,
      qwen: meta.qwen_api_key as string | undefined,
    };

    const provider = getProvider(modelId);
    const keyMap = { gemini: keys.gemini, claude: keys.claude, qwen: keys.qwen };
    if (!keyMap[provider]) {
      const names = { gemini: 'Google Gemini', claude: 'Anthropic', qwen: 'Qwen' };
      return NextResponse.json(
        { error: `${names[provider]} API 키가 설정되지 않았습니다. 설정 페이지에서 등록해주세요.` },
        { status: 403 }
      );
    }

    const isAutoMode = category === 'auto';
    const scriptForAI = script.slice(0, 10000);

    let resolvedCategory = category;
    if (isAutoMode) {
      const detectPrompt = `아래 대본을 보고 가장 적합한 카테고리 하나만 골라줘.
선택지: economy(경제/주식), history(역사), psychology(심리학), horror(공포), health(건강), general(기타/해당없음)
반드시 아래 JSON 형식으로만 응답해 (다른 텍스트 없이):
{"category": "선택한_카테고리"}

대본 일부:
${scriptForAI.slice(0, 2000)}`;

      try {
        const detectText = await callAI(modelId, detectPrompt, keys);
        const detected = JSON.parse(extractJSON(detectText));
        resolvedCategory = detected.category && CATEGORY_SCHEMAS[detected.category]
          ? detected.category
          : 'general';
      } catch {
        resolvedCategory = 'general';
      }
    }

    const schema = CATEGORY_SCHEMAS[resolvedCategory] ?? CATEGORY_SCHEMAS.general;
    const jsonSchema = Object.entries(schema.fields)
      .map(([key, desc]) => `  "${key}": "${desc}"`)
      .join(',\n');

    const prompt = `당신은 유튜브 대본 분석 전문가입니다.
아래 대본을 분석하여 [${schema.description}] 작성에 필요한 정보를 추출하세요.

**중요: 모든 출력은 반드시 한국어로 작성하세요.**
**내용이 없는 필드는 반드시 빈 문자열("")로 두세요. 추측하거나 지어내지 마세요.**

반드시 아래 JSON 형식으로만 응답하세요 (다른 텍스트 없이):
{
${jsonSchema}
}

대본:
${scriptForAI}`;

    const content = await callAI(modelId, prompt, keys);
    if (!content) throw new Error('AI 응답 없음');

    const parsed = JSON.parse(extractJSON(content));
    return NextResponse.json({
      ...parsed,
      detectedCategory: isAutoMode ? resolvedCategory : undefined,
    });
  } catch (err: unknown) {
    if (err instanceof SyntaxError) {
      return NextResponse.json({ error: 'AI 응답 파싱 실패. 다시 시도해주세요.' }, { status: 500 });
    }
    return NextResponse.json({ error: parseAIError(err) }, { status: 500 });
  }
}
