import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data } = await supabase
    .from('trend_settings')
    .select('*')
    .eq('user_id', user.id)
    .single();

  // 설정 없으면 기본값 반환
  return NextResponse.json(data ?? {
    categories: ['gaming', 'entertainment'],
    outlier_multiplier: 3.0,
    viral_threshold_hourly: 300.0,
    is_active: true,
  });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { categories, outlier_multiplier, viral_threshold_hourly, is_active } = body;

  const { data, error } = await supabase
    .from('trend_settings')
    .upsert({
      user_id: user.id,
      categories: categories ?? ['gaming', 'entertainment'],
      outlier_multiplier: outlier_multiplier ?? 3.0,
      viral_threshold_hourly: viral_threshold_hourly ?? 300.0,
      is_active: is_active ?? true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
