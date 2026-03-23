import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-black text-white font-mono overflow-hidden">
      {/* 헤더 */}
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-5 border-b border-white/10 bg-black/80 backdrop-blur-sm">
        <a href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="w-4 h-4 bg-yellow-400" />
          <span className="text-white font-bold text-lg tracking-widest uppercase">ClipFlow</span>
        </a>
        <nav className="hidden md:flex items-center gap-8 text-xs tracking-widest uppercase text-gray-400">
          <a href="#features" className="hover:text-white transition-colors">기능</a>
          <a href="#how" className="hover:text-white transition-colors">작동 방식</a>
          <a href="#pricing" className="hover:text-white transition-colors">요금제</a>
        </nav>
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="hidden md:block text-xs tracking-widest uppercase text-gray-400 hover:text-white transition-colors px-4 py-2">
            로그인
          </Link>
          <Link href="/dashboard" className="bg-yellow-400 hover:bg-yellow-300 text-black text-xs font-bold tracking-widest uppercase px-4 py-2 transition-colors">
            무료 시작
          </Link>
        </div>
      </header>

      {/* 히어로 */}
      <section className="relative min-h-screen flex items-center justify-center px-6 pt-20">
        {/* 배경 그리드 */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:60px_60px]" />

        {/* 플로팅 태그들 */}
        <div className="absolute top-1/4 left-16 hidden lg:flex items-center gap-1.5 bg-green-400 text-black text-xs font-bold px-2.5 py-1 animate-bounce" style={{ animationDuration: '3s' }}>
          <span className="w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-r-[7px] border-r-black -rotate-45" />
          AI_GEN
        </div>
        <div className="absolute top-1/3 left-24 hidden lg:flex items-center gap-1.5 bg-blue-400 text-black text-xs font-bold px-2.5 py-1 animate-bounce" style={{ animationDuration: '4s', animationDelay: '1s' }}>
          <span className="w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-r-[7px] border-r-black -rotate-45" />
          TTS_ON
        </div>
        <div className="absolute top-1/2 right-20 hidden lg:flex items-center gap-1.5 bg-orange-400 text-black text-xs font-bold px-2.5 py-1 animate-bounce" style={{ animationDuration: '3.5s', animationDelay: '0.5s' }}>
          <span className="w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-r-[7px] border-r-black -rotate-45" />
          VIDEO_OUT
        </div>
        <div className="absolute top-2/3 right-32 hidden lg:flex items-center gap-1.5 bg-pink-400 text-black text-xs font-bold px-2.5 py-1 animate-bounce" style={{ animationDuration: '4.5s', animationDelay: '1.5s' }}>
          <span className="w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-r-[7px] border-r-black -rotate-45" />
          AUTO_EDIT
        </div>

        {/* 메인 텍스트 */}
        <div className="relative text-center max-w-5xl mx-auto">
          <div className="inline-flex items-center gap-2 border border-yellow-400/50 px-4 py-1.5 mb-8 text-xs tracking-widest text-yellow-400 uppercase">
            <div className="w-2 h-2 bg-yellow-400 animate-pulse" />
            지금 바로 무료로 시작 // 신용카드 불필요
          </div>

          <h1 className="text-6xl md:text-8xl font-black uppercase leading-none tracking-tighter mb-4">
            <span className="block text-white">아이디어를</span>
            <span className="block text-white">영상으로.</span>
            <span className="block text-yellow-400">60초 안에.</span>
          </h1>

          <p className="text-gray-400 text-sm md:text-base mt-8 mb-12 max-w-xl mx-auto leading-loose">
            편집 스킬 없이도 프로급 영상을 만드세요.<br />
            대본만 입력하면 AI가 장면 구성부터 이미지 생성,<br />
            나레이션, 자막까지 전부 자동으로 완성합니다.
          </p>

          <div className="flex items-center justify-center gap-3">
            <Link href="/dashboard"
              className="bg-yellow-400 hover:bg-yellow-300 text-black font-bold text-xs tracking-widest uppercase px-6 py-2.5 transition-colors">
              시작하기 — 무료
            </Link>
            <a href="#how"
              className="text-white/40 hover:text-white/80 text-xs tracking-widest uppercase transition-colors">
              작동 방식 보기 →
            </a>
          </div>
        </div>
      </section>

      {/* 작동 방식 */}
      <section id="how" className="py-32 px-6 border-t border-white/10">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-20">
            <p className="text-yellow-400 text-xs tracking-widest uppercase mb-4">// HOW IT WORKS</p>
            <h2 className="text-4xl md:text-5xl font-black uppercase">3단계로 완성</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-white/10">
            {[
              { num: '01', title: '대본 입력', desc: '주제나 대본을 입력하면 AI가 5~8개 장면으로 자동 분할합니다.', tag: 'SCRIPT' },
              { num: '02', title: 'AI 생성', desc: '각 장면에 맞는 이미지를 AI가 생성하고 ElevenLabs TTS로 음성을 합성합니다.', tag: 'GENERATE' },
              { num: '03', title: '영상 완성', desc: 'Ken Burns 효과 + 자막 + 오디오가 합쳐진 완성 영상을 다운로드합니다.', tag: 'EXPORT' },
            ].map((item) => (
              <div key={item.num} className="bg-black p-10 group hover:bg-white/5 transition-colors">
                <div className="flex items-center justify-between mb-8">
                  <span className="text-5xl font-black text-white/10 group-hover:text-yellow-400/30 transition-colors">{item.num}</span>
                  <span className="text-xs text-yellow-400 tracking-widest border border-yellow-400/30 px-2 py-1">{item.tag}</span>
                </div>
                <h3 className="text-xl font-black uppercase mb-3">{item.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 기능 */}
      <section id="features" className="py-32 px-6 border-t border-white/10">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-20">
            <p className="text-yellow-400 text-xs tracking-widest uppercase mb-4">// FEATURES</p>
            <h2 className="text-4xl md:text-5xl font-black uppercase">모든 기능</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-white/10">
            {[
              { label: '8가지 스타일', sub: '영화·애니·3D·누아르 등' },
              { label: '캐릭터 일관성', sub: '사진 업로드로 캐릭터 유지' },
              { label: 'Ken Burns', sub: '줌·패닝 영상 효과' },
              { label: '자동 자막', sub: 'SRT 자막 자동 삽입' },
              { label: 'TTS 6종 목소리', sub: 'ElevenLabs 다국어' },
              { label: '9:16 / 16:9', sub: '쇼츠·유튜브 모두 지원' },
              { label: 'AI 장면 분할', sub: 'DeepSeek / Gemini / GPT' },
              { label: 'S3 자동 업로드', sub: '완성 영상 클라우드 저장' },
            ].map((f) => (
              <div key={f.label} className="bg-black p-6 hover:bg-white/5 transition-colors">
                <p className="text-white font-bold text-sm mb-1">{f.label}</p>
                <p className="text-gray-600 text-xs">{f.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-32 px-6 border-t border-white/10">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-5xl md:text-7xl font-black uppercase leading-none mb-8">
            <span className="block">지금 바로</span>
            <span className="block text-yellow-400">시작하세요.</span>
          </h2>
          <Link href="/dashboard"
            className="inline-block bg-yellow-400 hover:bg-yellow-300 text-black font-bold text-xs tracking-widest uppercase px-6 py-2.5 transition-colors">
            무료로 영상 만들기
          </Link>
        </div>
      </section>

      {/* 푸터 */}
      <footer className="border-t border-white/10 px-8 py-6 flex items-center justify-between text-xs text-gray-600 tracking-widest uppercase">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-yellow-400" />
          <span>ClipFlow</span>
        </div>
        <span>© 2026 All rights reserved.</span>
      </footer>
    </div>
  );
}
