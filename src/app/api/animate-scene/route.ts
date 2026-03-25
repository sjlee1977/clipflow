import { NextRequest, NextResponse } from 'next/server';
import { createVideoTask, queryVideoTask } from '@/lib/minimax-video';
import { createKlingVideoTask, queryKlingVideoTask } from '@/lib/kling';

export async function POST(req: NextRequest) {
  try {
    const { imageUrl, prompt, modelId = 'minimax/video-01' } = await req.json();
    console.log(`[animate-scene] Creating task. Model: ${modelId}, Prompt: ${prompt}`);

    if (!imageUrl) {
      return NextResponse.json({ error: '이미지 URL이 필요합니다' }, { status: 400 });
    }

    let taskId: string;
    if (modelId.startsWith('kling')) {
      taskId = await createKlingVideoTask(imageUrl, prompt, modelId);
    } else {
      // 기본값 MiniMax
      taskId = await createVideoTask(imageUrl, prompt);
    }

    return NextResponse.json({ taskId, provider: modelId.startsWith('kling') ? 'kling' : 'minimax' });
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
    } else {
      status = await queryVideoTask(taskId);
    }
    
    return NextResponse.json(status);
  } catch (err: any) {
    console.error(`[query-animate] Error (taskId: ${taskId}):`, err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
