'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase-browser';

export default function HomePage() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const supabaseClient = createClient();
    supabaseClient.auth.getSession().then(({ data: { session } }: { data: { session: import('@supabase/supabase-js').Session | null } }) => {
      setUser(session?.user ?? null);
    });
  }, []);

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden">
      {/* 헤더 */}
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-3 border-b border-white/10 bg-black/80 backdrop-blur-sm">
        <a href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="w-4 h-4 bg-[#F97316]" />
          <span className="text-white font-medium text-[15px] tracking-normal uppercase" style={{ fontFamily: "'Montserrat', sans-serif" }}>ClipFlow</span>
        </a>
        <nav className="hidden md:flex items-center gap-8 text-[12px] tracking-tight font-medium uppercase text-gray-400">
          <a href="#features" className="hover:text-white transition-colors">기능</a>
          <a href="#pricing" className="hover:text-white transition-colors">요금제</a>
        </nav>
        <div className="flex items-center gap-3">
          {!user && (
            <Link href="/dashboard" className="hidden md:block text-xs tracking-widest uppercase text-gray-400 hover:text-white transition-colors px-4 py-2">
              로그인
            </Link>
          )}
          <Link href="/dashboard" className="bg-[#F97316] hover:bg-[#EA6C0A] text-white text-[12px] font-black tracking-tight uppercase px-5 py-2 transition-colors">
            {user ? '대시보드' : '무료 시작'}
          </Link>
        </div>
      </header>

      {/* 히어로 */}
      <section className="relative min-h-screen flex items-center justify-center px-6 pt-28 pb-20">
        {/* 배경 그리드 */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:60px_60px]" />

        {/* 플로팅 태그들 */}
        <div className="absolute top-1/4 left-16 hidden lg:flex items-center gap-1.5 bg-green-400 text-black text-[12px] font-bold px-2.5 py-1 animate-bounce" style={{ animationDuration: '3s' }}>
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
          <div className="inline-flex items-center gap-2 border border-[#F97316]/50 px-4 py-1.5 mb-8 text-[13px] tracking-widest text-[#F97316] uppercase">
            <div className="w-2 h-2 bg-[#F97316] animate-pulse" />
            지금 바로 무료로 시작
          </div>

          <h1 className="text-5xl md:text-[78px] font-black leading-[1.05] tracking-tight mb-8" style={{ wordSpacing: '-0.1em' }}>
            <span className="block text-white">영상 한 편에</span>
            <span className="block text-white">몇 시간을</span>
            <span className="block text-[#F97316]">쓰고 계신가요?</span>
          </h1>

          <p className="text-gray-400 text-[15px] mt-14 mb-20 max-w-xl mx-auto leading-relaxed font-medium">
            대본만 입력하면 장면 구성·이미지·나레이션·자막까지 AI가 완성합니다.<br />
            편집에 쏟던 시간을, 당신의 본업과 아이디어에 사용하세요.
          </p>

          <div className="flex items-center justify-center gap-3">
            <Link href="/dashboard"
              className="bg-[#F97316] hover:bg-[#EA6C0A] text-white font-black text-[13px] tracking-tight uppercase px-6 py-2.5 transition-colors">
              시작하기 — 무료
            </Link>
          </div>
        </div>
      </section>

      {/* 푸터 */}
      <footer className="border-t border-white/5 px-8 py-16 bg-black">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-[#F97316]" />
            <span className="text-white font-medium text-[12px] tracking-normal uppercase" style={{ fontFamily: "'Montserrat', sans-serif" }}>ClipFlow</span>
          </div>
          <nav className="flex items-center gap-8 text-[12px] font-medium tracking-tight uppercase text-gray-500">
            <Link href="/dashboard" className="hover:text-white transition-colors">대시보드</Link>
            <a href="mailto:support@clipflow.ai" className="hover:text-white transition-colors">문의</a>
          </nav>
          <span className="text-[10px] text-gray-600 font-medium tracking-widest uppercase">© 2026 ClipFlow. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}
