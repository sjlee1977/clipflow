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
  motionPrompt?: string;
  shouldAnimate?: boolean;
};

export type SceneSplitResult = {
  scenes: ScriptScene[];
  usage: { promptTokens: number; completionTokens: number };
};

/**
 * Google AI Studio 직접 호출로 대본을 장면 분할
 * llmModelId: 'google/gemini-2.5-flash' → 'gemini-2.5-flash' 로 변환
 */
export async function splitScriptIntoScenes(
  script: string,
  llmModelId = 'gemini-2.5-flash',
  sceneCount = 1,
  hasCharacter?: boolean
): Promise<SceneSplitResult> {
  // OpenRouter 형식(google/gemini-xxx) → AI Studio 형식(gemini-xxx) 변환
  const model = llmModelId.startsWith('google/') ? llmModelId.slice('google/'.length) : llmModelId;

  const characterInstruction = hasCharacter
    ? `\n**중요 - 캐릭터 참조 이미지 있음**: imagePrompt에서 캐릭터의 표정(기쁨/슬픔/놀람/진지함 등), 자세(서있는/앉아있는/걷는/손짓하는 등), 제스처, 시선 방향을 장면 내용에 맞게 구체적으로 묘사하세요. 배경과 조명도 장면 분위기에 맞게 묘사하세요. 절대로 참조 이미지의 포즈를 그대로 복사하지 마세요.`
    : '';

  const response = await getAI().models.generateContent({
    model,
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `당신은 영상 제작 전문가입니다. 입력된 대본을 정확히 ${sceneCount}개의 장면으로 나누어주세요.

**[text 필드 규칙 - 가장 중요]**
- text는 해당 장면에 해당하는 대본 원문을 그대로 담아야 합니다. 요약·압축·생략 금지.
- 이 text는 TTS(음성 합성)로 그대로 읽히며 자막으로 표시됩니다.
- 모든 장면의 text를 합치면 원본 대본 전체가 빠짐없이 포함되어야 합니다.

각 장면은 (1) text: 해당 장면 대본 원문(한국어, 요약 금지), (2) imagePrompt: 장면 이미지 생성 프롬프트(영어), (3) motionPrompt: 카메라/동작 묘사 프롬프트(영어), (4) shouldAnimate: AI 비디오 변환 적합 여부(boolean)를 포함해야 합니다.
**전체 장면 중 약 10%(최소 1개)에 "shouldAnimate": true를 설정하세요.**${characterInstruction}

반드시 아래 JSON 형태로만 응답하세요 (다른 텍스트 없이):
{"scenes": [
  {
    "text": "대본에서 이 장면에 해당하는 문장들을 원문 그대로 작성합니다. 절대 요약하지 마세요.",
    "imagePrompt": "Detailed English image generation prompt...",
    "motionPrompt": "Detailed English motion prompt for video generation...",
    "shouldAnimate": false
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
    parsed = JSON.parse(content);
  } catch {
    throw new Error('Gemini JSON 파싱 실패');
  }

  const scenes: ScriptScene[] = parsed.scenes ?? (Array.isArray(parsed) ? parsed : []);
  if (!scenes.length) throw new Error('장면 분할 실패');

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

/**
 * Gemini Image로 이미지를 생성하고 S3 URL을 반환합니다.
 * modelId: 'google/gemini-2.5-flash-image' 형식 또는 'gemini-2.5-flash-image' 형식 모두 허용
 */
export async function generateImage(
  prompt: string,
  options: GenerateImageOptions = {},
  modelId = 'google/gemini-2.5-flash-image'
): Promise<string> {
  const { stylePrompt = '', characterBase64, characterMimeType = 'image/jpeg' } = options;
  const fullPrompt = [prompt, stylePrompt].filter(Boolean).join(', ');
  const model = modelId.startsWith('google/') ? modelId.slice('google/'.length) : modelId;

  const parts: Array<Record<string, unknown>> = [];
  if (characterBase64) {
    parts.push({ inlineData: { mimeType: characterMimeType, data: characterBase64 } });
    parts.push({
      text: `This is a CHARACTER REFERENCE IMAGE. Study the character's face, hairstyle, and clothing style.
Now generate a BRAND NEW illustration of this SAME character in a completely different scene:
${fullPrompt}

IMPORTANT RULES:
- Keep the character's face, hairstyle, and clothing style consistent with the reference
- Use a COMPLETELY DIFFERENT pose, expression, and gesture appropriate for the scene
- Do NOT copy the exact pose from the reference image
- Show natural body language, facial emotion, and actions that match the scene context
- Vary the camera angle and character position to match the narrative`
    });
  } else {
    parts.push({ text: fullPrompt });
  }

  const response = await getAI().models.generateContent({
    model,
    contents: [{ role: 'user', parts }],
    config: { responseModalities: ['IMAGE', 'TEXT'] },
  });

  const responseParts = response.candidates?.[0]?.content?.parts ?? [];
  const finishReason = response.candidates?.[0]?.finishReason;
  
  if (finishReason === 'SAFETY') {
    console.error('[google] Image generation blocked by SAFETY filter');
    throw new Error('안전 필터에 의해 이미지 생성이 차단되었습니다. 다른 설명을 시도해보세요.');
  }

  const imagePart = responseParts.find((p) => p.inlineData?.mimeType?.startsWith('image/'));
  if (!imagePart?.inlineData?.data) {
    console.error('[google] No image data in response. Full Response:', JSON.stringify(response, null, 2));
    throw new Error('이미지 생성 실패 (AI 응답에 이미지 데이터가 없습니다)');
  }

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
/** PCM 데이터를 speed 배율로 리샘플링 (16bit mono) */
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

export async function generateSpeech(text: string, filename: string, voiceName = 'Kore', speed = 1.0): Promise<{ url: string; durationMs: number }> {
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

  const rawPcm = Buffer.from(audioPart.inlineData.data, 'base64');
  const pcmData = resamplePcm(rawPcm, Math.min(2.0, Math.max(0.5, speed)));
  const wavBuffer = pcmToWav(pcmData, 24000, 1, 16);
  const durationMs = Math.round((pcmData.length / (24000 * 2)) * 1000);

  const key = `audio/${filename}.wav`;
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: wavBuffer,
    ContentType: 'audio/wav',
  }));

  const url = `https://${BUCKET}.s3.${process.env.AWS_REGION ?? 'ap-northeast-2'}.amazonaws.com/${key}`;
  return { url, durationMs };
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
