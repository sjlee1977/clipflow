/**
 * 사용자 위키 페이지 — 목록 조회 / 생성
 *
 * GET  /api/wiki/pages?type=knowledge&category=finance&topic=private-loans&limit=20&offset=0
 * POST /api/wiki/pages
 *
 * type:     'knowledge' | 'source' | 'journal'
 * category: 대분류 ('finance', 'psychology', 'health', 'tech', 'general')
 * topic:    소분류 슬러그 ('private-loans', 'crypto')
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

// ── GET — 목록 조회 ────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });

    const { searchParams } = req.nextUrl;
    const type     = searchParams.get('type');
    const category = searchParams.get('category');
    const topic    = searchParams.get('topic');
    const limit    = Math.min(parseInt(searchParams.get('limit')  ?? '20'), 100);
    const offset   = parseInt(searchParams.get('offset') ?? '0');

    let query = supabase
      .from('user_wiki_pages')
      .select('id, type, category, topic, title, tags, ttl, volatile, metadata, created_at, updated_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (type)     query = query.eq('type', type);
    if (category) query = query.eq('category', category);
    if (topic)    query = query.eq('topic', topic);

    const { data, error, count } = await query;
    if (error) throw error;

    return NextResponse.json({ pages: data ?? [], total: count ?? 0 });
  } catch (err: unknown) {
    console.error('[wiki/pages GET]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '조회 실패' },
      { status: 500 },
    );
  }
}

// ── POST — 페이지 생성 ──────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });

    const body = await req.json();
    const { type, category = 'general', topic = '', title, content, tags = [], ttl = 365, volatile = false, metadata = {} } = body;

    if (!type || !title || !content) {
      return NextResponse.json({ error: 'type, title, content 필수' }, { status: 400 });
    }
    if (!['knowledge', 'source', 'journal'].includes(type)) {
      return NextResponse.json({ error: 'type은 knowledge | source | journal' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('user_wiki_pages')
      .insert({ user_id: user.id, type, category, topic, title, content, tags, ttl, volatile, metadata })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ page: data }, { status: 201 });
  } catch (err: unknown) {
    console.error('[wiki/pages POST]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '생성 실패' },
      { status: 500 },
    );
  }
}
