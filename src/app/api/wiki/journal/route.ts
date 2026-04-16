/**
 * 위키 일지 — 최근 작업 기록 조회
 *
 * GET /api/wiki/journal?limit=20&offset=0
 *
 * type='journal' 레코드만 반환.
 * metadata 구조:
 *   { keyword, title_used, model, word_count, tone, length, outline, steps }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });

    const { searchParams } = req.nextUrl;
    const limit  = Math.min(parseInt(searchParams.get('limit')  ?? '20'), 100);
    const offset = parseInt(searchParams.get('offset') ?? '0');

    const { data, error } = await supabase
      .from('user_wiki_pages')
      .select('id, title, category, topic, metadata, created_at')
      .eq('user_id', user.id)
      .eq('type', 'journal')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return NextResponse.json({ entries: data ?? [] });
  } catch (err: unknown) {
    console.error('[wiki/journal GET]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '조회 실패' },
      { status: 500 },
    );
  }
}
