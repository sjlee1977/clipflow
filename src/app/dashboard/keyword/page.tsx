'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, TrendingUp, BarChart2, ShoppingBag, Globe2, Loader2, AlertCircle, PenLine, ArrowUpRight, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';

// ─── 타입 ─────────────────────────────────────────────────────────────────────
interface NaverVolumeItem {
  keyword: string;
  monthlyPc: number;
  monthlyMobile: number;
  monthlyTotal: number;
  compIdx: '낮음' | '중간' | '높음';
  plAvgDepth: number;
  opportunity: number;
}

interface NaverVolumeResult {
  keyword: string;
  results: NaverVolumeItem[];
}

interface TrendPoint { period: string; ratio: number }
interface TrendResult { keyword: string; data: TrendPoint[]; peak: number; latest: number }
interface TrendResponse { startDate: string; endDate: string; timeUnit: string; results: TrendResult[] }

interface GoogleTrendItem { title: string; traffic: string; articles: { title: string; url: string }[] }
interface GoogleTrendsResult {
  geo: string;
  daily: GoogleTrendItem[];
  related: { rising: { query: string; value: number }[]; top: { query: string; value: number }[] } | null;
}

type Tab = 'naver' | 'google' | 'shopping';
type Period = '1m' | '3m' | '6m' | '1y';
type TimeUnit = 'date' | 'week' | 'month';
type CompIdx = '낮음' | '중간' | '높음';

// ─── 유틸 ─────────────────────────────────────────────────────────────────────
function fmt(n: number): string {
  return n.toLocaleString('ko-KR');
}

const COMP_COLOR: Record<CompIdx, string> = {
  '낮음': '#4f8ef7',
  '중간': '#facc15',
  '높음': '#ef4444',
};

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: '1m', label: '1개월' },
  { value: '3m', label: '3개월' },
  { value: '6m', label: '6개월' },
  { value: '1y', label: '1년' },
];

const TIMEUNIT_OPTIONS: { value: TimeUnit; label: string }[] = [
  { value: 'date',  label: '일별' },
  { value: 'week',  label: '주별' },
  { value: 'month', label: '월별' },
];

// ─── 미니 라인차트 (SVG) ──────────────────────────────────────────────────────
function SparkLine({ data, color = '#4f8ef7', height = 40 }: { data: TrendPoint[]; color?: string; height?: number }) {
  if (!data || data.length < 2) return null;
  const w = 200;
  const h = height;
  const pad = 4;
  const max = Math.max(...data.map(d => d.ratio), 1);
  const pts = data.map((d, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2);
    const y = h - pad - (d.ratio / max) * (h - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const fill = data.map((d, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2);
    const y = h - pad - (d.ratio / max) * (h - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const fillPath = `M${fill[0]} L${fill.join(' L')} L${(pad + (w - pad * 2)).toFixed(1)},${(h - pad)} L${pad},${(h - pad)} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }}>
      <defs>
        <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={fillPath} fill={`url(#grad-${color.replace('#', '')})`} />
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── 큰 트렌드 차트 (SVG) ─────────────────────────────────────────────────────
function TrendChart({ results, height = 180 }: { results: TrendResult[]; height?: number }) {
  if (!results || results.length === 0) return null;

  const COLORS = ['#4f8ef7', '#60a5fa', '#a78bfa', '#fb923c', '#f87171'];
  const w = 600;
  const h = height;
  const padL = 36;
  const padR = 12;
  const padT = 12;
  const padB = 28;
  const allRatios = results.flatMap(r => r.data.map(d => d.ratio));
  const maxR = Math.max(...allRatios, 1);
  const periods = results[0]?.data.map(d => d.period) ?? [];
  const xStep = (w - padL - padR) / Math.max(periods.length - 1, 1);

  const yTicks = [0, 25, 50, 75, 100].filter(v => v <= maxR * 1.1);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full overflow-visible" style={{ height }}>
      {/* Y 격자 */}
      {yTicks.map(tick => {
        const y = padT + (h - padT - padB) * (1 - tick / maxR);
        return (
          <g key={tick}>
            <line x1={padL} y1={y} x2={w - padR} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
            <text x={padL - 6} y={y + 4} fontSize="9" fill="rgba(255,255,255,0.25)" textAnchor="end">{tick}</text>
          </g>
        );
      })}
      {/* X 레이블 (월별은 일부만) */}
      {periods.map((p, i) => {
        const x = padL + i * xStep;
        const show = periods.length <= 12 || i % Math.ceil(periods.length / 12) === 0 || i === periods.length - 1;
        if (!show) return null;
        const label = p.slice(0, 7); // YYYY-MM
        return <text key={i} x={x} y={h - 6} fontSize="9" fill="rgba(255,255,255,0.25)" textAnchor="middle">{label}</text>;
      })}
      {/* 데이터 라인 */}
      {results.map((r, ri) => {
        const color = COLORS[ri % COLORS.length];
        const pts = r.data.map((d, i) => {
          const x = padL + i * xStep;
          const y = padT + (h - padT - padB) * (1 - d.ratio / maxR);
          return `${x.toFixed(1)},${y.toFixed(1)}`;
        });
        return (
          <g key={ri}>
            <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
            {/* 마지막 점 */}
            {(() => {
              const last = r.data[r.data.length - 1];
              if (!last) return null;
              const lx = padL + (r.data.length - 1) * xStep;
              const ly = padT + (h - padT - padB) * (1 - last.ratio / maxR);
              return <circle cx={lx} cy={ly} r="3" fill={color} stroke="rgba(0,0,0,0.8)" strokeWidth="1.5" />;
            })()}
          </g>
        );
      })}
    </svg>
  );
}

// ─── 기회 점수 바 ─────────────────────────────────────────────────────────────
function OpportunityBar({ score }: { score: number }) {
  const color = score >= 70 ? '#4f8ef7' : score >= 40 ? '#facc15' : '#f87171';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-white/8 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${score}%`, backgroundColor: color }} />
      </div>
      <span className="text-[12px] font-bold shrink-0" style={{ color }}>{score}</span>
    </div>
  );
}

// ─── 메인 페이지 ──────────────────────────────────────────────────────────────
export default function KeywordPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('naver');
  const [keyword, setKeyword] = useState('');
  const [period, setPeriod] = useState<Period>('1y');
  const [timeUnit, setTimeUnit] = useState<TimeUnit>('month');
  const [geo, setGeo] = useState('KR');

  // 네이버 검색량
  const [volumeLoading, setVolumeLoading] = useState(false);
  const [volumeData, setVolumeData] = useState<NaverVolumeResult | null>(null);
  const [volumeError, setVolumeError] = useState('');
  const [showAllRelated, setShowAllRelated] = useState(false);

  // 네이버/쇼핑 트렌드
  const [trendLoading, setTrendLoading] = useState(false);
  const [trendData, setTrendData] = useState<TrendResponse | null>(null);
  const [trendError, setTrendError] = useState('');

  // 쇼핑인사이트
  const [shoppingLoading, setShoppingLoading] = useState(false);
  const [shoppingData, setShoppingData] = useState<TrendResponse | null>(null);
  const [shoppingError, setShoppingError] = useState('');
  const [shoppingNoData, setShoppingNoData] = useState(false);

  // 콘텐츠 발행량
  const [contentLoading, setContentLoading] = useState(false);
  const [contentData, setContentData] = useState<{
    blog: number; cafe: number; total: number;
    blogHitCeiling: boolean; cafeHitCeiling: boolean;
    saturation: { blog: number; cafe: number; total: number };
    contentCompIdx: '낮음' | '중간' | '높음';
    opportunity: number;
  } | null>(null);

  // 구글 트렌드
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleData, setGoogleData] = useState<GoogleTrendsResult | null>(null);
  const [googleError, setGoogleError] = useState('');

  const inputRef = useRef<HTMLInputElement>(null);

  // ── 콘텐츠 발행량 조회 ───────────────────────────────────────────────────
  const fetchContent = useCallback(async (kw: string, monthlyTotal: number) => {
    setContentLoading(true);
    try {
      const res = await fetch(`/api/seo/naver-content?keyword=${encodeURIComponent(kw)}&monthlyTotal=${monthlyTotal}`);
      const data = await res.json();
      if (res.ok) setContentData(data);
    } catch { /* silent */ }
    finally { setContentLoading(false); }
  }, []);

  // 검색량 결과가 나오면 콘텐츠 발행량 자동 조회
  useEffect(() => {
    if (!volumeData) return;
    const mainItem = volumeData.results?.[0];
    if (!mainItem) return;
    fetchContent(volumeData.keyword, mainItem.monthlyTotal);
  }, [volumeData, fetchContent]);

  // ── 네이버 검색량 조회 ────────────────────────────────────────────────────
  const fetchVolume = useCallback(async (kw: string) => {
    setVolumeLoading(true);
    setVolumeError('');
    try {
      const res = await fetch(`/api/seo/naver-volume?keyword=${encodeURIComponent(kw)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '검색량 조회 실패');
      setVolumeData(data);
    } catch (e) { setVolumeError((e as Error).message); }
    finally { setVolumeLoading(false); }
  }, []);

  // ── 네이버 트렌드 조회 ────────────────────────────────────────────────────
  const fetchTrend = useCallback(async (kw: string) => {
    setTrendLoading(true);
    setTrendError('');
    try {
      const res = await fetch('/api/seo/naver-trend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords: [kw], period, timeUnit }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '트렌드 조회 실패');
      setTrendData(data);
    } catch (e) { setTrendError((e as Error).message); }
    finally { setTrendLoading(false); }
  }, [period, timeUnit]);

  // ── 쇼핑인사이트 조회 ────────────────────────────────────────────────────
  const fetchShopping = useCallback(async (kw: string) => {
    setShoppingLoading(true);
    setShoppingError('');
    setShoppingNoData(false);
    try {
      const res = await fetch('/api/seo/naver-shopping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords: [kw], period, timeUnit }),
      });
      const data = await res.json();
      if (!res.ok && !data.noData) throw new Error(data.error ?? '쇼핑인사이트 조회 실패');
      if (data.noData) { setShoppingNoData(true); }
      else { setShoppingData(data); }
    } catch (e) { setShoppingError((e as Error).message); }
    finally { setShoppingLoading(false); }
  }, [period, timeUnit]);

  // ── 구글 트렌드 조회 ─────────────────────────────────────────────────────
  const fetchGoogle = useCallback(async (kw?: string) => {
    setGoogleLoading(true);
    setGoogleError('');
    try {
      const url = `/api/seo/google-trends?geo=${geo}${kw ? `&keyword=${encodeURIComponent(kw)}` : ''}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Google Trends 조회 실패');
      setGoogleData(data);
    } catch (e) { setGoogleError((e as Error).message); }
    finally { setGoogleLoading(false); }
  }, [geo]);

  // ── 통합 검색 ────────────────────────────────────────────────────────────
  async function handleSearch() {
    const kw = keyword.trim();
    if (!kw) return;
    setShowAllRelated(false);
    setContentData(null);
    if (activeTab === 'naver') {
      await Promise.all([fetchVolume(kw), fetchTrend(kw)]);
    } else if (activeTab === 'shopping') {
      await Promise.all([fetchVolume(kw), fetchShopping(kw)]);
    } else {
      await fetchGoogle(kw);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleSearch();
  }

  // ── 연관 키워드로 글쓰기 이동 ────────────────────────────────────────────
  function goToWrite(kw: string, volume?: number) {
    const params = new URLSearchParams({ keyword: kw });
    if (volume) params.set('volume', String(volume));
    if (volumeData?.results) {
      const related = volumeData.results
        .filter(r => r.keyword !== kw)
        .slice(0, 8)
        .map(r => r.keyword)
        .join(',');
      if (related) params.set('related', related);
    }
    router.push(`/dashboard/blog?${params.toString()}`);
  }

  // ── 주 키워드 정보 ───────────────────────────────────────────────────────
  const mainItem = volumeData?.results.find(r => r.keyword === keyword.trim()) ?? volumeData?.results[0];
  const relatedItems = volumeData?.results.filter(r => r.keyword !== (mainItem?.keyword ?? '')) ?? [];
  const displayRelated = showAllRelated ? relatedItems : relatedItems.slice(0, 8);
  const mainTrend = trendData?.results[0];
  const mainShopping = shoppingData?.results[0];

  const isNaver = activeTab === 'naver';
  const isShopping = activeTab === 'shopping';
  const isGoogle = activeTab === 'google';

  return (
    <div className="h-full flex flex-col -m-6">
      {/* ── 헤더 ── */}
      <div className="shrink-0 px-8 pt-7 pb-5 border-b border-white/8">
        <div className="flex items-end justify-between mb-5">
          <div className="flex items-center gap-3">
            <span className="w-7 h-7 flex items-center justify-center rounded-lg shrink-0" style={{ background: 'rgba(79,142,247,0.06)', border: '1px solid rgba(79,142,247,0.22)', color: '#4f8ef7' }}>
              <BarChart2 size={13} strokeWidth={1.8} />
            </span>
            <span className="text-[19px] font-semibold text-white">키워드 리서치</span>
          </div>
        </div>

        {/* 검색 바 */}
        <div className="flex gap-3 mb-5" style={{ maxWidth: 'calc(100% - 380px)' }}>
          <div className="flex-1 flex items-center gap-3 bg-white/[0.03] border border-white/10 hover:border-white/20 focus-within:border-white/30 px-4 py-3 transition-colors">
            <Search size={15} className="text-white/25 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="키워드를 입력하세요 (예: 홈트레이닝, 다이어트 식단)"
              className="flex-1 bg-transparent outline-none text-[14px] text-white placeholder-white/20"
            />
            {keyword && (
              <button onClick={() => { setKeyword(''); setVolumeData(null); setTrendData(null); setShoppingData(null); setGoogleData(null); }} className="text-white/20 hover:text-white/50 transition-colors">
                ✕
              </button>
            )}
          </div>
          <button
            onClick={handleSearch}
            disabled={!keyword.trim() || (volumeLoading || trendLoading || shoppingLoading || googleLoading)}
            className="w-[52px] flex items-center justify-center border border-white/15 hover:border-[#4f8ef7]/50 hover:bg-[#4f8ef7]/10 disabled:border-white/8 disabled:cursor-not-allowed text-white/50 hover:text-[#4f8ef7] disabled:text-white/20 transition-all"
          >
            {(volumeLoading || trendLoading || shoppingLoading || googleLoading)
              ? <Loader2 size={15} className="animate-spin" />
              : <Search size={15} />}
          </button>
        </div>

        {/* 탭 */}
        <div className="flex gap-0 border-b border-white/5">
          {([
            { id: 'naver' as Tab,    icon: <BarChart2 size={13} />,     label: '네이버 검색량',    desc: 'DataLab + Ads' },
            { id: 'shopping' as Tab, icon: <ShoppingBag size={13} />,   label: '쇼핑인사이트',     desc: 'Naver Shopping' },
            { id: 'google' as Tab,   icon: <Globe2 size={13} />,        label: '구글 트렌드',      desc: 'Google Trends' },
          ] as const).map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 px-5 py-3 text-[12px] font-mono border-b-2 transition-colors ${
                activeTab === t.id ? 'border-[#4f8ef7] text-white' : 'border-transparent text-white/35 hover:text-white/65 hover:border-white/20'
              }`}
            >
              <span className={activeTab === t.id ? 'text-[#4f8ef7]' : 'text-white/30'}>{t.icon}</span>
              <span className="font-semibold">{t.label}</span>
              <span className={`text-[10px] ${activeTab === t.id ? 'text-white/40' : 'text-white/15'}`}>{t.desc}</span>
            </button>
          ))}

          {/* 우측: 기간 필터 */}
          <div className="ml-auto flex items-center gap-2 pb-2">
            {(isNaver || isShopping) && (
              <>
                <div className="flex items-center gap-0.5 bg-white/[0.03] border border-white/8 p-0.5">
                  {PERIOD_OPTIONS.map(p => (
                    <button key={p.value} onClick={() => setPeriod(p.value)} className={`px-2.5 py-1 text-[12px] font-medium transition-colors ${period === p.value ? 'bg-white/10 text-white' : 'text-white/45 hover:text-white/70'}`}>{p.label}</button>
                  ))}
                </div>
                <div className="flex items-center gap-0.5 bg-white/[0.03] border border-white/8 p-0.5">
                  {TIMEUNIT_OPTIONS.map(u => (
                    <button key={u.value} onClick={() => setTimeUnit(u.value)} className={`px-2.5 py-1 text-[12px] font-medium transition-colors ${timeUnit === u.value ? 'bg-white/10 text-white' : 'text-white/45 hover:text-white/70'}`}>{u.label}</button>
                  ))}
                </div>
              </>
            )}
            {isGoogle && (
              <div className="flex items-center gap-0.5 bg-white/[0.03] border border-white/8 p-0.5">
                {[{ v: 'KR', l: '한국' }, { v: 'US', l: '미국' }, { v: 'JP', l: '일본' }].map(g => (
                  <button key={g.v} onClick={() => setGeo(g.v)} className={`px-2.5 py-1 text-[12px] font-medium transition-colors ${geo === g.v ? 'bg-white/10 text-white' : 'text-white/45 hover:text-white/70'}`}>{g.l}</button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── 콘텐츠 ── */}
      <div className="flex-1 overflow-y-auto px-8 py-6">

        {/* ─── 네이버 탭 ─── */}
        {isNaver && (
          <div className="space-y-6">
            {/* 에러 */}
            {(volumeError || trendError) && (
              <div className="flex items-start gap-3 px-4 py-3 border border-red-500/20 bg-red-500/[0.04]">
                <AlertCircle size={14} className="text-red-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[12px] text-red-400/90 font-mono">{volumeError || trendError}</p>
                  {(volumeError?.includes('설정되지 않') || trendError?.includes('설정되지 않')) && (
                    <button onClick={() => router.push('/dashboard/settings?tab=api')} className="text-[11px] text-white/40 hover:text-white/70 underline mt-1 font-mono">설정 페이지 이동 →</button>
                  )}
                </div>
              </div>
            )}

            {/* 검색 전 안내 */}
            {!volumeData && !volumeLoading && !trendLoading && (
              <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
                <div className="w-16 h-16 border border-white/8 flex items-center justify-center">
                  <BarChart2 size={24} className="text-white/10" />
                </div>
                <div>
                  <p className="text-[15px] text-white/55">키워드를 입력하고 검색하세요</p>
                  <p className="text-[11px] text-white/15 font-mono mt-1">Naver Search Ads API로 실제 월간 검색량을 조회합니다</p>
                </div>
                <div className="flex flex-wrap gap-2 justify-center mt-2">
                  {['홈트레이닝', '다이어트 식단', '재테크 방법', '주식 투자', '여행 추천'].map(s => (
                    <button key={s} onClick={() => { setKeyword(s); }} className="text-[11px] font-mono px-3 py-1.5 border border-white/10 text-white/30 hover:text-white/60 hover:border-white/25 transition-colors">{s}</button>
                  ))}
                </div>
              </div>
            )}

            {/* 로딩 */}
            {(volumeLoading || trendLoading) && (
              <div className="grid grid-cols-3 gap-4">
                {[0, 1, 2].map(i => <div key={i} className="h-28 bg-white/[0.03] border border-white/6 animate-pulse" />)}
                <div className="col-span-3 h-52 bg-white/[0.03] border border-white/6 animate-pulse" />
              </div>
            )}

            {/* 결과 */}
            {mainItem && !volumeLoading && !trendLoading && (
              <>
                {/* 메인 지표 — 미니멀 수평 레이아웃 */}
                <div className="flex items-stretch border-b border-white/8">
                  {/* 총 검색량 */}
                  <div className="flex-1 px-6 py-5 border-r border-white/8">
                    <div className="flex items-center gap-2 mb-2">
                      <p className="text-[12px] font-medium text-white/50">월간 총 검색량</p>
                    </div>
                    <p className="text-[28px] font-black text-white tracking-tight leading-none">{fmt(mainItem.monthlyTotal)}</p>
                    <div className="flex gap-3 mt-2 text-[13px] text-white/50">
                      <span>PC {fmt(mainItem.monthlyPc)}</span>
                      <span className="text-white/20">·</span>
                      <span>모바일 {fmt(mainItem.monthlyMobile)}</span>
                    </div>
                    <div className="flex gap-1 mt-3">
                      {[1,2,3,4,5].map(i => (
                        <div key={i} className="flex-1 h-0.5" style={{
                          backgroundColor: i <= (
                            mainItem.monthlyTotal >= 100000 ? 5 :
                            mainItem.monthlyTotal >= 50000  ? 4 :
                            mainItem.monthlyTotal >= 10000  ? 3 :
                            mainItem.monthlyTotal >= 1000   ? 2 : 1
                          ) ? '#4f8ef7' : 'rgba(255,255,255,0.08)'
                        }} />
                      ))}
                    </div>
                  </div>

                  {/* 경쟁도 */}
                  {(() => {
                    // 광고 경쟁도(Ads API) 우선, 콘텐츠 데이터가 오면 포화도 기준도 병기
                    const compIdx = mainItem.compIdx;
                    return (
                      <div className="flex-1 px-6 py-5 border-r border-white/8">
                        <div className="flex items-center gap-2 mb-2">
                          <p className="text-[12px] font-medium text-white/50">경쟁도</p>
                          <span className="text-[9px] font-mono px-1 py-0.5" style={{
                            background: 'rgba(79,142,247,0.1)',
                            color: '#4f8ef7',
                            border: '1px solid rgba(79,142,247,0.2)',
                          }}>
                            광고 기준
                          </span>
                        </div>
                        <p className="text-[28px] font-black tracking-tight leading-none" style={{ color: COMP_COLOR[compIdx] }}>
                          {compIdx}
                        </p>
                        <p className="text-[13px] text-white/45 mt-2">
                          광고 평균 {mainItem.plAvgDepth}위
                        </p>
                        <div className="h-0.5 bg-white/8 mt-3 overflow-hidden">
                          <div className="h-full" style={{
                            width: compIdx === '높음' ? '90%' : compIdx === '중간' ? '55%' : '20%',
                            backgroundColor: COMP_COLOR[compIdx],
                            transition: 'width 0.6s ease',
                          }} />
                        </div>
                      </div>
                    );
                  })()}

                  {/* SEO 기회 점수 */}
                  {(() => {
                    // 콘텐츠 포화도 기반 점수 우선, 없으면 광고 기반 점수
                    const opp = contentData?.opportunity ?? mainItem.opportunity;
                    return (
                      <div className="flex-1 px-6 py-5">
                        <div className="flex items-center gap-2 mb-2">
                          <p className="text-[12px] font-medium text-white/50">SEO 기회 점수</p>
                          {contentData && (
                            <span className="text-[9px] font-mono px-1 py-0.5" style={{ background: 'rgba(250,204,21,0.08)', color: '#facc15', border: '1px solid rgba(250,204,21,0.2)' }}>
                              포화도 기반
                            </span>
                          )}
                        </div>
                        <p className="text-[28px] font-black tracking-tight leading-none" style={{
                          color: opp >= 70 ? '#4f8ef7' : opp >= 40 ? '#facc15' : '#f87171'
                        }}>
                          {opp}
                          <span className="text-[14px] text-white/35 ml-1">/100</span>
                        </p>
                        <p className="text-[13px] text-white/45 mt-2">
                          {opp >= 70 ? '즉시 작성 권장' : opp >= 40 ? '차별화 필요' : '롱테일 전략 권장'}
                        </p>
                        <button
                          onClick={() => goToWrite(mainItem.keyword, mainItem.monthlyTotal)}
                          className="mt-3 flex items-center gap-1.5 text-[12px] text-[#4f8ef7]/70 hover:text-[#4f8ef7] transition-colors"
                        >
                          <PenLine size={12} />이 키워드로 글쓰기 →
                        </button>
                      </div>
                    );
                  })()}
                </div>

                {/* 트렌드 차트 */}
                {mainTrend && mainTrend.data.length > 0 && (
                  <div className="border border-white/8 bg-white/[0.02] p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <TrendingUp size={13} className="text-[#4f8ef7]" />
                        <p className="text-[13px] font-semibold text-white/60">네이버 검색 트렌드</p>
                        <span className="text-[12px] text-white/40">({trendData?.startDate} ~ {trendData?.endDate})</span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] font-mono">
                        <span className="text-white/25">최고</span>
                        <span className="text-white/60">{mainTrend.peak}</span>
                        <span className="text-white/15 mx-1">·</span>
                        <span className="text-white/25">최근</span>
                        <span className="text-white/60">{mainTrend.latest}</span>
                      </div>
                    </div>
                    <TrendChart results={trendData!.results} height={160} />
                  </div>
                )}

                {/* 콘텐츠 발행량 */}
                {(contentLoading || contentData) && (
                  <div className="border border-white/8 bg-white/[0.02] p-5">
                    <div className="flex items-start justify-between gap-2 mb-4">
                      <div className="flex items-center gap-2">
                        <BarChart2 size={13} className="text-[#4f8ef7]" />
                        <p className="text-[13px] font-semibold text-white/60">콘텐츠 발행량</p>
                        <span className="text-[11px] px-1.5 py-0.5 font-mono" style={{ background: 'rgba(250,204,21,0.08)', color: '#facc15', border: '1px solid rgba(250,204,21,0.2)' }}>추정치</span>
                      </div>
                      <p className="text-[10px] font-mono text-white/20 text-right leading-relaxed shrink-0" style={{ maxWidth: 320 }}>
                        2024.08.20 네이버 발행량 API 차단으로 인해<br />게시 속도 기반 추정값입니다
                      </p>
                    </div>
                    {contentLoading ? (
                      <div className="grid grid-cols-3 gap-4">
                        {[0,1,2].map(i => <div key={i} className="h-20 bg-white/[0.03] animate-pulse rounded" />)}
                      </div>
                    ) : contentData && (
                      <div className="grid grid-cols-3 gap-4">
                        {([
                          { label: '블로그', count: contentData.blog, sat: contentData.saturation.blog, ceiling: contentData.blogHitCeiling },
                          { label: '카페',   count: contentData.cafe, sat: contentData.saturation.cafe, ceiling: contentData.cafeHitCeiling },
                          { label: '전체',   count: contentData.total, sat: contentData.saturation.total, ceiling: contentData.blogHitCeiling || contentData.cafeHitCeiling },
                        ] as { label: string; count: number; sat: number; ceiling: boolean }[]).map(({ label, count, sat, ceiling }) => {
                          const hasSat = sat > 0;
                          const cappedSat = sat >= 500;
                          const satColor = sat >= 100 ? '#ef4444' : sat >= 50 ? '#facc15' : '#4ade80';
                          const satLabel = sat >= 100 ? '매우 높음' : sat >= 50 ? '높음' : sat >= 20 ? '보통' : '낮음';
                          return (
                            <div key={label} className="border border-white/6 bg-white/[0.02] p-4 rounded-lg">
                              <p className="text-[11px] font-medium text-white/40 mb-1">{label}</p>
                              <p className="text-[22px] font-black text-white tracking-tight">
                                {ceiling && <span className="text-white/40">≥ </span>}{fmt(count)}
                              </p>
                              {hasSat ? (
                                <>
                                  <div className="flex items-center gap-1.5 mt-2">
                                    <span className="text-[11px] font-bold" style={{ color: satColor }}>
                                      {cappedSat ? '500%이상' : `${sat}%`}
                                    </span>
                                    <span className="text-[10px] text-white/30">포화</span>
                                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: `${satColor}18`, color: satColor }}>{satLabel}</span>
                                  </div>
                                  <div className="h-1 bg-white/8 rounded-full mt-2 overflow-hidden">
                                    <div className="h-full rounded-full transition-all duration-700"
                                      style={{ width: `${Math.min(sat, 100)}%`, backgroundColor: satColor }} />
                                  </div>
                                </>
                              ) : (
                                <p className="text-[10px] text-white/20 font-mono mt-2">포화도 미계산 (검색량 0)</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* 연관 키워드 테이블 */}
                {relatedItems.length > 0 && (
                  <div className="border border-white/8 bg-white/[0.02] overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/6">
                      <div className="flex items-center gap-2">
                        <Search size={12} className="text-white/30" />
                        <p className="text-[13px] font-semibold text-white/60">연관 키워드</p>
                        <span className="text-[12px] text-white/40">{relatedItems.length}개</span>
                      </div>
                      <p className="text-[12px] text-white/40">Naver Search Ads 기준</p>
                    </div>

                    {/* 테이블 헤더 */}
                    <div className="grid text-[12px] font-semibold px-5 py-3 bg-white/[0.02] border-b border-white/8 text-white/45"
                      style={{ gridTemplateColumns: '1fr 90px 90px 110px 80px 75px 110px' }}>
                      <span>키워드</span>
                      <span className="text-right">PC</span>
                      <span className="text-right">모바일</span>
                      <span className="text-right">총 검색량</span>
                      <span className="text-center">경쟁도</span>
                      <span className="text-right">기회점수</span>
                      <span className="text-right">글쓰기</span>
                    </div>

                    {/* 테이블 바디 */}
                    <div>
                      {displayRelated.map((item, idx) => (
                        <div
                          key={item.keyword}
                          className="grid items-center px-5 py-3 border-b border-white/[0.05] hover:bg-white/[0.02] transition-colors"
                          style={{ gridTemplateColumns: '1fr 90px 90px 110px 80px 75px 110px' }}
                        >
                          <div className="min-w-0 flex items-center gap-2">
                            <span className="text-[12px] text-white/30 w-5 shrink-0">{idx + 1}</span>
                            <span className="text-[13px] font-medium text-white/80 truncate">{item.keyword}</span>
                          </div>
                          <p className="text-[13px] text-white/50 text-right">{fmt(item.monthlyPc)}</p>
                          <p className="text-[13px] text-white/50 text-right">{fmt(item.monthlyMobile)}</p>
                          <p className="text-[13px] font-bold text-white/75 text-right">{fmt(item.monthlyTotal)}</p>
                          <p className="text-[13px] font-bold text-center" style={{ color: COMP_COLOR[item.compIdx] }}>{item.compIdx}</p>
                          <div className="px-1"><OpportunityBar score={item.opportunity} /></div>
                          <div className="flex justify-end">
                            <button
                              onClick={() => goToWrite(item.keyword, item.monthlyTotal)}
                              className="flex items-center gap-1.5 px-3 py-1.5 border border-white/10 hover:border-[#4f8ef7]/40 text-white/40 hover:text-[#4f8ef7] text-[12px] transition-colors"
                            >
                              <PenLine size={11} />글쓰기
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* 더보기 */}
                    {relatedItems.length > 8 && (
                      <button
                        onClick={() => setShowAllRelated(v => !v)}
                        className="w-full flex items-center justify-center gap-2 py-3 text-[13px] text-white/50 hover:text-white/60 transition-colors border-t border-white/5"
                      >
                        {showAllRelated ? <><ChevronUp size={12} />접기</> : <><ChevronDown size={12} />전체 {relatedItems.length}개 보기</>}
                      </button>
                    )}
                  </div>
                )}

                {/* 네이버 SEO 가이드 */}
                <div className="border border-[#03c75a]/15 bg-[#03c75a]/[0.02] p-5">
                  <p className="text-[11px] font-mono text-[#03c75a]/60 uppercase tracking-widest mb-3">네이버 블로그 SEO 전략</p>
                  <div className="grid grid-cols-2 gap-4 text-[11.5px] font-mono text-white/50 leading-relaxed">
                    <div className="space-y-1.5">
                      <p className="text-white/70 font-semibold text-[12px]">C-RANK (채널 신뢰도)</p>
                      <p>• 제목에 "{keyword}" 포함 필수</p>
                      <p>• 주 1~3회 정기 포스팅</p>
                      <p>• 한 카테고리 집중 운영</p>
                      <p>• 공감/댓글/스크랩 유도</p>
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-white/70 font-semibold text-[12px]">DIA (콘텐츠 품질)</p>
                      <p>• 최소 2000자 이상 작성</p>
                      <p>• 이미지 3~5장 필수 삽입</p>
                      <p>• 키워드 자연스럽게 3~5회</p>
                      <p>• 소제목으로 구조화</p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ─── 쇼핑인사이트 탭 ─── */}
        {isShopping && (
          <div className="space-y-6">
            {shoppingError && (
              <div className="flex items-start gap-3 px-4 py-3 border border-red-500/20 bg-red-500/[0.04]">
                <AlertCircle size={14} className="text-red-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[12px] text-red-400/90 font-mono">{shoppingError}</p>
                  {shoppingError.includes('설정되지 않') && (
                    <button onClick={() => router.push('/dashboard/settings')} className="text-[11px] text-white/40 hover:text-white/70 underline mt-1 font-mono">설정 페이지 이동 →</button>
                  )}
                </div>
              </div>
            )}

            {/* 검색량 카드 (쇼핑도 Naver Ads로 동일하게 표시) */}
            {mainItem && !volumeLoading && (
              <div className="flex items-stretch border-b border-white/8">
                <div className="flex-1 px-6 py-5 border-r border-white/8 space-y-1.5">
                  <p className="text-[12px] font-medium text-white/50">월간 검색량 (전체)</p>
                  <p className="text-[28px] font-black text-white">{fmt(mainItem.monthlyTotal)}</p>
                  <p className="text-[13px] text-white/50">PC {fmt(mainItem.monthlyPc)} · 모바일 {fmt(mainItem.monthlyMobile)}</p>
                </div>
                <div className="flex-1 px-6 py-5 border-r border-white/8 space-y-1.5">
                  <p className="text-[12px] font-medium text-white/50">쇼핑 경쟁도</p>
                  <p className="text-[28px] font-black" style={{ color: COMP_COLOR[mainItem.compIdx] }}>{mainItem.compIdx}</p>
                  <p className="text-[13px] text-white/45">광고 평균 {mainItem.plAvgDepth}위</p>
                </div>
                <div className="flex-1 px-6 py-5 space-y-1.5">
                  <p className="text-[12px] font-medium text-[#03c75a]/70">쇼핑 콘텐츠 전략</p>
                  <p className="text-[14px] font-medium text-white/70 leading-relaxed">
                    {mainItem.compIdx === '높음' ? '리뷰 + 비교 글로 차별화하세요.' :
                     mainItem.compIdx === '중간' ? '사용기 + 추천 글이 효과적입니다.' :
                     '지금이 공략 최적의 타이밍입니다.'}
                  </p>
                </div>
              </div>
            )}

            {/* 쇼핑 트렌드 차트 */}
            {shoppingLoading && <div className="h-52 bg-white/[0.03] border border-white/6 animate-pulse" />}

            {shoppingNoData && !shoppingLoading && (
              <div className="flex flex-col items-center justify-center py-12 gap-3 border border-white/6 bg-white/[0.01]">
                <ShoppingBag size={24} className="text-white/15" />
                <p className="text-[13px] text-white/30 font-mono">쇼핑 관련 데이터가 없는 키워드입니다</p>
                <p className="text-[11px] text-white/15 font-mono">상품명, 브랜드, 카테고리 키워드를 입력해보세요</p>
              </div>
            )}

            {mainShopping && !shoppingLoading && (
              <div className="border border-white/8 bg-white/[0.02] p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <ShoppingBag size={13} className="text-[#03c75a]" />
                    <p className="text-[13px] font-semibold text-white/70">쇼핑인사이트 트렌드</p>
                    <span className="text-[12px] text-white/35">{shoppingData?.startDate} ~ {shoppingData?.endDate}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[13px]">
                    <span className="text-white/40">최고</span>
                    <span className="text-white/70 font-bold">{mainShopping.peak}</span>
                    <span className="text-white/20 mx-1">·</span>
                    <span className="text-white/40">최근</span>
                    <span className="text-white/70 font-bold">{mainShopping.latest}</span>
                  </div>
                </div>
                <TrendChart results={shoppingData!.results} height={160} />
                <p className="text-[12px] text-white/35 mt-3">* 쇼핑인사이트: 네이버 쇼핑 탭 내 검색 비율 (최고값=100 기준)</p>
              </div>
            )}

            {!keyword && !shoppingLoading && !mainShopping && (
              <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
                <div className="w-16 h-16 border border-white/8 flex items-center justify-center">
                  <ShoppingBag size={24} className="text-white/15" />
                </div>
                <p className="text-[14px] text-white/50">쇼핑 관련 키워드를 입력하세요</p>
                <p className="text-[13px] text-white/35">상품명, 카테고리, 브랜드 키워드에 특화된 데이터입니다</p>
              </div>
            )}
          </div>
        )}

        {/* ─── 구글 트렌드 탭 ─── */}
        {isGoogle && (
          <div className="space-y-6">
            {googleError && (
              <div className="flex items-start gap-3 px-4 py-3 border border-red-500/20 bg-red-500/[0.04]">
                <AlertCircle size={14} className="text-red-400 mt-0.5 shrink-0" />
                <p className="text-[12px] text-red-400/90 font-mono">{googleError}</p>
              </div>
            )}

            {googleLoading && (
              <div className="grid grid-cols-2 gap-4">
                <div className="h-96 bg-white/[0.03] border border-white/6 animate-pulse" />
                <div className="h-96 bg-white/[0.03] border border-white/6 animate-pulse" />
              </div>
            )}

            {!googleData && !googleLoading && (
              <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
                <div className="w-16 h-16 border border-white/8 flex items-center justify-center">
                  <Globe2 size={24} className="text-white/10" />
                </div>
                <div>
                  <p className="text-[15px] text-white/55">키워드를 입력하거나 검색하세요</p>
                  <p className="text-[11px] text-white/15 font-mono mt-1">구글 급상승 검색어 및 연관 키워드를 조회합니다</p>
                </div>
                <button onClick={() => fetchGoogle()} className="flex items-center gap-2 text-[12px] font-mono text-white/30 hover:text-white/60 border border-white/10 hover:border-white/25 px-4 py-2 transition-colors">
                  <RefreshCw size={12} />오늘의 급상승 검색어 보기
                </button>
              </div>
            )}

            {googleData && !googleLoading && (
              <div className="grid grid-cols-[1fr_360px] gap-5">
                {/* 급상승 검색어 */}
                <div className="border border-white/8 bg-white/[0.02] overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/6">
                    <div className="flex items-center gap-2">
                      <TrendingUp size={12} className="text-[#4285f4]" />
                      <p className="text-[13px] font-semibold text-white/60">오늘의 급상승 검색어</p>
                      <span className="text-[12px] text-white/40">{googleData.geo}</span>
                    </div>
                    <button onClick={() => fetchGoogle(keyword.trim() || undefined)} className="flex items-center gap-1 text-[12px] text-white/45 hover:text-white/50 transition-colors">
                      <RefreshCw size={10} />새로고침
                    </button>
                  </div>
                  <div className="divide-y divide-white/[0.04]">
                    {googleData.daily.slice(0, 15).map((item, i) => (
                      <div key={i} className="flex items-start gap-4 px-5 py-3 hover:bg-white/[0.02] transition-colors group">
                        <span className="text-[12px] text-white/40 w-5 shrink-0 mt-0.5">{i + 1}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-[14px] font-medium text-white/85 group-hover:text-white transition-colors">{item.title}</p>
                            {item.traffic && <span className="text-[10px] font-mono text-[#4285f4]/60 bg-[#4285f4]/8 px-1.5 py-0.5">{item.traffic}</span>}
                          </div>
                          {item.articles.length > 0 && (
                            <p className="text-[12px] text-white/45 truncate">{item.articles[0].title}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => { setKeyword(item.title); goToWrite(item.title); }}
                            className="opacity-0 group-hover:opacity-100 flex items-center gap-1 px-2 py-1 border border-white/10 hover:border-[#4f8ef7]/40 text-white/30 hover:text-[#4f8ef7] text-[10px] font-mono transition-all"
                          >
                            <PenLine size={10} />글쓰기
                          </button>
                        </div>
                      </div>
                    ))}
                    {googleData.daily.length === 0 && (
                      <div className="px-5 py-8 text-center text-[12px] font-mono text-white/25">데이터를 불러올 수 없습니다</div>
                    )}
                  </div>
                </div>

                {/* 연관 검색어 (키워드 입력 시) */}
                <div className="space-y-4">
                  {googleData.related && (
                    <>
                      {/* 급상승 */}
                      {googleData.related.rising.length > 0 && (
                        <div className="border border-white/8 bg-white/[0.02] overflow-hidden">
                          <div className="flex items-center gap-2 px-4 py-3 border-b border-white/6">
                            <ArrowUpRight size={12} className="text-[#4285f4]" />
                            <p className="text-[13px] font-semibold text-white/60">급상승 연관어</p>
                          </div>
                          <div className="p-3 space-y-1">
                            {googleData.related.rising.map((item, i) => (
                              <button
                                key={i}
                                onClick={() => { setKeyword(item.query); }}
                                className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/[0.04] transition-colors group"
                              >
                                <span className="text-[12px] font-mono text-white/60 group-hover:text-white">{item.query}</span>
                                <span className="text-[10px] font-mono text-[#4285f4]/60">
                                  {item.value >= 5000 ? 'Breakout' : `+${item.value}%`}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 상위 */}
                      {googleData.related.top.length > 0 && (
                        <div className="border border-white/8 bg-white/[0.02] overflow-hidden">
                          <div className="flex items-center gap-2 px-4 py-3 border-b border-white/6">
                            <BarChart2 size={12} className="text-white/30" />
                            <p className="text-[13px] font-semibold text-white/60">상위 연관 검색어</p>
                          </div>
                          <div className="p-3 space-y-1">
                            {googleData.related.top.map((item, i) => (
                              <button
                                key={i}
                                onClick={() => { setKeyword(item.query); }}
                                className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/[0.04] transition-colors group"
                              >
                                <span className="text-[12px] font-mono text-white/60 group-hover:text-white">{item.query}</span>
                                <div className="flex items-center gap-2">
                                  <div className="w-16 h-1 bg-white/8 rounded-full overflow-hidden">
                                    <div className="h-full bg-white/25 rounded-full" style={{ width: `${item.value}%` }} />
                                  </div>
                                  <span className="text-[10px] font-mono text-white/30 w-8 text-right">{item.value}</span>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* 연관어 없을 때 안내 */}
                  {(!googleData.related || (googleData.related.rising.length === 0 && googleData.related.top.length === 0)) && (
                    <div className="border border-white/8 bg-white/[0.02] p-4 space-y-3">
                      <p className="text-[12px] font-semibold text-white/50">연관 검색어 조회</p>
                      <p className="text-[12px] text-white/35 leading-relaxed">
                        Google Trends 연관어는 키워드 검색 후 표시됩니다.<br />
                        Railway 서버 IP를 Google이 차단하는 경우 빈 결과가 반환될 수 있습니다.
                      </p>
                      {keyword.trim() && (
                        <button
                          onClick={() => fetchGoogle(keyword.trim())}
                          className="flex items-center gap-1.5 text-[12px] text-white/40 hover:text-white/60 border border-white/10 hover:border-white/25 px-3 py-1.5 transition-colors"
                        >
                          <RefreshCw size={11} />다시 시도
                        </button>
                      )}
                    </div>
                  )}

                  {/* 구글 SEO 가이드 */}
                  <div className="border border-[#4285f4]/15 bg-[#4285f4]/[0.02] p-4">
                    <p className="text-[12px] font-semibold text-[#4285f4]/60 mb-3">구글 SEO 전략</p>
                    <div className="space-y-1.5 text-[13px] text-white/55 leading-relaxed">
                      <p>• 제목에 키워드 앞부분 배치</p>
                      <p>• H2/H3 소제목에 연관어 포함</p>
                      <p>• FAQ 섹션으로 Featured Snippet 겨냥</p>
                      <p>• 최소 1500자, 경쟁키워드 2500자+</p>
                      <p>• E-E-A-T: 경험·전문성·권위·신뢰</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
