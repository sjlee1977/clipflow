import { NextRequest, NextResponse } from 'next/server';
import { generateSpeech as minimaxTTS } from '@/lib/minimax-tts';
import { generateSpeechBuffer as googleTTS } from '@/lib/google';
import { createClient } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  try {
    const { text, voiceId = 'Korean_SoothingLady', ttsProvider = 'minimax' } = await req.json();
    if (!text) return NextResponse.json({ error: '텍스트를 입력해주세요' }, { status: 400 });

    // 유저 API 키 조회
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const meta = user?.user_metadata ?? {};

    let buffer: Buffer;
    let contentType: string;

    const googleKey = meta.gemini_api_key || process.env.GEMINI_API_KEY;
    const minimaxKey = meta.minimax_api_key || process.env.MINIMAX_API_KEY;
    const elevenKey = meta.elevenlabs_api_key;

    if (ttsProvider === 'google') {
      if (!googleKey) return NextResponse.json({ error: 'Google(Gemini) API 키가 설정되지 않았습니다. 설정에서 키를 등록해주세요.' }, { status: 403 });
      const result = await googleTTS(text, voiceId, googleKey);
      buffer = result.buffer;
      contentType = 'audio/wav';
    } else if (ttsProvider === 'elevenlabs') {
      if (!elevenKey) return NextResponse.json({ error: 'ElevenLabs API 키가 설정되지 않았습니다. 설정에서 키를 등록해주세요.' }, { status: 403 });
      const { generateSpeechBuffer: elevenTTS } = await import('@/lib/elevenlabs');
      const result = await elevenTTS(text, voiceId, elevenKey);
      buffer = result.buffer;
      contentType = 'audio/mpeg';
    } else {
      if (!minimaxKey) return NextResponse.json({ error: 'Minimax API 키가 설정되지 않았습니다. 설정에서 키를 등록해주세요.' }, { status: 403 });
      const result = await minimaxTTS(text, { 
        voiceId, 
        apiKey: minimaxKey, 
        groupId: meta.minimax_group_id || process.env.MINIMAX_GROUP_ID
      });
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
