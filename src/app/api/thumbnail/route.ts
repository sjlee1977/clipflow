import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

// ─── 대본 분석 (AI로 핵심 비주얼 추출) ──────────────────────────────────────

async function analyzeScriptForThumbnail(
  script: string,
  qwenApiKey: string | null
): Promise<{ title: string; mood: string; visuals: string; hook: string }> {
  const truncated = script.slice(0, 3000); // 토큰 절약

  if (qwenApiKey) {
    try {
      const res = await fetch('https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${qwenApiKey.trim()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'qwen-plus',
          messages: [
            {
              role: 'system',
              content: '당신은 유튜브 썸네일 전문가입니다. 대본을 분석하여 클릭률 높은 썸네일 제작을 위한 핵심 정보를 JSON으로 추출합니다.',
            },
            {
              role: 'user',
              content: `다음 대본을 분석하여 JSON으로만 답하세요. 다른 설명 없이 JSON만 출력하세요.

대본:
${truncated}

출력 형식:
{
  "title": "영상의 핵심을 담은 제목 (15자 이내)",
  "mood": "썸네일 분위기 (예: dramatic, urgent, calm, shocking, inspirational)",
  "visuals": "핵심 시각 요소를 영어로 (예: money flying, dark alley, brain explosion, 3 steps infographic)",
  "hook": "시청자를 끌어당기는 핵심 감정 키워드 영어로 (예: fear, curiosity, shock, hope)"
}`,
            },
          ],
          temperature: 0.3,
          max_tokens: 300,
        }),
      });
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content ?? '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          title: parsed.title ?? '',
          mood: parsed.mood ?? 'dramatic',
          visuals: parsed.visuals ?? '',
          hook: parsed.hook ?? 'curiosity',
        };
      }
    } catch (e) {
      console.error('[thumbnail/analyze]', e);
    }
  }

  // Fallback: 첫 줄에서 제목 추출
  const firstLine = script.split('\n').find(l => l.trim().length > 5) ?? '';
  return {
    title: firstLine.slice(0, 30),
    mood: 'dramatic',
    visuals: 'cinematic scene',
    hook: 'curiosity',
  };
}

// ─── 프롬프트 생성 ────────────────────────────────────────────────────────────

async function generatePrompts(
  title: string,
  style: string,
  thumbnailType: string,
  scriptAnalysis?: { title: string; mood: string; visuals: string; hook: string } | null
): Promise<string[]> {
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

  const styleDesc = styleGuide[style] ?? styleGuide.youtube_bold;

  if (scriptAnalysis) {
    const { mood, visuals, hook } = scriptAnalysis;
    const effectiveTitle = scriptAnalysis.title || title;
    return [
      `${typeGuide}. Topic: "${effectiveTitle}". ${styleDesc}. Mood: ${mood}, ${hook} emotion. Key visuals: ${visuals}. Cinematic, 8K quality --no text`,
      `${typeGuide}. "${effectiveTitle}" concept. ${styleDesc}, ${mood} atmosphere, ${visuals}, dramatic tension, emotional ${hook} --no text`,
      `${typeGuide}. "${effectiveTitle}" theme. ${styleDesc}, ${visuals}, hyper-realistic, ${mood} lighting, strong ${hook} visual hook --no text`,
    ];
  }

  return [
    `${typeGuide}. Topic: "${title}". ${styleDesc}. Photorealistic, 8K quality, --no text`,
    `${typeGuide}. "${title}" theme. ${styleDesc}, cinematic composition, dramatic atmosphere --no text`,
    `${typeGuide}. Concept: "${title}". ${styleDesc}, modern aesthetic, professional quality --no text`,
  ];
}

// ─── fal.ai 이미지 생성 ───────────────────────────────────────────────────────

const FAL_BASE = 'https://fal.run';

const FAL_FLUX_ENDPOINTS: Record<string, string> = {
  'fal/flux-schnell': 'fal-ai/flux/schnell',
  'fal/flux-dev':     'fal-ai/flux/dev',
  'fal/flux-pro':     'fal-ai/flux-pro',
  'fal/flux-2-pro':   'fal-ai/flux-2-pro',
};

async function generateWithFal(prompt: string, apiKey: string, aspectRatio: string, falModel = 'fal/flux-schnell') {
  const endpoint = FAL_FLUX_ENDPOINTS[falModel] ?? 'fal-ai/flux/schnell';
  const isPro = falModel === 'fal/flux-pro' || falModel === 'fal/flux-2-pro';

  const image_size = aspectRatio === '16:9' ? 'landscape_16_9' : aspectRatio === '1:1' ? 'square_hd' : 'portrait_4_3';
  const sizeParam = isPro
    ? { aspect_ratio: aspectRatio === '16:9' ? '16:9' : '1:1' }
    : { image_size, num_inference_steps: falModel === 'fal/flux-schnell' ? 4 : 28 };

  const res = await fetch(`${FAL_BASE}/${endpoint}`, {
    method: 'POST',
    headers: {
      'Authorization': `Key ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt, ...sizeParam, num_images: 1 }),
  });

  const rawText = await res.text();
  let data: { images?: { url: string }[]; detail?: string; message?: string };
  try { data = JSON.parse(rawText); } catch {
    throw new Error(`fal.ai 응답 파싱 실패: ${rawText.slice(0, 200)}`);
  }

  if (!res.ok) {
    const detail = data?.detail || data?.message || rawText.slice(0, 200);
    throw new Error(`fal.ai 오류 [${res.status}]: ${detail}`);
  }

  return data?.images?.[0]?.url ?? null;
}

// ─── Gemini 이미지 생성 ───────────────────────────────────────────────────────

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

// ─── POST Handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const meta = user?.user_metadata ?? {};

    const { title, style, thumbnailType, imageProvider, customPrompt, script, falModel } = await req.json();

    if (!title && !customPrompt && !script) {
      return NextResponse.json({ error: '제목, 프롬프트, 또는 대본이 필요합니다' }, { status: 400 });
    }

    const aspectRatio = thumbnailType === 'youtube' ? '16:9' : '1.91:1';

    // 대본이 있으면 AI 분석
    let scriptAnalysis: { title: string; mood: string; visuals: string; hook: string } | null = null;
    if (script && script.trim().length > 100) {
      scriptAnalysis = await analyzeScriptForThumbnail(script, meta.qwen_api_key ?? null);
    }

    const effectiveTitle = scriptAnalysis?.title || title || '';
    const prompts = customPrompt
      ? [customPrompt]
      : await generatePrompts(effectiveTitle, style ?? 'youtube_bold', thumbnailType ?? 'youtube', scriptAnalysis);

    const results: { url: string; prompt: string }[] = [];
    let lastError = '';

    if (imageProvider === 'fal' || (!imageProvider && meta.fal_api_key)) {
      const apiKey = meta.fal_api_key;
      if (!apiKey) return NextResponse.json({ error: 'fal.ai API 키가 설정에 등록되지 않았습니다' }, { status: 400 });
      for (const prompt of prompts.slice(0, 3)) {
        try {
          const url = await generateWithFal(prompt, apiKey, aspectRatio, falModel);
          if (url) results.push({ url, prompt });
        } catch (e) {
          console.error('[thumbnail fal]', e);
          lastError = e instanceof Error ? e.message : String(e);
        }
      }
    } else if (imageProvider === 'gemini' || meta.gemini_api_key) {
      const apiKey = meta.gemini_api_key;
      if (!apiKey) return NextResponse.json({ error: 'Gemini API 키가 설정에 등록되지 않았습니다' }, { status: 400 });
      for (const prompt of prompts.slice(0, 2)) {
        try {
          const url = await generateWithGemini(prompt, apiKey);
          if (url) results.push({ url, prompt });
        } catch (e) {
          console.error('[thumbnail gemini]', e);
          lastError = e instanceof Error ? e.message : String(e);
        }
      }
    } else {
      return NextResponse.json({ error: 'fal.ai 또는 Gemini API 키를 설정에서 등록해주세요' }, { status: 400 });
    }

    if (results.length === 0) {
      // 원인이 있으면 그대로 노출, 없으면 기본 메시지
      let msg = '이미지 생성에 실패했습니다';
      if (lastError.includes('RESOURCE_EXHAUSTED') || lastError.includes('spending cap')) {
        msg = 'Gemini API 월 사용량을 초과했습니다. fal.ai로 전환하거나 Google AI Studio에서 한도를 확인해주세요.';
      } else if (lastError.includes('PERMISSION_DENIED') || lastError.includes('API_KEY_INVALID')) {
        msg = 'Gemini API 키가 유효하지 않습니다. 설정에서 키를 확인해주세요.';
      } else if (lastError) {
        msg = lastError;
      }
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    return NextResponse.json({
      images: results,
      prompts,
      scriptAnalysis, // 클라이언트에서 분석 결과 표시용
    });
  } catch (err: unknown) {
    console.error('[thumbnail]', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : '썸네일 생성 실패' }, { status: 500 });
  }
}
