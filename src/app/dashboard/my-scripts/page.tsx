'use client';

import { useRouter } from 'next/navigation';

export default function MyScriptsPage() {
  const router = useRouter();

  return (
    <div className="max-w-3xl mx-auto">
      <div className="relative mt-10 mb-8">
        <div className="absolute top-0 left-0 -translate-y-full inline-flex items-center gap-1.5 px-4 py-1.5 border-t border-l border-r border-white/15 bg-[#0a0a0a]">
          <span className="w-1 h-1 bg-white/40 rounded-full" />
          <span className="text-white/50 text-[13px] font-mono tracking-widest uppercase">Library</span>
        </div>
        <div className="border border-white/10 px-5 py-4 bg-white/[0.015] flex items-center justify-between">
          <div>
            <p className="text-white/80 text-[14px] font-mono font-bold">내 대본</p>
            <p className="text-white/35 text-[12px] font-mono mt-0.5">저장된 대본을 관리합니다.</p>
          </div>
          <button
            onClick={() => router.push('/dashboard/script')}
            className="px-4 py-2 bg-yellow-400 hover:bg-yellow-300 text-black font-bold text-[12px] font-mono transition-colors"
          >
            + 대본 만들기
          </button>
        </div>
      </div>

      {/* 빈 상태 */}
      <div className="flex flex-col items-center justify-center py-24 border border-white/5 bg-white/[0.01]">
        <div className="w-12 h-12 border border-white/10 flex items-center justify-center mb-5">
          <span className="text-white/20 text-2xl">☰</span>
        </div>
        <p className="text-white/40 text-[14px] font-mono mb-1">저장된 대본이 없습니다</p>
        <p className="text-white/20 text-[12.5px] font-mono mb-6">대본 만들기에서 생성한 대본이 여기에 표시됩니다.</p>
        <button
          onClick={() => router.push('/dashboard/script')}
          className="px-5 py-2.5 border border-white/15 text-white/50 hover:text-white hover:border-white/30 text-[13px] font-mono transition-colors"
        >
          대본 만들기 →
        </button>
      </div>
    </div>
  );
}
