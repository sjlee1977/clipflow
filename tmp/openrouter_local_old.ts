/**
 * OpenRouter - LLM(?λ㈃ 遺꾪븷)
 * ?대?吏 ?앹꽦 - Google Gemini/Imagen API
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
  // ?? 臾대즺 Preview 紐⑤뜽 ??????????????????????????????????????????
  { id: 'black-forest-labs/flux.2-klein-4b', name: 'FLUX.2 Klein', price: '臾대즺(Preview)', speed: 'fast',   quality: 'good',  provider: 'Black Forest Labs' },
  { id: 'sourceful/riverflow-v2-fast',       name: 'Riverflow V2 Fast', price: '臾대즺(Preview)', speed: 'fast',   quality: 'good',  provider: 'Sourceful' },
  { id: 'bytedance-seed/seedream-4.5',       name: 'Seedream 4.5',  price: '臾대즺(Preview)', speed: 'medium', quality: 'great', provider: 'ByteDance' },
  { id: 'black-forest-labs/flux.2-pro',      name: 'FLUX.2 Pro',   price: '臾대즺(Preview)', speed: 'medium', quality: 'great', provider: 'Black Forest Labs' },
  { id: 'black-forest-labs/flux.2-max',      name: 'FLUX.2 Max',   price: '臾대즺(Preview)', speed: 'slow',   quality: 'best',  provider: 'Black Forest Labs' },
  // ?? ?좊즺 紐⑤뜽 (媛?깅퉬 ?? ?????????????????????????????????????
  { id: 'google/gemini-2.5-flash-image',          name: 'Gemini 2.5 Flash', price: '~$0.003/??, speed: 'fast',   quality: 'great', provider: 'Google' },
  { id: 'google/gemini-3.1-flash-image-preview',  name: 'Gemini 3.1 Flash', price: '~$0.005/??, speed: 'fast',   quality: 'great', provider: 'Google' },
  { id: 'openai/gpt-5-image-mini',                name: 'GPT-5 Image Mini', price: '~$0.005/??, speed: 'medium', quality: 'best',  provider: 'OpenAI' },
  { id: 'google/gemini-3-pro-image-preview',       name: 'Gemini 3 Pro',    price: '~$0.020/??, speed: 'slow',   quality: 'best',  provider: 'Google' },
  { id: 'openai/gpt-5-image',                      name: 'GPT-5 Image',     price: '~$0.025/??, speed: 'slow',   quality: 'best',  provider: 'OpenAI' },
];

export type LlmModel = {
  id: string;
  name: string;
  price: string;
};

export const LLM_MODELS: LlmModel[] = [
  // ?? 臾대즺 ??????????????????????????????????????????????????????
  { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B',       price: '臾대즺' },
  { id: 'google/gemma-3-27b-it:free',             name: 'Gemma 3 27B',         price: '臾대즺' },
  { id: 'mistralai/mistral-small-3.1-24b-instruct:free', name: 'Mistral Small 3.1', price: '臾대즺' },
  // ?? ???($0.1~0.8/1M) ???????????????????????????????????????
  { id: 'google/gemini-2.5-flash-lite',           name: 'Gemini 2.5 Flash Lite', price: '$0.40/1M' },
  { id: 'openai/gpt-4.1-nano',                    name: 'GPT-4.1 Nano',        price: '$0.40/1M' },
  { id: 'openai/gpt-5-nano',                      name: 'GPT-5 Nano',          price: '$0.40/1M' },
  { id: 'deepseek/deepseek-chat-v3-0324',         name: 'DeepSeek V3',         price: '$0.77/1M' },
  // ?? 蹂댄넻 ($1~5/1M) ???????????????????????????????????????????
  { id: 'openai/gpt-4.1-mini',                    name: 'GPT-4.1 Mini',        price: '$1.60/1M' },
  { id: 'google/gemini-2.5-flash',                name: 'Gemini 2.5 Flash',    price: '$2.50/1M' },
  { id: 'deepseek/deepseek-r1',                   name: 'DeepSeek R1',         price: '$2.50/1M' },
  { id: 'anthropic/claude-haiku-4.5',             name: 'Claude Haiku 4.5',    price: '$5.00/1M' },
  // ?? 怨좉툒 ($10+/1M) ???????????????????????????????????????????
  { id: 'google/gemini-2.5-pro',                  name: 'Gemini 2.5 Pro',      price: '$10.0/1M' },
  { id: 'openai/gpt-5',                           name: 'GPT-5',               price: '$10.0/1M' },
  { id: 'anthropic/claude-sonnet-4.6',            name: 'Claude Sonnet 4.6',   price: '$15.0/1M' },
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
};

/** 429 ?ъ떆?꾨? ?ы븿??fetch ?ы띁 */
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

/** ?蹂몄쓣 ?λ㈃?쇰줈 遺꾪븷 */
export async function splitScriptIntoScenes(
  script: string,
  llmModel = 'deepseek/deepseek-chat-v3-0324'
): Promise<ScriptScene[]> {
  const res = await fetchWithRetry(`${OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      model: llmModel,
      messages: [
        {
          role: 'system',
          content: `?뱀떊? ?곸긽 ?쒖옉 ?꾨Ц媛?낅땲?? ?낅젰???蹂몄쓣 5~8媛쒖쓽 ?λ㈃?쇰줈 ?섎늻怨?媛??λ㈃??留욌뒗 ?대?吏 ?앹꽦 ?꾨＼?꾪듃瑜??곸뼱濡?留뚮뱾?댁＜?몄슂.

諛섎뱶???꾨옒 JSON ?뺥깭濡쒕쭔 ?묐떟?섏꽭??(?ㅻⅨ ?띿뒪???놁씠):
{"scenes": [
  {
    "text": "?먮쭑???쒖떆???쒓뎅???띿뒪??(1~2臾몄옣)",
    "imagePrompt": "Detailed English prompt, cinematic style, high quality, 9:16 vertical aspect ratio"
  }
]}`,
        },
        { role: 'user', content: script },
      ],
    }),
  });

  const rawText = await res.text();
  if (res.status === 429) {
    throw new Error('?붿껌???덈Т 留롮뒿?덈떎 (429). 臾대즺 紐⑤뜽???숈떆 ?몄텧 ?쒗븳??珥덇낵?덉뒿?덈떎. ?좎떆 ???ㅼ떆 ?쒕룄?섍굅???좊즺 紐⑤뜽???좏깮?댁＜?몄슂.');
  }
  const data = JSON.parse(rawText);
  if (!res.ok) {
    console.error('[splitScenes] status:', res.status, 'body:', rawText.slice(0, 300));
    throw new Error(data?.error?.message || `?λ㈃ 遺꾪븷 ?ㅽ뙣 (${res.status})`);
  }

  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('LLM ?묐떟 ?놁쓬');

  // JSON 釉붾줉 異붿텧 (留덊겕?ㅼ슫 肄붾뱶釉붾줉 ?쒓굅)
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('LLM JSON ?묐떟 ?놁쓬');

  const parsed = JSON.parse(jsonMatch[0]);
  const scenes: ScriptScene[] = parsed.scenes ?? parsed.data ?? (Array.isArray(parsed) ? parsed : []);
  if (!scenes.length) throw new Error('?λ㈃ 遺꾪븷 ?ㅽ뙣');
  return scenes;
}

async function parseImageUrl(url: string): Promise<Buffer> {
  if (url.startsWith('data:')) return Buffer.from(url.split(',')[1], 'base64');
  const res = await fetch(url);
  return Buffer.from(await res.arrayBuffer());
}

// /images/generations ?붾뱶?ъ씤?몃? ?ъ슜?섎뒗 ?꾨줈諛붿씠??const IMAGE_GENERATIONS_PROVIDERS = [
  'black-forest-labs',
  'sourceful',
  'bytedance-seed',
];

function isImagesEndpoint(modelId: string): boolean {
  return IMAGE_GENERATIONS_PROVIDERS.some(p => modelId.startsWith(p));
}

/** OpenRouter ?대?吏 ?앹꽦 ??Buffer 諛섑솚 */
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

  // Google Gemini 紐⑤뜽? ?꾩슜 ?ㅼ젙 ?꾩슂
  if (isGoogle) {
    body.generation_config = { response_modalities: ['IMAGE'] };
  } else {
    // ?쇰컲 ?대?吏 紐⑤뜽 (FLUX ??? prompt? size瑜?吏곸젒 ?ｊ린????(OpenRouter ?꾨줉???뺤콉???곕씪 ?ㅻ쫫)
    // ?섏?留?怨듭떇 媛?대뱶??chat/completions + modalities ??
  }

  const res = await fetchWithRetry(`${OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  });

  const rawText = await res.text();
  console.log('[generateImage] status:', res.status, 'model:', modelId, 'body:', rawText.slice(0, 500));
  
  if (res.status === 429) {
    throw new Error('?대?吏 ?앹꽦 ?붿껌???덈Т 留롮뒿?덈떎 (429). 臾대즺 紐⑤뜽???숈떆 ?몄텧 ?쒗븳??珥덇낵?덉뒿?덈떎. ?좎떆 ???ㅼ떆 ?쒕룄?섍굅???좊즺 紐⑤뜽???좏깮?댁＜?몄슂.');
  }

  const data = JSON.parse(rawText);
  if (!res.ok) throw new Error(data.error?.message || '?대?吏 ?앹꽦 ?ㅽ뙣');

  const msg = data.choices?.[0]?.message;

  // 1. Google Gemini ?ㅽ????뚯떛
  const imgFromImages = msg?.images?.[0]?.image_url?.url;
  if (imgFromImages) return parseImageUrl(imgFromImages);

  // 2. OpenAI / Multimodal ?ㅽ????뚯떛 (content 諛곗뿴 ??image_url)
  if (Array.isArray(msg?.content)) {
    const imgPart = msg.content.find((p: any) => p.type === 'image_url');
    if (imgPart?.image_url?.url) return parseImageUrl(imgPart.image_url.url);
  }

  // 3. 吏곸젒?곸씤 data URL ?먮뒗 URL 臾몄옄??  const content = msg?.content;
  if (typeof content === 'string') {
    if (content.startsWith('data:') || content.startsWith('http')) {
      return parseImageUrl(content);
    }
  }

  // 4. OpenAI images/generations ?ㅽ???(媛??chat/completions?먯꽌???꾨떖??
  const dataUrl = data.data?.[0]?.url || data.data?.[0]?.b64_json;
  if (dataUrl) return parseImageUrl(dataUrl.startsWith('http') ? dataUrl : `data:image/png;base64,${dataUrl}`);

  console.error('[generateImage] unexpected response:', JSON.stringify(data).slice(0, 800));
  throw new Error('?앹꽦???대?吏 ?곗씠?곕? 李얠쓣 ???놁뒿?덈떎.');
}
