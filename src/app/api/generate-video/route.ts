import { NextRequest, NextResponse } from 'next/server';
import { generateSpeechToS3 } from '@/lib/minimax-tts';
import { generateSpeech as googleTTSToS3 } from '@/lib/google';
import { startRender, waitForRender } from '@/lib/remotion';

const FPS = 30;
const PADDING_FRAMES = 15; // 오디오 끝 후 0.5초 여유

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

    // 1. TTS 생성 (Google은 RPM 10 제한으로 순차 처리, MiniMax는 병렬)
    type SceneInput = { text: string; imageUrl: string; videoUrl?: string };
    async function processTTS(s: SceneInput, i: number) {
      let audioUrl: string;
      let durationMs: number;
      if (ttsProvider === 'google') {
        ({ url: audioUrl, durationMs } = await googleTTSToS3(s.text, `scene-${ts}-${i}`, voiceId));
      } else {
        ({ url: audioUrl, durationMs } = await generateSpeechToS3(s.text, `scene-${ts}-${i}`, { voiceId, speed }));
      }
      const durationInFrames = Math.max(60, Math.round((durationMs / 1000) * FPS) + PADDING_FRAMES);
      return {
        imageUrl: s.imageUrl,
        videoUrl: s.videoUrl,
        audioUrl,
        durationInFrames,
        subtitles: [{ text: s.text, startFrame: 0, endFrame: durationInFrames }],
      };
    }

    let scenes;
    if (ttsProvider === 'google') {
      // 순차 처리 (RPM 10 제한 대응)
      scenes = [];
      for (let i = 0; i < inputScenes.length; i++) {
        scenes.push(await processTTS(inputScenes[i], i));
      }
    } else {
      // MiniMax: 병렬 처리
      scenes = await Promise.all(inputScenes.map((s: SceneInput, i: number) => processTTS(s, i)));
    }

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
