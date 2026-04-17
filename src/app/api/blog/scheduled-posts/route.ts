/**
 * /api/blog/scheduled-posts
 *
 * GET    — 예약 포스트 목록 (캘린더 blog 항목 포함)
 * POST   — 신규 생성 (content_plan_id 연동 가능)
 * PATCH  — 상태/날짜 수정
 * DELETE — 삭제
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });

    const url    = new URL(req.url);
    const status = url.searchParams.get('status'); // 필터
    const limit  = Number(url.searchParams.get('limit') ?? '50');

    // ── 1. scheduled_posts 조회 ────────────────────────────────────────────
    let query = supabase
      .from('scheduled_posts')
      .select('id, topic, keyword, status, scheduled_at, platforms, generate_images, llm_model_id, image_model_id, naver_title, wordpress_title, personal_title, evaluation, refinement_rounds, naver_published_at, wordpress_published_at, personal_published_at, content_plan_id, error_message, created_at')
      .eq('user_id', user.id)
      .order('scheduled_at', { ascending: true, nullsFirst: false })
      .limit(limit);

    if (status) query = query.eq('status', status);
    const { data: posts, error } = await query;
    if (error) throw error;

    // ── 2. 캘린더에서 아직 생성 안 된 blog 항목 조회 ───────────────────────
    const linkedPlanIds = (posts ?? []).map(p => p.content_plan_id).filter(Boolean);

    const { data: calendarBlogItems } = await supabase
      .from('content_plans')
      .select('id, title, scheduled_at, notes, status')
      .eq('user_id', user.id)
      .eq('content_type', 'blog')
      .not('id', 'in', linkedPlanIds.length ? `(${linkedPlanIds.join(',')})` : '(null)')
      .order('scheduled_at', { ascending: true });

    return NextResponse.json({
      posts:           posts ?? [],
      calendarPending: calendarBlogItems ?? [],
    });
  } catch (err) {
    console.error('[scheduled-posts GET]', err);
    return NextResponse.json({ error: '조회 실패' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });

    const body = await req.json() as {
      topic: string; keyword: string;
      scheduledAt?: string; contentPlanId?: string;
      platforms?: string[]; llmModelId?: string;
      imageModelId?: string; generateImages?: boolean;
    };

    if (!body.topic?.trim())   return NextResponse.json({ error: '주제가 필요합니다' },   { status: 400 });
    if (!body.keyword?.trim()) return NextResponse.json({ error: '키워드가 필요합니다' }, { status: 400 });

    const { data, error } = await supabase
      .from('scheduled_posts')
      .insert({
        user_id:         user.id,
        topic:           body.topic.trim(),
        keyword:         body.keyword.trim(),
        scheduled_at:    body.scheduledAt ?? null,
        content_plan_id: body.contentPlanId ?? null,
        platforms:       body.platforms ?? ['naver', 'wordpress', 'personal'],
        llm_model_id:    body.llmModelId ?? null,
        image_model_id:  body.imageModelId ?? 'fal/flux-schnell',
        generate_images: body.generateImages ?? true,
        status:          'pending',
      })
      .select('id')
      .single();

    if (error) throw error;
    return NextResponse.json({ id: data.id });
  } catch (err) {
    console.error('[scheduled-posts POST]', err);
    return NextResponse.json({ error: '생성 실패' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });

    const body = await req.json() as {
      id: string;
      status?: string;
      scheduledAt?: string | null;
      naverContent?: string;
      wordpressContent?: string;
      personalContent?: string;
    };

    if (!body.id) return NextResponse.json({ error: 'id가 필요합니다' }, { status: 400 });

    const patch: Record<string, unknown> = {};
    if (body.status          !== undefined) patch.status           = body.status;
    if (body.scheduledAt     !== undefined) patch.scheduled_at     = body.scheduledAt;
    if (body.naverContent    !== undefined) patch.naver_content    = body.naverContent;
    if (body.wordpressContent !== undefined) patch.wordpress_content = body.wordpressContent;
    if (body.personalContent !== undefined) patch.personal_content = body.personalContent;

    const { error } = await supabase
      .from('scheduled_posts')
      .update(patch)
      .eq('id', body.id)
      .eq('user_id', user.id);

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[scheduled-posts PATCH]', err);
    return NextResponse.json({ error: '수정 실패' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });

    const { id } = await req.json() as { id: string };
    if (!id) return NextResponse.json({ error: 'id가 필요합니다' }, { status: 400 });

    const { error } = await supabase
      .from('scheduled_posts')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[scheduled-posts DELETE]', err);
    return NextResponse.json({ error: '삭제 실패' }, { status: 500 });
  }
}
