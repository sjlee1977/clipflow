import { createClient } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';

/**
 * API 라우트에서 인증된 유저를 가져옵니다.
 * 미인증 시 401 Response를 반환합니다.
 */
export async function requireAuth(): Promise<
  { user: { id: string; email?: string }; errorResponse: null } |
  { user: null; errorResponse: NextResponse }
> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return {
      user: null,
      errorResponse: NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 }),
    };
  }

  return { user, errorResponse: null };
}
