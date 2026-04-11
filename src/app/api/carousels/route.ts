import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

// GET: 내 캐러셀 목록 조회
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });

    const { data, error } = await supabase
      .from('carousels')
      .select('id, topic, card_count, cards, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ carousels: data ?? [] });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// POST: 캐러셀 저장
export async function POST(req: NextRequest) {
  try {
    const { topic, cards } = await req.json();
    if (!topic || !Array.isArray(cards) || cards.length === 0) {
      return NextResponse.json({ error: '잘못된 데이터입니다' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });

    const { data, error } = await supabase
      .from('carousels')
      .insert({ user_id: user.id, topic, cards, card_count: cards.length })
      .select('id')
      .single();

    if (error) throw error;
    return NextResponse.json({ id: data.id });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
