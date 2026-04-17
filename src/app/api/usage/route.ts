import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase-server';
import { GUEST_LIMITS } from '@/lib/tier';

// GET: guest 사용량 조회
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = await createAdminClient();
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [{ count: dailyCount }, { count: monthlyCount }] = await Promise.all([
    admin.from('usage_logs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', todayStart),
    admin.from('usage_logs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', monthStart),
  ]);

  return NextResponse.json({
    daily: { used: dailyCount ?? 0, limit: GUEST_LIMITS.daily },
    monthly: { used: monthlyCount ?? 0, limit: GUEST_LIMITS.monthly },
    canUse: (dailyCount ?? 0) < GUEST_LIMITS.daily && (monthlyCount ?? 0) < GUEST_LIMITS.monthly,
  });
}

// POST: 사용량 기록 (AI 생성 직전 호출)
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = await createAdminClient();

  // 티어 확인
  const { data: profile } = await admin
    .from('user_profiles')
    .select('tier')
    .eq('user_id', user.id)
    .maybeSingle();

  const tier = profile?.tier ?? 'guest';

  // guest가 아니면 제한 없음
  if (tier !== 'guest') {
    return NextResponse.json({ ok: true, limited: false });
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [{ count: dailyCount }, { count: monthlyCount }] = await Promise.all([
    admin.from('usage_logs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', todayStart),
    admin.from('usage_logs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', monthStart),
  ]);

  const daily = dailyCount ?? 0;
  const monthly = monthlyCount ?? 0;

  if (daily >= GUEST_LIMITS.daily) {
    return NextResponse.json({
      ok: false, limited: true,
      reason: `오늘 사용 한도(${GUEST_LIMITS.daily}회)를 초과했습니다. 내일 다시 이용하거나 멤버십에 가입하세요.`,
    });
  }
  if (monthly >= GUEST_LIMITS.monthly) {
    return NextResponse.json({
      ok: false, limited: true,
      reason: `이번 달 사용 한도(${GUEST_LIMITS.monthly}회)를 초과했습니다. 멤버십에 가입하시면 무제한으로 이용할 수 있습니다.`,
    });
  }

  // 사용량 기록
  const { action } = await req.json().catch(() => ({ action: 'unknown' }));
  await admin.from('usage_logs').insert({ user_id: user.id, action });

  return NextResponse.json({
    ok: true, limited: false,
    daily: { used: daily + 1, limit: GUEST_LIMITS.daily },
    monthly: { used: monthly + 1, limit: GUEST_LIMITS.monthly },
  });
}
