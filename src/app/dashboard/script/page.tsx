'use client';

import { useState } from 'react';
import { LLM_MODELS } from '@/lib/openrouter';

type ScriptType = 'shorts' | 'youtube' | 'ad' | 'edu' | 'story';
type Tone = 'professional' | 'casual' | 'emotional' | 'funny' | 'dramatic';

const SCRIPT_TYPES: { id: ScriptType; label: string; desc: string }[] = [
  { id: 'shorts', label: '쇼츠 / 릴스', desc: '60초 이내 숏폼' },
  { id: 'youtube', label: '유튜브', desc: '3~10분 분량' },
  { id: 'ad', label: '광고', desc: '15~30초 임팩트' },
  { id: 'edu', label: '교육 / 설명', desc: '정보 전달형' },
  { id: 'story', label: '스토리텔링', desc: '감성 내러티브' },
];

const TONES: { id: Tone; label: string }[] = [
  { id: 'professional', label: '전문적' },
  { id: 'casual', label: '친근한' },
  { id: 'emotional', label: '감성적' },
  { id: 'funny', label: '유머러스' },
  { id: 'dramatic', label: '드라마틱' },
];

/* ── 오른쪽 패널 섹션 (일반) ── */
function PanelSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-white/5 pb-4 mb-4">
      <p className="text-white/20 text-[12px] tracking-widest uppercase mb-3">{label}</p>
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

export default function ScriptPage() {
  const [topic, setTopic] = useState('');
  const [scriptType, setScriptType] = useState<ScriptType>('shorts');
  const [tone, setTone] = useState<Tone>('professional');
  const [llmModelId, setLlmModelId] = useState('deepseek/deepseek-chat-v3-0324');
  const [keywords, setKeywords] = useState('');
  const [targetAudience, setTargetAudience] = useState('');

  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [script, setScript] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  async function handleGenerate() {
    if (!topic.trim()) return;
    setStatus('loading');
    setScript('');
    setError('');

    try {
      const res = await fetch('/api/generate-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, scriptType, tone, keywords, targetAudience, llmModelId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '대본 생성 실패');
      setScript(data.script);
      setStatus('done');
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
    window.location.href = '/dashboard';
  }

  const selectedLlm = LLM_MODELS.find(m => m.id === llmModelId);
  const selectedType = SCRIPT_TYPES.find(t => t.id === scriptType);
  const selectedTone = TONES.find(t => t.id === tone);

  return (
    <div className="flex gap-0 -m-6 min-h-full">
      
      {/* ─── 왼쪽: 메인 콘텐츠 ─── */}
      <div className="flex-1 min-w-0 p-6 border-r border-white/5">
        
        {/* 입력 단계 */}
        {(status === 'idle' || status === 'loading' || status === 'error') && (
          <>
            <textarea
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder="예: 아이폰 16 vs 갤럭시 S25 비교, 10분 만에 파스타 만들기, AI가 바꾸는 미래 직업..."
              className="w-full h-52 bg-transparent text-white border-0 border-b border-white/10 focus:border-white/30 focus:outline-none resize-none text-sm leading-relaxed font-mono placeholder:text-white/20 pb-3"
              disabled={status === 'loading'}
            />
            <p className="text-white/15 text-xs font-mono mt-2 mb-8">{topic.length}자</p>

            {error && (
              <div className="border-l-2 border-red-500 pl-4 mb-8">
                <p className="text-red-400 text-xs font-mono">{error}</p>
                <button onClick={() => setStatus('idle')} className="mt-2 text-white/25 hover:text-white/60 text-xs font-mono transition-colors">다시 시도 →</button>
              </div>
            )}

            <button
              onClick={handleGenerate}
              disabled={!topic.trim() || status === 'loading'}
              className="w-full bg-yellow-400 hover:bg-yellow-300 disabled:bg-white/5 disabled:cursor-not-allowed text-black disabled:text-white/20 font-black py-3.5 transition-colors text-xs tracking-widest uppercase font-mono"
            >
              {status === 'loading' ? (
                <span className="flex items-center justify-center gap-3">
                  <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin inline-block" />
                  대본 생성 중...
                </span>
              ) : '대본 생성 →'}
            </button>
          </>
        )}

        {/* 대본 출력 단계 */}
        {status === 'done' && (
          <>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/5">
              <span className="text-white/25 text-xs tracking-widest uppercase font-mono">완성된 대본</span>
              <button
                onClick={() => { setStatus('idle'); setScript(''); }}
                className="text-white/20 hover:text-white/50 text-xs font-mono transition-colors"
              >← 다시 만들기</button>
            </div>

            <div className="relative group">
              <textarea
                value={script}
                onChange={e => setScript(e.target.value)}
                className="w-full h-[500px] bg-transparent text-white/80 text-sm font-mono leading-relaxed border-0 focus:outline-none resize-none pb-12"
              />
              <div className="absolute bottom-4 right-4 flex gap-2">
                <button
                  onClick={handleCopy}
                  className={`px-3 py-1.5 text-[11px] font-mono border transition-colors ${
                    copied 
                      ? 'border-green-400 text-green-400' 
                      : 'border-white/10 text-white/30 hover:border-white/30 hover:text-white/60'
                  }`}
                >
                  {copied ? 'COPIED!' : 'COPY'}
                </button>
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button
                onClick={handleUseScript}
                className="flex-1 bg-yellow-400 hover:bg-yellow-300 text-black font-black py-3.5 transition-colors text-xs tracking-widest uppercase font-mono"
              >
                이 대본으로 영상 만들기 →
              </button>
              <button
                onClick={() => { setStatus('idle'); setScript(''); }}
                className="px-5 py-3 border border-white/10 text-white/40 hover:border-white/30 hover:text-white/70 text-xs font-mono transition-colors"
              >
                새 대본
              </button>
            </div>
          </>
        )}
      </div>

      {/* ─── 오른쪽: 설정 패널 ─── */}
      <aside className="w-96 shrink-0 flex flex-col border-l border-white/5 overflow-y-auto">
        <div className="flex-1 px-4 py-5 space-y-0">
          
          <PanelSection label="영상 유형">
            <div className="space-y-0.5">
              {SCRIPT_TYPES.map(t => (
                <OptionItem 
                  key={t.id} 
                  active={scriptType === t.id} 
                  onClick={() => setScriptType(t.id)}
                >
                  <div className="flex flex-col items-start py-0.5">
                    <span>{t.label}</span>
                    <span className="text-[11px] opacity-40 font-normal">{t.desc}</span>
                  </div>
                </OptionItem>
              ))}
            </div>
          </PanelSection>

          <PanelSection label="톤 / 분위기">
            <div className="flex flex-wrap gap-1">
              {TONES.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTone(t.id)}
                  disabled={status === 'loading'}
                  className={`px-3 py-1.5 text-xs font-mono border transition-colors ${
                    tone === t.id
                      ? 'border-yellow-400 text-yellow-400'
                      : 'border-white/10 text-white/30 hover:border-white/30 hover:text-white/60'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </PanelSection>

          <PanelSection label="추가 옵션">
            <div className="space-y-4 px-1">
              <div>
                <label className="block text-white/20 text-[11px] uppercase tracking-widest mb-1.5 font-mono">핵심 키워드</label>
                <input 
                  value={keywords} 
                  onChange={e => setKeywords(e.target.value)}
                  placeholder="예: 성능, 배터리, 카메라"
                  className="w-full bg-white/5 text-white/70 px-3 py-2 border border-white/5 focus:border-white/20 focus:outline-none text-xs font-mono placeholder:text-white/10"
                  disabled={status === 'loading'} 
                />
              </div>
              <div>
                <label className="block text-white/20 text-[11px] uppercase tracking-widest mb-1.5 font-mono">타겟 시청자</label>
                <input 
                  value={targetAudience} 
                  onChange={e => setTargetAudience(e.target.value)}
                  placeholder="예: 20~30대 직장인"
                  className="w-full bg-white/5 text-white/70 px-3 py-2 border border-white/5 focus:border-white/20 focus:outline-none text-xs font-mono placeholder:text-white/10"
                  disabled={status === 'loading'} 
                />
              </div>
            </div>
          </PanelSection>

          <PanelAccordion label="AI 모델" value={selectedLlm?.name ?? ''}>
            <div className="space-y-0.5">
              {LLM_MODELS.map(m => (
                <OptionItem 
                  key={m.id} 
                  active={llmModelId === m.id} 
                  onClick={() => setLlmModelId(m.id)} 
                  sub={m.price}
                >
                  {m.name}
                </OptionItem>
              ))}
            </div>
          </PanelAccordion>

          {/* 옵션 요약 */}
          <div className="mt-8 pt-8 border-t border-white/5 space-y-1.5">
            <p className="text-white/15 text-[11px] tracking-widest uppercase mb-2">대본 설정 요약</p>
            <div className="flex justify-between text-[11px] font-mono">
              <span className="text-white/20">유형</span>
              <span className="text-white/40">{selectedType?.label}</span>
            </div>
            <div className="flex justify-between text-[11px] font-mono">
              <span className="text-white/20">톤</span>
              <span className="text-white/40">{selectedTone?.label}</span>
            </div>
            <div className="flex justify-between text-[11px] font-mono">
              <span className="text-white/20">AI 모델</span>
              <span className="text-white/40">{selectedLlm?.name}</span>
            </div>
          </div>

        </div>
      </aside>

    </div>
  );
}
