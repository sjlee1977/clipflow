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
function getAI() {
  if (!ai) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY 환경변수가 설정되지 않았습니다');
    ai = new GoogleGenAI({ apiKey });
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
};

/**
 * 대본을 받아 장면별로 분할하고 이미지 프롬프트를 생성합니다. (Gemini 2.5 Flash)
 */
export async function splitScriptIntoScenes(script: string): Promise<ScriptScene[]> {
  const response = await getAI().models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `당신은 영상 제작 전문가입니다. 입력된 대본을 5~8개의 장면으로 나누고 각 장면에 맞는 Imagen 이미지 생성 프롬프트를 영어로 만들어주세요.

반드시 아래 JSON 배열 형태로만 응답하세요 (다른 텍스트 없이):
[
  {
    "text": "자막에 표시될 한국어 텍스트 (1~2문장)",
    "imagePrompt": "Detailed English prompt for Imagen 3, cinematic photography style, high quality, 9:16 vertical"
  }
]

대본:
${script}`,
          },
        ],
      },
    ],
    config: {
      responseMimeType: 'application/json',
    },
  });

  const content = response.text;
  if (!content) throw new Error('Gemini 응답이 없습니다');

  const parsed = JSON.parse(content);
  const scenes: ScriptScene[] = Array.isArray(parsed) ? parsed : parsed.scenes ?? [];

  if (!scenes.length) throw new Error('장면 분할 실패');
  return scenes;
}

type GenerateImageOptions = {
  stylePrompt?: string;
  characterBase64?: string;
  characterMimeType?: string;
};

/**
 * Gemini 2.5 Flash Image로 이미지를 생성하고 S3 URL을 반환합니다.
 * 캐릭터 이미지가 있으면 참조하여 일관성 유지.
 */
export async function generateImage(prompt: string, options: GenerateImageOptions = {}): Promise<string> {
  const { stylePrompt = '', characterBase64, characterMimeType } = options;
  const fullPrompt = [prompt, stylePrompt].filter(Boolean).join(', ');

  const parts: Array<Record<string, unknown>> = [];
  if (characterBase64 && characterMimeType) {
    parts.push({ inlineData: { mimeType: characterMimeType, data: characterBase64 } });
    parts.push({ text: `Use this character consistently. Scene: ${fullPrompt}` });
  } else {
    parts.push({ text: fullPrompt });
  }

  const response = await getAI().models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: [{ role: 'user', parts }],
    config: { responseModalities: ['IMAGE', 'TEXT'] },
  });

  const responseParts = response.candidates?.[0]?.content?.parts ?? [];
  const imagePart = responseParts.find((p) => p.inlineData?.mimeType?.startsWith('image/'));
  if (!imagePart?.inlineData?.data) throw new Error('이미지 생성 실패');

  const mimeType = imagePart.inlineData.mimeType ?? 'image/png';
  const imageBuffer = Buffer.from(imagePart.inlineData.data, 'base64');
  const ext = mimeType.includes('jpeg') ? 'jpg' : 'png';
  const key = `images/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: imageBuffer,
    ContentType: mimeType,
  }));

  return `https://${BUCKET}.s3.${process.env.AWS_REGION ?? 'ap-northeast-2'}.amazonaws.com/${key}`;
}

/** TTS 버퍼만 반환 (S3 업로드 없음, preview용) */
export async function generateSpeechBuffer(
  text: string,
  voiceName = 'Kore'
): Promise<{ buffer: Buffer; durationMs: number }> {
  const response = await getAI().models.generateContent({
    model: 'gemini-2.5-flash-preview-tts',
    contents: [{ role: 'user', parts: [{ text }] }],
    config: {
      responseModalities: ['AUDIO'],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
    },
  });

  const audioPart = response.candidates?.[0]?.content?.parts?.find(
    (p) => p.inlineData?.mimeType?.includes('audio')
  );
  if (!audioPart?.inlineData?.data) throw new Error('TTS 생성 실패');

  const pcmData = Buffer.from(audioPart.inlineData.data, 'base64');
  const buffer = pcmToWav(pcmData, 24000, 1, 16);
  const durationMs = Math.round((pcmData.length / (24000 * 2)) * 1000);
  return { buffer, durationMs };
}

/**
 * Gemini 2.5 Flash TTS로 음성을 생성하고 S3 URL을 반환합니다. (무료 티어 사용 가능)
 * 반환 오디오: raw PCM (24kHz, 16-bit, mono) → WAV로 변환
 */
export async function generateSpeech(text: string, filename: string, voiceName = 'Kore'): Promise<string> {
  const response = await getAI().models.generateContent({
    model: 'gemini-2.5-flash-preview-tts',
    contents: [{ role: 'user', parts: [{ text }] }],
    config: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName },
        },
      },
    },
  });

  const audioPart = response.candidates?.[0]?.content?.parts?.find(
    (p) => p.inlineData?.mimeType?.includes('audio')
  );
  if (!audioPart?.inlineData?.data) throw new Error('TTS 생성 실패');

  const pcmData = Buffer.from(audioPart.inlineData.data, 'base64');
  const wavBuffer = pcmToWav(pcmData, 24000, 1, 16);

  const key = `audio/${filename}.wav`;
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: wavBuffer,
    ContentType: 'audio/wav',
  }));

  return `https://${BUCKET}.s3.${process.env.AWS_REGION ?? 'ap-northeast-2'}.amazonaws.com/${key}`;
}

/**
 * 텍스트 길이 기반으로 자막 타이밍을 추정합니다.
 */
export function estimateSubtitles(
  text: string,
  totalFrames: number,
  fps: number
): Array<{ text: string; startFrame: number; endFrame: number }> {
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (sentences.length === 0) {
    return [{ text, startFrame: 0, endFrame: totalFrames }];
  }

  const framesPerChar = totalFrames / text.length;
  const subtitles: Array<{ text: string; startFrame: number; endFrame: number }> = [];
  let currentFrame = 0;

  for (const sentence of sentences) {
    const duration = Math.round(sentence.length * framesPerChar);
    subtitles.push({
      text: sentence,
      startFrame: currentFrame,
      endFrame: Math.min(currentFrame + duration, totalFrames),
    });
    currentFrame += duration;
  }

  return subtitles;
}

// raw PCM 데이터를 WAV 파일 형식으로 변환합니다.
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
