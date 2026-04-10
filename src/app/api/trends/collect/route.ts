import { NextRequest, NextResponse } from 'next/server';
import { runTrendsCollection } from '@/lib/trends-collect';

// Railway Cron 호출용 (x-cron-secret 헤더 필요)
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const summary = await runTrendsCollection(
      ['KR', 'US', 'GB', 'JP', 'FR'], // 전체 지역
    );
    return NextResponse.json({ success: true, summary });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
