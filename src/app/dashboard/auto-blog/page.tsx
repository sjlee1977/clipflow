'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Zap, Play, CheckCircle2, XCircle, Clock, SkipForward,
  Loader2, TrendingUp, Search, Globe, FileText, Send,
  ChevronDown, ChevronUp, BarChart2, Tag, ExternalLink,
  RefreshCw, Settings, CalendarDays, ListOrdered, Sparkles,
  Trash2, Upload, AlertCircle, Check, Bot,
} from 'lucide-react';

import { toDatetimeLocal } from '@/lib/date';

// ─── AI 모델 ──────────────────────────────────────────────────────────────────
const AUTO_LLM_MODELS = [
  { id: 'gemini-2.5-flash',          name: 'Gemini 2.5 Flash',    provider: 'Google',    price: '최고 가성비' },
  { id: 'gemini-3.0-flash',          name: 'Gemini 3.0 Flash',    provider: 'Google',    price: '균형' },
  { id: 'gemini-3.0-pro',            name: 'Gemini 3.0 Pro',      provider: 'Google',    price: '고품질' },
  { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5',    provider: 'Anthropic', price: '빠름' },
  { id: 'claude-sonnet-4-6',         name: 'Claude Sonnet 4.6',   provider: 'Anthropic', price: '고품질' },
  { id: 'claude-opus-4-6',           name: 'Claude Opus 4.6',     provider: 'Anthropic', price: '최고품질' },
  { id: 'gpt-5.4',                   name: 'GPT-5.4',             provider: 'OpenAI',    price: '고성능' },
  { id: 'gpt-5.4-mini',              name: 'GPT-5.4 Mini',        provider: 'OpenAI',    price: '고품질' },
  { id: 'gpt-5.4-nano',              name: 'GPT-5.4 Nano',        provider: 'OpenAI',    price: '초저가·빠름' },
  { id: 'gpt-4o',                    name: 'GPT-4o',              provider: 'OpenAI',    price: '고품질' },
  { id: 'gpt-4.1',                   name: 'GPT-4.1',             provider: 'OpenAI',    price: '빠름' },
  { id: 'qwen3.5-flash',             name: 'Qwen 3.5 Flash',      provider: 'Alibaba',   price: '초저가' },
  { id: 'qwen3.5-plus',              name: 'Qwen 3.5 Plus',       provider: 'Alibaba',   price: '합리적' },
  { id: 'qwen3.6-plus',              name: 'Qwen 3.6 Plus',       provider: 'Alibaba',   price: '고지능' },
];
const AUTO_LLM_PROVIDERS = ['Google', 'Anthropic', 'OpenAI', 'Alibaba'] as const;
const AI_PROVIDER_META: Record<string, { color: string }> = {
  Anthropic: { color: '#E4572E' },
  OpenAI:    { color: '#10a37f' },
  Google:    { color: '#17BEBB' },
  Alibaba:   { color: '#6366f1' },
};
const PRICE_TIER: Record<string, { color: string; bg: string }> = {
  '빠름':        { color: '#4ade80', bg: 'rgba(74,222,128,0.10)' },
  '초저가':      { color: '#4ade80', bg: 'rgba(74,222,128,0.10)' },
  '균형':        { color: '#38bdf8', bg: 'rgba(56,189,248,0.10)' },
  '합리적':      { color: '#38bdf8', bg: 'rgba(56,189,248,0.10)' },
  '고품질':      { color: '#818cf8', bg: 'rgba(129,140,248,0.10)' },
  '고지능':      { color: '#818cf8', bg: 'rgba(129,140,248,0.10)' },
  '최고품질':    { color: '#c084fc', bg: 'rgba(192,132,252,0.10)' },
  '최고 가성비': { color: '#4ade80', bg: 'rgba(74,222,128,0.10)' },
  '고성능':      { color: '#10a37f', bg: 'rgba(16,163,127,0.10)' },
  '초저가·빠름': { color: '#4ade80', bg: 'rgba(74,222,128,0.10)' },
};
function AiPriceBadge({ price }: { price?: string }) {
  if (!price) return null;
  const tier = PRICE_TIER[price];
  if (!tier) return <span className="text-[10px] px-1.5 py-0.5 rounded-md text-white/35 bg-white/5">{price}</span>;
  return <span className="text-[10px] px-1.5 py-0.5 rounded-md whitespace-nowrap" style={{ color: tier.color, background: tier.bg }}>{price}</span>;
}
function AiModelItem({ active, onClick, name, price, providerColor }: {
  active: boolean; onClick: () => void; name: string; price?: string; providerColor: string;
}) {
  return (
    <button onClick={onClick}
      className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg transition-all duration-150"
      style={{ background: active ? 'rgba(255,255,255,0.055)' : 'transparent' }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.025)'; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
    >
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{
        backgroundColor: active ? providerColor : 'rgba(255,255,255,0.15)',
        boxShadow: active ? `0 0 5px ${providerColor}80` : 'none',
      }} />
      <span className="flex-1 text-left text-[12px]" style={{ color: active ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.42)' }}>{name}</span>
      <AiPriceBadge price={price} />
    </button>
  );
}
function AiModelSelector({ models, providers, selected, onSelect }: {
  models: { id: string; name: string; provider: string; price?: string }[];
  providers: readonly string[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);
  const selectedModel = models.find(m => m.id === selected);
  const provMeta = AI_PROVIDER_META[selectedModel?.provider ?? ''] ?? { color: '#4f8ef7' };
  return (
    <div ref={ref}>
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg transition-all duration-150"
        style={{ background: open ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: provMeta.color, boxShadow: `0 0 6px ${provMeta.color}80` }} />
        <span className="flex-1 text-left text-[11.5px] text-white/70 truncate">{selectedModel?.name ?? '자동 선택'}</span>
        <span className="text-[10px] text-white/25 mr-0.5">{selectedModel?.provider}</span>
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none" className={`shrink-0 text-white/25 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {open && (
        <div className="mt-1.5 space-y-0.5">
          {providers.map(provider => {
            const pm = AI_PROVIDER_META[provider] ?? { color: '#fff' };
            const list = models.filter(m => m.provider === provider);
            if (!list.length) return null;
            return (
              <div key={provider}>
                <div className="flex items-center gap-1.5 px-2.5 pt-2 pb-1">
                  <span className="w-1 h-1 rounded-full shrink-0" style={{ backgroundColor: pm.color }} />
                  <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.22)' }}>{provider}</span>
                </div>
                {list.map(m => (
                  <AiModelItem key={m.id} active={selected === m.id}
                    onClick={() => { onSelect(m.id); setOpen(false); }}
                    name={m.name} price={m.price} providerColor={pm.color} />
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── 타입 ─────────────────────────────────────────────────────────────────────
type StepStatus   = 'pending' | 'running' | 'done' | 'skipped' | 'error';
type SeoPlatform  = 'naver' | 'google';
type Tone         = 'friendly' | 'professional' | 'storytelling' | 'empathetic' | 'educational' | 'casual';
type SpeechLevel  = 'formal' | 'casual';
type PostStatus   = 'pending' | 'generating' | 'ready' | 'published' | 'failed';

interface PipelineStep {
  id: string; label: string; status: StepStatus; data?: unknown; error?: string;
}
interface PostResult {
  title: string; content: string; metaTitle: string;
  metaDescription: string; slug: string; tags: string[];
  seoScore: number;
}
interface RunResult {
  steps: PipelineStep[];
  topic?: { topic: string; keyword: string; relatedKeywords: string[]; reason: string };
  keywordData?: { keyword: string; monthlyTotal: number; competition: number; opportunity: number } | null;
  competitors?: { title: string; url: string; length: number }[];
  post?: PostResult;
  publishResult?: { success: boolean; link?: string } | null;
  provider?: string;
  error?: string;
}
interface ScheduledPost {
  id: string; topic: string; keyword: string; status: PostStatus;
  scheduled_at: string | null; platforms: string[];
  naver_title?: string; wordpress_title?: string; personal_title?: string;
  evaluation?: { totalScore: number; grade: string } | null;
  naver_published_at?: string | null;
  wordpress_published_at?: string | null;
  personal_published_at?: string | null;
  error_message?: string | null;
  created_at: string;
}
interface CalendarPending {
  id: string; title: string; scheduled_at: string | null; notes?: string; status: string;
}

// ─── 상수 ─────────────────────────────────────────────────────────────────────
const STEP_ICONS: Record<string, React.ReactNode> = {
  trends: <TrendingUp size={13} />, topic: <Search size={13} />,
  keywords: <BarChart2 size={13} />, crawl: <Globe size={13} />,
  write: <FileText size={13} />, publish: <Send size={13} />,
};
const GEO_OPTIONS  = [{ v: 'KR', l: '한국' }, { v: 'US', l: '미국' }, { v: 'JP', l: '일본' }];
const TONE_OPTIONS: { value: Tone; label: string; sub: string }[] = [
  { value: 'friendly',     label: '친근한',    sub: '대화체·편안함'  },
  { value: 'professional', label: '전문적인',  sub: '권위·신뢰감'   },
  { value: 'storytelling', label: '스토리텔링', sub: '서사·경험담'   },
  { value: 'empathetic',   label: '공감형',    sub: '위로·독자중심'  },
  { value: 'educational',  label: '실용적',    sub: '단계별·행동지침' },
  { value: 'casual',       label: '자유로운',  sub: '솔직·캐주얼'   },
];
const LENGTH_OPTIONS = [
  { value: 800,  label: '짧게',     desc: '1,000자 미만'  },
  { value: 2000, label: '보통',     desc: '2,000~3,000자' },
  { value: 3000, label: '길게',     desc: '3,000~5,000자' },
  { value: 5000, label: '아주 길게', desc: '5,000~7,000자' },
];
const STATUS_META: Record<PostStatus, { label: string; color: string; bg: string }> = {
  pending:    { label: '대기중',    color: '#a1a1aa', bg: 'rgba(161,161,170,0.1)' },
  generating: { label: '생성중',    color: '#4f8ef7', bg: 'rgba(79,142,247,0.1)'  },
  ready:      { label: '생성완료',  color: '#22c55e', bg: 'rgba(34,197,94,0.1)'   },
  published:  { label: '발행완료',  color: '#a855f7', bg: 'rgba(168,85,247,0.1)'  },
  failed:     { label: '실패',      color: '#ef4444', bg: 'rgba(239,68,68,0.1)'   },
};

// ─── 공통 서브컴포넌트 ────────────────────────────────────────────────────────
function StatusIcon({ status }: { status: StepStatus }) {
  switch (status) {
    case 'running': return <Loader2 size={14} className="animate-spin text-[#4f8ef7]" />;
    case 'done':    return <CheckCircle2 size={14} className="text-[#4f8ef7]" />;
    case 'error':   return <XCircle size={14} className="text-red-400" />;
    case 'skipped': return <SkipForward size={14} className="text-white/25" />;
    default:        return <Clock size={14} className="text-white/20" />;
  }
}
function SeoScoreRing({ score }: { score: number }) {
  const r = 22, circ = 2 * Math.PI * r;
  const color = score >= 80 ? '#4f8ef7' : score >= 60 ? '#f59e0b' : '#ef4444';
  return (
    <svg width={56} height={56} viewBox="0 0 56 56">
      <circle cx={28} cy={28} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={5} />
      <circle cx={28} cy={28} r={r} fill="none" stroke={color} strokeWidth={5}
        strokeDasharray={`${(score / 100) * circ} ${circ}`} strokeLinecap="round" transform="rotate(-90 28 28)" />
      <text x={28} y={28} textAnchor="middle" dominantBaseline="central" fill={color} fontSize={12} fontWeight={900}>{score}</text>
    </svg>
  );
}
function MetricMini({ label, value }: { label: string; value: string }) {
  return (
    <div><p className="text-[9px] text-white/20 uppercase tracking-wider">{label}</p>
      <p className="text-[13px] font-black text-white/70 mt-0.5">{value}</p></div>
  );
}
function MetaLine({ label, value, maxLen }: { label: string; value: string; maxLen?: number }) {
  const over = maxLen ? value.length > maxLen : false;
  return (
    <div className="flex items-start gap-3">
      <div className="flex items-center gap-1.5 shrink-0 w-28">
        <Tag size={10} className="text-white/20" />
        <p className="text-[10px] text-white/25">{label}</p>
        {maxLen && <span className={`text-[9px] ${over ? 'text-red-400/60' : 'text-white/15'}`}>{value.length}/{maxLen}</span>}
      </div>
      <p className={`text-[11px] font-mono flex-1 break-all ${over ? 'text-red-400/60' : 'text-white/50'}`}>{value}</p>
    </div>
  );
}

// ─── 메인 페이지 ──────────────────────────────────────────────────────────────
export default function AutoBlogPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'auto' | 'schedule'>('auto');

  // AutoTab 상태를 페이지 레벨로 끌어올림 (사이드바 공유)
  const [geo,             setGeo]             = useState('KR');
  const [seoPlatform,     setSeoPlatform]     = useState<SeoPlatform>('naver');
  const [llmModel,        setLlmModel]        = useState(AUTO_LLM_MODELS[0].id);
  const [tone,            setTone]            = useState<Tone>('friendly');
  const [speechLevel,     setSpeechLevel]     = useState<SpeechLevel>('formal');
  const [minLength,       setMinLength]       = useState(2000);
  const [autoPublish,     setAutoPublish]     = useState(false);
  const [publishPlatform, setPublishPlatform] = useState('wordpress');
  const [running,         setRunning]         = useState(false);
  const [result,          setResult]          = useState<RunResult | null>(null);

  async function handleRun() {
    setRunning(true); setResult(null);
    try {
      const res = await fetch('/api/auto-blog/run', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ geo, seoPlatform, tone, speechLevel, minLength, autoPublish, publishPlatform, llmModel }),
      });
      setResult(await res.json() as RunResult);
    } catch (err) {
      setResult({ steps: [], error: err instanceof Error ? err.message : '실행 실패' });
    } finally { setRunning(false); }
  }

  const pageHeader = (
    <div className="shrink-0 px-4 pt-6 pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
      <div className="flex items-center gap-3 mt-4 mb-4">
        <span className="w-7 h-7 flex items-center justify-center rounded-lg shrink-0"
          style={{ background: 'rgba(79,142,247,0.06)', border: '1px solid rgba(79,142,247,0.22)', color: '#4f8ef7' }}>
          <Zap size={13} strokeWidth={1.8} />
        </span>
        <span className="text-[19px] font-semibold text-white leading-none translate-y-px" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>자동 블로그 생성</span>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {([
          { key: 'auto',     icon: <Zap size={12} />,         label: '자동 생성',  rgb: '79,142,247' },
          { key: 'schedule', icon: <CalendarDays size={12} />, label: '스케줄 관리', rgb: '163,230,53' },
        ] as { key: 'auto' | 'schedule'; icon: React.ReactNode; label: string; rgb: string }[]).map(t => {
          const isActive = tab === t.key;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className="cf-tab-btn flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium tracking-wide transition-all duration-200 whitespace-nowrap"
              style={{
                color:      isActive ? `rgb(${t.rgb})`                : 'rgba(255,255,255,0.28)',
                background: isActive ? `rgba(${t.rgb},0.1)`           : 'transparent',
                border:     isActive ? `1px solid rgba(${t.rgb},0.3)` : '1px solid transparent',
                ['--tab-rgb' as string]: t.rgb,
              }}
              onMouseEnter={e => { if (!isActive) { const el = e.currentTarget; el.style.color = `rgba(${t.rgb},0.8)`; el.style.background = `rgba(${t.rgb},0.07)`; el.style.borderColor = `rgba(${t.rgb},0.25)`; } }}
              onMouseLeave={e => { if (!isActive) { const el = e.currentTarget; el.style.color = 'rgba(255,255,255,0.28)'; el.style.background = 'transparent'; el.style.borderColor = 'transparent'; } }}
            >
              <span>{t.icon}</span>{t.label}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="flex gap-0 -my-6" style={{ minHeight: 'calc(100vh - 56px)' }}>

      {tab === 'auto' ? (
        /* ─── 자동 생성: 4:6 분할 ─── */
        <div className="flex-1 min-w-0 flex overflow-hidden">

          {/* LEFT 40%: 헤더 + 탭 + 파이프라인 */}
          <div className="w-2/5 shrink-0 flex flex-col overflow-hidden" style={{ borderRight: '1px solid var(--border)' }}>
            {pageHeader}
            <div className="flex-1 overflow-y-auto p-6">
              <AutoTabSteps running={running} result={result} />
            </div>
          </div>

          {/* RIGHT 60%: 결과 */}
          <div className="flex-1 min-w-0 overflow-y-auto p-6">
            <AutoTabResult router={router} running={running} result={result} onRun={handleRun} />
          </div>

        </div>
      ) : (
        /* ─── 스케줄 관리: 전체 너비 ─── */
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {pageHeader}
          <div className="flex-1 overflow-y-auto p-6">
            <ScheduleTab />
          </div>
        </div>
      )}

      {/* ─── 우측 사이드바 (항상 표시) ─── */}
      <aside className="w-96 shrink-0 flex flex-col overflow-y-auto" style={{ borderLeft: '1px solid var(--border)', background: 'var(--sidebar)' }}>
          <div className="px-3 py-4 space-y-3">

            {/* AI 모델 카드 */}
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--card)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)' }}>
              <div className="flex items-center gap-2.5 px-4 py-2.5" style={{ background: 'rgba(79,142,247,0.04)' }}>
                <div className="w-5 h-5 flex items-center justify-center rounded-md shrink-0" style={{ background: 'rgba(79,142,247,0.12)', border: '1px solid rgba(79,142,247,0.25)' }}>
                  <Bot size={9} style={{ color: '#4f8ef7' }} />
                </div>
                <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>AI 모델</span>
              </div>
              <div className="px-3 py-3">
                <AiModelSelector models={AUTO_LLM_MODELS} providers={AUTO_LLM_PROVIDERS} selected={llmModel} onSelect={setLlmModel} />
              </div>
            </div>

            {/* 파이프라인 설정 카드 */}
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--card)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)' }}>
              <div className="flex items-center gap-2.5 px-4 py-2.5" style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
                <div className="w-5 h-5 flex items-center justify-center rounded-md shrink-0" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
                  <Zap size={9} className="text-white/50" />
                </div>
                <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>파이프라인 설정</span>
              </div>
              <div className="px-4 py-3 space-y-4">
                <div>
                  <p className="text-[11px] text-white/25 mb-2 uppercase tracking-wider" style={{ fontFamily: "'Nanum Gothic', sans-serif" }}>트렌드 지역</p>
                  <div className="flex gap-1.5">
                    {GEO_OPTIONS.map(o => (
                      <button key={o.v} onClick={() => setGeo(o.v)}
                        className={`cf-filter-btn flex-1 text-[11px] font-mono py-1.5 rounded-lg border transition-colors ${geo === o.v ? 'border-[#4f8ef7]/40 bg-[#4f8ef7]/10 text-[#4f8ef7]' : 'border-white/8 text-white/40 hover:text-white/70 hover:border-white/20 hover:bg-white/5'}`}>
                        {o.l}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[11px] text-white/25 mb-2 uppercase tracking-wider" style={{ fontFamily: "'Nanum Gothic', sans-serif" }}>SEO 최적화</p>
                  <div className="flex gap-1.5">
                    {(['naver', 'google'] as SeoPlatform[]).map(p => (
                      <button key={p} onClick={() => setSeoPlatform(p)}
                        className={`cf-filter-btn flex-1 py-1.5 rounded-lg border text-[11px] font-mono transition-colors ${seoPlatform === p ? 'border-[#4f8ef7]/40 bg-[#4f8ef7]/10 text-[#4f8ef7]' : 'border-white/8 text-white/40 hover:text-white/70 hover:border-white/20 hover:bg-white/5'}`}>
                        {p === 'naver' ? '네이버' : '구글'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* 작성 설정 카드 */}
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--card)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)' }}>
              <div className="flex items-center gap-2.5 px-4 py-2.5" style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
                <div className="w-5 h-5 flex items-center justify-center rounded-md shrink-0" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
                  <Settings size={9} className="text-white/50" />
                </div>
                <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>작성 설정</span>
              </div>
              <div className="px-4 py-3 space-y-4">
                <div>
                  <p className="text-[11px] text-white/25 mb-2 uppercase tracking-wider" style={{ fontFamily: "'Nanum Gothic', sans-serif" }}>문체</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {TONE_OPTIONS.map(o => (
                      <button key={o.value} onClick={() => setTone(o.value)}
                        className={`flex flex-col items-center gap-0.5 py-1.5 px-1 rounded-lg border transition-colors ${tone === o.value ? 'border-[#4f8ef7]/40 bg-[#4f8ef7]/10 text-[#4f8ef7]' : 'border-white/8 text-white/40 hover:text-white/70 hover:border-white/20 hover:bg-white/5'}`}>
                        <span className="text-[11px] font-mono">{o.label}</span>
                        <span className="text-[9px] opacity-50">{o.sub}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[11px] text-white/25 mb-2 uppercase tracking-wider" style={{ fontFamily: "'Nanum Gothic', sans-serif" }}>말투</p>
                  <div className="flex gap-1.5">
                    {([['formal', '존댓말', '~입니다·해요'], ['casual', '반말', '~야·거든']] as const).map(([val, label, sub]) => (
                      <button key={val} onClick={() => setSpeechLevel(val)}
                        className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 px-1 rounded-lg border transition-colors ${speechLevel === val ? 'border-[#4f8ef7]/40 bg-[#4f8ef7]/10 text-[#4f8ef7]' : 'border-white/8 text-white/40 hover:text-white/70 hover:border-white/20 hover:bg-white/5'}`}>
                        <span className="text-[11px] font-mono">{label}</span>
                        <span className="text-[9px] opacity-50">{sub}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[11px] text-white/25 mb-2 uppercase tracking-wider" style={{ fontFamily: "'Nanum Gothic', sans-serif" }}>길이</p>
                  <div className="grid grid-cols-4 gap-1">
                    {LENGTH_OPTIONS.map(o => (
                      <button key={o.value} onClick={() => setMinLength(o.value)}
                        className={`flex flex-col items-center text-center py-2 rounded-lg border transition-colors ${minLength === o.value ? 'border-[#4f8ef7]/40 bg-[#4f8ef7]/10 text-[#4f8ef7]' : 'border-white/8 text-white/40 hover:text-white/70 hover:border-white/20 hover:bg-white/5'}`}>
                        <span className="text-[11px] font-medium block leading-tight">{o.label}</span>
                        <span className="text-[9px] text-white/25 leading-tight mt-0.5">{o.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <button onClick={handleRun} disabled={running}
                  className="cf-filter-btn sidebar-btn w-full flex items-center justify-center gap-2 border border-white/8 text-white/40 disabled:opacity-30 disabled:cursor-not-allowed font-bold text-[12px] py-2.5 rounded-lg transition-colors">
                  {running ? <><Loader2 size={14} className="animate-spin" /> 실행 중...</>
                    : result ? <><RefreshCw size={14} /> 다시 실행</>
                    : <><Play size={14} /> 자동 생성 시작</>}
                </button>
              </div>
            </div>

            {/* 발행 설정 카드 */}
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--card)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)' }}>
              <div className="flex items-center gap-2.5 px-4 py-2.5" style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
                <div className="w-5 h-5 flex items-center justify-center rounded-md shrink-0" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
                  <Send size={9} className="text-white/50" />
                </div>
                <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>발행 설정</span>
              </div>
              <div className="px-4 py-3 space-y-3">
                <div className="flex gap-2">
                  {[
                    { key: 'wordpress', label: 'WordPress',   icon: 'W', color: '#21759b' },
                    { key: 'naver',     label: '네이버 블로그', icon: 'N', color: '#03c75a' },
                    { key: 'nextblog',  label: 'Next.js 블로그', icon: '▲', color: '#7c3aed' },
                  ].map(p => {
                    const isSelected = publishPlatform === p.key;
                    return (
                      <button key={p.key} onClick={() => setPublishPlatform(p.key)}
                        className="relative flex-1 flex flex-col items-center gap-2 py-3 rounded-xl border transition-all duration-200"
                        style={{ borderColor: isSelected ? `${p.color}55` : 'rgba(255,255,255,0.06)', background: isSelected ? `${p.color}0f` : 'rgba(255,255,255,0.01)' }}>
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[12px] font-black text-white shrink-0 transition-all duration-200"
                          style={{ backgroundColor: isSelected ? p.color : `${p.color}55` }}>
                          {p.icon}
                        </div>
                        <span className="text-[11px] font-medium transition-colors duration-200 leading-tight text-center"
                          style={{ color: isSelected ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.35)' }}>
                          {p.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between pt-1">
                  <div>
                    <p className="text-[12px] font-bold text-white/60">자동 발행</p>
                    <p className="text-[10px] text-white/25 mt-0.5">작성 후 초안 즉시 발행</p>
                  </div>
                  <button onClick={() => setAutoPublish(!autoPublish)}
                    className={`w-10 h-[22px] rounded-full transition-colors relative shrink-0 ${autoPublish ? 'bg-[#4f8ef7]' : 'bg-white/15'}`}>
                    <span className={`absolute top-[3px] left-[3px] w-4 h-4 rounded-full bg-white shadow transition-transform ${autoPublish ? 'translate-x-[18px]' : ''}`} />
                  </button>
                </div>
              </div>
            </div>

          </div>
      </aside>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ── 자동 생성 탭 LEFT (40%): 파이프라인 단계 ─────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
function AutoTabSteps({ running, result }: { running: boolean; result: RunResult | null }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  function toggleExpand(id: string) { setExpanded(p => ({ ...p, [id]: !p[id] })); }

  return (
    <div className="space-y-4">
      {!result && !running && (
        <div className="rounded-xl border border-white/6 bg-white/[0.01] p-4 space-y-2">
          <p className="text-[12px] font-bold text-white/35 uppercase tracking-wider mb-3">실행 단계</p>
          {[
            { icon: <TrendingUp size={11} />, label: '구글 트렌드 급상승 키워드 수집' },
            { icon: <Search     size={11} />, label: 'AI가 블로그 적합 주제 선별' },
            { icon: <BarChart2  size={11} />, label: '네이버 검색량 + 경쟁도 분석' },
            { icon: <Globe      size={11} />, label: '상위 경쟁 블로그 3개 크롤링' },
            { icon: <FileText   size={11} />, label: 'SEO 최적화 블로그 글 작성' },
            { icon: <Send       size={11} />, label: '플랫폼 자동 발행 (선택)' },
          ].map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-white/35">{s.icon}</span>
              <p className="text-[12px] font-mono text-white/40">{s.label}</p>
            </div>
          ))}
        </div>
      )}
      {(running || result) && (
        <div className="rounded-xl border border-white/8 bg-white/[0.02] overflow-hidden">
          <div className="px-4 py-3 border-b border-white/6">
            <p className="text-[11px] font-bold text-white/40 uppercase tracking-widest">파이프라인 진행</p>
          </div>
          <div className="divide-y divide-white/4">
            {(result?.steps ?? generateLoadingSteps()).map((step) => (
              <div key={step.id}>
                <div className={`flex items-center gap-3 px-4 py-3 ${step.data ? 'cursor-pointer hover:bg-white/[0.02]' : ''}`}
                  onClick={() => step.data && toggleExpand(step.id)}>
                  <span className="text-white/30">{STEP_ICONS[step.id]}</span>
                  <span className={`flex-1 text-[13px] font-bold ${
                    step.status === 'done' ? 'text-white/80' : step.status === 'running' ? 'text-white' :
                    step.status === 'error' ? 'text-red-400/80' : step.status === 'skipped' ? 'text-white/20' : 'text-white/30'
                  }`}>{step.label}</span>
                  <StatusIcon status={step.status} />
                  {!!step.data && (expanded[step.id] ? <ChevronUp size={12} className="text-white/20" /> : <ChevronDown size={12} className="text-white/20" />)}
                </div>
                {!!step.data && expanded[step.id] && (
                  <div className="px-4 pb-3 ml-5"><StepDetail id={step.id} data={step.data} /></div>
                )}
                {step.error && <p className="px-4 pb-2 ml-5 text-[11px] font-mono text-red-400/60">{step.error}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
      {result?.competitors && result.competitors.length > 0 && (
        <div className="rounded-xl border border-white/8 bg-white/[0.02] overflow-hidden">
          <div className="px-4 py-3 border-b border-white/6">
            <p className="text-[11px] font-bold text-white/40 uppercase tracking-widest flex items-center gap-2"><Globe size={12} />분석한 경쟁 포스트</p>
          </div>
          <div className="divide-y divide-white/4">
            {result.competitors.map((c, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                <span className="text-[10px] text-white/20 w-4 shrink-0">{i + 1}</span>
                <p className="text-[12px] text-white/60 flex-1 min-w-0 truncate">{c.title || c.url}</p>
                <span className="text-[10px] text-white/20 shrink-0">{c.length.toLocaleString()}자</span>
                <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-white/20 hover:text-white/60 transition-colors shrink-0"><ExternalLink size={11} /></a>
              </div>
            ))}
          </div>
        </div>
      )}
      {result?.steps?.every(s => s.status === 'done' || s.status === 'skipped') && result?.post && (
        <div className="rounded-xl border border-white/6 bg-white/[0.01] px-4 py-3">
          <p className="text-[10px] font-bold text-white/20 uppercase tracking-wider mb-2">다음 단계</p>
          <div className="space-y-1">
            <p className="text-[11px] font-mono text-white/30">1. 에디터에서 내용 검토 및 수정</p>
            <p className="text-[11px] font-mono text-white/30">2. 이미지 추가 후 플랫폼 발행</p>
            <p className="text-[11px] font-mono text-white/30">3. 발행 후 Google Search Console 등록</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ── 자동 생성 탭 RIGHT (60%): 결과 ───────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
function AutoTabResult({ router, running, result, onRun }: {
  router: ReturnType<typeof useRouter>;
  running: boolean;
  result: RunResult | null;
  onRun: () => void;
}) {
  function goToEdit() {
    if (!result?.post || !result?.topic) return;
    const p = new URLSearchParams({ keyword: result.topic.keyword, related: result.topic.relatedKeywords.join(','), volume: String(result.keywordData?.monthlyTotal ?? 0) });
    router.push(`/dashboard/blog?${p.toString()}`);
  }

  if (!result && !running) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 text-center">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(79,142,247,0.06)', border: '1px solid rgba(79,142,247,0.15)' }}>
          <FileText size={22} style={{ color: 'rgba(79,142,247,0.4)' }} />
        </div>
        <div>
          <p className="text-[14px] text-white/35 font-medium">우측 설정 후 자동 생성을 시작하세요</p>
          <p className="text-[12px] text-white/20 font-mono mt-1">생성된 블로그 글이 여기에 표시됩니다</p>
        </div>
        <button onClick={onRun}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-[13px] font-bold transition-colors"
          style={{ background: 'rgba(79,142,247,0.12)', border: '1px solid rgba(79,142,247,0.25)', color: '#4f8ef7' }}>
          <Play size={13} />자동 생성 시작
        </button>
      </div>
    );
  }

  if (running && !result?.post) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3">
        <Loader2 size={28} className="animate-spin" style={{ color: 'rgba(79,142,247,0.5)' }} />
        <p className="text-[13px] text-white/35 font-mono">AI가 블로그를 생성하고 있습니다...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {result?.post && (
        <div className="rounded-xl border border-[#4f8ef7]/20 bg-[#4f8ef7]/[0.03] overflow-hidden">
          <div className="flex items-center gap-4 px-4 py-4 border-b border-white/6">
            <SeoScoreRing score={result.post.seoScore} />
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-black text-white leading-snug">{result.post.title}</p>
              <p className="text-[11px] font-mono text-white/30 mt-1">{result.post.content.length.toLocaleString()}자 · SEO {result.post.seoScore >= 80 ? '우수' : result.post.seoScore >= 60 ? '보통' : '미흡'} · {result.provider}</p>
              <div className="flex flex-wrap gap-1 mt-2">
                {result.post.tags.slice(0, 5).map(tag => (
                  <span key={tag} className="text-[10px] text-white/35 bg-white/5 border border-white/8 px-1.5 py-0.5 rounded">#{tag}</span>
                ))}
              </div>
            </div>
          </div>
          <div className="px-4 py-3 space-y-2 border-b border-white/6">
            <MetaLine label="Meta Title" value={result.post.metaTitle} maxLen={60} />
            <MetaLine label="Meta Description" value={result.post.metaDescription} maxLen={160} />
            <MetaLine label="Slug" value={result.post.slug} />
          </div>
          {result.topic && (
            <div className="px-4 py-3 border-b border-white/6">
              <p className="text-[10px] text-white/25 uppercase tracking-wider mb-1 flex items-center gap-1.5"><Search size={10} />주제 선정 이유</p>
              <p className="text-[12px] font-mono text-white/50">{result.topic.reason}</p>
            </div>
          )}
          {result.keywordData && (
            <div className="px-4 py-3 border-b border-white/6 flex gap-4">
              <MetricMini label="월 검색량" value={result.keywordData.monthlyTotal.toLocaleString()} />
              <MetricMini label="경쟁도"   value={`${Math.round(result.keywordData.competition * 100)}%`} />
              <MetricMini label="기회점수"  value={`${result.keywordData.opportunity}점`} />
            </div>
          )}
          {result.publishResult?.success && (
            <div className="px-4 py-3 border-b border-white/6 flex items-center gap-2">
              <CheckCircle2 size={13} className="text-[#4f8ef7]" />
              <p className="text-[12px] font-mono text-[#4f8ef7]/80 flex-1">초안 발행 완료</p>
              {result.publishResult.link && (
                <a href={result.publishResult.link} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[11px] font-mono text-white/40 hover:text-white/70 transition-colors">
                  <ExternalLink size={11} />보기
                </a>
              )}
            </div>
          )}
          <div className="px-4 py-3 flex gap-2">
            <button onClick={goToEdit}
              className="flex-1 flex items-center justify-center gap-2 bg-[#4f8ef7] hover:bg-[#0284c7] text-black font-black text-[12px] tracking-tight uppercase py-2 rounded-lg transition-colors">
              <FileText size={13} />에디터에서 편집
            </button>
            <button onClick={onRun}
              className="flex items-center gap-1.5 text-[11px] font-mono text-white/40 hover:text-white/70 border border-white/10 hover:border-white/20 px-3 py-2 rounded-lg transition-colors">
              <RefreshCw size={12} />다시 실행
            </button>
          </div>
        </div>
      )}
      {result?.error && !result.post && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3">
          <p className="text-[12px] font-mono text-red-400/80">{result.error}</p>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ── 스케줄 관리 탭 ────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
function ScheduleTab() {
  const router = useRouter();
  const [posts,            setPosts]            = useState<ScheduledPost[]>([]);
  const [calendarPending,  setCalendarPending]  = useState<CalendarPending[]>([]);
  const [loading,          setLoading]          = useState(true);
  const [generatingIds,    setGeneratingIds]    = useState<Set<string>>(new Set());
  const [publishingIds,    setPublishingIds]    = useState<Set<string>>(new Set());
  const [expandedId,       setExpandedId]       = useState<string | null>(null);
  const [llmModel,         setLlmModel]         = useState('');
  const [imageModel,       setImageModel]       = useState('fal/flux-schnell');
  const [scheduledAtEdits, setScheduledAtEdits] = useState<Record<string, string>>({});
  const [savingDateIds,    setSavingDateIds]    = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch('/api/blog/scheduled-posts');
      const data = await res.json() as { posts: ScheduledPost[]; calendarPending: CalendarPending[] };
      setPosts(data.posts ?? []);
      setCalendarPending(data.calendarPending ?? []);
    } catch { /* 무시 */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // 캘린더 항목을 scheduled_posts에 등록
  async function importFromCalendar(item: CalendarPending) {
    const keyword = item.notes?.trim() || item.title.split(' ').slice(0, 2).join(' ');
    const res = await fetch('/api/blog/scheduled-posts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic: item.title, keyword, scheduledAt: item.scheduled_at, contentPlanId: item.id }),
    });
    if (res.ok) await loadData();
  }

  // 전체 캘린더 항목 한번에 등록
  async function importAllFromCalendar() {
    await Promise.all(calendarPending.map(item => importFromCalendar(item)));
  }

  // 콘텐츠 생성
  async function generatePost(post: ScheduledPost) {
    setGeneratingIds(p => new Set(p).add(post.id));
    // status → generating
    await fetch('/api/blog/scheduled-posts', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: post.id, status: 'generating' }) });
    setPosts(prev => prev.map(p => p.id === post.id ? { ...p, status: 'generating' } : p));

    try {
      const res  = await fetch('/api/blog/write-multi-platform', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: post.topic, keyword: post.keyword,
          llmModelId:  llmModel  || undefined,
          imageModelId: imageModel,
          generateImgs: true,
          saveToDb:    false,
        }),
      });
      const data = await res.json() as {
        naver?: { title: string; content: string };
        wordpress?: { title: string; content: string };
        personal?: { title: string; content: string };
        evaluation?: { totalScore: number; grade: string };
        error?: string;
      };

      if (data.error) throw new Error(data.error);

      // DB 업데이트
      await fetch('/api/blog/scheduled-posts', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id:               post.id,
          status:           'ready',
          naverContent:     data.naver?.content,
          wordpressContent: data.wordpress?.content,
          personalContent:  data.personal?.content,
        }),
      });
      setPosts(prev => prev.map(p => p.id === post.id
        ? { ...p, status: 'ready', naver_title: data.naver?.title, wordpress_title: data.wordpress?.title, personal_title: data.personal?.title, evaluation: data.evaluation ?? null }
        : p));
    } catch (err) {
      await fetch('/api/blog/scheduled-posts', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: post.id, status: 'failed' }) });
      setPosts(prev => prev.map(p => p.id === post.id ? { ...p, status: 'failed', error_message: (err as Error).message } : p));
    } finally {
      setGeneratingIds(p => { const n = new Set(p); n.delete(post.id); return n; });
    }
  }

  // 즉시 발행
  async function publishNow(post: ScheduledPost) {
    setPublishingIds(p => new Set(p).add(post.id));
    try {
      const res = await fetch('/api/blog/cron-publish', { method: 'POST' });
      if (res.ok) await loadData();
    } finally {
      setPublishingIds(p => { const n = new Set(p); n.delete(post.id); return n; });
    }
  }

  // 발행 날짜/시간 저장
  async function saveScheduledAt(id: string) {
    const value = scheduledAtEdits[id];
    if (!value) return;
    setSavingDateIds(p => new Set(p).add(id));
    try {
      await fetch('/api/blog/scheduled-posts', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, scheduledAt: new Date(value).toISOString() }),
      });
      setPosts(prev => prev.map(p => p.id === id ? { ...p, scheduled_at: new Date(value).toISOString() } : p));
    } finally {
      setSavingDateIds(p => { const n = new Set(p); n.delete(id); return n; });
    }
  }

  // 삭제
  async function deletePost(id: string) {
    if (!confirm('삭제할까요?')) return;
    await fetch('/api/blog/scheduled-posts', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    setPosts(prev => prev.filter(p => p.id !== id));
  }

  const stats = useMemo(() => ({
    total:      posts.length,
    pending:    posts.filter(p => p.status === 'pending').length,
    generating: posts.filter(p => p.status === 'generating').length,
    ready:      posts.filter(p => p.status === 'ready').length,
    published:  posts.filter(p => p.status === 'published').length,
  }), [posts]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={20} className="animate-spin text-white/30" />
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* 통계 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: '전체', value: stats.total,     color: '#a1a1aa' },
          { label: '대기', value: stats.pending,   color: '#4f8ef7' },
          { label: '완료', value: stats.ready,     color: '#22c55e' },
          { label: '발행', value: stats.published, color: '#a855f7' },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3">
            <p className="text-[10px] text-white/25 uppercase tracking-wider">{s.label}</p>
            <p className="text-[22px] font-black mt-0.5" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* 모델 설정 */}
      <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
        <p className="text-[11px] font-bold text-white/40 uppercase tracking-widest mb-3">생성 설정</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] text-white/25 mb-1.5">LLM 모델 (비워두면 자동)</p>
            <input value={llmModel} onChange={e => setLlmModel(e.target.value)} placeholder="gemini-2.5-flash"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-[12px] text-white placeholder-white/20 outline-none focus:border-[#4f8ef7]/40" />
          </div>
          <div>
            <p className="text-[10px] text-white/25 mb-1.5">이미지 모델</p>
            <select value={imageModel} onChange={e => setImageModel(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-[12px] text-white outline-none focus:border-[#4f8ef7]/40">
              <option value="fal/flux-schnell">FLUX Schnell (빠름)</option>
              <option value="fal/flux-dev">FLUX Dev (고품질)</option>
              <option value="fal/flux-pro">FLUX Pro (최고품질)</option>
            </select>
          </div>
        </div>
      </div>

      {/* 캘린더 연동 — 미등록 항목 */}
      {calendarPending.length > 0 && (
        <div className="rounded-xl border border-[#4f8ef7]/20 bg-[#4f8ef7]/[0.03] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/6">
            <div className="flex items-center gap-2">
              <CalendarDays size={13} className="text-[#4f8ef7]" />
              <p className="text-[12px] font-bold text-white/70">캘린더 미등록 블로그 항목 ({calendarPending.length}개)</p>
            </div>
            <button onClick={importAllFromCalendar}
              className="flex items-center gap-1.5 text-[11px] font-mono text-[#4f8ef7]/70 hover:text-[#4f8ef7] border border-[#4f8ef7]/20 hover:border-[#4f8ef7]/40 px-3 py-1 rounded-lg transition-colors">
              <ListOrdered size={11} />전체 등록
            </button>
          </div>
          <div className="divide-y divide-white/4">
            {calendarPending.slice(0, 5).map(item => (
              <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                <CalendarDays size={12} className="text-white/25 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] text-white/70 truncate">{item.title}</p>
                  {item.notes && <p className="text-[10px] text-white/30 font-mono">키워드: {item.notes}</p>}
                </div>
                {item.scheduled_at && (
                  <span className="text-[10px] text-white/25 font-mono shrink-0">
                    {new Date(item.scheduled_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                  </span>
                )}
                <button onClick={() => importFromCalendar(item)}
                  className="shrink-0 text-[11px] font-mono text-white/40 hover:text-white border border-white/10 hover:border-white/25 px-2.5 py-1 rounded-lg transition-colors">
                  등록
                </button>
              </div>
            ))}
            {calendarPending.length > 5 && (
              <div className="px-4 py-2.5">
                <p className="text-[11px] text-white/25 font-mono">+{calendarPending.length - 5}개 더 있음 — 전체 등록 버튼으로 한번에 추가</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 캘린더로 이동 버튼 */}
      <button onClick={() => router.push('/dashboard/calendar')}
        className="cf-filter-btn w-full flex items-center justify-center gap-2 border border-white/8 text-white/30 hover:text-white/60 text-[12px] font-mono py-2.5 rounded-xl transition-colors">
        <CalendarDays size={13} />캘린더에서 블로그 일정 추가하기
      </button>

      {/* 예약 포스트 목록 */}
      {posts.length === 0 ? (
        <div className="rounded-xl border border-white/6 bg-white/[0.01] px-4 py-10 text-center">
          <Sparkles size={24} className="text-white/10 mx-auto mb-3" />
          <p className="text-[13px] text-white/30">아직 예약된 포스트가 없습니다</p>
          <p className="text-[11px] text-white/20 font-mono mt-1">캘린더에서 블로그 항목을 추가하거나 위에서 등록하세요</p>
        </div>
      ) : (
        <div className="rounded-xl border border-white/8 bg-white/[0.02] overflow-hidden">
          <div className="px-4 py-3 border-b border-white/6">
            <p className="text-[11px] font-bold text-white/40 uppercase tracking-widest">예약 포스트 목록</p>
          </div>
          <div className="divide-y divide-white/4">
            {posts.map(post => {
              const sm     = STATUS_META[post.status];
              const isGen  = generatingIds.has(post.id);
              const isPub  = publishingIds.has(post.id);
              const isOpen = expandedId === post.id;
              const evalScore = post.evaluation?.totalScore;

              return (
                <div key={post.id}>
                  {/* 행 */}
                  <div className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.015] cursor-pointer"
                    onClick={() => setExpandedId(isOpen ? null : post.id)}>
                    {/* 날짜 */}
                    <div className="w-14 shrink-0 text-center">
                      {post.scheduled_at ? (
                        <>
                          <p className="text-[11px] font-black text-white/60">{new Date(post.scheduled_at).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}</p>
                          <p className="text-[9px] text-white/20">{new Date(post.scheduled_at).toLocaleDateString('ko-KR', { weekday: 'short' })}</p>
                        </>
                      ) : <p className="text-[10px] text-white/20 font-mono">미정</p>}
                    </div>

                    {/* 제목/키워드 */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-white/80 truncate font-bold">{post.topic}</p>
                      <p className="text-[10px] text-white/30 font-mono">#{post.keyword}</p>
                    </div>

                    {/* 품질 점수 */}
                    {evalScore != null && (
                      <span className="text-[11px] font-mono shrink-0" style={{ color: evalScore >= 80 ? '#22c55e' : evalScore >= 60 ? '#f59e0b' : '#ef4444' }}>
                        {evalScore}점
                      </span>
                    )}

                    {/* 플랫폼 발행 아이콘 */}
                    <div className="flex gap-1 shrink-0">
                      {[
                        { key: 'naver',     label: 'N', pub: post.naver_published_at },
                        { key: 'wordpress', label: 'W', pub: post.wordpress_published_at },
                        { key: 'personal',  label: 'P', pub: post.personal_published_at },
                      ].map(pl => (
                        <span key={pl.key}
                          className="w-5 h-5 flex items-center justify-center rounded text-[9px] font-black"
                          style={{ background: pl.pub ? 'rgba(168,85,247,0.2)' : 'rgba(255,255,255,0.04)', color: pl.pub ? '#a855f7' : 'rgba(255,255,255,0.2)' }}>
                          {pl.label}
                        </span>
                      ))}
                    </div>

                    {/* 상태 배지 */}
                    <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ color: sm.color, background: sm.bg }}>
                      {isGen ? '생성중...' : sm.label}
                    </span>

                    {isOpen ? <ChevronUp size={13} className="text-white/20 shrink-0" /> : <ChevronDown size={13} className="text-white/20 shrink-0" />}
                  </div>

                  {/* 펼침: 타이틀 미리보기 + 액션 */}
                  {isOpen && (
                    <div className="px-4 pb-4 space-y-3 bg-white/[0.01]">

                      {/* 발행 날짜·시간 */}
                      <div className="flex items-center gap-2 pt-2">
                        <CalendarDays size={12} className="text-white/25 shrink-0" />
                        <p className="text-[10px] text-white/25 w-20 shrink-0">발행 예약</p>
                        <input
                          type="datetime-local"
                          defaultValue={toDatetimeLocal(post.scheduled_at)}
                          onChange={e => setScheduledAtEdits(p => ({ ...p, [post.id]: e.target.value }))}
                          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-[12px] text-white outline-none focus:border-[#4f8ef7]/40 [color-scheme:dark]"
                        />
                        <button
                          onClick={() => saveScheduledAt(post.id)}
                          disabled={!scheduledAtEdits[post.id] || savingDateIds.has(post.id)}
                          className="shrink-0 flex items-center gap-1 text-[11px] font-bold text-[#4f8ef7] border border-[#4f8ef7]/30 bg-[#4f8ef7]/10 hover:bg-[#4f8ef7]/20 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-30"
                        >
                          {savingDateIds.has(post.id) ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
                          저장
                        </button>
                      </div>

                      {/* 플랫폼별 제목 */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
                        {[
                          { key: 'naver',     label: '네이버',    title: post.naver_title },
                          { key: 'wordpress', label: '워드프레스', title: post.wordpress_title },
                          { key: 'personal',  label: '개인',      title: post.personal_title },
                        ].map(pl => (
                          <div key={pl.key} className="rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2">
                            <p className="text-[9px] text-white/25 uppercase tracking-wider mb-1">{pl.label}</p>
                            <p className="text-[11px] text-white/60 leading-snug">
                              {pl.title ?? <span className="text-white/20 italic">미생성</span>}
                            </p>
                          </div>
                        ))}
                      </div>

                      {/* 에러 */}
                      {post.error_message && (
                        <div className="flex items-center gap-2 text-[11px] text-red-400/70 font-mono">
                          <AlertCircle size={11} />{post.error_message}
                        </div>
                      )}

                      {/* 액션 버튼 */}
                      <div className="flex gap-2 flex-wrap">
                        {(post.status === 'pending' || post.status === 'failed') && (
                          <button onClick={() => generatePost(post)} disabled={isGen}
                            className="flex items-center gap-1.5 text-[11px] font-bold bg-[#4f8ef7]/10 border border-[#4f8ef7]/30 text-[#4f8ef7] hover:bg-[#4f8ef7]/20 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40">
                            {isGen ? <><Loader2 size={11} className="animate-spin" />생성 중...</> : <><Sparkles size={11} />콘텐츠 생성</>}
                          </button>
                        )}
                        {post.status === 'ready' && (
                          <button onClick={() => publishNow(post)} disabled={isPub}
                            className="flex items-center gap-1.5 text-[11px] font-bold bg-[#a855f7]/10 border border-[#a855f7]/30 text-[#a855f7] hover:bg-[#a855f7]/20 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40">
                            {isPub ? <><Loader2 size={11} className="animate-spin" />발행 중...</> : <><Upload size={11} />지금 발행</>}
                          </button>
                        )}
                        {post.status === 'published' && (
                          <span className="flex items-center gap-1.5 text-[11px] font-bold text-[#22c55e] px-3 py-1.5">
                            <Check size={11} />발행 완료
                          </span>
                        )}
                        <button onClick={() => deletePost(post.id)}
                          className="flex items-center gap-1.5 text-[11px] font-mono text-red-400/40 hover:text-red-400/70 border border-red-400/10 hover:border-red-400/30 px-2.5 py-1.5 rounded-lg transition-colors ml-auto">
                          <Trash2 size={11} />삭제
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 로딩 스텝 ────────────────────────────────────────────────────────────────
function generateLoadingSteps(): PipelineStep[] {
  return [
    { id: 'trends',   label: '트렌드 수집',       status: 'running' },
    { id: 'topic',    label: 'AI 주제 선정',       status: 'pending' },
    { id: 'keywords', label: '키워드 리서치',      status: 'pending' },
    { id: 'crawl',    label: '경쟁 포스트 크롤링', status: 'pending' },
    { id: 'write',    label: 'SEO 글 작성',        status: 'pending' },
    { id: 'publish',  label: '자동 발행',          status: 'skipped' },
  ];
}

// ─── 스텝 상세 ────────────────────────────────────────────────────────────────
function StepDetail({ id, data }: { id: string; data: unknown }) {
  const d = data as Record<string, unknown>;
  if (!d) return null;
  if (id === 'trends') {
    const sample = d.sample as string[] | undefined;
    return (
      <div className="flex flex-wrap gap-1 mt-1">
        {(sample ?? []).map((t, i) => <span key={i} className="text-[10px] text-white/40 bg-white/5 border border-white/8 px-2 py-0.5 rounded-full">{t}</span>)}
        {(d.count as number) > 5 && <span className="text-[10px] text-white/20">+{(d.count as number) - 5}개</span>}
      </div>
    );
  }
  if (id === 'topic') {
    return (
      <div className="space-y-1 mt-1">
        <p className="text-[11px] font-mono text-white/60"><span className="text-white/25">주제: </span>{String(d.topic ?? '')}</p>
        <p className="text-[11px] font-mono text-white/60"><span className="text-white/25">키워드: </span><span className="text-[#4f8ef7]/70">#{String(d.keyword ?? '')}</span></p>
      </div>
    );
  }
  if (id === 'keywords') {
    if (d.message) return <p className="text-[11px] font-mono text-white/30 mt-1">{String(d.message)}</p>;
    return (
      <div className="flex gap-4 mt-1">
        <MetricMini label="월 검색량" value={Number(d.monthlyTotal ?? 0).toLocaleString()} />
        <MetricMini label="경쟁도" value={`${Math.round(Number(d.competition ?? 0) * 100)}%`} />
        <MetricMini label="기회점수" value={`${Number(d.opportunity ?? 0)}점`} />
      </div>
    );
  }
  if (id === 'write') {
    return (
      <div className="flex items-center gap-4 mt-1">
        <MetricMini label="SEO점수" value={`${Number(d.seoScore ?? 0)}점`} />
        <MetricMini label="글자수" value={`${Number(d.length ?? 0).toLocaleString()}자`} />
      </div>
    );
  }
  return null;
}
