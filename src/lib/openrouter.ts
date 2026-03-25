import axios from 'axios';

export const LLM_MODELS = [
  { id: 'deepseek/deepseek-chat-v3-0324', name: 'DeepSeek V3 (추천)', price: '0.01$/1k' },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', price: '0.05$/1k' },
  { id: 'anthropic/claude-3.5-haiku', name: 'Claude 3.5 Haiku', price: '0.10$/1k' },
];

export const IMAGE_MODELS = [
  { id: 'black-forest-labs/flux.2-klein-4b', name: 'Flux.2 Klein (빠름/무료)', price: '무료' },
  { id: 'stabilityai/stable-diffusion-3.5-large', name: 'SD 3.5 Large (고품질)', price: '3.50$/1k' },
  { id: 'recraft-ai/recraft-v3', name: 'Recraft V3 (예술적)', price: '4.00$/1k' },
];

export const VIDEO_MODELS = [
  { id: 'minimax/video-01', name: 'MiniMax Video-01 (고품질)', price: '$0.20/장면' },
  { id: 'kling/kling-v1', name: 'Kling V1.0 (표준)', price: '$0.15/장면' },
];

export interface ScriptScene {
  text: string;
  imagePrompt: string;
  motionPrompt: string;
  shouldAnimate: boolean;
}

export function getModelConcurrency(modelId: string): number {
  if (modelId.includes('flux.2-klein-4b')) return 1; // 무료 모델은 순차적 처리 권장
  return 3; // 유료 모델은 병렬 처리 가능
}

export async function splitScriptIntoScenes(script: string, modelId: string): Promise<ScriptScene[]> {
  const prompt = `
영상을 만들기 위해 다음 대본을 5~10개의 장면으로 나누어주세요. 
각 장면은 (1) 실제 영상에 들어갈 텍스트(한국어), (2) 해당 장면을 묘사하는 이미지 생성을 위한 프롬프트(영어), (3) 카메라의 움직임이나 캐릭터의 동작을 묘사하는 비디오 생성용 프롬프트(영어), (4) 해당 장면이 AI 비디오로 변환되기에 적합한지 여부(boolean)를 포함해야 합니다.

출력 형식은 반드시 다음과 같은 JSON 배열이어야 합니다:
[
  {
    "text": "장면 텍스트",
    "imagePrompt": "Detailed English image generation prompt...",
    "motionPrompt": "Detailed English motion prompt for video generation...",
    "shouldAnimate": true
  }
]

대본:
${script}
`;

  const response = await axios.post(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      model: modelId,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    },
    {
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
    }
  );

  const content = response.data.choices[0].message.content;
  const parsed = JSON.parse(content);
  return Array.isArray(parsed) ? parsed : parsed.scenes;
}

export async function generateImage(
  prompt: string, 
  modelId: string, 
  aspectRatio: string = '9:16',
  characterImageBase64?: string | null
): Promise<Buffer> {
  const response = await axios.post(
    'https://openrouter.ai/api/v1/images/generations',
    {
      model: modelId,
      prompt: prompt,
      response_format: 'b64_json',
      size: aspectRatio === '9:16' ? '720x1280' : '1280x720',
      ...(characterImageBase64 && {
        image_reference: {
          image: characterImageBase64,
          strength: 0.6
        }
      })
    },
    {
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
    }
  );

  const b64Data = response.data.data[0].b64_json;
  return Buffer.from(b64Data, 'base64');
}
