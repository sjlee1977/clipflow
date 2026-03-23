import { NextRequest, NextResponse } from 'next/server';
import { splitScriptIntoScenes, generateImage } from '@/lib/openrouter';
import { uploadImageToS3 } from '@/lib/kling';

export async function POST(req: NextRequest) {
  try {
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

    if (!script || typeof script !== 'string') {
      return NextResponse.json({ error: '대본을 입력해주세요' }, { status: 400 });
    }

    const aspectRatio = format === 'landscape' ? '16:9' : '9:16';

    // 1. 장면 분할 (OpenRouter LLM)
    console.log('[generate-scenes] Splitting script into scenes...');
    const scriptScenes = await splitScriptIntoScenes(script, llmModelId);
    console.log(`[generate-scenes] Split into ${scriptScenes.length} scenes.`);

    // 2. 이미지 생성 (무료 모델 레이트 리밋을 피하기 위해 순차적으로 처리)
    console.log(`[generate-scenes] Generating images with model: ${imageModelId}...`);
    const scenes = [];
    for (let i = 0; i < scriptScenes.length; i++) {
      const s = scriptScenes[i];
      try {
        const styledPrompt = stylePrompt ? `${s.imagePrompt}, ${stylePrompt}` : s.imagePrompt;
        const imageBuffer = await generateImage(styledPrompt, imageModelId, aspectRatio, characterImageBase64);
        const imageUrl = await uploadImageToS3(imageBuffer);
        scenes.push({ text: s.text, imagePrompt: s.imagePrompt, imageUrl });
        
        // 무료 모델의 부하를 줄이기 위해 짧은 지연 (0.5초)
        if (i < scriptScenes.length - 1) {
          await new Promise(r => setTimeout(r, 500));
        }
      } catch (sceneErr) {
        console.error(`[generate-scenes] Error in scene ${i}:`, sceneErr);
        throw sceneErr;
      }
    }

    return NextResponse.json({ scenes });
  } catch (err: unknown) {
    console.error('[generate-scenes] Global Error:', err);
    return NextResponse.json(
      { 
        error: err instanceof Error ? err.message : '장면 생성 중 오류가 발생했습니다',
        stack: err instanceof Error ? err.stack : undefined 
      },
      { status: 500 }
    );
  }
}
