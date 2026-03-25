import { NextRequest, NextResponse } from 'next/server';
import { generateSpeechToS3 } from '@/lib/minimax-tts';
import { generateSpeech as googleTTSToS3 } from '@/lib/google';
import { startRender, waitForRender } from '@/lib/remotion';

const FPS = 30;

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

    const ts = Date.now();

    // 1. TTS 병렬 생성
    const scenes = await Promise.all(
      inputScenes.map(async (s: { text: string; imageUrl: string; videoUrl?: string }, i: number) => {
        let audioUrl: string;
        let durationMs: number;

        if (ttsProvider === 'google') {
          audioUrl = await googleTTSToS3(s.text, `scene-${ts}-${i}`, voiceId);
          durationMs = s.text.length * 80; // 대략적인 추정
        } else {
          ({ url: audioUrl, durationMs } = await generateSpeechToS3(
            s.text,
            `scene-${ts}-${i}`,
            { voiceId, speed }
          ));
        }

        const durationInFrames = Math.max(30, Math.round((durationMs / 1000) * FPS));

        // 자막: 장면 전체 구간에 텍스트 표시
        const subtitles = [{ text: s.text, startFrame: 0, endFrame: durationInFrames }];

        return {
          imageUrl: s.imageUrl,
          videoUrl: s.videoUrl,
          audioUrl,
          durationInFrames,
          subtitles
        };
      })
    );

    // 2. Remotion Lambda 렌더링 시작
    const compositionId = format === 'landscape' ? 'ClipFlowLandscape' : 'ClipFlowShorts';
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
