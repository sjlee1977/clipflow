'use client';

import { useState, useRef, useCallback } from 'react';
import { IMAGE_MODELS, LLM_MODELS, VIDEO_MODELS } from '@/lib/openrouter';
import { MINIMAX_VOICES } from '@/lib/minimax-tts';
import { GOOGLE_VOICES } from '@/lib/google';
import { supabase } from '@/lib/supabase';

type Status = 'idle' | 'previewing' | 'preview' | 'rendering' | 'done' | 'error';
type Format = 'shorts' | 'landscape';

const IMAGE_STYLES = [
  { id: 'cinematic', label: '영화' },
  { id: 'realistic', label: '실사' },
  { id: 'anime', label: '애니' },
  { id: 'documentary', label: '다큐' },
  { id: '3d', label: '3D' },
  { id: 'watercolor', label: '수채화' },
  { id: 'cartoon', label: '카툰' },
  { id: 'noir', label: '누아르' },
] as const;

type ImageStyle = typeof IMAGE_STYLES[number]['id'];

type PreviewScene = {
  text: string;
  imageUrl: string;
  imagePrompt: string;
  motionPrompt: string;
  videoUrl?: string;
  shouldAnimate?: boolean;
};

/* ── 오른쪽 패널 섹션 (일반) ── */
function PanelSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-white/5 pb-4 mb-4">
      <p className="text-[#17BEBB]/70 text-[13px] tracking-widest uppercase mb-3">{label}</p>
      {children}
    </div>
  );
}

/* ── 오른쪽 패널 섹션 (아코디언) ── */
function PanelAccordion({ label, value, children }: {
  label: string;
  value: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-white/5 mb-1">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between py-3 group"
      >
        <span className="text-[#17BEBB]/70 text-[13px] tracking-widest uppercase">{label}</span>
        <span className="flex items-center gap-2">
          <span className="text-white/70 text-[13px] font-mono truncate max-w-[120px]">{value}</span>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
            className={`text-white/20 group-hover:text-white/40 transition-all duration-200 ${open ? 'rotate-180' : ''}`}>
            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </span>
      </button>
      {open && <div className="pb-3">{children}</div>}
    </div>
  );
}

/* ── 가격 티어 뱃지 ── */
function PriceBadge({ price }: { price?: string }) {
  if (!price) return null;
  const isFree = price.includes('무료');
  const val = parseFloat(price.replace(/[^0-9.]/g, ''));
  let cls = 'text-white/25 bg-white/5';
  if (isFree)      cls = 'text-green-400/80 bg-green-400/10';
  else if (val < 1) cls = 'text-yellow-400/70 bg-yellow-400/10';
  else if (val < 5) cls = 'text-orange-400/70 bg-orange-400/10';
  else              cls = 'text-red-400/60 bg-red-400/10';
  return (
    <span className={`text-[11px] font-mono px-1.5 py-0.5 rounded-sm whitespace-nowrap ${cls}`}>
      {isFree ? 'FREE' : price}
    </span>
  );
}

/* ── 오른쪽 패널 선택 버튼 ── */
function OptionItem({ active, onClick, children, sub }: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  sub?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between px-2 py-2 text-[13px] font-mono border-l-2 transition-colors ${
        active
          ? 'border-yellow-400 text-yellow-400 bg-yellow-400/5'
          : 'border-transparent text-white/65 hover:text-white hover:border-white/30'
      }`}
    >
      <span>{children}</span>
      <PriceBadge price={sub} />
    </button>
  );
}

export default function DashboardPage() {
  const [script, setScript] = useState('');
  const [format, setFormat] = useState<Format>('shorts');
  const [imageModelId, setImageModelId] = useState('black-forest-labs/flux.2-klein-4b');
  const [llmModelId, setLlmModelId] = useState('deepseek/deepseek-chat-v3-0324');
  const [videoModelId, setVideoModelId] = useState('minimax/video-01');
  const [ttsProvider, setTtsProvider] = useState<'minimax' | 'google'>('minimax');
  const [voiceId, setVoiceId] = useState('Korean_SoothingLady');
  const [characterImageBase64, setCharacterImageBase64] = useState<string | null>(null);
  const [characterPreview, setCharacterPreview] = useState<string | null>(null);
  const [imageStyle, setImageStyle] = useState<ImageStyle>('cinematic');
  const characterInputRef = useRef<HTMLInputElement>(null);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [renderProgress, setRenderProgress] = useState(0);
  const [animatingIndex, setAnimatingIndex] = useState<number | null>(null);

  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');
  const [scenes, setScenes] = useState<PreviewScene[]>([]);
  const [videoUrl, setVideoUrl] = useState('');

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const [loadingAudioIndex, setLoadingAudioIndex] = useState<number | null>(null);
  const [scriptFocused, setScriptFocused] = useState(false);

  const isProcessing = status === 'previewing' || status === 'rendering';

  function handleCharacterUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setCharacterPreview(dataUrl);
      setCharacterImageBase64(dataUrl.split(',')[1]);
    };
    reader.readAsDataURL(file);
  }

  async function handlePreview() {
    if (!script.trim()) return;
    setStatus('previewing');
    setError('');
    setScenes([]);
    try {
      const res = await fetch('/api/generate-scenes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script, imageModelId, llmModelId, format, characterImageBase64, imageStyle }),
      });
      if (!res.ok || !res.body) throw new Error('장면 생성 실패');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const event = JSON.parse(line.slice(6));
          if (event.type === 'error') throw new Error(event.message);
          if (event.type === 'scene') {
            setScenes(prev => {
              const next = [...prev];
              next[event.index] = { 
                text: event.text, 
                imagePrompt: event.imagePrompt, 
                motionPrompt: event.motionPrompt,
                imageUrl: event.imageUrl,
                shouldAnimate: event.shouldAnimate 
              };
              return next;
            });
            // 10% 자동 애니메이션 트리거
            if (event.shouldAnimate) {
              handleAnimateScene(event.index, event.imageUrl, event.motionPrompt || event.imagePrompt);
            }
          }
          if (event.type === 'done') setStatus('preview');
        }
      }
    } catch (err: unknown) {
      setStatus('error');
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
    }
  }

  /**
   * 장면 애니메이션화 (MiniMax Video)
   */
  async function handleAnimateScene(index: number, overrideUrl?: string, overridePrompt?: string) {
    const scene = scenes[index] || { imageUrl: overrideUrl, motionPrompt: overridePrompt, imagePrompt: overridePrompt };
    const imageUrl = overrideUrl || scene.imageUrl;
    const prompt = overridePrompt || scene.motionPrompt || scene.imagePrompt || scene.text;

    if (!imageUrl) return;
    
    setAnimatingIndex(index);
    try {
      // 1. 태스크 생성
      const res = await fetch('/api/animate-scene', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl, prompt, modelId: videoModelId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '애니메이션 시작 실패');

      const { taskId, provider } = data;

      // 2. 폴링
      const poll = async () => {
        try {
          const sRes = await fetch(`/api/animate-scene?taskId=${taskId}&provider=${provider}`);
          const sData = await sRes.json();
          if (!sRes.ok) throw new Error(sData.error || '상태 확인 실패');

          if (sData.task_status === 'succeed') {
            setScenes(prev => prev.map((s, i) => i === index ? { ...s, videoUrl: sData.video_url } : s));
            setAnimatingIndex(null);
            return;
          }

          if (sData.task_status === 'failed') {
            throw new Error(sData.task_status_msg || '변환 중 오류 발생');
          }

          // 계속 폴링
          setTimeout(poll, 3000);
        } catch (pollErr: any) {
          console.error(pollErr);
          setAnimatingIndex(null);
        }
      };

      poll();
    } catch (err: any) {
      alert(err.message);
      setAnimatingIndex(null);
    }
  }

  async function handleRender() {
    if (scenes.length === 0) return;
    setStatus('rendering');
    setRenderProgress(0);
    setError('');
    try {
      const res = await fetch('/api/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenes, voiceId, speed: playbackRate, format, ttsProvider }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '영상 생성 시작 실패');

      const { renderId, bucketName } = data;

      // 비동기 폴링 상태 확인
      const poll = async () => {
        try {
          const sRes = await fetch(`/api/get-render-status?renderId=${renderId}&bucketName=${bucketName}`);
          const sData = await sRes.json();
          if (!sRes.ok) throw new Error(sData.error || '상태 확인 실패');

          if (sData.done) {
            setVideoUrl(sData.outputFile);
            setStatus('done');
            setRenderProgress(1);
            // 파일명 생성: clipflow260324001
            const now = new Date();
            const yy = String(now.getFullYear()).slice(2);
            const mmdd = String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0');
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
            const { count } = await supabase.from('videos').select('*', { count: 'exact', head: true }).gte('created_at', todayStart);
            const seq = String((count ?? 0) + 1).padStart(3, '0');
            const fileName = `clipflow${yy}${mmdd}${seq}`;

            await supabase.from('videos').insert({
              title: script.slice(0, 50) || '제목 없음',
              video_url: sData.outputFile,
              format,
              scene_count: scenes.length,
              voice_id: voiceId,
              image_style: imageStyle,
              image_model: imageModelId,
              tts_provider: ttsProvider,
              file_name: fileName,
            });
            return;
          }

          if (sData.fatalErrorEncountered) {
            throw new Error(sData.errors?.[0]?.message || '렌더링 중 오류가 발생했습니다');
          }

          setRenderProgress(sData.overallProgress);
          setTimeout(poll, 2000);
        } catch (pollErr: any) {
          setStatus('error');
          setError(pollErr.message || '렌더링 상태 확인 중 오류');
        }
      };

      poll();
    } catch (err: unknown) {
      setStatus('error');
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
    }
  }

  function updateSceneText(index: number, text: string) {
    setScenes(prev => prev.map((s, i) => (i === index ? { ...s, text } : s)));
  }

  const handlePlayScene = useCallback(async (index: number, text: string) => {
    if (playingIndex === index) {
      audioRef.current?.pause();
      audioRef.current = null;
      setPlayingIndex(null);
      return;
    }
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    setPlayingIndex(null);
    setLoadingAudioIndex(index);
    try {
      const res = await fetch('/api/preview-speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voiceId, ttsProvider }),
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.playbackRate = playbackRate;
      audioRef.current = audio;
      setPlayingIndex(index);
      audio.play();
      audio.onended = () => { URL.revokeObjectURL(url); setPlayingIndex(null); audioRef.current = null; };
    } catch {
      setPlayingIndex(null);
    } finally {
      setLoadingAudioIndex(null);
    }
  }, [playingIndex, voiceId, playbackRate]);

  const selectedImageModel = IMAGE_MODELS.find(m => m.id === imageModelId);
  const selectedVoice = MINIMAX_VOICES.find(v => v.id === voiceId);

  return (
    /* 전체: 왼쪽 콘텐츠 + 오른쪽 패널 (w-56) */
    <div className="flex gap-0 -m-6 min-h-full">

      {/* ─── 왼쪽: 메인 콘텐츠 ─── */}
      <div className="flex-1 min-w-0 p-6 border-r border-white/5">

        {/* ── 입력 단계 ── */}
        {(status === 'idle' || status === 'previewing' || status === 'error') && (
          <>
            <div className="relative mt-14 mb-6">
              {/* 탭 뱃지 - 박스 상단 테두리에 부착 */}
              <div className="absolute top-0 left-0 -translate-y-full inline-flex items-center gap-2 px-8 py-3 border-t border-l border-r border-orange-400/30 bg-[#0a0a0a]">
                <span className="w-1.5 h-1.5 bg-orange-400 rounded-full" />
                <span className="text-orange-400 text-[13px] font-mono tracking-widest uppercase">영상 만들기</span>
              </div>

            <div
              className={`relative border transition-colors duration-200 bg-white/[0.015] ${scriptFocused ? 'border-orange-400' : 'border-white/10'}`}
              onMouseEnter={() => setScriptFocused(true)}
              onMouseLeave={() => setScriptFocused(false)}
            >
              <textarea
                value={script}
                onChange={e => setScript(e.target.value)}
                placeholder="대본을 입력하세요..."
                className="w-full h-52 bg-transparent text-white border-0 focus:outline-none resize-none text-sm leading-relaxed font-mono placeholder:text-white/50 p-4"
                disabled={isProcessing}
              />
              <div className="flex items-center justify-between px-4 py-2.5 border-t border-white/5">
                <span className="text-white/50 text-[13px] font-mono">{script.length}자</span>
                <span className="text-white/40 text-[13px] font-mono tracking-wide">대본 또는 주제 · 키워드 모두 가능</span>
              </div>
            </div>

            {status === 'error' && scenes.length === 0 && (
              <div className="border-l-2 border-red-500 pl-4 mb-6">
                <p className="text-red-400 text-xs font-mono">{error}</p>
                <button onClick={() => setStatus('idle')} className="mt-2 text-white/25 hover:text-white/60 text-xs font-mono transition-colors">다시 시도 →</button>
              </div>
            )}

            </div>

            <button
              onClick={handlePreview}
              disabled={!script.trim() || isProcessing}
              className="inline-flex items-center gap-3 px-8 py-3 bg-yellow-400 hover:bg-yellow-300 disabled:bg-white/10 disabled:cursor-not-allowed text-black disabled:text-white/40 font-black transition-colors text-[13px] tracking-widest uppercase font-mono"
            >
              {status === 'previewing' ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  장면 생성 중...
                </>
              ) : '장면 미리보기 →'}
            </button>
          </>
        )}

        {/* ── 미리보기 단계 ── */}
        {(status === 'preview' || status === 'rendering' || status === 'done' || (status === 'error' && scenes.length > 0)) && scenes.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/5">
              <span className="text-[#17BEBB]/70 text-xs tracking-widest uppercase font-mono">{scenes.length}개 장면</span>
              {status === 'preview' && (
                <button
                  onClick={() => { setStatus('idle'); setScenes([]); setVideoUrl(''); }}
                  className="text-white/20 hover:text-white/50 text-xs font-mono transition-colors"
                >← 처음으로</button>
              )}
            </div>

            {/* 장면 리스트 */}
            <div>
              {scenes.map((scene, i) => (
                <div key={i} className="flex gap-4 py-4 border-b border-white/5">
                  <span className="text-white/40 text-xs font-mono pt-0.5 w-5 shrink-0 tabular-nums">{String(i + 1).padStart(2, '0')}</span>
                  <div className="w-16 h-16 shrink-0 overflow-hidden bg-white/5">
                    <img src={scene.imageUrl} alt={`장면 ${i + 1}`} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <textarea
                      value={scene.text}
                      onChange={e => updateSceneText(i, e.target.value)}
                      disabled={status !== 'preview'}
                      rows={3}
                      className="w-full bg-transparent text-white/80 text-[13px] font-mono leading-relaxed border-0 focus:outline-none resize-none disabled:opacity-60"
                    />
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-white/35 text-[12px] font-mono">{scene.text.length}자</span>
                      <button
                        onClick={() => handlePlayScene(i, scene.text)}
                        disabled={loadingAudioIndex !== null && loadingAudioIndex !== i || animatingIndex === i}
                        className="text-white/25 hover:text-yellow-400 text-[12px] font-mono transition-colors disabled:opacity-20"
                      >
                        {loadingAudioIndex === i ? '로딩...' : playingIndex === i ? '■ 정지' : '▶ 미리듣기'}
                      </button>
                      <button
                        onClick={() => handleAnimateScene(i)}
                        disabled={animatingIndex !== null || status !== 'preview' || !!scene.videoUrl}
                        className={`text-[12px] font-mono transition-colors ${
                          scene.videoUrl 
                            ? 'text-yellow-400/50 cursor-default' 
                            : 'text-cyan-400/80 hover:text-cyan-300 disabled:opacity-20'
                        }`}
                      >
                        {animatingIndex === i ? '변환 중...' : scene.videoUrl ? '✓ AI 비디오' : '✧ AI 애니메이션'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* 영상 생성 버튼 */}
            {status === 'preview' && (
              <div className="mt-8">
                <button
                  onClick={handleRender}
                  className="inline-flex items-center gap-2 px-8 py-3 bg-yellow-400 hover:bg-yellow-300 text-black font-black transition-colors text-xs tracking-widest uppercase font-mono"
                >
                  영상 생성 →
                </button>
              </div>
            )}

            {status === 'error' && error && (
              <div className="mt-8 border-l-2 border-red-500 pl-4 py-1">
                <p className="text-red-400 text-xs font-mono">영상 생성 실패: {error}</p>
                <button
                  onClick={() => { setStatus('preview'); setError(''); }}
                  className="mt-2 text-white/25 hover:text-white/60 text-xs font-mono transition-colors"
                >
                  다시 시도 →
                </button>
              </div>
            )}

            {status === 'rendering' && (
              <div className="mt-8 border-l-2 border-yellow-400/40 pl-4 py-1">
                <div className="flex items-center gap-3 mb-3">
                  <span className="w-3.5 h-3.5 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin shrink-0" />
                  <div>
                    <p className="text-yellow-400/80 text-xs font-mono">영상 생성 중... {Math.round(renderProgress * 100)}%</p>
                    <p className="text-[#17BEBB]/60 text-[11px] tracking-widest uppercase font-mono mt-0.5">TTS → AWS Lambda 렌더링 진행 중</p>
                  </div>
                </div>
                {/* 미니 프로그레스 바 */}
                <div className="w-full h-0.5 bg-white/5 overflow-hidden rounded-full">
                  <div 
                    className="h-full bg-yellow-400 transition-all duration-500 ease-out" 
                    style={{ width: `${renderProgress * 100}%` }}
                  />
                </div>
              </div>
            )}
          </>
        )}

        {/* ── 완성 ── */}
        {status === 'done' && videoUrl && (
          <div className="mt-2">
            <div className="flex items-center justify-between pb-3 border-b border-white/5 mb-4">
              <span className="text-[#17BEBB]/70 text-[13px] tracking-widest uppercase font-mono">완성 영상</span>
            </div>
            <div className={`mt-2 ${format === 'shorts' ? 'w-[280px]' : 'w-full'}`}>
              <video 
                src={videoUrl} 
                controls 
                className="w-full bg-black shadow-2xl" 
              />
            </div>
            <div className="flex gap-3 mt-4">
              <button
                onClick={async () => {
                  const proxyUrl = `/api/download?url=${encodeURIComponent(videoUrl)}&filename=clipflow`;
                  if ('showSaveFilePicker' in window) {
                    try {
                      const handle = await (window as any).showSaveFilePicker({
                        suggestedName: 'clipflow.mp4',
                        types: [{ description: 'MP4 Video', accept: { 'video/mp4': ['.mp4'] } }],
                      });
                      const res = await fetch(proxyUrl);
                      const blob = await res.blob();
                      const writable = await handle.createWritable();
                      await writable.write(blob);
                      await writable.close();
                      return;
                    } catch (e: any) {
                      if (e.name === 'AbortError') return;
                    }
                  }
                  const a = document.createElement('a');
                  a.href = proxyUrl;
                  a.download = 'clipflow.mp4';
                  a.click();
                }}
                className="flex-1 text-center bg-yellow-400 hover:bg-yellow-300 text-black font-black py-3 transition-colors text-xs tracking-widest uppercase font-mono"
              >
                다운로드
              </button>
              <button
                onClick={() => { setStatus('idle'); setScenes([]); setVideoUrl(''); setScript(''); }}
                className="px-5 py-3 border border-white/10 text-white/40 hover:border-white/30 hover:text-white/70 text-xs font-mono transition-colors"
              >
                새 영상
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ─── 오른쪽: 설정 패널 (w-56, 왼쪽 nav와 동일 너비) ─── */}
      <aside className="w-96 shrink-0 flex flex-col border-l border-white/5 overflow-y-auto">
        <div className="flex-1 px-4 py-5 space-y-0">

          {/* 입력 단계 설정 */}
          {(status === 'idle' || status === 'previewing' || status === 'error') && (
            <>
              <PanelSection label="스타일">
                <div className="flex flex-wrap gap-1">
                  {IMAGE_STYLES.map(s => (
                    <button
                      key={s.id}
                      onClick={() => setImageStyle(s.id)}
                      disabled={isProcessing}
                      className={`px-3 py-1.5 text-[12.5px] font-mono border transition-colors ${
                        imageStyle === s.id
                          ? 'border-yellow-400 text-yellow-400'
                          : 'border-white/10 text-white/30 hover:border-white/30 hover:text-white/60'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </PanelSection>

              <PanelSection label="비율">
                <div className="space-y-0.5">
                  {([['shorts', '쇼츠 / 릴스 (9:16)'], ['landscape', '유튜브 (16:9)']] as const).map(([val, label]) => (
                    <OptionItem key={val} active={format === val} onClick={() => setFormat(val)}>
                      <span className="flex items-center gap-2">
                        <span className={`border border-current inline-block shrink-0 ${val === 'shorts' ? 'w-2.5 h-4' : 'w-4 h-2.5'}`} />
                        {label}
                      </span>
                    </OptionItem>
                  ))}
                </div>
              </PanelSection>

              <PanelSection label="캐릭터">
                <div
                  onClick={() => !isProcessing && characterInputRef.current?.click()}
                  className={`w-full flex items-center gap-2 px-2 py-2 text-xs font-mono border border-white/10 text-white/30 transition-colors ${
                    !isProcessing ? 'hover:border-white/30 hover:text-white/60 cursor-pointer' : 'opacity-30 cursor-not-allowed'
                  }`}
                >
                  {characterPreview
                    ? <img src={characterPreview} alt="캐릭터" className="w-5 h-5 object-cover" />
                    : <span className="w-5 h-5 border border-white/20 flex items-center justify-center text-[11px]">+</span>
                  }
                  <span>{characterPreview ? '변경' : '이미지 선택'}</span>
                  {characterPreview && (
                    <button
                      onClick={e => { e.stopPropagation(); setCharacterPreview(null); setCharacterImageBase64(null); }}
                      className="ml-auto text-white/20 hover:text-red-400 transition-colors"
                    >✕</button>
                  )}
                </div>
                <input ref={characterInputRef} type="file" accept="image/*" className="hidden" onChange={handleCharacterUpload} />
              </PanelSection>

              <PanelAccordion label="장면 AI" value={LLM_MODELS.find(m => m.id === llmModelId)?.name ?? ''}>
                <div className="space-y-0.5">
                  {LLM_MODELS.map(m => (
                    <OptionItem key={m.id} active={llmModelId === m.id} onClick={() => setLlmModelId(m.id)} sub={m.price}>
                      {m.name}
                    </OptionItem>
                  ))}
                </div>
              </PanelAccordion>

              <PanelAccordion label="이미지 AI" value={IMAGE_MODELS.find(m => m.id === imageModelId)?.name ?? ''}>
                <div className="space-y-0.5">
                  {IMAGE_MODELS.map(m => (
                    <OptionItem key={m.id} active={imageModelId === m.id} onClick={() => setImageModelId(m.id)} sub={m.price}>
                      {m.name}
                    </OptionItem>
                  ))}
                </div>
              </PanelAccordion>

              <PanelAccordion label="영상 AI" value={VIDEO_MODELS.find(m => m.id === videoModelId)?.name ?? ''}>
                <div className="space-y-0.5">
                  {VIDEO_MODELS.map(m => (
                    <OptionItem key={m.id} active={videoModelId === m.id} onClick={() => setVideoModelId(m.id)} sub={m.price}>
                      {m.name}
                    </OptionItem>
                  ))}
                </div>
              </PanelAccordion>
            </>
          )}

          {/* 미리보기 단계 설정 */}
          {(status === 'preview' || status === 'rendering') && (
            <>
              <PanelAccordion
                label="목소리"
                value={
                  ttsProvider === 'google'
                    ? GOOGLE_VOICES.find(v => v.id === voiceId)?.name ?? ''
                    : MINIMAX_VOICES.find(v => v.id === voiceId)?.name ?? ''
                }
              >
                {/* Provider 토글 */}
                <div className="flex gap-1 mb-2">
                  <button
                    onClick={() => { setTtsProvider('minimax'); setVoiceId('Korean_SoothingLady'); }}
                    className={`flex-1 py-1 text-[11px] rounded ${ttsProvider === 'minimax' ? 'bg-yellow-400 text-black font-bold' : 'bg-white/10 text-white/50'}`}
                  >
                    MiniMax (유료)
                  </button>
                  <button
                    onClick={() => { setTtsProvider('google'); setVoiceId('Kore'); }}
                    className={`flex-1 py-1 text-[11px] rounded ${ttsProvider === 'google' ? 'bg-yellow-400 text-black font-bold' : 'bg-white/10 text-white/50'}`}
                  >
                    Google (무료)
                  </button>
                </div>
                <div className="space-y-0.5">
                  {ttsProvider === 'google'
                    ? GOOGLE_VOICES.map(v => (
                        <OptionItem key={v.id} active={voiceId === v.id} onClick={() => setVoiceId(v.id)}>
                          {v.name}
                        </OptionItem>
                      ))
                    : MINIMAX_VOICES.map(v => (
                        <OptionItem key={v.id} active={voiceId === v.id} onClick={() => setVoiceId(v.id)}>
                          {v.name}
                        </OptionItem>
                      ))
                  }
                </div>
              </PanelAccordion>

              <PanelSection label="나레이션 속도">
                <div className="px-1">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-white/30 text-[11px] font-mono">속도</span>
                    <span className="text-yellow-400 text-xs font-mono">{playbackRate.toFixed(2)}x</span>
                  </div>
                  <input
                    type="range" min={0.5} max={2.0} step={0.25} value={playbackRate}
                    onChange={e => setPlaybackRate(parseFloat(e.target.value))}
                    className="w-full accent-yellow-400 h-0.5"
                  />
                  <div className="flex justify-between text-white/15 text-[9px] font-mono mt-2">
                    <span>0.5x</span><span>1.0x</span><span>2.0x</span>
                  </div>
                </div>
              </PanelSection>

              {/* 현재 설정 요약 */}
              <div className="mt-4 space-y-1.5">
                <p className="text-white/15 text-[11px] tracking-widest uppercase mb-2">설정 요약</p>
                <div className="flex justify-between text-[11px] font-mono">
                  <span className="text-white/20">스타일</span>
                  <span className="text-white/40">{IMAGE_STYLES.find(s => s.id === imageStyle)?.label}</span>
                </div>
                <div className="flex justify-between text-[11px] font-mono">
                  <span className="text-white/20">비율</span>
                  <span className="text-white/40">{format === 'shorts' ? '9:16' : '16:9'}</span>
                </div>
                <div className="flex justify-between text-[11px] font-mono">
                  <span className="text-white/20">이미지 AI</span>
                  <span className="text-white/40">{selectedImageModel?.name?.split(' ').slice(0, 2).join(' ')}</span>
                </div>
                <div className="flex justify-between text-[11px] font-mono">
                  <span className="text-white/20">목소리</span>
                  <span className="text-white/40">{selectedVoice?.name}</span>
                </div>
              </div>
            </>
          )}

          {/* 완성 단계 */}
          {status === 'done' && (
            <div className="space-y-1.5">
              <p className="text-white/15 text-[11px] tracking-widest uppercase mb-3">생성 완료</p>
              <div className="flex justify-between text-[11px] font-mono">
                <span className="text-white/20">장면 수</span>
                <span className="text-white/40">{scenes.length}개</span>
              </div>
              <div className="flex justify-between text-[10px] font-mono">
                <span className="text-white/20">스타일</span>
                <span className="text-white/40">{IMAGE_STYLES.find(s => s.id === imageStyle)?.label}</span>
              </div>
              <div className="flex justify-between text-[10px] font-mono">
                <span className="text-white/20">비율</span>
                <span className="text-white/40">{format === 'shorts' ? '9:16 쇼츠' : '16:9 유튜브'}</span>
              </div>
            </div>
          )}

        </div>
      </aside>

    </div>
  );
}
