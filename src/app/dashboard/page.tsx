'use client';

import { useState, useRef } from 'react';

type Status = 'idle' | 'previewing' | 'preview' | 'rendering' | 'done' | 'error';

type PreviewScene = {
  text: string;
  imageUrl: string;
};

const VOICES = [
  { id: 'Kore', label: '코레 (한국어 여성)' },
  { id: 'Charon', label: '카론 (남성, 차분)' },
  { id: 'Fenrir', label: '펜리르 (남성, 강인)' },
  { id: 'Aoede', label: '아오에데 (여성, 부드러움)' },
  { id: 'Puck', label: '퍽 (중성, 활발)' },
  { id: 'Orbit', label: '오빗 (남성, 전문적)' },
];

const IMAGE_STYLES = [
  { id: 'cinematic', label: '🎬 실사 영화', prompt: 'cinematic photography, photorealistic, dramatic lighting, film grain' },
  { id: 'anime', label: '🎨 애니메이션', prompt: 'anime illustration style, vibrant colors, cel shading, manga inspired' },
  { id: 'watercolor', label: '🖌️ 수채화', prompt: 'watercolor painting style, soft brushstrokes, artistic, dreamy' },
  { id: '3d', label: '✨ 3D 렌더링', prompt: '3D rendered, octane render, volumetric lighting, highly detailed' },
  { id: 'documentary', label: '📹 다큐멘터리', prompt: 'documentary photography style, natural light, realistic, journalistic' },
];

export default function DashboardPage() {
  const [script, setScript] = useState('');
  const [voice, setVoice] = useState('Kore');
  const [imageStyle, setImageStyle] = useState('cinematic');
  const [characterFile, setCharacterFile] = useState<File | null>(null);
  const [characterPreview, setCharacterPreview] = useState('');

  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');
  const [scenes, setScenes] = useState<PreviewScene[]>([]);
  const [videoUrl, setVideoUrl] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleCharacterUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCharacterFile(file);
    setCharacterPreview(URL.createObjectURL(file));
  }

  async function handlePreview() {
    if (!script.trim()) return;
    setStatus('previewing');
    setError('');
    setScenes([]);

    try {
      let characterBase64 = '';
      let characterMimeType = '';
      if (characterFile) {
        const arrayBuffer = await characterFile.arrayBuffer();
        characterBase64 = Buffer.from(arrayBuffer).toString('base64');
        characterMimeType = characterFile.type;
      }

      const styleDef = IMAGE_STYLES.find((s) => s.id === imageStyle);

      const res = await fetch('/api/generate-scenes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          script,
          imageStylePrompt: styleDef?.prompt ?? '',
          characterBase64,
          characterMimeType,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '장면 생성 실패');

      setScenes(data.scenes);
      setStatus('preview');
    } catch (err: unknown) {
      setStatus('error');
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다');
    }
  }

  async function handleRender() {
    setStatus('rendering');
    setError('');

    try {
      const res = await fetch('/api/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenes, voice }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '영상 생성 실패');

      setVideoUrl(data.videoUrl);
      setStatus('done');
    } catch (err: unknown) {
      setStatus('error');
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다');
    }
  }

  function updateSceneText(index: number, text: string) {
    setScenes((prev) => prev.map((s, i) => (i === index ? { ...s, text } : s)));
  }

  const isProcessing = status === 'previewing' || status === 'rendering';

  return (
    <main className="min-h-screen px-4 py-10">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <a href="/" className="text-gray-500 hover:text-white transition-colors text-sm">← 홈</a>
          <h1 className="text-2xl font-bold text-white">영상 만들기</h1>
        </div>

        {/* 설정 영역 — 미리보기 전에만 표시 */}
        {(status === 'idle' || status === 'previewing' || status === 'error') && (
          <>
            {/* 대본 입력 */}
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
              <label className="block text-white font-semibold mb-3">대본 또는 주제 입력</label>
              <textarea
                value={script}
                onChange={(e) => setScript(e.target.value)}
                placeholder="예: 인공지능이 세상을 바꾸고 있습니다. 의료, 교육, 교통 분야에서 AI는..."
                className="w-full h-40 bg-gray-800 text-white rounded-lg p-4 border border-gray-700 focus:border-blue-500 focus:outline-none resize-none text-sm"
                disabled={isProcessing}
              />
              <p className="text-gray-500 text-sm mt-2">{script.length}자</p>
            </div>

            {/* 이미지 스타일 */}
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
              <label className="block text-white font-semibold mb-3">이미지 스타일</label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {IMAGE_STYLES.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setImageStyle(s.id)}
                    disabled={isProcessing}
                    className={`p-3 rounded-lg border text-sm text-left transition-colors ${
                      imageStyle === s.id
                        ? 'border-purple-500 bg-purple-950 text-purple-300'
                        : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 캐릭터 업로드 */}
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
              <label className="block text-white font-semibold mb-1">캐릭터 업로드 (선택)</label>
              <p className="text-gray-500 text-sm mb-4">업로드하면 모든 장면에 해당 캐릭터가 일관되게 등장해요</p>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessing}
                  className="px-4 py-2 bg-gray-800 border border-gray-700 hover:border-gray-500 text-gray-300 rounded-lg text-sm transition-colors"
                >
                  이미지 선택
                </button>
                {characterPreview && (
                  <div className="relative">
                    <img src={characterPreview} alt="캐릭터" className="w-16 h-16 rounded-lg object-cover border border-gray-600" />
                    <button
                      onClick={() => { setCharacterFile(null); setCharacterPreview(''); }}
                      className="absolute -top-2 -right-2 w-5 h-5 bg-red-600 rounded-full text-white text-xs flex items-center justify-center"
                    >
                      ×
                    </button>
                  </div>
                )}
                {!characterPreview && <span className="text-gray-600 text-sm">선택된 파일 없음</span>}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleCharacterUpload} className="hidden" />
            </div>

            {/* 장면 미리보기 생성 버튼 */}
            <button
              onClick={handlePreview}
              disabled={!script.trim() || isProcessing}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold py-4 rounded-xl transition-colors text-lg"
            >
              {status === 'previewing' ? (
                <span className="flex items-center justify-center gap-3">
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                  장면 분석 및 이미지 생성 중...
                </span>
              ) : '장면 미리보기 생성'}
            </button>
          </>
        )}

        {/* 오류 */}
        {status === 'error' && (
          <div className="bg-red-950 rounded-xl p-6 border border-red-800">
            <p className="text-red-400">{error}</p>
            <button onClick={() => setStatus('idle')} className="mt-3 text-red-400 hover:text-red-300 text-sm underline">
              다시 시도
            </button>
          </div>
        )}

        {/* 미리보기 + 편집 단계 */}
        {(status === 'preview' || status === 'rendering' || status === 'done') && scenes.length > 0 && (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-white font-semibold text-lg">장면 미리보기 ({scenes.length}개)</h2>
              {status === 'preview' && (
                <button
                  onClick={() => { setStatus('idle'); setScenes([]); setVideoUrl(''); }}
                  className="text-gray-500 hover:text-gray-300 text-sm transition-colors"
                >
                  ← 처음으로
                </button>
              )}
            </div>

            <div className="space-y-4">
              {scenes.map((scene, i) => (
                <div key={i} className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden flex gap-0 flex-col sm:flex-row">
                  {/* 이미지 */}
                  <div className="sm:w-48 shrink-0">
                    <img
                      src={scene.imageUrl}
                      alt={`장면 ${i + 1}`}
                      className="w-full h-40 sm:h-full object-cover"
                    />
                  </div>
                  {/* 텍스트 편집 */}
                  <div className="flex-1 p-4 flex flex-col justify-between gap-3">
                    <div>
                      <p className="text-gray-500 text-xs mb-2">장면 {i + 1} — 자막 텍스트</p>
                      <textarea
                        value={scene.text}
                        onChange={(e) => updateSceneText(i, e.target.value)}
                        disabled={status !== 'preview'}
                        className="w-full h-24 bg-gray-800 text-white rounded-lg p-3 border border-gray-700 focus:border-blue-500 focus:outline-none resize-none text-sm disabled:opacity-60"
                      />
                    </div>
                    <p className="text-gray-600 text-xs">{scene.text.length}자</p>
                  </div>
                </div>
              ))}
            </div>

            {/* 목소리 선택 */}
            {status === 'preview' && (
              <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
                <label className="block text-white font-semibold mb-3">목소리 선택</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {VOICES.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => setVoice(v.id)}
                      className={`p-3 rounded-lg border text-sm text-left transition-colors ${
                        voice === v.id
                          ? 'border-blue-500 bg-blue-950 text-blue-300'
                          : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'
                      }`}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 영상 생성 버튼 */}
            {status === 'preview' && (
              <button
                onClick={handleRender}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 rounded-xl transition-colors text-lg"
              >
                영상 생성
              </button>
            )}

            {/* 렌더링 중 */}
            {status === 'rendering' && (
              <div className="bg-gray-900 rounded-xl p-6 border border-blue-800">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-blue-400">음성 생성 및 영상 렌더링 중... (수 분 소요될 수 있습니다)</p>
                </div>
              </div>
            )}
          </>
        )}

        {/* 완성 영상 */}
        {status === 'done' && videoUrl && (
          <div className="bg-gray-900 rounded-xl p-6 border border-green-800">
            <h2 className="text-white font-semibold mb-4">완성 영상</h2>
            <video src={videoUrl} controls className="w-full rounded-lg" />
            <div className="flex gap-3 mt-4">
              <a
                href={videoUrl}
                download
                className="inline-block bg-green-600 hover:bg-green-700 text-white font-semibold px-6 py-3 rounded-lg transition-colors"
              >
                다운로드
              </a>
              <button
                onClick={() => { setStatus('idle'); setScenes([]); setVideoUrl(''); setScript(''); }}
                className="inline-block bg-gray-700 hover:bg-gray-600 text-white font-semibold px-6 py-3 rounded-lg transition-colors"
              >
                새 영상 만들기
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
