import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { runTrendsCollection } from '@/lib/trends-collect';

// 로그인 사용자 수동 수집 트리거
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const regions: string[] = body.regions ?? [];
  const categories: string[] = body.categories ?? [];
  const videoTypes: ('regular' | 'short')[] = body.videoTypes ?? [];
  const subscriberRange: { min?: number; max?: number } | undefined = body.subscriberRange;

  // 백그라운드로 실행 — UI는 즉시 응답받음
  runTrendsCollection(
    regions.length > 0 ? regions : undefined,
    categories.length > 0 ? categories : undefined,
    videoTypes.length > 0 ? videoTypes : undefined,
    subscriberRange,
    true,
  ).then((summary) => {
    console.log('[trigger] 수집 완료:', JSON.stringify(summary));
  }).catch((e) => {
    console.error('[trigger] 수집 오류:', e.message);
  });

  return NextResponse.json({ success: true, message: '수집을 시작했습니다. 잠시 후 새로고침하세요.' });
}
