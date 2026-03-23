import { NextRequest, NextResponse } from 'next/server';
import { getRenderStatus } from '@/lib/remotion';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const renderId = searchParams.get('renderId');
    const bucketName = searchParams.get('bucketName');

    if (!renderId || !bucketName) {
      return NextResponse.json({ error: '필수 파라미터가 누락되었습니다' }, { status: 400 });
    }

    const status = await getRenderStatus(renderId, bucketName);
    return NextResponse.json(status);
  } catch (err: unknown) {
    console.error('[get-render-status]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '상태 확인 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
