import { ElevenLabsClient } from 'elevenlabs';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';

const s3 = new S3Client({
  region: process.env.AWS_REGION ?? 'ap-northeast-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.S3_BUCKET ?? 'remotionlambda-apnortheast2-17lxfxukvf';

function getElevenLabs(apiKey?: string) {
  const key = apiKey || process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error('ElevenLabs API Key가 설정되지 않았습니다');
  return new ElevenLabsClient({ apiKey: key });
}

/**
 * 스트림을 Buffer로 변환
 */
async function streamToBuffer(stream: Readable | any): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

/**
 * 1. 미리보기용 Buffer 생성
 */
export async function generateSpeechBuffer(text: string, voiceId?: string, apiKey?: string): Promise<{ buffer: Buffer }> {
  const client = getElevenLabs(apiKey);
  const audioStream = await client.generate({
    voice: voiceId || 'pNInz6obpgDQGcFmaJgB', // Adam
    text,
    model_id: 'eleven_multilingual_v2',
    output_format: 'mp3_44100_128',
  });

  const buffer = await streamToBuffer(audioStream);
  return { buffer };
}

/**
 * 2. 렌더링용 S3 업로드 및 상세 정보 반환
 */
export async function generateSpeechToS3(
  text: string, 
  filename: string, 
  options: { voiceId?: string; speed?: number; apiKey?: string } = {}
): Promise<{ url: string; durationMs: number }> {
  const { buffer } = await generateSpeechBuffer(text, options.voiceId, options.apiKey);

  const key = `audio/${filename}.mp3`;
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET, Key: key, Body: buffer, ContentType: 'audio/mpeg',
  }));

  const url = `https://${BUCKET}.s3.${process.env.AWS_REGION ?? 'ap-northeast-2'}.amazonaws.com/${key}`;
  const durationMs = Math.round((text.length / 8.5) * 1000) + 500;
  return { url, durationMs };
}
