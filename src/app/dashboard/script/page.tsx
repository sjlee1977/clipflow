'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Download, ExternalLink, Wand2, Loader2, RefreshCw } from 'lucide-react';

const SCRIPT_LLM_MODELS = [
  { id: 'claude-sonnet-4-6',         name: 'Claude Sonnet 4.6',   provider: 'Anthropic', price: '고품질' },
  { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5',    provider: 'Anthropic', price: '빠름' },
  { id: 'claude-opus-4-6',           name: 'Claude Opus 4.6',     provider: 'Anthropic', price: '최고품질' },
  { id: 'gemini-3.0-flash',          name: 'Gemini 3.0 Flash',    provider: 'Google',    price: '균형' },
  { id: 'gemini-3.0-pro',            name: 'Gemini 3.0 Pro',      provider: 'Google',    price: '고품질' },
  { id: 'gemini-2.5-flash',          name: 'Gemini 2.5 Flash',    provider: 'Google',    price: '최고 가성비' },
  { id: 'qwen3.6-plus',             name: 'Qwen 3.6 Plus',      provider: 'Alibaba',   price: '신규·고지능' },
  { id: 'qwen3.5-plus',             name: 'Qwen 3.5 Plus',      provider: 'Alibaba',   price: '합리적·지능' },
  { id: 'qwen3.5-flash',            name: 'Qwen 3.5 Flash',     provider: 'Alibaba',   price: '초저가·빠름' },
  { id: 'qwen3.5-omni-plus',        name: 'Qwen 3.5 Omni Plus', provider: 'Alibaba',   price: '전모태·고성능' },
];

type ToneId = 'urgent_direct' | 'dramatic_tension' | 'calm_analytical' | 'trust_clear' | 'storytelling' | 'friendly_casual';

const TONES: { id: ToneId; label: string; sub: string }[] = [
  { id: 'urgent_direct',    label: '긴박·직설',    sub: '경제/주식' },
  { id: 'dramatic_tension', label: '드라마틱·긴장', sub: '공포' },
  { id: 'calm_analytical',  label: '차분·분석적',  sub: '심리학' },
  { id: 'trust_clear',      label: '신뢰·명확',    sub: '건강' },
  { id: 'storytelling',     label: '스토리텔링',   sub: '역사' },
  { id: 'friendly_casual',  label: '친근·반말',    sub: '일반' },
];

const CATEGORY_DEFAULT_TONES: Record<string, ToneId> = {
  economy:    'urgent_direct',
  horror:     'dramatic_tension',
  psychology: 'calm_analytical',
  health:     'trust_clear',
  history:    'storytelling',
  general:    'friendly_casual',
};

const CATEGORY_LABELS: Record<string, string> = {
  economy:    '경제 / 주식',
  horror:     '공포',
  psychology: '심리학',
  health:     '건강',
  history:    '역사',
  general:    '일반',
};

function PanelAccordion({ label, value, open, onToggle, children }: {
  label: string; value: string; open: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className="border-b border-white/5 mb-1">
      <button onClick={onToggle} className="w-full flex items-center justify-between py-3 group">
        <span className="text-white/50 text-[11px] font-semibold tracking-widest uppercase">{label}</span>
        <span className="flex items-center gap-2">
          <span className="text-white/60 text-[12px] font-medium truncate max-w-[120px]">{value}</span>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
            className={`text-white/40 group-hover:text-white/70 transition-all duration-200 ${open ? 'rotate-180' : ''}`}>
            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </span>
      </button>
      {open && <div className="pb-3">{children}</div>}
    </div>
  );
}

function PriceBadge({ price }: { price?: string }) {
  if (!price) return null;
  const isFree = price.includes('무료');
  const val = parseFloat(price.replace(/[^0-9.]/g, ''));
  let cls = 'text-white/25 bg-white/5';
  if (isFree)       cls = 'text-green-400/80 bg-green-400/10';
  else if (val < 1) cls = 'text-green-500/70 bg-green-500/10';
  else if (val < 5) cls = 'text-green-400/70 bg-green-400/10';
  else              cls = 'text-red-400/60 bg-red-400/10';
  return <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-sm whitespace-nowrap ${cls}`}>{isFree ? 'FREE' : price}</span>;
}

const PROVIDER_HEX: Record<string, string> = {
  Anthropic: '#fb923c',
  Google:    '#60a5fa',
  Alibaba:   '#a78bfa',
};

function OptionItem({ active, onClick, children, sub, provider }: {
  active: boolean; onClick: () => void; children: React.ReactNode; sub?: string; provider?: string;
}) {
  const hex = (provider && PROVIDER_HEX[provider]) ?? '#4ade80';
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between px-2 py-2 text-[11.5px] font-normal border-l-2 transition-colors ${
        active ? '' : 'border-transparent hover:text-white hover:border-white/30'
      }`}
      style={active ? { borderLeftColor: hex, backgroundColor: hex + '26' } : {}}
    >
      <span className={active ? '' : 'text-white/50'} style={active ? { color: hex } : {}}>{children}</span>
      <PriceBadge price={sub} />
    </button>
  );
}

// ─── 인라인 썸네일 패널 ──────────────────────────────────────────────────────

type ThumbStatus = 'idle' | 'generating' | 'done' | 'error';
type ThumbStyle = 'youtube_bold' | 'youtube_face' | 'blog_clean' | 'blog_dark';
type ThumbProvider = 'fal' | 'gemini';
type FalFluxModel = 'fal/flux-schnell' | 'fal/flux-dev' | 'fal/flux-pro' | 'fal/flux-2-pro';

const THUMB_STYLES: { value: ThumbStyle; label: string }[] = [
  { value: 'youtube_bold', label: '임팩트 볼드' },
  { value: 'youtube_face', label: '리액션 페이스' },
  { value: 'blog_clean',   label: '클린 미니멀' },
  { value: 'blog_dark',    label: '다크 에디토리얼' },
];

const FAL_FLUX_MODELS: { value: FalFluxModel; label: string; desc: string }[] = [
  { value: 'fal/flux-schnell', label: 'FLUX Schnell', desc: '초고속' },
  { value: 'fal/flux-dev',     label: 'FLUX Dev',     desc: '고품질' },
  { value: 'fal/flux-pro',     label: 'FLUX Pro',     desc: '최고품질' },
  { value: 'fal/flux-2-pro',   label: 'FLUX 2 Pro',   desc: '최신' },
];

function ThumbnailPanel({ script, topic }: { script: string; topic: string }) {
  const [thumbStatus, setThumbStatus] = useState<ThumbStatus>('idle');
  const [thumbStyle, setThumbStyle] = useState<ThumbStyle>('youtube_bold');
  const [thumbProvider, setThumbProvider] = useState<ThumbProvider>('fal');
  const [falModel, setFalModel] = useState<FalFluxModel>('fal/flux-schnell');
  const [images, setImages] = useState<{ url: string; prompt: string }[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [thumbError, setThumbError] = useState('');

  async function generate() {
    setThumbStatus('generating');
    setImages([]);
    setThumbError('');
    setSelectedIdx(null);
    try {
      const res = await fetch('/api/thumbnail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script, title: topic, style: thumbStyle, thumbnailType: 'youtube', imageProvider: thumbProvider, falModel }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '생성 실패');
      setImages(data.images ?? []);
      if (data.images?.length > 0) setSelectedIdx(0);
      setThumbStatus('done');
    } catch (e) {
      setThumbError(e instanceof Error ? e.message : '생성 오류');
      setThumbStatus('error');
    }
  }

  async function handleDownload(url: string, idx: number) {
    if (url.startsWith('data:')) {
      const a = document.createElement('a'); a.href = url; a.download = `thumbnail_${idx + 1}.jpg`; a.click();
    } else {
      const blob = await (await fetch(url)).blob();
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `thumbnail_${idx + 1}.jpg`; a.click();
    }
  }

  return (
    <div className="space-y-4">
      {/* 이미지 AI 선택 */}
      <div>
        <p className="text-white/30 text-[10px] font-semibold uppercase tracking-widest mb-2">이미지 AI</p>
        <div className="flex gap-1.5 mb-2">
          {(['fal', 'gemini'] as ThumbProvider[]).map(p => (
            <button
              key={p}
              onClick={() => setThumbProvider(p)}
              className={`flex-1 py-1.5 px-2 text-[11px] font-medium rounded-lg border transition-all ${
                thumbProvider === p
                  ? 'border-[#22c55e]/50 bg-[#22c55e]/10 text-white'
                  : 'border-white/8 text-white/40 hover:text-white/60 hover:border-white/15'
              }`}
            >
              {p === 'fal' ? 'fal.ai' : 'Gemini'}
            </button>
          ))}
        </div>
        {thumbProvider === 'fal' && (
          <div className="grid grid-cols-2 gap-1.5">
            {FAL_FLUX_MODELS.map(m => (
              <button
                key={m.value}
                onClick={() => setFalModel(m.value)}
                className={`py-1.5 px-1 text-[10px] font-medium rounded-lg border transition-all flex flex-col items-center gap-0.5 ${
                  falModel === m.value
                    ? 'border-[#22c55e]/50 bg-[#22c55e]/10 text-white'
                    : 'border-white/8 text-white/30 hover:text-white/55 hover:border-white/15'
                }`}
              >
                <span>{m.label}</span>
                <span className="text-[9px] text-white/30">{m.desc}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 스타일 선택 */}
      <div>
        <p className="text-white/30 text-[10px] font-semibold uppercase tracking-widest mb-2">썸네일 스타일</p>
        <div className="grid grid-cols-2 gap-1.5">
          {THUMB_STYLES.map(s => (
            <button
              key={s.value}
              onClick={() => setThumbStyle(s.value)}
              className={`py-1.5 px-2 text-[11px] font-medium rounded-lg border transition-all ${
                thumbStyle === s.value
                  ? 'border-[#22c55e]/50 bg-[#22c55e]/10 text-white'
                  : 'border-white/8 text-white/40 hover:text-white/60 hover:border-white/15'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* 생성 버튼 */}
      <button
        onClick={generate}
        disabled={thumbStatus === 'generating'}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-white/8 hover:bg-white/12 border border-white/10 hover:border-white/20 text-white/70 hover:text-white text-[12px] font-bold transition-all disabled:opacity-40"
      >
        {thumbStatus === 'generating' ? (
          <><Loader2 size={13} className="animate-spin" />대본 분석 중...</>
        ) : images.length > 0 ? (
          <><RefreshCw size={13} />다시 생성</>
        ) : (
          <><Wand2 size={13} />썸네일 생성</>
        )}
      </button>

      {thumbError && (
        <p className="text-red-400/70 text-[11px] font-medium">{thumbError}</p>
      )}

      {/* 생성된 이미지 */}
      {thumbStatus === 'done' && images.length > 0 && (
        <div className="space-y-2">
          {/* 선택된 이미지 크게 */}
          {selectedIdx !== null && (
            <div className="rounded-xl overflow-hidden border border-white/10">
              <div className="aspect-video relative">
                <img src={images[selectedIdx].url} alt="thumbnail" className="w-full h-full object-cover" />
                <div className="absolute top-1.5 right-1.5 flex gap-1">
                  <button
                    onClick={() => handleDownload(images[selectedIdx].url, selectedIdx)}
                    className="flex items-center gap-1 bg-black/70 hover:bg-black/90 text-white text-[10px] font-bold px-2 py-1 rounded transition-colors"
                  >
                    <Download size={10} />저장
                  </button>
                  {!images[selectedIdx].url.startsWith('data:') && (
                    <a href={images[selectedIdx].url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 bg-black/70 hover:bg-black/90 text-white text-[10px] font-bold px-2 py-1 rounded transition-colors"
                    >
                      <ExternalLink size={10} />원본
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 섬네일 그리드 */}
          <div className="grid grid-cols-3 gap-1.5">
            {images.map((img, idx) => (
              <div
                key={idx}
                onClick={() => setSelectedIdx(idx)}
                className={`cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                  selectedIdx === idx ? 'border-[#22c55e]/60' : 'border-white/8 hover:border-white/25'
                }`}
              >
                <div className="aspect-video">
                  <img src={img.url} alt={`thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 메인 페이지 ─────────────────────────────────────────────────────────────

export default function ScriptPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="w-5 h-5 border-2 border-white/10 border-t-white/40 rounded-full animate-spin" /></div>}>
      <ScriptPageInner />
    </Suspense>
  );
}

function ScriptPageInner() {
  const searchParams = useSearchParams();
  const [topic, setTopic] = useState('');
  const [tone, setTone] = useState<ToneId>('friendly_casual');
  const [category, setCategory] = useState('');
  const [llmModelId, setLlmModelId] = useState('claude-sonnet-4-6');
  const [keywords, setKeywords] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [videoLength, setVideoLength] = useState('');

  useEffect(() => {
    const urlTopic = searchParams.get('topic');
    const urlCategory = searchParams.get('category');
    if (urlTopic) {
      setTopic(urlTopic);
      if (urlCategory) {
        setCategory(urlCategory);
        const defaultTone = CATEGORY_DEFAULT_TONES[urlCategory];
        if (defaultTone) setTone(defaultTone);
      }
      return;
    }
    const savedTopic = sessionStorage.getItem('clipflow_script_topic');
    if (savedTopic) { sessionStorage.removeItem('clipflow_script_topic'); setTopic(savedTopic); }
    const savedCat = sessionStorage.getItem('clipflow_script_category');
    if (savedCat) {
      sessionStorage.removeItem('clipflow_script_category');
      setCategory(savedCat);
      const defaultTone = CATEGORY_DEFAULT_TONES[savedCat];
      if (defaultTone) setTone(defaultTone);
    }
  }, [searchParams]);

  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [topicFocused, setTopicFocused] = useState(false);
  const [script, setScript] = useState('');
  const [error, setError] = useState('');
  const [saveWarning, setSaveWarning] = useState('');
  const [copied, setCopied] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);

  // 에이전트 모드
  const [agentMode, setAgentMode] = useState(false);
  const [agentSteps, setAgentSteps] = useState<{ agent: string; status: 'done' | 'error'; summary: string }[]>([]);
  const [seoPackage, setSeoPackage] = useState<{
    titles: string[]; thumbnailText: string; description: string;
    hashtags: string[]; searchKeywords: string[];
  } | null>(null);

  async function handleGenerate() {
    if (!topic.trim()) return;
    setStatus('loading');
    setScript('');
    setError('');
    setSaveWarning('');
    setAgentSteps([]);
    setSeoPackage(null);

    if (agentMode) {
      // ── 멀티에이전트 모드 ──────────────────────────────────────────────────
      try {
        const res = await fetch('/api/generate-script-agent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ topic, category, model: llmModelId, tone, minLength: 3000 }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '에이전트 대본 생성 실패');
        setScript(data.script ?? '');
        setAgentSteps(data.steps ?? []);
        setSeoPackage(data.seo ?? null);
        setStatus('done');
        window.dispatchEvent(new Event('clipflow_script_updated'));
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : '에이전트 대본 생성에 실패했습니다.');
        setStatus('error');
      }
      return;
    }

    // ── 일반 모드 (기존) ───────────────────────────────────────────────────────
    try {
      const res = await fetch('/api/generate-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, tone, category, keywords, targetAudience, videoLength, llmModelId }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.needsKey) { setError(`__KEY__${data.error}`); }
        else { throw new Error(data.error || '대본 생성 실패'); }
      }
      setScript(data.script);
      setStatus('done');
      if (data.saveError) {
        setSaveWarning(`대본 저장 실패: ${data.saveError}`);
      }
      window.dispatchEvent(new Event('clipflow_script_updated'));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '대본 생성에 실패했습니다.');
      setStatus('error');
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(script);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleUseScript() {
    sessionStorage.setItem('clipflow_script', script);
    window.location.href = '/dashboard/video';
  }

  function handleMultiChannel() {
    sessionStorage.setItem('clipflow_reformat_script', script);
    sessionStorage.setItem('clipflow_reformat_topic', topic);
    window.location.href = '/dashboard/reformat';
  }

  const selectedLlm = SCRIPT_LLM_MODELS.find(m => m.id === llmModelId);
  const selectedTone = TONES.find(t => t.id === tone);

  return (
    <div className="flex gap-0 -m-6 min-h-full">
      {/* ─── 좌측: 입력 / 대본 ─── */}
      <div className="flex-1 min-w-0 p-6 border-r border-white/8">
        {(status === 'idle' || status === 'loading' || status === 'error') && (
          <>
            <div className="relative mt-4 mb-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-1 h-1 bg-green-500/70 rounded-full" />
                <span className="text-green-500/70 text-[11px] font-mono tracking-widest uppercase">Script</span>
              </div>
              <div
                className={`relative flex flex-col border transition-colors duration-200 bg-[#111] rounded-lg ${topicFocused ? 'border-white/15' : 'border-white/6'}`}
                onMouseEnter={() => setTopicFocused(true)}
                onMouseLeave={() => setTopicFocused(false)}
              >
                <textarea
                  value={topic}
                  onChange={e => setTopic(e.target.value)}
                  placeholder="주제, 키워드, 또는 문장으로 입력하세요"
                  className="w-full h-36 bg-transparent text-white/80 border-0 focus:outline-none resize-none text-[12px] leading-relaxed placeholder:text-white/15 px-4 pt-4 pb-2 font-mono"
                  disabled={status === 'loading'}
                />
                <div className="flex items-center justify-between px-4 py-2.5 border-t border-white/5">
                  <div className="flex items-center gap-2">
                    <span className="text-white/20 text-[10px] font-mono">{topic.length > 0 ? `${topic.length}자` : ''}</span>
                    {/* 모드 토글 */}
                    <div className="flex items-center gap-0.5 bg-white/[0.03] border border-white/8 p-0.5 rounded-full">
                      <button
                        onClick={() => { setAgentMode(false); setAgentSteps([]); setSeoPackage(null); }}
                        className={`px-2 py-0.5 text-[9px] font-mono rounded-full transition-colors ${!agentMode ? 'bg-white/10 text-white' : 'text-white/30 hover:text-white/50'}`}
                      >일반</button>
                      <button
                        onClick={() => setAgentMode(true)}
                        className={`px-2 py-0.5 text-[9px] font-mono rounded-full transition-colors ${agentMode ? 'bg-[#22c55e]/20 text-[#22c55e]' : 'text-white/30 hover:text-white/50'}`}
                      >에이전트</button>
                    </div>
                  </div>
                  <button
                    onClick={handleGenerate}
                    disabled={!topic.trim() || status === 'loading'}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full border border-[#22c55e]/40 hover:border-[#22c55e]/70 hover:bg-[#22c55e]/8 disabled:border-white/8 disabled:cursor-not-allowed text-[#22c55e] disabled:text-white/20 text-[11px] font-mono tracking-widest uppercase transition-colors"
                  >
                    {status === 'loading' ? (
                      <><span className="w-3 h-3 border border-white/30 border-t-white/60 rounded-full animate-spin" />{agentMode ? '에이전트 작업 중' : '생성 중'}</>
                    ) : agentMode ? '에이전트 생성 →' : '생성 →'}
                  </button>
                </div>
              </div>
            </div>
            {error && (
              <div className="border-l-2 border-red-500 pl-4 mb-4">
                <p className="text-red-400 text-xs font-mono">{error.replace('__KEY__', '')}</p>
                <div className="mt-2 flex items-center gap-3">
                  <button onClick={() => setStatus('idle')} className="text-white/25 hover:text-white/60 text-xs font-mono transition-colors">다시 시도 →</button>
                  {error.startsWith('__KEY__') && (
                    <a href="/dashboard/settings" className="text-green-500/70 hover:text-green-500 text-xs font-mono transition-colors">API 키 설정 →</a>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {status === 'done' && (
          <>
            {saveWarning && (
              <div className="mb-4 px-3 py-2 border-l-2 border-green-500 bg-green-500/5">
                <p className="text-green-500 text-xs font-mono">{saveWarning}</p>
              </div>
            )}

            {/* 에이전트 스텝 결과 */}
            {agentMode && agentSteps.length > 0 && (
              <div className="mb-4 border border-white/6 rounded-lg p-3 bg-white/[0.01] space-y-1.5">
                <p className="text-[9px] font-bold text-white/25 uppercase tracking-widest mb-2">에이전트 작업 내역</p>
                {agentSteps.map((step, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className={`text-[10px] mt-0.5 ${step.status === 'done' ? 'text-[#22c55e]/60' : 'text-red-400/60'}`}>
                      {step.status === 'done' ? '✓' : '✗'}
                    </span>
                    <div>
                      <span className="text-[11px] font-bold text-white/50">{step.agent}</span>
                      <span className="text-[10px] text-white/25 font-mono ml-1.5">{step.summary}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/5">
              <span className="text-[white]/70 text-[13px] tracking-widest uppercase font-mono">완성된 대본</span>
              <button onClick={() => { setStatus('idle'); setScript(''); setAgentSteps([]); setSeoPackage(null); }} className="text-white/40 hover:text-white/70 text-xs font-mono transition-colors">← 다시 만들기</button>
            </div>
            <div className="relative group">
              <textarea
                value={script}
                onChange={e => setScript(e.target.value)}
                className="w-full h-[500px] bg-transparent text-white/80 text-[13px] font-mono leading-relaxed border-0 focus:outline-none resize-none pb-12"
              />
              <div className="absolute bottom-4 right-4">
                <button
                  onClick={handleCopy}
                  className={`px-3 py-1.5 text-[12.5px] font-mono border transition-colors ${
                    copied ? 'border-green-400 text-green-400' : 'border-white/20 text-white/55 hover:border-white/40 hover:text-white/80'
                  }`}
                >
                  {copied ? 'COPIED!' : 'COPY'}
                </button>
              </div>
            </div>
            {/* SEO 패키지 (에이전트 모드) */}
            {agentMode && seoPackage && (
              <div className="mt-6 border border-[#22c55e]/15 rounded-lg overflow-hidden bg-[#22c55e]/[0.02]">
                <p className="text-[10px] font-bold text-[#22c55e]/50 uppercase tracking-widest px-4 py-2.5 border-b border-[#22c55e]/10">
                  SEO 패키지
                </p>
                <div className="p-4 space-y-3">
                  {seoPackage.titles.length > 0 && (
                    <div>
                      <p className="text-[9px] font-mono text-white/25 uppercase tracking-widest mb-1.5">추천 제목</p>
                      {seoPackage.titles.slice(0, 3).map((t, i) => (
                        <p key={i} className="text-[12px] text-white/60 font-mono leading-relaxed">• {t}</p>
                      ))}
                    </div>
                  )}
                  {seoPackage.thumbnailText && (
                    <div>
                      <p className="text-[9px] font-mono text-white/25 uppercase tracking-widest mb-1">썸네일 텍스트</p>
                      <p className="text-[12px] text-[#22c55e]/70 font-bold">{seoPackage.thumbnailText}</p>
                    </div>
                  )}
                  {seoPackage.description && (
                    <div>
                      <p className="text-[9px] font-mono text-white/25 uppercase tracking-widest mb-1">영상 설명</p>
                      <p className="text-[11px] text-white/45 font-mono leading-relaxed">{seoPackage.description.slice(0, 200)}{seoPackage.description.length > 200 ? '...' : ''}</p>
                    </div>
                  )}
                  {seoPackage.hashtags.length > 0 && (
                    <div>
                      <p className="text-[9px] font-mono text-white/25 uppercase tracking-widest mb-1.5">해시태그</p>
                      <div className="flex flex-wrap gap-1">
                        {seoPackage.hashtags.slice(0, 10).map((h, i) => (
                          <span key={i} className="text-[10px] font-mono text-[#22c55e]/50 bg-[#22c55e]/5 border border-[#22c55e]/15 px-1.5 py-0.5 rounded">{h}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center gap-8 mt-12 pb-10">
              <button onClick={handleUseScript} className="group flex items-center gap-3 text-green-500 text-[13px] font-bold tracking-[0.15em] font-mono transition-all hover:text-green-400">
                영상만들기
                <span className="w-8 h-[1px] bg-green-500/30 group-hover:w-12 group-hover:bg-green-500 transition-all duration-300" />
              </button>
              <button onClick={handleMultiChannel} className="group flex items-center gap-3 text-white/40 text-[13px] font-bold tracking-[0.15em] font-mono transition-all hover:text-white/70">
                멀티채널 배포
                <span className="w-8 h-[1px] bg-white/10 group-hover:w-12 group-hover:bg-white/30 transition-all duration-300" />
              </button>
              <button onClick={() => { setStatus('idle'); setScript(''); setAgentSteps([]); setSeoPackage(null); }} className="text-white/20 hover:text-white/50 text-[11px] font-mono tracking-widest uppercase transition-colors">
                새 대본 작성하기
              </button>
            </div>
          </>
        )}
      </div>

      {/* ─── 우측 사이드바 ─── */}
      <aside className="w-96 shrink-0 flex flex-col border-l border-white/8 overflow-y-auto bg-[#0d0d0d]">
        <div className="flex-1 px-5 py-5 space-y-6">

          {/* 대본 완성 → 썸네일 패널로 전환 */}
          {status === 'done' ? (
            <>
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <span className="w-1.5 h-1.5 bg-[#22c55e] rounded-full" />
                  <span className="text-[#22c55e] text-[11px] font-bold uppercase tracking-widest">썸네일 생성</span>
                </div>
                <p className="text-[11px] font-medium text-white/30 mb-4 leading-relaxed">
                  대본 전체를 AI가 분석해 분위기·핵심 비주얼을 추출하고 썸네일을 자동 생성합니다
                </p>
                <ThumbnailPanel script={script} topic={topic} />
              </div>

              <div className="border-t border-white/5 pt-4">
                <p className="text-white/20 text-[10px] font-semibold uppercase tracking-widest mb-3">다음 단계</p>
                <div className="space-y-2">
                  <button onClick={handleUseScript} className="w-full text-left px-3 py-2 rounded-lg border border-white/8 hover:border-[#22c55e]/30 hover:bg-[#22c55e]/5 text-white/50 hover:text-white/80 text-[12px] font-medium transition-all">
                    → 영상 만들기
                  </button>
                  <button onClick={handleMultiChannel} className="w-full text-left px-3 py-2 rounded-lg border border-white/8 hover:border-white/20 text-white/50 hover:text-white/80 text-[12px] font-medium transition-all">
                    → 멀티채널 배포
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* 입력 중 → 설정 패널 */}
              {category && (
                <div className="flex items-center gap-2">
                  <span className="text-white/30 text-xs font-medium">카테고리</span>
                  <span className="text-xs font-medium text-white/60 bg-white/8 border border-white/10 px-2.5 py-1 rounded-full">
                    {CATEGORY_LABELS[category] ?? category}
                  </span>
                </div>
              )}

              <div>
                <p className="text-white/40 text-[11px] font-semibold uppercase tracking-widest mb-2.5">톤 / 분위기</p>
                {(!category || category === 'general') ? (
                  <div className="flex flex-col gap-1.5">
                    {TONES.map(t => (
                      <button
                        key={t.id}
                        onClick={() => setTone(t.id)}
                        disabled={status === 'loading'}
                        className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm border transition-colors ${
                          tone === t.id
                            ? 'border-[#22c55e]/60 text-white bg-[#22c55e]/10'
                            : 'border-white/8 text-white/50 hover:border-white/20 hover:text-white/80 hover:bg-white/4'
                        }`}
                      >
                        <span className="text-[12px] font-medium">{t.label}</span>
                        <span className={`text-[10px] ${tone === t.id ? 'text-[#22c55e]/60' : 'text-white/20'}`}>{t.sub}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-white/30 text-sm leading-relaxed">이 카테고리는 전용 프롬프트의 내장 톤으로 자동 적용됩니다.</p>
                )}
              </div>

              <div>
                <p className="text-white/40 text-[11px] font-semibold uppercase tracking-widest mb-2.5">추가 옵션</p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-white/40 text-[11px] font-medium mb-1.5">영상 목표 길이</label>
                    <select value={videoLength} onChange={e => setVideoLength(e.target.value)} disabled={status === 'loading'}
                      className="w-full bg-[#1a1a1a] text-white/70 px-3 py-2 border border-white/10 focus:border-white/25 focus:outline-none text-[12px] font-medium rounded-lg cursor-pointer [&>option]:bg-[#1a1a1a]">
                      <option value="">선택 안 함</option>
                      <option value="5분 내외 (3,000자 이상)">5분 내외</option>
                      <option value="10분 내외 (5,000자 이상)">10분 내외</option>
                      <option value="15분 내외 (7,000자 이상)">15분 내외</option>
                      <option value="20분 이상 (9,000자 이상)">20분 이상</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-white/40 text-[11px] font-medium mb-1.5">핵심 키워드</label>
                    <input value={keywords} onChange={e => setKeywords(e.target.value)} placeholder="예: 성능, 배터리, 카메라"
                      className="w-full bg-[#1a1a1a] text-white/70 px-3 py-2 border border-white/10 focus:border-white/25 focus:outline-none text-[12px] font-medium rounded-lg placeholder:text-white/25" disabled={status === 'loading'} />
                  </div>
                  <div>
                    <label className="block text-white/40 text-[11px] font-medium mb-1.5">타겟 시청자</label>
                    <input value={targetAudience} onChange={e => setTargetAudience(e.target.value)} placeholder="예: 20~30대 직장인"
                      className="w-full bg-[#1a1a1a] text-white/70 px-3 py-2 border border-white/10 focus:border-white/25 focus:outline-none text-[12px] font-medium rounded-lg placeholder:text-white/25" disabled={status === 'loading'} />
                  </div>
                </div>
              </div>

              <PanelAccordion label="AI 모델" value={selectedLlm?.name ?? ''} open={modelOpen} onToggle={() => setModelOpen(prev => !prev)}>
                <div className="space-y-3">
                  {(['Anthropic', 'Google', 'Alibaba'] as const).map(provider => (
                    <div key={provider}>
                      <p className="text-white/25 text-[11px] font-semibold uppercase tracking-wide px-1 mb-1.5">{provider}</p>
                      <div className="space-y-1">
                        {SCRIPT_LLM_MODELS.filter(m => m.provider === provider).map(m => (
                          <OptionItem key={m.id} active={llmModelId === m.id} onClick={() => { setLlmModelId(m.id); setModelOpen(false); }} sub={m.price} provider={provider}>
                            {m.name}
                          </OptionItem>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </PanelAccordion>

              <div className="pt-4 border-t border-white/5 space-y-2">
                <p className="text-white/30 text-[11px] font-semibold uppercase tracking-widest mb-3">대본 설정 요약</p>
                <div className="flex justify-between text-[12px]">
                  <span className="text-white/35">톤</span>
                  <span className="text-white/65 font-medium">{(!category || category === 'general') ? selectedTone?.label : '카테고리 내장'}</span>
                </div>
                <div className="flex justify-between text-[12px]">
                  <span className="text-white/35">AI 모델</span>
                  <span className="text-white/65 font-medium">{selectedLlm?.name}</span>
                </div>
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
