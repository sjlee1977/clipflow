import { NextRequest, NextResponse } from 'next/server';
import { createVideoTask, queryVideoTask } from '@/lib/minimax-video';

export async function POST(req: NextRequest) {
  try {
    const { imageUrl, prompt } = await req.json();

    if (!imageUrl) {
      return NextResponse.json({ error: '이미지 URL이 필요합니다' }, { status: 400 });
    }

    const taskId = await createVideoTask(imageUrl, prompt);
    return NextResponse.json({ taskId });
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

    if (!taskId) {
      return NextResponse.json({ error: '태스크 ID가 필요합니다' }, { status: 400 });
    }

    const status = await queryVideoTask(taskId);
    return NextResponse.json(status);
  } catch (err: any) {
    console.error(`[query-animate] Error (taskId: ${taskId}):`, err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
