import { NextRequest, NextResponse } from 'next/server';
import { runTrendsCollection } from '@/lib/trends-collect';

// Railway Cron 호출용 (x-cron-secret 헤더 필요)
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const regions: string[] = body.regions ?? ['KR', 'US', 'GB', 'JP', 'FR'];
    const summary = await runTrendsCollection(regions);

    // 트렌드 수집 완료 후 알림 트리거 (high 신호가 있을 때만)
    if (summary.viral > 0 || summary.outliers > 0) {
      fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/notify/trigger`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-cron-secret': process.env.CRON_SECRET ?? '',
        },
        body: JSON.stringify({ type: 'trends' }),
      }).catch(e => console.error('[notify/trigger]', e));
    }

    return NextResponse.json({ success: true, summary });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
