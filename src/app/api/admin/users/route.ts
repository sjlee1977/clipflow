import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase-server';
import type { Tier } from '@/lib/tier';

// GET: 전체 회원 목록 + 티어
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = await createAdminClient();

  // 요청자가 admin인지 확인
  const { data: profile } = await admin
    .from('user_profiles')
    .select('tier')
    .eq('user_id', user.id)
    .maybeSingle();

  if (profile?.tier !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // auth.users 목록 조회
  const { data: authUsers } = await admin.auth.admin.listUsers({ perPage: 1000 });

  // user_profiles 조회
  const { data: profiles } = await admin
    .from('user_profiles')
    .select('user_id, tier, memo, created_at, updated_at');

  const profileMap = new Map((profiles ?? []).map(p => [p.user_id, p]));

  const users = (authUsers?.users ?? []).map(u => ({
    id: u.id,
    email: u.email,
    name: u.user_metadata?.full_name ?? u.user_metadata?.name ?? null,
    tier: (profileMap.get(u.id)?.tier ?? 'guest') as Tier,
    memo: profileMap.get(u.id)?.memo ?? '',
    joinedAt: u.created_at,
    lastSignIn: u.last_sign_in_at,
  }));

  return NextResponse.json({ users });
}

// PATCH: 티어 변경
export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = await createAdminClient();

  const { data: profile } = await admin
    .from('user_profiles')
    .select('tier')
    .eq('user_id', user.id)
    .maybeSingle();

  if (profile?.tier !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { targetUserId, tier, memo } = await req.json();

  await admin.from('user_profiles').upsert({
    user_id: targetUserId,
    tier,
    memo: memo ?? '',
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });

  return NextResponse.json({ ok: true });
}
