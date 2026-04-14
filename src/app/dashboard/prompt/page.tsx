'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
// TEMPLATES 임포트 제거 (사이드바로 이동 예정)

// ── Types & Constants ────────────────────────────────────────────────────────

type CategoryId = 'general' | 'economy' | 'history' | 'psychology' | 'horror' | 'health';

const CATEGORIES = [
  {
    id: 'general' as CategoryId, label: '일반',
    textCls: 'text-sky-400', borderCls: 'border-sky-400',
    bgCls: 'bg-sky-400/[0.07]', dotCls: 'bg-sky-400',
    activeCls: 'border-sky-400 text-sky-400 bg-sky-400/[0.08]',
    inputBorder: 'rgba(56,189,248,0.45)', inputFocusBorder: 'rgba(56,189,248,0.85)',
  },
  {
    id: 'economy' as CategoryId, label: '경제 / 주식',
    textCls: 'text-green-400', borderCls: 'border-green-400',
    bgCls: 'bg-green-400/[0.07]', dotCls: 'bg-green-400',
    activeCls: 'border-green-400 text-green-400 bg-green-400/[0.08]',
    inputBorder: 'rgba(74,222,128,0.45)', inputFocusBorder: 'rgba(74,222,128,0.85)',
  },
  {
    id: 'history' as CategoryId, label: '역사',
    textCls: 'text-amber-400', borderCls: 'border-amber-400',
    bgCls: 'bg-amber-400/[0.07]', dotCls: 'bg-amber-400',
    activeCls: 'border-amber-400 text-amber-400 bg-amber-400/[0.08]',
    inputBorder: 'rgba(251,191,36,0.45)', inputFocusBorder: 'rgba(251,191,36,0.85)',
  },
  {
    id: 'psychology' as CategoryId, label: '심리학',
    textCls: 'text-purple-400', borderCls: 'border-purple-400',
    bgCls: 'bg-purple-400/[0.07]', dotCls: 'bg-purple-400',
    activeCls: 'border-purple-400 text-purple-400 bg-purple-400/[0.08]',
    inputBorder: 'rgba(192,132,252,0.45)', inputFocusBorder: 'rgba(192,132,252,0.85)',
  },
  {
    id: 'horror' as CategoryId, label: '공포',
    textCls: 'text-red-400', borderCls: 'border-red-400',
    bgCls: 'bg-red-400/[0.07]', dotCls: 'bg-red-400',
    activeCls: 'border-red-400 text-red-400 bg-red-400/[0.08]',
    inputBorder: 'rgba(248,113,113,0.45)', inputFocusBorder: 'rgba(248,113,113,0.85)',
  },
  {
    id: 'health' as CategoryId, label: '건강',
    textCls: 'text-lime-400', borderCls: 'border-lime-400',
    bgCls: 'bg-lime-400/[0.07]', dotCls: 'bg-lime-400',
    activeCls: 'border-lime-400 text-lime-400 bg-lime-400/[0.08]',
    inputBorder: 'rgba(163,230,53,0.45)', inputFocusBorder: 'rgba(163,230,53,0.85)',
  },
] as const;

const STORAGE_KEY = 'clipflow_prompt_v2';
const DEFAULT_CAT_DATA = {};

// ── Sub-components ───────────────────────────────────────────────────────────

/**
 * 참조 디자인 스타일 필드 카드
 * - 왼쪽 컬러 액센트 보더
 * - 상단: 라벨 + 필수/선택 배지 + 설명
 * - 하단: 인풋이 들어가는 중첩 다크 박스
 */
function FieldCard({
  required, optional, children, sub, accentColor = '#4f8ef7', inputContent,
}: {
  required?: boolean;
  optional?: boolean;
  children: React.ReactNode;
  sub?: string;
  accentColor?: string;
  inputContent: React.ReactNode;
}) {
  return (
    <div
      className="rounded-xl overflow-hidden transition-all"
      style={{
        background: 'transparent',
        border: '1px solid var(--border)',
        borderLeft: `3px solid ${accentColor}`,
      }}
    >
      {/* 헤더: 라벨 + 배지 */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13px] font-semibold" style={{ color: 'var(--text)' }}>{children}</span>
          {required && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
              style={{ background: 'rgba(248,113,113,0.12)', color: '#f87171', border: '1px solid rgba(248,113,113,0.25)' }}>
              필수
            </span>
          )}
          {optional && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
              style={{ background: 'rgba(79,142,247,0.10)', color: '#93c5fd', border: '1px solid rgba(79,142,247,0.20)' }}>
              선택
            </span>
          )}
        </div>
        {sub && (
          <p className="text-[11px] mt-1 leading-relaxed" style={{ color: 'var(--text-faint)' }}>{sub}</p>
        )}
      </div>
      {/* 인풋 영역 */}
      <div className="px-3 pb-3">
        {inputContent}
      </div>
    </div>
  );
}

/** 레거시 호환용 (섹션 헤더 등에서 사용) */
function FieldLabel({
  required, optional, children, sub,
}: { required?: boolean; optional?: boolean; children: React.ReactNode; sub?: string }) {
  return (
    <div className="mb-2">
      <div className="flex items-center gap-1.5 flex-wrap">
        {required && <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block shrink-0" />}
        <span className="text-white/85 text-[13px] font-semibold">{children}</span>
        {optional && <span className="text-white/50 text-[12px]">(선택)</span>}
      </div>
      {sub && <p className="text-white/60 text-[12px] mt-1 leading-relaxed">{sub}</p>}
    </div>
  );
}

// 인풋 클래스: 검정 배경 + 파란 얇은 테두리 (모든 입력 필드 공통)
const iCls = 'w-full bg-black border border-[rgba(79,142,247,0.12)] hover:border-[rgba(79,142,247,0.24)] focus:border-[rgba(79,142,247,0.40)] rounded-lg focus:outline-none text-[13px] px-3 py-2.5 resize-none text-white/85 placeholder-white/25 transition-colors';
const sCls = 'w-full bg-black border border-[rgba(79,142,247,0.12)] hover:border-[rgba(79,142,247,0.24)] focus:border-[rgba(79,142,247,0.40)] rounded-lg focus:outline-none text-[13px] px-3 py-2.5 cursor-pointer text-white/85 transition-colors';

// ── LLM Models ────────────────────────────────────────────────────────────────
const PROMPT_LLM_MODELS = [
  { id: 'claude-sonnet-4-6',         name: 'Claude Sonnet 4.6',   provider: 'Anthropic', price: '고품질' },
  { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5',    provider: 'Anthropic', price: '빠름' },
  { id: 'claude-opus-4-6',           name: 'Claude Opus 4.6',     provider: 'Anthropic', price: '최고품질' },
  { id: 'gemini-2.5-flash',          name: 'Gemini 2.5 Flash',    provider: 'Google',    price: '최고 가성비' },
  { id: 'qwen3.6-plus',              name: 'Qwen 3.6 Plus',       provider: 'Alibaba',   price: '신규·고지능' },
  { id: 'qwen3.5-flash',             name: 'Qwen 3.5 Flash',      provider: 'Alibaba',   price: '초저가·빠름' },
];


// ── Sidebar Panel Components ──────────────────────────────────────────────────
function SidebarPriceBadge({ price }: { price?: string }) {
  if (!price) return null;
  return <span className="text-[10px] font-mono px-1.5 py-0.5 rounded whitespace-nowrap text-white/30 bg-white/5">{price}</span>;
}

function SidebarAccordion({ label, value, open, onToggle, children }: {
  label: string; value: string; open: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className="border-b border-white/8">
      <button onClick={onToggle} className="w-full flex items-center justify-between py-2.5 group">
        <span className="text-white/40 text-[11px] tracking-widest uppercase">{label}</span>
        <span className="flex items-center gap-2">
          <span className="text-[12px] font-mono truncate max-w-[130px] text-white/70">{value}</span>
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none"
            className={`text-white/30 group-hover:text-white/60 transition-all duration-200 ${open ? 'rotate-180' : ''}`}>
            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </span>
      </button>
      {open && <div className="pb-3">{children}</div>}
    </div>
  );
}

function SidebarOptionItem({ active, onClick, children, sub }: {
  active: boolean; onClick: () => void; children: React.ReactNode; sub?: string;
}) {
  return (
    <button onClick={onClick} className={`sidebar-btn w-full flex items-center justify-between px-2 py-1.5 text-[12px] font-bold border-l-2 transition-colors ${
      active ? 'border-[#4f8ef7] text-[#4f8ef7] bg-[#4f8ef7]/5' : 'border-transparent text-white/50 hover:text-white hover:border-white/30 hover:bg-white/5'
    }`}>
      <span>{children}</span>
      <SidebarPriceBadge price={sub} />
    </button>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function PromptPage() {
  const router = useRouter();

  const [activeCategory, setActiveCategory] = useState<CategoryId>('economy');
  
  const [allData, setAllData] = useState<Record<CategoryId, Record<string, string>>>({
    general: { ...DEFAULT_CAT_DATA },
    economy: { ...DEFAULT_CAT_DATA },
    history: { ...DEFAULT_CAT_DATA },
    psychology: { ...DEFAULT_CAT_DATA },
    horror: { ...DEFAULT_CAT_DATA },
    health: { ...DEFAULT_CAT_DATA },
  });


  // YouTube analysis state
  const [ytUrl, setYtUrl] = useState('');
  const [ytStatus, setYtStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [ytError, setYtError] = useState('');
  const [ytTitle, setYtTitle] = useState('');

  // Script analysis state
  const [scriptText, setScriptText] = useState('');
  const [scriptStatus, setScriptStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [scriptError, setScriptError] = useState('');

  // Sidebar model selection state
  const [ytAnalysisModelId, setYtAnalysisModelId] = useState('claude-sonnet-4-6');
  const [ytModelOpen, setYtModelOpen] = useState(false);
  const [ytLoadingStep, setYtLoadingStep] = useState(0);
  const ytLoadingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── localStorage: load on mount ──
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved);
      if (parsed.activeCategory) setActiveCategory(parsed.activeCategory as CategoryId);
      if (parsed.allData) {
        setAllData(prev => {
          const merged = { ...prev };
          for (const cat of Object.keys(parsed.allData) as CategoryId[]) {
            if (merged[cat]) merged[cat] = { ...merged[cat], ...parsed.allData[cat] };
          }
          return merged;
        });
      }
    } catch {}
  }, []);

  // ── localStorage: save with debounce ──
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ allData, activeCategory })); } catch {}
    }, 500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [allData, activeCategory]);

  // ── Field helpers ──
  const get = useCallback((field: string) => allData[activeCategory]?.[field] ?? '', [allData, activeCategory]);

  const set = useCallback((field: string, value: string) => {
    setAllData(prev => ({ ...prev, [activeCategory]: { ...prev[activeCategory], [field]: value } }));
  }, [activeCategory]);

const resetAll = () => {
    const empty = Object.fromEntries(
      CATEGORIES.map(c => [c.id, { ...DEFAULT_CAT_DATA }])
    ) as Record<CategoryId, Record<string, string>>;
    setAllData(empty);
  };

  const catInfo = CATEGORIES.find(c => c.id === activeCategory)!;

  // ── YouTube Analyzer ──
  async function handleYoutubeAnalyze() {
    if (!ytUrl.trim() || !ytAnalysisModelId) return;
    setYtStatus('loading'); setYtError(''); setYtLoadingStep(0);
    ytLoadingRef.current = setInterval(() => {
      setYtLoadingStep(s => (s + 1) % 4);
    }, 1800);
    try {
      // 일반 카테고리 탭에서 분석 시 → AI가 카테고리 자동 감지
      const requestCategory = activeCategory === 'general' ? 'auto' : activeCategory;

      const res = await fetch('/api/analyze-youtube', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: ytUrl.trim(), category: requestCategory, modelId: ytAnalysisModelId }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || '분석 실패');

      // 감지된 카테고리로 탭 전환 (auto 모드일 때만)
      const targetCat: CategoryId = (requestCategory === 'auto' && d.detectedCategory)
        ? (d.detectedCategory as CategoryId)
        : activeCategory;

      if (targetCat !== activeCategory) setActiveCategory(targetCat);

      // 해당 카테고리에 필드 입력 (set은 activeCategory 기준이라 직접 setAllData)
      const applyFields = (cat: CategoryId, fields: Record<string, string>) => {
        setAllData(prev => ({ ...prev, [cat]: { ...prev[cat], ...fields } }));
      };

      const updates: Record<string, string> = {};
      if (d.topic) updates.topic = d.topic;
      if (d.angle) updates.angle = d.angle;
      if (d.hookStyle) updates.hookStyle = d.hookStyle;
      if (d.differentiation) updates.differentiation = d.differentiation;
      if (d.videoLength) updates.videoLength = d.videoLength;

      const catFields: Record<string, string[]> = {
        general:   ['genContent', 'genPoint1', 'genPoint2', 'genPoint3', 'genCaution', 'genReference'],
        economy:   ['econData', 'econBullish', 'econNeutral', 'econBearish', 'econRisk', 'econSector'],
        history:   ['histEra', 'histConnect', 'histPattern', 'histFacts', 'histLesson'],
        psychology:['psychPhenomenon', 'psychResearch', 'psychApplication', 'psychBehavior'],
        horror:    ['horrorMaterial', 'horrorTwist', 'horrorTension', 'horrorFact', 'horrorEnding'],
        health:    ['healthTopic', 'healthResearch', 'healthMisconception', 'healthAction', 'healthCaution'],
      };
      for (const field of (catFields[targetCat] ?? [])) {
        if (d[field]) updates[field] = d[field];
      }
      applyFields(targetCat, updates);

      if (d.title) setYtTitle(d.title);
      if (ytLoadingRef.current) { clearInterval(ytLoadingRef.current); ytLoadingRef.current = null; }
      setYtStatus('done');
    } catch (err: unknown) {
      if (ytLoadingRef.current) { clearInterval(ytLoadingRef.current); ytLoadingRef.current = null; }
      setYtError(err instanceof Error ? err.message : '분석 중 오류가 발생했습니다');
      setYtStatus('error');
    }
  }

  // ── Script Analyzer ──
  async function handleScriptAnalyze() {
    if (!scriptText.trim() || !ytAnalysisModelId) return;
    setScriptStatus('loading'); setScriptError('');
    try {
      const requestCategory = activeCategory === 'general' ? 'auto' : activeCategory;
      const res = await fetch('/api/analyze-script', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script: scriptText.trim(), category: requestCategory, modelId: ytAnalysisModelId }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || '분석 실패');
      const targetCat: CategoryId = (requestCategory === 'auto' && d.detectedCategory)
        ? (d.detectedCategory as CategoryId) : activeCategory;
      if (targetCat !== activeCategory) setActiveCategory(targetCat);
      const applyFields = (cat: CategoryId, fields: Record<string, string>) => {
        setAllData(prev => ({ ...prev, [cat]: { ...prev[cat], ...fields } }));
      };
      const updates: Record<string, string> = {};
      if (d.topic) updates.topic = d.topic;
      if (d.angle) updates.angle = d.angle;
      if (d.hookStyle) updates.hookStyle = d.hookStyle;
      if (d.differentiation) updates.differentiation = d.differentiation;
      if (d.videoLength) updates.videoLength = d.videoLength;
      const catFields: Record<string, string[]> = {
        general:   ['genContent', 'genPoint1', 'genPoint2', 'genPoint3', 'genCaution', 'genReference'],
        economy:   ['econData', 'econBullish', 'econNeutral', 'econBearish', 'econRisk', 'econSector'],
        history:   ['histEra', 'histConnect', 'histPattern', 'histFacts', 'histLesson'],
        psychology:['psychPhenomenon', 'psychResearch', 'psychApplication', 'psychBehavior'],
        horror:    ['horrorMaterial', 'horrorTwist', 'horrorTension', 'horrorFact', 'horrorEnding'],
        health:    ['healthTopic', 'healthResearch', 'healthMisconception', 'healthAction', 'healthCaution'],
      };
      for (const field of (catFields[targetCat] ?? [])) {
        if (d[field]) updates[field] = d[field];
      }
      applyFields(targetCat, updates);
      setScriptStatus('done');
    } catch (err: unknown) {
      setScriptError(err instanceof Error ? err.message : '분석 오류');
      setScriptStatus('error');
    }
  }

  // ── Build Prompt ──
  function buildPrompt(): string {
    const g = get;
    const catLabel = catInfo.label;
    const lines: string[] = [];

    lines.push(`아래 요청서를 바탕으로 ${catLabel} 카테고리 유튜브 대본을 작성해줘.`);
    lines.push(`위에서 설정한 채널 정체성, 말투 원칙, 7단계 대본 구조, 출력 형식 원칙을 전부 그대로 적용해.`);
    lines.push(`나레이션과 자막으로 바로 사용 가능하도록 자연스럽게 작성해. 마크다운 없이 순수 텍스트로만 작성해. 제목, 굵게, 기호, 번호 리스트 등 어떤 서식도 사용하지 마. 단락 구분은 줄바꿈으로만 해.`);
    lines.push(''); lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━'); lines.push('');

    lines.push(`[카테고리] ${catLabel}`);
    lines.push(`[영상 주제 제목] ${g('topic')}`);
    lines.push(`[핵심 앵글 / 대중의 착각] ${g('angle')}`);
    if (g('videoLength')) lines.push(`[영상 길이 목표] ${g('videoLength')}`);
    if (g('hookStyle')) lines.push(`[도입 훅 방향] ${g('hookStyle')}${g('hookHint') ? ` / 소재: ${g('hookHint')}` : ''}`);
    if (g('differentiation')) { lines.push('[이 영상만의 차별점]'); lines.push(g('differentiation')); lines.push(''); }
    if (g('analogy')) lines.push(`[비유 방향] ${g('analogy')}`);
    if (g('tone')) lines.push(`[영상 톤 & 강조 포인트] ${g('tone')}`);
    lines.push('');

    if (activeCategory === 'general') {
      if (g('genContent')) { lines.push('[핵심 내용 & 자료]'); lines.push(g('genContent')); lines.push(''); }
      if (g('genPoint1') || g('genPoint2') || g('genPoint3')) {
        lines.push('[핵심 포인트]');
        if (g('genPoint1')) lines.push(`포인트 1: ${g('genPoint1')}`);
        if (g('genPoint2')) lines.push(`포인트 2: ${g('genPoint2')}`);
        if (g('genPoint3')) lines.push(`포인트 3: ${g('genPoint3')}`);
        lines.push('');
      }
      if (g('genCaution')) { lines.push('[주의사항 / 반론]'); lines.push(g('genCaution')); lines.push(''); }
      if (g('genReference')) { lines.push('[참고 사례 / 자료]'); lines.push(g('genReference')); lines.push(''); }
    }

    if (activeCategory === 'economy') {
      if (g('econData')) { lines.push('[오늘 날짜 & 핵심 수치]'); lines.push(g('econData')); lines.push(''); }
      if (g('econBullish') || g('econNeutral') || g('econBearish')) {
        lines.push('[시나리오 설정]');
        if (g('econBullish')) lines.push(`낙관: ${g('econBullish')}`);
        if (g('econNeutral')) lines.push(`중립: ${g('econNeutral')}`);
        if (g('econBearish')) lines.push(`비관: ${g('econBearish')}`);
        lines.push('');
      }
      if (g('econRisk')) { lines.push('[리스크 메커니즘]'); lines.push(g('econRisk')); lines.push(''); }
      if (g('econSector')) { lines.push('[수혜주 / 주목 섹터]'); lines.push(g('econSector')); lines.push(''); }
    }

    if (activeCategory === 'history') {
      if (g('histEra')) { lines.push('[시대 & 핵심 사건]'); lines.push(g('histEra')); lines.push(''); }
      if (g('histConnect')) { lines.push('[현재와의 연결고리]'); lines.push(g('histConnect')); lines.push(''); }
      if (g('histPattern')) { lines.push('[반복되는 역사 패턴]'); lines.push(g('histPattern')); lines.push(''); }
      if (g('histFacts')) { lines.push('[핵심 팩트 & 수치]'); lines.push(g('histFacts')); lines.push(''); }
      if (g('histLesson')) { lines.push(`[시청자가 가져갈 교훈] ${g('histLesson')}`); lines.push(''); }
    }

    if (activeCategory === 'psychology') {
      if (g('psychPhenomenon')) { lines.push('[핵심 심리 현상 & 이름]'); lines.push(g('psychPhenomenon')); lines.push(''); }
      if (g('psychResearch')) { lines.push('[관련 연구 & 실험]'); lines.push(g('psychResearch')); lines.push(''); }
      if (g('psychApplication')) { lines.push('[일상 적용 상황]'); lines.push(g('psychApplication')); lines.push(''); }
      if (g('psychBehavior')) { lines.push('[행동 변화 포인트]'); lines.push(g('psychBehavior')); lines.push(''); }
    }

    if (activeCategory === 'horror') {
      if (g('horrorMaterial')) { lines.push('[공포의 소재 & 배경]'); lines.push(g('horrorMaterial')); lines.push(''); }
      if (g('horrorTwist')) { lines.push('[핵심 반전 포인트]'); lines.push(g('horrorTwist')); lines.push(''); }
      if (g('horrorTension')) { lines.push('[긴장 고조 구간 설정]'); lines.push(g('horrorTension')); lines.push(''); }
      if (g('horrorFact')) { lines.push('[핵심 충격 팩트]'); lines.push(g('horrorFact')); lines.push(''); }
      if (g('horrorEnding')) { lines.push(`[영상 마무리 방향] ${g('horrorEnding')}`); lines.push(''); }
    }

    if (activeCategory === 'health') {
      if (g('healthTopic')) { lines.push('[건강 주제 & 핵심 현상]'); lines.push(g('healthTopic')); lines.push(''); }
      if (g('healthResearch')) { lines.push('[관련 연구 & 의학적 근거]'); lines.push(g('healthResearch')); lines.push(''); }
      if (g('healthMisconception')) { lines.push('[대중의 잘못된 상식]'); lines.push(g('healthMisconception')); lines.push(''); }
      if (g('healthAction')) { lines.push('[실천 가능한 행동 지침]'); lines.push(g('healthAction')); lines.push(''); }
      if (g('healthCaution')) { lines.push(`[주의사항 / 면책 포인트] ${g('healthCaution')}`); lines.push(''); }
    }

    if (g('extra')) { lines.push(`[추가 요청사항] ${g('extra')}`); lines.push(''); }

    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━'); lines.push('');
    lines.push('[대본 출력 형식]');
    lines.push('나레이션과 자막으로 바로 사용 가능하도록 자연스럽게 작성.');
    lines.push('마크다운 없이 순수 텍스트로만 작성.');
    lines.push('제목, 굵게, 기호, 번호 리스트 등 어떤 서식도 사용하지 마.');
    lines.push('단락 구분은 줄바꿈으로만.');

    return lines.join('\n');
  }

  function handleGenerate() {
    if (!canGenerate) return;
    const prompt = buildPrompt();
    sessionStorage.setItem('clipflow_script_topic', prompt);
    sessionStorage.setItem('clipflow_script_category', activeCategory);
    router.push('/dashboard/script');
  }

  const canGenerate = (() => {
    if (!get('topic').trim() || !get('angle').trim()) return false;
    return true;
  })();


  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex gap-0 -m-6" style={{ minHeight: 'calc(100vh - 56px)' }}>

      {/* ── 왼쪽 폼 영역 ── */}
      <div className="flex-1 min-w-0 p-6 overflow-y-auto" style={{ borderRight: '1px solid var(--border)' }}>

        {/* 헤더 탭 */}
        <div className="relative mt-4 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <span
              className="w-7 h-7 flex items-center justify-center rounded-lg shrink-0"
              style={{
                background: 'rgba(79,142,247,0.06)',
                border: '1px solid rgba(79,142,247,0.22)',
                color: '#4f8ef7',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10 9 9 9 8 9"/>
              </svg>
            </span>
            <span className="text-sm font-semibold text-white">대본 요청 스크립트</span>
          </div>

          <div className="border rounded-xl cf-card" style={{ borderColor: 'var(--border)' }}>

            {/* 카테고리 탭 */}
            <div className="flex border-b border-white/10">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`flex-1 flex items-center justify-center px-2 py-3 text-[13px] font-medium border-b-2 transition-colors ${
                    activeCategory === cat.id
                      ? `border-current ${cat.textCls}`
                      : 'border-transparent text-white/35 hover:text-white/55'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <div className="p-5 space-y-6">

              {/* 카테고리 헤더 + 초기화 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${catInfo.dotCls}`} />
                  <span className={`text-[13px] font-semibold ${catInfo.textCls}`}>{catInfo.label} 대본 요청 스크립트</span>
                </div>
              </div>

              {/* ── 공통 필드 ── */}
              <div className="rounded-xl overflow-hidden" style={{ background: 'var(--input-bg)', border: '1px solid var(--border)' }}>
                {/* 카드 헤더 */}
                <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: '1px solid var(--border)', background: 'rgba(56,189,248,0.04)' }}>
                  <div className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${catInfo.dotCls}`} />
                    <p className={`text-[12px] font-semibold uppercase tracking-widest ${catInfo.textCls}`}>공통 필드</p>
                  </div>
                  <button
                    onClick={resetAll}
                    className="text-[12px] px-2.5 py-1 rounded-lg border border-red-500/25 text-red-400/60 hover:text-red-400 hover:border-red-500/50 hover:bg-red-500/5 transition-colors"
                  >
                    전체 초기화
                  </button>
                </div>
                <div className="p-4 space-y-5">

                {/* 영상 주제 */}
                <FieldCard required sub="키워드가 아닌 제목처럼 구체적으로" accentColor="#4f8ef7"
                  inputContent={<input value={get('topic')} onChange={e => set('topic', e.target.value)} placeholder="예: 삼성전자 10만원, 진짜 가능한가" className={iCls} />}>
                  영상 주제 제목
                </FieldCard>

                {/* 핵심 앵글 */}
                <FieldCard required sub="이 주제에서 대부분이 잘못 알고 있는 것 — 날카로울수록 영상 전체가 살아나요" accentColor="#4f8ef7"
                  inputContent={<textarea value={get('angle')} onChange={e => set('angle', e.target.value)} rows={3} placeholder="예: 금리가 내리면 무조건 주가가 오른다고 생각하지만, 실제로는 금리 인하 속도와 경기침체 여부가 더 중요하다" className={iCls} />}>
                  핵심 앵글 / 대중의 착각
                </FieldCard>

                {/* 비유 방향 */}
                <FieldCard optional sub="안 주면 AI가 매번 비슷한 비유 반복" accentColor="rgba(79,142,247,0.4)"
                  inputContent={<input value={get('analogy')} onChange={e => set('analogy', e.target.value)} placeholder="예: 주식 시장을 날씨에 비유 / 경제를 음식 관계로" className={iCls} />}>
                  비유 방향
                </FieldCard>

                {/* 영상 톤 */}
                <FieldCard optional sub="도입부 특히 강하게 / 반전 극적으로 / 차분하게" accentColor="rgba(79,142,247,0.4)"
                  inputContent={<input value={get('tone')} onChange={e => set('tone', e.target.value)} placeholder="예: 도입부를 긴박하게 / 결론부 특히 임팩트 있게 / 전반적으로 차분한 다큐 느낌" className={iCls} />}>
                  영상 톤 & 강조 포인트
                </FieldCard>

                {/* 도입 훅 방향 */}
                {activeCategory === 'general' && (
                  <FieldCard optional sub="프롬프트에 저장된 3가지 훅 형식 중 선택 — 안 고르면 AI가 자동 선택" accentColor="rgba(79,142,247,0.4)"
                    inputContent={
                      <>
                        <select value={get('hookStyle')} onChange={e => set('hookStyle', e.target.value)} className={sCls}>
                          <option value="">AI 자동 선택</option>
                          <option value="A형 — 도발적 질문: &quot;[핵심 주제], 지금 제대로 알고 있어?&quot;">A형 — 도발적 질문형</option>
                          <option value="B형 — 충격 수치: &quot;[충격적 수치나 사실], 이게 우리한테 무슨 의미인지 알아?&quot;">B형 — 충격 수치형</option>
                          <option value="C형 — 착각 지적: &quot;지금 [상황]인데, 대부분이 완전히 잘못 보고 있어.&quot;">C형 — 착각 지적형</option>
                        </select>
                        {get('hookStyle') && (
                          <div className="mt-2">
                            <input value={get('hookHint')} onChange={e => set('hookHint', e.target.value)}
                              placeholder="첫 문장에 넣을 구체적인 소재나 수치 (선택) — 예: 나스닥 18,200 / 삼성전자 6만원" className={iCls} />
                          </div>
                        )}
                      </>
                    }>
                    도입 훅 방향
                  </FieldCard>
                )}

                {/* 경쟁 영상 차별점 */}
                <FieldCard optional sub="유사 주제 영상들과 다른 이 영상만의 관점 — 클수록 4단계 인사이트가 날카로워집니다" accentColor="rgba(79,142,247,0.4)"
                  inputContent={<textarea value={get('differentiation')} onChange={e => set('differentiation', e.target.value)} rows={3}
                    placeholder={`예:\n- 기존 영상들은 금리 인하 자체에 집중하지만, 이 영상은 '선반영 이후의 실망 매물' 타이밍에 집중\n- 단순 종목 추천이 아닌 수급 데이터 기반 근거 제시`}
                    className={iCls} />}>
                  경쟁 영상과의 차별점
                </FieldCard>
              </div>{/* /p-4 */}
              </div>{/* /공통 필드 카드 */}

              {/* ── 카테고리 전용 필드 ── */}
              <div className="rounded-xl overflow-hidden" style={{ background: 'var(--input-bg)', border: '1px solid var(--border)' }}>
                <div className="flex items-center gap-2 px-4 py-2.5" style={{ borderBottom: '1px solid var(--border)', background: 'rgba(56,189,248,0.04)' }}>
                  <span className={`w-1.5 h-1.5 rounded-full ${catInfo.dotCls}`} />
                  <p className={`text-[12px] font-semibold uppercase tracking-widest ${catInfo.textCls}`}>{catInfo.label} 전용 필드</p>
                </div>
                <div className="p-4 space-y-5">

                {/* ═══ 일반 ═══ */}
                {activeCategory === 'general' && (
                  <>
                    <div>
                      <FieldLabel optional sub="다룰 주요 사실, 데이터, 사례, 연구결과 등 — 구체적일수록 AI 할루시네이션이 줄고 품질이 올라갑니다">핵심 내용 & 자료</FieldLabel>
                      <textarea value={get('genContent')} onChange={e => set('genContent', e.target.value)} rows={5}
                        placeholder={`예:\n- 카페인 반감기는 약 5~6시간\n- 금단증상 보통 2~9일 지속\n- 하버드 연구: 하루 3~4잔은 심장 건강에 이점`}
                        className={iCls} />
                    </div>

                    <div>
                      <FieldLabel optional sub="영상에서 강조할 핵심 포인트 3가지 — 각각 자유롭게 입력">핵심 포인트</FieldLabel>
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { key: 'genPoint1', label: '포인트 1', placeholder: '첫 번째 강조 내용\n예: 금단증상 극복법' },
                          { key: 'genPoint2', label: '포인트 2', placeholder: '두 번째 강조 내용\n예: 대체 음료 추천' },
                          { key: 'genPoint3', label: '포인트 3', placeholder: '세 번째 강조 내용\n예: 한 달 후 실제 변화' },
                        ].map(({ key, label, placeholder }) => (
                          <div key={key}>
                            <div className="mb-2"><span className="text-[12px] font-semibold px-2 py-0.5 bg-sky-400/15 text-sky-400 border border-sky-400/30">{label}</span></div>
                            <textarea value={get(key)} onChange={e => set(key, e.target.value)} rows={4} placeholder={placeholder} className={iCls + ' text-[13px]'} />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <FieldLabel optional>주의사항 / 반론 포인트</FieldLabel>
                        <textarea value={get('genCaution')} onChange={e => set('genCaution', e.target.value)} rows={4}
                          placeholder="예: 일부 연구에서는 반대 결과도 존재, 개인차 있음" className={iCls} />
                      </div>
                      <div>
                        <FieldLabel optional>참고 사례 / 관련 자료</FieldLabel>
                        <textarea value={get('genReference')} onChange={e => set('genReference', e.target.value)} rows={4}
                          placeholder="예: 앤드류 후버먼 팟캐스트 관련 에피소드" className={iCls} />
                      </div>
                    </div>

                  </>
                )}

                {/* ═══ 경제 / 주식 ═══ */}
                {activeCategory === 'economy' && (
                  <>
                    <div>
                      <FieldLabel sub="촬영일, 코스피/나스닥/환율/유가, 주요 이벤트, 외국인 수급">오늘 날짜 & 핵심 수치</FieldLabel>
                      <textarea value={get('econData')} onChange={e => set('econData', e.target.value)} rows={4}
                        placeholder={`예:\n2025.3.28 (금)\n코스피 2,580 (-0.8%) / 나스닥 18,200 (+0.3%)\n원달러 1,420원 / 외국인 +800억\nFOMC 4월 회의 예정`}
                        className={iCls} />
                    </div>

                    <div>
                      <FieldLabel optional>시나리오 설정</FieldLabel>
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { key: 'econBullish', label: '낙관', labelCls: 'text-green-400 border-green-400/30 bg-green-400/10', placeholder: '조건 + 목표치\n예: 외국인 매수 지속 시 2,700 돌파 시도' },
                          { key: 'econNeutral', label: '중립', labelCls: 'text-green-500 border-green-500/30 bg-green-500/10', placeholder: '박스권 + 대응법\n예: 2,500~2,650 레인지 횡보' },
                          { key: 'econBearish', label: '비관', labelCls: 'text-red-400 border-red-400/30 bg-red-400/10', placeholder: '최악 조건 + 바닥선\n예: 환율 1,480원 돌파 시 2,400 재테스트' },
                        ].map(({ key, label, labelCls, placeholder }) => (
                          <div key={key}>
                            <div className="mb-2"><span className={`text-[11px] font-semibold px-2 py-0.5 border ${labelCls}`}>{label}</span></div>
                            <textarea value={get(key)} onChange={e => set(key, e.target.value)} rows={4} placeholder={placeholder} className={iCls + ' text-[12px]'} />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <FieldLabel optional sub="발동 조건 + 어떤 경로로 타격 오는지까지">리스크 메커니즘</FieldLabel>
                      <textarea value={get('econRisk')} onChange={e => set('econRisk', e.target.value)} rows={3} placeholder="예: 트럼프 관세 추가 발표 → 달러 강세 → 환율 급등 → 외국인 이탈 시나리오" className={iCls} />
                    </div>

                    <div>
                      <FieldLabel optional>수혜주 / 주목 섹터</FieldLabel>
                      <textarea value={get('econSector')} onChange={e => set('econSector', e.target.value)} rows={3} placeholder="예: 방산 (한화에어로, LIG넥스원) / 조선 섹터 주목 / 반도체 단기 주의" className={iCls} />
                    </div>

                  </>
                )}

                {/* ═══ 역사 ═══ */}
                {activeCategory === 'history' && (
                  <>
                    <div>
                      <FieldLabel>시대 & 핵심 사건</FieldLabel>
                      <textarea value={get('histEra')} onChange={e => set('histEra', e.target.value)} rows={3} placeholder="예: 1929년 대공황 / 뱅크런 연쇄 발생 → 실업률 25% → 뉴딜 정책 도입" className={iCls} />
                    </div>

                    <div>
                      <FieldLabel sub="역사적 사건이 지금 우리에게 왜 중요한지">현재와의 연결고리</FieldLabel>
                      <textarea value={get('histConnect')} onChange={e => set('histConnect', e.target.value)} rows={3} placeholder="예: 현재 SVB 사태, 부동산 PF 부실과 구조적으로 유사한 신용 수축 메커니즘" className={iCls} />
                    </div>

                    <div>
                      <FieldLabel optional>반복되는 역사 패턴</FieldLabel>
                      <textarea value={get('histPattern')} onChange={e => set('histPattern', e.target.value)} rows={3} placeholder="예: 과잉 유동성 → 자산 버블 → 금리 인상 → 신용 수축 → 공황 패턴이 100년째 반복" className={iCls} />
                    </div>

                    <div>
                      <FieldLabel optional>핵심 팩트 & 수치</FieldLabel>
                      <textarea value={get('histFacts')} onChange={e => set('histFacts', e.target.value)} rows={3} placeholder="예: 1929년 다우 89% 폭락 / 회복까지 25년 / GDP 30% 감소" className={iCls} />
                    </div>

                    <div>
                      <FieldLabel optional>시청자가 가져갈 교훈</FieldLabel>
                      <input value={get('histLesson')} onChange={e => set('histLesson', e.target.value)} placeholder="예: 위기는 반복되지만 그 안에서 살아남는 방법도 반복된다" className={iCls} />
                    </div>
                  </>
                )}

                {/* ═══ 심리학 ═══ */}
                {activeCategory === 'psychology' && (
                  <>
                    <div>
                      <FieldLabel>핵심 심리 현상 & 이름</FieldLabel>
                      <textarea value={get('psychPhenomenon')} onChange={e => set('psychPhenomenon', e.target.value)} rows={3} placeholder="예: 확증 편향 (Confirmation Bias) — 자신의 믿음을 강화하는 정보만 선택적으로 수용하는 현상" className={iCls} />
                    </div>

                    <div>
                      <FieldLabel sub="연구자명, 실험명, 연도, 결과 수치까지">관련 연구 & 실험</FieldLabel>
                      <textarea value={get('psychResearch')} onChange={e => set('psychResearch', e.target.value)} rows={3} placeholder="예: 피터 웨이슨(1960) 선택 과제 실험 — 피험자 80% 이상이 자신의 가설을 반증하는 카드를 뒤집지 않음" className={iCls} />
                    </div>

                    <div>
                      <FieldLabel sub="시청자가 실제로 겪는 구체적 사례">일상 적용 상황</FieldLabel>
                      <textarea value={get('psychApplication')} onChange={e => set('psychApplication', e.target.value)} rows={3} placeholder="예: 주식을 사면 그 기업의 좋은 뉴스만 눈에 들어오고, 나쁜 뉴스는 '예외'로 처리하는 경험" className={iCls} />
                    </div>

                    <div>
                      <FieldLabel optional>행동 변화 포인트</FieldLabel>
                      <textarea value={get('psychBehavior')} onChange={e => set('psychBehavior', e.target.value)} rows={3} placeholder="예: 의사결정 전 '내가 틀렸다면 어떤 증거가 있을까?'를 먼저 검색하는 습관" className={iCls} />
                    </div>
                  </>
                )}

                {/* ═══ 공포 ═══ */}
                {activeCategory === 'horror' && (
                  <>
                    <div>
                      <FieldLabel>공포의 소재 & 배경</FieldLabel>
                      <textarea value={get('horrorMaterial')} onChange={e => set('horrorMaterial', e.target.value)} rows={3} placeholder="예: 1980년대 일본 자살 숲 아오키가하라 / 연간 수십 구의 시신 발견 / 일본 정부가 안내판을 세운 이유" className={iCls} />
                    </div>

                    <div>
                      <FieldLabel sub="시청자가 예상 못 한 반전 — 이게 없으면 공포 영상이 아니에요">핵심 반전 포인트</FieldLabel>
                      <textarea value={get('horrorTwist')} onChange={e => set('horrorTwist', e.target.value)} rows={3} placeholder="예: 숲 자체가 아니라 '그곳에 가는 사람들을 유인하는 심리 구조'가 진짜 공포 — 인터넷 자살 카페와 동일한 메커니즘" className={iCls} />
                    </div>

                    <div>
                      <FieldLabel optional>긴장 고조 구간 설정</FieldLabel>
                      <textarea value={get('horrorTension')} onChange={e => set('horrorTension', e.target.value)} rows={3} placeholder="예: 숲 입구 → 미로 같은 내부 → 발견된 유품들 묘사 → 생존자 증언 순으로 긴장 누적" className={iCls} />
                    </div>

                    <div>
                      <FieldLabel optional>핵심 충격 팩트</FieldLabel>
                      <textarea value={get('horrorFact')} onChange={e => set('horrorFact', e.target.value)} rows={3} placeholder="예: 2003년 단 하루 사이 78구 발견 / 매년 평균 30명 이상 / 일본 정부는 공식 집계 중단" className={iCls} />
                    </div>

                    <div>
                      <FieldLabel optional>영상 마무리 방향</FieldLabel>
                      <input value={get('horrorEnding')} onChange={e => set('horrorEnding', e.target.value)} placeholder="예: 공포로 끝내지 말고 '왜 이런 장소가 생기는가'에 대한 사회적 메시지로 마무리" className={iCls} />
                    </div>
                  </>
                )}

                {/* ═══ 건강 ═══ */}
                {activeCategory === 'health' && (
                  <>
                    <div>
                      <FieldLabel>건강 주제 & 핵심 현상</FieldLabel>
                      <textarea value={get('healthTopic')} onChange={e => set('healthTopic', e.target.value)} rows={3} placeholder="예: 수면 부족이 뇌에 미치는 영향 — 하루 6시간 이하 수면 시 인지 기능 저하가 혈중 알코올 0.1% 상태와 동일" className={iCls} />
                    </div>

                    <div>
                      <FieldLabel sub="연구기관, 논문, 수치까지">관련 연구 & 의학적 근거</FieldLabel>
                      <textarea value={get('healthResearch')} onChange={e => set('healthResearch', e.target.value)} rows={3} placeholder="예: 매튜 워커(UC버클리, 2017) — 수면 부족 시 편도체 반응 60% 증가 / WHO 수면 부족 '현대의 전염병' 규정" className={iCls} />
                    </div>

                    <div>
                      <FieldLabel>대중의 잘못된 상식</FieldLabel>
                      <textarea value={get('healthMisconception')} onChange={e => set('healthMisconception', e.target.value)} rows={3} placeholder="예: '주말에 몰아서 자면 된다' — 수면 부채는 완전히 회복되지 않으며, 몰아 자기는 오히려 생체리듬 파괴" className={iCls} />
                    </div>

                    <div>
                      <FieldLabel optional>실천 가능한 행동 지침</FieldLabel>
                      <textarea value={get('healthAction')} onChange={e => set('healthAction', e.target.value)} rows={3} placeholder="예: 기상 시간 고정 (취침 시간보다 우선) / 수면 30분 전 블루라이트 차단 / 카페인 반감기 고려 오후 2시 이후 중단" className={iCls} />
                    </div>

                    <div>
                      <FieldLabel optional>주의사항 / 면책 포인트</FieldLabel>
                      <input value={get('healthCaution')} onChange={e => set('healthCaution', e.target.value)} placeholder="예: 수면 장애가 의심될 경우 전문의 상담 필요 / 개인차 있음" className={iCls} />
                    </div>
                  </>
                )}
              </div>{/* /p-4 */}
              </div>{/* /전용 필드 카드 */}

              {/* ── 추가 요청사항 (공통) ── */}
              <div>
                <FieldLabel optional>추가 요청사항</FieldLabel>
                <input value={get('extra')} onChange={e => set('extra', e.target.value)} placeholder="예: 도입부를 질문으로 시작 / 30대 직장인 눈높이 / 비유를 음식 소재로" className={iCls} />
              </div>

              {/* ── 생성 버튼 ── */}
              <div className="flex justify-end pt-2">
                <button
                  onClick={handleGenerate}
                  disabled={!canGenerate}
                  title={!canGenerate ? '필수 항목을 모두 입력해주세요 (빨간 점 표시 항목)' : ''}
                  className={`inline-flex items-center gap-2 px-6 py-2 font-bold text-[13px] tracking-widest uppercase rounded-xl transition-all ${
                    canGenerate
                      ? 'cf-btn-primary'
                      : 'bg-white/5 text-white/20 cursor-not-allowed border border-white/8'
                  }`}
                >
                  요청서 생성 →
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* ── 우측 사이드바 ── */}
      <aside
        className="w-[340px] shrink-0 flex flex-col border-l overflow-y-auto"
        style={{ borderColor: 'var(--border)', background: 'var(--sidebar)' }}
      >
        <div className="flex-1 px-3 py-4 space-y-3">

          {/* ── YouTube 자동 분석 카드 ── */}
          <div
            className="rounded-xl overflow-hidden"
            style={{
              border: '1px solid var(--border)',
              background: 'var(--card)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 0 16px rgba(79,142,247,0.05)',
            }}
          >
            {/* 카드 헤더 */}
            <div
              className="flex items-center gap-2.5 px-4 py-2.5"
              style={{ borderBottom: '1px solid var(--border)', background: 'rgba(239,68,68,0.04)' }}
            >
              <div
                className="w-6 h-6 flex items-center justify-center rounded-md shrink-0"
                style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.28)', boxShadow: '0 0 8px rgba(239,68,68,0.15)' }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="#ef4444">
                  <path d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.54 3.5 12 3.5 12 3.5s-7.54 0-9.38.55A3.02 3.02 0 0 0 .5 6.19C0 8.04 0 12 0 12s0 3.96.5 5.81a3.02 3.02 0 0 0 2.12 2.14C4.46 20.5 12 20.5 12 20.5s7.54 0 9.38-.55a3.02 3.02 0 0 0 2.12-2.14C24 15.96 24 12 24 12s0-3.96-.5-5.81zM9.75 15.5V8.5l6.25 3.5-6.25 3.5z"/>
                </svg>
              </div>
              <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                YouTube 자동 분석
              </span>
            </div>

            {/* 카드 바디 */}
            <div className="p-3.5 space-y-2.5">
              <input
                value={ytUrl}
                onChange={e => { setYtUrl(e.target.value); setYtStatus('idle'); setYtError(''); }}
                onKeyDown={e => e.key === 'Enter' && ytAnalysisModelId && handleYoutubeAnalyze()}
                placeholder="https://youtube.com/watch?v=..."
                disabled={ytStatus === 'loading'}
                className="w-full cf-input text-[12px] px-3 py-2 focus:outline-none"
              />
              <div className="flex justify-end">
                <button
                  onClick={handleYoutubeAnalyze}
                  disabled={!ytUrl.trim() || !ytAnalysisModelId || ytStatus === 'loading'}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171' }}
                >
                  {ytStatus === 'loading' ? <Loader2 size={11} className="animate-spin" /> : 'AI 분석 →'}
                </button>
              </div>

              {/* 로딩 애니메이션 */}
              {ytStatus === 'loading' && (() => {
                const steps = ['자막 추출 중...', '카테고리 감지 중...', 'AI 분석 중...', '필드 채우는 중...'];
                return (
                  <div className="relative rounded-lg overflow-hidden py-5 flex flex-col items-center gap-3"
                    style={{ border: '1px solid rgba(239,68,68,0.2)', background: 'radial-gradient(ellipse at 50% 0%, rgba(239,68,68,0.06) 0%, transparent 70%)' }}>
                    <style>{`
                      @keyframes yt-orbit  { from { transform: rotate(0deg)   translateX(20px) rotate(0deg);    } to { transform: rotate(360deg)  translateX(20px) rotate(-360deg);  } }
                      @keyframes yt-orbit2 { from { transform: rotate(120deg) translateX(20px) rotate(-120deg); } to { transform: rotate(480deg)  translateX(20px) rotate(-480deg);  } }
                      @keyframes yt-orbit3 { from { transform: rotate(240deg) translateX(20px) rotate(-240deg); } to { transform: rotate(600deg)  translateX(20px) rotate(-600deg);  } }
                      @keyframes yt-pulse-ring { 0%,100% { opacity:0.15; transform:scale(1); } 50% { opacity:0.4; transform:scale(1.15); } }
                      @keyframes yt-scanline { 0% { left: -3rem; } 100% { left: 100%; } }
                    `}</style>
                    <div className="relative w-11 h-11">
                      <div className="absolute inset-0 rounded-full" style={{ background: 'rgba(239,68,68,0.12)', animation: 'yt-pulse-ring 2s ease-in-out infinite' }} />
                      <div className="absolute inset-[5px] rounded-full flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.18)', boxShadow: '0 0 16px rgba(239,68,68,0.3)' }}>
                        <div className="w-1.5 h-1.5 rounded-full bg-red-500" style={{ boxShadow: '0 0 6px #ef4444' }} />
                      </div>
                      {[
                        { anim: 'yt-orbit 1.8s linear infinite',  color: '#ef4444' },
                        { anim: 'yt-orbit2 1.8s linear infinite', color: '#fca5a5' },
                        { anim: 'yt-orbit3 1.8s linear infinite', color: '#f87171' },
                      ].map((o, i) => (
                        <div key={i} className="absolute inset-0 flex items-center justify-center">
                          <div className="w-1.5 h-1.5 rounded-full" style={{ background: o.color, animation: o.anim, boxShadow: `0 0 4px ${o.color}` }} />
                        </div>
                      ))}
                    </div>
                    <div className="text-center space-y-0.5">
                      <p className="text-[11px] font-medium tracking-wide text-red-400">{steps[ytLoadingStep]}</p>
                      <p className="text-[10px] text-white/25">잠시만 기다려주세요</p>
                    </div>
                    <div className="w-32 h-[1px] relative overflow-hidden rounded-full" style={{ background: 'rgba(239,68,68,0.12)' }}>
                      <div className="absolute inset-y-0 w-12 rounded-full" style={{ background: 'linear-gradient(90deg, transparent, #ef4444, transparent)', animation: 'yt-scanline 1.5s linear infinite' }} />
                    </div>
                  </div>
                );
              })()}

              {ytStatus === 'error' && (
                <p className="text-red-400/70 text-[11px] font-mono px-1">{ytError}</p>
              )}
              {ytStatus === 'done' && (
                <div
                  className="flex items-start gap-2 rounded-lg px-3 py-2"
                  style={{ background: 'rgba(74,222,128,0.07)', border: '1px solid rgba(74,222,128,0.18)' }}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0 mt-1" style={{ boxShadow: '0 0 6px rgba(74,222,128,0.5)' }} />
                  <div className="min-w-0">
                    <p className="text-green-400 text-[11px] font-medium">분석 완료 — 필드 자동 입력됨</p>
                    {ytTitle && <p className="text-white/30 text-[10px] font-mono truncate mt-0.5">{ytTitle}</p>}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── 대본 붙여넣기 분석 카드 ── */}
          <div
            className="rounded-xl overflow-hidden"
            style={{
              border: '1px solid var(--border)',
              background: 'var(--card)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 0 16px rgba(79,142,247,0.05)',
            }}
          >
            {/* 카드 헤더 */}
            <div
              className="flex items-center gap-2.5 px-4 py-2.5"
              style={{ borderBottom: '1px solid var(--border)', background: 'rgba(79,142,247,0.03)' }}
            >
              <div
                className="w-6 h-6 flex items-center justify-center rounded-md shrink-0"
                style={{ background: 'rgba(79,142,247,0.10)', border: '1px solid rgba(79,142,247,0.25)', boxShadow: '0 0 8px rgba(79,142,247,0.12)' }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#93c5fd" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
              </div>
              <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                대본 붙여넣기 분석
              </span>
            </div>

            {/* 카드 바디 */}
            <div className="p-3.5 space-y-2.5">
              <textarea
                value={scriptText}
                onChange={e => { setScriptText(e.target.value); setScriptStatus('idle'); setScriptError(''); }}
                rows={8}
                placeholder="기존 대본을 붙여넣으면 필드를 자동으로 채워드립니다..."
                disabled={scriptStatus === 'loading'}
                className="w-full cf-input text-[12px] px-3 py-2 resize-none focus:outline-none"
              />
              <div className="flex justify-end">
                <button
                  onClick={handleScriptAnalyze}
                  disabled={!scriptText.trim() || !ytAnalysisModelId || scriptStatus === 'loading'}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: 'rgba(79,142,247,0.10)', border: '1px solid rgba(79,142,247,0.25)', color: '#93c5fd' }}
                >
                  {scriptStatus === 'loading' ? <Loader2 size={11} className="animate-spin" /> : 'AI 분석 →'}
                </button>
              </div>
              {scriptStatus === 'error' && (
                <p className="text-red-400/70 text-[11px] font-mono px-1">{scriptError}</p>
              )}
              {scriptStatus === 'done' && (
                <div
                  className="flex items-center gap-2 rounded-lg px-3 py-2"
                  style={{ background: 'rgba(74,222,128,0.07)', border: '1px solid rgba(74,222,128,0.18)' }}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" style={{ boxShadow: '0 0 6px rgba(74,222,128,0.5)' }} />
                  <p className="text-green-400 text-[11px] font-medium">분석 완료 — 필드 자동 입력됨</p>
                </div>
              )}
            </div>
          </div>

          {/* ── 분석 AI 모델 카드 ── */}
          <div
            className="rounded-xl overflow-hidden"
            style={{
              border: '1px solid var(--border)',
              background: 'var(--card)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 0 16px rgba(79,142,247,0.05)',
            }}
          >
            <div className="px-4 py-3">
              <SidebarAccordion
                label="분석 AI 모델"
                value={PROMPT_LLM_MODELS.find(m => m.id === ytAnalysisModelId)?.name ?? ''}
                open={ytModelOpen}
                onToggle={() => setYtModelOpen(v => !v)}
              >
                <div className="space-y-3 pt-1">
                  {(['Anthropic', 'Google', 'Alibaba'] as const).map(provider => (
                    <div key={provider}>
                      <p className="text-[10px] font-semibold uppercase tracking-wide px-1 mb-1" style={{ color: 'var(--text-ultra)' }}>{provider}</p>
                      <div className="space-y-0.5">
                        {PROMPT_LLM_MODELS.filter(m => m.provider === provider).map(m => (
                          <SidebarOptionItem key={m.id} active={ytAnalysisModelId === m.id}
                            onClick={() => { setYtAnalysisModelId(m.id); setYtModelOpen(false); }} sub={m.price}>
                            {m.name}
                          </SidebarOptionItem>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </SidebarAccordion>
            </div>
          </div>

        </div>
      </aside>
    </div>
  );
}
