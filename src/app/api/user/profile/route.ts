import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import type { Tier } from '@/lib/tier';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      return NextResponse.json({ tier: 'guest' as Tier });
    }

    // user_metadata에 tier 필드가 있으면 사용, 없으면 free
    const tier: Tier = (user.user_metadata?.tier as Tier) ?? 'free';

    return NextResponse.json({
      tier,
      email: user.email,
      name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
    });
  } catch {
    return NextResponse.json({ tier: 'guest' as Tier });
  }
}
