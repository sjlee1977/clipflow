import axios from 'axios';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'ap-northeast-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function uploadImageToS3(buffer: Buffer): Promise<string> {
  const fileName = `images/input-${Date.now()}.png`;
  await s3Client.send(
    new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET!,
      Key: fileName,
      Body: buffer,
      ContentType: 'image/png',
    })
  );
  return `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
}

const KLING_API_URL = 'https://api.klingai.com/v1';

export async function createKlingVideoTask(imageUrl: string, prompt: string) {
  const response = await axios.post(
    `${KLING_API_URL}/videos/image-to-video`,
    {
      model: 'kling-v1',
      image: imageUrl,
      prompt: prompt,
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.KLING_API_KEY}`,
      },
    }
  );
  return response.data.data?.task_id;
}

export async function queryKlingVideoTask(taskId: string) {
  const response = await axios.get(
    `${KLING_API_URL}/videos/image-to-video/${taskId}`,
    {
      headers: {
        'Authorization': `Bearer ${process.env.KLING_API_KEY}`,
      },
    }
  );
  const data = response.data.data;
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
