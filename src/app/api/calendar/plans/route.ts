import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: '인증 필요' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const year = searchParams.get('year') ?? new Date().getFullYear().toString();
    const month = searchParams.get('month') ?? String(new Date().getMonth() + 1).padStart(2, '0');

    const from = `${year}-${month.padStart(2, '0')}-01`;
    const toDate = new Date(Number(year), Number(month), 0);
    const to = `${year}-${month.padStart(2, '0')}-${toDate.getDate()}`;

    const { data, error: fetchError } = await supabase
      .from('content_plans')
      .select('*, content_series(title)')
      .eq('user_id', user.id)
      .gte('scheduled_at', from)
      .lte('scheduled_at', to)
      .order('scheduled_at', { ascending: true });

    if (fetchError) throw fetchError;
    return NextResponse.json({ plans: data ?? [] });
  } catch (err) {
    console.error('[calendar/plans GET]', err);
    return NextResponse.json({ error: '조회 실패' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: '인증 필요' }, { status: 401 });

    const body = await req.json();
    const { title, content_type, platform, status, scheduled_at, series_id, episode_number, source_trend_title, source_trend_url, notes } = body;

    if (!title) return NextResponse.json({ error: '제목이 필요합니다' }, { status: 400 });

    const { data, error: insertError } = await supabase
      .from('content_plans')
      .insert({ user_id: user.id, title, content_type: content_type ?? 'video', platform: platform ?? 'youtube', status: status ?? 'idea', scheduled_at, series_id, episode_number, source_trend_title, source_trend_url, notes })
      .select()
      .single();

    if (insertError) throw insertError;
    return NextResponse.json({ plan: data });
  } catch (err) {
    console.error('[calendar/plans POST]', err);
    return NextResponse.json({ error: '생성 실패' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: '인증 필요' }, { status: 401 });

    const { id, ...updates } = await req.json();
    if (!id) return NextResponse.json({ error: 'ID 필요' }, { status: 400 });

    const { data, error: updateError } = await supabase
      .from('content_plans')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (updateError) throw updateError;
    return NextResponse.json({ plan: data });
  } catch (err) {
    console.error('[calendar/plans PATCH]', err);
    return NextResponse.json({ error: '수정 실패' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: '인증 필요' }, { status: 401 });

    const { id } = await req.json();
    await supabase.from('content_plans').delete().eq('id', id).eq('user_id', user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[calendar/plans DELETE]', err);
    return NextResponse.json({ error: '삭제 실패' }, { status: 500 });
  }
}
