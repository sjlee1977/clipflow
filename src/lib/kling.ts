/**
 * Kling AI - 이미지 → 영상 변환 API
 * https://api.klingai.com
 */
import jwt from 'jsonwebtoken';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({
  region: process.env.AWS_REGION ?? 'ap-northeast-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});
const BUCKET = process.env.S3_BUCKET ?? 'remotionlambda-apnortheast2-17lxfxukvf';

export type KlingModel = {
  id: string;
  name: string;
  modelName: string;
  mode: 'std' | 'pro';
  duration: '5' | '10';
  price: string;
  quality: string;
};

export const KLING_MODELS: KlingModel[] = [
  { id: 'kling-v1-6-std-5s', name: 'Kling 1.6 표준 (5초)', modelName: 'kling-v1-6', mode: 'std', duration: '5', price: '$0.07/클립', quality: '좋음' },
  { id: 'kling-v1-6-pro-5s', name: 'Kling 1.6 Pro (5초)', modelName: 'kling-v1-6', mode: 'pro', duration: '5', price: '$0.14/클립', quality: '최상' },
  { id: 'kling-v1-6-std-10s', name: 'Kling 1.6 표준 (10초)', modelName: 'kling-v1-6', mode: 'std', duration: '10', price: '$0.14/클립', quality: '좋음' },
  { id: 'kling-v1-6-pro-10s', name: 'Kling 1.6 Pro (10초)', modelName: 'kling-v1-6', mode: 'pro', duration: '10', price: '$0.28/클립', quality: '최상' },
  { id: 'kling-v1-std-5s', name: 'Kling 1.0 표준 (5초)', modelName: 'kling-v1', mode: 'std', duration: '5', price: '$0.035/클립', quality: '보통' },
];

function getToken(): string {
  const id = process.env.KLING_ACCESS_KEY_ID!;
  const secret = process.env.KLING_ACCESS_KEY_SECRET!;
  return jwt.sign(
    { iss: id, exp: Math.floor(Date.now() / 1000) + 1800, nbf: Math.floor(Date.now() / 1000) - 5 },
    secret,
    { algorithm: 'HS256' }
  );
}

/** S3에 이미지 Buffer 업로드 → public URL 반환 */
export async function uploadImageToS3(imageBuffer: Buffer, mimeType = 'image/png'): Promise<string> {
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

/** 이미지 URL → Kling 영상 URL 변환 */
export async function imageToVideo(
  imageUrl: string,
  prompt: string,
  modelId = 'kling-v1-6-std-5s'
): Promise<string> {
  const model = KLING_MODELS.find(m => m.id === modelId) ?? KLING_MODELS[0];

  // 태스크 생성
  const createRes = await fetch('https://api.klingai.com/v1/videos/image2video', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model_name: model.modelName,
      image: imageUrl,
      prompt: prompt || 'Cinematic motion, smooth camera movement',
      duration: model.duration,
      mode: model.mode,
      cfg_scale: 0.5,
    }),
  });

  const createData = await createRes.json();
  if (!createRes.ok || createData.code !== 0) {
    throw new Error(createData.message || 'Kling 태스크 생성 실패');
  }

  const taskId = createData.data?.task_id;
  if (!taskId) throw new Error('Kling task_id 없음');

  // 완료까지 폴링 (최대 10분)
  const maxWait = 10 * 60 * 1000;
  const start = Date.now();

  while (Date.now() - start < maxWait) {
    await new Promise(r => setTimeout(r, 4000));

    const pollRes = await fetch(`https://api.klingai.com/v1/videos/image2video/${taskId}`, {
      headers: { 'Authorization': `Bearer ${getToken()}` },
    });
    const pollData = await pollRes.json();
    const status = pollData.data?.task_status;

    if (status === 'succeed') {
      const videoUrl = pollData.data?.task_result?.videos?.[0]?.url;
      if (!videoUrl) throw new Error('Kling 영상 URL 없음');
      return videoUrl;
    }

    if (status === 'failed') {
      throw new Error(`Kling 영상 생성 실패: ${pollData.data?.task_status_msg ?? ''}`);
    }
  }

  throw new Error('Kling 영상 생성 타임아웃');
}
