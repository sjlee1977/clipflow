'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Globe, Wand2, Send, Copy, Check, ChevronDown, ChevronUp, Loader2, FileText, RefreshCw, Settings, Sparkles, Bot, BarChart2, AlertCircle, CheckCircle2, Search, Tag, Lock, TrendingUp, Zap } from 'lucide-react';
import type { RelatedKeyword, TitleSuggestion } from '@/app/api/blog/keyword-suggest/route';

type Platform    = 'wordpress' | 'naver' | 'nextblog';
type SeoPlatform = 'naver' | 'google';
type Tone        = 'friendly' | 'professional' | 'storytelling' | 'empathetic' | 'educational' | 'casual';
type Length      = 'short' | 'medium' | 'long' | 'xlarge';

type SeoCheckItem = { item: string; pass: boolean; tip: string };

type WriteResult = {
  title: string; content: string;
  metaTitle: string; metaDescription: string;
  slug: string; tags: string[];
  seoChecklist: SeoCheckItem[]; seoScore: number;
  provider: string; targetKeyword: string; platform: string;
};

// SEO 점수 링
function SeoScoreRing({ score }: { score: number }) {
  const r = 26, circ = 2 * Math.PI * r;
  const filled = (score / 100) * circ;
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444';
  return (
    <svg width={68} height={68} viewBox="0 0 68 68">
      <circle cx={34} cy={34} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={6} />
      <circle cx={34} cy={34} r={r} fill="none" stroke={color} strokeWidth={6}
        strokeDasharray={`${filled} ${circ}`} strokeLinecap="round" transform="rotate(-90 34 34)" />
      <text x={34} y={34} textAnchor="middle" dominantBaseline="central"
        fill={color} fontSize={14} fontWeight={900}>{score}</text>
    </svg>
  );
}

function MiniScoreRing({ value, color, label }: { value: number; color: string; label: string }) {
  const r = 13, circ = 2 * Math.PI * r;
  const filled = (value / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-0.5">
      <svg width={34} height={34} viewBox="0 0 34 34">
        <circle cx={17} cy={17} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={2.5} />
        <circle cx={17} cy={17} r={r} fill="none" stroke={color} strokeWidth={2.5}
          strokeDasharray={`${filled} ${circ}`} strokeLinecap="round" transform="rotate(-90 17 17)"
          style={{ opacity: 0.85 }}
        />
        <text x={17} y={17} textAnchor="middle" dominantBaseline="central"
          fill={color} fontSize={9} fontWeight="500" style={{ opacity: 0.95 }}>{value}</text>
      </svg>
      <span className="text-[10px] text-white/30" style={{ fontFamily: "'Nanum Gothic', sans-serif" }}>{label}</span>
    </div>
  );
}

const BLOG_LLM_MODELS = [
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
const BLOG_LLM_PROVIDERS = ['Google', 'Anthropic', 'OpenAI', 'Alibaba'] as const;

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
const HOOK_TYPE_COLORS: Record<string, { bg: string; color: string }> = {
  '질문형': { bg: 'rgba(168,85,247,0.12)',  color: '#c084fc' },
  '숫자형': { bg: 'rgba(59,130,246,0.12)',  color: '#60a5fa' },
  '충격형': { bg: 'rgba(239,68,68,0.12)',   color: '#f87171' },
  '약속형': { bg: 'rgba(34,197,94,0.12)',   color: '#4ade80' },
  '비교형': { bg: 'rgba(20,184,166,0.12)',  color: '#2dd4bf' },
};
function AiPriceBadge({ price }: { price?: string }) {
  if (!price) return null;
  const tier = PRICE_TIER[price];
  if (!tier) return <span className="text-[10px] font-sans font-medium tracking-wide px-1.5 py-0.5 rounded-md text-white/35 bg-white/5">{price}</span>;
  return <span className="text-[10px] font-sans font-medium tracking-wide px-1.5 py-0.5 rounded-md whitespace-nowrap" style={{ color: tier.color, background: tier.bg }}>{price}</span>;
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
      <span className="w-1.5 h-1.5 rounded-full shrink-0 transition-all duration-200" style={{
        backgroundColor: active ? providerColor : 'rgba(255,255,255,0.15)',
        boxShadow: active ? `0 0 5px ${providerColor}80` : 'none',
      }} />
      <span className="flex-1 text-left text-[12px] transition-colors duration-150"
        style={{ color: active ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.42)' }}>{name}</span>
      <AiPriceBadge price={price} />
    </button>
  );
}
function AiModelSelector({ models, providers, selected, onSelect, defaultOpen = false }: {
  models: { id: string; name: string; provider: string; price?: string }[];
  providers: readonly string[];
  selected: string;
  onSelect: (id: string) => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
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
        <span className="w-1.5 h-1.5 rounded-full shrink-0 transition-all duration-200" style={{ backgroundColor: provMeta.color, boxShadow: `0 0 6px ${provMeta.color}80` }} />
        <span className="flex-1 text-left text-[11.5px] text-white/70 truncate">{selectedModel?.name ?? '—'}</span>
        <span className="text-[10px] text-white/25 mr-0.5">{selectedModel?.provider}</span>
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none"
          className={`shrink-0 text-white/25 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>
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

type CrawlResult = {
  title: string;
  byline: string;
  content: string;
  siteName: string;
  length: number;
};

type PlatformStatus = {
  wordpress: boolean;
  naver: boolean;
  nextblog: boolean;
};

const PLATFORM_INFO: Record<Platform, { label: string; color: string; icon: string; desc: string }> = {
  wordpress: { label: 'WordPress', color: '#21759b', icon: 'W', desc: 'REST API' },
  naver: { label: '네이버 블로그', color: '#03c75a', icon: 'N', desc: 'Open API' },
  nextblog: { label: 'Next.js 블로그', color: '#7c3aed', icon: '▲', desc: 'Supabase' },
};

const TONE_OPTIONS: { value: Tone; label: string; sub: string }[] = [
  { value: 'friendly',     label: '친근한',    sub: '대화체·편안함' },
  { value: 'professional', label: '전문적인',  sub: '권위·신뢰감' },
  { value: 'storytelling', label: '스토리텔링', sub: '서사·경험담' },
  { value: 'empathetic',   label: '공감형',    sub: '위로·독자중심' },
  { value: 'educational',  label: '실용적',    sub: '단계별·행동지침' },
  { value: 'casual',       label: '자유로운',  sub: '솔직·캐주얼' },
];

const LENGTH_OPTIONS: { value: Length; label: string; desc: string }[] = [
  { value: 'short',  label: '짧게',     desc: '1,000자 미만' },
  { value: 'medium', label: '보통',     desc: '2,000~3,000자' },
  { value: 'long',   label: '길게',     desc: '3,000~5,000자' },
  { value: 'xlarge', label: '아주 길게', desc: '5,000~7,000자' },
];

function BlogPageInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  // 키워드 페이지에서 전달된 파라미터
  const initKeyword = searchParams.get('keyword')  ?? '';
  const initVolume  = searchParams.get('volume')   ?? '';
  const initRelated = searchParams.get('related')  ?? '';

  const [url, setUrl] = useState('');
  const [crawling, setCrawling] = useState(false);
  const [crawlResult, setCrawlResult] = useState<CrawlResult | null>(null);
  const [crawlError, setCrawlError] = useState('');
  const [showSource, setShowSource] = useState(false);

  // SEO 인풋
  const [targetKeyword,   setTargetKeyword]   = useState(initKeyword);
  const [relatedKeywords, setRelatedKeywords] = useState(
    initRelated ? initRelated.split(',').filter(Boolean).join(', ') : ''
  );
  const [monthlyVolume,   setMonthlyVolume]   = useState(initVolume);
  const [seoPlatform,     setSeoPlatform]     = useState<SeoPlatform>('naver');

  // 키워드 분석 결과
  const [kwAnalyzing, setKwAnalyzing]         = useState(false);
  const [kwResult, setKwResult]               = useState<{
    relatedKeywords: RelatedKeyword[];
    titles: TitleSuggestion[];
    hasLiveData: boolean;
    searchVolume: number;
    contentSaturation: number;
    saturationRate: number;
  } | null>(null);
  const [kwError, setKwError]                 = useState('');

  const [tone, setTone] = useState<Tone>('friendly');
  const [speechLevel, setSpeechLevel] = useState<'formal' | 'casual'>('formal');
  const [length, setLength] = useState<Length>('medium');
  const [customPrompt, setCustomPrompt] = useState('');
  const [writing, setWriting] = useState(false);
  const [blogContent, setBlogContent] = useState('');
  const [blogTitle, setBlogTitle] = useState('');
  const [writeError, setWriteError] = useState('');
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
  const [writeResult, setWriteResult] = useState<WriteResult | null>(null);

  const [llmModelId, setLlmModelId] = useState('gemini-2.5-flash');
  const [writeMode, setWriteMode] = useState<'standard' | 'agent'>('standard');
  const [evaluation, setEvaluation] = useState<{
    totalScore: number; grade: string; passed: boolean;
    suggestions: string[];
    dimensions: { nameKo: string; score: number; reason: string; suggestion: string }[];
  } | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [agentSteps, setAgentSteps] = useState<{ agent: string; status: string; summary: string }[]>([]);

  const [copied, setCopied] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<Platform>('wordpress');
  const [platformStatus, setPlatformStatus] = useState<PlatformStatus>({ wordpress: false, naver: false, nextblog: false });
  const [statusOverride, setStatusOverride] = useState<'draft' | 'publish' | 'published'>('draft');
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<{ success: boolean; message: string; link?: string } | null>(null);

  const editorRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch('/api/blog/credentials')
      .then(r => r.json())
      .then(d => {
        if (d.wordpress || d.naver || d.nextblog) {
          setPlatformStatus({
            wordpress: d.wordpress?.connected ?? false,
            naver: d.naver?.connected ?? false,
            nextblog: d.nextblog?.connected ?? false,
          });
          // 연결된 첫 번째 플랫폼 자동 선택
          if (d.wordpress?.connected) setSelectedPlatform('wordpress');
          else if (d.naver?.connected) setSelectedPlatform('naver');
          else if (d.nextblog?.connected) setSelectedPlatform('nextblog');
        }
      })
      .catch(() => {});
  }, []);

  async function handleCrawl() {
    if (!url.trim()) return;
    setCrawling(true);
    setCrawlError('');
    setCrawlResult(null);
    try {
      const res = await fetch('/api/blog/crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '크롤링 실패');
      setCrawlResult(data);
    } catch (err: unknown) {
      setCrawlError(err instanceof Error ? err.message : '크롤링 중 오류 발생');
    } finally {
      setCrawling(false);
    }
  }

  async function runEvaluate(content: string) {
    if (!content.trim()) return;
    setEvaluating(true);
    setEvaluation(null);
    try {
      const res = await fetch('/api/blog/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, llmModelId }),
      });
      const data = await res.json();
      if (res.ok) setEvaluation(data);
    } catch { /* 채점 실패는 조용히 */ }
    finally { setEvaluating(false); }
  }

  async function handleKeywordAnalyze() {
    if (!targetKeyword.trim()) return;
    setKwAnalyzing(true);
    setKwError('');
    setKwResult(null);
    try {
      const res = await fetch('/api/blog/keyword-suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: targetKeyword.trim(), platform: seoPlatform, llmModelId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '키워드 분석 실패');
      setKwResult(data);
      // 연관 키워드 자동 채우기
      if (data.relatedKeywords?.length > 0) {
        const kwList = (data.relatedKeywords as RelatedKeyword[])
          .map(k => k.keyword).filter(Boolean).join(', ');
        setRelatedKeywords(kwList);
      }
      // 검색량 자동 채우기
      if (data.searchVolume > 0) setMonthlyVolume(String(data.searchVolume));
    } catch (err: unknown) {
      setKwError(err instanceof Error ? err.message : '분석 실패');
    } finally {
      setKwAnalyzing(false);
    }
  }

  async function handleWrite() {
    setWriting(true);
    setWriteError('');
    setEvaluation(null);
    setAgentSteps([]);
    try {
      const related = relatedKeywords
        .split(',').map(s => s.trim()).filter(Boolean);

      const endpoint = writeMode === 'agent' ? '/api/blog/write-agent' : '/api/blog/write';
      const body = writeMode === 'agent'
        ? { content: crawlResult?.content || customPrompt || '', title: crawlResult?.title || '', tone, length, llmModelId }
        : {
            targetKeyword:   targetKeyword.trim() || crawlResult?.title || '',
            relatedKeywords: related,
            platform:        seoPlatform,
            tone,
            koreanSpeechLevel: speechLevel,
            minLength:       length === 'short' ? 800 : length === 'medium' ? 2000 : length === 'long' ? 3000 : 5000,
            source:          crawlResult?.content || '',
            customPrompt:    customPrompt.trim() || undefined,
            monthlyVolume:   monthlyVolume ? parseInt(monthlyVolume) : undefined,
          };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '작성 실패');
      setBlogContent(data.content);
      setBlogTitle(data.title);
      if (data.steps) setAgentSteps(data.steps);
      if (writeMode !== 'agent') setWriteResult(data as WriteResult);
      setActiveTab('edit');

      // 에이전트 모드: write-agent 내부 채점 결과를 직접 사용 (별도 API 호출 불필요)
      if (writeMode === 'agent' && data.scores && typeof data.totalScore === 'number') {
        const s = data.scores as Record<string, number>;
        const scoreMap: { key: string; nameKo: string }[] = [
          { key: 'hook',          nameKo: '훅 강도' },
          { key: 'structure',     nameKo: '서사 구조' },
          { key: 'showTell',      nameKo: 'Show/Tell' },
          { key: 'rhythm',        nameKo: '문장 리듬' },
          { key: 'emotionalFlow', nameKo: '감정 흐름' },
          { key: 'cta',           nameKo: 'CTA' },
          { key: 'forbidden',     nameKo: '금지 표현' },
          { key: 'closing',       nameKo: '클로징 에코' },
          { key: 'humanFeel',       nameKo: '인간 필기감' },
          { key: 'factualAccuracy', nameKo: '사실 정확성' },
        ];
        const total: number = data.totalScore;
        const grade = total >= 90 ? 'S' : total >= 80 ? 'A' : total >= 70 ? 'B' : 'C';
        setEvaluation({
          totalScore: total,
          grade,
          passed: total >= 70,
          suggestions: (data.editorNotes ?? []).slice(0, 3),
          dimensions: scoreMap.map(({ key, nameKo }) => ({
            nameKo,
            score: s[key] ?? 0,
            reason: '',
            suggestion: '',
          })),
        });
      } else {
        // 표준 모드: 별도 채점 API 호출
        await runEvaluate(data.content);
      }
    } catch (err: unknown) {
      setWriteError(err instanceof Error ? err.message : '블로그 작성 중 오류 발생');
    } finally {
      setWriting(false);
    }
  }

  async function handlePublish() {
    if (!blogContent.trim() || !blogTitle.trim()) return;
    if (!platformStatus[selectedPlatform]) {
      router.push('/dashboard/settings');
      return;
    }
    setPublishing(true);
    setPublishResult(null);
    try {
      const res = await fetch('/api/blog/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: selectedPlatform, title: blogTitle, content: blogContent, statusOverride }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '발행 실패');
      setPublishResult({ success: true, message: '발행이 완료되었습니다!', link: data.link || data.postUrl });
    } catch (err: unknown) {
      setPublishResult({ success: false, message: err instanceof Error ? err.message : '발행 중 오류 발생' });
    } finally {
      setPublishing(false);
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(blogContent).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }

  function renderMarkdown(md: string) {
    const html = md
      .replace(/^### (.+)$/gm, '<h3 style="font-size:14px;font-weight:700;color:rgba(255,255,255,0.9);margin-top:16px;margin-bottom:4px">$1</h3>')
      .replace(/^## (.+)$/gm, '<h2 style="font-size:16px;font-weight:900;color:#fff;margin-top:20px;margin-bottom:8px">$1</h2>')
      .replace(/^# (.+)$/gm, '<h1 style="font-size:18px;font-weight:900;color:#fff;margin-top:8px;margin-bottom:12px">$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/^- (.+)$/gm, '<li style="margin-left:16px;list-style:disc;color:rgba(255,255,255,0.7);font-size:13px;line-height:1.6">$1</li>')
      .replace(/\n\n/g, '</p><p style="color:rgba(255,255,255,0.7);font-size:13px;line-height:1.6;margin-bottom:12px">')
      .replace(/\n/g, '<br>');
    return `<p style="color:rgba(255,255,255,0.7);font-size:13px;line-height:1.6;margin-bottom:12px">${html}</p>`;
  }

  const anyConnected = Object.values(platformStatus).some(Boolean);

  return (
    <div className="flex gap-0 -my-6" style={{ minHeight: 'calc(100vh - 56px)' }}>

      {/* ─── 좌측(40%) + 중앙(60%) 래퍼 ─── */}
      <div className="flex-1 min-w-0 flex overflow-hidden">

      {/* ─── 좌측: 입력 / 설정 (40%) ─── */}
      <div className="w-2/5 shrink-0 flex flex-col overflow-y-auto" style={{ borderRight: '1px solid var(--border)' }}>
        <div className="px-4 py-6 space-y-4">

          {/* 헤더 */}
          <div className="flex items-center gap-3 mt-4">
            <span className="w-7 h-7 flex items-center justify-center rounded-lg shrink-0" style={{ background: 'rgba(79,142,247,0.06)', border: '1px solid rgba(79,142,247,0.22)', color: '#4f8ef7' }}>
              <FileText size={13} strokeWidth={1.8} />
            </span>
            <span className="text-[19px] font-semibold text-white leading-none translate-y-px">블로그 작성</span>
          </div>

          {/* URL 크롤링 */}
          <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
            <p className="text-[11px] font-bold text-white/40 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Globe size={12} />URL 크롤링
            </p>
            <div className="flex gap-2">
              <input
                type="url"
                value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCrawl()}
                placeholder="https://example.com/article"
                className="flex-1 bg-black border border-[rgba(79,142,247,0.12)] hover:border-[rgba(79,142,247,0.24)] focus:border-[rgba(79,142,247,0.40)] rounded-lg px-3 py-2 text-[12px] text-white/80 placeholder-white/25 outline-none transition-colors"
              />
              <button
                onClick={handleCrawl}
                disabled={crawling || !url.trim()}
                className="flex items-center gap-1.5 bg-white/8 hover:bg-white/15 disabled:opacity-40 border border-white/10 text-white/70 text-[12px] font-bold px-3 py-2 rounded-lg transition-colors shrink-0"
              >
                {crawling ? <Loader2 size={12} className="animate-spin" /> : <Globe size={12} />}
              </button>
            </div>
            {crawlError && <p className="text-red-400/80 text-[11px] font-mono mt-2">{crawlError}</p>}
            {crawlResult && (
              <div className="mt-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono text-white/40">{crawlResult.siteName}</span>
                  <button onClick={() => setShowSource(!showSource)} className="text-[11px] font-mono text-white/30 hover:text-white/60 flex items-center gap-1 transition-colors">
                    원문 {showSource ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                  </button>
                </div>
                <p className="text-[12px] font-bold text-white/80 mt-1.5 leading-snug">{crawlResult.title}</p>
                {showSource && (
                  <div className="mt-2 max-h-32 overflow-y-auto rounded-lg bg-black/30 border border-white/8 p-2">
                    <p className="text-[10px] text-white/40 leading-relaxed whitespace-pre-wrap">
                      {crawlResult.content.slice(0, 2000)}{crawlResult.content.length > 2000 ? '\n...(생략)' : ''}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* SEO 키워드 */}
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--card)' }}>
            <div className="flex items-center gap-2.5 px-4 py-2.5" style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
              <div className="w-5 h-5 flex items-center justify-center rounded-md shrink-0" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
                <Search size={9} className="text-white/50" />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>SEO 키워드</span>
            </div>
            <div className="px-4 py-3 space-y-3">
              <div className="flex gap-1.5">
                {(['naver', 'google'] as SeoPlatform[]).map(p => (
                  <button key={p} onClick={() => setSeoPlatform(p)}
                    className={`cf-filter-btn flex-1 py-1.5 text-[11px] font-mono rounded-lg border transition-colors ${
                      seoPlatform === p ? 'border-[#4f8ef7]/40 bg-[#4f8ef7]/10 text-white' : 'border-white/8 text-white/30 hover:text-white/60'
                    }`}
                  >{p === 'naver' ? '네이버 SEO' : '구글 SEO'}</button>
                ))}
              </div>
              {/* 키워드 입력 + 분석 버튼 */}
              <div className="flex gap-1.5">
                <input type="text" value={targetKeyword} onChange={e => { setTargetKeyword(e.target.value); setKwResult(null); }}
                  onKeyDown={e => e.key === 'Enter' && handleKeywordAnalyze()}
                  placeholder="메인 키워드 (예: 홈트레이닝)"
                  className="flex-1 bg-black border border-[rgba(79,142,247,0.12)] hover:border-[rgba(79,142,247,0.24)] focus:border-[rgba(79,142,247,0.40)] rounded-lg px-3 py-2 text-[12px] text-white/70 placeholder-white/25 outline-none transition-colors font-mono"
                />
                <button onClick={handleKeywordAnalyze} disabled={kwAnalyzing || !targetKeyword.trim()}
                  className="shrink-0 flex items-center gap-1 px-2.5 py-2 rounded-lg border text-[11px] font-bold transition-all duration-150 disabled:opacity-40"
                  style={{ background: 'rgba(79,142,247,0.1)', border: '1px solid rgba(79,142,247,0.25)', color: '#4f8ef7' }}
                  title="키워드 분석 (연관어·태그·제목 7개)"
                >
                  {kwAnalyzing ? <Loader2 size={11} className="animate-spin" /> : <TrendingUp size={11} />}
                  {kwAnalyzing ? '' : '분석'}
                </button>
              </div>

              <textarea value={customPrompt} onChange={e => setCustomPrompt(e.target.value)}
                placeholder="추가 지시사항 (예: SEO 최적화, 특정 독자층, 포함할 내용...)" rows={2}
                className="w-full bg-black border border-white/8 hover:border-white/15 focus:border-white/25 rounded-lg px-3 py-2 text-[12px] text-white/50 placeholder-white/20 outline-none transition-colors resize-none"
              />
              {monthlyVolume && (
                <div className="flex items-center gap-2 text-[12px] text-white/30" style={{ fontFamily: "'Nanum Gothic', sans-serif" }}>
                  <Tag size={10} />월간 검색량 {parseInt(monthlyVolume).toLocaleString()}회
                </div>
              )}

              {/* 오류 */}
              {kwError && (
                <div className="flex items-center gap-1.5 text-[11px] text-orange-400/80 font-mono">
                  <AlertCircle size={10} />{kwError}
                </div>
              )}

              {/* 키워드 분석 결과 카드 */}
              {kwResult && (
                <div className="space-y-3 pt-1">
                  {/* 데이터 출처 배지 */}
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[11px] px-1.5 py-0.5 rounded border ${kwResult.hasLiveData ? 'text-[#4f8ef7]/70 border-[#4f8ef7]/20 bg-[#4f8ef7]/5' : 'text-white/25 border-white/8 bg-transparent'}`} style={{ fontFamily: "'Nanum Gothic', sans-serif" }}>
                      {kwResult.hasLiveData ? '네이버 실시간' : 'AI 추정'}
                    </span>
                    {kwResult.searchVolume > 0 && (
                      <span className="text-[11px] text-white/25" style={{ fontFamily: "'Nanum Gothic', sans-serif" }}>
                        검색 {kwResult.searchVolume.toLocaleString()} · 발행 {kwResult.contentSaturation.toLocaleString()} · 포화 {kwResult.saturationRate}%
                      </span>
                    )}
                  </div>

                  {/* 연관 키워드 7개 */}
                  {kwResult.relatedKeywords.length > 0 && (
                    <div>
                      <p className="text-[11px] font-bold text-white/25 uppercase tracking-widest mb-1.5" style={{ fontFamily: "'Nanum Gothic', sans-serif" }}>연관 키워드</p>
                      <div className="flex flex-wrap gap-1">
                        {kwResult.relatedKeywords.map((kw, i) => (
                          <button key={i}
                            onClick={() => {
                              const arr = relatedKeywords.split(',').map(s => s.trim()).filter(Boolean);
                              if (!arr.includes(kw.keyword)) {
                                setRelatedKeywords([...arr, kw.keyword].join(', '));
                              }
                            }}
                            className="flex items-center gap-1 text-[11.5px] px-2 py-1 rounded-md border border-white/10 hover:border-[#4f8ef7]/30 bg-white/[0.02] hover:bg-[#4f8ef7]/5 text-white/50 hover:text-white/80 transition-all duration-150"
                            style={{ fontFamily: "'Nanum Gothic', sans-serif" }}
                            title={kw.monthlyTotal > 0 ? `월간 ${kw.monthlyTotal.toLocaleString()}회 · 경쟁 ${kw.compIdx}` : ''}
                          >
                            {kw.keyword}
                            {kw.monthlyTotal > 0 && (
                              <span className="text-[12px] text-white/25" style={{ fontFamily: "'Nanum Gothic', sans-serif" }}>{(kw.monthlyTotal/1000).toFixed(0)}K</span>
                            )}
                            {kw.opportunity >= 70 && <Zap size={8} className="text-yellow-400/60" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 제목 추천 7개 */}
                  {kwResult.titles.length > 0 && (
                    <div>
                      <p className="text-[11px] font-bold text-white/25 uppercase tracking-widest mb-1.5" style={{ fontFamily: "'Nanum Gothic', sans-serif" }}>제목 추천</p>
                      <div className="space-y-1">
                        {kwResult.titles.map((t, i) => {
                          const hookColor = HOOK_TYPE_COLORS[t.hookType] ?? { bg: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.35)' };
                          const oppColor  = t.opportunityScore >= 75 ? '#facc15' : t.opportunityScore >= 55 ? '#60a5fa' : '#475569';
                          return (
                            <button key={i}
                              onClick={() => { setBlogTitle(t.title); setTargetKeyword(prev => prev || t.title.slice(0, 20)); }}
                              className="w-full text-left flex items-center gap-3 px-2.5 py-2.5 rounded-lg border border-white/8 hover:border-[#4f8ef7]/25 bg-white/[0.01] hover:bg-[#4f8ef7]/[0.04] transition-all duration-150 group"
                            >
                              {/* 제목 */}
                              <span className="flex-1 min-w-0 text-[12.5px] text-white/70 group-hover:text-white/90 leading-snug" style={{ fontFamily: "'Nanum Gothic', sans-serif" }}>{t.title}</span>
                              {/* 우측 그래픽 패널 */}
                              <div className="shrink-0 flex flex-col items-center gap-1.5">
                                {/* 훅 유형 배지 */}
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md whitespace-nowrap"
                                  style={{ background: hookColor.bg, color: hookColor.color, fontFamily: "'Nanum Gothic', sans-serif" }}>
                                  {t.hookType}
                                </span>
                                {/* SEO + 기회 미니 링 */}
                                <div className="flex items-end gap-2">
                                  <MiniScoreRing value={t.seoScore}        color="#4f8ef7" label="SEO" />
                                  <MiniScoreRing value={t.opportunityScore} color={oppColor} label="기회" />
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* ─── 중앙: 블로그 에디터 (60%) ─── */}
      <div className="flex-1 min-w-0 overflow-y-auto p-6">
        {blogContent ? (
          <div className="rounded-xl border border-white/8 bg-white/[0.02] overflow-hidden h-full flex flex-col">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/8 shrink-0">
              <div className="flex gap-1">
                {(['edit', 'preview'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`text-[11px] font-mono px-3 py-1 rounded transition-colors ${
                      activeTab === tab ? 'text-white bg-white/10' : 'text-white/30 hover:text-white/60'
                    }`}
                  >
                    {tab === 'edit' ? '편집' : '미리보기'}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-white/20">{blogContent.length.toLocaleString()}자</span>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1 border border-white/15 hover:border-white/30 text-white/50 hover:text-white/80 rounded-md transition-colors"
                >
                  {copied ? <Check size={11} /> : <Copy size={11} />}
                  {copied ? '복사됨' : '복사'}
                </button>
              </div>
            </div>
            <div className="px-4 pt-3 shrink-0">
              <input
                type="text"
                value={blogTitle}
                onChange={e => setBlogTitle(e.target.value)}
                placeholder="블로그 제목..."
                className="w-full bg-transparent border-b border-white/10 focus:border-white/30 pb-2 text-[16px] font-black text-white outline-none transition-colors placeholder-white/15"
              />
            </div>
            {activeTab === 'edit' ? (
              <textarea
                ref={editorRef}
                value={blogContent}
                onChange={e => setBlogContent(e.target.value)}
                className="flex-1 w-full bg-transparent px-4 py-3 text-[13px] text-white/80 font-mono leading-relaxed outline-none resize-none"
                spellCheck={false}
              />
            ) : (
              <div className="flex-1 px-4 py-3 overflow-y-auto" dangerouslySetInnerHTML={{ __html: renderMarkdown(blogContent) }} />
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-4 min-h-[400px]">
            <div className="w-16 h-16 border border-white/8 rounded-2xl flex items-center justify-center">
              <FileText size={24} className="text-white/10" />
            </div>
            <p className="text-[13px] text-white/30 font-mono">좌측에서 설정 후 AI 블로그 작성을 눌러주세요</p>
            <button
              onClick={() => { setBlogContent('# 블로그 제목\n\n여기에 내용을 작성하세요...'); setBlogTitle('블로그 제목'); }}
              className="text-[12px] text-[#4f8ef7]/50 hover:text-[#4f8ef7] transition-colors font-mono"
            >
              빈 문서로 시작 →
            </button>
          </div>
        )}
      </div>

      </div>{/* ─── 좌측+중앙 래퍼 끝 ─── */}

      {/* ─── 우측 사이드바: AI 모델 + 채점 + 발행 ─── */}
      <aside className="w-96 shrink-0 flex flex-col overflow-y-auto" style={{ borderLeft: '1px solid var(--border)', background: 'var(--sidebar)' }}>
        <div className="px-3 py-4 space-y-3">

          {/* AI 모델 카드 */}
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--card)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)' }}>
            <div className="flex items-center gap-2.5 px-4 py-2.5" style={{ background: 'rgba(79,142,247,0.04)' }}>
              <div className="w-5 h-5 flex items-center justify-center rounded-md shrink-0" style={{ background: 'rgba(79,142,247,0.12)', border: '1px solid rgba(79,142,247,0.25)' }}>
                <Bot size={9} style={{ color: '#4f8ef7' }} />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>AI 모델</span>
              <div className="flex items-center gap-1 ml-auto">
                {([
                  { id: 'standard', label: '표준',    rgb: '255,255,255', icon: <Wand2 size={9} /> },
                  { id: 'agent',    label: '전문작가', rgb: '79,142,247',  icon: <Bot size={9} /> },
                ] as const).map(({ id, label, rgb, icon }) => {
                  const isActive = writeMode === id;
                  return (
                    <button key={id} onClick={() => setWriteMode(id)} data-active={isActive ? 'true' : undefined}
                      className="cf-tab-btn flex items-center gap-1 text-[10px] font-medium px-2.5 py-1 rounded-md tracking-wide transition-all duration-200 whitespace-nowrap"
                      style={{ color: isActive ? `rgb(${rgb})` : 'rgba(255,255,255,0.28)', background: isActive ? `rgba(${rgb},0.1)` : 'transparent', border: isActive ? `1px solid rgba(${rgb},0.3)` : '1px solid transparent', '--tab-rgb': rgb } as React.CSSProperties}
                      onMouseEnter={e => { if (!isActive) { const el = e.currentTarget; el.style.color = `rgba(${rgb},0.85)`; el.style.background = `rgba(${rgb},0.07)`; el.style.borderColor = `rgba(${rgb},0.25)`; el.setAttribute('data-glow', 'true'); } }}
                      onMouseLeave={e => { if (!isActive) { const el = e.currentTarget; el.style.color = 'rgba(255,255,255,0.28)'; el.style.background = 'transparent'; el.style.borderColor = 'transparent'; el.removeAttribute('data-glow'); } }}
                    >{icon}{label}</button>
                  );
                })}
              </div>
            </div>
            <div className="px-3 py-3 space-y-2">
              <AiModelSelector
                models={BLOG_LLM_MODELS}
                providers={BLOG_LLM_PROVIDERS}
                selected={llmModelId}
                onSelect={id => setLlmModelId(id)}
              />
              {writeMode === 'agent' && (
                <div className="flex items-center gap-2 bg-[#4f8ef7]/5 border border-[#4f8ef7]/15 rounded-lg px-3 py-2">
                  <Sparkles size={11} className="text-[#4f8ef7]/60 shrink-0" />
                  <p className="text-[11px] text-white/40">리서처 → 작가 → 편집장 3단계 멀티에이전트</p>
                </div>
              )}
            </div>
          </div>

          {/* 작성 설정 카드 */}
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--card)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)' }}>
            <div className="flex items-center gap-2.5 px-4 py-2.5" style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
              <div className="w-5 h-5 flex items-center justify-center rounded-md shrink-0" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
                <Wand2 size={9} className="text-white/50" />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>작성 설정</span>
            </div>
            <div className="px-4 py-3 space-y-4">
              <div>
                <p className="text-[11px] text-white/25 mb-2 uppercase tracking-wider" style={{ fontFamily: "'Nanum Gothic', sans-serif" }}>문체</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {TONE_OPTIONS.map(opt => (
                    <button key={opt.value} onClick={() => setTone(opt.value)}
                      className={`flex flex-col items-center gap-0.5 py-1.5 px-1 rounded-lg border transition-colors ${
                        tone === opt.value ? 'border-[#4f8ef7]/40 bg-[#4f8ef7]/10 text-[#4f8ef7]' : 'border-white/8 text-white/40 hover:text-white/70 hover:border-white/20 hover:bg-white/5'
                      }`}
                    >
                      <span className="text-[11px] font-mono">{opt.label}</span>
                      <span className="text-[9px] opacity-50">{opt.sub}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[11px] text-white/25 mb-2 uppercase tracking-wider" style={{ fontFamily: "'Nanum Gothic', sans-serif" }}>말투</p>
                <div className="flex gap-1.5">
                  {([['formal', '존댓말', '~입니다·해요'], ['casual', '반말', '~야·거든']] as const).map(([val, label, sub]) => (
                    <button key={val} onClick={() => setSpeechLevel(val)}
                      className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 px-1 rounded-lg border transition-colors ${
                        speechLevel === val ? 'border-[#4f8ef7]/40 bg-[#4f8ef7]/10 text-[#4f8ef7]' : 'border-white/8 text-white/40 hover:text-white/70 hover:border-white/20 hover:bg-white/5'
                      }`}
                    >
                      <span className="text-[11px] font-mono">{label}</span>
                      <span className="text-[9px] opacity-50">{sub}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[11px] text-white/25 mb-2 uppercase tracking-wider" style={{ fontFamily: "'Nanum Gothic', sans-serif" }}>길이</p>
                <div className="grid grid-cols-4 gap-1">
                  {LENGTH_OPTIONS.map(opt => (
                    <button key={opt.value} onClick={() => setLength(opt.value)}
                      className={`flex flex-col items-center text-center py-2 rounded-lg border transition-colors ${
                        length === opt.value ? 'border-[#4f8ef7]/40 bg-[#4f8ef7]/10 text-[#4f8ef7]' : 'border-white/8 text-white/40 hover:text-white/70 hover:border-white/20 hover:bg-white/5'
                      }`}
                    >
                      <span className="text-[11px] font-medium block leading-tight">{opt.label}</span>
                      <span className="text-[9px] text-white/25 leading-tight mt-0.5">{opt.desc}</span>
                    </button>
                  ))}
                </div>
                {llmModelId === 'claude-haiku-4-5-20251001' && length !== 'short' && (
                  <div className="mt-2 flex items-start gap-1.5 bg-amber-400/5 border border-amber-400/20 rounded-lg px-2.5 py-2">
                    <AlertCircle size={11} className="text-amber-400/70 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-amber-400/70 leading-relaxed">Haiku 모델은 최대 ~8,000 토큰으로 1,000자 미만에서만 안정적으로 사용 가능합니다.</p>
                  </div>
                )}
              </div>
              {writeError && <p className="text-red-400/80 text-[12px] font-mono">{writeError}</p>}
              <button onClick={handleWrite} disabled={writing || (!crawlResult && !customPrompt.trim() && !targetKeyword.trim())}
                className="cf-filter-btn sidebar-btn w-full flex items-center justify-center gap-2 border border-white/8 text-white/40 disabled:opacity-30 disabled:cursor-not-allowed font-bold text-[12px] py-2.5 rounded-lg transition-colors"
              >
                {writing ? (
                  <><Loader2 size={14} className="animate-spin" /> {writeMode === 'agent' ? '에이전트 작동 중...' : '작성 중...'}</>
                ) : blogContent ? (
                  <><RefreshCw size={14} /> 다시 작성</>
                ) : (
                  <><Wand2 size={14} /> AI 블로그 작성</>
                )}
              </button>
              {((writing && writeMode === 'agent') || agentSteps.length > 0) && (
                <div className="space-y-1.5">
                  <p className="text-[10px] text-white/25 uppercase tracking-wider">에이전트 진행</p>
                  {writing && agentSteps.length === 0 ? (
                    <div className="flex items-center gap-2 text-[11px] font-mono text-white/30">
                      <Loader2 size={11} className="animate-spin text-[#4f8ef7]/50" />리서처 분석 중...
                    </div>
                  ) : agentSteps.map((step, i) => (
                    <div key={i} className="flex items-start gap-2 text-[11px] font-mono">
                      {step.status === 'done'
                        ? <CheckCircle2 size={11} className="text-[#4f8ef7]/70 mt-0.5 shrink-0" />
                        : <Loader2 size={11} className="animate-spin text-white/30 mt-0.5 shrink-0" />}
                      <div>
                        <span className="text-white/50 font-bold">{step.agent}</span>
                        {step.summary && <span className="text-white/25 ml-1">— {step.summary}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 채점 결과 카드 */}
          {(evaluating || evaluation) && (
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--card)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)' }}>
              <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: '1px solid var(--border)', background: 'rgba(79,142,247,0.04)' }}>
                <div className="flex items-center gap-2.5">
                  <div className="w-5 h-5 flex items-center justify-center rounded-md shrink-0" style={{ background: 'rgba(79,142,247,0.12)', border: '1px solid rgba(79,142,247,0.25)' }}>
                    <BarChart2 size={9} style={{ color: '#4f8ef7' }} />
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>품질 채점</span>
                </div>
                {evaluation && (
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-black ${
                    evaluation.grade === 'S' ? 'border-yellow-400/30 bg-yellow-400/10 text-yellow-400' :
                    evaluation.grade === 'A' ? 'border-[#4f8ef7]/30 bg-[#4f8ef7]/10 text-[#4f8ef7]' :
                    evaluation.grade === 'B' ? 'border-blue-400/30 bg-blue-400/10 text-blue-400' :
                    'border-orange-400/30 bg-orange-400/10 text-orange-400'
                  }`}>{evaluation.grade}등급 {evaluation.totalScore}점</div>
                )}
              </div>
              <div className="px-4 py-3 space-y-3">
                {evaluating ? (
                  <div className="flex items-center gap-2 text-[11px] font-mono text-white/30">
                    <Loader2 size={11} className="animate-spin" />AI 채점 중...
                  </div>
                ) : evaluation ? (
                  <>
                    <div className="space-y-1.5">
                      {evaluation.dimensions.map((dim, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="text-[10px] text-white/30 w-20 shrink-0 truncate">{dim.nameKo}</span>
                          <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${dim.score >= 8 ? 'bg-[#4f8ef7]/70' : dim.score >= 6 ? 'bg-blue-400/70' : 'bg-orange-400/70'}`}
                              style={{ width: `${dim.score * 10}%` }} />
                          </div>
                          <span className={`text-[10px] w-6 text-right shrink-0 ${dim.score >= 8 ? 'text-[#4f8ef7]/70' : dim.score >= 6 ? 'text-blue-400/70' : 'text-orange-400/70'}`}>{dim.score}</span>
                        </div>
                      ))}
                    </div>
                    {evaluation.suggestions.length > 0 && (
                      <div className="bg-white/[0.02] border border-white/8 rounded-lg p-3 space-y-1.5">
                        <p className="text-[10px] text-white/25 uppercase tracking-wider flex items-center gap-1">
                          <AlertCircle size={10} />개선 제안
                        </p>
                        {evaluation.suggestions.slice(0, 3).map((s, i) => (
                          <p key={i} className="text-[11px] font-mono text-white/40 leading-relaxed">• {s}</p>
                        ))}
                      </div>
                    )}
                    {evaluation.totalScore < 75 && (
                      <button onClick={() => { setWriteMode('agent'); handleWrite(); }} disabled={writing}
                        className="w-full flex items-center justify-center gap-2 bg-[#4f8ef7]/10 hover:bg-[#4f8ef7]/20 border border-[#4f8ef7]/20 hover:border-[#4f8ef7]/40 text-[#4f8ef7]/80 hover:text-[#4f8ef7] text-[12px] font-bold py-2 rounded-lg transition-colors"
                      >
                        <Sparkles size={12} />전문작가 에이전트로 개선 ({evaluation.totalScore}점 → 목표 75점)
                      </button>
                    )}
                  </>
                ) : null}
              </div>
            </div>
          )}

          {/* 발행 카드 */}
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--card)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)' }}>
            <div className="flex items-center gap-2.5 px-4 py-2.5" style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
              <div className="w-5 h-5 flex items-center justify-center rounded-md shrink-0" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
                <Send size={9} className="text-white/50" />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>발행 플랫폼</span>
            </div>
            <div className="px-4 py-3 space-y-4">
              <div className="flex gap-2">
                {(Object.keys(PLATFORM_INFO) as Platform[]).map(platform => {
                  const info = PLATFORM_INFO[platform];
                  const isSelected = selectedPlatform === platform;
                  const isConn = platformStatus[platform];
                  return (
                    <button
                      key={platform}
                      onClick={() => setSelectedPlatform(platform)}
                      className="relative flex-1 flex flex-col items-center gap-2 py-3 rounded-xl border transition-all duration-200"
                      style={{
                        borderColor: isSelected ? `${info.color}55` : 'rgba(255,255,255,0.06)',
                        background: isSelected ? `${info.color}0f` : 'rgba(255,255,255,0.01)',
                      }}
                    >
                      {/* 연결 상태 표시 */}
                      <span className="absolute top-2 right-2">
                        {isConn ? (
                          <span className="relative flex w-1.5 h-1.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: '#4ade80' }} />
                            <span className="relative inline-flex rounded-full w-1.5 h-1.5 bg-green-400" />
                          </span>
                        ) : (
                          <span className="w-1.5 h-1.5 rounded-full bg-white/20 block" />
                        )}
                      </span>
                      {/* 플랫폼 아이콘 */}
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[12px] font-black text-white shrink-0 transition-all duration-200"
                        style={{ backgroundColor: isSelected ? info.color : `${info.color}55` }}>
                        {info.icon}
                      </div>
                      {/* 플랫폼명 */}
                      <span className="text-[11px] font-medium transition-colors duration-200 leading-tight text-center"
                        style={{ color: isSelected ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.35)' }}>
                        {info.label}
                      </span>
                      {/* 미연결 배지 */}
                      {!isConn && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full"
                          style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', color: 'rgba(251,191,36,0.6)' }}>
                          <Lock size={8} strokeWidth={2.5} />
                          <span className="text-[9px] font-medium">미연결</span>
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {!platformStatus[selectedPlatform] && (
                <div className="flex items-center gap-2 bg-white/[0.03] border border-white/8 rounded-lg px-3 py-2.5">
                  <p className="text-[11px] text-white/40 font-mono flex-1">설정 페이지에서 계정을 연결해주세요</p>
                  <button
                    onClick={() => router.push('/dashboard/settings')}
                    className="flex items-center gap-1.5 text-[11px] font-mono text-white/50 hover:text-white/80 border border-white/15 hover:border-white/30 px-2.5 py-1 rounded-md transition-colors shrink-0"
                  >
                    <Settings size={11} />설정
                  </button>
                </div>
              )}

              {platformStatus[selectedPlatform] && (
                <div>
                  <p className="text-[10px] text-white/25 mb-2 uppercase tracking-wider">발행 상태</p>
                  <div className="flex gap-1.5">
                    {(selectedPlatform === 'nextblog'
                      ? [{ v: 'draft', l: '초안' }, { v: 'published', l: '발행' }]
                      : [{ v: 'draft', l: '초안' }, { v: 'publish', l: '발행' }]
                    ).map(({ v, l }) => (
                      <button
                        key={v}
                        onClick={() => setStatusOverride(v as 'draft' | 'publish' | 'published')}
                        className={`cf-filter-btn flex-1 text-[12px] font-mono py-1.5 rounded-lg border transition-colors ${
                          statusOverride === v ? 'border-white/20 bg-white/8 text-white' : 'border-white/8 text-white/30 hover:text-white/60'
                        }`}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {publishResult && (
                <div className={`text-[12px] font-mono p-3 rounded-lg border ${
                  publishResult.success ? 'text-[#4f8ef7]/80 border-[#4f8ef7]/20 bg-[#4f8ef7]/5' : 'text-red-400/80 border-red-500/20 bg-red-500/5'
                }`}>
                  {publishResult.message}
                  {publishResult.link && (
                    <a href={publishResult.link} target="_blank" rel="noopener noreferrer" className="block mt-1 text-[11px] underline opacity-70 hover:opacity-100 break-all">
                      {publishResult.link}
                    </a>
                  )}
                </div>
              )}

              {platformStatus[selectedPlatform] && (
                <button
                  onClick={handlePublish}
                  disabled={publishing || !blogContent.trim() || !blogTitle.trim()}
                  className="w-full flex items-center justify-center gap-2 font-black text-[13px] tracking-tight uppercase py-2.5 rounded-lg transition-colors bg-white/8 hover:bg-white/15 disabled:opacity-30 border border-white/15 text-white/70"
                >
                  {publishing ? (
                    <><Loader2 size={14} className="animate-spin" /> 발행 중...</>
                  ) : (
                    <><Send size={14} /> {PLATFORM_INFO[selectedPlatform].label}에 발행</>
                  )}
                </button>
              )}

              {!anyConnected && (
                <p className="text-[11px] text-white/20 text-center">
                  설정 페이지에서 블로그 플랫폼을 먼저 연결하세요
                </p>
              )}
            </div>
          </div>

        </div>
      </aside>

    </div>
  );
}

export default function BlogPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="w-5 h-5 border border-white/20 border-t-white/60 rounded-full animate-spin" /></div>}>
      <BlogPageInner />
    </Suspense>
  );
}
