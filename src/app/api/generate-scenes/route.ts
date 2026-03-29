import { NextRequest } from 'next/server';
import { splitScriptIntoScenes as splitViaGemini, generateImage as generateImageViaGoogle } from '@/lib/google';
import { generateFalImage } from '@/lib/fal-image';
import { createClient } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  const {
    script,
    imageModelId = 'google/gemini-2.5-flash-image',
    llmModelId = 'google/gemini-2.5-flash',
    format = 'landscape',
    characterImageBase64,
    imageStyle,
    subCharacters,
    allowedAnimations,
  } = await req.json();

  // 유저 API 키 조회
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const meta = user?.user_metadata ?? {};
  const geminiApiKey = meta.gemini_api_key as string | undefined;
  const falApiKey = meta.fal_api_key as string | undefined;

  const stylePrompts: Record<string, string> = {
    cinematic: 'cinematic film style, movie still, dramatic lighting, anamorphic lens',
    realistic: 'photorealistic, professional photography, natural lighting, 8K',
    anime: 'anime style, 2D animation, vibrant colors, Studio Ghibli inspired',
    documentary: 'documentary photography, candid shot, natural lighting, journalistic',
    '3d': '3D render, CGI, highly detailed, Pixar style, volumetric lighting',
    watercolor: 'watercolor illustration, soft brushstrokes, artistic, painterly',
    cartoon: 'cartoon style, flat design, bold outlines, vibrant illustration',
    noir: 'film noir, black and white, high contrast, moody shadows, dramatic',
    none: 'minimalist background, solid dark color, simple texture, non-distracting, professional, clean',
  };
  const stylePrompt = imageStyle && imageStyle !== 'none' ? (stylePrompts[imageStyle] ?? '') : (stylePrompts.none ?? '');

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

        const isFalImage = imageModelId.startsWith('fal/');
        if (isFalImage && !falApiKey) {
          send({ type: 'error', message: 'fal.ai API 키가 설정되지 않았습니다. 설정 페이지에서 키를 등록해주세요.', needsKey: true });
          controller.close();
          return;
        }
        if (!isFalImage && !geminiApiKey) {
          send({ type: 'error', message: 'Gemini API 키가 설정되지 않았습니다. 설정 페이지에서 키를 등록해주세요.', needsKey: true });
          controller.close();
          return;
        }

        // 1. 장면 분할 (200자당 1장면, 최대 50장면)
        const sceneCount = Math.min(50, Math.max(1, Math.round(script.length / 200)));
        console.log('[generate-scenes] Splitting script into scenes...');
        const hasCharacter = !!characterImageBase64;
        const subCharacterNames = Array.isArray(subCharacters) ? subCharacters.map((c: { name: string }) => c.name) : [];
        const { scenes: scriptScenes, usage: llmUsage } = await splitViaGemini(script, llmModelId, sceneCount, hasCharacter, geminiApiKey, subCharacterNames, allowedAnimations, imageStyle);
        console.log(`[generate-scenes] Split into ${scriptScenes.length} scenes. LLM tokens: ${llmUsage.promptTokens}+${llmUsage.completionTokens}`);
        send({ type: 'total', count: scriptScenes.length });

        // 2. 이미지 생성 (모델별 최적 동시 호출 수 적용)
        const results: { index: number; text: string; imagePrompt: string; imageUrl: string }[] = [];
        const CONCURRENCY = 2;

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
                  { stylePrompt, characterBase64: characterImageBase64 ?? undefined },
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
        }

        send({
          type: 'done',
          usage: {
            promptTokens: llmUsage.promptTokens,
            completionTokens: llmUsage.completionTokens,
            imageCount: scriptScenes.length,
            imageModelId,
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
