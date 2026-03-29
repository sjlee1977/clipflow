import { NextRequest, NextResponse } from 'next/server';
import { generateSpeechToS3 } from '@/lib/minimax-tts';
import { generateSpeech as googleTTSToS3 } from '@/lib/google';
import { startRender } from '@/lib/remotion';
import { createClient } from '@/lib/supabase-server';

const FPS = 30;
const PADDING_FRAMES = 15; // 오디오 끝 후 0.5초 여유

/** 텍스트를 1~2행(최대 20자) 단위로 분할 후 프레임 비례 배분 */
function splitIntoSubtitles(text: string, totalFrames: number) {
  const MAX_CHARS = 20;
  const chunks: string[] = [];
  let remaining = text.trim();

  while (remaining.length > MAX_CHARS) {
    let splitAt = -1;
    for (let i = MAX_CHARS; i >= Math.ceil(MAX_CHARS / 2); i--) {
      if (/[.!?,。！？，\s]/.test(remaining[i] ?? '')) {
        splitAt = i + 1;
        break;
      }
    }
    if (splitAt === -1) splitAt = MAX_CHARS;
    chunks.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }
  if (remaining) chunks.push(remaining);

  const totalChars = chunks.reduce((sum, c) => sum + c.length, 0);
  let currentFrame = 0;
  return chunks.map((chunk, i) => {
    const isLast = i === chunks.length - 1;
    const frames = isLast
      ? totalFrames - currentFrame
      : Math.max(15, Math.round((chunk.length / totalChars) * totalFrames));
    const entry = { text: chunk, startFrame: currentFrame, endFrame: currentFrame + frames };
    currentFrame += frames;
    return entry;
  });
}

export async function POST(req: NextRequest) {
  try {
    const {
      scenes: inputScenes,
      voiceId = 'Korean_SoothingLady',
      speed = 1.0,
      format = 'shorts',
      ttsProvider = 'minimax',
    } = await req.json();

    if (!Array.isArray(inputScenes) || inputScenes.length === 0) {
      return NextResponse.json({ error: '장면 데이터가 없습니다' }, { status: 400 });
    }

    // 유저 API 키 조회
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const meta = user?.user_metadata ?? {};

    const ts = Date.now();

    // 1. TTS 생성
    type SceneInput = { 
      text: string; 
      imageUrl: string; 
      videoUrl?: string;
      textAnimationStyle?: 'none' | 'typewriter' | 'fly-in' | 'pop-in' | 'fade-zoom';
      textPosition?: 'bottom' | 'center' | 'top';
    };
    
    async function processTTS(s: SceneInput, i: number) {
      let audioUrl: string;
      let durationMs: number;
      
      if (ttsProvider === 'google') {
        ({ url: audioUrl, durationMs } = await googleTTSToS3(s.text, `scene-${ts}-${i}`, voiceId, speed, meta.gemini_api_key));
      } else if (ttsProvider === 'elevenlabs') {
        const { generateSpeechToS3: elevenTTSToS3 } = await import('@/lib/elevenlabs');
        ({ url: audioUrl, durationMs } = await elevenTTSToS3(s.text, `scene-${ts}-${i}`, { voiceId, speed, apiKey: meta.elevenlabs_api_key }));
      } else {
        ({ url: audioUrl, durationMs } = await generateSpeechToS3(s.text, `scene-${ts}-${i}`, { voiceId, speed, apiKey: meta.minimax_api_key, groupId: meta.minimax_group_id }));
      }
      
      let durationInFrames = Math.max(60, Math.round((durationMs / 1000) * FPS) + PADDING_FRAMES);

      if (s.videoUrl) {
        durationInFrames = Math.max(durationInFrames, 150);
      }

      return {
        imageUrl: s.imageUrl,
        videoUrl: s.videoUrl,
        audioUrl,
        durationInFrames,
        subtitles: splitIntoSubtitles(s.text, durationInFrames),
        textAnimationStyle: s.textAnimationStyle,
        textPosition: s.textPosition,
      };
    }

    let scenes: any[] = [];
    if (ttsProvider === 'google') {
      for (let i = 0; i < inputScenes.length; i++) {
        scenes.push(await processTTS(inputScenes[i], i));
      }
    } else {
      const CHUNK_SIZE = 5;
      for (let i = 0; i < inputScenes.length; i += CHUNK_SIZE) {
        const chunk = inputScenes.slice(i, i + CHUNK_SIZE);
        const results = await Promise.all(
          chunk.map((s: SceneInput, j: number) => processTTS(s, i + j))
        );
        scenes.push(...results);
      }
    }

    // 2. Remotion Lambda 렌더링 시작
    const compositionId = format === 'landscape' ? 'ClipFlowLandscape' : format === 'square' ? 'ClipFlowSquare' : 'ClipFlowShorts';
    const { renderId, bucketName } = await startRender({
      compositionId,
      inputProps: { scenes, fps: FPS },
    });

    return NextResponse.json({ renderId, bucketName });
  } catch (err: unknown) {
    console.error('[generate-video]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '영상 생성 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
