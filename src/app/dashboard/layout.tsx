'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase-browser';
import { useTheme } from '@/lib/useTheme';
import ThemeToggle from '@/components/ThemeToggle';
import { FileText, PenLine, Video, TrendingUp, Zap, Film, ScrollText, Settings, Users, BarChart2, LayoutTemplate, BookOpen, CalendarDays, Repeat2, Image, Images, LayoutDashboard, type LucideIcon } from 'lucide-react';

const DASHBOARD_ITEM = { href: '/dashboard', label: '대시보드', icon: LayoutDashboard };

const NAV_ITEMS: { group: string; items: { href: string; label: string; icon: LucideIcon }[] }[] = [
  {
    group: '만들기',
    items: [
      { href: '/dashboard/prompt',    label: '대본 요청 스크립트', icon: FileText },
      { href: '/dashboard/script',    label: '대본 만들기',         icon: PenLine },
      { href: '/dashboard/video',     label: '영상 만들기',         icon: Video },
      { href: '/dashboard/blog',      label: '블로그 작성',         icon: BookOpen },
      { href: '/dashboard/auto-blog', label: '자동 블로그 생성',    icon: Zap },
    ],
  },
  {
    group: '발행',
    items: [
      { href: '/dashboard/calendar',  label: '콘텐츠 캘린더', icon: CalendarDays },
      { href: '/dashboard/reformat',  label: '멀티포맷 변환', icon: Repeat2 },
      { href: '/dashboard/thumbnail', label: '썸네일 생성',   icon: Image },
    ],
  },
  {
    group: '분석',
    items: [
      { href: '/dashboard/trends/viral',      label: '급상승 영상',   icon: TrendingUp },
      { href: '/dashboard/trends/outliers',   label: '채널 이상치',   icon: Zap },
      { href: '/dashboard/trends/subscriber', label: '구독자 분석',   icon: Users },
      { href: '/dashboard/keyword',           label: '키워드 분석',   icon: BarChart2 },
    ],
  },
  {
    group: '라이브러리',
    items: [
      { href: '/dashboard/history',       label: '내 영상',    icon: Film },
      { href: '/dashboard/my-scripts',    label: '내 대본',    icon: ScrollText },
      { href: '/dashboard/carousel',      label: '내 캐러셀',  icon: LayoutTemplate },
      { href: '/dashboard/my-thumbnails', label: '내 썸네일',  icon: Images },
    ],
  },
  {
    group: '설정',
    items: [
      { href: '/dashboard/settings', label: '설정', icon: Settings },
    ],
  },
];

// 사이드바 네비게이션 링크
function NavLink({
  href,
  label,
  icon: Icon,
  active,
  badge,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 px-3 py-2 rounded-xl transition-all text-sm"
      style={{
        background: active ? 'linear-gradient(135deg, rgba(79,142,247,0.18) 0%, rgba(79,142,247,0.10) 100%)' : 'transparent',
        border: active ? '1px solid rgba(79,142,247,0.30)' : '1px solid transparent',
        color: active ? 'var(--text)' : 'var(--text-muted)',
        fontWeight: active ? 600 : 400,
      }}
    >
      {/* 아이콘 박스 — 활성: 초록 채움 / 비활성: 파랑 테두리 */}
      <span
        className="w-7 h-7 flex items-center justify-center rounded-lg shrink-0 transition-all"
        style={active ? {
          background: 'rgba(34,197,94,0.15)',
          border: '1px solid rgba(34,197,94,0.45)',
          color: '#4ade80',
          boxShadow: '0 0 10px rgba(34,197,94,0.22), inset 0 0 6px rgba(34,197,94,0.06)',
        } : {
          background: 'rgba(79,142,247,0.06)',
          border: '1px solid rgba(79,142,247,0.22)',
          color: '#4f8ef7',
        }}
      >
        <Icon size={13} strokeWidth={active ? 2.2 : 1.8} />
      </span>

      <span className="truncate">{label}</span>

      {badge !== undefined && badge > 0 && (
        <span className="ml-auto flex items-center justify-center min-w-[18px] h-[18px] rounded-full text-white text-[9px] font-black px-1"
          style={{ background: '#ef4444' }}>
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </Link>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  useTheme();
  const [userEmail, setUserEmail]     = useState<string | null>(null);
  const [userName, setUserName]       = useState<string | null>(null);
  const [credits, setCredits]         = useState<number | null>(null);
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

      {/* ── 사이드바 ── */}
      <aside
        className="w-[248px] shrink-0 flex flex-col"
        style={{
          background: 'var(--sidebar)',
          borderRight: '1px solid var(--border)',
          boxShadow: '1px 0 20px rgba(79,142,247,0.05)',
        }}
      >
        {/* 로고 */}
        <div
          className="flex items-center gap-2.5 px-5 h-[56px] shrink-0"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          {/* 로고 아이콘 — 테두리만 */}
          <div
            className="w-7 h-7 flex items-center justify-center rounded-lg shrink-0"
            style={{
              background: 'transparent',
              border: '1px solid rgba(79,142,247,0.55)',
              boxShadow: '0 0 10px rgba(79,142,247,0.25), inset 0 0 8px rgba(79,142,247,0.06)',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
              <path d="M2 7 L6 3 L10 7 L6 11 Z" stroke="#4f8ef7" strokeWidth="1.5" strokeLinejoin="round" fill="none" />
              <path d="M7 4 L11 8" stroke="#4f8ef7" strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
            </svg>
          </div>
          <Link
            href="/"
            className="font-semibold text-[15px] tracking-wide uppercase hover:opacity-80 transition-opacity"
            style={{ fontFamily: "'Montserrat', sans-serif", color: 'var(--text)' }}
          >
            ClipFlow
          </Link>
        </div>

        {/* 네비게이션 */}
        <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">

          {/* 대시보드 단독 */}
          <NavLink
            href={DASHBOARD_ITEM.href}
            label={DASHBOARD_ITEM.label}
            icon={DASHBOARD_ITEM.icon}
            active={pathname === '/dashboard'}
          />

          {NAV_ITEMS.map((group) => (
            <div key={group.group} className="space-y-0.5">
              {/* 그룹 레이블 */}
              <p
                className="text-[10px] font-bold tracking-[0.12em] uppercase px-3 pb-1.5"
                style={{ color: 'var(--text-ultra)' }}
              >
                {group.group}
              </p>

              {group.items.map((item) => {
                const active = pathname === item.href;
                const badge = item.href.includes('/trends/viral') ? newTrendCount : undefined;
                return (
                  <NavLink
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    icon={item.icon}
                    active={active}
                    badge={badge}
                  />
                );
              })}
            </div>
          ))}
        </nav>

        {/* 하단 사용자 정보 */}
        <div
          className="px-4 py-4 space-y-2"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          {/* 크레딧 바 */}
          {credits !== null && (
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-xl mb-1"
              style={{ background: 'rgba(79,142,247,0.08)', border: '1px solid rgba(79,142,247,0.15)' }}
            >
              <span style={{ color: '#4f8ef7' }}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                  <circle cx="6" cy="6" r="5" fillOpacity="0.3" />
                  <circle cx="6" cy="6" r="3" />
                </svg>
              </span>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>크레딧</span>
              <span className="ml-auto text-sm font-semibold" style={{ color: '#4f8ef7' }}>{credits.toLocaleString()}</span>
            </div>
          )}

          {/* 사용자 이름 + 배지 */}
          {userName && (
            <div className="flex items-center gap-2 px-1">
              <div
                className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0"
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(79,142,247,0.45)',
                  color: '#4f8ef7',
                  boxShadow: '0 0 6px rgba(79,142,247,0.20)',
                }}
              >
                {userName.charAt(0).toUpperCase()}
              </div>
              <p className="text-sm truncate font-medium" style={{ color: 'var(--text-muted)' }}>{userName}</p>
              <span
                className="text-[9px] px-1.5 py-0.5 rounded-md shrink-0 font-semibold"
                style={{ background: 'rgba(79,142,247,0.15)', color: '#4f8ef7', border: '1px solid rgba(79,142,247,0.25)' }}
              >
                ADMIN
              </span>
            </div>
          )}
          {userEmail && (
            <p className="text-[11px] truncate px-1" style={{ color: 'var(--text-faint)' }}>{userEmail}</p>
          )}

          <div className="flex items-center justify-between pt-1 px-1">
            <span className="text-[10px]" style={{ color: 'var(--text-ultra)' }}>v1.0.0</span>
            <button
              onClick={handleLogout}
              className="text-xs transition-colors"
              style={{ color: 'rgba(239,68,68,0.5)' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(239,68,68,0.5)')}
            >
              로그아웃
            </button>
          </div>
        </div>
      </aside>

      {/* ── 콘텐츠 ── */}
      <main className="flex-1 overflow-y-auto" style={{ background: 'var(--bg)' }}>
        {/* 상단바 */}
        <div
          className="sticky top-0 z-10 flex items-center justify-end px-6 h-[56px] backdrop-blur-md"
          style={{
            borderBottom: '1px solid var(--border)',
            background: 'var(--bg-topbar)',
            boxShadow: '0 1px 12px rgba(0,0,0,0.3)',
          }}
        >
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
              style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}
            >
              <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
              <span className="text-[11px] font-semibold tracking-widest" style={{ color: '#6ee7b7' }}>LIVE</span>
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
