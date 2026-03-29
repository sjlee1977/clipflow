import { NextRequest } from 'next/server';
import { uploadImageToS3 } from '@/lib/kling';

export async function POST(req: NextRequest) {
  try {
    const { imageBase64 } = await req.json();
    if (!imageBase64) {
      return Response.json({ error: '이미지 데이터 누락' }, { status: 400 });
    }
    // strip data URL prefix if present
    const base64Data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
    const buffer = Buffer.from(base64Data, 'base64');
    const imageUrl = await uploadImageToS3(buffer);
    return Response.json({ imageUrl });
  } catch (err: unknown) {
    console.error('[upload-image]', err);
    return Response.json({ error: err instanceof Error ? err.message : '이미지 업로드 실패' }, { status: 500 });
  }
}
