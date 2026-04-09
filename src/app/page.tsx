'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase-browser';
import { useTheme } from '@/lib/useTheme';
import ThemeToggle from '@/components/ThemeToggle';

export default function HomePage() {
  const [user, setUser] = useState<any>(null);
  const { isDark } = useTheme();

  useEffect(() => {
    const supabaseClient = createClient();
    supabaseClient.auth.getSession().then(({ data: { session } }: { data: { session: import('@supabase/supabase-js').Session | null } }) => {
      setUser(session?.user ?? null);
    });
  }, []);

  const d = isDark;

  return (
    <div className={`min-h-screen ${d ? 'bg-black text-white' : 'bg-white text-black'} overflow-hidden transition-colors duration-200`}>
      {/* 헤더 */}
      <header className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-3 border-b ${d ? 'border-white/10 bg-black/80' : 'border-black/10 bg-white/80'} backdrop-blur-sm transition-colors duration-200`}>
        <a href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="w-4 h-4 bg-green-500" />
          <span className={`${d ? 'text-white' : 'text-black'} font-medium text-[15px] tracking-normal uppercase`} style={{ fontFamily: "'Montserrat', sans-serif" }}>ClipFlow</span>
        </a>
        <nav className={`hidden md:flex items-center gap-8 text-[12px] tracking-tight font-medium uppercase ${d ? 'text-gray-400' : 'text-gray-500'}`}>
          <a href="#features" className={`hover:${d ? 'text-white' : 'text-black'} transition-colors`}>기능</a>
          <a href="#pricing" className={`hover:${d ? 'text-white' : 'text-black'} transition-colors`}>요금제</a>
        </nav>
        <div className="flex items-center gap-3">
          {/* 테마 토글 */}
          <ThemeToggle />

          {!user && (
            <Link href="/dashboard" className={`hidden md:block text-xs tracking-widest uppercase ${d ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-black'} transition-colors px-4 py-2`}>
              로그인
            </Link>
          )}
          <Link href="/dashboard" className="bg-green-500 hover:bg-green-400 text-black text-[12px] font-black tracking-tight uppercase px-5 py-2 transition-colors">
            {user ? '대시보드' : '무료 시작'}
          </Link>
        </div>
      </header>

      {/* 히어로 */}
      <section className="relative min-h-screen flex items-center justify-center px-6 pt-28 pb-20">
        {/* 배경 그리드 */}
        <div className={`absolute inset-0 ${d
          ? 'bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)]'
          : 'bg-[linear-gradient(rgba(0,0,0,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.05)_1px,transparent_1px)]'
        } bg-[size:60px_60px]`} />

        {/* 플로팅 태그들 */}
        <div className="absolute top-1/4 left-16 hidden lg:flex items-center gap-1.5 bg-orange-400 text-black text-[12px] font-bold px-2.5 py-1 animate-bounce" style={{ animationDuration: '3s' }}>
          <span className="w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-r-[7px] border-r-black -rotate-45" />
          AI_GEN
        </div>
        <div className="absolute top-1/3 left-24 hidden lg:flex items-center gap-1.5 bg-blue-400 text-black text-[12px] font-bold px-2.5 py-1 animate-bounce" style={{ animationDuration: '4s', animationDelay: '1s' }}>
          <span className="w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-r-[7px] border-r-black -rotate-45" />
          TTS_ON
        </div>
        <div className="absolute top-1/2 right-20 hidden lg:flex items-center gap-1.5 bg-orange-400 text-black text-[12px] font-bold px-2.5 py-1 animate-bounce" style={{ animationDuration: '3.5s', animationDelay: '0.5s' }}>
          <span className="w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-r-[7px] border-r-black -rotate-45" />
          VIDEO_OUT
        </div>
        <div className="absolute top-2/3 right-32 hidden lg:flex items-center gap-1.5 bg-pink-400 text-black text-[12px] font-bold px-2.5 py-1 animate-bounce" style={{ animationDuration: '4.5s', animationDelay: '1.5s' }}>
          <span className="w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-r-[7px] border-r-black -rotate-45" />
          AUTO_EDIT
        </div>

        {/* 메인 텍스트 */}
        <div className="relative text-center max-w-5xl mx-auto">
          <div className="inline-flex items-center gap-2 border border-green-500/50 px-4 py-1.5 mb-8 text-[13px] tracking-widest text-green-500 uppercase">
            <div className="w-2 h-2 bg-green-500 animate-pulse" />
            지금 바로 무료로 시작
          </div>

          <h1 className="text-5xl md:text-[78px] font-black leading-[1.05] tracking-tight mb-8" style={{ wordSpacing: '-0.1em' }}>
            <span className={`block ${d ? 'text-white' : 'text-black'}`}>영상 한 편에</span>
            <span className={`block ${d ? 'text-white' : 'text-black'}`}>몇 시간을</span>
            <span className="block text-green-500">쓰고 계신가요?</span>
          </h1>

          <p className={`text-[15px] mt-14 mb-20 max-w-xl mx-auto leading-relaxed font-medium ${d ? 'text-gray-400' : 'text-gray-600'}`}>
            대본만 입력하면 장면 구성·이미지·나레이션·자막까지 AI가 완성합니다.<br />
            편집에 쏟던 시간을, 당신의 본업과 아이디어에 사용하세요.
          </p>

          <div className="flex items-center justify-center gap-3">
            <Link href="/dashboard"
              className="bg-green-500 hover:bg-green-400 text-black font-black text-[13px] tracking-tight uppercase px-6 py-2.5 transition-colors">
              시작하기 — 무료
            </Link>
          </div>
        </div>
      </section>

      {/* 푸터 */}
      <footer className={`border-t ${d ? 'border-white/5 bg-black' : 'border-black/5 bg-gray-50'} px-8 py-16 transition-colors duration-200`}>
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500" />
            <span className={`${d ? 'text-white' : 'text-black'} font-medium text-[12px] tracking-normal uppercase`} style={{ fontFamily: "'Montserrat', sans-serif" }}>ClipFlow</span>
          </div>
          <nav className={`flex items-center gap-8 text-[12px] font-medium tracking-tight uppercase ${d ? 'text-gray-500' : 'text-gray-400'}`}>
            <Link href="/dashboard" className={`hover:${d ? 'text-white' : 'text-black'} transition-colors`}>대시보드</Link>
            <a href="mailto:support@clipflow.ai" className={`hover:${d ? 'text-white' : 'text-black'} transition-colors`}>문의</a>
          </nav>
          <span className={`text-[10px] font-medium tracking-widest uppercase ${d ? 'text-gray-600' : 'text-gray-400'}`}>© 2026 ClipFlow. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}
