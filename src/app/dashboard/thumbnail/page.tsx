'use client';

import { useState, useEffect } from 'react';
import { Wand2, Loader2, Download, RefreshCw, Copy, Check, ExternalLink, FileText, X } from 'lucide-react';

type ThumbnailType = 'youtube' | 'blog';
type Style = 'youtube_bold' | 'youtube_face' | 'blog_clean' | 'blog_dark' | 'infographic';

const STYLES: { value: Style; label: string; desc: string; for: ThumbnailType[] }[] = [
  { value: 'youtube_bold', label: '임팩트 볼드', desc: '강렬한 색감, 텍스트 공간', for: ['youtube'] },
  { value: 'youtube_face', label: '리액션 페이스', desc: '표정 클로즈업 구도', for: ['youtube'] },
  { value: 'blog_clean', label: '클린 미니멀', desc: '깔끔한 배경, 텍스트 공간', for: ['blog', 'youtube'] },
  { value: 'blog_dark', label: '다크 에디토리얼', desc: '무드 있는 다크 톤', for: ['blog', 'youtube'] },
  { value: 'infographic', label: '인포그래픽', desc: '데이터 시각화 스타일', for: ['blog', 'youtube'] },
];

type GeneratedImage = { url: string; prompt: string };
type ScriptAnalysis = { title: string; mood: string; visuals: string; hook: string };

export default function ThumbnailPage() {
  const [thumbnailType, setThumbnailType] = useState<ThumbnailType>('youtube');
  const [title, setTitle] = useState('');
  const [style, setStyle] = useState<Style>('youtube_bold');
  const [customPrompt, setCustomPrompt] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [error, setError] = useState('');
  const [copiedPrompt, setCopiedPrompt] = useState<number | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  // 대본 연동 상태
  const [fromScript, setFromScript] = useState(false);
  const [scriptPreview, setScriptPreview] = useState('');
  const [scriptAnalysis, setScriptAnalysis] = useState<ScriptAnalysis | null>(null);

  // 마운트 시 sessionStorage에서 대본 확인
  useEffect(() => {
    const savedScript = sessionStorage.getItem('clipflow_thumbnail_script');
    const savedTopic = sessionStorage.getItem('clipflow_thumbnail_topic');
    if (savedScript) {
      sessionStorage.removeItem('clipflow_thumbnail_script');
      sessionStorage.removeItem('clipflow_thumbnail_topic');
      setFromScript(true);
      setScriptPreview(savedScript.slice(0, 120) + (savedScript.length > 120 ? '...' : ''));
      if (savedTopic) setTitle(savedTopic);
      // script를 sessionStorage 대신 로컬 ref로 보관
      sessionStorage.setItem('clipflow_thumbnail_script_tmp', savedScript);
    }
  }, []);

  const availableStyles = STYLES.filter(s => s.for.includes(thumbnailType));

  function clearScript() {
    setFromScript(false);
    setScriptPreview('');
    setScriptAnalysis(null);
    sessionStorage.removeItem('clipflow_thumbnail_script_tmp');
  }

  async function handleGenerate() {
    const script = sessionStorage.getItem('clipflow_thumbnail_script_tmp') ?? '';
    if (!title.trim() && !customPrompt.trim() && !script) return;

    setGenerating(true);
    setError('');
    setImages([]);
    setScriptAnalysis(null);

    try {
      const body: Record<string, string | undefined> = {
        title: title.trim(),
        style,
        thumbnailType,
        customPrompt: useCustom ? customPrompt.trim() : undefined,
      };
      if (script) body.script = script;

      const res = await fetch('/api/thumbnail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '생성 실패');
      setImages(data.images ?? []);
      if (data.images?.length > 0) setSelectedIdx(0);
      if (data.scriptAnalysis) setScriptAnalysis(data.scriptAnalysis);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '썸네일 생성 중 오류');
    } finally {
      setGenerating(false);
    }
  }

  async function handleDownload(url: string, idx: number) {
    if (url.startsWith('data:')) {
      const link = document.createElement('a');
      link.href = url;
      link.download = `thumbnail_${thumbnailType}_${idx + 1}.jpg`;
      link.click();
    } else {
      const res = await fetch(url);
      const blob = await res.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `thumbnail_${thumbnailType}_${idx + 1}.jpg`;
      link.click();
    }
  }

  function handleCopyPrompt(prompt: string, idx: number) {
    navigator.clipboard.writeText(prompt);
    setCopiedPrompt(idx);
    setTimeout(() => setCopiedPrompt(null), 2000);
  }

  const ASPECT = thumbnailType === 'youtube' ? 'aspect-video' : 'aspect-[1.91/1]';
  const SIZE_LABEL = thumbnailType === 'youtube' ? '1280 × 720' : '1200 × 628';

  return (
    <div className="max-w-5xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-6">
        <span className="w-7 h-7 flex items-center justify-center rounded-lg shrink-0" style={{ background: 'rgba(79,142,247,0.06)', border: '1px solid rgba(79,142,247,0.22)', color: '#4f8ef7' }}>
          <FileText size={13} strokeWidth={1.8} />
        </span>
        <span className="text-sm font-semibold text-white">썸네일 생성</span>
      </div>

      {/* 대본 연동 배너 */}
      {fromScript && (
        <div className="mb-5 rounded-xl border border-[#4f8ef7]/20 bg-[#4f8ef7]/5 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <FileText size={14} className="text-[#4f8ef7] shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-[12px] font-bold text-[#4f8ef7] mb-1">대본 기반 생성 모드</p>
                <p className="text-[11px] font-mono text-white/40 leading-relaxed truncate">{scriptPreview}</p>
                <p className="text-[10px] font-mono text-[#4f8ef7]/50 mt-1.5">
                  AI가 대본 전체를 분석해 분위기·핵심 비주얼·감정 키워드를 자동 추출합니다
                </p>
              </div>
            </div>
            <button onClick={clearScript} className="text-white/25 hover:text-white/50 transition-colors shrink-0">
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-5">
        {/* ─── 좌측: 설정 패널 ─── */}
        <div className="space-y-4">
          <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4 space-y-4">
            {/* 타입 선택 */}
            <p className="text-[11px] font-bold text-white/40 uppercase tracking-widest">썸네일 타입</p>
            <div className="grid grid-cols-2 gap-2">
              {([
                { value: 'youtube', label: 'YouTube', desc: '16:9 · 1280×720', icon: '▶' },
                { value: 'blog', label: '블로그', desc: '1.91:1 · 1200×628', icon: '✎' },
              ] as const).map(opt => (
                <button
                  key={opt.value}
                  onClick={() => { setThumbnailType(opt.value); setStyle(opt.value === 'youtube' ? 'youtube_bold' : 'blog_clean'); }}
                  className={`flex flex-col items-center gap-1 p-3 rounded-lg border transition-all ${
                    thumbnailType === opt.value ? 'border-[#4f8ef7]/40 bg-[#4f8ef7]/8 text-white' : 'border-white/8 text-white/40 hover:text-white/60'
                  }`}
                >
                  <span className="text-xl">{opt.icon}</span>
                  <span className="text-[13px] font-bold">{opt.label}</span>
                  <span className="text-[9px] font-mono text-white/25">{opt.desc}</span>
                </button>
              ))}
            </div>

            {/* 제목 입력 */}
            <div>
              <p className="text-[10px] font-mono text-white/30 mb-1.5 uppercase tracking-wider">
                {fromScript ? '영상 제목 (대본에서 자동 추출)' : '영상/포스트 제목'}
              </p>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder={fromScript ? '대본 분석 후 자동 입력됩니다' : '예: 2026년 AI 툴 TOP 10 완벽 정리'}
                className="w-full bg-white/[0.04] border border-white/10 hover:border-white/20 focus:border-[#4f8ef7]/40 rounded-lg px-3 py-2 text-[13px] text-white/80 placeholder-white/20 outline-none transition-colors"
              />
            </div>

            {/* 스타일 선택 */}
            <div>
              <p className="text-[10px] font-mono text-white/30 mb-1.5 uppercase tracking-wider">스타일</p>
              <div className="space-y-1.5">
                {availableStyles.map(s => (
                  <button
                    key={s.value}
                    onClick={() => setStyle(s.value)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border transition-all text-left ${
                      style === s.value ? 'border-[#4f8ef7]/40 bg-[#4f8ef7]/8 text-white' : 'border-white/6 text-white/50 hover:text-white/70 hover:border-white/12'
                    }`}
                  >
                    <span className="text-[12px] font-bold">{s.label}</span>
                    <span className="text-[10px] font-mono text-white/30">{s.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 커스텀 프롬프트 */}
            {!fromScript && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[10px] font-mono text-white/30 uppercase tracking-wider">직접 프롬프트 입력</p>
                  <button
                    onClick={() => setUseCustom(v => !v)}
                    className={`text-[10px] font-mono transition-colors ${useCustom ? 'text-[#4f8ef7]' : 'text-white/30'}`}
                  >
                    {useCustom ? 'ON' : 'OFF'}
                  </button>
                </div>
                {useCustom && (
                  <textarea
                    value={customPrompt}
                    onChange={e => setCustomPrompt(e.target.value)}
                    placeholder="영어로 직접 프롬프트를 입력하세요..."
                    rows={3}
                    className="w-full bg-white/[0.03] border border-white/8 rounded-lg px-3 py-2 text-[12px] text-white/70 font-mono outline-none resize-none focus:border-[#4f8ef7]/30 placeholder-white/20"
                  />
                )}
              </div>
            )}

            {error && <p className="text-red-400/80 text-[12px] font-mono">{error}</p>}

            <button
              onClick={handleGenerate}
              disabled={generating || (!title.trim() && !customPrompt.trim() && !fromScript)}
              className="w-full flex items-center justify-center gap-2 bg-[#4f8ef7] hover:bg-[#0284c7] disabled:opacity-40 text-black font-black text-[13px] uppercase py-2.5 rounded-lg transition-colors"
            >
              {generating ? (
                <><Loader2 size={14} className="animate-spin" />{fromScript ? '대본 분석 중...' : '생성 중...'}</>
              ) : images.length > 0 ? (
                <><RefreshCw size={14} />다시 생성</>
              ) : (
                <><Wand2 size={14} />{fromScript ? '대본 기반 썸네일 생성' : '썸네일 생성'}</>
              )}
            </button>
          </div>

          {/* 대본 분석 결과 */}
          {scriptAnalysis && (
            <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4 space-y-2.5">
              <p className="text-[11px] font-bold text-white/30 uppercase tracking-widest">AI 대본 분석 결과</p>
              {[
                { label: '추출된 제목', value: scriptAnalysis.title },
                { label: '분위기', value: scriptAnalysis.mood },
                { label: '핵심 비주얼', value: scriptAnalysis.visuals },
                { label: '감정 키워드', value: scriptAnalysis.hook },
              ].map(item => (
                <div key={item.label} className="flex gap-2">
                  <span className="text-[10px] font-mono text-white/25 w-20 shrink-0">{item.label}</span>
                  <span className="text-[10px] font-mono text-white/60">{item.value}</span>
                </div>
              ))}
            </div>
          )}

          {/* 사용 방법 안내 */}
          {!fromScript && (
            <div className="rounded-xl border border-white/6 bg-white/[0.01] p-4 space-y-2">
              <p className="text-[11px] font-bold text-white/30 uppercase tracking-widest">사용 방법</p>
              {[
                '설정 페이지에서 fal.ai 또는 Gemini API 키 등록',
                '영상/포스트 제목 입력 → 스타일 선택',
                'AI가 3가지 썸네일 변형 자동 생성',
                '마음에 드는 이미지 다운로드 후 텍스트 오버레이 추가',
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-[9px] font-black text-[#4f8ef7]/50 mt-0.5 shrink-0">{i + 1}</span>
                  <p className="text-[11px] font-mono text-white/30">{step}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ─── 우측: 생성된 이미지 ─── */}
        <div className="space-y-4">
          {generating && (
            <div className="rounded-xl border border-white/8 bg-white/[0.02] flex flex-col items-center justify-center py-24 gap-4">
              <div className="relative w-12 h-12">
                <div className="absolute inset-0 rounded-full border-2 border-[#4f8ef7]/20 animate-ping" />
                <div className="absolute inset-2 rounded-full border-2 border-[#4f8ef7]/40 border-t-[#4f8ef7] animate-spin" />
              </div>
              <div className="text-center">
                <p className="text-[13px] font-bold text-white/60">
                  {fromScript ? 'AI가 대본을 분석하고 최적 썸네일을 생성합니다' : 'AI가 썸네일을 생성하고 있습니다'}
                </p>
                <p className="text-[11px] font-mono text-white/25 mt-1">최대 30초 소요</p>
              </div>
            </div>
          )}

          {!generating && images.length === 0 && (
            <div className="rounded-xl border border-white/6 bg-white/[0.01] flex flex-col items-center justify-center py-24 gap-4">
              <div className={`w-48 ${ASPECT} bg-white/5 rounded-xl flex items-center justify-center border border-white/8`}>
                <p className="text-[11px] font-mono text-white/20">{SIZE_LABEL}</p>
              </div>
              <p className="text-[12px] text-white/20 font-mono">
                {fromScript ? '생성 버튼을 눌러 대본 기반 썸네일을 만드세요' : '제목을 입력하고 생성 버튼을 누르세요'}
              </p>
            </div>
          )}

          {!generating && images.length > 0 && (
            <>
              {selectedIdx !== null && (
                <div className="rounded-xl border border-white/10 overflow-hidden">
                  <div className={`w-full ${ASPECT} relative`}>
                    <img
                      src={images[selectedIdx].url}
                      alt="Selected thumbnail"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2 right-2 flex gap-1.5">
                      <button
                        onClick={() => handleDownload(images[selectedIdx].url, selectedIdx)}
                        className="flex items-center gap-1 bg-black/70 hover:bg-black/90 text-white text-[11px] font-bold px-2.5 py-1.5 rounded-lg transition-colors"
                      >
                        <Download size={12} />다운로드
                      </button>
                      {!images[selectedIdx].url.startsWith('data:') && (
                        <a href={images[selectedIdx].url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 bg-black/70 hover:bg-black/90 text-white text-[11px] font-bold px-2.5 py-1.5 rounded-lg transition-colors"
                        >
                          <ExternalLink size={12} />원본
                        </a>
                      )}
                    </div>
                    <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
                      <span className="bg-black/60 text-white/60 text-[10px] font-mono px-2 py-0.5 rounded">
                        {thumbnailType === 'youtube' ? 'YouTube' : 'Blog'} · {SIZE_LABEL}
                      </span>
                      {fromScript && (
                        <span className="bg-[#4f8ef7]/20 text-[#4f8ef7]/80 text-[10px] font-mono px-2 py-0.5 rounded">
                          대본 기반
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="px-3 py-2 bg-black/30 flex items-start gap-2">
                    <p className="text-[10px] font-mono text-white/30 flex-1 leading-relaxed">{images[selectedIdx].prompt}</p>
                    <button
                      onClick={() => handleCopyPrompt(images[selectedIdx].prompt, selectedIdx)}
                      className="shrink-0 text-white/30 hover:text-white/60 transition-colors"
                    >
                      {copiedPrompt === selectedIdx ? <Check size={12} /> : <Copy size={12} />}
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2">
                {images.map((img, idx) => (
                  <div
                    key={idx}
                    onClick={() => setSelectedIdx(idx)}
                    className={`cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                      selectedIdx === idx ? 'border-[#4f8ef7]/60' : 'border-white/8 hover:border-white/25'
                    }`}
                  >
                    <div className={`w-full ${ASPECT}`}>
                      <img src={img.url} alt={`Thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
                    </div>
                    <div className="px-2 py-1 bg-black/40 flex items-center justify-between">
                      <span className="text-[9px] font-mono text-white/30">변형 {idx + 1}</span>
                      <button
                        onClick={e => { e.stopPropagation(); handleDownload(img.url, idx); }}
                        className="text-white/30 hover:text-white/70 transition-colors"
                      >
                        <Download size={10} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
