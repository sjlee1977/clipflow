'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Download, ExternalLink, Wand2, Loader2, RefreshCw, Bot, Sparkles, CheckCircle2, ChevronDown, ChevronUp, BarChart2, Lightbulb, TrendingUp, X, PenLine } from 'lucide-react';

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

const CATEGORY_COLORS: Record<string, string> = {
  general:    'text-sky-400 border-sky-400/30 bg-sky-400/[0.07]',
  economy:    'text-green-400 border-green-400/30 bg-green-400/[0.07]',
  horror:     'text-red-400 border-red-400/30 bg-red-400/[0.07]',
  psychology: 'text-purple-400 border-purple-400/30 bg-purple-400/[0.07]',
  health:     'text-lime-400 border-lime-400/30 bg-lime-400/[0.07]',
  history:    'text-amber-400 border-amber-400/30 bg-amber-400/[0.07]',
};

function PanelAccordion({ label, value, open, onToggle, children }: {
  label: string; value: string; open: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className="border-b border-white/5 mb-1">
      <button onClick={onToggle} className="w-full flex items-center justify-between py-3 group">
        <span className="text-[white]/70 text-[13px] tracking-widest uppercase">{label}</span>
        <span className="flex items-center gap-2">
          <span className="text-white/70 text-[13px] font-mono truncate max-w-[120px]">{value}</span>
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
  return <span className={`text-[11px] font-mono px-1.5 py-0.5 rounded-sm whitespace-nowrap ${cls}`}>{isFree ? 'FREE' : price}</span>;
}

function OptionItem({ active, onClick, children, sub }: {
  active: boolean; onClick: () => void; children: React.ReactNode; sub?: string;
}) {
  return (
    <button onClick={onClick} className={`sidebar-btn w-full flex items-center justify-between px-2 py-2 text-[12.5px] font-bold border-l-2 transition-colors ${
      active ? 'border-[#4f8ef7] text-[#4f8ef7] bg-[#4f8ef7]/5' : 'border-transparent text-white/65 hover:text-white hover:border-white/30 hover:bg-white/5'
    }`}>
      <span>{children}</span>
      <PriceBadge price={sub} />
    </button>
  );
}

// ─── 인라인 썸네일 패널 ──────────────────────────────────────────────────────

type ThumbStatus = 'idle' | 'generating' | 'done' | 'error';
type ThumbStyle = 'youtube_bold' | 'youtube_face' | 'blog_clean' | 'blog_dark';

const THUMB_STYLES: { value: ThumbStyle; label: string }[] = [
  { value: 'youtube_bold', label: '임팩트 볼드' },
  { value: 'youtube_face', label: '리액션 페이스' },
  { value: 'blog_clean',   label: '클린 미니멀' },
  { value: 'blog_dark',    label: '다크 에디토리얼' },
];

const THUMB_IMAGE_MODELS = [
  { id: 'google/gemini-2.5-flash-image',   name: 'Gemini 2.5 Flash (이미지)', provider: 'Google', price: '균형' },
  { id: 'fal/z-image-turbo',               name: 'Z-Image Turbo (fal.ai)',    provider: 'fal.ai', price: '빠름' },
  { id: 'fal/z-image-base',                name: 'Z-Image Base (fal.ai)',     provider: 'fal.ai', price: '고품질' },
  { id: 'qwen/qwen-image-2.0',             name: 'Qwen Image 2.0 (Qwen)',     provider: 'Qwen',   price: '가성비' },
  { id: 'qwen/qwen-image-edit-max',        name: 'Qwen Image Edit Max (Qwen)', provider: 'Qwen',  price: '고품질' },
];
const THUMB_IMAGE_PROVIDERS = ['Google', 'fal.ai', 'Qwen'] as const;

function ThumbnailPanel({ script, topic, imageModel, llmModelId }: { script: string; topic: string; imageModel: string; llmModelId: string }) {
  const [thumbStatus, setThumbStatus] = useState<ThumbStatus>('idle');
  const [thumbStyle, setThumbStyle] = useState<ThumbStyle>('youtube_bold');
  const [images, setImages] = useState<{ url: string; prompt: string }[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [thumbError, setThumbError] = useState('');
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [savedIds, setSavedIds] = useState<(string | null)[]>([]);

  async function saveThumbnails(imgs: { url: string; prompt: string }[]) {
    const ids: (string | null)[] = [];
    for (const img of imgs) {
      try {
        const res = await fetch('/api/thumbnails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: topic || '썸네일',
            style: thumbStyle,
            thumbnail_type: 'youtube',
            image_url: img.url,
            prompt: img.prompt,
          }),
        });
        const data = await res.json();
        ids.push(data.id ?? null);
      } catch {
        ids.push(null);
      }
    }
    setSavedIds(ids);
    window.dispatchEvent(new Event('clipflow_thumbnail_saved'));
  }

  async function generate() {
    setThumbStatus('generating');
    setImages([]);
    setThumbError('');
    setSelectedIdx(null);
    setSavedIds([]);
    try {
      const res = await fetch('/api/thumbnail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script, title: topic, style: thumbStyle, thumbnailType: 'youtube', imageModel, llmModelId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '생성 실패');
      const imgs: { url: string; prompt: string }[] = data.images ?? [];
      setImages(imgs);
      if (imgs.length > 0) setSelectedIdx(0);
      setThumbStatus('done');
      // 자동 저장
      if (imgs.length > 0) saveThumbnails(imgs);
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
      {/* 스타일 선택 */}
      <div>
        <p className="text-white/30 text-[10px] font-mono uppercase tracking-wider mb-2">썸네일 스타일</p>
        <div className="grid grid-cols-2 gap-1.5">
          {THUMB_STYLES.map(s => (
            <button
              key={s.value}
              onClick={() => setThumbStyle(s.value)}
              className={`py-1.5 px-2 text-[11px] font-mono rounded-xl border transition-all ${
                thumbStyle === s.value
                  ? 'border-[#4f8ef7]/50 bg-[#4f8ef7]/10 text-white'
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
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/8 hover:bg-white/12 border border-white/10 hover:border-white/20 text-white/70 hover:text-white text-[12px] font-bold transition-all disabled:opacity-40"
      >
        {thumbStatus === 'generating' ? (
          <><Loader2 size={13} className="animate-spin" />이미지 생성 중 (최대 40초)...</>
        ) : images.length > 0 ? (
          <><RefreshCw size={13} />다시 생성</>
        ) : (
          <><Wand2 size={13} />썸네일 생성</>
        )}
      </button>

      {thumbError && (
        <p className="text-red-400/70 text-[11px] font-mono">{thumbError}</p>
      )}

      {/* 라이트박스 오버레이 */}
      {lightboxOpen && selectedIdx !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => setLightboxOpen(false)}
        >
          <div className="relative max-w-[90vw] max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <img
              src={images[selectedIdx].url}
              alt="thumbnail full"
              className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
            />
            <div className="absolute top-2 right-2 flex gap-1.5">
              <button
                onClick={() => handleDownload(images[selectedIdx].url, selectedIdx)}
                className="flex items-center gap-1 bg-black/70 hover:bg-black/90 text-white text-[11px] font-bold px-2.5 py-1.5 rounded transition-colors"
              >
                <Download size={11} />저장
              </button>
              <button
                onClick={() => setLightboxOpen(false)}
                className="flex items-center justify-center w-7 h-7 bg-black/70 hover:bg-black/90 text-white rounded transition-colors text-[14px] font-bold"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 생성된 이미지 */}
      {thumbStatus === 'done' && images.length > 0 && (
        <div className="space-y-2">
          {/* 선택된 이미지 크게 */}
          {selectedIdx !== null && (
            <div
              className="rounded-xl overflow-hidden border border-white/10 cursor-zoom-in"
              onClick={() => setLightboxOpen(true)}
              title="클릭하면 원본 크기로 보기"
            >
              <div className="aspect-video relative">
                <img src={images[selectedIdx].url} alt="thumbnail" className="w-full h-full object-cover" />
                <div className="absolute top-1.5 right-1.5 flex gap-1" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => handleDownload(images[selectedIdx].url, selectedIdx)}
                    className="flex items-center gap-1 bg-black/70 hover:bg-black/90 text-white text-[10px] font-bold px-2 py-1 rounded transition-colors"
                  >
                    <Download size={10} />저장
                  </button>
                  <button
                    onClick={() => setLightboxOpen(true)}
                    className="flex items-center gap-1 bg-black/70 hover:bg-black/90 text-white text-[10px] font-bold px-2 py-1 rounded transition-colors"
                  >
                    <ExternalLink size={10} />원본
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 저장 상태 */}
          {savedIds.length > 0 && (
            <div className="flex items-center gap-1.5 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#4f8ef7]" />
              <span className="text-[#4f8ef7] text-[11px] font-mono">내 썸네일에 자동 저장됨</span>
            </div>
          )}

          {/* 썸네일 그리드 */}
          <div className="grid grid-cols-3 gap-1.5">
            {images.map((img, idx) => (
              <div
                key={idx}
                onClick={() => setSelectedIdx(idx)}
                className={`relative cursor-pointer rounded-xl overflow-hidden border-2 transition-all ${
                  selectedIdx === idx ? 'border-[#4f8ef7]/60' : 'border-white/8 hover:border-white/25'
                }`}
              >
                <div className="aspect-video">
                  <img src={img.url} alt={`thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
                </div>
                {savedIds[idx] && (
                  <div className="absolute bottom-1 right-1 bg-black/60 rounded px-1 py-0.5">
                    <span className="text-[#4f8ef7] text-[9px] font-mono">저장됨</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 에러 파싱 ────────────────────────────────────────────────────────────────

interface ParsedError {
  title: string;
  message: string;
  detail?: string;
  type: 'quota' | 'key' | 'generic';
}

function parseError(raw: string): ParsedError {
  const clean = raw.replace('__KEY__', '');

  // JSON 에러 파싱 시도
  try {
    const match = clean.match(/\{[\s\S]*\}/);
    if (match) {
      const obj = JSON.parse(match[0]);
      const inner = obj?.error ?? obj;
      const code: number = inner?.code ?? 0;
      const status: string = inner?.status ?? '';
      const msg: string = inner?.message ?? '';

      if (code === 429 || status === 'RESOURCE_EXHAUSTED') {
        return {
          title: 'API 한도 초과',
          message: '이 모델의 월간 사용 한도가 초과되었습니다.',
          detail: '사이드바에서 다른 AI 모델(Claude 또는 Qwen)로 변경 후 다시 시도하세요.',
          type: 'quota',
        };
      }
      if (code === 401 || code === 403 || status === 'UNAUTHENTICATED' || status === 'PERMISSION_DENIED') {
        return {
          title: 'API 키 오류',
          message: 'API 키가 유효하지 않거나 권한이 없습니다.',
          detail: '설정 페이지에서 올바른 API 키를 등록했는지 확인하세요.',
          type: 'key',
        };
      }
      if (msg) {
        return { title: '생성 오류', message: msg, type: 'generic' };
      }
    }
  } catch { /* 무시 */ }

  if (raw.startsWith('__KEY__')) {
    return {
      title: 'API 키 필요',
      message: clean,
      detail: '설정 페이지에서 API 키를 등록하세요.',
      type: 'key',
    };
  }

  return { title: '오류 발생', message: clean, type: 'generic' };
}

// ─── 에러 모달 ────────────────────────────────────────────────────────────────

function ErrorModal({ raw, onClose, onRetry }: { raw: string; onClose: () => void; onRetry: () => void }) {
  const err = parseError(raw);

  const iconMap = {
    quota:   { bg: 'bg-amber-500/10', border: 'border-amber-500/20', icon: '⚡', color: 'text-amber-400' },
    key:     { bg: 'bg-red-500/10',   border: 'border-red-500/20',   icon: '🔑', color: 'text-red-400' },
    generic: { bg: 'bg-red-500/10',   border: 'border-red-500/20',   icon: '⚠',  color: 'text-red-400' },
  };
  const style = iconMap[err.type];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md rounded-2xl bg-black border border-white/10 shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* 상단 색상 바 */}
        <div className={`h-1 w-full ${err.type === 'quota' ? 'bg-amber-500/60' : 'bg-red-500/60'}`} />

        <div className="p-6">
          {/* 아이콘 + 제목 */}
          <div className="flex items-start gap-4 mb-4">
            <div className={`flex items-center justify-center w-10 h-10 rounded-xl border ${style.bg} ${style.border} shrink-0`}>
              <span className="text-lg leading-none">{style.icon}</span>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className={`text-[15px] font-bold mb-1 ${style.color}`}>{err.title}</h3>
              <p className="text-white/70 text-[13px] leading-relaxed">{err.message}</p>
            </div>
            <button
              onClick={onClose}
              className="sidebar-btn shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-white/30 hover:text-white/70 hover:bg-white/8 transition-colors text-[14px]"
            >
              ✕
            </button>
          </div>

          {/* 상세 안내 */}
          {err.detail && (
            <div className={`rounded-xl px-4 py-3 border mb-5 ${style.bg} ${style.border}`}>
              <p className={`text-[12px] leading-relaxed ${style.color} opacity-80`}>{err.detail}</p>
            </div>
          )}

          {/* 액션 버튼 */}
          <div className="flex items-center justify-end gap-2">
            {err.type === 'key' && (
              <a
                href="/dashboard/settings"
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white/60 hover:text-white text-[12px] font-bold transition-all"
              >
                API 키 설정 →
              </a>
            )}
            {err.type === 'quota' && (
              <span className="text-white/30 text-[11px] font-mono mr-auto">사이드바 &gt; AI 모델 변경</span>
            )}
            <button
              onClick={() => { onClose(); onRetry(); }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#4f8ef7]/10 hover:bg-[#4f8ef7]/20 border border-[#4f8ef7]/25 hover:border-[#4f8ef7]/45 text-[#4f8ef7] text-[12px] font-bold transition-all"
            >
              다시 시도
            </button>
          </div>
        </div>
      </div>
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
    // 프롬프트 페이지에서 대본이 이미 생성되어 전달된 경우
    const savedScript = sessionStorage.getItem('clipflow_script_result');
    if (savedScript) {
      sessionStorage.removeItem('clipflow_script_result');
      setScript(savedScript);
      setStatus('done');
      const savedTopic = sessionStorage.getItem('clipflow_script_topic');
      if (savedTopic) { sessionStorage.removeItem('clipflow_script_topic'); setTopic(savedTopic); }
      const savedCat = sessionStorage.getItem('clipflow_script_category');
      if (savedCat) { sessionStorage.removeItem('clipflow_script_category'); setCategory(savedCat); }
      return;
    }

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
  const [imageModelId, setImageModelId] = useState('google/gemini-2.5-flash-image');
  const [imageModelOpen, setImageModelOpen] = useState(false);
  const scriptOutputRef = useRef<HTMLDivElement>(null);

  const [scriptMode, setScriptMode] = useState<'standard' | 'agent'>('standard');
  const [agentSteps, setAgentSteps] = useState<{ agent: string; status: string; summary: string }[]>([]);
  const [seoPackage, setSeoPackage] = useState<{
    titles: string[]; thumbnailText: string; description: string; hashtags: string[]; searchKeywords: string[];
  } | null>(null);
  const [directorStrategy, setDirectorStrategy] = useState('');
  const [seoExpanded, setSeoExpanded] = useState(true);

  // 주제 추천
  type TopicSuggestion = { title: string; angle: string; type: string; whyNow: string; hook: string };
  const [suggestions, setSuggestions] = useState<TopicSuggestion[]>([]);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState('');
  const [trendSource, setTrendSource] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  async function handleSuggest() {
    if (!topic.trim()) return;
    setSuggesting(true);
    setSuggestError('');
    setSuggestions([]);
    try {
      const res = await fetch('/api/suggest-topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: topic.trim(), category, model: llmModelId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '주제 추천 실패');
      setSuggestions(data.suggestions ?? []);
      setTrendSource(data.trendSource ?? '');
      setShowSuggestions(true);
    } catch (err: unknown) {
      setSuggestError(err instanceof Error ? err.message : '오류 발생');
    } finally {
      setSuggesting(false);
    }
  }

  function selectSuggestion(s: TopicSuggestion) {
    setTopic(s.title);
    setShowSuggestions(false);
    setSuggestions([]);
  }

  async function handleGenerate() {
    if (!topic.trim()) return;
    setStatus('loading');
    setScript('');
    setError('');
    setSaveWarning('');
    setAgentSteps([]);
    setSeoPackage(null);
    setDirectorStrategy('');
    try {
      if (scriptMode === 'agent') {
        const res = await fetch('/api/generate-script-agent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ topic, tone, category, model: llmModelId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '에이전트 대본 생성 실패');
        setScript(data.script);
        if (data.steps) setAgentSteps(data.steps);
        if (data.seo) setSeoPackage(data.seo);
        if (data.strategy) setDirectorStrategy(
          typeof data.strategy === 'string' ? data.strategy : JSON.stringify(data.strategy, null, 2)
        );
      } else {
        const res = await fetch('/api/generate-script', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ topic, tone, category, keywords, targetAudience, videoLength, llmModelId }),
        });
        const data = await res.json();
        if (!res.ok) {
          if (data.needsKey) { setError(`__KEY__${data.error}`); }
          else { throw new Error(data.error || '대본 생성 실패'); }
          setStatus('error');
          return;
        }
        setScript(data.script);
        if (data.saveError) setSaveWarning(`대본 저장 실패: ${data.saveError}`);
      }
      setStatus('done');
      setTimeout(() => scriptOutputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
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
    <div className="flex gap-0 -m-6" style={{ minHeight: 'calc(100vh - 56px)' }}>
      {/* ─── 좌측: 입력 / 대본 ─── */}
      <div className="flex-1 min-w-0 p-6 overflow-y-auto" style={{ borderRight: '1px solid var(--border)' }}>

        {/* ── 입력 폼 (항상 표시) ── */}
        <div className="relative mt-4 mb-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="w-7 h-7 flex items-center justify-center rounded-lg shrink-0" style={{ background: 'rgba(79,142,247,0.06)', border: '1px solid rgba(79,142,247,0.22)', color: '#4f8ef7' }}>
                <PenLine size={13} strokeWidth={1.8} />
              </span>
              <span className="text-sm font-semibold text-white">대본 만들기</span>
            </div>
            {/* 모드 토글 */}
            <div className="flex gap-0.5 bg-white/[0.04] rounded-lg p-0.5 border border-white/8">
              <button
                onClick={() => setScriptMode('standard')}
                className={`flex items-center gap-1 text-[10px] font-mono px-2.5 py-1 rounded-md transition-colors ${
                  scriptMode === 'standard' ? 'bg-white/10 text-white' : 'text-white/30 hover:text-white/60'
                }`}
              >
                <Wand2 size={9} />표준
              </button>
              <button
                onClick={() => setScriptMode('agent')}
                className={`flex items-center gap-1 text-[10px] font-mono px-2.5 py-1 rounded-md transition-colors ${
                  scriptMode === 'agent' ? 'bg-[#4f8ef7]/20 text-[#4f8ef7]' : 'text-white/30 hover:text-white/60'
                }`}
              >
                <Bot size={9} />멀티에이전트
              </button>
            </div>
          </div>
          {scriptMode === 'agent' && (
            <div className="flex items-center gap-2 bg-[#4f8ef7]/5 border border-[#4f8ef7]/15 rounded-xl px-3 py-2 mb-3">
              <Sparkles size={11} className="text-[#4f8ef7]/60 shrink-0" />
              <p className="text-[11px] font-mono text-white/40">감독 → 작가 → 토론 → 프로듀서 → SEO 5단계 파이프라인</p>
            </div>
          )}
          <div
            className={`relative flex flex-col border transition-colors duration-200 bg-black rounded-xl ${topicFocused ? 'border-[#4f8ef7]/50' : 'border-[rgba(79,142,247,0.15)]'}`}
            onMouseEnter={() => setTopicFocused(true)}
            onMouseLeave={() => setTopicFocused(false)}
          >
            <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
              <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'rgba(79,142,247,0.5)' }}>Script Input</span>
              <span className="text-white/25 text-xs tabular-nums">{topic.length}자</span>
            </div>
            <textarea
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder="예: 아이폰 16 vs 갤럭시 S25 비교, 10분 만에 파스타 만들기, AI가 바꾸는 미래 직업..."
              className="w-full h-40 bg-transparent text-white border-0 focus:outline-none resize-none text-[13px] leading-relaxed placeholder:text-white/20 px-4 pt-3 pb-2"
              disabled={status === 'loading'}
            />
            <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: '1px solid var(--border)' }}>
              <div className="flex items-center gap-2">
                <span className="text-white/25 text-xs">주제 · 키워드 · 문장 모두 가능</span>
                {/* 주제 추천 버튼 — 단어/짧은 키워드 입력 시 */}
                {topic.trim().length > 0 && topic.trim().length <= 20 && status !== 'loading' && (
                  <button
                    onClick={handleSuggest}
                    disabled={suggesting}
                    className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg border border-[#4f8ef7]/25 bg-[#4f8ef7]/8 hover:bg-[#4f8ef7]/15 text-[#4f8ef7]/80 hover:text-[#4f8ef7] transition-colors disabled:opacity-50"
                  >
                    {suggesting
                      ? <><Loader2 size={10} className="animate-spin" />추천 중...</>
                      : <><Lightbulb size={10} />주제 7개 추천</>
                    }
                  </button>
                )}
              </div>
              <button
                onClick={handleGenerate}
                disabled={!topic.trim() || status === 'loading'}
                className="inline-flex items-center gap-2 px-5 py-2 bg-[#4f8ef7] hover:bg-[#0284c7] disabled:bg-white/8 disabled:cursor-not-allowed text-black disabled:text-white/25 font-bold text-[13px] rounded-xl transition-colors shadow-[0_0_16px_rgba(56,189,248,0.35)] disabled:shadow-none"
              >
                {status === 'loading' ? (
                  <><span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  {scriptMode === 'agent' ? '에이전트 작동 중...' : '생성 중...'}</>
                ) : scriptMode === 'agent' ? <><Bot size={13} />에이전트 대본 생성 →</> : '대본 생성 →'}
              </button>
            </div>
          </div>

          {/* 주제 추천 에러 */}
          {suggestError && (
            <p className="text-red-400/70 text-[12px] font-mono px-1">{suggestError}</p>
          )}

          {/* 주제 추천 결과 카드 */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="rounded-xl border border-[#4f8ef7]/20 bg-[#4f8ef7]/[0.03] overflow-hidden">
              {/* 헤더 */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
                <div className="flex items-center gap-2">
                  <TrendingUp size={13} className="text-[#4f8ef7]/70" />
                  <span className="text-[12px] font-bold text-white/60">트렌드 기반 주제 추천</span>
                  {trendSource && (
                    <span className="text-[10px] font-mono bg-[#4f8ef7]/10 border border-[#4f8ef7]/20 px-2 py-0.5 rounded-full text-[#4f8ef7]/60">
                      {trendSource}
                    </span>
                  )}
                </div>
                <button onClick={() => setShowSuggestions(false)} className="text-white/30 hover:text-white/60 transition-colors">
                  <X size={13} />
                </button>
              </div>

              {/* 카드 목록 */}
              <div className="divide-y divide-white/5">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => selectSuggestion(s)}
                    className="w-full text-left px-4 py-3 hover:bg-white/[0.03] transition-colors group"
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-[11px] font-mono text-white/20 mt-0.5 w-4 shrink-0">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-[13px] font-bold text-white/80 group-hover:text-white transition-colors leading-snug">
                            {s.title}
                          </p>
                          <span className={`shrink-0 text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                            s.type === '충격'   ? 'border-red-400/25 text-red-400/60 bg-red-400/5' :
                            s.type === '비교'   ? 'border-blue-400/25 text-blue-400/60 bg-blue-400/5' :
                            s.type === '예측'   ? 'border-purple-400/25 text-purple-400/60 bg-purple-400/5' :
                            s.type === '인사이더' ? 'border-amber-400/25 text-amber-400/60 bg-amber-400/5' :
                            s.type === '스토리' ? 'border-pink-400/25 text-pink-400/60 bg-pink-400/5' :
                            s.type === '논쟁'   ? 'border-orange-400/25 text-orange-400/60 bg-orange-400/5' :
                            'border-white/15 text-white/30 bg-white/3'
                          }`}>{s.type}</span>
                        </div>
                        <p className="text-[11px] text-white/30 font-mono leading-snug">{s.whyNow}</p>
                        {s.hook && (
                          <p className="text-[11px] text-white/20 font-mono mt-1 italic leading-snug">
                            &ldquo;{s.hook.slice(0, 60)}{s.hook.length > 60 ? '...' : ''}&rdquo;
                          </p>
                        )}
                      </div>
                      <span className="text-[11px] font-mono text-[#4f8ef7]/40 group-hover:text-[#4f8ef7] transition-colors shrink-0 mt-0.5">선택 →</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── 에러 모달 ── */}
        {error && (
          <ErrorModal
            raw={error}
            onClose={() => { setError(''); setStatus('idle'); }}
            onRetry={() => { setError(''); setStatus('idle'); }}
          />
        )}

        {/* ── 대본 출력 (생성 완료 시) ── */}
        {status === 'done' && (
          <>
            {saveWarning && (
              <div className="mb-4 px-3 py-2 border-l-2 border-[#4f8ef7] bg-[#4f8ef7]/5 rounded-r-lg">
                <p className="text-[#4f8ef7] text-xs font-mono">{saveWarning}</p>
              </div>
            )}

            {/* ── 에이전트 단계 + 감독 전략 (멀티에이전트 모드) ── */}
            {scriptMode === 'agent' && agentSteps.length > 0 && (
              <div className="mb-4 bg-white/[0.02] border border-white/8 rounded-xl px-4 py-3 space-y-1.5">
                <p className="text-[10px] font-mono text-white/25 uppercase tracking-wider mb-2">파이프라인 완료</p>
                {agentSteps.map((step, i) => (
                  <div key={i} className="flex items-start gap-2 text-[11px] font-mono">
                    <CheckCircle2 size={11} className="text-[#4f8ef7]/70 mt-0.5 shrink-0" />
                    <div>
                      <span className="text-white/50 font-bold">{step.agent}</span>
                      {step.summary && <span className="text-white/25 ml-1.5">— {step.summary}</span>}
                    </div>
                  </div>
                ))}
                {directorStrategy && (
                  <details className="mt-2">
                    <summary className="text-[10px] font-mono text-white/20 cursor-pointer hover:text-white/40 transition-colors">
                      감독 전략 보기 ▸
                    </summary>
                    <pre className="mt-2 text-[10px] font-mono text-white/30 leading-relaxed whitespace-pre-wrap bg-black/20 rounded-lg p-2 max-h-40 overflow-y-auto">
                      {directorStrategy}
                    </pre>
                  </details>
                )}
              </div>
            )}

            {/* ── 완료 메시지 ── */}
            <div ref={scriptOutputRef} className="flex items-center gap-3 mb-5 mt-2">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-mono text-[#4f8ef7] bg-[#4f8ef7]/10 border border-[#4f8ef7]/20 px-2.5 py-0.5 rounded-full uppercase tracking-widest">
                <span className="w-1.5 h-1.5 bg-[#4f8ef7] rounded-full animate-pulse" />
                완성
              </span>
              {category && (
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${CATEGORY_COLORS[category] ?? 'text-white/30 border-white/8 bg-white/[0.03]'}`}>
                  {CATEGORY_LABELS[category] ?? category}
                </span>
              )}
              <span className="text-white/50 text-[13px]">요청서를 기반으로 작성한 대본이 완료되었습니다.</span>
              <div className="flex items-center gap-3 ml-auto text-white/25 text-[12px] font-mono tabular-nums shrink-0">
                <span>{script.length.toLocaleString()}자</span>
                <span className="w-px h-3 bg-white/10" />
                <span>약 {Math.ceil(script.length / 300)}분</span>
              </div>
            </div>

            {/* ── 대본 본문 ── */}
            <div className="relative rounded-2xl overflow-hidden mb-5"
              style={{ background: 'linear-gradient(160deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-white/30" />
                  <span className="w-2 h-2 rounded-full bg-white/30" />
                  <span className="w-2 h-2 rounded-full bg-white/30" />
                </div>
                <span className="text-white/40 text-[10px] font-mono uppercase tracking-widest">SCRIPT</span>
                <button
                  onClick={handleCopy}
                  className={`sidebar-btn flex items-center gap-1.5 px-3 py-1 text-[11px] font-bold rounded-lg border transition-all ${
                    copied
                      ? 'border-[#4f8ef7]/50 text-[#4f8ef7] bg-[#4f8ef7]/10'
                      : 'border-white/10 text-white/35 hover:border-white/25 hover:text-white/70 hover:bg-white/5'
                  }`}
                >
                  {copied ? '✓ 복사됨' : '복사'}
                </button>
              </div>
              <div className="relative">
                <div className="absolute top-0 left-0 right-0 h-6 bg-gradient-to-b from-black/20 to-transparent pointer-events-none z-10" />
                <textarea
                  value={script}
                  onChange={e => setScript(e.target.value)}
                  className="w-full min-h-[560px] bg-transparent text-white/75 text-[14px] leading-[1.9] resize-none border-0 focus:outline-none px-8 py-6"
                  style={{ fontFamily: "'Inter', 'SF Pro Text', -apple-system, sans-serif", letterSpacing: '-0.01em' }}
                />
                <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#0d0d0d]/70 to-transparent pointer-events-none" />
              </div>
            </div>

            {/* ── 액션 버튼 ── */}
            <div className="pb-10 flex justify-end gap-2">
              <button
                onClick={handleUseScript}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#4f8ef7]/10 hover:bg-[#4f8ef7]/16 border border-[#4f8ef7]/25 hover:border-[#4f8ef7]/45 text-[#4f8ef7] text-[12px] font-bold tracking-wide transition-all"
              >
                영상 만들기 →
              </button>
              <button
                onClick={handleMultiChannel}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] border border-white/8 hover:border-white/18 text-white/55 hover:text-white/85 text-[12px] font-bold tracking-wide transition-all"
              >
                멀티채널 배포
              </button>
            </div>
          </>
        )}
      </div>

      {/* ─── 우측 사이드바 ─── */}
      <aside className="w-96 shrink-0 flex flex-col overflow-y-auto" style={{ borderLeft: '1px solid var(--border)', background: 'var(--sidebar)' }}>
        <div className="flex-1 px-5 py-5 space-y-6">

          {/* 대본 완성 → 썸네일 패널로 전환 */}
          {status === 'done' ? (
            <>
              {/* 이미지 모델 */}
              <PanelAccordion
                label="이미지 모델"
                value={THUMB_IMAGE_MODELS.find(m => m.id === imageModelId)?.name ?? ''}
                open={imageModelOpen}
                onToggle={() => setImageModelOpen(v => !v)}
              >
                <div className="space-y-3">
                  {THUMB_IMAGE_PROVIDERS.map(provider => (
                    <div key={provider}>
                      <p className="text-white/25 text-[11px] font-semibold uppercase tracking-wide px-1 mb-1.5">{provider}</p>
                      <div className="space-y-1">
                        {THUMB_IMAGE_MODELS.filter(m => m.provider === provider).map(m => (
                          <OptionItem key={m.id} active={imageModelId === m.id}
                            onClick={() => { setImageModelId(m.id); setImageModelOpen(false); }} sub={m.price}>
                            {m.name}
                          </OptionItem>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </PanelAccordion>

              {/* SEO 패키지 (에이전트 모드) */}
              {scriptMode === 'agent' && seoPackage && (
                <div>
                  <button
                    onClick={() => setSeoExpanded(v => !v)}
                    className="w-full flex items-center justify-between mb-3"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-[#4f8ef7] rounded-full" />
                      <span className="text-[#4f8ef7] text-[11px] font-bold uppercase tracking-widest flex items-center gap-1.5">
                        <BarChart2 size={11} />SEO 패키지
                      </span>
                    </div>
                    {seoExpanded ? <ChevronUp size={12} className="text-white/30" /> : <ChevronDown size={12} className="text-white/30" />}
                  </button>
                  {seoExpanded && (
                    <div className="space-y-3">
                      {/* 제목 3안 */}
                      <div>
                        <p className="text-[10px] font-mono text-white/25 uppercase tracking-wider mb-1.5">제목 후보</p>
                        {seoPackage.titles.map((t, i) => (
                          <div key={i} className="flex items-start gap-2 py-1.5 border-b border-white/5 last:border-0">
                            <span className="text-[10px] font-mono text-white/20 mt-0.5 w-3 shrink-0">{i + 1}</span>
                            <p className="text-[12px] text-white/70 leading-snug">{t}</p>
                          </div>
                        ))}
                      </div>
                      {/* 썸네일 텍스트 */}
                      {seoPackage.thumbnailText && (
                        <div className="bg-[#4f8ef7]/5 border border-[#4f8ef7]/15 rounded-lg px-3 py-2">
                          <p className="text-[10px] font-mono text-white/25 uppercase tracking-wider mb-1">썸네일 텍스트</p>
                          <p className="text-[14px] font-black text-[#4f8ef7]">{seoPackage.thumbnailText}</p>
                        </div>
                      )}
                      {/* 해시태그 */}
                      {seoPackage.hashtags?.length > 0 && (
                        <div>
                          <p className="text-[10px] font-mono text-white/25 uppercase tracking-wider mb-1.5">해시태그</p>
                          <div className="flex flex-wrap gap-1">
                            {seoPackage.hashtags.map((h, i) => (
                              <span key={i} className="text-[10px] font-mono bg-white/[0.04] border border-white/8 px-2 py-0.5 rounded-full text-white/40">{h}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {/* 썸네일로 전달 버튼 */}
                      <button
                        onClick={() => {
                          if (seoPackage.thumbnailText) {
                            sessionStorage.setItem('clipflow_thumb_text', seoPackage.thumbnailText);
                            sessionStorage.setItem('clipflow_thumb_title', seoPackage.titles[0] ?? topic);
                          }
                          sessionStorage.setItem('clipflow_script', script);
                          window.location.href = '/dashboard/thumbnail';
                        }}
                        className="w-full flex items-center justify-center gap-1.5 text-[11px] font-bold bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-white/20 text-white/50 hover:text-white/80 py-2 rounded-lg transition-colors"
                      >
                        <Sparkles size={11} />SEO 데이터로 썸네일 생성 →
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* 썸네일 생성 */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <span className="w-1.5 h-1.5 bg-[#4f8ef7] rounded-full" />
                  <span className="text-[#4f8ef7] text-[11px] font-bold uppercase tracking-widest">썸네일 생성</span>
                </div>
                <p className="text-[11px] font-mono text-white/30 mb-4 leading-relaxed">
                  대본 전체를 AI가 분석해 분위기·핵심 비주얼을 추출하고 썸네일을 자동 생성합니다
                </p>
                <ThumbnailPanel script={script} topic={topic} imageModel={imageModelId} llmModelId={llmModelId} />
              </div>

            </>
          ) : (
            <>
              {/* 입력 중 → 설정 패널 */}
              {category && (
                <div className="flex items-center gap-2">
                  <span className="text-white/30 text-xs font-medium">카테고리</span>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${CATEGORY_COLORS[category] ?? 'text-white/60 bg-white/8 border-white/10'}`}>
                    {CATEGORY_LABELS[category] ?? category}
                  </span>
                </div>
              )}

              <div>
                <p className="text-white/40 text-xs font-semibold uppercase tracking-wide mb-2.5">톤 / 분위기</p>
                {(!category || category === 'general') ? (
                  <div className="grid grid-cols-3 gap-1.5">
                    {TONES.map(t => (
                      <button
                        key={t.id}
                        onClick={() => setTone(t.id)}
                        disabled={status === 'loading'}
                        className={`sidebar-btn py-1.5 rounded-lg border text-[12px] font-mono transition-colors disabled:opacity-40 ${
                          tone === t.id
                            ? 'border-[#4f8ef7]/40 bg-[#4f8ef7]/10 text-[#4f8ef7]'
                            : 'border-white/8 text-white/40 hover:text-white/70 hover:border-white/20 hover:bg-white/5'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-white/30 text-sm leading-relaxed">이 카테고리는 전용 프롬프트의 내장 톤으로 자동 적용됩니다.</p>
                )}
              </div>

              <div>
                <p className="text-white/40 text-xs font-semibold uppercase tracking-wide mb-2.5">추가 옵션</p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-white/40 text-xs font-medium mb-1.5">영상 목표 길이</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { value: '',                              label: '선택 안 함' },
                        { value: '5분 내외 (3,000자 이상)',       label: '5분' },
                        { value: '10분 내외 (5,000자 이상)',      label: '10분' },
                        { value: '15분 내외 (7,000자 이상)',      label: '15분' },
                        { value: '20분 이상 (9,000자 이상)',      label: '20분+' },
                      ].map(o => (
                        <button
                          key={o.value}
                          onClick={() => setVideoLength(o.value)}
                          disabled={status === 'loading'}
                          className={`sidebar-btn py-1.5 rounded-lg border text-[12px] font-mono transition-colors disabled:opacity-40 ${
                            videoLength === o.value
                              ? 'border-[#4f8ef7]/40 bg-[#4f8ef7]/10 text-[#4f8ef7]'
                              : 'border-white/8 text-white/40 hover:text-white/70 hover:border-white/20 hover:bg-white/5'
                          }`}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-white/40 text-xs font-medium mb-1.5">핵심 키워드</label>
                    <input value={keywords} onChange={e => setKeywords(e.target.value)} placeholder="예: 성능, 배터리, 카메라"
                      className="w-full bg-black text-white/70 px-3 py-2 border border-[rgba(79,142,247,0.15)] focus:border-[rgba(79,142,247,0.40)] focus:outline-none text-sm rounded-xl placeholder:text-white/25" disabled={status === 'loading'} />
                  </div>
                  <div>
                    <label className="block text-white/40 text-xs font-medium mb-1.5">타겟 시청자</label>
                    <input value={targetAudience} onChange={e => setTargetAudience(e.target.value)} placeholder="예: 20~30대 직장인"
                      className="w-full bg-black text-white/70 px-3 py-2 border border-[rgba(79,142,247,0.15)] focus:border-[rgba(79,142,247,0.40)] focus:outline-none text-sm rounded-xl placeholder:text-white/25" disabled={status === 'loading'} />
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
                          <OptionItem key={m.id} active={llmModelId === m.id} onClick={() => { setLlmModelId(m.id); setModelOpen(false); }} sub={m.price}>
                            {m.name}
                          </OptionItem>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </PanelAccordion>

              <div className="pt-4 border-t border-white/5 space-y-2">
                <p className="text-white/30 text-xs font-semibold uppercase tracking-wide mb-3">대본 설정 요약</p>
                <div className="flex justify-between text-[13px]">
                  <span className="text-white/35">톤</span>
                  <span className="text-white/65 font-mono">{(!category || category === 'general') ? selectedTone?.label : '카테고리 내장'}</span>
                </div>
                <div className="flex justify-between text-[13px]">
                  <span className="text-white/35">AI 모델</span>
                  <span className="text-white/65 font-mono">{selectedLlm?.name}</span>
                </div>
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
