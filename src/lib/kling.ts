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

export async function createKlingVideoTask(imageUrl: string, prompt: string, model: string = 'kling-v2-6', duration: 5 | 10 = 10, ak?: string, sk?: string) {
  if (!imageUrl || !imageUrl.startsWith('http')) {
    throw new Error('유효한 이미지 URL이 없습니다. 이미지가 완전히 생성된 후 다시 시도해주세요.');
  }
  // master 모델은 mode 파라미터 없음. 나머지는 pro 고정 (1080p, 5s/10s 모두 지원)
  const noModeModels = ['kling-v2-master', 'kling-v2-1-master'];
  const useMode = !noModeModels.includes(model);

  const body: Record<string, unknown> = {
    model_name: model,
    image_url: imageUrl,
    prompt,
    duration: String(duration),
  };
  if (useMode) body.mode = 'pro';
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

  const taskId = json.data?.task_id;
  if (!taskId) throw new Error(`Kling task_id 없음. 응답: ${raw.slice(0, 300)}`);
  return taskId;
}

export async function queryKlingVideoTask(taskId: string, ak?: string, sk?: string) {
  const res = await fetch(`${KLING_API_URL}/videos/image2video/${taskId}`, {
    headers: { 'Authorization': `Bearer ${getKlingToken(ak, sk)}` },
  });
  const json = await res.json();

  if (!res.ok || json.code !== 0) {
    throw new Error(`Kling 상태 조회 오류 [${json.code ?? res.status}]: ${json.message ?? JSON.stringify(json).slice(0, 200)}`);
  }

  const data = json.data;
  if (!data) throw new Error(`Kling 응답에 data 없음: ${JSON.stringify(json).slice(0, 200)}`);

  const statusMap: Record<string, string> = {
    'submitted': 'processing',
    'processing': 'processing',
    'succeeded': 'succeed',
    'failed': 'failed',
  };

  return {
    task_status: statusMap[data.task_status as string] || 'processing',
    video_url: data.task_result?.videos?.[0]?.url ?? data.video_list?.[0]?.url,
    task_status_msg: data.task_status_msg,
  };
}
