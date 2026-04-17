/**
 * /api/media-hub/posts
 * GET    — 카테고리별 포스트 목록
 * POST   — 새 포스트 생성
 * PATCH  — 상태/날짜/콘텐츠 수정
 * DELETE — 삭제
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });

    const url      = new URL(req.url);
    const category = url.searchParams.get('category');
    const status   = url.searchParams.get('status');
    const limit    = Number(url.searchParams.get('limit') ?? '50');

    let query = supabase
      .from('media_posts')
      .select('id, category, article_type, topic, destination, keyword, status, scheduled_at, platforms, llm_model_id, image_model_id, naver_title, wordpress_title, personal_title, evaluation, refinement_rounds, naver_published_at, wordpress_published_at, personal_published_at, error_message, created_at')
      .eq('user_id', user.id)
      .order('scheduled_at', { ascending: true, nullsFirst: false })
      .limit(limit);

    if (category) query = query.eq('category', category);
    if (status)   query = query.eq('status', status);

    const { data: posts, error } = await query;
    if (error) throw error;
    return NextResponse.json({ posts: posts ?? [] });
  } catch (err) {
    console.error('[media-hub/posts GET]', err);
    return NextResponse.json({ error: '조회 실패' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });

    const body = await req.json() as {
      category: string; articleType?: string;
      topic: string; destination?: string; keyword?: string;
      sourceData?: Record<string, unknown>;
      scheduledAt?: string; platforms?: string[];
      llmModelId?: string; imageModelId?: string; generateImages?: boolean;
    };

    if (!body.category) return NextResponse.json({ error: 'category가 필요합니다' }, { status: 400 });
    if (!body.topic?.trim()) return NextResponse.json({ error: '주제가 필요합니다' }, { status: 400 });

    const { data, error } = await supabase
      .from('media_posts')
      .insert({
        user_id:       user.id,
        category:      body.category,
        article_type:  body.articleType ?? 'guide',
        topic:         body.topic.trim(),
        destination:   body.destination?.trim() ?? null,
        keyword:       body.keyword?.trim() ?? null,
        source_data:   body.sourceData ?? {},
        scheduled_at:  body.scheduledAt ?? null,
        platforms:     body.platforms ?? ['naver', 'wordpress', 'personal'],
        llm_model_id:  body.llmModelId ?? null,
        image_model_id: body.imageModelId ?? 'fal/flux-schnell',
        generate_images: body.generateImages ?? true,
        status:        'pending',
      })
      .select('id')
      .single();

    if (error) throw error;
    return NextResponse.json({ id: data.id });
  } catch (err) {
    console.error('[media-hub/posts POST]', err);
    return NextResponse.json({ error: '생성 실패' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });

    const body = await req.json() as {
      id: string; status?: string; scheduledAt?: string | null;
      naverContent?: string; wordpressContent?: string; personalContent?: string;
    };

    if (!body.id) return NextResponse.json({ error: 'id가 필요합니다' }, { status: 400 });

    const patch: Record<string, unknown> = {};
    if (body.status           !== undefined) patch.status            = body.status;
    if (body.scheduledAt      !== undefined) patch.scheduled_at      = body.scheduledAt;
    if (body.naverContent     !== undefined) patch.naver_content     = body.naverContent;
    if (body.wordpressContent !== undefined) patch.wordpress_content = body.wordpressContent;
    if (body.personalContent  !== undefined) patch.personal_content  = body.personalContent;

    const { error } = await supabase
      .from('media_posts')
      .update(patch)
      .eq('id', body.id)
      .eq('user_id', user.id);

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[media-hub/posts PATCH]', err);
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
      .from('media_posts')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[media-hub/posts DELETE]', err);
    return NextResponse.json({ error: '삭제 실패' }, { status: 500 });
  }
}
