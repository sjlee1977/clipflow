'use client';

import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-black text-white font-mono selection:bg-yellow-400 selection:text-black">
      {/* 네비게이션 */}
      <nav className="fixed top-0 w-full z-50 px-6 py-6 flex items-center justify-between backdrop-blur-sm bg-black/50 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-3.5 h-3.5 bg-yellow-400" />
          <span className="font-black text-lg tracking-[0.2em] uppercase">ClipFlow</span>
        </div>
        <div className="flex items-center gap-8 text-[13px] tracking-widest uppercase text-white/40">
          <Link href="/login" className="hover:text-yellow-400 transition-colors">Login</Link>
          <Link href="/login" className="px-5 py-2 border border-white/20 hover:border-yellow-400 hover:text-yellow-400 transition-colors">Get Started</Link>
        </div>
      </nav>

      {/* 히어로 섹션 */}
      <header className="relative pt-40 pb-20 px-6 overflow-hidden">
        {/* 배경 그리드 및 그라데이션 */}
        <div className="absolute inset-0 z-0 opacity-20" 
             style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.05) 1px, transparent 0)', backgroundSize: '40px 40px' }} />
        <div className="absolute top-1/4 -right-1/4 w-[600px] h-[600px] bg-yellow-400/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-1/4 -left-1/4 w-[600px] h-[600px] bg-cyan-400/5 blur-[120px] rounded-full" />

        <div className="relative z-10 max-w-5xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 border border-yellow-400/30 mb-8">
            <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-pulse" />
            <span className="text-yellow-400 text-[11px] tracking-[0.2em] uppercase font-bold">Next-Gen Video Generation</span>
          </div>

          <h1 className="text-6xl md:text-8xl font-black tracking-tighter leading-[0.9] mb-8">
            AI <span className="text-yellow-400">VIDEO</span><br />
            PRODUCTION<br />
            REDEFINED.
          </h1>

          <p className="max-w-xl text-white/40 text-lg leading-relaxed mb-12 font-medium">
            아이디어만 있으면 됩니다. 대본 작성부터 이미지 생성, 나레이션, 비디오 변환까지. ClipFlow가 모든 과정을 자동화합니다.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 mb-20">
            <Link href="/login" 
              className="group relative px-10 py-5 bg-yellow-400 text-black font-black text-sm tracking-widest uppercase transition-transform hover:-translate-y-1 hover:shadow-[0_10px_40px_rgba(250,204,21,0.3)]">
              시작하기 →
            </Link>
            <Link href="#features" 
              className="px-10 py-5 border border-white/10 text-white/40 font-black text-sm tracking-widest uppercase hover:bg-white/5 hover:text-white transition-all">
              기능 보기
            </Link>
          </div>

          {/* 대시보드 미리보기 등 이미지 들어갈 자리 */}
          <div className="relative border border-white/10 bg-white/[0.02] p-4 group">
            <div className="absolute -top-px -left-px w-10 h-10 border-t border-l border-yellow-400" />
            <div className="absolute -bottom-px -right-px w-10 h-10 border-b border-r border-yellow-400" />
            <div className="aspect-[16/9] w-full bg-black overflow-hidden">
               {/* 여기에 프로덕트 이미지를 넣거나, CSS로 스켈레톤 디자인 */}
               <div className="w-full h-full flex items-center justify-center border border-white/5">
                 <div className="text-center">
                    <div className="w-20 h-20 border border-yellow-400/20 mx-auto mb-4 flex items-center justify-center">
                      <div className="w-10 h-10 bg-yellow-400/5 transition-transform group-hover:scale-110" />
                    </div>
                    <p className="text-white/10 text-[11px] tracking-widest uppercase">ClipFlow Studio Interface Preview</p>
                 </div>
               </div>
            </div>
          </div>
        </div>
      </header>

      {/* 프로세스 섹션 */}
      <section id="features" className="py-32 px-6 border-t border-white/5 relative">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-3 gap-12">
            {[
              { step: '01', title: 'SCRIPT', desc: '주제만 입력하세요. AI가 최적의 영상 대본을 구성합니다.' },
              { step: '02', title: 'VISUALS', desc: '대본의 각 장면에 어울리는 초고화질 이미지를 즉시 생성합니다.' },
              { step: '03', title: 'PRODUCE', desc: '나레이션과 배경음악이 입혀진 최종 영상을 단 몇 분 만에 완성합니다.' },
            ].map((f, i) => (
              <div key={i} className="group">
                <span className="block text-yellow-400 font-black text-4xl mb-6 opacity-30 group-hover:opacity-100 transition-opacity tabular-nums">{f.step}</span>
                <h3 className="text-xl font-black tracking-widest uppercase mb-4">{f.title}</h3>
                <p className="text-white/40 leading-relaxed text-sm">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 푸터 */}
      <footer className="py-20 px-6 border-t border-white/5 bg-[#050505]">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-start gap-12">
          <div>
            <div className="flex items-center gap-2 mb-6">
              <div className="w-3 h-3 bg-yellow-400" />
              <span className="font-black text-base tracking-[0.2em] uppercase">ClipFlow</span>
            </div>
            <p className="text-white/20 text-xs">© 2024 ClipFlow. All rights reserved.</p>
          </div>
          <div className="grid grid-cols-2 gap-20">
            <div className="space-y-4">
              <h4 className="text-white/60 text-[11px] font-bold tracking-widest uppercase">Product</h4>
              <ul className="space-y-2 text-white/30 text-[13px]">
                <li><Link href="/dashboard" className="hover:text-yellow-400 transition-colors">Studio</Link></li>
                <li><Link href="/dashboard/script" className="hover:text-yellow-400 transition-colors">Script Engine</Link></li>
              </ul>
            </div>
            <div className="space-y-4">
              <h4 className="text-white/60 text-[11px] font-bold tracking-widest uppercase">Legal</h4>
              <ul className="space-y-2 text-white/30 text-[13px]">
                <li><Link href="#" className="hover:text-yellow-400 transition-colors">Privacy</Link></li>
                <li><Link href="#" className="hover:text-yellow-400 transition-colors">Terms</Link></li>
              </ul>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
