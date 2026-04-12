import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const FORMAT_PROMPTS: Record<string, string> = {
  twitter: `다음 대본을 트위터/X 스레드로 변환해주세요.
규칙:
- 5~8개 트윗으로 구성
- 각 트윗은 280자 이내
- 첫 트윗은 강력한 후킹으로 시작 (숫자, 질문, 충격적 사실)
- 각 트윗은 번호로 구분: 1/ 2/ 3/ ...
- 마지막 트윗은 팔로우 유도 CTA
- 이모지 적절히 사용`,

  linkedin: `다음 대본을 링크드인 포스트로 변환해주세요.
규칙:
- 전문적이고 통찰력 있는 톤
- 첫 줄은 스크롤을 멈추게 하는 강렬한 문장 (더보기 클릭 유도)
- 본문은 3~5개 핵심 인사이트 중심으로 줄바꿈 적극 활용
- 글머리 기호(•)나 번호 목록으로 가독성 향상
- 마지막에 질문으로 댓글 유도
- 관련 해시태그 5~7개 (영어+한국어 혼용)
- 총 1000~1500자`,

  instagram: `다음 대본을 인스타그램 캡션으로 변환해주세요.
규칙:
- 첫 2줄이 핵심 (더보기 전에 보이는 부분)
- 친근하고 감성적인 톤
- 핵심 내용을 3~5개 포인트로 정리
- 이모지를 각 포인트 앞에 사용
- 마지막에 저장/공유 유도 CTA
- 해시태그 20~30개 (관련성 높은 것 우선)
- 총 800~1200자`,

  tiktok: `다음 대본을 틱톡/쇼츠용 짧은 대본으로 변환해주세요.
규칙:
- 60초 이내 (약 200~250자)
- 첫 3초: 강렬한 후크 "이거 모르면 손해"/"나만 몰랐던" 형식
- 중간: 핵심 내용 1~2가지만 압축
- 마지막: 강력한 CTA ("저장해 놔" / "팔로우")
- 빠른 템포, 직접적 표현
- 구어체 사용`,

  blog_summary: `다음 대본을 블로그 요약 소개글로 변환해주세요.
규칙:
- 독자가 글을 읽고 싶게 만드는 도입부 (200~300자)
- 이 글에서 얻을 수 있는 것 3가지 bullet point
- SEO 키워드 자연스럽게 포함
- 마지막에 "자세히 읽기" 유도`,
};

export async function POST(req: NextRequest) {
  try {
    const { content, formats } = await req.json();
    if (!content?.trim()) {
      return NextResponse.json({ error: '대본 내용이 필요합니다' }, { status: 400 });
    }

    const targetFormats: string[] = formats ?? Object.keys(FORMAT_PROMPTS);
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const results: Record<string, string> = {};

    await Promise.all(
      targetFormats.map(async (fmt) => {
        const prompt = FORMAT_PROMPTS[fmt];
        if (!prompt) return;
        const res = await client.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: prompt },
            { role: 'user', content: `---대본---\n${content.slice(0, 6000)}` },
          ],
          max_tokens: 1500,
          temperature: 0.7,
        });
        results[fmt] = res.choices[0]?.message?.content ?? '';
      })
    );

    return NextResponse.json({ results });
  } catch (err: unknown) {
    console.error('[reformat]', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : '변환 실패' }, { status: 500 });
  }
}
