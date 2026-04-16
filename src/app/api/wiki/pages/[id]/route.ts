/**
 * 사용자 위키 페이지 — 개별 조회 / 수정 / 삭제
 *
 * GET    /api/wiki/pages/:id
 * PUT    /api/wiki/pages/:id
 * DELETE /api/wiki/pages/:id
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

// ── GET — 단일 페이지 ───────────────────────────────────────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });

    const { id } = await params;
    const { data, error } = await supabase
      .from('user_wiki_pages')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (error || !data) return NextResponse.json({ error: '페이지를 찾을 수 없습니다' }, { status: 404 });
    return NextResponse.json({ page: data });
  } catch (err: unknown) {
    console.error('[wiki/pages/:id GET]', err);
    return NextResponse.json({ error: '조회 실패' }, { status: 500 });
  }
}

// ── PUT — 수정 ─────────────────────────────────────────────────────────────────
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });

    const { id } = await params;
    const body = await req.json();

    // 수정 가능한 필드만 허용
    const allowed = ['category', 'topic', 'title', 'content', 'tags', 'ttl', 'volatile', 'metadata'];
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body) updates[key] = body[key];
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: '수정할 필드가 없습니다' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('user_wiki_pages')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error || !data) return NextResponse.json({ error: '수정 실패 또는 권한 없음' }, { status: 404 });
    return NextResponse.json({ page: data });
  } catch (err: unknown) {
    console.error('[wiki/pages/:id PUT]', err);
    return NextResponse.json({ error: '수정 실패' }, { status: 500 });
  }
}

// ── DELETE ─────────────────────────────────────────────────────────────────────
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });

    const { id } = await params;
    const { error } = await supabase
      .from('user_wiki_pages')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error('[wiki/pages/:id DELETE]', err);
    return NextResponse.json({ error: '삭제 실패' }, { status: 500 });
  }
}
