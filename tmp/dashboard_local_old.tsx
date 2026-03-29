'use client';

import { useState, useRef, useCallback } from 'react';
import { IMAGE_MODELS, LLM_MODELS } from '@/lib/openrouter';
import { MINIMAX_VOICES } from '@/lib/minimax-tts';

type Status = 'idle' | 'previewing' | 'preview' | 'rendering' | 'done' | 'error';
type Format = 'shorts' | 'landscape';

const IMAGE_STYLES = [
  { id: 'cinematic', label: '?곹솕' },
  { id: 'realistic', label: '?ㅼ궗' },
  { id: 'anime', label: '?좊땲' },
  { id: 'documentary', label: '?ㅽ걧' },
  { id: '3d', label: '3D' },
  { id: 'watercolor', label: '?섏콈?? },
  { id: 'cartoon', label: '移댄댆' },
  { id: 'noir', label: '?꾩븘瑜? },
] as const;

type ImageStyle = typeof IMAGE_STYLES[number]['id'];

type PreviewScene = {
  text: string;
  imageUrl: string;
  imagePrompt: string;
  videoUrl?: string;
};

/* ?? ?ㅻⅨ履??⑤꼸 ?뱀뀡 (?쇰컲) ?? */
function PanelSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-white/5 pb-4 mb-4">
      <p className="text-white/20 text-[12px] tracking-widest uppercase mb-3">{label}</p>
      {children}
    </div>
  );
}

/* ?? ?ㅻⅨ履??⑤꼸 ?뱀뀡 (?꾩퐫?붿뼵) ?? */
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
        <span className="text-white/20 text-[12px] tracking-widest uppercase">{label}</span>
        <span className="flex items-center gap-2">
          <span className="text-white/50 text-[12px] font-mono truncate max-w-[120px]">{value}</span>
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

/* ?? 媛寃??곗뼱 諭껋? ?? */
function PriceBadge({ price }: { price?: string }) {
  if (!price) return null;
  const isFree = price.includes('臾대즺');
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

/* ?? ?ㅻⅨ履??⑤꼸 ?좏깮 踰꾪듉 ?? */
function OptionItem({ active, onClick, children, sub }: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  sub?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between px-2 py-2 text-xs font-mono border-l-2 transition-colors ${
        active
          ? 'border-yellow-400 text-yellow-400 bg-yellow-400/5'
          : 'border-transparent text-white/40 hover:text-white/70 hover:border-white/20'
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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '?λ㈃ ?앹꽦 ?ㅽ뙣');
      setScenes(data.scenes);
      setStatus('preview');
    } catch (err: unknown) {
      setStatus('error');
      setError(err instanceof Error ? err.message : '?????녿뒗 ?ㅻ쪟');
    }
  }

  /**
   * ?λ㈃ ?좊땲硫붿씠?섑솕 (MiniMax Video)
   */
  async function handleAnimateScene(index: number) {
    const scene = scenes[index];
    if (!scene.imageUrl) return;
    
    setAnimatingIndex(index);
    try {
      // 1. ?쒖뒪???앹꽦
      const res = await fetch('/api/animate-scene', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: scene.imageUrl, prompt: scene.text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '?좊땲硫붿씠???쒖옉 ?ㅽ뙣');

      const { taskId } = data;

      // 2. ?대쭅
      const poll = async () => {
        try {
          const sRes = await fetch(`/api/animate-scene?taskId=${taskId}`);
          const sData = await sRes.json();
          if (!sRes.ok) throw new Error(sData.error || '?곹깭 ?뺤씤 ?ㅽ뙣');

          if (sData.task_status === 'succeed') {
            setScenes(prev => prev.map((s, i) => i === index ? { ...s, videoUrl: sData.video_url } : s));
            setAnimatingIndex(null);
            return;
          }

          if (sData.task_status === 'failed') {
            throw new Error(sData.task_status_msg || '蹂??以??ㅻ쪟 諛쒖깮');
          }

          // 怨꾩냽 ?대쭅
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
        body: JSON.stringify({ scenes, voiceId, speed: playbackRate, format }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '?곸긽 ?앹꽦 ?쒖옉 ?ㅽ뙣');

      const { renderId, bucketName } = data;

      // 鍮꾨룞湲??대쭅 ?곹깭 ?뺤씤
      const poll = async () => {
        try {
          const sRes = await fetch(`/api/get-render-status?renderId=${renderId}&bucketName=${bucketName}`);
          const sData = await sRes.json();
          if (!sRes.ok) throw new Error(sData.error || '?곹깭 ?뺤씤 ?ㅽ뙣');

          if (sData.done) {
            setVideoUrl(sData.outputFile);
            setStatus('done');
            setRenderProgress(1);
            return;
          }

          if (sData.fatalErrorEncountered) {
            throw new Error(sData.errors?.[0]?.message || '?뚮뜑留?以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎');
          }

          setRenderProgress(sData.overallProgress);
          setTimeout(poll, 2000);
        } catch (pollErr: any) {
          setStatus('error');
          setError(pollErr.message || '?뚮뜑留??곹깭 ?뺤씤 以??ㅻ쪟');
        }
      };

      poll();
    } catch (err: unknown) {
      setStatus('error');
      setError(err instanceof Error ? err.message : '?????녿뒗 ?ㅻ쪟');
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
        body: JSON.stringify({ text, voiceId }),
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
    /* ?꾩껜: ?쇱そ 肄섑뀗痢?+ ?ㅻⅨ履??⑤꼸 (w-56) */
    <div className="flex gap-0 -m-6 min-h-full">

      {/* ??? ?쇱そ: 硫붿씤 肄섑뀗痢???? */}
      <div className="flex-1 min-w-0 p-6 border-r border-white/5">

        {/* ?? ?낅젰 ?④퀎 ?? */}
        {(status === 'idle' || status === 'previewing' || status === 'error') && (
          <>
            <textarea
              value={script}
              onChange={e => setScript(e.target.value)}
              placeholder="?蹂??먮뒗 二쇱젣瑜??낅젰?섏꽭??.."
              className="w-full h-52 bg-transparent text-white border-0 border-b border-white/10 focus:border-white/30 focus:outline-none resize-none text-sm leading-relaxed font-mono placeholder:text-white/20 pb-3"
              disabled={isProcessing}
            />
            <p className="text-white/15 text-xs font-mono mt-2 mb-8">{script.length}??/p>

            {status === 'error' && (
              <div className="border-l-2 border-red-500 pl-4 mb-8">
                <p className="text-red-400 text-xs font-mono">{error}</p>
                <button onClick={() => setStatus('idle')} className="mt-2 text-white/25 hover:text-white/60 text-xs font-mono transition-colors">?ㅼ떆 ?쒕룄 ??/button>
              </div>
            )}

            <button
              onClick={handlePreview}
              disabled={!script.trim() || isProcessing}
              className="w-full bg-yellow-400 hover:bg-yellow-300 disabled:bg-white/5 disabled:cursor-not-allowed text-black disabled:text-white/20 font-black py-3.5 transition-colors text-xs tracking-widest uppercase font-mono"
            >
              {status === 'previewing' ? (
                <span className="flex items-center justify-center gap-3">
                  <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin inline-block" />
                  ?λ㈃ ?앹꽦 以?..
                </span>
              ) : '?λ㈃ 誘몃━蹂닿린 ??}
            </button>
          </>
        )}

        {/* ?? 誘몃━蹂닿린 ?④퀎 ?? */}
        {(status === 'preview' || status === 'rendering' || status === 'done') && scenes.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/5">
              <span className="text-white/25 text-xs tracking-widest uppercase font-mono">{scenes.length}媛??λ㈃</span>
              {status === 'preview' && (
                <button
                  onClick={() => { setStatus('idle'); setScenes([]); setVideoUrl(''); }}
                  className="text-white/20 hover:text-white/50 text-xs font-mono transition-colors"
                >??泥섏쓬?쇰줈</button>
              )}
            </div>

            {/* ?λ㈃ 由ъ뒪??*/}
            <div>
              {scenes.map((scene, i) => (
                <div key={i} className="flex gap-4 py-4 border-b border-white/5">
                  <span className="text-white/15 text-xs font-mono pt-0.5 w-5 shrink-0 tabular-nums">{String(i + 1).padStart(2, '0')}</span>
                  <div className="w-16 h-16 shrink-0 overflow-hidden bg-white/5">
                    <img src={scene.imageUrl} alt={`?λ㈃ ${i + 1}`} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <textarea
                      value={scene.text}
                      onChange={e => updateSceneText(i, e.target.value)}
                      disabled={status !== 'preview'}
                      rows={3}
                      className="w-full bg-transparent text-white/80 text-xs font-mono leading-relaxed border-0 focus:outline-none resize-none disabled:opacity-60"
                    />
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-white/15 text-xs font-mono">{scene.text.length}??/span>
                      <button
                        onClick={() => handlePlayScene(i, scene.text)}
                        disabled={loadingAudioIndex !== null && loadingAudioIndex !== i || animatingIndex === i}
                        className="text-white/25 hover:text-yellow-400 text-xs font-mono transition-colors disabled:opacity-20"
                      >
                        {loadingAudioIndex === i ? '濡쒕뵫...' : playingIndex === i ? '???뺤?' : '??誘몃━?ｊ린'}
                      </button>
                      <button
                        onClick={() => handleAnimateScene(i)}
                        disabled={animatingIndex !== null || status !== 'preview' || !!scene.videoUrl}
                        className={`text-xs font-mono transition-colors ${
                          scene.videoUrl 
                            ? 'text-yellow-400/50 cursor-default' 
                            : 'text-white/25 hover:text-yellow-400 disabled:opacity-20'
                        }`}
                      >
                        {animatingIndex === i ? '蹂??以?..' : scene.videoUrl ? '??AI 鍮꾨뵒?? : '??AI ?좊땲硫붿씠??}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* ?곸긽 ?앹꽦 踰꾪듉 */}
            {status === 'preview' && (
              <button
                onClick={handleRender}
                className="w-full mt-8 bg-yellow-400 hover:bg-yellow-300 text-black font-black py-3.5 transition-colors text-xs tracking-widest uppercase font-mono"
              >
                ?곸긽 ?앹꽦 ??              </button>
            )}

            {status === 'rendering' && (
              <div className="mt-8 border-l-2 border-yellow-400/40 pl-4 py-1">
                <div className="flex items-center gap-3 mb-3">
                  <span className="w-3.5 h-3.5 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin shrink-0" />
                  <div>
                    <p className="text-yellow-400/80 text-xs font-mono">?곸긽 ?앹꽦 以?.. {Math.round(renderProgress * 100)}%</p>
                    <p className="text-white/20 text-[11px] tracking-widest uppercase font-mono mt-0.5">TTS ??AWS Lambda ?뚮뜑留?吏꾪뻾 以?/p>
                  </div>
                </div>
                {/* 誘몃땲 ?꾨줈洹몃젅??諛?*/}
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

        {/* ?? ?꾩꽦 ?? */}
        {status === 'done' && videoUrl && (
          <div className="mt-2">
            <div className="flex items-center justify-between pb-3 border-b border-white/5 mb-4">
              <span className="text-white/25 text-xs tracking-widest uppercase font-mono">?꾩꽦 ?곸긽</span>
            </div>
            <video src={videoUrl} controls className="w-full" />
            <div className="flex gap-3 mt-4">
              <a href={videoUrl} download className="flex-1 text-center bg-yellow-400 hover:bg-yellow-300 text-black font-black py-3 transition-colors text-xs tracking-widest uppercase font-mono">
                ?ㅼ슫濡쒕뱶
              </a>
              <button
                onClick={() => { setStatus('idle'); setScenes([]); setVideoUrl(''); setScript(''); }}
                className="px-5 py-3 border border-white/10 text-white/40 hover:border-white/30 hover:text-white/70 text-xs font-mono transition-colors"
              >
                ???곸긽
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ??? ?ㅻⅨ履? ?ㅼ젙 ?⑤꼸 (w-56, ?쇱そ nav? ?숈씪 ?덈퉬) ??? */}
      <aside className="w-96 shrink-0 flex flex-col border-l border-white/5 overflow-y-auto">
        <div className="flex-1 px-4 py-5 space-y-0">

          {/* ?낅젰 ?④퀎 ?ㅼ젙 */}
          {(status === 'idle' || status === 'previewing' || status === 'error') && (
            <>
              <PanelSection label="?ㅽ???>
                <div className="flex flex-wrap gap-1">
                  {IMAGE_STYLES.map(s => (
                    <button
                      key={s.id}
                      onClick={() => setImageStyle(s.id)}
                      disabled={isProcessing}
                      className={`px-3 py-1.5 text-xs font-mono border transition-colors ${
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

              <PanelSection label="鍮꾩쑉">
                <div className="space-y-0.5">
                  {([['shorts', '?쇱툩 / 由댁뒪'], ['landscape', '?좏뒠釉?]] as const).map(([val, label]) => (
                    <OptionItem key={val} active={format === val} onClick={() => setFormat(val)}>
                      <span className="flex items-center gap-2">
                        <span className={`border border-current inline-block shrink-0 ${val === 'shorts' ? 'w-2.5 h-4' : 'w-4 h-2.5'}`} />
                        {label}
                      </span>
                    </OptionItem>
                  ))}
                </div>
              </PanelSection>

              <PanelSection label="罹먮┃??>
                <div
                  onClick={() => !isProcessing && characterInputRef.current?.click()}
                  className={`w-full flex items-center gap-2 px-2 py-2 text-xs font-mono border border-white/10 text-white/30 transition-colors ${
                    !isProcessing ? 'hover:border-white/30 hover:text-white/60 cursor-pointer' : 'opacity-30 cursor-not-allowed'
                  }`}
                >
                  {characterPreview
                    ? <img src={characterPreview} alt="罹먮┃?? className="w-5 h-5 object-cover" />
                    : <span className="w-5 h-5 border border-white/20 flex items-center justify-center text-[11px]">+</span>
                  }
                  <span>{characterPreview ? '蹂寃? : '?대?吏 ?좏깮'}</span>
                  {characterPreview && (
                    <button
                      onClick={e => { e.stopPropagation(); setCharacterPreview(null); setCharacterImageBase64(null); }}
                      className="ml-auto text-white/20 hover:text-red-400 transition-colors"
                    >??/button>
                  )}
                </div>
                <input ref={characterInputRef} type="file" accept="image/*" className="hidden" onChange={handleCharacterUpload} />
              </PanelSection>

              <PanelAccordion label="?λ㈃ AI" value={LLM_MODELS.find(m => m.id === llmModelId)?.name ?? ''}>
                <div className="space-y-0.5">
                  {LLM_MODELS.map(m => (
                    <OptionItem key={m.id} active={llmModelId === m.id} onClick={() => setLlmModelId(m.id)} sub={m.price}>
                      {m.name}
                    </OptionItem>
                  ))}
                </div>
              </PanelAccordion>

              <PanelAccordion label="?대?吏 AI" value={IMAGE_MODELS.find(m => m.id === imageModelId)?.name ?? ''}>
                <div className="space-y-0.5">
                  {IMAGE_MODELS.map(m => (
                    <OptionItem key={m.id} active={imageModelId === m.id} onClick={() => setImageModelId(m.id)} sub={m.price}>
                      {m.name}
                    </OptionItem>
                  ))}
                </div>
              </PanelAccordion>
            </>
          )}

          {/* 誘몃━蹂닿린 ?④퀎 ?ㅼ젙 */}
          {(status === 'preview' || status === 'rendering') && (
            <>
              <PanelAccordion label="紐⑹냼由? value={MINIMAX_VOICES.find(v => v.id === voiceId)?.name ?? ''}>
                <div className="space-y-0.5">
                  {MINIMAX_VOICES.map(v => (
                    <OptionItem key={v.id} active={voiceId === v.id} onClick={() => setVoiceId(v.id)}>
                      {v.name}
                    </OptionItem>
                  ))}
                </div>
              </PanelAccordion>

              <PanelSection label="?섎젅?댁뀡 ?띾룄">
                <div className="px-1">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-white/30 text-[11px] font-mono">?띾룄</span>
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

              {/* ?꾩옱 ?ㅼ젙 ?붿빟 */}
              <div className="mt-4 space-y-1.5">
                <p className="text-white/15 text-[11px] tracking-widest uppercase mb-2">?ㅼ젙 ?붿빟</p>
                <div className="flex justify-between text-[11px] font-mono">
                  <span className="text-white/20">?ㅽ???/span>
                  <span className="text-white/40">{IMAGE_STYLES.find(s => s.id === imageStyle)?.label}</span>
                </div>
                <div className="flex justify-between text-[11px] font-mono">
                  <span className="text-white/20">鍮꾩쑉</span>
                  <span className="text-white/40">{format === 'shorts' ? '9:16' : '16:9'}</span>
                </div>
                <div className="flex justify-between text-[11px] font-mono">
                  <span className="text-white/20">?대?吏 AI</span>
                  <span className="text-white/40">{selectedImageModel?.name?.split(' ').slice(0, 2).join(' ')}</span>
                </div>
                <div className="flex justify-between text-[11px] font-mono">
                  <span className="text-white/20">紐⑹냼由?/span>
                  <span className="text-white/40">{selectedVoice?.name}</span>
                </div>
              </div>
            </>
          )}

          {/* ?꾩꽦 ?④퀎 */}
          {status === 'done' && (
            <div className="space-y-1.5">
              <p className="text-white/15 text-[11px] tracking-widest uppercase mb-3">?앹꽦 ?꾨즺</p>
              <div className="flex justify-between text-[11px] font-mono">
                <span className="text-white/20">?λ㈃ ??/span>
                <span className="text-white/40">{scenes.length}媛?/span>
              </div>
              <div className="flex justify-between text-[10px] font-mono">
                <span className="text-white/20">?ㅽ???/span>
                <span className="text-white/40">{IMAGE_STYLES.find(s => s.id === imageStyle)?.label}</span>
              </div>
              <div className="flex justify-between text-[10px] font-mono">
                <span className="text-white/20">鍮꾩쑉</span>
                <span className="text-white/40">{format === 'shorts' ? '9:16 ?쇱툩' : '16:9 ?좏뒠釉?}</span>
              </div>
            </div>
          )}

        </div>
      </aside>

    </div>
  );
}
