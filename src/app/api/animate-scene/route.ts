import { NextRequest, NextResponse } from 'next/server';
import { createVideoTask, queryVideoTask } from '@/lib/minimax-video';
import { createKlingVideoTask, queryKlingVideoTask } from '@/lib/kling';
import { createFalVideoTask, queryFalVideoTask } from '@/lib/fal-video';

export async function POST(req: NextRequest) {
  try {
    const { imageUrl, prompt, modelId, model, duration } = await req.json();
    const effectiveModelId = modelId || model || 'MiniMax-Hailuo-2.3-Fast';
    const clipDuration: 5 | 10 = duration === 5 ? 5 : 10;
    console.log(`[animate-scene] Creating task. Model: ${effectiveModelId}, Prompt: ${prompt}`);

    if (!imageUrl) {
      return NextResponse.json({ error: '이미지 URL이 필요합니다' }, { status: 400 });
    }

    let taskId: string;
    let provider: string;

    if (effectiveModelId.startsWith('kling')) {
      taskId = await createKlingVideoTask(imageUrl, prompt, effectiveModelId, clipDuration);
      provider = 'kling';
    } else if (effectiveModelId.startsWith('fal-')) {
      taskId = await createFalVideoTask(imageUrl, prompt, clipDuration);
      provider = 'fal';
    } else {
      taskId = await createVideoTask(imageUrl, prompt, effectiveModelId);
      provider = 'minimax';
    }

    return NextResponse.json({ taskId, provider });
  } catch (err: any) {
    console.error('[animate-scene]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  let taskId: string | null = null;
  try {
    const { searchParams } = new URL(req.url);
    taskId = searchParams.get('taskId');
    const provider = searchParams.get('provider') || 'minimax';

    if (!taskId) {
      return NextResponse.json({ error: '태스크 ID가 필요합니다' }, { status: 400 });
    }

    let status;
    if (provider === 'kling') {
      status = await queryKlingVideoTask(taskId);
    } else if (provider === 'fal') {
      status = await queryFalVideoTask(taskId);
    } else {
      status = await queryVideoTask(taskId);
    }
    
    return NextResponse.json(status);
  } catch (err: any) {
    console.error(`[query-animate] Error (taskId: ${taskId}):`, err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
