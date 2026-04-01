import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
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

async function imageUrlToBase64(imageUrl: string): Promise<string> {
  try {
    const url = new URL(imageUrl);
    if (!url.hostname.endsWith('.amazonaws.com')) {
      // S3 외 URL: fetch로 다운로드
      const res = await fetch(imageUrl);
      const buf = Buffer.from(await res.arrayBuffer());
      return buf.toString('base64');
    }
    // S3: SDK로 직접 다운로드 (인증 포함)
    const bucket = url.hostname.split('.')[0];
    const key = decodeURIComponent(url.pathname.slice(1));
    const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
    const s3Res = await s3Client.send(cmd);
    const chunks: Uint8Array[] = [];
    for await (const chunk of s3Res.Body as any) chunks.push(chunk);
    const buf = Buffer.concat(chunks);
    console.log('[kling] S3 image downloaded, size:', buf.length);
    return buf.toString('base64');
  } catch (e) {
    console.error('[kling] image download failed:', e);
    throw new Error('이미지 다운로드 실패: ' + (e instanceof Error ? e.message : String(e)));
  }
}

export async function createKlingVideoTask(imageUrl: string, prompt: string, model: string = 'kling-v2-6', duration: 5 | 10 = 10, ak?: string, sk?: string) {
  if (!imageUrl || !imageUrl.startsWith('http')) {
    throw new Error('유효한 이미지 URL이 없습니다. 이미지가 완전히 생성된 후 다시 시도해주세요.');
  }
  // S3가 비공개이므로 이미지를 직접 다운로드해 base64로 변환
  const imageBase64 = await imageUrlToBase64(imageUrl);

  // master 모델은 mode 파라미터 없음. 나머지는 pro 고정 (1080p, 5s/10s 모두 지원)
  const noModeModels = ['kling-v2-master', 'kling-v2-1-master'];
  const useMode = !noModeModels.includes(model);

  // 인물 신체 동작을 명시적으로 강제 — Kling 기본값(배경 패럴랙스)을 억제
  const enhancedPrompt = `${prompt} -- ANIMATION REQUIREMENT: Both the subject AND environment must be animated simultaneously. The person/character must show natural body motion and facial expression: head nodding or tilting, expressive eyes (blinking, glancing), emotional facial expressions (joy, happiness, excitement, sadness, depression, melancholy, anger, fear, surprise, calm, contemplation, longing, relief, pride), hands gesturing, arms moving, shoulders and torso shifting naturally. NO lip sync, NO mouth talking animation — mouth stays gently closed or shows silent emotion only. Environmental motion (rain, wind, fire, flowing water, moving clouds) is encouraged. Do NOT animate background only while subject stays frozen.`;

  const body: Record<string, unknown> = {
    model_name: model,
    image: imageBase64,
    prompt: enhancedPrompt,
    duration: String(duration),
    cfg_scale: 0.5,
  };
  if (useMode) body.mode = 'std';
  console.log('[kling] createKlingVideoTask body:', JSON.stringify({ ...body, image: `[base64 ${imageBase64.length}chars]` }));

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
    'succeed': 'succeed',
    'succeeded': 'succeed',
    'failed': 'failed',
  };

  return {
    task_status: statusMap[data.task_status as string] || 'processing',
    video_url: data.task_result?.videos?.[0]?.url ?? data.video_list?.[0]?.url,
    task_status_msg: data.task_status_msg,
  };
}
