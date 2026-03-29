import { NextRequest } from 'next/server';
import { generateImage } from '@/lib/openrouter';
import { uploadImageToS3 } from '@/lib/kling';

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
    const { imagePrompt, imageModelId, format = 'shorts', imageStyle, characterImageBase64 } = await req.json();
    if (!imagePrompt || !imageModelId) {
      return Response.json({ error: '필수 파라미터 누락' }, { status: 400 });
    }

    const stylePrompt = imageStyle ? (STYLE_PROMPTS[imageStyle] ?? '') : '';
    const styledPrompt = stylePrompt ? `${imagePrompt}, ${stylePrompt}` : imagePrompt;
    const aspectRatio = format === 'landscape' ? '16:9' : '9:16';

    const imageBuffer = await generateImage(styledPrompt, imageModelId, aspectRatio, characterImageBase64);
    const imageUrl = await uploadImageToS3(imageBuffer);

    return Response.json({ imageUrl });
  } catch (err: unknown) {
    console.error('[regenerate-image]', err);
    return Response.json({ error: err instanceof Error ? err.message : '이미지 재생성 실패' }, { status: 500 });
  }
}
