'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import JSZip from 'jszip';
import { Layers, Play, CheckCircle2, Loader2, Download, Save, LayoutTemplate, RefreshCw, Palette } from 'lucide-react';
import type { CarouselAgentResult, InputType, Platform, Tone } from '@/app/api/generate-carousel-agent/route';
import { CarouselCardPreview } from '@/components/carousel-card-preview';

// ── 상수 ───────────────────────────────────────────────────────────────────────
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

const CARD_COUNTS = [6, 8, 10, 12];

// ── Satori SVG → PNG Blob 변환 ────────────────────────────────────────────────
function svgToPngBlob(svgText: string, size = 1080): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const blob = new Blob([svgText], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      canvas.getContext('2d')!.drawImage(img, 0, 0, size, size);
      URL.revokeObjectURL(url);
      canvas.toBlob(b => b ? resolve(b) : reject(new Error('canvas.toBlob null')), 'image/png', 1);
    };
    img.onerror = e => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}

// ── 에이전트 진행 표시 ──────────────────────────────────────────────────────
function AgentProgress({ steps }: { steps: { agent: string; status: string; summary: string }[] }) {
  const AGENTS = ['리서처', '스토리보더', '카피라이터', '에디터', '스타일리스트'];
  return (
    <div className="space-y-2">
      {AGENTS.map((agent, i) => {
        const step = steps.find(s => s.agent === agent);
        const status = step?.status ?? 'pending';
        return (
          <div key={agent} className="flex items-start gap-3">
            <div className="shrink-0 mt-0.5">
              {status === 'done' && <CheckCircle2 size={14} className="text-emerald-400" />}
              {status === 'running' && <Loader2 size={14} className="text-blue-400 animate-spin" />}
              {status === 'pending' && (
                <div className="w-3.5 h-3.5 rounded-full border border-white/15 flex items-center justify-center">
                  <span className="text-[9px] text-white/20">{i + 1}</span>
                </div>
              )}
              {status === 'error' && <div className="w-3.5 h-3.5 rounded-full bg-red-500/20 border border-red-500/40" />}
            </div>
            <div className="min-w-0">
              <p className={`text-[12px] font-semibold ${status === 'pending' ? 'text-white/25' : 'text-white/80'}`}>
                Agent {i + 1} — {agent}
              </p>
              {step && (
                <p className="text-[11px] text-white/40 mt-0.5 truncate">{step.summary}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── 메인 페이지 ────────────────────────────────────────────────────────────────
export default function CarouselStudioPage() {
  const [inputType, setInputType]   = useState<InputType>('topic');
  const [content, setContent]       = useState('');
  const [platform, setPlatform]     = useState<Platform>('instagram');
  const [tone, setTone]             = useState<Tone>('informative');
  const [cardCount, setCardCount]   = useState(8);
  const [modelId, setModelId]       = useState('qwen-plus');

  const [loading, setLoading]       = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [result, setResult]         = useState<CarouselAgentResult | null>(null);
  const [steps, setSteps]           = useState<{ agent: string; status: string; summary: string }[]>([]);
  const [error, setError]           = useState('');
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);

  const currentInput = INPUT_TYPES.find(t => t.value === inputType)!;

  async function handleGenerate() {
    if (!content.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);
    setSaved(false);
    setSteps([{ agent: '리서처', status: 'running', summary: '입력 분석 중...' }]);

    try {
      const res = await fetch('/api/generate-carousel-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputType, content, platform, tone, cardCount, llmModelId: modelId }),
      });

      const data: CarouselAgentResult & { error?: string } = await res.json();
      if (!res.ok || data.error) {
        setError(data.error ?? '생성 실패');
        setSteps([]);
        return;
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

  async function handleDownload() {
    if (!result) return;
    setDownloading(true);
    try {
      const zip = new JSZip();
      const topic = result.topic.replace(/[^가-힣a-zA-Z0-9_-]/g, '_').slice(0, 30);
      for (const card of result.cards) {
        try {
          const res = await fetch('/api/carousel/export', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ card, total: result.cards.length }),
          });
          if (!res.ok) { console.warn(`Card ${card.index + 1}: HTTP ${res.status}`); continue; }
          const svgText = await res.text();
          const blob = await svgToPngBlob(svgText);
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

  return (
    <div className="max-w-6xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-8 mt-4">
        <span className="w-7 h-7 flex items-center justify-center rounded-lg shrink-0"
          style={{ background: 'rgba(79,142,247,0.06)', border: '1px solid rgba(79,142,247,0.22)', color: '#4f8ef7' }}>
          <Layers size={13} strokeWidth={1.8} />
        </span>
        <div>
          <h1 className="text-[19px] font-semibold text-white" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>
            카드뉴스 만들기
          </h1>
          <p className="text-[11px] text-white/30 mt-0.5">4개 AI 에이전트가 순차적으로 카드를 설계·작성·편집합니다</p>
        </div>
      </div>

      <div className="grid grid-cols-[400px_1fr] gap-6">
        {/* ── 좌측: 입력 패널 ── */}
        <div className="space-y-4">

          {/* 입력 방식 탭 */}
          <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4 space-y-3">
            <p className="text-[11px] font-bold text-white/40 uppercase tracking-widest">입력 방식</p>
            <div className="flex gap-1.5">
              {INPUT_TYPES.map(t => (
                <button key={t.value}
                  onClick={() => { setInputType(t.value); setContent(''); }}
                  className="flex-1 text-[11px] py-1.5 rounded-lg transition-all font-medium"
                  style={{
                    background: inputType === t.value ? 'rgba(79,142,247,0.15)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${inputType === t.value ? 'rgba(79,142,247,0.35)' : 'rgba(255,255,255,0.06)'}`,
                    color: inputType === t.value ? '#4f8ef7' : 'rgba(255,255,255,0.35)',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder={currentInput.placeholder}
              rows={inputType === 'script' ? 8 : 3}
              className="w-full resize-none rounded-lg bg-white/[0.03] border border-white/8 text-white/80 text-[12px] p-3 placeholder-white/20 focus:outline-none focus:border-blue-500/40 transition-colors"
              style={{ fontFamily: "'Noto Sans KR', sans-serif" }}
            />
          </div>

          {/* 옵션 */}
          <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4 space-y-4">
            <p className="text-[11px] font-bold text-white/40 uppercase tracking-widest">옵션</p>

            {/* 플랫폼 */}
            <div className="space-y-1.5">
              <p className="text-[11px] text-white/40">플랫폼</p>
              <div className="flex gap-1.5">
                {PLATFORMS.map(p => (
                  <button key={p.value}
                    onClick={() => setPlatform(p.value)}
                    className="flex-1 text-center py-1.5 rounded-lg transition-all"
                    style={{
                      background: platform === p.value ? 'rgba(79,142,247,0.15)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${platform === p.value ? 'rgba(79,142,247,0.35)' : 'rgba(255,255,255,0.06)'}`,
                      color: platform === p.value ? '#4f8ef7' : 'rgba(255,255,255,0.35)',
                    }}
                  >
                    <span className="text-[11px] font-medium block">{p.label}</span>
                    <span className="text-[9px] opacity-60">{p.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 톤 */}
            <div className="space-y-1.5">
              <p className="text-[11px] text-white/40">톤</p>
              <div className="flex gap-1.5">
                {TONES.map(t => (
                  <button key={t.value}
                    onClick={() => setTone(t.value)}
                    className="flex-1 text-[11px] py-1.5 rounded-lg font-medium transition-all"
                    style={{
                      background: tone === t.value ? 'rgba(79,142,247,0.15)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${tone === t.value ? 'rgba(79,142,247,0.35)' : 'rgba(255,255,255,0.06)'}`,
                      color: tone === t.value ? '#4f8ef7' : 'rgba(255,255,255,0.35)',
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 카드 수 */}
            <div className="space-y-1.5">
              <p className="text-[11px] text-white/40">카드 수</p>
              <div className="flex gap-1.5">
                {CARD_COUNTS.map(c => (
                  <button key={c}
                    onClick={() => setCardCount(c)}
                    className="flex-1 text-[12px] py-1.5 rounded-lg font-bold transition-all"
                    style={{
                      background: cardCount === c ? 'rgba(79,142,247,0.15)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${cardCount === c ? 'rgba(79,142,247,0.35)' : 'rgba(255,255,255,0.06)'}`,
                      color: cardCount === c ? '#4f8ef7' : 'rgba(255,255,255,0.35)',
                    }}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* 모델 */}
            <div className="space-y-1.5">
              <p className="text-[11px] text-white/40">AI 모델</p>
              <select
                value={modelId}
                onChange={e => setModelId(e.target.value)}
                className="w-full rounded-lg bg-white/[0.03] border border-white/8 text-white/70 text-[12px] px-3 py-2 focus:outline-none focus:border-blue-500/40"
              >
                <optgroup label="Qwen (DashScope)">
                  <option value="qwen-plus">Qwen Plus</option>
                  <option value="qwen-turbo">Qwen Turbo</option>
                  <option value="qwen-max">Qwen Max</option>
                </optgroup>
                <optgroup label="Gemini">
                  <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                  <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                </optgroup>
                <optgroup label="Claude">
                  <option value="claude-sonnet-4-6">Claude Sonnet 4.6</option>
                  <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5</option>
                </optgroup>
              </select>
            </div>
          </div>

          {/* 생성 버튼 */}
          <button
            onClick={handleGenerate}
            disabled={loading || !content.trim()}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-black text-[13px] uppercase tracking-tight transition-all disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #4f8ef7, #3b6fd4)', color: 'white' }}
          >
            {loading
              ? <><Loader2 size={14} className="animate-spin" /> 생성 중...</>
              : <><Play size={14} /> 카드뉴스 생성</>
            }
          </button>

          {/* 에러 */}
          {error && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-[12px] text-red-400">
              {error}
            </div>
          )}

          {/* 에이전트 진행 */}
          {(loading || steps.length > 0) && (
            <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
              <p className="text-[11px] font-bold text-white/40 uppercase tracking-widest mb-3">에이전트 진행</p>
              <AgentProgress steps={steps} />
            </div>
          )}
        </div>

        {/* ── 우측: 미리보기 ── */}
        <div>
          {!result && !loading && (
            <div className="flex flex-col items-center justify-center h-full min-h-[400px] border border-white/6 rounded-xl gap-4">
              <div className="w-16 h-16 border border-white/8 rounded-2xl flex items-center justify-center">
                <LayoutTemplate size={24} className="text-white/10" />
              </div>
              <p className="text-[13px] text-white/20 font-mono">생성된 카드가 여기 표시됩니다</p>
            </div>
          )}

          {loading && !result && (
            <div className="flex flex-col items-center justify-center h-full min-h-[400px] border border-white/6 rounded-xl gap-4">
              <Loader2 size={28} className="text-blue-400/40 animate-spin" />
              <p className="text-[12px] text-white/25 font-mono">AI 에이전트가 카드를 설계 중입니다...</p>
            </div>
          )}

          {result && (
            <div className="space-y-4">
              {/* 결과 액션 바 */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[15px] font-bold text-white">{result.topic}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-[11px] text-white/30 font-mono">
                      {result.cards.length}장 · {result.platform}
                    </p>
                    {result.styleNameKo && (
                      <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(79,142,247,0.1)', border: '1px solid rgba(79,142,247,0.25)', color: '#4f8ef7' }}>
                        <Palette size={9} />
                        {result.styleNameKo}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleGenerate}
                    disabled={loading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white/50 hover:text-white/80 transition-colors border border-white/8 hover:border-white/20"
                  >
                    <RefreshCw size={11} />
                    재생성
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving || saved}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all border"
                    style={{
                      background: saved ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.04)',
                      border: saved ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(255,255,255,0.08)',
                      color: saved ? '#4ade80' : 'rgba(255,255,255,0.5)',
                    }}
                  >
                    <Save size={11} />
                    {saved ? '저장됨' : saving ? '저장 중...' : '라이브러리 저장'}
                  </button>
                  <button
                    onClick={handleDownload}
                    disabled={downloading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-black uppercase tracking-tight transition-all"
                    style={{ background: '#4f8ef7', color: 'white' }}
                  >
                    <Download size={11} />
                    {downloading ? '다운로드 중...' : 'PNG 저장'}
                  </button>
                </div>
              </div>

              {/* 카드 그리드 */}
              <div className="grid grid-cols-3 gap-3">
                {result.cards.map(card => (
                  <div key={card.index}>
                    <CarouselCardPreview card={card} total={result.cards.length} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
