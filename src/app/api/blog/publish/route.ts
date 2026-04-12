import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

// 마크다운 → HTML 변환
function markdownToHtml(md: string): string {
  return md
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>')
    .trim();
}

// ────────────────────────────────────────────────────────────────
async function publishToWordPress(params: {
  siteUrl: string; username: string; appPassword: string;
  title: string; content: string; status: string;
}) {
  const { siteUrl, username, appPassword, title, content, status } = params;
  const base64Auth = Buffer.from(`${username}:${appPassword}`).toString('base64');

  const res = await fetch(`${siteUrl}/wp-json/wp/v2/posts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Basic ${base64Auth}` },
    body: JSON.stringify({ title, content: markdownToHtml(content), status }),
  });
  if (!res.ok) throw new Error(`WordPress ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return { id: data.id, link: data.link, status: data.status };
}

async function publishToNaver(params: {
  accessToken: string; title: string; content: string;
}) {
  const { accessToken, title, content } = params;
  const res = await fetch('https://openapi.naver.com/blog/writePost.json', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: new URLSearchParams({ title, contents: markdownToHtml(content) }).toString(),
  });
  if (!res.ok) throw new Error(`네이버 ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return { logNo: data.logNo, postUrl: data.postUrl };
}

async function publishToNextBlog(params: {
  supabaseUrl: string; supabaseKey: string;
  title: string; content: string; status: string;
}) {
  const { supabaseUrl, supabaseKey, title, content, status } = params;
  const slug = title.toLowerCase().replace(/[^a-z0-9가-힣\s-]/g, '').replace(/\s+/g, '-').slice(0, 60) + '-' + Date.now();

  const res = await fetch(`${supabaseUrl}/rest/v1/posts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Prefer': 'return=representation',
    },
    body: JSON.stringify({ title, content, slug, status, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
  });
  if (!res.ok) throw new Error(`Next.js 블로그 ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const [data] = await res.json();
  return { id: data?.id, slug: data?.slug };
}

// ────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });

    const meta = user.user_metadata ?? {};
    const { platform, title, content, statusOverride } = await req.json();

    if (!platform || !title || !content) {
      return NextResponse.json({ error: '플랫폼, 제목, 내용이 필요합니다' }, { status: 400 });
    }

    switch (platform) {
      case 'wordpress': {
        if (!meta.wp_site_url || !meta.wp_username || !meta.wp_app_password) {
          return NextResponse.json({ error: 'WordPress 계정이 설정되지 않았습니다. 설정 페이지에서 연결해주세요.' }, { status: 400 });
        }
        const result = await publishToWordPress({
          siteUrl: meta.wp_site_url,
          username: meta.wp_username,
          appPassword: meta.wp_app_password,
          title, content,
          status: statusOverride || meta.wp_default_status || 'draft',
        });
        return NextResponse.json({ success: true, platform: 'wordpress', ...result });
      }

      case 'naver': {
        if (!meta.naver_access_token) {
          return NextResponse.json({ error: '네이버 계정이 설정되지 않았습니다. 설정 페이지에서 연결해주세요.' }, { status: 400 });
        }
        const result = await publishToNaver({ accessToken: meta.naver_access_token, title, content });
        return NextResponse.json({ success: true, platform: 'naver', ...result });
      }

      case 'nextblog': {
        if (!meta.nextblog_supabase_url || !meta.nextblog_supabase_key) {
          return NextResponse.json({ error: 'Next.js 블로그가 설정되지 않았습니다. 설정 페이지에서 연결해주세요.' }, { status: 400 });
        }
        const result = await publishToNextBlog({
          supabaseUrl: meta.nextblog_supabase_url,
          supabaseKey: meta.nextblog_supabase_key,
          title, content,
          status: statusOverride || meta.nextblog_default_status || 'draft',
        });
        return NextResponse.json({ success: true, platform: 'nextblog', ...result });
      }

      default:
        return NextResponse.json({ error: '지원하지 않는 플랫폼' }, { status: 400 });
    }
  } catch (err: unknown) {
    console.error('[blog/publish]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '발행 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
