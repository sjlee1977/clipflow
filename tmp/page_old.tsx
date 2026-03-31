import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-black text-white font-mono overflow-hidden">
      {/* ?ㅻ뜑 */}
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-5 border-b border-white/10 bg-black/80 backdrop-blur-sm">
        <a href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="w-4 h-4 bg-yellow-400" />
          <span className="text-white font-bold text-lg tracking-widest uppercase">ClipFlow</span>
        </a>
        <nav className="hidden md:flex items-center gap-8 text-xs tracking-widest uppercase text-gray-400">
          <a href="#features" className="hover:text-white transition-colors">湲곕뒫</a>
          <a href="#how" className="hover:text-white transition-colors">?묐룞 諛⑹떇</a>
          <a href="#pricing" className="hover:text-white transition-colors">?붽툑??/a>
        </nav>
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="hidden md:block text-xs tracking-widest uppercase text-gray-400 hover:text-white transition-colors px-4 py-2">
            濡쒓렇??          </Link>
          <Link href="/dashboard" className="bg-yellow-400 hover:bg-yellow-300 text-black text-xs font-bold tracking-widest uppercase px-4 py-2 transition-colors">
            臾대즺 ?쒖옉
          </Link>
        </div>
      </header>

      {/* ?덉뼱濡?*/}
      <section className="relative min-h-screen flex items-center justify-center px-6 pt-20">
        {/* 諛곌꼍 洹몃━??*/}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:60px_60px]" />

        {/* ?뚮줈???쒓렇??*/}
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

        {/* 硫붿씤 ?띿뒪??*/}
        <div className="relative text-center max-w-5xl mx-auto">
          <div className="inline-flex items-center gap-2 border border-yellow-400/50 px-4 py-1.5 mb-8 text-xs tracking-widest text-yellow-400 uppercase">
            <div className="w-2 h-2 bg-yellow-400 animate-pulse" />
            吏湲?諛붾줈 臾대즺濡??쒖옉 // ?좎슜移대뱶 遺덊븘??          </div>

          <h1 className="text-6xl md:text-8xl font-black uppercase leading-none tracking-tighter mb-4">
            <span className="block text-white">?꾩씠?붿뼱瑜?/span>
            <span className="block text-white">?곸긽?쇰줈.</span>
            <span className="block text-yellow-400">60珥??덉뿉.</span>
          </h1>

          <p className="text-gray-400 text-sm md:text-base mt-8 mb-12 max-w-xl mx-auto leading-loose">
            ?몄쭛 ?ㅽ궗 ?놁씠???꾨줈湲??곸긽??留뚮뱶?몄슂.<br />
            ?蹂몃쭔 ?낅젰?섎㈃ AI媛 ?λ㈃ 援ъ꽦遺???대?吏 ?앹꽦,<br />
            ?섎젅?댁뀡, ?먮쭑源뚯? ?꾨? ?먮룞?쇰줈 ?꾩꽦?⑸땲??
          </p>

          <div className="flex items-center justify-center gap-3">
            <Link href="/dashboard"
              className="bg-yellow-400 hover:bg-yellow-300 text-black font-bold text-xs tracking-widest uppercase px-6 py-2.5 transition-colors">
              ?쒖옉?섍린 ??臾대즺
            </Link>
            <a href="#how"
              className="text-white/40 hover:text-white/80 text-xs tracking-widest uppercase transition-colors">
              ?묐룞 諛⑹떇 蹂닿린 ??            </a>
          </div>
        </div>
      </section>

      {/* ?묐룞 諛⑹떇 */}
      <section id="how" className="py-32 px-6 border-t border-white/10">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-20">
            <p className="text-yellow-400 text-xs tracking-widest uppercase mb-4">// HOW IT WORKS</p>
            <h2 className="text-4xl md:text-5xl font-black uppercase">3?④퀎濡??꾩꽦</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-white/10">
            {[
              { num: '01', title: '?蹂??낅젰', desc: '二쇱젣???蹂몄쓣 ?낅젰?섎㈃ AI媛 5~8媛??λ㈃?쇰줈 ?먮룞 遺꾪븷?⑸땲??', tag: 'SCRIPT' },
              { num: '02', title: 'AI ?앹꽦', desc: '媛??λ㈃??留욌뒗 ?대?吏瑜?AI媛 ?앹꽦?섍퀬 ElevenLabs TTS濡??뚯꽦???⑹꽦?⑸땲??', tag: 'GENERATE' },
              { num: '03', title: '?곸긽 ?꾩꽦', desc: 'Ken Burns ?④낵 + ?먮쭑 + ?ㅻ뵒?ㅺ? ?⑹퀜吏??꾩꽦 ?곸긽???ㅼ슫濡쒕뱶?⑸땲??', tag: 'EXPORT' },
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

      {/* 湲곕뒫 */}
      <section id="features" className="py-32 px-6 border-t border-white/10">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-20">
            <p className="text-yellow-400 text-xs tracking-widest uppercase mb-4">// FEATURES</p>
            <h2 className="text-4xl md:text-5xl font-black uppercase">紐⑤뱺 湲곕뒫</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-white/10">
            {[
              { label: '8媛吏 ?ㅽ???, sub: '?곹솕쨌?좊땲쨌3D쨌?꾩븘瑜??? },
              { label: '罹먮┃???쇨???, sub: '?ъ쭊 ?낅줈?쒕줈 罹먮┃???좎?' },
              { label: 'Ken Burns', sub: '以뙿룻뙣???곸긽 ?④낵' },
              { label: '?먮룞 ?먮쭑', sub: 'SRT ?먮쭑 ?먮룞 ?쎌엯' },
              { label: 'TTS 6醫?紐⑹냼由?, sub: 'ElevenLabs ?ㅺ뎅?? },
              { label: '9:16 / 16:9', sub: '?쇱툩쨌?좏뒠釉?紐⑤몢 吏?? },
              { label: 'AI ?λ㈃ 遺꾪븷', sub: 'DeepSeek / Gemini / GPT' },
              { label: 'S3 ?먮룞 ?낅줈??, sub: '?꾩꽦 ?곸긽 ?대씪?곕뱶 ??? },
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
            <span className="block">吏湲?諛붾줈</span>
            <span className="block text-yellow-400">?쒖옉?섏꽭??</span>
          </h2>
          <Link href="/dashboard"
            className="inline-block bg-yellow-400 hover:bg-yellow-300 text-black font-bold text-xs tracking-widest uppercase px-6 py-2.5 transition-colors">
            臾대즺濡??곸긽 留뚮뱾湲?          </Link>
        </div>
      </section>

      {/* ?명꽣 */}
      <footer className="border-t border-white/10 px-8 py-6 flex items-center justify-between text-xs text-gray-600 tracking-widest uppercase">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-yellow-400" />
          <span>ClipFlow</span>
        </div>
        <span>짤 2026 All rights reserved.</span>
      </footer>
    </div>
  );
}
