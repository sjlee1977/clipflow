import { NextRequest, NextResponse } from 'next/server';
import { createVideoTask, queryVideoTask } from '@/lib/minimax-video';
import { createKlingVideoTask, queryKlingVideoTask } from '@/lib/kling';
import { createFalVideoTask, queryFalVideoTask } from '@/lib/fal-video';
import { createClient } from '@/lib/supabase-server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({
  region: process.env.AWS_REGION ?? 'ap-northeast-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});
const BUCKET = process.env.S3_BUCKET ?? 'remotionlambda-apnortheast2-17lxfxukvf';

async function reuploadVideoToS3(videoUrl: string): Promise<string> {
  try {
    const res = await fetch(videoUrl);
    if (!res.ok) throw new Error(`download failed: ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const key = `videos/${Date.now()}-${Math.random().toString(36).slice(2)}.mp4`;
    await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: buf, ContentType: 'video/mp4' }));
    const s3Url = `https://${BUCKET}.s3.${process.env.AWS_REGION ?? 'ap-northeast-2'}.amazonaws.com/${key}`;
    console.log('[animate-scene] video re-uploaded to S3:', key);
    return s3Url;
  } catch (e) {
    console.warn('[animate-scene] S3 re-upload failed, using original URL:', e);
    return videoUrl;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { imageUrl, prompt, modelId, model, duration, provider } = await req.json();
    const effectiveModelId = modelId || model || 'kling-v1';
    const clipDuration: 5 | 10 = duration === 5 ? 5 : 10;

    console.log('[animate-scene] Request:', {
      provider,
      model: effectiveModelId,
      duration: clipDuration,
      prompt: prompt?.slice(0, 50),
      hasImageUrl: !!imageUrl
    });

    if (!imageUrl) return NextResponse.json({ error: '이미지 URL이 필요합니다' }, { status: 400 });

    let taskId = '';
    let actualProvider = '';

    if (effectiveModelId.startsWith('kling')) {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const meta = user?.user_metadata ?? {};
      
      if (!meta.kling_access_key || !meta.kling_secret_key) {
        console.warn('[animate-scene] Kling API Keys missing for user:', user?.id);
        return NextResponse.json({ error: 'Kling API 키가 설정되지 않았습니다. 설정 페이지에서 키를 등록해주세요.', needsKey: true }, { status: 403 });
      }

      console.log('[animate-scene] Creating Kling task...');
      taskId = await createKlingVideoTask(imageUrl, prompt, effectiveModelId, clipDuration, meta.kling_access_key, meta.kling_secret_key);
      actualProvider = 'kling';
    } else if (effectiveModelId.startsWith('fal-')) {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const meta = user?.user_metadata ?? {};
      if (!meta.fal_api_key) {
        return NextResponse.json({ error: 'fal.ai API 키가 설정되지 않았습니다. 설정 페이지에서 키를 등록해주세요.', needsKey: true }, { status: 403 });
      }
      taskId = await createFalVideoTask(imageUrl, prompt, clipDuration, meta.fal_api_key);
      actualProvider = 'fal';
    } else if (effectiveModelId.startsWith('wan')) {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const qwenApiKey = user?.user_metadata?.qwen_api_key as string | undefined;
      
      if (!qwenApiKey) {
        return NextResponse.json({ error: 'Qwen(DashScope) API 키가 설정되지 않았습니다. 설정 페이지에서 키를 등록해주세요.', needsKey: true }, { status: 403 });
      }

      const { createWanXVideoTask } = await import('@/lib/qwen-video');
      taskId = await createWanXVideoTask(imageUrl, prompt, effectiveModelId, clipDuration, qwenApiKey);
      actualProvider = 'qwen';
    } else {
      taskId = await createVideoTask(imageUrl, prompt, effectiveModelId);
      actualProvider = 'minimax';
    }

    console.log('[animate-scene] Task Created:', { taskId, provider: actualProvider });
    return NextResponse.json({ taskId, provider: actualProvider });
  } catch (err: any) {
    console.error('[animate-scene] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  let taskId: string | null = null;
  try {
    const { searchParams } = new URL(req.url);
    taskId = searchParams.get('taskId');
    const provider = searchParams.get('provider') || 'kling';

    if (!taskId) return NextResponse.json({ error: '태스크 ID가 필요합니다' }, { status: 400 });

    let status;
    if (provider === 'kling') {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const meta = user?.user_metadata ?? {};
      status = await queryKlingVideoTask(taskId, meta.kling_access_key, meta.kling_secret_key);
    } else if (provider === 'fal') {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const falApiKey = user?.user_metadata?.fal_api_key as string | undefined;
      status = await queryFalVideoTask(taskId, falApiKey);
    } else if (provider === 'qwen') {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const qwenApiKey = user?.user_metadata?.qwen_api_key as string | undefined;
      if (!qwenApiKey) throw new Error('Qwen API Key missing');
      const { queryWanXVideoTask } = await import('@/lib/qwen-video');
      status = await queryWanXVideoTask(taskId, qwenApiKey);
    } else {
      status = await queryVideoTask(taskId);
    }

    // 완료 시 Kling CDN URL → S3로 재업로드 (Lambda 렌더링 속도 최적화)
    if (status.task_status === 'succeed' && status.video_url) {
      status.video_url = await reuploadVideoToS3(status.video_url);
    }

    return NextResponse.json(status);
  } catch (err: any) {
    console.error(`[query-animate] Error (taskId: ${taskId}):`, err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
