import { NextRequest, NextResponse } from 'next/server';
import { splitScriptIntoScenes, generateImage } from '@/lib/google';

export async function POST(req: NextRequest) {
  try {
    const {
      script,
      imageStylePrompt = '',
      characterBase64 = '',
      characterMimeType = '',
    } = await req.json();

    if (!script || typeof script !== 'string') {
      return NextResponse.json({ error: '대본을 입력해주세요' }, { status: 400 });
    }

    const scriptScenes = await splitScriptIntoScenes(script);

    const scenes = await Promise.all(
      scriptScenes.map(async (s) => {
        const imageUrl = await generateImage(s.imagePrompt, {
          stylePrompt: imageStylePrompt,
          characterBase64: characterBase64 || undefined,
          characterMimeType: characterMimeType || undefined,
        });
        return { text: s.text, imageUrl };
      })
    );

    return NextResponse.json({ scenes });
  } catch (err: unknown) {
    console.error('[generate-scenes]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '장면 생성 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
