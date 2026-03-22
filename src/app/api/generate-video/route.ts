import { NextRequest, NextResponse } from 'next/server';
import { generateSpeech, estimateSubtitles } from '@/lib/google';
import { startRender, waitForRender } from '@/lib/remotion';
import { Scene } from '@/remotion/types';

const FPS = 30;
const CHARS_PER_SECOND = 4.5;

export async function POST(req: NextRequest) {
  try {
    const {
      scenes: inputScenes,
      format = 'shorts',
      voice = 'Kore',
    } = await req.json();

    if (!Array.isArray(inputScenes) || inputScenes.length === 0) {
      return NextResponse.json({ error: '장면 데이터가 없습니다' }, { status: 400 });
    }

    // TTS 병렬 생성
    const ts = Date.now();
    const scenes: Scene[] = await Promise.all(
      (inputScenes as { text: string; imageUrl: string }[]).map(async (s, i) => {
        const audioUrl = await generateSpeech(s.text, `scene-${ts}-${i}`, voice);
        const durationInSeconds = Math.max(3, s.text.length / CHARS_PER_SECOND) + 0.5;
        const durationInFrames = Math.round(durationInSeconds * FPS);
        const subtitles = estimateSubtitles(s.text, durationInFrames, FPS);
        return { imageUrl: s.imageUrl, audioUrl, durationInFrames, subtitles };
      })
    );

    const compositionId = format === 'landscape' ? 'ClipFlowLandscape' : 'ClipFlowShorts';
    const { renderId, bucketName } = await startRender({
      compositionId,
      inputProps: { scenes, fps: FPS },
    });

    const videoUrl = await waitForRender(renderId, bucketName);
    return NextResponse.json({ videoUrl });
  } catch (err: unknown) {
    console.error('[generate-video]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '영상 생성 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
