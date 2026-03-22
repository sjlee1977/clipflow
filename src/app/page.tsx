import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="max-w-3xl w-full text-center space-y-8">
        <div>
          <h1 className="text-5xl font-bold text-white mb-4">
            Clip<span className="text-blue-500">Flow</span>
          </h1>
          <p className="text-xl text-gray-400">
            대본 입력 → AI 이미지 생성 → TTS 음성 → 완성 영상
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            <div className="text-3xl mb-3">✍️</div>
            <h3 className="text-white font-semibold mb-2">대본 입력</h3>
            <p className="text-gray-400 text-sm">주제나 대본을 입력하면 AI가 장면별로 분할해요</p>
          </div>
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            <div className="text-3xl mb-3">🎨</div>
            <h3 className="text-white font-semibold mb-2">AI 이미지 생성</h3>
            <p className="text-gray-400 text-sm">DALL-E 3로 각 장면에 맞는 이미지를 자동 생성해요</p>
          </div>
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            <div className="text-3xl mb-3">🎬</div>
            <h3 className="text-white font-semibold mb-2">영상 렌더링</h3>
            <p className="text-gray-400 text-sm">ElevenLabs TTS + 자막 + 애니메이션으로 완성 영상 제작</p>
          </div>
        </div>

        <Link
          href="/dashboard"
          className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-4 rounded-xl text-lg transition-colors"
        >
          영상 만들기 시작
        </Link>
      </div>
    </main>
  );
}
