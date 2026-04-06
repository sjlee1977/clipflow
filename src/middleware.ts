import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Next.js 16.2.1 Turbopack 호환성을 위한 미들웨어
 * 이 함수는 모든 요청에서 실행되며 권한을 체크합니다.
 */
export default async function middleware(req: NextRequest) {
  let response = NextResponse.next({ request: req });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return req.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
          response = NextResponse.next({ request: req });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // 미로그인 상태에서 보호된 경로(/dashboard, /api) 접근 시 리다이렉트
  const isProtected =
    req.nextUrl.pathname.startsWith('/dashboard') ||
    req.nextUrl.pathname.startsWith('/api/');

  if (isProtected && !user) {
    const { origin } = req.nextUrl;
    return NextResponse.redirect(new URL('/login', origin));
  }

  return response;
}

// 빌드 환경에 따라 'proxy'라는 명칭을 찾을 수도 있으므로 별칭으로 내보냅니다.
export { middleware as proxy };

export const config = {
  matcher: ['/dashboard/:path*', '/api/:path*'],
};
