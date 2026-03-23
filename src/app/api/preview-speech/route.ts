import { NextRequest, NextResponse } from 'next/server';
import { generateSpeech } from '@/lib/minimax-tts';

export async function POST(req: NextRequest) {
  try {
    const { text, voiceId = 'female-yujie' } = await req.json();
    if (!text) return NextResponse.json({ error: '텍스트를 입력해주세요' }, { status: 400 });

    const { buffer } = await generateSpeech(text, { voiceId });

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': buffer.length.toString(),
      },
    });
  } catch (err: unknown) {
    console.error('[preview-speech]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'TTS 오류' },
      { status: 500 }
    );
  }
}
