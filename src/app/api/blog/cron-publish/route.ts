/**
 * POST /api/blog/cron-publish
 *
 * Railway Cron이 매일 정해진 시각에 호출.
 * scheduled_at <= now() AND status = 'ready' 인 포스트를 찾아
 * 등록된 플랫폼에 자동 발행 후 status를 'published'로 업데이트.
 *
 * Railway 환경변수: CRON_SECRET=임의의_랜덤_문자열
 * 요청 헤더: Authorization: Bearer <CRON_SECRET>
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

// ── 마크다운 → HTML ────────────────────────────────────────────────────────────
function markdownToHtml(md: string): string {
  return md
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%;height:auto;" />')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>')
    .trim();
}

// ── WordPress 발행 ─────────────────────────────────────────────────────────────
async function publishToWordPress(
  meta: Record<string, string>, title: string, content: string,
): Promise<{ success: boolean; link?: string; error?: string }> {
  if (!meta.wp_site_url || !meta.wp_username || !meta.wp_app_password) {
    return { success: false, error: 'WordPress 설정 없음' };
  }
  const auth = Buffer.from(`${meta.wp_username}:${meta.wp_app_password}`).toString('base64');
  const res  = await fetch(`${meta.wp_site_url}/wp-json/wp/v2/posts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Basic ${auth}` },
    body: JSON.stringify({ title, content: markdownToHtml(content), status: meta.wp_default_status ?? 'publish' }),
  });
  if (!res.ok) return { success: false, error: `WordPress ${res.status}` };
  const data = await res.json();
  return { success: true, link: data.link };
}

// ── 네이버 발행 ───────────────────────────────────────────────────────────────
async function publishToNaver(
  meta: Record<string, string>, title: string, content: string,
): Promise<{ success: boolean; error?: string }> {
  if (!meta.naver_access_token) return { success: false, error: '네이버 토큰 없음' };
  const res = await fetch('https://openapi.naver.com/blog/writePost.json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Bearer ${meta.naver_access_token}` },
    body: new URLSearchParams({ title, contents: markdownToHtml(content) }).toString(),
  });
  if (!res.ok) return { success: false, error: `네이버 ${res.status}` };
  return { success: true };
}

// ── 개인 웹사이트 발행 ─────────────────────────────────────────────────────────
async function publishToPersonal(
  meta: Record<string, string>, title: string, content: string,
): Promise<{ success: boolean; error?: string }> {
  if (!meta.nextblog_supabase_url || !meta.nextblog_supabase_key) {
    return { success: false, error: '개인 블로그 설정 없음' };
  }
  const slug = title.toLowerCase().replace(/[^a-z0-9가-힣\s-]/g, '').replace(/\s+/g, '-').slice(0, 60) + '-' + Date.now();
  const res  = await fetch(`${meta.nextblog_supabase_url}/rest/v1/posts`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      apikey:          meta.nextblog_supabase_key,
      Authorization:   `Bearer ${meta.nextblog_supabase_key}`,
      Prefer:          'return=representation',
    },
    body: JSON.stringify({ title, content, slug, status: meta.nextblog_default_status ?? 'published', created_at: new Date().toISOString() }),
  });
  if (!res.ok) return { success: false, error: `개인 블로그 ${res.status}` };
  return { success: true };
}

// ── POST Handler ──────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  // 보안: CRON_SECRET 검증
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get('authorization') ?? '';
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const supabase = await createClient();

    // 오늘까지 발행 예정인 ready 포스트 조회
    const now = new Date().toISOString();
    const { data: posts, error } = await supabase
      .from('scheduled_posts')
      .select('id, user_id, platforms, naver_title, naver_content, wordpress_title, wordpress_content, personal_title, personal_content')
      .eq('status', 'ready')
      .lte('scheduled_at', now)
      .limit(20);

    if (error) throw error;
    if (!posts?.length) return NextResponse.json({ processed: 0, message: '발행할 포스트 없음' });

    const results: { id: string; results: Record<string, { success: boolean; error?: string }> }[] = [];

    for (const post of posts) {
      // 사용자 메타데이터 가져오기
      const { data: authUser } = await supabase.auth.admin.getUserById(post.user_id);
      const meta = (authUser?.user?.user_metadata ?? {}) as Record<string, string>;
      const platforms = (post.platforms ?? ['naver', 'wordpress', 'personal']) as string[];
      const publishResults: Record<string, { success: boolean; error?: string }> = {};
      const now_ = new Date().toISOString();
      const patch: Record<string, unknown> = {};

      if (platforms.includes('wordpress') && post.wordpress_content) {
        const r = await publishToWordPress(meta, post.wordpress_title, post.wordpress_content);
        publishResults.wordpress = r;
        if (r.success) patch.wordpress_published_at = now_;
      }

      if (platforms.includes('naver') && post.naver_content) {
        const r = await publishToNaver(meta, post.naver_title, post.naver_content);
        publishResults.naver = r;
        if (r.success) patch.naver_published_at = now_;
      }

      if (platforms.includes('personal') && post.personal_content) {
        const r = await publishToPersonal(meta, post.personal_title, post.personal_content);
        publishResults.personal = r;
        if (r.success) patch.personal_published_at = now_;
      }

      const allSuccess = Object.values(publishResults).every(r => r.success);
      patch.status = allSuccess ? 'published' : 'failed';
      if (!allSuccess) {
        patch.error_message = Object.entries(publishResults)
          .filter(([, r]) => !r.success)
          .map(([p, r]) => `${p}: ${r.error}`)
          .join(', ');
      }

      await supabase.from('scheduled_posts').update(patch).eq('id', post.id);
      results.push({ id: post.id, results: publishResults });
    }

    return NextResponse.json({ processed: results.length, results });
  } catch (err) {
    console.error('[cron-publish]', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

// GET — 헬스체크 (Railway 확인용)
export async function GET() {
  return NextResponse.json({ ok: true, time: new Date().toISOString() });
}
