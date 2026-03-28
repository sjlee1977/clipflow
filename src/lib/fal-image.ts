/**
 * fal.ai Z-Image LoRA 이미지 생성
 */

const FAL_BASE = 'https://fal.run';

function headers(apiKey?: string) {
  return {
    'Authorization': `Key ${apiKey || process.env.FAL_KEY}`,
    'Content-Type': 'application/json',
  };
}

type ImageSize = 'square_hd' | 'portrait_16_9' | 'landscape_16_9';

const FORMAT_TO_SIZE: Record<string, ImageSize> = {
  shorts: 'portrait_16_9',
  landscape: 'landscape_16_9',
  square: 'square_hd',
};

export async function generateFalImage(
  prompt: string,
  modelId: string,
  format = 'landscape',
  apiKey?: string
): Promise<string> {
  // 'fal/z-image-turbo' → 'fal-ai/z-image/turbo/lora'
  const endpointMap: Record<string, string> = {
    'fal/z-image-turbo': 'fal-ai/z-image/turbo/lora',
    'fal/z-image-base': 'fal-ai/z-image/base/lora',
  };
  const endpoint = endpointMap[modelId] ?? 'fal-ai/z-image/turbo/lora';
  const image_size = FORMAT_TO_SIZE[format] ?? 'landscape_16_9';

  const res = await fetch(`${FAL_BASE}/${endpoint}`, {
    method: 'POST',
    headers: headers(apiKey),
    body: JSON.stringify({ prompt, image_size, num_images: 1 }),
  });

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
