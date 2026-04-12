import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

// fal.ai를 통한 썸네일 이미지 생성
async function generateWithFal(prompt: string, apiKey: string, aspectRatio: string) {
  const { fal } = await import('@fal-ai/client');
  fal.config({ credentials: apiKey });

  const result = await fal.subscribe('fal-ai/flux/schnell', {
    input: {
      prompt,
      image_size: aspectRatio === '16:9' ? 'landscape_16_9' : aspectRatio === '1:1' ? 'square_hd' : 'portrait_4_3',
      num_inference_steps: 4,
      num_images: 1,
    },
  }) as { images?: { url: string }[] };

  return result?.images?.[0]?.url ?? null;
}

// Gemini를 통한 썸네일 이미지 생성
async function generateWithGemini(prompt: string, apiKey: string) {
  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey });
  const res = await ai.models.generateImages({
    model: 'imagen-3.0-generate-002',
    prompt,
    config: { numberOfImages: 1, aspectRatio: '16:9', outputMimeType: 'image/jpeg' },
  });
  const b64 = res.generatedImages?.[0]?.image?.imageBytes;
  if (!b64) return null;
  return `data:image/jpeg;base64,${b64}`;
}

// AI로 썸네일 프롬프트 생성
async function generatePrompts(title: string, style: string, thumbnailType: string): Promise<string[]> {
  const styleGuide: Record<string, string> = {
    youtube_bold: 'YouTube thumbnail style: bold text overlay area, high contrast, dramatic lighting, eye-catching composition, vibrant colors, professional photography',
    youtube_face: 'YouTube thumbnail style: expressive reaction face close-up, bright background, bold text space on side, engaging expression',
    blog_clean: 'Clean blog header image: minimalist design, soft gradient background, plenty of text overlay space, professional and modern',
    blog_dark: 'Dark blog thumbnail: dark moody background, light text space, dramatic atmospheric lighting, editorial style',
    infographic: 'Infographic thumbnail: clean flat design, data visualization elements, icons, bright colors, structured layout',
  };

  const typeGuide = thumbnailType === 'youtube'
    ? 'YouTube video thumbnail, 1280x720, high CTR design'
    : 'Blog post header image, 1200x628, clean editorial design';

  const prompts = [
    `${typeGuide}. Topic: "${title}". ${styleGuide[style] ?? styleGuide.youtube_bold}. Photorealistic, 8K quality, --no text`,
    `${typeGuide}. "${title}" theme. ${styleGuide[style] ?? styleGuide.youtube_bold}, cinematic composition, dramatic atmosphere --no text`,
    `${typeGuide}. Concept: "${title}". ${styleGuide[style] ?? styleGuide.blog_clean}, modern aesthetic, professional quality --no text`,
  ];

  return prompts;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const meta = user?.user_metadata ?? {};

    const { title, style, thumbnailType, imageProvider, customPrompt } = await req.json();
    if (!title && !customPrompt) {
      return NextResponse.json({ error: '제목 또는 프롬프트가 필요합니다' }, { status: 400 });
    }

    const aspectRatio = thumbnailType === 'youtube' ? '16:9' : '1.91:1';
    const prompts = customPrompt ? [customPrompt] : await generatePrompts(title, style ?? 'youtube_bold', thumbnailType ?? 'youtube');

    const results: { url: string; prompt: string }[] = [];

    if (imageProvider === 'fal' || (!imageProvider && meta.fal_api_key)) {
      const apiKey = meta.fal_api_key;
      if (!apiKey) return NextResponse.json({ error: 'fal.ai API 키가 필요합니다' }, { status: 400 });
      for (const prompt of prompts.slice(0, 3)) {
        try {
          const url = await generateWithFal(prompt, apiKey, aspectRatio);
          if (url) results.push({ url, prompt });
        } catch (e) { console.error('[thumbnail fal]', e); }
      }
    } else if (imageProvider === 'gemini' || meta.gemini_api_key) {
      const apiKey = meta.gemini_api_key;
      if (!apiKey) return NextResponse.json({ error: 'Gemini API 키가 필요합니다' }, { status: 400 });
      for (const prompt of prompts.slice(0, 2)) {
        try {
          const url = await generateWithGemini(prompt, apiKey);
          if (url) results.push({ url, prompt });
        } catch (e) { console.error('[thumbnail gemini]', e); }
      }
    } else {
      return NextResponse.json({ error: 'fal.ai 또는 Gemini API 키를 설정에서 등록해주세요' }, { status: 400 });
    }

    if (results.length === 0) {
      return NextResponse.json({ error: '이미지 생성에 실패했습니다' }, { status: 500 });
    }

    return NextResponse.json({ images: results, prompts });
  } catch (err: unknown) {
    console.error('[thumbnail]', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : '썸네일 생성 실패' }, { status: 500 });
  }
}
