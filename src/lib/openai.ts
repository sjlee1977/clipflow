import OpenAI from 'openai';

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export type ScriptScene = {
  text: string;
  imagePrompt: string;
};

/**
 * 대본을 받아 장면별로 분할하고 이미지 프롬프트를 생성합니다.
 */
export async function splitScriptIntoScenes(script: string): Promise<ScriptScene[]> {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `당신은 영상 제작 전문가입니다. 입력된 대본을 5~8개의 장면으로 나누고 각 장면에 맞는 DALL-E 이미지 생성 프롬프트를 영어로 만들어주세요.

JSON 배열 형태로만 응답하세요:
[
  {
    "text": "자막에 표시될 한국어 텍스트 (1~2문장)",
    "imagePrompt": "Detailed English prompt for DALL-E 3, cinematic style, high quality"
  }
]`,
      },
      {
        role: 'user',
        content: script,
      },
    ],
    response_format: { type: 'json_object' },
  });

  const content = completion.choices[0].message.content;
  if (!content) throw new Error('GPT 응답이 없습니다');

  const parsed = JSON.parse(content);
  // GPT가 { scenes: [...] } 또는 [...] 형태로 응답할 수 있음
  const scenes: ScriptScene[] = Array.isArray(parsed) ? parsed : parsed.scenes ?? [];

  if (!scenes.length) throw new Error('장면 분할 실패');
  return scenes;
}

/**
 * DALL-E 3로 이미지를 생성하고 URL을 반환합니다.
 */
export async function generateImage(prompt: string): Promise<string> {
  const response = await openai.images.generate({
    model: 'dall-e-3',
    prompt,
    size: '1024x1792', // 9:16 세로형
    quality: 'standard',
    n: 1,
  });

  const url = response.data[0].url;
  if (!url) throw new Error('이미지 생성 실패');
  return url;
}
