import { NextRequest, NextResponse } from 'next/server';
import { generateSpeechToS3 } from '@/lib/minimax-tts';
import { generateSpeech as googleTTSToS3 } from '@/lib/google';
import { startRender } from '@/lib/remotion';
import { createClient } from '@/lib/supabase-server';

const FPS = 30;
const PADDING_FRAMES = 15; // 오디오 끝 후 0.5초 여유

/**
 * 텍스트를 자연스러운 문장/절 단위로 분할 후 프레임 비례 배분.
 * 규칙:
 * - 괄호() [] 안의 내용은 절대 분할하지 않음 (한 덩어리로 처리)
 * - 우선순위: ① 문장 끝(. ! ? …) → ② 절 구분(, — ·) → ③ 공백 → ④ 최대 글자 수
 */
function splitIntoSubtitles(text: string, totalFrames: number) {
  const MAX_CHARS = 28;
  const MIN_CHARS = 6;

  // 괄호 쌍이 열린 인덱스 집합 반환: 분할 불가 구간
  function isInsideBracket(str: string, pos: number): boolean {
    let depth = 0;
    for (let i = 0; i < pos; i++) {
      if (str[i] === '(' || str[i] === '[') depth++;
      if (str[i] === ')' || str[i] === ']') depth = Math.max(0, depth - 1);
    }
    return depth > 0;
  }

  // 괄호를 포함한 다음 안전한 분할 위치 탐색
  function findSplitAt(remaining: string): number {
    const limit = Math.min(MAX_CHARS, remaining.length - 1);

    // 먼저 MAX_CHARS 안에 열린 괄호가 있으면 닫는 괄호 이후까지 확장
    let safeLimit = limit;
    let depth = 0;
    for (let i = 0; i <= limit; i++) {
      if (remaining[i] === '(' || remaining[i] === '[') depth++;
      if (remaining[i] === ')' || remaining[i] === ']') depth = Math.max(0, depth - 1);
    }
    // 괄호가 열린 채로 끝났으면 닫힐 때까지 확장 (최대 50자 더)
    if (depth > 0) {
      for (let i = limit + 1; i < Math.min(remaining.length, MAX_CHARS + 50); i++) {
        if (remaining[i] === ')' || remaining[i] === ']') {
          depth--;
          if (depth === 0) { safeLimit = i; break; }
        }
      }
    }

    // ① 문장 끝
    for (let i = safeLimit; i >= MIN_CHARS; i--) {
      if (/[.!?…。！？]/.test(remaining[i] ?? '') && !isInsideBracket(remaining, i)) {
        return i + 1;
      }
    }
    // ② 절 구분
    for (let i = safeLimit; i >= MIN_CHARS; i--) {
      if (/[,—·、，]/.test(remaining[i] ?? '') && !isInsideBracket(remaining, i)) {
        return i + 1;
      }
    }
    // ③ 공백
    for (let i = safeLimit; i >= MIN_CHARS; i--) {
      if (/\s/.test(remaining[i] ?? '') && !isInsideBracket(remaining, i)) {
        return i + 1;
      }
    }
    // ④ 강제 분할 (괄호 구간 이후)
    return safeLimit + 1;
  }

  const chunks: string[] = [];
  let remaining = text.trim();

  while (remaining.length > MAX_CHARS) {
    const splitAt = findSplitAt(remaining);
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
      fontFamily = 'Noto Sans KR',
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
      displayText?: string;
      imageUrl: string;
      videoUrl?: string;
      textAnimationStyle?: 'none' | 'typewriter' | 'fly-in' | 'pop-in' | 'fade-zoom' | 'clock-spin' | 'pulse-ring' | 'sparkle' | 'confetti' | 'rain' | 'snow' | 'fire' | 'heart' | 'stars' | 'thunder' | 'chart-up' | 'film-roll' | 'magnifier' | 'lock-secure' | 'camera-flash';
      textPosition?: 'bottom' | 'center' | 'top';
      slideData?: { layout: string; title?: string; bullets?: string[] };
      pptTheme?: string;
    };

    async function processTTS(s: SceneInput, i: number) {
      let audioUrl: string;
      let durationInFrames: number;

      if (ttsProvider === 'none') {
        // 음성 없음 (키네틱 모드): displayText 기준으로 씬 길이 계산 (3~7초)
        // 전체 나레이션 텍스트(~175자)를 기준으로 하면 씬당 50초+ 가 되어 렌더링이 사실상 종료되지 않음
        const safeSpeed = Math.max(0.5, speed);
        const charsPerSec = 300 / 60 * safeSpeed; // 한국어 자막 읽기 속도 ~300자/분
        const textForDuration = s.displayText?.trim() || s.text.slice(0, 30);
        const estimatedSec = Math.min(7, Math.max(3, textForDuration.replace(/\s+/g, '').length / charsPerSec));
        audioUrl = '';
        durationInFrames = Math.max(90, Math.round(estimatedSec * FPS) + PADDING_FRAMES);
      } else {
        let durationMs: number;
        if (ttsProvider === 'google') {
          ({ url: audioUrl, durationMs } = await googleTTSToS3(s.text, `scene-${ts}-${i}`, voiceId, speed, meta.gemini_api_key));
        } else if (ttsProvider === 'elevenlabs') {
          const { generateSpeechToS3: elevenTTSToS3 } = await import('@/lib/elevenlabs');
          ({ url: audioUrl, durationMs } = await elevenTTSToS3(s.text, `scene-${ts}-${i}`, { voiceId, speed, apiKey: meta.elevenlabs_api_key }));
        } else {
          ({ url: audioUrl, durationMs } = await generateSpeechToS3(s.text, `scene-${ts}-${i}`, { voiceId, speed, apiKey: meta.minimax_api_key, groupId: meta.minimax_group_id }));
        }
        durationInFrames = Math.max(60, Math.round((durationMs / 1000) * FPS) + PADDING_FRAMES);
      }

      if (s.videoUrl) {
        durationInFrames = Math.max(durationInFrames, 150);
      }

      // 키네틱 모드도 나레이션 자막을 타이밍에 맞게 분할 (displayText가 핵심 포인트를 화면에 크게 표시)
      const subtitles = splitIntoSubtitles(s.text, durationInFrames);

      return {
        imageUrl: s.imageUrl,
        displayText: s.displayText,
        videoUrl: s.videoUrl,
        audioUrl,
        durationInFrames,
        subtitles,
        textAnimationStyle: s.textAnimationStyle,
        textPosition: s.textPosition,
        slideData: s.slideData,
        pptTheme: s.pptTheme,
      };
    }

    let scenes: any[] = [];
    if (ttsProvider === 'none') {
      // 음성 없음: 모든 씬 병렬 처리 (API 호출 없음)
      scenes = await Promise.all(inputScenes.map((s: SceneInput, i: number) => processTTS(s, i)));
    } else if (ttsProvider === 'google') {
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
      inputProps: { scenes, fps: FPS, fontFamily },
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
