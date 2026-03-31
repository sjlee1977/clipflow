import { NextRequest } from 'next/server';
import { generateImage } from '@/lib/openrouter';
import { uploadImageToS3 } from '@/lib/kling';
import { generateFalImage } from '@/lib/fal-image';
import { createClient } from '@/lib/supabase-server';

const STYLE_PROMPTS: Record<string, string> = {
  cinematic: 'cinematic film style, movie still, dramatic lighting, anamorphic lens',
  realistic: 'photorealistic, professional photography, natural lighting, 8K',
  anime: 'anime style, 2D animation, vibrant colors, Studio Ghibli inspired',
  documentary: 'documentary photography, candid shot, natural lighting, journalistic',
  '3d': '3D render, CGI, highly detailed, Pixar style, volumetric lighting',
  watercolor: 'watercolor illustration, soft brushstrokes, artistic, painterly',
  cartoon: 'cartoon style, flat design, bold outlines, vibrant illustration',
  noir: 'film noir, black and white, high contrast, moody shadows, dramatic',
};

export async function POST(req: NextRequest) {
  try {
    let { imagePrompt, imageModelId, format = 'shorts', imageStyle, characterImageBase64 } = await req.json();
    if (!imagePrompt || !imageModelId) {
      return Response.json({ error: '필수 파라미터 누락' }, { status: 400 });
    }

    // 오픈라우터 크레딧 부족 및 구글 Native 오류 방지 (강제로 fal 폴백 처리를 적용)
    if (!imageModelId.startsWith('fal/')) {
      imageModelId = 'fal/z-image-turbo';
    }

    const stylePrompt = imageStyle ? (STYLE_PROMPTS[imageStyle] ?? '') : '';
    const styledPrompt = stylePrompt ? `${imagePrompt}, ${stylePrompt}` : imagePrompt;
    
    // 유저 메타데이터에 fal api key가 있을 수 있으므로 추출
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const falApiKey = user?.user_metadata?.fal_api_key as string | undefined;

    let imageUrl: string;
    
    if (imageModelId.startsWith('fal/')) {
      imageUrl = await generateFalImage(styledPrompt, imageModelId, format, falApiKey);
    } else {
      const aspectRatio = format === 'landscape' ? '16:9' : '9:16';
      const imageBuffer = await generateImage(styledPrompt, imageModelId, aspectRatio, characterImageBase64);
      imageUrl = await uploadImageToS3(imageBuffer);
    }

    return Response.json({ imageUrl });
  } catch (err: unknown) {
    console.error('[regenerate-image]', err);
    return Response.json({ error: err instanceof Error ? err.message : '이미지 재생성 실패' }, { status: 500 });
  }
}
