import { NextRequest } from 'next/server';
import { generateImage as generateImageViaGoogle } from '@/lib/google';
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
  lineart: 'minimalist line art, black and white only, simple outline illustration, doodle style, flat design, clean strokes, icon style, white background, no color, no shading',
  none: 'minimalist background, solid dark color, simple texture, non-distracting, professional, clean',
};

export async function POST(req: NextRequest) {
  try {
    let { imagePrompt, imageModelId, format = 'landscape', imageStyle, characterImageBase64, subCharacters } = await req.json();
    if (!imagePrompt || !imageModelId) {
      return Response.json({ error: '필수 파라미터 누락' }, { status: 400 });
    }

    const stylePrompt = imageStyle ? (STYLE_PROMPTS[imageStyle] ?? '') : '';
    const styledPrompt = stylePrompt ? `${imagePrompt}, ${stylePrompt}` : imagePrompt;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const meta = user?.user_metadata ?? {};
    const geminiApiKey = meta.gemini_api_key as string | undefined;
    const falApiKey = meta.fal_api_key as string | undefined;

    // 캐릭터 이미지가 있으면 Gemini 강제 사용
    const hasCharacterImages = !!characterImageBase64 || (Array.isArray(subCharacters) && subCharacters.length > 0);
    if (hasCharacterImages && !imageModelId.startsWith('google/')) {
      imageModelId = 'google/gemini-2.5-flash-image';
    }

    let imageUrl: string;

    if (imageModelId.startsWith('fal/')) {
      if (!falApiKey) return Response.json({ error: 'fal.ai API 키가 설정되지 않았습니다.' }, { status: 400 });
      imageUrl = await generateFalImage(styledPrompt, imageModelId, format, falApiKey);
    } else {
      if (!geminiApiKey) return Response.json({ error: 'Gemini API 키가 설정되지 않았습니다.' }, { status: 400 });
      imageUrl = await generateImageViaGoogle(
        styledPrompt,
        { stylePrompt, characterBase64: characterImageBase64 ?? undefined, subCharacters },
        imageModelId,
        geminiApiKey
      );
    }

    return Response.json({ imageUrl });
  } catch (err: unknown) {
    console.error('[regenerate-image]', err);
    return Response.json({ error: err instanceof Error ? err.message : '이미지 재생성 실패' }, { status: 500 });
  }
}
