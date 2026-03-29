import { GoogleGenAI } from '@google/genai';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({
  region: process.env.AWS_REGION ?? 'ap-northeast-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.S3_BUCKET ?? 'remotionlambda-apnortheast2-17lxfxukvf';

let ai: GoogleGenAI;
function getAI(apiKey?: string) {
  if (apiKey) return new GoogleGenAI({ apiKey });
  if (!ai) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error('GEMINI_API_KEY 환경변수가 설정되지 않았습니다');
    ai = new GoogleGenAI({ apiKey: key });
  }
  return ai;
}

export type GoogleVoice = {
  id: string;
  name: string;
  gender: 'female' | 'male';
};

export const GOOGLE_VOICES: GoogleVoice[] = [
  { id: 'Kore',   name: 'Kore (차분한 여성)',  gender: 'female' },
  { id: 'Aoede',  name: 'Aoede (밝은 여성)',   gender: 'female' },
  { id: 'Leda',   name: 'Leda (부드러운 여성)', gender: 'female' },
  { id: 'Charon', name: 'Charon (중후한 남성)', gender: 'male'   },
  { id: 'Fenrir', name: 'Fenrir (강한 남성)',   gender: 'male'   },
  { id: 'Puck',   name: 'Puck (밝은 남성)',     gender: 'male'   },
  { id: 'Orus',   name: 'Orus (안정적 남성)',   gender: 'male'   },
];

export type ScriptScene = {
  text: string;
  imagePrompt: string;
  motionPrompt?: string;
  shouldAnimate?: boolean;
  textAnimationStyle?: 'none' | 'typewriter' | 'fly-in' | 'pop-in' | 'fade-zoom';
  textPosition?: 'bottom' | 'center' | 'top';
};

export type SceneSplitResult = {
  scenes: ScriptScene[];
  usage: { promptTokens: number; completionTokens: number };
};

/**
 * Google AI Studio 직접 호출로 대본을 장면 분할
 */
export async function splitScriptIntoScenes(
  script: string,
  llmModelId = 'gemini-2.5-flash',
  sceneCount = 1,
  hasCharacter?: boolean,
  apiKey?: string,
  subCharacterNames?: string[],
  allowedAnimations?: string[],
  imageStyle?: string
): Promise<SceneSplitResult> {
  const model = llmModelId.startsWith('google/') ? llmModelId.slice('google/'.length) : llmModelId;

  const subCharacterInstruction = subCharacterNames && subCharacterNames.length > 0
    ? `\n추가 캐릭터: ${subCharacterNames.map((n, i) => `캐릭터${i + 2}(${n})`).join(', ')}. 장면 내용에 따라 이 캐릭터들을 imagePrompt에 자연스럽게 등장시키세요.`
    : '';

  const characterInstruction = hasCharacter
    ? `\n**중요 - 캐릭터 참조 이미지 있음**: imagePrompt에서 메인 캐릭터의 표정(기쁨/슬픔/놀람/진지함 등), 자세(서있는/앉아있는/걷는/손짓하는 등), 제스처, 시선 방향을 장면 내용에 맞게 구체적으로 묘사하세요. 배경과 조명도 장면 분위기에 맞게 묘사하세요. 절대로 참조 이미지의 포즈를 그대로 복사하지 마세요.${subCharacterInstruction}`
    : '';

  const animList = (allowedAnimations && allowedAnimations.length > 0) 
    ? allowedAnimations.join(', ') 
    : 'none';

  const isTypographyMode = imageStyle === 'none';

  const advancedEffectsPrompt = isTypographyMode
    ? `
(5) textAnimationStyle: 텍스트 애니메이션 및 모션 그래픽 (반드시 다음 목록 중에서만 선택: ${animList})
    - **중요: 타이포그래피 중심 영상이므로 모든 장면(100%)에 애니메이션/효과를 적용하세요.**
    - 'clock-spin': 시간/기다림, 'pulse-ring': 강한 강조, 'sparkle': 신비/우아함, 'confetti': 축하/승리, 'rain': 슬픔/감성, 'snow': 겨울/평화, 'fire': 열정/강렬, 'heart': 사랑/행복, 'stars': 꿈/밤하늘, 'thunder': 충격/파워, 'chart-up': 성장/비즈니스, 'film-roll': 추억/기록, 'magnifier': 분석/발견, 'lock-secure': 보안/약속, 'camera-flash': 화제/강조
(6) textPosition: 텍스트 위치 ('bottom', 'center', 'top' 중 선택)`
    : `
(5) textAnimationStyle: 텍스트 애니메이션 및 모션 그래픽 (반드시 다음 목록 중에서만 선택: ${animList})
    - **중요: 모든 장면에 효과를 넣지 마세요.** 
    - 강조가 필요한 순간에만 '알토란'처럼 적절히 섞어서 적용하세요. (30~50% 정도 적용 권장)
    - 나머지 장면은 'none'을 사용하여 깔끔하게 유지하세요.
(6) textPosition: 텍스트 위치 ('bottom', 'center', 'top' 중 선택)`;

  const imagePromptInstruction = isTypographyMode
    ? `주로 **추상적이고 미니멀한 단색 또는 심플한 텍스처 배경**을 묘사하세요.`
    : `장면의 내용을 생생하게 묘사하는 구체적인 이미지 생성 프롬프트를 작성하세요.`;

  const response = await getAI(apiKey).models.generateContent({
    model,
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `당신은 영상 제작 전문가입니다. 입력된 대본을 정확히 ${sceneCount}개의 장면으로 나누어주세요.

**[핵심 규칙]**
1. **JSON 구조 엄수**: 반드시 {"scenes": [...]} 형태의 유효한 JSON만 출력하세요.
2. **대본 원본 유지**: text 필드에는 대본 원문을 누락 없이 정확히 배분하세요.
3. **간결성**: imagePrompt와 motionPrompt는 각각 250자 내외로 작성하세요.

필드:
(1) text: 대본 원문
(2) imagePrompt: 이미지 생성 프롬프트(영어, ${imagePromptInstruction})
(3) motionPrompt: 동작 묘사 프롬프트(영어)
(4) shouldAnimate: 비디오 변환 여부
${advancedEffectsPrompt.trim()}${characterInstruction}

반드시 아래 JSON 형태로만 응답하세요:
{"scenes": [
  {
    "text": "...",
    "imagePrompt": "...",
    "motionPrompt": "...",
    "shouldAnimate": false,
    "textAnimationStyle": "...",
    "textPosition": "..."
  }
]}

대본:
${script}`,
          },
        ],
      },
    ],
    config: { responseMimeType: 'application/json' },
  });

  const content = response.text;
  if (!content) throw new Error('Gemini 응답이 없습니다');

  let parsed: any;
  try {
    const cleaned = content.replace(/```json\n?|```/g, '').trim();
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error('Gemini JSON 파싱 실패');
  }

  const scenes: ScriptScene[] = parsed.scenes ?? (Array.isArray(parsed) ? parsed : []);
  const meta = (response as any).usageMetadata ?? {};
  return {
    scenes,
    usage: {
      promptTokens: meta.promptTokenCount ?? 0,
      completionTokens: meta.candidatesTokenCount ?? 0,
    },
  };
}

type GenerateImageOptions = {
  stylePrompt?: string;
  characterBase64?: string;
  characterMimeType?: string;
};

export async function generateImage(
  prompt: string,
  options: GenerateImageOptions = {},
  modelId = 'google/gemini-2.5-flash-image',
  apiKey?: string
): Promise<string> {
  const { stylePrompt = '', characterBase64, characterMimeType = 'image/jpeg' } = options;
  const fullPrompt = [prompt, stylePrompt].filter(Boolean).join(', ');
  const model = modelId.startsWith('google/') ? modelId.slice('google/'.length) : modelId;

  const parts: any[] = [];
  if (characterBase64) {
    parts.push({ inlineData: { mimeType: characterMimeType, data: characterBase64 } });
    parts.push({ text: `CHARACTER REFERENCE: Use this character face and style. Scene: ${fullPrompt}` });
  } else {
    parts.push({ text: fullPrompt });
  }

  const response = await getAI(apiKey).models.generateContent({
    model,
    contents: [{ role: 'user', parts }],
    config: { responseModalities: ['IMAGE', 'TEXT'] },
  });

  const imagePart = response.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.mimeType?.startsWith('image/'));
  if (!imagePart?.inlineData?.data) throw new Error('이미지 생성 실패');

  const mimeType = imagePart.inlineData.mimeType ?? 'image/png';
  const imageBuffer = Buffer.from(imagePart.inlineData.data, 'base64');
  const ext = mimeType.includes('jpeg') ? 'jpg' : 'png';
  const key = `images/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  await s3.send(new PutObjectCommand({
    Bucket: BUCKET, Key: key, Body: imageBuffer, ContentType: mimeType,
  }));

  return `https://${BUCKET}.s3.${process.env.AWS_REGION ?? 'ap-northeast-2'}.amazonaws.com/${key}`;
}

export async function generateSpeechBuffer(
  text: string,
  voiceName = 'Kore',
  apiKey?: string
): Promise<{ buffer: Buffer; durationMs: number }> {
  const response = await getAI(apiKey).models.generateContent({
    model: 'gemini-2.5-flash-preview-tts',
    contents: [{ role: 'user', parts: [{ text }] }],
    config: {
      responseModalities: ['AUDIO'],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
    },
  });

  const audioPart = response.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.mimeType?.includes('audio'));
  if (!audioPart?.inlineData?.data) throw new Error('TTS 생성 실패');

  const pcmData = Buffer.from(audioPart.inlineData.data, 'base64');
  const buffer = pcmToWav(pcmData, 24000, 1, 16);
  const durationMs = Math.round((pcmData.length / (24000 * 2)) * 1000);
  return { buffer, durationMs };
}

function resamplePcm(pcm: Buffer, speed: number): Buffer {
  if (speed === 1.0) return pcm;
  const samples = pcm.length / 2;
  const newSamples = Math.round(samples / speed);
  const out = Buffer.alloc(newSamples * 2);
  for (let i = 0; i < newSamples; i++) {
    const srcIdx = Math.min(Math.floor(i * speed), samples - 1);
    out.writeInt16LE(pcm.readInt16LE(srcIdx * 2), i * 2);
  }
  return out;
}

export async function generateSpeech(text: string, filename: string, voiceName = 'Kore', speed = 1.0, apiKey?: string): Promise<{ url: string; durationMs: number }> {
  const response = await getAI(apiKey).models.generateContent({
    model: 'gemini-2.5-flash-preview-tts',
    contents: [{ role: 'user', parts: [{ text }] }],
    config: {
      responseModalities: ['AUDIO'],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
    },
  });

  const audioPart = response.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.mimeType?.includes('audio'));
  if (!audioPart?.inlineData?.data) throw new Error('TTS 생성 실패');

  const rawPcm = Buffer.from(audioPart.inlineData.data, 'base64');
  const pcmData = resamplePcm(rawPcm, Math.min(2.0, Math.max(0.5, speed)));
  const wavBuffer = pcmToWav(pcmData, 24000, 1, 16);
  const durationMs = Math.round((pcmData.length / (24000 * 2)) * 1000);

  const key = `audio/${filename}.wav`;
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET, Key: key, Body: wavBuffer, ContentType: 'audio/wav',
  }));

  const url = `https://${BUCKET}.s3.${process.env.AWS_REGION ?? 'ap-northeast-2'}.amazonaws.com/${key}`;
  return { url, durationMs };
}

function pcmToWav(pcmData: Buffer, sampleRate: number, channels: number, bitsPerSample: number): Buffer {
  const dataSize = pcmData.length;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * channels * (bitsPerSample / 8), 28);
  buffer.writeUInt16LE(channels * (bitsPerSample / 8), 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  pcmData.copy(buffer, 44);
  return buffer;
}
