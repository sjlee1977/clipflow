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

  try {
    const summary = await runTrendsCollection(
      regions.length > 0 ? regions : undefined,
      categories.length > 0 ? categories : undefined,
    );
    return NextResponse.json({ success: true, summary });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
