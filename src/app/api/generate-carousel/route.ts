import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@/lib/supabase-server';

export interface CarouselCard {
  index: number;
  cardType: 'title' | 'keypoint' | 'quote' | 'cta';
  title: string;
  subtitle?: string;
  bullets?: string[];
  emoji?: string;
  bgColor: string;
}

export interface CarouselResult {
  cards: CarouselCard[];
  topic: string;
}

const BG_COLORS = [
  '#0f172a', '#111827', '#1a1a2e', '#16213e',
  '#0d1b2a', '#1b1b2e', '#131624', '#0f1923',
];

export async function POST(req: NextRequest) {
  try {
    const { script, llmModelId = 'qwen-plus' } = await req.json();
    if (!script?.trim()) {
      return NextResponse.json({ error: '대본이 없습니다' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const meta = user?.user_metadata ?? {};
    const geminiApiKey = meta.gemini_api_key as string | undefined;
    const qwenApiKey = meta.qwen_api_key as string | undefined;

    const isQwen = llmModelId.startsWith('qwen') || llmModelId.startsWith('deepseek');

    if (isQwen && !qwenApiKey) {
      return NextResponse.json({ error: 'DashScope API 키가 필요합니다', needsKey: true }, { status: 400 });
    }
    if (!isQwen && !geminiApiKey) {
      return NextResponse.json({ error: 'Gemini API 키가 필요합니다', needsKey: true }, { status: 400 });
    }

    const prompt = `당신은 SNS 캐러셀 콘텐츠 전문가입니다.

아래 영상 대본을 분석하여 인스타그램/링크드인 캐러셀(카드형 게시물)로 변환하세요.

규칙:
- 총 8~10장 카드 생성
- 1번 카드: 제목 카드 (title) — 강렬한 제목 + 부제목
- 2~8번 카드: 핵심 포인트 카드 (keypoint) — 각 카드당 핵심 문장 1개 + 불릿 2~3개
- 마지막 카드: CTA 카드 (cta) — 구독/팔로우/공유 유도
- 각 카드에 어울리는 이모지 1개 포함
- 한국어로 작성, 간결하고 임팩트 있게

반드시 아래 JSON 형식만 출력하세요 (다른 텍스트 없이):
{
  "topic": "대본의 핵심 주제 (10자 이내)",
  "cards": [
    {
      "index": 0,
      "cardType": "title",
      "title": "강렬한 제목",
      "subtitle": "부제목 한 줄",
      "emoji": "🎯"
    },
    {
      "index": 1,
      "cardType": "keypoint",
      "title": "핵심 포인트 제목",
      "bullets": ["포인트 1", "포인트 2", "포인트 3"],
      "emoji": "💡"
    },
    {
      "index": N,
      "cardType": "cta",
      "title": "마음에 드셨나요?",
      "subtitle": "팔로우하면 매주 이런 콘텐츠를 받을 수 있어요",
      "emoji": "🔔"
    }
  ]
}

대본:
${script}`;

    let raw = '';

    if (isQwen) {
      const effectiveModel = llmModelId.startsWith('qwen') ? llmModelId : 'qwen-plus';
      const res = await fetch('https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${qwenApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: effectiveModel,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
        }),
      });
      if (!res.ok) {
        const err = await res.text();
        return NextResponse.json({ error: `Qwen 캐러셀 생성 실패 (${res.status}): ${err}` }, { status: 500 });
      }
      const data = await res.json();
      raw = data.choices?.[0]?.message?.content ?? '';
    } else {
      const model = llmModelId.startsWith('google/') ? llmModelId.slice('google/'.length) : llmModelId;
      const ai = new GoogleGenAI({ apiKey: geminiApiKey });
      const response = await ai.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { responseMimeType: 'application/json' },
      });
      raw = response.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    }

    let parsed: CarouselResult;
    try {
      const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({ error: '캐러셀 데이터 파싱 실패' }, { status: 500 });
    }

    // bgColor 자동 배정
    const cards = parsed.cards.map((card, i) => ({
      ...card,
      bgColor: BG_COLORS[i % BG_COLORS.length],
    }));

    return NextResponse.json({ cards, topic: parsed.topic });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
