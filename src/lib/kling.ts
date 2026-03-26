import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { sign } from 'jsonwebtoken';

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'ap-northeast-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

function getKlingToken() {
  const ak = process.env.KLING_ACCESS_KEY;
  const sk = process.env.KLING_SECRET_KEY;
  if (!ak || !sk) return '';

  const now = Math.floor(Date.now() / 1000);
  const exp = now + 1800; // 30분
  const nbf = now - 5;

  return sign(
    {
      iss: ak,
      exp,
      nbf,
    },
    sk,
    { algorithm: 'HS256', header: { typ: 'JWT', alg: 'HS256' } }
  );
}

export async function uploadImageToS3(buffer: Buffer): Promise<string> {
  const fileName = `images/input-${Date.now()}.png`;
  const bucket = process.env.S3_BUCKET!;
  const region = process.env.AWS_REGION || 'ap-northeast-2';

  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: fileName,
      Body: buffer,
      ContentType: 'image/png',
    })
  );
  return `https://${bucket}.s3.${region}.amazonaws.com/${fileName}`;
}

const KLING_API_URL = 'https://api.klingai.com/v1';

export async function createKlingVideoTask(imageUrl: string, prompt: string, model: string = 'kling-v1', duration: 5 | 10 = 10) {
  const res = await fetch(`${KLING_API_URL}/videos/image-to-video`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getKlingToken()}`,
    },
    body: JSON.stringify({ model, image: imageUrl, prompt, duration }),
  });
  const json = await res.json();
  return json.data?.task_id;
}

export async function queryKlingVideoTask(taskId: string) {
  const res = await fetch(`${KLING_API_URL}/videos/image-to-video/${taskId}`, {
    headers: { 'Authorization': `Bearer ${getKlingToken()}` },
  });
  const json = await res.json();
  const data = json.data;
  // MiniMax 형식에 맞춰 정규화
  const statusMap: Record<string, string> = {
    'submitted': 'processing',
    'processing': 'processing',
    'succeeded': 'succeed',
    'failed': 'failed',
  };
  return {
    task_status: statusMap[data.task_status as string] || 'processing',
    video_url: data.video_list?.[0]?.url,
    task_status_msg: data.task_status_msg,
  };
}
