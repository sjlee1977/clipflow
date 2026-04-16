/**
 * Knowledge 쿼리 — 주제 관련 사용자 지식 페이지 검색
 *
 * GET /api/wiki/knowledge/query?q=사모대출&limit=5
 *
 * 검색 우선순위:
 *   1. topic 완전 일치
 *   2. title / topic ILIKE 부분 일치
 *   3. tags 배열 포함
 *
 * type='knowledge' | 'source' 모두 반환 (글 작성에 활용 가능한 것)
 * content 필드는 포함 — Agent 0가 전문을 읽어 context 구성
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });

    const { searchParams } = req.nextUrl;
    const q     = (searchParams.get('q') ?? '').trim();
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '5'), 20);

    if (!q) return NextResponse.json({ pages: [] });

    // 검색어에서 핵심 토큰 추출 (공백/특수문자 분리)
    const tokens = q.split(/[\s,]+/).filter(t => t.length >= 2).slice(0, 5);

    // ILIKE 조건 — topic | title 중 하나라도 포함
    // Supabase OR 체이닝: .or('topic.ilike.%word%,title.ilike.%word%')
    const orClauses = tokens
      .map(t => `topic.ilike.%${t}%,title.ilike.%${t}%`)
      .join(',');

    const { data, error } = await supabase
      .from('user_wiki_pages')
      .select('id, type, category, topic, title, content, tags, updated_at')
      .eq('user_id', user.id)
      .in('type', ['knowledge', 'source'])
      .or(orClauses)
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    // tags 배열 매칭으로 추가 보완 (이미 OR로 못 잡은 것)
    // — DB에서 직접 tags @> ARRAY[...] 쿼리가 필요한데 Supabase JS SDK 제약으로
    //   코드 레벨에서 보완 필터링
    const found = new Set((data ?? []).map(p => p.id));
    let extra: typeof data = [];
    if (tokens.length > 0) {
      const { data: tagData } = await supabase
        .from('user_wiki_pages')
        .select('id, type, category, topic, title, content, tags, updated_at')
        .eq('user_id', user.id)
        .in('type', ['knowledge', 'source'])
        .overlaps('tags', tokens)
        .order('updated_at', { ascending: false })
        .limit(limit);
      extra = (tagData ?? []).filter(p => !found.has(p.id));
    }

    const pages = [...(data ?? []), ...extra].slice(0, limit);
    return NextResponse.json({ pages, query: q, tokens });
  } catch (err: unknown) {
    console.error('[wiki/knowledge/query GET]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '검색 실패' },
      { status: 500 },
    );
  }
}
