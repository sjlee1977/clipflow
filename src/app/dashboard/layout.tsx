'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  {
    group: 'STUDIO',
    items: [
      { href: '/dashboard/script', label: '대본 만들기', icon: '✎' },
      { href: '/dashboard', label: '영상 만들기', icon: '▶' },
      { href: '/dashboard/history', label: '내 영상', icon: '◫', soon: true },
    ],
  },
  {
    group: 'SETTINGS',
    items: [
      { href: '/dashboard/settings', label: '설정', icon: '◈', soon: true },
    ],
  },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

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
              <p className="text-white/20 text-xs tracking-widest px-2 mb-2">{group.group}</p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <div key={item.href} className="relative">
                      {item.soon ? (
                        <div className="flex items-center gap-2.5 px-3 py-2.5 text-white/20 cursor-not-allowed select-none">
                          <span className="text-xs w-4">{item.icon}</span>
                          <span className="text-xs tracking-wide">{item.label}</span>
                          <span className="ml-auto text-[11px] border border-white/10 px-1.5 py-0.5 text-white/20">SOON</span>
                        </div>
                      ) : (
                        <Link href={item.href}
                          className={`flex items-center gap-2.5 px-3 py-2.5 transition-colors text-xs tracking-wide ${active
                            ? 'bg-yellow-400 text-black font-bold'
                            : 'text-white/60 hover:text-white hover:bg-white/5'
                            }`}>
                          <span className="w-4">{item.icon}</span>
                          <span>{item.label}</span>
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
        <div className="px-5 py-4 border-t border-white/10">
          <div className="text-white/20 text-xs tracking-widest">
            <p>v1.0.0</p>
          </div>
        </div>
      </aside>

      {/* 콘텐츠 영역 */}
      <main className="flex-1 overflow-y-auto bg-[#0a0a0a]">
        {/* 상단 바 */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-3 border-b border-white/10 bg-[#0a0a0a]/90 backdrop-blur-sm">
          <div className="text-white/30 text-xs tracking-widest uppercase">
            {NAV_ITEMS.flatMap(g => g.items).find(i => i.href === pathname)?.label ?? 'Dashboard'}
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
            <span className="text-white/30 text-xs tracking-widest">LIVE</span>
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
