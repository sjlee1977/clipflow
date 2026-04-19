'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useRef, useState } from 'react';
import JSZip from 'jszip';
import {
  Layers, Play, CheckCircle2, Loader2, Download, Save,
  LayoutTemplate, RefreshCw, Palette, ImagePlus, X, ZoomIn,
  Bot, Wand2, Hash, Paintbrush, ChevronDown,
} from 'lucide-react';
import type { CarouselAgentResult, InputType, Platform, Tone } from '@/app/api/generate-carousel-agent/route';
import { CarouselCardPreview } from '@/components/carousel-card-preview';
import { CAROUSEL_STYLES, LAYOUT_LABELS, ALL_LAYOUT_TYPES, type LayoutType } from '@/lib/carousel-styles';

// ── 상수 ─────────────────────────────────────────────────────────────────────
const INPUT_TYPES: { value: InputType; label: string; placeholder: string }[] = [
  { value: 'topic',    label: '주제어',       placeholder: '예: 직장인 재테크 시작하는 법' },
  { value: 'keywords', label: '키워드',       placeholder: '예: ETF, 배당주, 절세, 소액투자' },
  { value: 'script',   label: '대본 붙여넣기', placeholder: '영상 대본이나 글을 붙여넣으세요' },
];

const PLATFORMS: { value: Platform; label: string; desc: string }[] = [
  { value: 'instagram', label: 'Instagram', desc: '감성·이모지 중심' },
  { value: 'linkedin',  label: 'LinkedIn',  desc: '전문성·데이터 중심' },
  { value: 'common',    label: '공통',       desc: '두 플랫폼 겸용' },
];

const TONES: { value: Tone; label: string }[] = [
  { value: 'informative', label: '정보형' },
  { value: 'emotional',   label: '감성형' },
  { value: 'humor',       label: '유머형' },
];

const CARD_COUNTS = [4, 6, 8, 10, 12];

const CAROUSEL_LLM_MODELS = [
  { id: 'qwen-plus',                name: 'Qwen Plus',        provider: 'Alibaba',   price: '합리적' },
  { id: 'qwen-turbo',               name: 'Qwen Turbo',       provider: 'Alibaba',   price: '빠름' },
  { id: 'qwen-max',                 name: 'Qwen Max',         provider: 'Alibaba',   price: '고품질' },
  { id: 'gemini-2.5-flash',         name: 'Gemini 2.5 Flash', provider: 'Google',    price: '최고 가성비' },
  { id: 'gemini-2.0-flash',         name: 'Gemini 2.0 Flash', provider: 'Google',    price: '균형' },
  { id: 'claude-sonnet-4-6',        name: 'Claude Sonnet 4.6', provider: 'Anthropic', price: '고품질' },
  { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', provider: 'Anthropic', price: '빠름' },
];
const CAROUSEL_LLM_PROVIDERS = ['Alibaba', 'Google', 'Anthropic'] as const;

const AI_PROVIDER_META: Record<string, { color: string }> = {
  Anthropic: { color: '#E4572E' },
  Google:    { color: '#17BEBB' },
  Alibaba:   { color: '#6366f1' },
};
const PRICE_TIER: Record<string, { color: string; bg: string }> = {
  '빠름':        { color: '#4ade80', bg: 'rgba(74,222,128,0.10)' },
  '균형':        { color: '#38bdf8', bg: 'rgba(56,189,248,0.10)' },
  '합리적':      { color: '#38bdf8', bg: 'rgba(56,189,248,0.10)' },
  '고품질':      { color: '#818cf8', bg: 'rgba(129,140,248,0.10)' },
  '최고 가성비': { color: '#4ade80', bg: 'rgba(74,222,128,0.10)' },
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
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: provMeta.color, boxShadow: `0 0 6px ${provMeta.color}80` }} />
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

// ── 이미지 리사이즈 (업로드 최적화) ─────────────────────────────────────────
function resizeImageToDataUrl(file: File, maxPx = 1080, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = ev.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── SVG → PNG ────────────────────────────────────────────────────────────────
function svgToPngBlob(svgText: string, size = 1080): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const blob = new Blob([svgText], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size; canvas.height = size;
      canvas.getContext('2d')!.drawImage(img, 0, 0, size, size);
      URL.revokeObjectURL(url);
      canvas.toBlob(b => b ? resolve(b) : reject(new Error('canvas.toBlob null')), 'image/png', 1);
    };
    img.onerror = e => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}

// ── 에이전트 진행 표시 ────────────────────────────────────────────────────────
function AgentProgress({ steps }: { steps: { agent: string; status: string; summary: string }[] }) {
  const AGENTS = ['리서처', '스토리보더', '카피라이터', '에디터', '스타일리스트'];
  return (
    <div className="space-y-2">
      {AGENTS.map((agent, i) => {
        const step = steps.find(s => s.agent === agent);
        const status = step?.status ?? 'pending';
        return (
          <div key={agent} className="flex items-start gap-2.5">
            <div className="shrink-0 mt-0.5">
              {status === 'done'    && <CheckCircle2 size={13} className="text-emerald-400" />}
              {status === 'running' && <Loader2 size={13} className="text-blue-400 animate-spin" />}
              {status === 'pending' && (
                <div className="w-3.5 h-3.5 rounded-full border border-white/12 flex items-center justify-center">
                  <span className="text-[8px] text-white/18">{i + 1}</span>
                </div>
              )}
              {status === 'error'   && <div className="w-3.5 h-3.5 rounded-full bg-red-500/20 border border-red-500/40" />}
            </div>
            <div className="min-w-0">
              <p className={`text-[11px] font-semibold ${status === 'pending' ? 'text-white/22' : 'text-white/75'}`}>
                {agent}
              </p>
              {step && <p className="text-[10px] text-white/38 mt-0.5 truncate">{step.summary}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── 스타일 스왓치 ─────────────────────────────────────────────────────────────
function StyleSwatch({
  style, selected, onClick,
}: { style: typeof CAROUSEL_STYLES[0]; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={style.nameKo}
      className="relative aspect-square rounded-lg overflow-hidden transition-all group"
      style={{
        border: selected ? '2px solid #4f8ef7' : '2px solid rgba(255,255,255,0.06)',
        boxShadow: selected ? '0 0 0 1px rgba(79,142,247,0.4)' : 'none',
      }}
    >
      {/* 배경색 */}
      <div className="absolute inset-0" style={{ background: style.bg }} />
      {/* 그라데이션 오버레이 */}
      <div className="absolute inset-0" style={{ background: style.bgGradient, opacity: 0.7 }} />
      {/* 액센트 도트 */}
      <div className="absolute bottom-1 right-1 w-2 h-2 rounded-full"
        style={{ background: style.accent, boxShadow: `0 0 4px ${style.accent}80` }} />
      {/* 선택 표시 */}
      {selected && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
          <div className="w-3 h-3 rounded-full bg-blue-400 ring-2 ring-white/60" />
        </div>
      )}
      {/* 호버 툴팁 */}
      <div className="absolute inset-0 flex items-end pb-0.5 px-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <span className="text-[6px] font-bold text-white/80 bg-black/60 rounded px-0.5 py-0.5 truncate w-full text-center">
          {style.nameKo}
        </span>
      </div>
    </button>
  );
}

// ── 메인 페이지 ────────────────────────────────────────────────────────────────
export default function CarouselStudioPage() {
  const [inputType, setInputType]     = useState<InputType>('topic');
  const [content, setContent]         = useState('');
  const [platform, setPlatform]       = useState<Platform>('instagram');
  const [tone, setTone]               = useState<Tone>('informative');
  const [cardCount, setCardCount]     = useState(8);
  const [modelId, setModelId]         = useState('qwen-plus');
  const [manualStyleId, setManualStyleId] = useState<string | null>(null);
  const [manualLayout, setManualLayout]   = useState<LayoutType | null>(null);
  const [collapsed, setCollapsed]         = useState<Record<string, boolean>>({});
  const toggleCollapse = (key: string) => setCollapsed(p => ({ ...p, [key]: !p[key] }));
  const collapseAll = () => setCollapsed({ model: true, tone: true, count: true, layout: true, color: true });
  const collapseOne = (key: string) => setCollapsed(p => ({ ...p, [key]: true }));
  const asideRef = useRef<HTMLDivElement>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);

  const [loading, setLoading]         = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [result, setResult]           = useState<CarouselAgentResult | null>(null);
  const [steps, setSteps]             = useState<{ agent: string; status: string; summary: string }[]>([]);
  const [error, setError]             = useState('');
  const [saving, setSaving]           = useState(false);
  const [saved, setSaved]             = useState(false);
  const [focusedIdx, setFocusedIdx]   = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentInput = INPUT_TYPES.find(t => t.value === inputType)!;

  // ── 이미지 업로드 ────────────────────────────────────────────────────────────
  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      setUploadedImage(dataUrl);
      // 사용자가 스타일을 수동 선택하지 않은 경우에만 포토 스토리로 자동 변경
      if (!manualStyleId) {
        setManualStyleId('photo-story');
      }
    } catch (err) {
      console.error('이미지 처리 실패:', err);
    }
    // 파일 입력 초기화 (같은 파일 재업로드 허용)
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  // ── 사이드바 외부 클릭 시 전체 접기 ──────────────────────────────────────────
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (asideRef.current && !asideRef.current.contains(e.target as Node)) {
        collapseAll();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── 생성 ─────────────────────────────────────────────────────────────────────
  async function handleGenerate() {
    if (!content.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);
    setSaved(false);
    setFocusedIdx(null);
    setSteps([{ agent: '리서처', status: 'running', summary: '입력 분석 중...' }]);

    try {
      const res = await fetch('/api/generate-carousel-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputType, content, platform, tone, cardCount,
          llmModelId: modelId,
          overrideStyleId: manualStyleId ?? undefined,
          overrideLayout: manualLayout ?? undefined,
        }),
      });

      const data: CarouselAgentResult & { error?: string } = await res.json();
      if (!res.ok || data.error) {
        setError(data.error ?? '생성 실패');
        setSteps([]);
        return;
      }

      // 이미지가 업로드된 경우 카드에 주입
      if (uploadedImage && data.cards) {
        data.cards = data.cards.map(card => ({
          ...card,
          backgroundImageUrl: uploadedImage,
        }));
      }

      setResult(data);
      setSteps(data.steps);
    } catch (e) {
      setError((e as Error).message);
      setSteps([]);
    } finally {
      setLoading(false);
    }
  }

  // ── 저장 ─────────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!result) return;
    setSaving(true);
    try {
      const res = await fetch('/api/carousels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: result.topic, cards: result.cards }),
      });
      if (res.ok) setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  // ── 다운로드 ─────────────────────────────────────────────────────────────────
  async function handleDownload() {
    if (!result) return;
    setDownloading(true);
    try {
      const zip = new JSZip();
      const topic = result.topic.replace(/[^가-힣a-zA-Z0-9_-]/g, '_').slice(0, 30);
      for (const card of result.cards) {
        try {
          const res = await fetch('/api/carousel/export-v2', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ card, total: result.cards.length }),
          });
          if (!res.ok) { console.warn(`Card ${card.index + 1}: HTTP ${res.status}`); continue; }
          const blob = await res.blob();
          zip.file(`${topic}_card${String(card.index + 1).padStart(2, '0')}.png`, blob);
        } catch (err) {
          console.error(`Card ${card.index + 1} failed:`, err);
        }
      }
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.download = `${topic}.zip`;
      link.href = URL.createObjectURL(zipBlob);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } finally {
      setDownloading(false);
    }
  }

  const focusedCard = focusedIdx !== null ? result?.cards[focusedIdx] : null;

  // ── 버튼 공통 스타일 ──────────────────────────────────────────────────────────
  const pillBtn = (active: boolean) => ({
    background: active ? 'rgba(79,142,247,0.14)' : 'rgba(255,255,255,0.03)',
    border: `1px solid ${active ? 'rgba(79,142,247,0.38)' : 'rgba(255,255,255,0.06)'}`,
    color: active ? '#4f8ef7' : 'rgba(255,255,255,0.35)',
  });

  return (
    <div className="flex gap-0 -my-6" style={{ minHeight: 'calc(100vh - 56px)' }}>

      {/* ── 좌측 사이드바 ── */}
      <aside className="w-[360px] shrink-0 flex flex-col overflow-hidden"
        style={{ borderRight: '1px solid var(--border)', background: 'var(--sidebar)' }}>

        {/* 헤더 */}
        <div className="px-4 pt-6 pb-4 shrink-0">
          <div className="flex items-center gap-3 mt-4">
            <span className="w-7 h-7 flex items-center justify-center rounded-lg shrink-0"
              style={{ background: 'rgba(79,142,247,0.08)', border: '1px solid rgba(79,142,247,0.22)', color: '#4f8ef7' }}>
              <Layers size={13} strokeWidth={1.8} />
            </span>
            <span className="text-[19px] font-semibold text-white leading-none translate-y-px">카드뉴스 만들기</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* 입력 방식 */}
          <div className="space-y-2">
            <p className="text-[10px] font-bold text-white/35 uppercase tracking-widest">입력 방식</p>
            <div className="flex gap-1.5">
              {INPUT_TYPES.map(t => (
                <button key={t.value}
                  onClick={() => { setInputType(t.value); setContent(''); }}
                  className="flex-1 text-[11px] py-1.5 rounded-lg transition-all font-medium"
                  style={pillBtn(inputType === t.value)}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder={currentInput.placeholder}
              rows={inputType === 'script' ? 7 : 3}
              className="w-full resize-none rounded-lg text-white/80 text-[12px] p-3 placeholder-white/18 focus:outline-none transition-colors"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', fontFamily: "'Noto Sans KR', sans-serif" }}
            />
          </div>

          {/* 플랫폼 */}
          <div className="space-y-1.5">
            <p className="text-[10px] font-bold text-white/35 uppercase tracking-widest">플랫폼</p>
            <div className="flex gap-1.5">
              {PLATFORMS.map(p => (
                <button key={p.value} onClick={() => setPlatform(p.value)}
                  className="flex-1 text-center py-1.5 rounded-lg transition-all"
                  style={pillBtn(platform === p.value)}
                >
                  <span className="text-[11px] font-medium block">{p.label}</span>
                  <span className="text-[9px] opacity-55">{p.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 이미지 업로드 */}
          <div className="space-y-2">
            <p className="text-[10px] font-bold text-white/35 uppercase tracking-widest">배경 이미지 (선택)</p>
            {uploadedImage ? (
              <div className="relative rounded-xl overflow-hidden" style={{ aspectRatio: '1' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={uploadedImage} alt="배경 이미지" className="w-full h-full object-cover" />
                <button
                  onClick={() => { setUploadedImage(null); if (manualStyleId === 'photo-story') setManualStyleId(null); }}
                  className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-black/90 transition-colors"
                >
                  <X size={12} />
                </button>
                <div className="absolute bottom-0 inset-x-0 px-2 py-1.5 text-center"
                  style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.75), transparent)' }}>
                  <p className="text-[9px] text-white/70">포토 스토리 스타일 적용 시 배경으로 사용</p>
                </div>
              </div>
            ) : (
              <label
                className="flex flex-col items-center gap-2 py-5 rounded-xl cursor-pointer transition-colors"
                style={{ background: 'rgba(255,255,255,0.02)', border: '2px dashed rgba(255,255,255,0.08)' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(79,142,247,0.3)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
              >
                <ImagePlus size={20} className="text-white/18" />
                <span className="text-[11px] text-white/28">클릭하여 이미지 업로드</span>
                <span className="text-[9px] text-white/18">JPG · PNG · WEBP</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                />
              </label>
            )}
          </div>

          {/* 생성 버튼 */}
          <button
            onClick={handleGenerate}
            disabled={loading || !content.trim()}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-black text-[13px] uppercase tracking-tight transition-all disabled:opacity-38"
            style={{ background: 'linear-gradient(135deg, #4f8ef7, #3b6fd4)', color: 'white' }}
          >
            {loading
              ? <><Loader2 size={13} className="animate-spin" /> 생성 중...</>
              : <><Play size={13} /> 카드뉴스 생성</>
            }
          </button>

          {/* 에러 */}
          {error && (
            <div className="rounded-lg px-3.5 py-3 text-[11px] text-red-400"
              style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
              {error}
            </div>
          )}

          {/* 에이전트 진행 */}
          {(loading || steps.length > 0) && (
            <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-[10px] font-bold text-white/32 uppercase tracking-widest mb-3">에이전트 진행</p>
              <AgentProgress steps={steps} />
            </div>
          )}
        </div>
      </aside>

      {/* ── 메인 프리뷰 ── */}
      <main className="flex-1 min-w-0 overflow-y-auto">

        {/* 빈 상태 */}
        {!result && !loading && (
          <div className="flex flex-col items-center justify-center h-full min-h-[500px] gap-5">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center"
              style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
              <LayoutTemplate size={28} className="text-white/8" />
            </div>
            <div className="text-center">
              <p className="text-[14px] text-white/18">주제·키워드·대본을 입력하고 생성해보세요</p>
              <p className="text-[11px] text-white/12 mt-1">6~12장의 카드뉴스가 자동으로 설계됩니다</p>
            </div>
            {/* 스타일 미리보기 그리드 */}
            <div className="grid grid-cols-6 gap-2 mt-4 px-12 max-w-2xl w-full opacity-40">
              {CAROUSEL_STYLES.slice(0, 12).map(style => (
                <div key={style.id} className="aspect-square rounded-lg overflow-hidden"
                  style={{ background: style.bg }}>
                  <div className="w-full h-full" style={{ background: style.bgGradient }} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 로딩 상태 */}
        {loading && !result && (
          <div className="flex flex-col items-center justify-center h-full min-h-[500px] gap-4">
            <Loader2 size={32} className="text-blue-400/35 animate-spin" />
            <p className="text-[13px] text-white/22">AI 에이전트가 카드뉴스를 설계하는 중...</p>
          </div>
        )}

        {/* 결과 */}
        {result && (
          <div className="p-6 space-y-5">
            {/* 액션 바 */}
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[16px] font-bold text-white truncate">{result.topic}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-[11px] text-white/28">
                    {result.cards.length}장 · {result.platform}
                  </span>
                  {result.styleNameKo && (
                    <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(79,142,247,0.1)', border: '1px solid rgba(79,142,247,0.25)', color: '#4f8ef7' }}>
                      <Palette size={9} />
                      {result.styleNameKo}
                    </span>
                  )}
                  {uploadedImage && (
                    <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.25)', color: '#34d399' }}>
                      <ImagePlus size={9} />
                      이미지 적용됨
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={handleGenerate} disabled={loading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors"
                  style={{ color: 'rgba(255,255,255,0.45)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <RefreshCw size={11} /> 재생성
                </button>
                <button
                  onClick={handleSave} disabled={saving || saved}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
                  style={{
                    background: saved ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.04)',
                    border: saved ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(255,255,255,0.08)',
                    color: saved ? '#4ade80' : 'rgba(255,255,255,0.48)',
                  }}
                >
                  <Save size={11} />
                  {saved ? '저장됨' : saving ? '저장 중...' : '라이브러리 저장'}
                </button>
                <button
                  onClick={handleDownload} disabled={downloading}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[12px] font-black uppercase tracking-tight transition-all disabled:opacity-50"
                  style={{ background: '#4f8ef7', color: 'white' }}
                >
                  <Download size={11} />
                  {downloading ? '다운로드 중...' : 'PNG 저장'}
                </button>
              </div>
            </div>

            {/* 포커스 뷰 */}
            {focusedCard && (
              <div className="flex items-start gap-6 p-5 rounded-2xl"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="w-72 shrink-0">
                  <CarouselCardPreview card={focusedCard} total={result.cards.length} />
                </div>
                <div className="flex-1 min-w-0 space-y-3 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-white/40 uppercase tracking-widest">
                      카드 {focusedCard.index + 1} — {focusedCard.cardType}
                    </span>
                    <button onClick={() => setFocusedIdx(null)} className="text-white/25 hover:text-white/55 transition-colors">
                      <X size={14} />
                    </button>
                  </div>
                  <p className="text-[20px] font-bold text-white leading-tight">{focusedCard.title}</p>
                  {focusedCard.subtitle && (
                    <p className="text-[13px] text-white/55 leading-relaxed">{focusedCard.subtitle}</p>
                  )}
                  {focusedCard.bullets && focusedCard.bullets.length > 0 && (
                    <ul className="space-y-1.5">
                      {focusedCard.bullets.map((b, i) => (
                        <li key={i} className="flex items-start gap-2 text-[12px] text-white/65">
                          <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ background: focusedCard.accentColor ?? '#4f8ef7' }} />
                          {b}
                        </li>
                      ))}
                    </ul>
                  )}
                  {focusedCard.stat && (
                    <p className="text-[38px] font-black leading-none"
                      style={{ color: focusedCard.accentColor ?? '#4f8ef7' }}>
                      {focusedCard.stat}
                    </p>
                  )}
                  {focusedCard.quote && (
                    <p className="text-[14px] text-white/70 italic leading-relaxed">"{focusedCard.quote}"</p>
                  )}
                  {/* 이전/다음 */}
                  <div className="flex gap-2 pt-2">
                    <button
                      disabled={focusedIdx === 0}
                      onClick={() => setFocusedIdx(f => f != null && f > 0 ? f - 1 : f)}
                      className="px-3 py-1.5 rounded-lg text-[11px] text-white/40 hover:text-white/70 transition-colors disabled:opacity-20"
                      style={{ border: '1px solid rgba(255,255,255,0.08)' }}
                    >
                      ← 이전
                    </button>
                    <button
                      disabled={focusedIdx === result.cards.length - 1}
                      onClick={() => setFocusedIdx(f => f != null && f < result!.cards.length - 1 ? f + 1 : f)}
                      className="px-3 py-1.5 rounded-lg text-[11px] text-white/40 hover:text-white/70 transition-colors disabled:opacity-20"
                      style={{ border: '1px solid rgba(255,255,255,0.08)' }}
                    >
                      다음 →
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 카드 그리드 (2열) */}
            <div className="grid grid-cols-2 gap-4">
              {result.cards.map((card, idx) => (
                <div
                  key={card.index}
                  className="relative group cursor-pointer"
                  onClick={() => setFocusedIdx(focusedIdx === idx ? null : idx)}
                >
                  <CarouselCardPreview card={card} total={result.cards.length} />
                  {/* 호버 오버레이 */}
                  <div className="absolute inset-0 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ background: 'rgba(0,0,0,0.25)' }}>
                    <ZoomIn size={20} className="text-white/80" />
                  </div>
                  {/* 카드 번호 뱃지 */}
                  <div className="absolute top-2 left-2 text-[9px] font-bold px-1.5 py-0.5 rounded"
                    style={{ background: 'rgba(0,0,0,0.55)', color: 'rgba(255,255,255,0.7)' }}>
                    {card.index + 1}
                  </div>
                  {/* 선택 표시 */}
                  {focusedIdx === idx && (
                    <div className="absolute inset-0 rounded-xl pointer-events-none"
                      style={{ border: '2px solid #4f8ef7', boxShadow: '0 0 0 1px rgba(79,142,247,0.3)' }} />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* ── 우측 사이드바 ── */}
      <aside ref={asideRef} className="w-96 shrink-0 flex flex-col overflow-y-auto"
        style={{ borderLeft: '1px solid var(--border)', background: 'var(--sidebar)' }}>
        <div className="px-3 py-4 space-y-3">

          {/* AI 모델 카드 */}
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--card)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)' }}>
            <div className="flex items-center gap-2.5 px-4 py-2.5" style={{ background: 'rgba(79,142,247,0.04)' }}>
              <div className="w-5 h-5 flex items-center justify-center rounded-md shrink-0"
                style={{ background: 'rgba(79,142,247,0.12)', border: '1px solid rgba(79,142,247,0.25)' }}>
                <Bot size={9} style={{ color: '#4f8ef7' }} />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>AI 모델</span>
            </div>
            <div className="px-3 py-3">
              <AiModelSelector
                models={CAROUSEL_LLM_MODELS}
                providers={CAROUSEL_LLM_PROVIDERS}
                selected={modelId}
                onSelect={id => setModelId(id)}
              />
            </div>
          </div>

          {/* 톤 카드 */}
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--card)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)' }}>
            <div className="flex items-center gap-2.5 px-4 py-2.5" style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
              <div className="w-5 h-5 flex items-center justify-center rounded-md shrink-0"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
                <Wand2 size={9} className="text-white/50" />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>톤</span>
            </div>
            <div className="px-4 py-3">
              <div className="grid grid-cols-3 gap-1.5">
                {TONES.map(t => (
                  <button key={t.value} onClick={() => setTone(t.value)}
                    className={`flex flex-col items-center gap-0.5 py-2 px-1 rounded-lg border transition-colors ${
                      tone === t.value
                        ? 'border-[#4f8ef7]/40 bg-[#4f8ef7]/10 text-[#4f8ef7]'
                        : 'border-white/8 text-white/40 hover:text-white/70 hover:border-white/20 hover:bg-white/5'
                    }`}
                  >
                    <span className="text-[12px] font-medium">{t.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 카드 수 카드 */}
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--card)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)' }}>
            <div className="flex items-center gap-2.5 px-4 py-2.5" style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
              <div className="w-5 h-5 flex items-center justify-center rounded-md shrink-0"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
                <Hash size={9} className="text-white/50" />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>카드 수</span>
              <span className="ml-auto text-[11px] font-black" style={{ color: '#4f8ef7' }}>{cardCount}장</span>
            </div>
            <div className="px-4 py-3">
              <div className="flex gap-1.5">
                {CARD_COUNTS.map(c => (
                  <button key={c} onClick={() => setCardCount(c)}
                    className={`flex-1 py-2 rounded-lg border transition-colors text-[12px] font-bold ${
                      cardCount === c
                        ? 'border-[#4f8ef7]/40 bg-[#4f8ef7]/10 text-[#4f8ef7]'
                        : 'border-white/8 text-white/40 hover:text-white/70 hover:border-white/20 hover:bg-white/5'
                    }`}
                  >{c}</button>
                ))}
              </div>
            </div>
          </div>

          {/* 레이아웃 카드 */}
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--card)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)' }}>
            <button className="w-full flex items-center gap-2.5 px-4 py-2.5" style={{ borderBottom: collapsed.layout ? 'none' : '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}
              onClick={() => toggleCollapse('layout')}>
              <div className="w-5 h-5 flex items-center justify-center rounded-md shrink-0"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
                <LayoutTemplate size={9} className="text-white/50" />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>레이아웃</span>
              {manualLayout ? (
                <>
                  <span className="ml-auto text-[10px] font-bold mr-1" style={{ color: '#4f8ef7' }}>
                    {LAYOUT_LABELS[manualLayout].ko}
                  </span>
                  <button onClick={e => { e.stopPropagation(); setManualLayout(null); }}
                    className="text-[11px] text-white/20 hover:text-white/60 transition-colors mr-1.5 leading-none">×</button>
                </>
              ) : (
                <span className="ml-auto text-[10px] text-white/22 mr-1.5">AI 자동</span>
              )}
              <ChevronDown size={12} className="text-white/30 transition-transform duration-200"
                style={{ transform: collapsed.layout ? 'rotate(-90deg)' : 'rotate(0deg)' }} />
            </button>
            {!collapsed.layout && (
              <div className="px-4 py-3 space-y-2">
                <div className="grid grid-cols-2 gap-1.5">
                  {ALL_LAYOUT_TYPES.map(layout => {
                    const { ko, desc } = LAYOUT_LABELS[layout];
                    const isSelected = manualLayout === layout;
                    return (
                      <button
                        key={layout}
                        onClick={() => { setManualLayout(isSelected ? null : layout); collapseOne('layout'); }}
                        className="text-left px-2.5 py-2 rounded-lg transition-all duration-150"
                        style={{
                          border: isSelected ? '1px solid rgba(79,142,247,0.5)' : '1px solid rgba(255,255,255,0.07)',
                          background: isSelected ? 'rgba(79,142,247,0.1)' : 'rgba(255,255,255,0.02)',
                        }}
                      >
                        <p className="text-[11px] font-bold leading-tight" style={{ color: isSelected ? '#4f8ef7' : 'rgba(255,255,255,0.7)' }}>{ko}</p>
                        <p className="text-[9px] mt-0.5" style={{ color: 'rgba(255,255,255,0.28)' }}>{desc}</p>
                      </button>
                    );
                  })}
                </div>
                {manualLayout && (
                  <p className="text-[10px] text-[#4f8ef7]/80 font-medium">
                    {LAYOUT_LABELS[manualLayout].ko} 선택됨
                  </p>
                )}
                {!manualLayout && (
                  <p className="text-[10px] text-white/22">AI가 콘텐츠에 맞는 레이아웃 선택</p>
                )}
              </div>
            )}
          </div>

          {/* 색상 테마 카드 */}
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--card)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)' }}>
            <button className="w-full flex items-center gap-2.5 px-4 py-2.5" style={{ borderBottom: collapsed.color ? 'none' : '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}
              onClick={() => toggleCollapse('color')}>
              <div className="w-5 h-5 flex items-center justify-center rounded-md shrink-0"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
                <Paintbrush size={9} className="text-white/50" />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>색상 테마</span>
              {(() => {
                const s = CAROUSEL_STYLES.find(s => s.id === manualStyleId);
                return s ? (
                  <>
                    <div className="ml-auto w-3 h-3 rounded-full shrink-0"
                      style={{ background: s.accent, boxShadow: `0 0 5px ${s.accent}90` }} />
                    <span className="text-[10px] font-bold ml-1 mr-1 truncate max-w-[80px]"
                      style={{ color: s.accent }}>{s.nameKo}</span>
                    <button onClick={e => { e.stopPropagation(); setManualStyleId(null); }}
                      className="text-[11px] text-white/20 hover:text-white/60 transition-colors mr-1.5 leading-none">×</button>
                  </>
                ) : (
                  <span className="ml-auto text-[10px] text-white/22 mr-1.5">AI 자동</span>
                );
              })()}
              <ChevronDown size={12} className="text-white/30 transition-transform duration-200"
                style={{ transform: collapsed.color ? 'rotate(-90deg)' : 'rotate(0deg)' }} />
            </button>
            {!collapsed.color && (
              <div className="px-4 py-3 space-y-2">
                <div className="grid grid-cols-4 gap-2">
                  {CAROUSEL_STYLES.map(style => (
                    <StyleSwatch
                      key={style.id}
                      style={style}
                      selected={manualStyleId === style.id}
                      onClick={() => { setManualStyleId(manualStyleId === style.id ? null : style.id); collapseOne('color'); }}
                    />
                  ))}
                </div>
                {manualStyleId && (
                  <p className="text-[10px] text-[#4f8ef7]/80 font-medium">
                    {CAROUSEL_STYLES.find(s => s.id === manualStyleId)?.nameKo} 선택됨
                  </p>
                )}
                {!manualStyleId && (
                  <p className="text-[10px] text-white/22">콘텐츠 분석 후 AI가 최적 색상 선택</p>
                )}
              </div>
            )}
          </div>

        </div>
      </aside>
    </div>
  );
}
