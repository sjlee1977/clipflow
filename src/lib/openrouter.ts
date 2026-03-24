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
  { id: 'black-forest-labs/flux.2-klein-4b', name: 'FLUX.2 Klein',      price: '무료(Preview)', speed: 'fast',   quality: 'good',  provider: 'Black Forest Labs' },
  { id: 'sourceful/riverflow-v2-fast',       name: 'Riverflow V2 Fast', price: '무료(Preview)', speed: 'fast',   quality: 'good',  provider: 'Sourceful' },
  // ── 유료 모델 (가성비 순) ─────────────────────────────────────
  { id: 'google/gemini-2.5-flash-image',         name: 'Gemini 2.5 Flash Image', price: '~$0.003/장', speed: 'fast',   quality: 'great', provider: 'Google' },
  { id: 'google/gemini-3.1-flash-image-preview', name: 'Gemini 3.1 Flash Image', price: '~$0.005/장', speed: 'fast',   quality: 'great', provider: 'Google' },
  { id: 'black-forest-labs/flux.2-pro',          name: 'FLUX.2 Pro',             price: '~$0.030/장', speed: 'medium', quality: 'best',  provider: 'Black Forest Labs' },
];

export type LlmModel = {
  id: string;
  name: string;
  price: string;
};

export type VideoModel = {
  id: string;
  name: string;
  provider: 'minimax' | 'kling';
  price: string;
};

export const VIDEO_MODELS: VideoModel[] = [
  { id: 'minimax/video-01', name: 'MiniMax Video 01', provider: 'minimax', price: '$0.05/초' },
  { id: 'kling-v1-6-std-5s', name: 'Kling 1.6 Std (5s)', provider: 'kling', price: '$0.07/클립' },
  { id: 'kling-v1-6-pro-5s', name: 'Kling 1.6 Pro (5s)', provider: 'kling', price: '$0.14/클립' },
];

export const LLM_MODELS: LlmModel[] = [
  // ── 무료 ──────────────────────────────────────────────────────
  { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B',       price: '무료' },
  { id: 'google/gemma-3-27b-it:free',             name: 'Gemma 3 27B',         price: '무료' },
  // ── 저렴 ($0.1~1/1M) ─────────────────────────────────────────
  { id: 'qwen/qwen3.5-flash-02-23',               name: 'Qwen3.5 Flash',         price: '$0.07/1M' },
  { id: 'google/gemini-2.5-flash-lite',           name: 'Gemini 2.5 Flash Lite', price: '$0.10/1M' },  // 🔥 실사용 1위
  { id: 'mistralai/mistral-small-2603',           name: 'Mistral Small 4',       price: '$0.15/1M' },
  { id: 'openai/gpt-5.4-nano',                    name: 'GPT-5.4 Nano',          price: '$0.20/1M' },
  { id: 'qwen/qwen3.5-plus-02-15',                name: 'Qwen3.5 Plus',          price: '$0.26/1M' },
  { id: 'qwen/qwen3-235b-a22b',                   name: 'Qwen3 235B',            price: '$0.46/1M' },
  { id: 'deepseek/deepseek-chat-v3-0324',         name: 'DeepSeek V3',           price: '$0.77/1M' },
  // ── 보통 ($1~5/1M) ───────────────────────────────────────────
  { id: 'openai/gpt-4.1-mini',                    name: 'GPT-4.1 Mini',        price: '$1.60/1M' },  // 🔥 실사용 2위
  { id: 'openai/gpt-5.4-mini',                    name: 'GPT-5.4 Mini',        price: '$1.60/1M' },
  { id: 'google/gemini-3-flash-preview',          name: 'Gemini 3 Flash',      price: '$2.00/1M' },  // 🔥 실사용 3위
  { id: 'google/gemini-2.5-flash',                name: 'Gemini 2.5 Flash',    price: '$2.50/1M' },  // 🔥 실사용 4위
  { id: 'deepseek/deepseek-r1',                   name: 'DeepSeek R1',         price: '$2.50/1M' },
  { id: 'moonshotai/kimi-k2.5',                   name: 'Kimi K2.5',           price: '$3.00/1M' },  // 실사용 9위
  // ── 고급 ($3+/1M) ────────────────────────────────────────────
  { id: 'google/gemini-3.1-flash-lite-preview',   name: 'Gemini 3.1 Flash Lite', price: '$3.00/1M' }, // 실사용 6위
  { id: 'anthropic/claude-sonnet-4.6',            name: 'Claude Sonnet 4.6',   price: '$3.00/1M' },  // 실사용 7위
  { id: 'anthropic/claude-opus-4.6',              name: 'Claude Opus 4.6',     price: '$5.00/1M' },
  { id: 'openai/gpt-5.4',                         name: 'GPT-5.4',             price: '$10.0/1M' },  // 실사용 5위
  { id: 'google/gemini-3.1-pro-preview',          name: 'Gemini 3.1 Pro',      price: '$10.0/1M' },  // 실사용 8위
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
async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 5): Promise<Response> {
  let lastRes: Response | null = null;
  for (let i = 0; i < maxRetries; i++) {
    const res = await fetch(url, options);
    if (res.status !== 429) return res;
    
    lastRes = res;
    // 재시도 대기 시간 증가 (2초, 4초, 8초, 16초, 32초 + 랜덤)
    const waitMs = Math.pow(2, i) * 2000 + Math.random() * 2000;
    console.warn(`[OpenRouter] 429 detected. Retrying in ${Math.round(waitMs)}ms... (${i + 1}/${maxRetries})`);
    await new Promise(r => setTimeout(r, waitMs));
  }
  return lastRes!;
}

/** 글자 수 기반 적정 장면 수 계산 (100자당 1장, min 5, max 30) */
export function calcSceneCount(scriptLength: number): number {
  return Math.min(Math.max(Math.round(scriptLength / 100), 5), 70);
}

/** 대본을 장면으로 분할 */
export async function splitScriptIntoScenes(
  script: string,
  llmModel = 'deepseek/deepseek-chat-v3-0324'
): Promise<ScriptScene[]> {
  const sceneCount = calcSceneCount(script.length);
  const sceneRange = `${sceneCount}~${Math.min(sceneCount + 2, 20)}`;

  const res = await fetchWithRetry(`${OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      model: llmModel,
      messages: [
        {
          role: 'system',
          content: `당신은 영상 제작 전문가입니다. 입력된 대본을 반드시 ${sceneCount}개의 장면으로 정확히 나누고 각 장면에 맞는 이미지 생성 프롬프트(imagePrompt)와 영상 움직임 프롬프트(motionPrompt)를 영어로 만들어주세요.

또한, 전체 장면의 약 10%에 해당하는 중요한 장면이나 화면 전환이 다이내믹한 장면을 선정하여 'shouldAnimate' 필드를 true로 설정해주세요. 나머지 장면은 false입니다.

'motionPrompt'는 해당 장면의 주체가 수행하는 동작이나 구체적인 카메라 워킹을 묘사하는 영어 문장이어야 합니다. 배경만 살짝 움직이는 것이 아니라 실제 동영상처럼 역동적인 변화가 느껴지도록 작성하세요. 
(예: "A person walking down the street, slow tracking shot, cinematic lighting", "Close-up of a character laughing heartily, high dynamic motion", "Distant view of a car speeding through a city, fast panning", "Waves crashing against rocks, epic drone shot")

반드시 아래 JSON 형태로만 응답하세요 (다른 텍스트 없이):
{"scenes": [
  {
    "text": "자막에 표시될 한국어 텍스트 (1~2문장)",
    "imagePrompt": "Detailed English image prompt, 9:16 vertical aspect ratio",
    "motionPrompt": "Dynamic action and camera movement description in English",
    "shouldAnimate": true or false
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

  const parsed = JSON.parse(jsonMatch[0]);
  const scenes: ScriptScene[] = parsed.scenes ?? parsed.data ?? (Array.isArray(parsed) ? parsed : []);
  if (!scenes.length) throw new Error('장면 분할 실패');
  return scenes;
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

/** 모델별 권장 동시 호출 수 (429 방지) */
export function getModelConcurrency(modelId: string): number {
  if (modelId.includes(':free') || modelId.includes('klein') || modelId.includes('riverflow')) {
    return 1; // 무료 모델은 안전하게 1개씩
  }
  if (modelId.startsWith('google/')) {
    return 5; // Google 모델은 속도가 빠르고 제한이 널널함
  }
  return 3; // 일반 유료 모델은 3개 정도
}
