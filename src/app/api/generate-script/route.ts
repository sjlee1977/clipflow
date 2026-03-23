import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { topic, scriptType, tone, keywords, targetAudience, llmModelId } = await req.json();
    if (!topic) return NextResponse.json({ error: '주제를 입력해주세요' }, { status: 400 });

    const typeLabels: Record<string, string> = {
      shorts: '쇼츠/릴스 (60초 이내 숏폼)',
      youtube: '유튜브 (3~10분 분량)',
      ad: '광고 (15~30초 임팩트)',
      edu: '교육/설명 (정보 전달형)',
      story: '스토리텔링 (감성 내러티브)',
    };
    const toneLabels: Record<string, string> = {
      professional: '전문적', casual: '친근한', emotional: '감성적', funny: '유머러스', dramatic: '드라마틱',
    };

    const userPrompt = `다음 조건으로 영상 대본을 작성해주세요:
- 주제: ${topic}
- 영상 유형: ${typeLabels[scriptType] ?? scriptType}
- 톤/분위기: ${toneLabels[tone] ?? tone}
${keywords ? `- 핵심 키워드: ${keywords}` : ''}
${targetAudience ? `- 타겟 시청자: ${targetAudience}` : ''}

나레이션/자막으로 바로 사용 가능하도록 자연스럽게 작성하세요. 마크다운 없이 순수 텍스트로만 작성하세요.`;

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://clipflow.app',
        'X-Title': 'ClipFlow',
      },
      body: JSON.stringify({
        model: llmModelId ?? 'deepseek/deepseek-chat-v3-0324',
        messages: [
          { role: 'system', content: '당신은 전문 영상 대본 작가입니다. 사용자 요청에 맞는 영상 대본을 작성하세요.' },
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || '대본 생성 실패');
    const script = data.choices?.[0]?.message?.content;
    if (!script) throw new Error('응답 없음');

    return NextResponse.json({ script });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '대본 생성 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
