/**
 * OpenRouter - LLM(장면 분할)
 * 이미지 생성 - Google Gemini/Imagen API
 */
export type ImageModel = {
  id: string;
  name: string;
  price: string;
  speed: 'fast' | 'medium' | 'slow';
  quality: 'good' | 'great' | 'best';
  provider: string;
};

export const IMAGE_MODELS: ImageModel[] = [
  // ── 무료 Preview 모델 ──────────────────────────────────────────
  { id: 'black-forest-labs/flux.2-klein-4b', name: 'FLUX.2 Klein', price: '무료(Preview)', speed: 'fast',   quality: 'good',  provider: 'Black Forest Labs' },
  { id: 'sourceful/riverflow-v2-fast',       name: 'Riverflow V2 Fast', price: '무료(Preview)', speed: 'fast',   quality: 'good',  provider: 'Sourceful' },
  { id: 'bytedance-seed/seedream-4.5',       name: 'Seedream 4.5',  price: '무료(Preview)', speed: 'medium', quality: 'great', provider: 'ByteDance' },
  { id: 'black-forest-labs/flux.2-pro',      name: 'FLUX.2 Pro',   price: '무료(Preview)', speed: 'medium', quality: 'great', provider: 'Black Forest Labs' },
  { id: 'black-forest-labs/flux.2-max',      name: 'FLUX.2 Max',   price: '무료(Preview)', speed: 'slow',   quality: 'best',  provider: 'Black Forest Labs' },
  // ── 유료 모델 (가성비 순) ─────────────────────────────────────
  { id: 'google/gemini-2.5-flash-image',          name: 'Gemini 2.5 Flash', price: '~$0.003/장', speed: 'fast',   quality: 'great', provider: 'Google' },
  { id: 'google/gemini-3.1-flash-image-preview',  name: 'Gemini 3.1 Flash', price: '~$0.005/장', speed: 'fast',   quality: 'great', provider: 'Google' },
  { id: 'openai/gpt-5-image-mini',                name: 'GPT-5 Image Mini', price: '~$0.005/장', speed: 'medium', quality: 'best',  provider: 'OpenAI' },
  { id: 'google/gemini-3-pro-image-preview',       name: 'Gemini 3 Pro',    price: '~$0.020/장', speed: 'slow',   quality: 'best',  provider: 'Google' },
  { id: 'openai/gpt-5-image',                      name: 'GPT-5 Image',     price: '~$0.025/장', speed: 'slow',   quality: 'best',  provider: 'OpenAI' },
];

export const VIDEO_MODELS = [
  { id: 'MiniMax-Hailuo-2.3-Fast', name: 'MiniMax Hailuo 2.3 Fast', price: '$0.19/6초' },
  { id: 'MiniMax-Hailuo-2.3',      name: 'MiniMax Hailuo 2.3',      price: '$0.28/6초' },
  { id: 'MiniMax-Hailuo-02',       name: 'MiniMax Hailuo 02',       price: '$0.10/6초' },
  { id: 'kling-v1',                name: 'Kling V1.0',              price: '$0.14/5초' },
  { id: 'kling-v2.5-turbo',        name: 'Kling V2.5 Turbo',        price: '$0.21/5초' },
  { id: 'kling-v2.6',              name: 'Kling V2.6',              price: '$0.21/5초' },
];

export type LlmModel = {
  id: string;
  name: string;
  price: string;
};

export const LLM_MODELS: LlmModel[] = [
  // ── 무료 ──────────────────────────────────────────────────────
  { id: 'meta-llama/llama-3.3-70b-instruct:free',           name: 'Llama 3.3 70B',           price: '무료' },
  { id: 'google/gemma-3-27b-it:free',                       name: 'Gemma 3 27B',             price: '무료' },
  { id: 'google/gemma-3-12b-it:free',                       name: 'Gemma 3 12B',             price: '무료' },
  { id: 'google/gemma-3-4b-it:free',                        name: 'Gemma 3 4B',              price: '무료' },
  { id: 'mistralai/mistral-small-3.2-24b-instruct:free',    name: 'Mistral Small 3.2',       price: '무료' },
  { id: 'stepfun/step-3.5-flash:free',                      name: 'Step 3.5 Flash',          price: '무료' },
  { id: 'nvidia/nemotron-3-nano-30b-a3b:free',              name: 'Nemotron 3 Nano 30B',     price: '무료' },
  { id: 'liquid/lfm-2.5-1.2b-instruct:free',                name: 'LFM2.5 1.2B Instruct',    price: '무료' },
  { id: 'liquid/lfm-2.5-1.2b-thinking:free',                name: 'LFM2.5 1.2B Thinking',    price: '무료' },
  // ── 유료 (출력 토큰 가격 오름차순) ───────────────────────────
  { id: 'liquid/lfm-2-24b-a2b',                             name: 'LFM2 24B A2B',            price: '입$0.03/출$0.12' },
  { id: 'amazon/nova-micro-v1',                             name: 'Nova Micro 1.0',          price: '입$0.035/출$0.14' },
  { id: 'openai/gpt-5-nano',                                name: 'GPT-5 Nano',              price: '입$0.05/출$0.40' },
  { id: 'qwen/qwen3.5-9b',                                  name: 'Qwen3.5 9B',              price: '입$0.05/출$0.15' },
  { id: 'google/gemini-2.5-flash-lite',                     name: 'Gemini 2.5 Flash Lite',   price: '입$0.10/출$0.40' },
  { id: 'openai/gpt-4.1-nano',                              name: 'GPT-4.1 Nano',            price: '입$0.10/출$0.40' },
  { id: 'openai/gpt-4o-mini',                               name: 'GPT-4o Mini',             price: '입$0.15/출$0.60' },
  { id: 'deepseek/deepseek-chat-v3-0324',                   name: 'DeepSeek V3',             price: '입$0.20/출$0.77' },
  { id: 'openai/gpt-5.4-nano',                              name: 'GPT-5.4 Nano',            price: '입$0.20/출$1.25' },
  { id: 'inception/mercury-2',                              name: 'Mercury 2',               price: '입$0.25/출$0.75' },
  { id: 'google/gemini-2.5-flash',                          name: 'Gemini 2.5 Flash',        price: '입$0.30/출$2.50' },
  { id: 'openai/gpt-4.1-mini',                              name: 'GPT-4.1 Mini',            price: '입$0.40/출$1.60' },
  { id: 'mistralai/mistral-medium-3',                       name: 'Mistral Medium 3',        price: '입$0.40/출$2.00' },
  { id: 'mistralai/mistral-medium-3.1',                     name: 'Mistral Medium 3.1',      price: '입$0.40/출$2.00' },
  { id: 'deepseek/deepseek-r1',                             name: 'DeepSeek R1',             price: '입$0.70/출$2.50' },
  { id: 'anthropic/claude-haiku-4.5',                       name: 'Claude Haiku 4.5',        price: '입$1.00/출$5.00' },
  { id: 'google/gemini-2.5-pro',                            name: 'Gemini 2.5 Pro',          price: '입$1.25/출$10.0' },
  { id: 'openai/gpt-5',                                     name: 'GPT-5',                   price: '입$1.25/출$10.0' },
  { id: 'anthropic/claude-sonnet-4.6',                      name: 'Claude Sonnet 4.6',       price: '입$3.00/출$15.0' },
];

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';

function headers() {
  return {
    'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://clipflow.app',
    'X-Title': 'ClipFlow',
  };
}

export type ScriptScene = {
  text: string;
  imagePrompt: string;
  motionPrompt: string;
  shouldAnimate: boolean;
};

/** 429 재시도를 포함한 fetch 헬퍼 */
async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
  let lastRes: Response | null = null;
  for (let i = 0; i < maxRetries; i++) {
    const res = await fetch(url, options);
    if (res.status !== 429) return res;
    
    lastRes = res;
    const waitMs = Math.pow(2, i) * 2000 + Math.random() * 1000;
    console.warn(`[OpenRouter] 429 detected. Retrying in ${Math.round(waitMs)}ms... (${i + 1}/${maxRetries})`);
    await new Promise(r => setTimeout(r, waitMs));
  }
  return lastRes!;
}

export type SceneSplitResult = {
  scenes: ScriptScene[];
  usage: { promptTokens: number; completionTokens: number };
};

/** 대본을 장면으로 분할 */
export async function splitScriptIntoScenes(
  script: string,
  llmModel = 'deepseek/deepseek-chat-v3-0324',
  sceneCount?: number
): Promise<SceneSplitResult> {
  const count = sceneCount ?? Math.max(5, Math.round(script.length / 100));
  const res = await fetchWithRetry(`${OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      model: llmModel,
      max_tokens: 4096,
      messages: [
        {
          role: 'system',
          content: `당신은 영상 제작 전문가입니다. 입력된 대본을 정확히 ${count}개의 장면으로 나누어주세요. 각 장면의 길이는 내용의 중요도와 분량에 맞게 자연스럽게 구성하세요.
각 장면은 (1) 실제 영상에 들어갈 텍스트(한국어), (2) 해당 장면을 묘사하는 이미지 생성을 위한 프롬프트(영어), (3) 카메라의 움직임이나 캐릭터의 동작을 묘사하는 비디오 생성용 프롬프트(영어), (4) 해당 장면이 AI 비디오로 변환되기에 적합한지 여부(boolean)를 포함해야 합니다.
**중요: 전체 장면 중 약 10% 정도의 장면(최소 1개 이상)에 대해 "shouldAnimate"를 true로 설정하세요.**

반드시 아래 JSON 형태로만 응답하세요 (다른 텍스트 없이):
{"scenes": [
  {
    "text": "자막 텍스트",
    "imagePrompt": "Detailed English image generation prompt...",
    "motionPrompt": "Detailed English motion prompt for video generation...",
    "shouldAnimate": true
  }
]}`,
        },
        { role: 'user', content: script },
      ],
    }),
  });

  const rawText = await res.text();
  if (res.status === 429) {
    throw new Error('요청이 너무 많습니다 (429). 무료 모델의 동시 호출 제한을 초과했습니다. 잠시 후 다시 시도하거나 유료 모델을 선택해주세요.');
  }
  const data = JSON.parse(rawText);
  if (!res.ok) {
    console.error('[splitScenes] status:', res.status, 'body:', rawText.slice(0, 300));
    throw new Error(data?.error?.message || `장면 분할 실패 (${res.status})`);
  }

  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('LLM 응답 없음');

  // JSON 블록 추출 (마크다운 코드블록 제거)
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('LLM JSON 응답 없음');

  let jsonStr = jsonMatch[0];

  // 잘못된 JSON 자동 복구: 제어문자 제거, 줄바꿈 정리
  jsonStr = jsonStr
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')  // 제어문자 제거
    .replace(/,\s*([}\]])/g, '$1')                        // trailing comma 제거
    .replace(/([{,]\s*)(\w+)\s*:/g, '$1"$2":');           // 키 따옴표 누락 보정

  let parsed: any;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    // 마지막 완성된 장면까지만 추출 시도
    const partial = jsonStr.match(/("scenes"\s*:\s*\[[\s\S]*)\s*\{[^}]*$/);
    if (partial) {
      try {
        parsed = JSON.parse(jsonStr.slice(0, jsonStr.lastIndexOf('},') + 1) + ']}');
      } catch {
        throw new Error('LLM JSON 파싱 실패 — 더 안정적인 모델을 선택해주세요');
      }
    } else {
      throw new Error('LLM JSON 파싱 실패 — 더 안정적인 모델을 선택해주세요');
    }
  }

  const scenes: ScriptScene[] = parsed.scenes ?? parsed.data ?? (Array.isArray(parsed) ? parsed : []);
  if (!scenes.length) throw new Error('장면 분할 실패');

  const usage = data.usage ?? {};
  return {
    scenes,
    usage: {
      promptTokens: usage.prompt_tokens ?? 0,
      completionTokens: usage.completion_tokens ?? 0,
    },
  };
}

async function parseImageUrl(url: string): Promise<Buffer> {
  if (url.startsWith('data:')) return Buffer.from(url.split(',')[1], 'base64');
  const res = await fetch(url);
  return Buffer.from(await res.arrayBuffer());
}

// /images/generations 엔드포인트를 사용하는 프로바이더
const IMAGE_GENERATIONS_PROVIDERS = [
  'black-forest-labs',
  'sourceful',
  'bytedance-seed',
];

function isImagesEndpoint(modelId: string): boolean {
  return IMAGE_GENERATIONS_PROVIDERS.some(p => modelId.startsWith(p));
}

/** OpenRouter 이미지 생성 → Buffer 반환 */
export async function generateImage(
  prompt: string,
  modelId: string,
  aspectRatio: '9:16' | '16:9' = '9:16',
  characterImageBase64?: string,
): Promise<Buffer> {
  const isGoogle = modelId.startsWith('google/');
  const size = aspectRatio === '9:16' ? '1024x1792' : '1792x1024';

  const userContent = characterImageBase64
    ? [
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${characterImageBase64}` } },
        { type: 'text', text: `Generate an image featuring this character: ${prompt}. Keep the character's appearance consistent with the reference image. Aspect Ratio: ${aspectRatio}` },
      ]
    : `Generate an image: ${prompt}. Aspect Ratio: ${aspectRatio}.`;

  const body: any = {
    model: modelId,
    messages: [{ role: 'user', content: userContent }],
    modalities: ['image'],
  };

  // Google Gemini 모델은 전용 설정 필요
  if (isGoogle) {
    body.generation_config = { response_modalities: ['IMAGE'] };
  } else {
    // 일반 이미지 모델 (FLUX 등)은 prompt와 size를 직접 넣기도 함 (OpenRouter 프록시 정책에 따라 다름)
    // 하지만 공식 가이드는 chat/completions + modalities 임.
  }

  const res = await fetchWithRetry(`${OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  });

  const rawText = await res.text();
  console.log('[generateImage] status:', res.status, 'model:', modelId, 'body:', rawText.slice(0, 500));
  
  if (res.status === 429) {
    throw new Error('이미지 생성 요청이 너무 많습니다 (429). 무료 모델의 동시 호출 제한을 초과했습니다. 잠시 후 다시 시도하거나 유료 모델을 선택해주세요.');
  }

  const data = JSON.parse(rawText);
  if (!res.ok) throw new Error(data.error?.message || '이미지 생성 실패');

  const msg = data.choices?.[0]?.message;

  // 1. Google Gemini 스타일 파싱
  const imgFromImages = msg?.images?.[0]?.image_url?.url;
  if (imgFromImages) return parseImageUrl(imgFromImages);

  // 2. OpenAI / Multimodal 스타일 파싱 (content 배열 내 image_url)
  if (Array.isArray(msg?.content)) {
    const imgPart = msg.content.find((p: any) => p.type === 'image_url');
    if (imgPart?.image_url?.url) return parseImageUrl(imgPart.image_url.url);
  }

  // 3. 직접적인 data URL 또는 URL 문자열
  const content = msg?.content;
  if (typeof content === 'string') {
    if (content.startsWith('data:') || content.startsWith('http')) {
      return parseImageUrl(content);
    }
  }

  // 4. OpenAI images/generations 스타일 (가끔 chat/completions에서도 전달됨)
  const dataUrl = data.data?.[0]?.url || data.data?.[0]?.b64_json;
  if (dataUrl) return parseImageUrl(dataUrl.startsWith('http') ? dataUrl : `data:image/png;base64,${dataUrl}`);

  console.error('[generateImage] unexpected response:', JSON.stringify(data).slice(0, 800));
  throw new Error('생성된 이미지 데이터를 찾을 수 없습니다.');
}

/** 모델별 최적 동시 호출 수 반환 */
export function getModelConcurrency(modelId: string): number {
  if (modelId.includes('black-forest-labs')) return 1;
  if (modelId.includes('google/')) return 2;
  return 3;
}
