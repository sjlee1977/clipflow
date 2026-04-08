'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase-browser';
import SidebarScripts from '@/components/SidebarScripts';

const NAV_ITEMS = [
  {
    group: 'STUDIO',
    items: [
      { href: '/dashboard/prompt', label: '대본 요청 스크립트', icon: '⌘' },
      { href: '/dashboard/script', label: '대본 만들기', icon: '✎' },
      { href: '/dashboard/video', label: '영상 만들기', icon: '▶' },
    ],
  },
  {
    group: 'LIBRARY',
    items: [
      { href: '/dashboard/history', label: '내 영상', icon: '◫' },
      { href: '/dashboard/my-scripts', label: '내 대본', icon: '☰' },
    ],
  },
  {
    group: 'SETTINGS',
    items: [
      { href: '/dashboard/settings', label: '설정', icon: '◈' },
    ],
  },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [credits, setCredits] = useState<number | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }: { data: { user: import('@supabase/supabase-js').User | null } }) => {
      if (user) {
        setUserEmail(user.email ?? null);
        setUserName(user.user_metadata?.full_name ?? user.user_metadata?.name ?? null);
        const { data } = await supabase
          .from('user_credits')
          .select('credits_remaining')
          .eq('user_id', user.id)
          .single();
        if (data) setCredits(data.credits_remaining);
      }
    });
  }, []);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  }

  return (
    <div className="flex h-screen bg-[#0a0a0a] text-white overflow-hidden">
      {/* 사이드바 */}
      <aside className="w-[330px] shrink-0 flex flex-col border-r border-white/8 bg-[#0d0d0d]">
        {/* 로고 */}
        <div className="flex items-center gap-2 px-[26px] h-[52px] border-b border-white/8">
          <div className="w-3 h-3 bg-[#F97316] shrink-0" />
          <Link href="/" className="text-white font-medium text-[15px] tracking-normal uppercase hover:opacity-80 transition-opacity" style={{ fontFamily: "'Montserrat', sans-serif" }}>
            ClipFlow
          </Link>
        </div>

        {/* 네비게이션 */}
        <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
          {NAV_ITEMS.map((group) => (
            <div key={group.group}>
              <p className="text-white/25 text-[11px] font-semibold tracking-widest uppercase px-2 mb-1.5">{group.group}</p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <div key={item.href} className="relative">
                      {'soon' in item && item.soon ? (
                        <div className="flex items-center gap-2.5 px-3 py-2 text-white/30 cursor-not-allowed select-none rounded-lg">
                          <span className="text-sm w-4">{item.icon}</span>
                          <span className="text-sm">{item.label}</span>
                          <span className="ml-auto text-[11px] border border-white/15 px-1.5 py-0.5 rounded text-white/30">SOON</span>
                        </div>
                      ) : (
                        <Link
                          href={item.href}
                          className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors text-sm ${
                            active
                              ? 'border border-[#F97316]/60 bg-[#F97316]/10 text-white font-medium'
                              : 'text-white/60 hover:text-white hover:bg-white/5'
                          }`}
                        >
                          <span className={`w-6 h-6 flex items-center justify-center rounded-md shrink-0 text-xs ${
                            active ? 'bg-[#F97316]/80 text-white' : ''
                          }`}>{item.icon}</span>
                          <span>{item.label}</span>
                        </Link>
                      )}
                    </div>
                  );
                })}

                {group.group === 'LIBRARY' && (
                  <div className="mt-3 border-t border-white/5 pt-2">
                    <SidebarScripts />
                  </div>
                )}
              </div>
            </div>
          ))}
        </nav>

        {/* 하단 */}
        <div className="px-4 py-4 border-t border-white/8 space-y-2">
          {/* 크레딧 */}
          {credits !== null && (
            <div className="flex items-center gap-2 px-1 mb-2">
              <span className="text-[#F97316] text-xs">⊙</span>
              <span className="text-white/50 text-xs">크레딧</span>
              <span className="ml-auto text-[#F97316] text-sm font-semibold">{credits.toLocaleString()}</span>
            </div>
          )}
          {userName && (
            <div className="flex items-center gap-2">
              <p className="text-white/70 text-sm truncate">{userName}</p>
              <span className="text-[10px] px-1.5 py-0.5 rounded border border-orange-500/30 text-orange-500/60 shrink-0">ADMIN</span>
            </div>
          )}
          {userEmail && (
            <p className="text-white/30 text-xs truncate">{userEmail}</p>
          )}
          <div className="flex items-center justify-between pt-1">
            <span className="text-white/20 text-xs">v1.0.0</span>
            <button
              onClick={handleLogout}
              className="text-red-400/50 hover:text-red-400 text-xs transition-colors"
            >
              로그아웃
            </button>
          </div>
        </div>
      </aside>

      {/* 콘텐츠 영역 */}
      <main className="flex-1 overflow-y-auto bg-[#0a0a0a]">
        {/* 상단 바 */}
        <div className="sticky top-0 z-10 flex items-center justify-end px-6 h-[52px] border-b border-white/8 bg-[#0a0a0a]/90 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
            <span className="text-green-400/70 text-xs tracking-widest">LIVE</span>
          </div>
        </div>

        {/* 페이지 콘텐츠 */}
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
