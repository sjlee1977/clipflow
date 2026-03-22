import { ElevenLabsClient } from 'elevenlabs';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const elevenlabs = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY,
});

const s3 = new S3Client({
  region: process.env.AWS_REGION ?? 'ap-northeast-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.S3_BUCKET ?? 'remotionlambda-apnortheast2-17lxfxukvf';
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID ?? 'pNInz6obpgDQGcFmaJgB'; // Adam (기본값)

/**
 * 텍스트를 TTS로 변환하고 S3에 업로드한 뒤 URL을 반환합니다.
 */
export async function generateSpeech(text: string, filename: string): Promise<string> {
  const audioStream = await elevenlabs.generate({
    voice: VOICE_ID,
    text,
    model_id: 'eleven_multilingual_v2',
    output_format: 'mp3_44100_128',
  });

  // 스트림을 Buffer로 변환
  const chunks: Buffer[] = [];
  for await (const chunk of audioStream) {
    chunks.push(Buffer.from(chunk));
  }
  const audioBuffer = Buffer.concat(chunks);

  // S3 업로드
  const key = `audio/${filename}.mp3`;
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: audioBuffer,
    ContentType: 'audio/mpeg',
  }));

  return `https://${BUCKET}.s3.${process.env.AWS_REGION ?? 'ap-northeast-2'}.amazonaws.com/${key}`;
}

/**
 * 텍스트 길이 기준으로 대략적인 자막 타이밍을 생성합니다.
 * (ElevenLabs 타임스탬프 API 사용 가능하지만 여기서는 단순 추정)
 */
export function estimateSubtitles(
  text: string,
  totalFrames: number,
  fps: number
): Array<{ text: string; startFrame: number; endFrame: number }> {
  // 문장 단위로 분할
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
