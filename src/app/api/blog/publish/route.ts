import { NextRequest, NextResponse } from 'next/server';

// 마크다운 → HTML 변환 (간단 버전)
function markdownToHtml(md: string): string {
  return md
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`)
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[hul])/gm, '')
    .replace(/\n/g, '<br>')
    .trim();
}

// ────────────────────────────────────────────────────────────────
// WordPress REST API 발행
// ────────────────────────────────────────────────────────────────
async function publishToWordPress(params: {
  siteUrl: string;
  username: string;
  appPassword: string;
  title: string;
  content: string;
  status?: 'draft' | 'publish';
  tags?: string[];
  categories?: number[];
}) {
  const { siteUrl, username, appPassword, title, content, status = 'draft', tags = [], categories = [] } = params;
  const base64Auth = Buffer.from(`${username}:${appPassword}`).toString('base64');
  const htmlContent = markdownToHtml(content);

  const url = `${siteUrl.replace(/\/$/, '')}/wp-json/wp/v2/posts`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${base64Auth}`,
    },
    body: JSON.stringify({
      title,
      content: htmlContent,
      status,
      tags,
      categories,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`WordPress 오류: ${res.status} - ${errText.slice(0, 200)}`);
  }
  const data = await res.json();
  return { id: data.id, link: data.link, status: data.status };
}

// ────────────────────────────────────────────────────────────────
// 네이버 블로그 발행 (Open API)
// ────────────────────────────────────────────────────────────────
async function publishToNaver(params: {
  accessToken: string;
  title: string;
  content: string;
  tags?: string[];
}) {
  const { accessToken, title, content, tags = [] } = params;
  const htmlContent = markdownToHtml(content);

  const res = await fetch('https://openapi.naver.com/blog/writePost.json', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: new URLSearchParams({
      title,
      contents: htmlContent,
      tags: tags.join(','),
    }).toString(),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`네이버 블로그 오류: ${res.status} - ${errText.slice(0, 200)}`);
  }
  const data = await res.json();
  return { logNo: data.logNo, postUrl: data.postUrl };
}

// ────────────────────────────────────────────────────────────────
// Next.js 개인 블로그 (Supabase)
// ────────────────────────────────────────────────────────────────
async function publishToNextBlog(params: {
  supabaseUrl: string;
  supabaseKey: string;
  title: string;
  content: string;
  slug?: string;
  tags?: string[];
  status?: 'draft' | 'published';
}) {
  const { supabaseUrl, supabaseKey, title, content, slug, tags = [], status = 'draft' } = params;

  const generatedSlug = slug || title
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 60) + '-' + Date.now();

  const res = await fetch(`${supabaseUrl}/rest/v1/posts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Prefer': 'return=representation',
    },
    body: JSON.stringify({
      title,
      content,
      slug: generatedSlug,
      tags,
      status,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Next.js 블로그 오류: ${res.status} - ${errText.slice(0, 200)}`);
  }
  const [data] = await res.json();
  return { id: data?.id, slug: data?.slug };
}

// ────────────────────────────────────────────────────────────────
// Route Handler
// ────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { platform, title, content, config } = body;

    if (!platform || !title || !content) {
      return NextResponse.json({ error: '플랫폼, 제목, 내용이 필요합니다' }, { status: 400 });
    }

    switch (platform) {
      case 'wordpress': {
        const { siteUrl, username, appPassword, status, tags, categories } = config || {};
        if (!siteUrl || !username || !appPassword) {
          return NextResponse.json({ error: 'WordPress 설정이 필요합니다 (사이트 URL, 사용자명, 앱 비밀번호)' }, { status: 400 });
        }
        const result = await publishToWordPress({ siteUrl, username, appPassword, title, content, status, tags, categories });
        return NextResponse.json({ success: true, platform: 'wordpress', ...result });
      }

      case 'naver': {
        const { accessToken, tags } = config || {};
        if (!accessToken) {
          return NextResponse.json({ error: '네이버 액세스 토큰이 필요합니다' }, { status: 400 });
        }
        const result = await publishToNaver({ accessToken, title, content, tags });
        return NextResponse.json({ success: true, platform: 'naver', ...result });
      }

      case 'nextblog': {
        const { supabaseUrl, supabaseKey, slug, tags, status } = config || {};
        if (!supabaseUrl || !supabaseKey) {
          return NextResponse.json({ error: 'Supabase URL과 API 키가 필요합니다' }, { status: 400 });
        }
        const result = await publishToNextBlog({ supabaseUrl, supabaseKey, title, content, slug, tags, status });
        return NextResponse.json({ success: true, platform: 'nextblog', ...result });
      }

      default:
        return NextResponse.json({ error: '지원하지 않는 플랫폼입니다' }, { status: 400 });
    }
  } catch (err: unknown) {
    console.error('[blog/publish]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '발행 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
