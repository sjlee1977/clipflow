import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { sign } from 'jsonwebtoken';

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'ap-northeast-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

function getKlingToken(ak?: string, sk?: string) {
  const accessKey = ak || process.env.KLING_ACCESS_KEY_ID;
  const secretKey = sk || process.env.KLING_ACCESS_KEY_SECRET;
  if (!accessKey || !secretKey) throw new Error('Kling API 키가 설정되지 않았습니다. 설정 페이지에서 Access Key와 Secret Key를 등록해주세요.');

  const now = Math.floor(Date.now() / 1000);
  return sign({ iss: accessKey, exp: now + 1800, nbf: now - 5 }, secretKey, { algorithm: 'HS256', header: { typ: 'JWT', alg: 'HS256' } });
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

export async function createKlingVideoTask(imageUrl: string, prompt: string, model: string = 'kling-v1', duration: 5 | 10 = 10, ak?: string, sk?: string) {
  const body = { model_name: model, image_url: imageUrl, prompt, duration };
  console.log('[kling] createKlingVideoTask body:', JSON.stringify(body));

  const res = await fetch(`${KLING_API_URL}/videos/image2video`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getKlingToken(ak, sk)}`,
    },
    body: JSON.stringify(body),
  });
  
  const raw = await res.text();
  console.log('[kling] response status:', res.status, 'body:', raw);

  let json;
  try {
    json = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Kling API 응답 파싱 실패: ${raw}`);
  }

  if (json.code !== 0 && json.code !== 200) {
    throw new Error(`Kling API 오류 [${json.code}]: ${json.message ?? '응답 원문: ' + raw.slice(0, 300)}`);
  }

  return json.data?.task_id;
}

export async function queryKlingVideoTask(taskId: string, ak?: string, sk?: string) {
  const res = await fetch(`${KLING_API_URL}/videos/image2video/${taskId}`, {
    headers: { 'Authorization': `Bearer ${getKlingToken(ak, sk)}` },
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
