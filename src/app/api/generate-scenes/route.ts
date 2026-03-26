import { NextRequest } from 'next/server';
import { splitScriptIntoScenes as splitViaOpenRouter, generateImage as generateImageViaOpenRouter, getModelConcurrency } from '@/lib/openrouter';
import { splitScriptIntoScenes as splitViaGemini, generateImage as generateImageViaGoogle } from '@/lib/google';
import { uploadImageToS3 } from '@/lib/kling';

export async function POST(req: NextRequest) {
  const {
    script,
    imageModelId = 'black-forest-labs/flux.2-klein-4b',
    llmModelId = 'deepseek/deepseek-chat-v3-0324',
    format = 'shorts',
    characterImageBase64,
    imageStyle,
  } = await req.json();

  const stylePrompts: Record<string, string> = {
    cinematic: 'cinematic film style, movie still, dramatic lighting, anamorphic lens',
    realistic: 'photorealistic, professional photography, natural lighting, 8K',
    anime: 'anime style, 2D animation, vibrant colors, Studio Ghibli inspired',
    documentary: 'documentary photography, candid shot, natural lighting, journalistic',
    '3d': '3D render, CGI, highly detailed, Pixar style, volumetric lighting',
    watercolor: 'watercolor illustration, soft brushstrokes, artistic, painterly',
    cartoon: 'cartoon style, flat design, bold outlines, vibrant illustration',
    noir: 'film noir, black and white, high contrast, moody shadows, dramatic',
  };
  const stylePrompt = imageStyle ? (stylePrompts[imageStyle] ?? '') : '';
  const aspectRatio = format === 'landscape' ? '16:9' : '9:16';

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

        // 1. 장면 분할 (200자당 1장면, 최대 35장면)
        const sceneCount = Math.min(35, Math.max(1, Math.round(script.length / 200)));
        console.log('[generate-scenes] Splitting script into scenes...');
        const isGemini = llmModelId.startsWith('google/gemini-');
        const hasCharacter = !!characterImageBase64;
        const { scenes: scriptScenes, usage: llmUsage } = isGemini
          ? await splitViaGemini(script, llmModelId, sceneCount, hasCharacter)
          : await splitViaOpenRouter(script, llmModelId, sceneCount, hasCharacter);
        console.log(`[generate-scenes] Split into ${scriptScenes.length} scenes. LLM tokens: ${llmUsage.promptTokens}+${llmUsage.completionTokens}`);
        send({ type: 'total', count: scriptScenes.length });

        // 2. 이미지 생성 (모델별 최적 동시 호출 수 적용)
        const isGoogleImage = imageModelId.startsWith('google/');
        const CONCURRENCY = isGoogleImage ? 2 : getModelConcurrency(imageModelId);
        const results: { index: number; text: string; imagePrompt: string; imageUrl: string }[] = [];

        for (let i = 0; i < scriptScenes.length; i += CONCURRENCY) {
          const batch = scriptScenes.slice(i, i + CONCURRENCY).map((s, j) => ({ s, index: i + j }));
          await Promise.all(
            batch.map(async ({ s, index }) => {
              const styledPrompt = stylePrompt ? `${s.imagePrompt}, ${stylePrompt}` : s.imagePrompt;
              let imageUrl: string;
              if (isGoogleImage) {
                imageUrl = await generateImageViaGoogle(
                  styledPrompt,
                  { stylePrompt, characterBase64: characterImageBase64 ?? undefined },
                  imageModelId
                );
              } else {
                const imageBuffer = await generateImageViaOpenRouter(styledPrompt, imageModelId, aspectRatio, characterImageBase64);
                imageUrl = await uploadImageToS3(imageBuffer);
              }
              const scene = { index, text: s.text, imagePrompt: s.imagePrompt, motionPrompt: s.motionPrompt, imageUrl, shouldAnimate: s.shouldAnimate };
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
        send({ type: 'error', message: err instanceof Error ? err.message : '장면 생성 중 오류가 발생했습니다' });
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
