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

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }: { data: { user: import('@supabase/supabase-js').User | null } }) => {
      if (user) {
        setUserEmail(user.email ?? null);
        setUserName(user.user_metadata?.full_name ?? user.user_metadata?.name ?? null);
      }
    });
  }, []);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  }

  return (
    <div className="flex h-screen bg-black text-white font-mono overflow-hidden">
      {/* 사이드바 */}
      <aside className="w-[330px] shrink-0 flex flex-col border-r border-white/10 bg-black">
        {/* 로고 */}
        <div className="flex items-center gap-2 px-5 py-5 border-b border-white/10">
          <div className="w-3 h-3 bg-yellow-400" />
          <Link href="/" className="text-white font-black text-base tracking-widest uppercase hover:text-yellow-400 transition-colors">
            ClipFlow
          </Link>
        </div>

        {/* 네비게이션 */}
        <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto">
          {NAV_ITEMS.map((group) => (
            <div key={group.group}>
              <p className="text-[#17BEBB]/60 text-[13px] tracking-widest px-2 mb-2">{group.group}</p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <div key={item.href} className="relative">
                      {'soon' in item && item.soon ? (
                        <div className="flex items-center gap-2.5 px-3 py-2.5 text-white/50 cursor-not-allowed select-none">
                          <span className="text-[13px] w-4">{item.icon}</span>
                          <span className="text-[13px] tracking-wide">{item.label}</span>
                          <span className="ml-auto text-[12px] border border-white/20 px-1.5 py-0.5 text-white/50">SOON</span>
                        </div>
                      ) : (
                        <Link href={item.href}
                          className={`flex items-center gap-2.5 px-3 py-2.5 transition-colors text-[13px] tracking-wide ${active
                            ? 'bg-yellow-400 text-black font-bold'
                            : 'text-white/75 hover:text-white hover:bg-white/5'
                            }`}>
                          <span className="w-4">{item.icon}</span>
                          <span>{item.label}</span>
                        </Link>
                      )}
                    </div>
                  );
                })}

                {/* LIBRARY 그룹에 사이드바 대서 목록 추가 */}
                {group.group === 'LIBRARY' && (
                  <div className="mt-4 border-t border-white/5 pt-2">
                    <SidebarScripts />
                  </div>
                )}
              </div>
            </div>
          ))}
        </nav>

        {/* 하단 */}
        <div className="px-5 py-4 border-t border-white/10 space-y-2">
          {userName && (
            <div className="flex items-center gap-2">
              <p className="text-white/80 text-[13.5px] font-mono truncate">{userName}</p>
              <span className="text-[10.5px] font-mono px-1.5 py-0.5 border border-yellow-400/40 text-yellow-400/70 shrink-0">ADMIN</span>
            </div>
          )}
          {userEmail && (
            <p className="text-[#17BEBB]/60 text-[12.5px] font-mono truncate">{userEmail}</p>
          )}
          <div className="flex items-center justify-between pt-1">
            <span className="text-white/30 text-[12.5px] tracking-widest">v1.0.0</span>
            <button
              onClick={handleLogout}
              className="text-[#E4572E]/60 hover:text-[#E4572E] text-[12.5px] font-mono transition-colors"
            >
              로그아웃
            </button>
          </div>
        </div>
      </aside>

      {/* 콘텐츠 영역 */}
      <main className="flex-1 overflow-y-auto bg-[#0a0a0a]">
        {/* 상단 바 */}
        <div className="sticky top-0 z-10 flex items-center justify-end px-6 py-3 border-b border-white/10 bg-[#0a0a0a]/90 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-[#76B041] rounded-full animate-pulse" />
            <span className="text-[#76B041] text-xs tracking-widest">LIVE</span>
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
