import { createClient } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';

export const CREDIT_COSTS = {
  script: 1,
  scenes: 3,
  video: 5,
} as const;

export type CreditAction = keyof typeof CREDIT_COSTS;

function nextMonthStart(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
}

/**
 * 크레딧 확인 및 차감.
 * admin 플랜은 무제한.
 * 부족 시 402 응답 반환, 통과 시 null 반환.
 */
export async function checkAndDeductCredits(
  userId: string,
  action: CreditAction
): Promise<NextResponse | null> {
  const cost = CREDIT_COSTS[action];
  const supabase = await createClient();

  // 크레딧 행 조회 (없으면 자동 생성)
  let { data, error } = await supabase
    .from('user_credits')
    .select('credits_remaining, credits_reset_at, plan')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    // 신규 유저 - 기본 크레딧 생성
    const { data: inserted } = await supabase
      .from('user_credits')
      .insert({ user_id: userId })
      .select('credits_remaining, credits_reset_at, plan')
      .single();
    data = inserted;
  }

  if (!data) {
    return NextResponse.json({ error: '크레딧 정보를 불러올 수 없습니다' }, { status: 500 });
  }

  // admin은 무제한
  if (data.plan === 'admin') return null;

  // 월 리셋 확인
  if (new Date(data.credits_reset_at) <= new Date()) {
    await supabase
      .from('user_credits')
      .update({ credits_remaining: 20, credits_reset_at: nextMonthStart() })
      .eq('user_id', userId);
    data.credits_remaining = 20;
  }

  if (data.credits_remaining < cost) {
    return NextResponse.json(
      {
        error: `크레딧이 부족합니다. (필요: ${cost}, 보유: ${data.credits_remaining})`,
        credits_remaining: data.credits_remaining,
      },
      { status: 402 }
    );
  }

  // 차감
  await supabase
    .from('user_credits')
    .update({ credits_remaining: data.credits_remaining - cost })
    .eq('user_id', userId);

  return null;
}

/**
 * 현재 크레딧 조회
 */
export async function getCredits(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('user_credits')
    .select('credits_remaining, plan')
    .eq('user_id', userId)
    .single();
  return data;
}
