'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

const SCRIPT_LLM_MODELS = [
  // ── Claude 4.6 & 4.5 (Official API IDs) ────────────────
  { id: 'claude-sonnet-4-6',         name: 'Claude Sonnet 4.6',   provider: 'Anthropic', price: '고품질' },
  { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5',    provider: 'Anthropic', price: '빠름' },
  { id: 'claude-opus-4-6',           name: 'Claude Opus 4.6',     provider: 'Anthropic', price: '최고품질' },
  // ── Gemini 3.0 & 2.5 (2026 Standard) ────────────────────
  { id: 'gemini-3.0-flash',          name: 'Gemini 3.0 Flash',    provider: 'Google',    price: '균형' },
  { id: 'gemini-3.0-pro',            name: 'Gemini 3.0 Pro',      provider: 'Google',    price: '고품질' },
  { id: 'gemini-2.5-flash',          name: 'Gemini 2.5 Flash',    provider: 'Google',    price: '최고 가성비' },
  // ── Qwen (DashScope) 旗舰 & 经济 & Omni ──────────────────
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

/* ── 가격 티어 뱃지 ── */
function PriceBadge({ price }: { price?: string }) {
  if (!price) return null;
  const isFree = price.includes('무료');
  const val = parseFloat(price.replace(/[^0-9.]/g, ''));
  let cls = 'text-white/25 bg-white/5';
  if (isFree)      cls = 'text-green-400/80 bg-green-400/10';
  else if (val < 1) cls = 'text-green-500/70 bg-green-500/10';
  else if (val < 5) cls = 'text-green-400/70 bg-green-400/10';
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
          ? 'border-green-500 text-green-500 bg-green-500/5'
          : 'border-transparent text-white/65 hover:text-white hover:border-white/30'
      }`}
    >
      <span>{children}</span>
      <PriceBadge price={sub} />
    </button>
  );
}

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

  // Read from URL params (from trend page) or sessionStorage (from prompt page)
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
      return; // URL params take priority
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

  async function handleGenerate() {
    if (!topic.trim()) return;
    setStatus('loading');
    setScript('');
    setError('');
    setSaveWarning('');

    try {
      const res = await fetch('/api/generate-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, tone, category, keywords, targetAudience, videoLength, llmModelId }),
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
      if (data.saveError) {
        setSaveWarning(`대본 저장 실패: ${data.saveError}`);
        console.warn('[ScriptPage] 저장 실패:', data.saveError);
      } else {
        console.log('[ScriptPage] 대본 생성 및 저장 완료:', data.scriptId);
      }
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

  function handleMakeThumbnail() {
    sessionStorage.setItem('clipflow_thumbnail_script', script);
    sessionStorage.setItem('clipflow_thumbnail_topic', topic);
    window.location.href = '/dashboard/thumbnail';
  }

  const selectedLlm = SCRIPT_LLM_MODELS.find(m => m.id === llmModelId);
  const selectedTone = TONES.find(t => t.id === tone);

  return (
    <div className="flex gap-0 -m-6 min-h-full">
      <div className="flex-1 min-w-0 p-6 border-r border-white/8">
        {(status === 'idle' || status === 'loading' || status === 'error') && (
          <>
            <div className="relative mt-4 mb-4">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                <span className="text-green-500 text-sm font-semibold">대본 만들기</span>
              </div>

              <div
                className={`relative flex flex-col border transition-colors duration-200 bg-[#161616] rounded-xl ${topicFocused ? 'border-green-500/50' : 'border-white/8'}`}
                onMouseEnter={() => setTopicFocused(true)}
                onMouseLeave={() => setTopicFocused(false)}
              >
                {/* 상단: SCRIPT INPUT + 글자수 */}
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5">
                  <span className="text-white/35 text-xs font-medium uppercase tracking-wide">Script Input</span>
                  <span className="text-white/25 text-xs tabular-nums">{topic.length}자</span>
                </div>
                <textarea
                  value={topic}
                  onChange={e => setTopic(e.target.value)}
                  placeholder="예: 아이폰 16 vs 갤럭시 S25 비교, 10분 만에 파스타 만들기, AI가 바꾸는 미래 직업..."
                  className="w-full h-40 bg-transparent text-white border-0 focus:outline-none resize-none text-[13px] leading-relaxed placeholder:text-white/20 px-4 pt-3 pb-2"
                  disabled={status === 'loading'}
                />

                {/* 하단: 힌트 + 버튼 */}
                <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
                  <span className="text-white/25 text-xs">주제 · 키워드 · 문장 모두 가능</span>
                  <button
                    onClick={handleGenerate}
                    disabled={!topic.trim() || status === 'loading'}
                    className="inline-flex items-center gap-2 px-5 py-2 bg-[#22c55e] hover:bg-[#16a34a] disabled:bg-white/8 disabled:cursor-not-allowed text-white disabled:text-white/25 font-semibold text-sm rounded-lg transition-colors shadow-[0_0_16px_rgba(34,197,94,0.35)] disabled:shadow-none"
                  >
                    {status === 'loading' ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
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
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/5">
              <span className="text-[white]/70 text-[13px] tracking-widest uppercase font-mono">완성된 대본</span>
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
                className="group flex items-center gap-3 text-green-500 text-[13px] font-bold tracking-[0.15em] font-mono transition-all hover:text-green-400"
              >
                영상만들기
                <span className="w-8 h-[1px] bg-green-500/30 group-hover:w-12 group-hover:bg-green-500 transition-all duration-300" />
              </button>

              <button
                onClick={handleMakeThumbnail}
                className="group flex items-center gap-3 text-white/40 text-[13px] font-bold tracking-[0.15em] font-mono transition-all hover:text-white/70"
              >
                썸네일 생성
                <span className="w-8 h-[1px] bg-white/10 group-hover:w-12 group-hover:bg-white/30 transition-all duration-300" />
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

      <aside className="w-96 shrink-0 flex flex-col border-l border-white/8 overflow-y-auto bg-[#0d0d0d]">
        <div className="flex-1 px-5 py-5 space-y-6">

          {/* 카테고리 뱃지 */}
          {category && (
            <div className="flex items-center gap-2">
              <span className="text-white/30 text-xs font-medium">카테고리</span>
              <span className="text-xs font-medium text-white/60 bg-white/8 border border-white/10 px-2.5 py-1 rounded-full">
                {CATEGORY_LABELS[category] ?? category}
              </span>
            </div>
          )}

          {/* 톤 / 분위기 */}
          <div>
            <p className="text-white/40 text-xs font-semibold uppercase tracking-wide mb-2.5">톤 / 분위기</p>
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
                    <span className="font-mono text-[13px]">{t.label}</span>
                    <span className={`font-mono text-[12px] ${tone === t.id ? 'text-[#22c55e]/60' : 'text-white/20'}`}>{t.sub}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-white/30 text-sm leading-relaxed">
                이 카테고리는 전용 프롬프트의 내장 톤으로 자동 적용됩니다.
              </p>
            )}
          </div>

          {/* 추가 옵션 */}
          <div>
            <p className="text-white/40 text-xs font-semibold uppercase tracking-wide mb-2.5">추가 옵션</p>
            <div className="space-y-3">
              <div>
                <label className="block text-white/40 text-xs font-medium mb-1.5">영상 목표 길이</label>
                <select
                  value={videoLength}
                  onChange={e => setVideoLength(e.target.value)}
                  disabled={status === 'loading'}
                  className="w-full bg-[#1a1a1a] text-white/70 px-3 py-2 border border-white/10 focus:border-white/25 focus:outline-none text-sm rounded-lg cursor-pointer [&>option]:bg-[#1a1a1a]"
                >
                  <option value="">선택 안 함</option>
                  <option value="5분 내외 (3,000자 이상)">5분 내외</option>
                  <option value="10분 내외 (5,000자 이상)">10분 내외</option>
                  <option value="15분 내외 (7,000자 이상)">15분 내외</option>
                  <option value="20분 이상 (9,000자 이상)">20분 이상</option>
                </select>
              </div>
              <div>
                <label className="block text-white/40 text-xs font-medium mb-1.5">핵심 키워드</label>
                <input
                  value={keywords}
                  onChange={e => setKeywords(e.target.value)}
                  placeholder="예: 성능, 배터리, 카메라"
                  className="w-full bg-[#1a1a1a] text-white/70 px-3 py-2 border border-white/10 focus:border-white/25 focus:outline-none text-sm rounded-lg placeholder:text-white/25"
                  disabled={status === 'loading'}
                />
              </div>
              <div>
                <label className="block text-white/40 text-xs font-medium mb-1.5">타겟 시청자</label>
                <input
                  value={targetAudience}
                  onChange={e => setTargetAudience(e.target.value)}
                  placeholder="예: 20~30대 직장인"
                  className="w-full bg-[#1a1a1a] text-white/70 px-3 py-2 border border-white/10 focus:border-white/25 focus:outline-none text-sm rounded-lg placeholder:text-white/25"
                  disabled={status === 'loading'}
                />
              </div>
            </div>
          </div>

          {/* AI 모델 */}
          <PanelAccordion
            label="AI 모델"
            value={selectedLlm?.name ?? ''}
            open={modelOpen}
            onToggle={() => setModelOpen(prev => !prev)}
          >
            <div className="space-y-3">
              {(['Anthropic', 'Google', 'Alibaba'] as const).map(provider => (
                <div key={provider}>
                  <p className="text-white/25 text-[11px] font-semibold uppercase tracking-wide px-1 mb-1.5">{provider}</p>
                  <div className="space-y-1">
                    {SCRIPT_LLM_MODELS.filter(m => m.provider === provider).map(m => (
                      <OptionItem
                        key={m.id}
                        active={llmModelId === m.id}
                        onClick={() => { setLlmModelId(m.id); setModelOpen(false); }}
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

          {/* 설정 요약 */}
          <div className="pt-4 border-t border-white/5 space-y-2">
            <p className="text-white/30 text-xs font-semibold uppercase tracking-wide mb-3">대본 설정 요약</p>
            <div className="flex justify-between text-[13px]">
              <span className="text-white/35">톤</span>
              <span className="text-white/65 font-mono">
                {(!category || category === 'general') ? selectedTone?.label : '카테고리 내장'}
              </span>
            </div>
            <div className="flex justify-between text-[13px]">
              <span className="text-white/35">AI 모델</span>
              <span className="text-white/65 font-mono">{selectedLlm?.name}</span>
            </div>
          </div>

        </div>
      </aside>
    </div>
  );
}
