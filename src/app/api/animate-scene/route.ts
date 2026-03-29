import { NextRequest, NextResponse } from 'next/server';
import { createVideoTask, queryVideoTask } from '@/lib/minimax-video';
import { createKlingVideoTask, queryKlingVideoTask } from '@/lib/kling';
import { createFalVideoTask, queryFalVideoTask } from '@/lib/fal-video';
import { createClient } from '@/lib/supabase-server';

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
    } else {
      status = await queryVideoTask(taskId);
    }

    return NextResponse.json(status);
  } catch (err: any) {
    console.error(`[query-animate] Error (taskId: ${taskId}):`, err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
