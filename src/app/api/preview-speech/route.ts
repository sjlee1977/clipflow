import { NextRequest, NextResponse } from 'next/server';
import { generateSpeech as minimaxTTS } from '@/lib/minimax-tts';
import { generateSpeechBuffer as googleTTS } from '@/lib/google';

export async function POST(req: NextRequest) {
  try {
    const { text, voiceId = 'Korean_SoothingLady', ttsProvider = 'minimax' } = await req.json();
    if (!text) return NextResponse.json({ error: '텍스트를 입력해주세요' }, { status: 400 });

    let buffer: Buffer;
    let contentType: string;

    if (ttsProvider === 'google') {
      const result = await googleTTS(text, voiceId);
      buffer = result.buffer;
      contentType = 'audio/wav';
    } else {
      const result = await minimaxTTS(text, { voiceId });
      buffer = result.buffer;
      contentType = 'audio/mpeg';
    }

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': contentType,
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
