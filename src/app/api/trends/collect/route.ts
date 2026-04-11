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
    return NextResponse.json({ success: true, summary });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
