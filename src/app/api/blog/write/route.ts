import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const BLOG_SYSTEM_PROMPT = `당신은 전문 블로그 작가입니다. 주어진 내용을 바탕으로 독자가 흥미롭게 읽을 수 있는 블로그 포스트를 작성합니다.

작성 규칙:
- 마크다운 형식으로 작성 (## 제목, ### 소제목, **굵게**, *기울임*, - 목록)
- 도입부: 독자의 흥미를 끄는 후킹 문장으로 시작
- 본문: 핵심 내용을 논리적으로 구조화, 소제목으로 구분
- 결론: 핵심 요약 + 독자에게 행동 유도
- 자연스럽고 친근한 한국어 문체
- SEO를 고려한 키워드 자연스럽게 포함
- 길이: 800~1500자 (요청에 따라 조정)`;

export async function POST(req: NextRequest) {
  try {
    const { content, title, tone = 'friendly', length = 'medium', customPrompt } = await req.json();

    if (!content && !customPrompt) {
      return NextResponse.json({ error: '내용이 필요합니다' }, { status: 400 });
    }

    const toneMap: Record<string, string> = {
      friendly: '친근하고 대화체',
      professional: '전문적이고 격식체',
      casual: '편안하고 자유로운',
      educational: '교육적이고 설명적인',
    };

    const lengthMap: Record<string, string> = {
      short: '500~800자',
      medium: '800~1500자',
      long: '1500~3000자',
    };

    const userMessage = customPrompt
      ? customPrompt
      : `다음 내용을 ${toneMap[tone] || '친근한'} 문체로 ${lengthMap[length] || '800~1500자'} 분량의 블로그 포스트로 작성해주세요.${title ? `\n\n참고 제목: ${title}` : ''}

---원본 내용---
${content.slice(0, 8000)}`;

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: BLOG_SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      max_tokens: 3000,
      temperature: 0.7,
    });

    const blogContent = response.choices[0]?.message?.content || '';

    // 제목 추출 (첫 번째 # 헤딩)
    const titleMatch = blogContent.match(/^#\s+(.+)$/m);
    const extractedTitle = titleMatch ? titleMatch[1] : title || '블로그 포스트';

    return NextResponse.json({
      content: blogContent,
      title: extractedTitle,
      tokens: response.usage?.total_tokens,
    });
  } catch (err: unknown) {
    console.error('[blog/write]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '블로그 작성 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
