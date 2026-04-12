import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

// ──────────────────────────────────────────────────────────────────
// GET — 저장된 블로그 플랫폼 자격 증명 반환 (비밀값은 마스킹)
// ──────────────────────────────────────────────────────────────────
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });

    const m = user.user_metadata ?? {};
    return NextResponse.json({
      wordpress: {
        connected: !!(m.wp_site_url && m.wp_username && m.wp_app_password),
        siteUrl: m.wp_site_url || '',
        username: m.wp_username || '',
        appPassword: m.wp_app_password ? mask(m.wp_app_password) : '',
        status: m.wp_default_status || 'draft',
      },
      naver: {
        connected: !!m.naver_access_token,
        accessToken: m.naver_access_token ? mask(m.naver_access_token) : '',
      },
      nextblog: {
        connected: !!(m.nextblog_supabase_url && m.nextblog_supabase_key),
        supabaseUrl: m.nextblog_supabase_url || '',
        supabaseKey: m.nextblog_supabase_key ? mask(m.nextblog_supabase_key) : '',
        status: m.nextblog_default_status || 'draft',
      },
    });
  } catch {
    return NextResponse.json({ error: '조회 실패' }, { status: 500 });
  }
}

// ──────────────────────────────────────────────────────────────────
// POST — 플랫폼 자격 증명 저장
// ──────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });

    const { platform, config } = await req.json();

    let updateData: Record<string, string | null> = {};

    if (platform === 'wordpress') {
      const { siteUrl, username, appPassword, status } = config;
      if (!siteUrl || !username || !appPassword) {
        return NextResponse.json({ error: 'WordPress 설정이 불완전합니다' }, { status: 400 });
      }
      updateData = {
        wp_site_url: siteUrl.trim().replace(/\/$/, ''),
        wp_username: username.trim(),
        wp_app_password: appPassword.trim(),
        wp_default_status: status || 'draft',
      };
    } else if (platform === 'naver') {
      const { accessToken } = config;
      if (!accessToken) {
        return NextResponse.json({ error: '네이버 액세스 토큰이 필요합니다' }, { status: 400 });
      }
      updateData = { naver_access_token: accessToken.trim() };
    } else if (platform === 'nextblog') {
      const { supabaseUrl, supabaseKey, status } = config;
      if (!supabaseUrl || !supabaseKey) {
        return NextResponse.json({ error: 'Supabase 정보가 불완전합니다' }, { status: 400 });
      }
      updateData = {
        nextblog_supabase_url: supabaseUrl.trim().replace(/\/$/, ''),
        nextblog_supabase_key: supabaseKey.trim(),
        nextblog_default_status: status || 'draft',
      };
    } else {
      return NextResponse.json({ error: '알 수 없는 플랫폼' }, { status: 400 });
    }

    const { error: updateError } = await supabase.auth.updateUser({ data: updateData });
    if (updateError) throw updateError;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: '저장 실패' }, { status: 500 });
  }
}

// ──────────────────────────────────────────────────────────────────
// DELETE — 플랫폼 자격 증명 삭제
// ──────────────────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });

    const { platform } = await req.json();
    const clearMap: Record<string, Record<string, null>> = {
      wordpress: { wp_site_url: null, wp_username: null, wp_app_password: null, wp_default_status: null },
      naver: { naver_access_token: null },
      nextblog: { nextblog_supabase_url: null, nextblog_supabase_key: null, nextblog_default_status: null },
    };

    if (!clearMap[platform]) return NextResponse.json({ error: '알 수 없는 플랫폼' }, { status: 400 });
    await supabase.auth.updateUser({ data: clearMap[platform] });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: '삭제 실패' }, { status: 500 });
  }
}

function mask(val: string): string {
  if (val.length <= 6) return '••••••';
  return val.slice(0, 3) + '••••••••••' + val.slice(-3);
}
