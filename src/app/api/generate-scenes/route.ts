import { NextRequest } from 'next/server';
import { splitScriptIntoScenes as splitViaGemini, generateImage as generateImageViaGoogle, splitScriptIntoSlides } from '@/lib/google';
import { generateFalImage } from '@/lib/fal-image';
import { createClient } from '@/lib/supabase-server';

/**
 * [공통 유틸리티] 텍스트를 1줄 기준(25~28자)으로 문장 구조에 맞게 분할
 * 우선순위: 문장 종결부호 > 쉼표/나열부호 > 공백 > 강제 컷
 */
function splitTextToSubtitles(text: string, maxChars = 27): { text: string; startFrame: number; endFrame: number }[] {
  const txt = text.trim();
  if (!txt) return [];
  const totalFrames = 300;
  const HARD_MAX = maxChars;        // 이 이상은 절대 허용 안 함
  const MIN_CHUNK = 8;              // 너무 짧은 조각 방지

  function findBestSplit(s: string): number {
    if (s.length <= HARD_MAX) return s.length;

    // 1순위: HARD_MAX 이내의 가장 늦은 문장 종결 부호 (. ! ? … 。)
    for (let i = Math.min(s.length - 1, HARD_MAX); i >= MIN_CHUNK; i--) {
      if (/[.!?…。]/.test(s[i])) return i + 1;
    }

    // 2순위: HARD_MAX 이내의 가장 늦은 쉼표/가운뎃점/열거 부호
    for (let i = Math.min(s.length - 1, HARD_MAX); i >= MIN_CHUNK; i--) {
      if (/[,，、·]/.test(s[i])) return i + 1;
    }

    // 3순위: HARD_MAX 이내의 가장 늦은 공백
    for (let i = Math.min(s.length - 1, HARD_MAX); i >= MIN_CHUNK; i--) {
      if (s[i] === ' ') return i + 1;
    }

    // 4순위: 조사/어미 뒤 자연스러운 끊기 (Korean: 은/는/이/가/을/를/에/의/로/으로/하고/해서/지만/니까)
    const josaPattern = /(은|는|이|가|을|를|에|의|로|으로|하고|해서|지만|니까|아서|어서|면서|는데|지만)\s*/g;
    let lastJosa = -1;
    let m;
    while ((m = josaPattern.exec(s)) !== null) {
      const pos = m.index + m[0].length;
      if (pos >= MIN_CHUNK && pos <= HARD_MAX) lastJosa = pos;
    }
    if (lastJosa > 0) return lastJosa;

    // 5순위: 강제 컷 (HARD_MAX)
    return HARD_MAX;
  }

  const chunks: string[] = [];
  let rem = txt;

  while (rem.length > 0) {
    const splitAt = findBestSplit(rem);
    const chunk = rem.slice(0, splitAt).trim();
    if (chunk.length > 0) chunks.push(chunk);
    rem = rem.slice(splitAt).trim();
  }

  // 너무 짧은 마지막 조각은 앞에 합치기 (단, HARD_MAX 초과하지 않는 경우만)
  const merged: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const prev = merged[merged.length - 1];
    if (prev && chunks[i].length < MIN_CHUNK && (prev + chunks[i]).length <= HARD_MAX) {
      merged[merged.length - 1] = prev + chunks[i];
    } else {
      merged.push(chunks[i]);
    }
  }

  const totalChars = merged.reduce((sum, c) => sum + c.length, 0);
  let currentF = 0;
  return merged.map((chunk, j) => {
    const frames = j === merged.length - 1
      ? totalFrames - currentF
      : Math.max(25, Math.round((chunk.length / totalChars) * totalFrames));
    const entry = { text: chunk, startFrame: currentF, endFrame: currentF + frames };
    currentF += frames;
    return entry;
  });
}

export async function POST(req: NextRequest) {
  let {
    script,
    imageModelId = 'google/gemini-2.5-flash-image',
    llmModelId = 'google/gemini-2.5-flash',
    format = 'landscape',
    characterImageBase64,
    imageStyle,
    subCharacters,
    allowedAnimations,
    pptMode = false,
    pptTheme = 'dark',
  } = await req.json();

  // 유저 API 키 조회
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const meta = user?.user_metadata ?? {};
  const geminiApiKey = meta.gemini_api_key as string | undefined;
  const falApiKey = meta.fal_api_key as string | undefined;

  // 캐릭터 참조 이미지 여부 확인
  const hasCharacterImages = !!characterImageBase64 || (Array.isArray(subCharacters) && subCharacters.length > 0);

  // 캐릭터 이미지가 있으면 Gemini 강제 사용 (멀티모달 참조 이미지 지원 필요)
  if (hasCharacterImages && !imageModelId.startsWith('google/')) {
    imageModelId = 'google/gemini-2.5-flash-image';
  }
  // 그 외에는 사용자가 선택한 모델 그대로 사용

  const stylePrompts: Record<string, string> = {
    cinematic: 'cinematic film style, movie still, dramatic lighting, anamorphic lens',
    realistic: 'photorealistic, professional photography, natural lighting, 8K',
    anime: 'anime style, 2D animation, vibrant colors, Studio Ghibli inspired',
    documentary: 'documentary photography, candid shot, natural lighting, journalistic',
    '3d': '3D render, CGI, highly detailed, Pixar style, volumetric lighting',
    watercolor: 'watercolor illustration, soft brushstrokes, artistic, painterly',
    cartoon: 'cartoon style, flat design, bold outlines, vibrant illustration',
    noir: 'film noir, black and white, high contrast, moody shadows, dramatic',
    lineart: 'minimalist line art, black and white only, simple outline illustration, doodle style, flat design, clean strokes, icon style, white background, no color, no shading',
    none: 'minimalist background, solid dark color, simple texture, non-distracting, professional, clean',
    kinetic: '',  // 키네틱 모드: 배경 이미지 생성 없음 (순수 텍스트 애니메이션)
  };
  const isKineticMode = imageStyle === 'kinetic';
  const stylePrompt = imageStyle && imageStyle !== 'none' && !isKineticMode ? (stylePrompts[imageStyle] ?? '') : (stylePrompts.none ?? '');

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        if (!script || typeof script !== 'string') {
          send({ type: 'error', message: '대본을 입력해주세요' });
          controller.close();
          return;
        }

        // PPT 모드 처리
        if (pptMode) {
          if (!geminiApiKey) {
            send({ type: 'error', message: 'PPT 모드는 Gemini API 키가 필요합니다. 설정 페이지에서 키를 등록해주세요.', needsKey: true });
            controller.close();
            return;
          }
          const targetCharsPerScene = 125;
          const sceneCount = Math.min(50, Math.max(1, Math.round(script.length / targetCharsPerScene)));
          const { slides, usage: llmUsage } = await splitScriptIntoSlides(script, llmModelId, sceneCount, geminiApiKey);
          send({ type: 'total', count: slides.length });
          slides.forEach((s, index) => {
            // bullets가 필요한 레이아웃인데 없으면 텍스트에서 자동 생성
            const BULLET_LAYOUTS = ['bullets', 'boxlist', 'icongrid', 'timeline', 'progress'];
            let safeBullets = s.bullets ?? [];
            if (BULLET_LAYOUTS.includes(s.layout) && safeBullets.length === 0) {
              // 문장 부호 기준으로 2~3개 핵심 포인트 추출
              const sentences = s.text.split(/[.!?。]\s+/).filter(t => t.trim().length > 4);
              safeBullets = sentences.slice(0, 3).map(t => t.trim().slice(0, 25));
              if (safeBullets.length === 0) safeBullets = [s.title || s.text.slice(0, 20)];
            }
            send({
              type: 'scene',
              index,
              text: s.text,
              slideData: { layout: s.layout, title: s.title, bullets: safeBullets, stats: s.stats, comparisonData: s.comparisonData },
              pptTheme,
              imageUrl: '',
              durationInFrames: 0,
              audioUrl: '',
              subtitles: s.text ? splitTextToSubtitles(s.text, 30) : [],
              textAnimationStyle: 'none',
              textPosition: 'bottom',
            });
          });
          send({
            type: 'done',
            usage: {
              promptTokens: llmUsage.promptTokens,
              completionTokens: llmUsage.completionTokens,
              imageCount: 0,
              imageModelId: 'none',
              llmModelId,
            },
          });
          controller.close();
          return;
        }

        const isFalImage = imageModelId.startsWith('fal/');
        if (isFalImage && !falApiKey) {
          send({ type: 'error', message: 'fal.ai API 키가 설정되지 않았습니다. 설정 페이지에서 키를 등록해주세요.', needsKey: true });
          controller.close();
          return;
        }
        if (!isFalImage && !geminiApiKey) {
          const msg = hasCharacterImages
            ? '캐릭터 참조 이미지 사용 시 Gemini로 자동 전환됩니다. 설정 페이지에서 Gemini API 키를 등록해주세요.'
            : 'Gemini API 키가 설정되지 않았습니다. 설정 페이지에서 키를 등록해주세요.';
          send({ type: 'error', message: msg, needsKey: true });
          controller.close();
          return;
        }

        // 1. 장면 분할 (키네틱: 85자/씬, 일반: 175자/씬 기준으로 장면 수 추정, 최대 50장면)
        const targetCharsPerScene = isKineticMode ? 85 : 125;
        const sceneCount = Math.min(50, Math.max(1, Math.round(script.length / targetCharsPerScene)));
        console.log(`[generate-scenes] script.length=${script.length}, sceneCount=${sceneCount}`);
        const hasCharacter = !!characterImageBase64;
        const subCharacterNames = Array.isArray(subCharacters) ? subCharacters.map((c: { name: string }) => c.name) : [];
        const { scenes: scriptScenes, usage: llmUsage } = await splitViaGemini(script, llmModelId, sceneCount, hasCharacter, geminiApiKey, subCharacterNames, allowedAnimations, imageStyle);
        console.log(`[generate-scenes] Split into ${scriptScenes.length} scenes. LLM tokens: ${llmUsage.promptTokens}+${llmUsage.completionTokens}`);
        send({ type: 'total', count: scriptScenes.length });

        // 2. 이미지 생성 (모델별 최적 동시 호출 수 적용)
        const results: { index: number; text: string; imagePrompt: string; imageUrl: string }[] = [];

        // 키네틱 모드: 이미지 생성 없이 바로 씬 전송 (Scene.tsx가 #0d0d0d 배경으로 렌더링)
        if (isKineticMode) {
          scriptScenes.forEach((s, index) => {
            const scene = {
              index,
              text: s.text,
              displayText: s.displayText,
              imagePrompt: '',
              motionPrompt: s.motionPrompt,
              imageUrl: '',
              shouldAnimate: false,
              textAnimationStyle: s.textAnimationStyle,
              textPosition: s.textPosition,
            };
            results.push(scene);
            send({ type: 'scene', ...scene });
          });
        } else {
          // fal.ai 직접 엔드포인트는 동시 3개, Gemini는 순차 처리 (rate limit)
          const CONCURRENCY = isFalImage ? 3 : 1;

          for (let i = 0; i < scriptScenes.length; i += CONCURRENCY) {
            const batch = scriptScenes.slice(i, i + CONCURRENCY).map((s, j) => ({ s, index: i + j }));
            await Promise.all(
              batch.map(async ({ s, index }) => {
                const styledPrompt = stylePrompt ? `${s.imagePrompt}, ${stylePrompt}` : s.imagePrompt;
                let imageUrl: string;
                if (isFalImage) {
                  imageUrl = await generateFalImage(styledPrompt, imageModelId, format, falApiKey);
                } else {
                  imageUrl = await generateImageViaGoogle(
                    styledPrompt,
                    { stylePrompt, characterBase64: characterImageBase64 ?? undefined, subCharacters, format },
                    imageModelId,
                    geminiApiKey
                  );
                }
                const scene = {
                  index,
                  text: s.text,
                  imagePrompt: s.imagePrompt,
                  motionPrompt: s.motionPrompt,
                  imageUrl,
                  shouldAnimate: s.shouldAnimate,
                  textAnimationStyle: s.textAnimationStyle,
                  textPosition: s.textPosition
                };
                results.push(scene);
                send({ type: 'scene', ...scene });
              })
            );
            if (i + CONCURRENCY < scriptScenes.length) {
              await new Promise(r => setTimeout(r, isFalImage ? 500 : 3000));
            }
          }
        }

        send({
          type: 'done',
          usage: {
            promptTokens: llmUsage.promptTokens,
            completionTokens: llmUsage.completionTokens,
            imageCount: isKineticMode ? 0 : scriptScenes.length,
            imageModelId: isKineticMode ? 'none' : imageModelId,
            llmModelId,
          },
        });
      } catch (err) {
        console.error('[generate-scenes] Error:', err);
        let errMsg = err instanceof Error ? err.message : '장면 생성 중 오류가 발생했습니다';
        
        // Google Gemini API 503 (High Demand) 에러 처리
        if (errMsg.includes('503') && errMsg.includes('high demand') || errMsg.includes('UNAVAILABLE')) {
          errMsg = '구글(Gemini) AI 서버가 현재 전 세계적인 트래픽 과부하로 응답이 지연되고 있습니다 (503). 1~2분 뒤 다시 시도해주세요.';
        }
        
        if (errMsg.includes('This model only supports text output') || errMsg.includes('INVALID_ARGUMENT')) {
          errMsg = '이미지 생성 오류 (400): Gemini 이미지 모델이 응답하지 않습니다. 잠시 후 다시 시도하거나 옵션에서 fal.ai 모델로 변경해주세요.';
        }
        
        send({ type: 'error', message: errMsg });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
