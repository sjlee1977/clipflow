import { ElevenLabsClient } from 'elevenlabs';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';

export const ELEVENLABS_VOICES: { id: string; name: string; desc: string; gender: 'male' | 'female' }[] = [
  // ── 여성 ──────────────────────────────────────────────
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah',   desc: '부드럽고 따뜻한',    gender: 'female' },
  { id: 'FGY2WhTYpPnrIDTdsKH5', name: 'Laura',   desc: '밝고 활기찬',        gender: 'female' },
  { id: 'XB0fDUnXU5powFXDhCwa', name: 'Charlotte', desc: '세련되고 차분한',  gender: 'female' },
  { id: 'Xb7hH8MSUJpSbSDYk0k2', name: 'Alice',   desc: '신뢰감 있는',        gender: 'female' },
  { id: 'cgSgspJ2msm6clMCkdW9', name: 'Jessica', desc: '표현력 있는',        gender: 'female' },
  { id: 'jBpfuIE2acCo8z3wKNLl', name: 'Matilda', desc: '따뜻하고 친근한',   gender: 'female' },
  { id: 'oWAxZDx7w5VEj9dCyTzz', name: 'Grace',   desc: '우아하고 감성적인',  gender: 'female' },
  { id: 'pFZP5JQG7iQjIQuC4Bku', name: 'Lily',    desc: '명랑하고 산뜻한',   gender: 'female' },
  { id: 'ThT5KcBeq8keWAlS799P', name: 'Rachel',  desc: '안정적이고 명확한',  gender: 'female' },
  { id: 'pqHfZKP75CvOlQylNhV4', name: 'Bill',    desc: '성숙하고 진지한',    gender: 'female' },
  // ── 남성 ──────────────────────────────────────────────
  { id: 'CwhRBWXzGAHq8TQ4Fs17', name: 'Roger',   desc: '자신감 있는',        gender: 'male' },
  { id: 'IKne3meq5aSn9XLyUdCD', name: 'Charlie', desc: '편안하고 자연스러운', gender: 'male' },
  { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George',  desc: '중후하고 권위있는',  gender: 'male' },
  { id: 'N2lVS1w4EtoT3dr4eOWO', name: 'Callum',  desc: '강렬하고 드라마틱한', gender: 'male' },
  { id: 'ODq5zmih8GrVes37Dizd', name: 'Patrick', desc: '명확하고 신뢰감 있는', gender: 'male' },
  { id: 'SOYHLrjzK2X1ezoPC6cr', name: 'Harry',   desc: '젊고 활기찬',        gender: 'male' },
  { id: 'TX3LPaxmHKxFdv7VOQHJ', name: 'Liam',    desc: '청명하고 또렷한',    gender: 'male' },
  { id: 'bIHbv24MWmeRgasZH58o', name: 'Will',    desc: '친근하고 캐주얼한',  gender: 'male' },
  { id: 'iP95p4xoKVk53GoZ742B', name: 'Chris',   desc: '편안한 나레이션',    gender: 'male' },
  { id: 'nPczCjzI2devNBz1zQrb', name: 'Brian',   desc: '깊고 안정적인',      gender: 'male' },
  { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel',  desc: '뉴스 앵커 스타일',   gender: 'male' },
  { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam',    desc: '클리어하고 전문적인', gender: 'male' },
  { id: 't0jbNlBVZ17f02VDIeMI', name: 'Jessie',  desc: '역동적인 나레이션',  gender: 'male' },
];

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
  options: { voiceId?: string; speed?: number; apiKey?: string; userId?: string } = {}
): Promise<{ url: string; durationMs: number }> {
  const { buffer } = await generateSpeechBuffer(text, options.voiceId, options.apiKey);

  const key = options.userId ? `users/${options.userId}/audio/${filename}.mp3` : `audio/${filename}.mp3`;
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET, Key: key, Body: buffer, ContentType: 'audio/mpeg',
  }));

  const url = `https://${BUCKET}.s3.${process.env.AWS_REGION ?? 'ap-northeast-2'}.amazonaws.com/${key}`;
  const durationMs = Math.round((text.length / 8.5) * 1000) + 500;
  return { url, durationMs };
}
