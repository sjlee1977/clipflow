/**
 * fal.ai 이미지 생성 라이브러리
 * - Z-Image (LoRA 기반)
 * - FLUX 계열 (Schnell / Dev / Pro)
 */

const FAL_BASE = 'https://fal.run';

function headers(apiKey?: string) {
  return {
    'Authorization': `Key ${apiKey || process.env.FAL_KEY}`,
    'Content-Type': 'application/json',
  };
}

type ImageSize = 'square_hd' | 'portrait_16_9' | 'landscape_16_9';
type AspectRatio = '1:1' | '9:16' | '16:9';

const FORMAT_TO_SIZE: Record<string, ImageSize> = {
  shorts: 'portrait_16_9',
  landscape: 'landscape_16_9',
  square: 'square_hd',
};

const FORMAT_TO_ASPECT: Record<string, AspectRatio> = {
  shorts: '9:16',
  landscape: '16:9',
  square: '1:1',
};

// Z-Image (LoRA) 계열
const Z_IMAGE_ENDPOINTS: Record<string, string> = {
  'fal/z-image-turbo': 'fal-ai/z-image/turbo/lora',
  'fal/z-image-base': 'fal-ai/z-image/base/lora',
};

// FLUX 계열 엔드포인트
const FLUX_ENDPOINTS: Record<string, string> = {
  'fal/flux-schnell': 'fal-ai/flux/schnell',
  'fal/flux-dev':     'fal-ai/flux/dev',
  'fal/flux-pro':     'fal-ai/flux-pro/v1.1',
};

export async function generateFalImage(
  prompt: string,
  modelId: string,
  format = 'landscape',
  apiKey?: string
): Promise<string> {
  // FLUX 계열 처리
  const fluxEndpoint = FLUX_ENDPOINTS[modelId];
  if (fluxEndpoint) {
    return generateFluxImage(prompt, fluxEndpoint, modelId, format, apiKey);
  }

  // Z-Image (LoRA) 계열
  const endpoint = Z_IMAGE_ENDPOINTS[modelId] ?? 'fal-ai/z-image/turbo/lora';
  const image_size = FORMAT_TO_SIZE[format] ?? 'landscape_16_9';

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

  let res: Response;
  try {
    res = await fetch(`${FAL_BASE}/${endpoint}`, {
      method: 'POST',
      headers: headers(apiKey),
      body: JSON.stringify({ prompt, image_size, num_images: 1 }),
      signal: controller.signal,
    });
  } catch (err: any) {
    if (err.name === 'AbortError') throw new Error('fal.ai 이미지 생성 타임아웃 (60초 초과)');
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  const rawText = await res.text();
  let data: any;
  try { data = JSON.parse(rawText); } catch {
    throw new Error(`fal.ai 이미지 응답 파싱 실패: ${rawText.slice(0, 200)}`);
  }

  if (!res.ok) {
    throw new Error(`fal.ai 이미지 오류 [${res.status}]: ${data?.detail || rawText.slice(0, 200)}`);
  }

  const url = data?.images?.[0]?.url;
  if (!url) throw new Error('fal.ai 이미지 URL을 받지 못했습니다');
  return url;
}

async function generateFluxImage(
  prompt: string,
  endpoint: string,
  modelId: string,
  format: string,
  apiKey?: string
): Promise<string> {
  const isPro = modelId === 'fal/flux-pro';

  // Pro는 aspect_ratio, 나머지는 image_size
  const sizeParam = isPro
    ? { aspect_ratio: FORMAT_TO_ASPECT[format] ?? '16:9' }
    : { image_size: FORMAT_TO_SIZE[format] ?? 'landscape_16_9' };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000); // FLUX는 최대 2분

  let res: Response;
  try {
    res = await fetch(`${FAL_BASE}/${endpoint}`, {
      method: 'POST',
      headers: headers(apiKey),
      body: JSON.stringify({
        prompt,
        ...sizeParam,
        num_images: 1,
        num_inference_steps: modelId === 'fal/flux-schnell' ? 4 : 28,
      }),
      signal: controller.signal,
    });
  } catch (err: any) {
    if (err.name === 'AbortError') throw new Error('FLUX 이미지 생성 타임아웃 (2분 초과)');
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  const rawText = await res.text();
  let data: any;
  try { data = JSON.parse(rawText); } catch {
    throw new Error(`FLUX 이미지 응답 파싱 실패: ${rawText.slice(0, 200)}`);
  }

  if (!res.ok) {
    const detail = data?.detail || data?.message || rawText.slice(0, 200);
    throw new Error(`FLUX 이미지 오류 [${res.status}]: ${detail}`);
  }

  const url = data?.images?.[0]?.url;
  if (!url) throw new Error('FLUX 이미지 URL을 받지 못했습니다');
  return url;
}
