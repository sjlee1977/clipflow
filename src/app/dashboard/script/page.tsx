'use client';

import { useState, useEffect } from 'react';

const SCRIPT_LLM_MODELS = [
  // ── Claude 4.6 & 4.5 (Official API IDs) ────────────────
  { id: 'claude-sonnet-4-6',         name: 'Claude Sonnet 4.6',   provider: 'Anthropic', price: '고품질' },
  { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5',    provider: 'Anthropic', price: '빠름' },
  { id: 'claude-opus-4-6',           name: 'Claude Opus 4.6',     provider: 'Anthropic', price: '최고품질' },
  // ── Gemini 3.0 & 2.5 (2026 Standard) ────────────────────
  { id: 'gemini-3.0-flash',          name: 'Gemini 3.0 Flash',    provider: 'Google',    price: '균형' },
  { id: 'gemini-3.0-pro',            name: 'Gemini 3.0 Pro',      provider: 'Google',    price: '고품질' },
  { id: 'gemini-2.5-flash',          name: 'Gemini 2.5 Flash',    provider: 'Google',    price: '최고 가성비' },
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
function PanelAccordion({ label, value, open, onToggle, children }: {
  label: string;
  value: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-white/5 mb-1">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between py-3 group"
      >
        <span className="text-[#17BEBB]/70 text-[13px] tracking-widest uppercase">{label}</span>
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
      className={`w-full flex items-center justify-between px-2 py-2 text-[12.5px] font-mono border-l-2 transition-colors ${
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

export default function ScriptPage() {
  const [topic, setTopic] = useState(() => {
    if (typeof window === 'undefined') return '';
    const saved = sessionStorage.getItem('clipflow_script_topic');
    if (saved) { sessionStorage.removeItem('clipflow_script_topic'); return saved; }
    return '';
  });
  const [tone, setTone] = useState<ToneId>('friendly_casual');
  const [category, setCategory] = useState('');
  const [llmModelId, setLlmModelId] = useState('claude-sonnet-4-6');
  const [keywords, setKeywords] = useState('');
  const [targetAudience, setTargetAudience] = useState('');

  // Read category from sessionStorage (set by prompt page)
  useEffect(() => {
    const savedCat = sessionStorage.getItem('clipflow_script_category');
    if (savedCat) {
      sessionStorage.removeItem('clipflow_script_category');
      setCategory(savedCat);
      const defaultTone = CATEGORY_DEFAULT_TONES[savedCat];
      if (defaultTone) setTone(defaultTone);
    }
  }, []);

  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [topicFocused, setTopicFocused] = useState(false);
  const [script, setScript] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);

  async function handleGenerate() {
    if (!topic.trim()) return;
    setStatus('loading');
    setScript('');
    setError('');

    try {
      const res = await fetch('/api/generate-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, tone, category, keywords, targetAudience, llmModelId }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.needsKey) {
          setError(`__KEY__${data.error}`);
        } else {
          throw new Error(data.error || '대본 생성 실패');
        }
      }
      setScript(data.script);
      setStatus('done');
      console.log('[ScriptPage] 대본 생성 및 저장 완료:', data.scriptId);
      // 사이드바 업데이트 알림
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

  const selectedLlm = SCRIPT_LLM_MODELS.find(m => m.id === llmModelId);
  const selectedTone = TONES.find(t => t.id === tone);

  return (
    <div className="flex gap-0 -m-6 min-h-full">
      <div className="flex-1 min-w-0 p-6 border-r border-white/5">
        {(status === 'idle' || status === 'loading' || status === 'error') && (
          <>
            <div className="relative mt-10 mb-4">
              <div className="absolute top-0 left-0 -translate-y-full inline-flex items-center gap-1.5 px-4 py-1.5 border-t border-l border-r border-orange-400/30 bg-[#0a0a0a]">
                <span className="w-1 h-1 bg-orange-400 rounded-full" />
                <span className="text-orange-400 text-[13px] font-mono tracking-widest uppercase">대본 만들기</span>
              </div>

              <div
                className={`relative flex flex-col border transition-colors duration-200 bg-white/[0.015] ${topicFocused ? 'border-orange-400' : 'border-white/10'}`}
                onMouseEnter={() => setTopicFocused(true)}
                onMouseLeave={() => setTopicFocused(false)}
              >
                {/* 상단: SCRIPT INPUT + 글자수 */}
                <div className="flex items-center justify-between px-4 py-2 border-b border-white/5">
                  <span className="text-[10.5px] font-mono tracking-widest uppercase" style={{ color: '#8B9A3A' }}>Script Input</span>
                  <span className="text-[10px] font-mono tabular-nums" style={{ color: '#8B9A3A' }}>{topic.length}자</span>
                </div>
                <textarea
                  value={topic}
                  onChange={e => setTopic(e.target.value)}
                  placeholder="예: 아이폰 16 vs 갤럭시 S25 비교, 10분 만에 파스타 만들기, AI가 바꾸는 미래 직업..."
                  className="w-full h-40 bg-transparent text-white border-0 focus:outline-none resize-none text-[13px] leading-relaxed font-mono placeholder:text-white/20 px-4 pt-3 pb-2"
                  disabled={status === 'loading'}
                />

                {/* 하단: 힌트 + 글자수 + 버튼 */}
                <div className="flex items-center justify-between px-4 py-2 border-t border-white/5">
                  <span className="text-white/20 text-[12px] font-mono tracking-wide">주제 · 키워드 · 문장 모두 가능</span>
                  <button
                    onClick={handleGenerate}
                    disabled={!topic.trim() || status === 'loading'}
                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-yellow-400 hover:bg-yellow-300 disabled:bg-white/5 disabled:cursor-not-allowed text-black disabled:text-white/20 font-bold transition-colors text-[12px] tracking-wide uppercase font-mono"
                  >
                    {status === 'loading' ? (
                      <>
                        <span className="w-2.5 h-2.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                        생성 중...
                      </>
                    ) : '대본 생성 →'}
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
                    <a href="/dashboard/settings" className="text-yellow-400/70 hover:text-yellow-400 text-xs font-mono transition-colors">API 키 설정 →</a>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {status === 'done' && (
          <>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/5">
              <span className="text-[#17BEBB]/70 text-[13px] tracking-widest uppercase font-mono">완성된 대본</span>
              <button
                onClick={() => { setStatus('idle'); setScript(''); }}
                className="text-white/40 hover:text-white/70 text-xs font-mono transition-colors"
              >← 다시 만들기</button>
            </div>

            <div className="relative group">
              <textarea
                value={script}
                onChange={e => setScript(e.target.value)}
                className="w-full h-[500px] bg-transparent text-white/80 text-[13px] font-mono leading-relaxed border-0 focus:outline-none resize-none pb-12"
              />
              <div className="absolute bottom-4 right-4 flex gap-2">
                <button
                  onClick={handleCopy}
                  className={`px-3 py-1.5 text-[12.5px] font-mono border transition-colors ${
                    copied 
                      ? 'border-green-400 text-green-400' 
                      : 'border-white/20 text-white/55 hover:border-white/40 hover:text-white/80'
                  }`}
                >
                  {copied ? 'COPIED!' : 'COPY'}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-8 mt-12 pb-10">
              <button
                onClick={handleUseScript}
                className="group flex items-center gap-3 text-yellow-400 text-[13px] font-bold tracking-[0.15em] font-mono transition-all hover:text-yellow-300"
              >
                영상만들기
                <span className="w-8 h-[1px] bg-yellow-400/30 group-hover:w-12 group-hover:bg-yellow-400 transition-all duration-300" />
              </button>

              <button
                onClick={() => { setStatus('idle'); setScript(''); }}
                className="text-white/20 hover:text-white/50 text-[11px] font-mono tracking-widest uppercase transition-colors"
              >
                새 대본 작성하기
              </button>
            </div>
          </>
        )}
      </div>

      <aside className="w-96 shrink-0 flex flex-col border-l border-white/5 overflow-y-auto">
        <div className="flex-1 px-4 py-5 space-y-0">
          {category && (
            <div className="mb-3 flex items-center gap-2">
              <span className="text-[11px] font-mono text-white/30 uppercase tracking-widest">카테고리</span>
              <span className="text-[12px] font-mono text-[#17BEBB]/70 border border-[#17BEBB]/20 px-2 py-0.5">
                {CATEGORY_LABELS[category] ?? category}
              </span>
            </div>
          )}

          {/* 일반 카테고리이거나 카테고리 미설정일 때만 톤 선택 표시 */}
          {(!category || category === 'general') ? (
            <PanelSection label="톤 / 분위기">
              <div className="flex flex-col gap-1">
                {TONES.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setTone(t.id)}
                    disabled={status === 'loading'}
                    className={`flex items-center justify-between px-3 py-1.5 text-[12px] font-mono border transition-colors ${
                      tone === t.id
                        ? 'border-yellow-400 text-yellow-400 bg-yellow-400/5'
                        : 'border-white/10 text-white/55 hover:border-white/30 hover:text-white/80'
                    }`}
                  >
                    <span>{t.label}</span>
                    <span className={`text-[10.5px] ${tone === t.id ? 'text-yellow-400/60' : 'text-white/20'}`}>{t.sub}</span>
                  </button>
                ))}
              </div>
            </PanelSection>
          ) : (
            <div className="border-b border-white/5 pb-4 mb-4">
              <p className="text-[#17BEBB]/70 text-[13px] tracking-widest uppercase mb-2">톤 / 분위기</p>
              <p className="text-white/30 text-[12px] font-mono leading-relaxed">
                이 카테고리는 전용 프롬프트의<br />내장 톤으로 자동 적용됩니다.
              </p>
            </div>
          )}

          <PanelSection label="추가 옵션">
            <div className="space-y-4 px-1">
              <div>
                <label className="block text-[#17BEBB]/70 text-[12px] uppercase tracking-widest mb-1.5 font-mono">핵심 키워드</label>
                <input
                  value={keywords}
                  onChange={e => setKeywords(e.target.value)}
                  placeholder="예: 성능, 배터리, 카메라"
                  className="w-full bg-white/5 text-white/80 px-3 py-2 border border-white/10 focus:border-white/30 focus:outline-none text-xs font-mono placeholder:text-white/30"
                  disabled={status === 'loading'} 
                />
              </div>
              <div>
                <label className="block text-[#17BEBB]/70 text-[12px] uppercase tracking-widest mb-1.5 font-mono">타겟 시청자</label>
                <input
                  value={targetAudience}
                  onChange={e => setTargetAudience(e.target.value)}
                  placeholder="예: 20~30대 직장인"
                  className="w-full bg-white/5 text-white/80 px-3 py-2 border border-white/10 focus:border-white/30 focus:outline-none text-xs font-mono placeholder:text-white/30"
                  disabled={status === 'loading'} 
                />
              </div>
            </div>
          </PanelSection>

          <PanelAccordion 
            label="AI 모델" 
            value={selectedLlm?.name ?? ''}
            open={modelOpen}
            onToggle={() => setModelOpen(prev => !prev)}
          >
            <div className="space-y-2">
              {(['Anthropic', 'Google'] as const).map(provider => (
                <div key={provider}>
                  <p className="text-[11px] font-mono text-white/30 tracking-widest uppercase px-2 mb-1">{provider}</p>
                  <div className="space-y-0.5">
                    {SCRIPT_LLM_MODELS.filter(m => m.provider === provider).map(m => (
                      <OptionItem
                        key={m.id}
                        active={llmModelId === m.id}
                        onClick={() => {
                          setLlmModelId(m.id);
                          setModelOpen(false); // 선택 시 닫기
                        }}
                        sub={m.price}
                      >
                        {m.name}
                      </OptionItem>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </PanelAccordion>

          <div className="mt-8 pt-8 border-t border-white/5 space-y-1.5">
            <p className="text-[#17BEBB]/60 text-[12.6px] tracking-widest uppercase mb-2">대본 설정 요약</p>
            <div className="flex justify-between text-[12.6px] font-mono">
              <span className="text-white/40">톤</span>
              <span className="text-white/70">
                {(!category || category === 'general') ? selectedTone?.label : '카테고리 내장'}
              </span>
            </div>
            <div className="flex justify-between text-[12.6px] font-mono">
              <span className="text-white/40">AI 모델</span>
              <span className="text-white/70">{selectedLlm?.name}</span>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
