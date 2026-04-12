'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase-browser';
import { useTheme } from '@/lib/useTheme';
import ThemeToggle from '@/components/ThemeToggle';
import { FileText, PenLine, Video, TrendingUp, Zap, Film, ScrollText, Settings, Users, BarChart2, LayoutTemplate, BookOpen, CalendarDays, Repeat2, Image, type LucideIcon } from 'lucide-react';

const NAV_ITEMS: { group: string; items: { href: string; label: string; icon: LucideIcon }[] }[] = [
  {
    group: 'STUDIO',
    items: [
      { href: '/dashboard/prompt', label: '대본 요청 스크립트', icon: FileText },
      { href: '/dashboard/script', label: '대본 만들기', icon: PenLine },
      { href: '/dashboard/video', label: '영상 만들기', icon: Video },
    ],
  },
  {
    group: 'TRENDS',
    items: [
      { href: '/dashboard/trends/viral', label: '급상승 영상', icon: TrendingUp },
      { href: '/dashboard/trends/outliers', label: '채널 이상치', icon: Zap },
      { href: '/dashboard/trends/subscriber', label: '구독자 분석', icon: Users },
      { href: '/dashboard/keyword', label: '키워드 분석', icon: BarChart2 },
    ],
  },
  {
    group: 'PLAN',
    items: [
      { href: '/dashboard/calendar', label: '콘텐츠 캘린더', icon: CalendarDays },
      { href: '/dashboard/blog', label: '블로그 작성', icon: BookOpen },
      { href: '/dashboard/reformat', label: '멀티포맷 변환', icon: Repeat2 },
      { href: '/dashboard/thumbnail', label: '썸네일 생성', icon: Image },
    ],
  },
  {
    group: 'LIBRARY',
    items: [
      { href: '/dashboard/history', label: '내 영상', icon: Film },
      { href: '/dashboard/my-scripts', label: '내 대본', icon: ScrollText },
      { href: '/dashboard/carousel', label: '내 캐러셀', icon: LayoutTemplate },
    ],
  },
  {
    group: 'SETTINGS',
    items: [
      { href: '/dashboard/settings', label: '설정', icon: Settings },
    ],
  },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isDark } = useTheme();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [newTrendCount, setNewTrendCount] = useState(0);

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
    // 새 트렌드 수 확인 (최근 3시간 이내)
    const checkTrends = async () => {
      try {
        const since = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
        const supabase = createClient();
        const { count } = await supabase
          .from('viral_signals')
          .select('id', { count: 'exact', head: true })
          .gte('detected_at', since);
        if (count && count > 0) setNewTrendCount(count);
      } catch { /* silent */ }
    };
    checkTrends();
  }, []);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      {/* 사이드바 */}
      <aside className="w-[330px] shrink-0 flex flex-col" style={{ background: 'var(--sidebar)', borderRight: '1px solid var(--border)' }}>
        {/* 로고 */}
        <div className="flex items-center gap-2 px-[26px] h-[52px]" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="w-3 h-3 bg-[#22c55e] shrink-0" />
          <Link href="/" className="font-medium text-[15px] tracking-normal uppercase hover:opacity-80 transition-opacity" style={{ fontFamily: "'Montserrat', sans-serif", color: 'var(--text)' }}>
            ClipFlow
          </Link>
        </div>

        {/* 네비게이션 */}
        <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
          {NAV_ITEMS.map((group) => (
            <div key={group.group}>
              <p className="text-[11px] font-semibold tracking-widest uppercase px-2 mb-1.5" style={{ color: 'var(--text-ultra)' }}>{group.group}</p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <div key={item.href} className="relative">
                      {'soon' in item && item.soon ? (
                        <div className="flex items-center gap-2.5 px-3 py-2 cursor-not-allowed select-none rounded-lg" style={{ color: 'var(--text-faint)' }}>
                          <span className="w-4 flex items-center justify-center"><item.icon size={14} /></span>
                          <span className="text-sm">{item.label}</span>
                          <span className="ml-auto text-[11px] px-1.5 py-0.5 rounded" style={{ border: '1px solid var(--border-md)', color: 'var(--text-faint)' }}>SOON</span>
                        </div>
                      ) : (
                        <Link
                          href={item.href}
                          className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors text-sm ${
                            active ? 'border border-[#22c55e]/60 bg-[#22c55e]/10 font-medium' : 'hover:bg-[var(--hover-bg)]'
                          }`}
                          style={{ color: active ? 'var(--text)' : 'var(--text-muted)' }}
                        >
                          <span className={`w-6 h-6 flex items-center justify-center rounded-md shrink-0 ${
                            active ? 'bg-[#22c55e]/80 text-white' : ''
                          }`}><item.icon size={14} /></span>
                          <span>{item.label}</span>
                          {/* 트렌드 알림 배지 */}
                          {item.href.includes('/trends/viral') && newTrendCount > 0 && (
                            <span className="ml-auto flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-red-500/90 text-white text-[9px] font-black px-1">
                              {newTrendCount > 99 ? '99+' : newTrendCount}
                            </span>
                          )}
                        </Link>
                      )}
                    </div>
                  );
                })}

              </div>
            </div>
          ))}
        </nav>

        {/* 하단 */}
        <div className="px-4 py-4 space-y-2" style={{ borderTop: '1px solid var(--border)' }}>
          {credits !== null && (
            <div className="flex items-center gap-2 px-1 mb-2">
              <span className="text-[#22c55e] text-xs">⊙</span>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>크레딧</span>
              <span className="ml-auto text-[#22c55e] text-sm font-semibold">{credits.toLocaleString()}</span>
            </div>
          )}
          {userName && (
            <div className="flex items-center gap-2">
              <p className="text-sm truncate" style={{ color: 'var(--text-muted)' }}>{userName}</p>
              <span className="text-[10px] px-1.5 py-0.5 rounded border border-green-500/30 text-green-500/60 shrink-0">ADMIN</span>
            </div>
          )}
          {userEmail && (
            <p className="text-xs truncate" style={{ color: 'var(--text-faint)' }}>{userEmail}</p>
          )}
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs" style={{ color: 'var(--text-ultra)' }}>v1.0.0</span>
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
      <main className="flex-1 overflow-y-auto" style={{ background: 'var(--bg)' }}>
        {/* 상단 바 */}
        <div className="sticky top-0 z-10 flex items-center justify-end px-6 h-[52px] backdrop-blur-sm" style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-topbar)' }}>
          <div className="flex items-center gap-3">
            {/* 테마 토글 - LIVE 왼쪽 */}
            <ThemeToggle />

            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
              <span className="text-green-400/70 text-xs tracking-widest">LIVE</span>
            </div>
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
