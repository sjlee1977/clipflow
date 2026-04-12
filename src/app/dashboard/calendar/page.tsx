'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Plus, X, Wand2, Loader2, PenLine, BookOpen, ExternalLink, Trash2, CheckCircle2, Clock, Lightbulb, Edit3 } from 'lucide-react';

// ─── 타입 ───────────────────────────────────────────────────────
type ContentType = 'video' | 'short' | 'blog' | 'carousel' | 'reel' | 'thread';
type Platform = 'youtube' | 'instagram' | 'tiktok' | 'blog' | 'linkedin' | 'twitter';
type PlanStatus = 'idea' | 'writing' | 'editing' | 'scheduled' | 'published';

type ContentPlan = {
  id: string;
  title: string;
  content_type: ContentType;
  platform: Platform;
  status: PlanStatus;
  scheduled_at: string;
  series_id?: string;
  episode_number?: number;
  source_trend_title?: string;
  source_trend_url?: string;
  notes?: string;
  content_series?: { title: string };
};

type SeriesEpisode = {
  episode_number: number;
  title: string;
  description: string;
  keywords: string[];
};

type ContentSeries = {
  id: string;
  title: string;
  topic: string;
  description?: string;
  episode_count: number;
  episodes: SeriesEpisode[];
  status: 'planning' | 'in_progress' | 'completed';
  created_at: string;
  content_plans?: ContentPlan[];
};

// ─── 상수 ───────────────────────────────────────────────────────
const TYPE_CONFIG: Record<ContentType, { label: string; color: string; bg: string; border: string }> = {
  video:    { label: '영상',   color: '#3b82f6', bg: 'rgba(59,130,246,0.15)',  border: 'rgba(59,130,246,0.4)' },
  short:    { label: '쇼츠',   color: '#22c55e', bg: 'rgba(34,197,94,0.15)',   border: 'rgba(34,197,94,0.4)' },
  blog:     { label: '블로그', color: '#a855f7', bg: 'rgba(168,85,247,0.15)',  border: 'rgba(168,85,247,0.4)' },
  carousel: { label: '캐러셀', color: '#f97316', bg: 'rgba(249,115,22,0.15)',  border: 'rgba(249,115,22,0.4)' },
  reel:     { label: '릴스',   color: '#ec4899', bg: 'rgba(236,72,153,0.15)',  border: 'rgba(236,72,153,0.4)' },
  thread:   { label: '스레드', color: '#8b5cf6', bg: 'rgba(139,92,246,0.15)', border: 'rgba(139,92,246,0.4)' },
};

const STATUS_CONFIG: Record<PlanStatus, { label: string; icon: React.ReactNode; color: string }> = {
  idea:      { label: '아이디어', icon: <Lightbulb size={10} />,    color: 'text-white/40' },
  writing:   { label: '작성 중',  icon: <PenLine size={10} />,      color: 'text-yellow-400/70' },
  editing:   { label: '편집 중',  icon: <Edit3 size={10} />,        color: 'text-blue-400/70' },
  scheduled: { label: '예약됨',   icon: <Clock size={10} />,        color: 'text-[#22c55e]/70' },
  published: { label: '발행됨',   icon: <CheckCircle2 size={10} />, color: 'text-[#22c55e]' },
};

const PLATFORM_ICONS: Record<Platform, string> = {
  youtube: '▶', instagram: '◈', tiktok: '♪', blog: '✎', linkedin: 'in', twitter: '✕',
};

const DAYS_OF_WEEK = ['일', '월', '화', '수', '목', '금', '토'];

// ─── 메인 컴포넌트 ──────────────────────────────────────────────
export default function CalendarPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth() + 1);
  const [plans, setPlans] = useState<ContentPlan[]>([]);
  const [series, setSeries] = useState<ContentSeries[]>([]);
  const [loading, setLoading] = useState(true);

  // 선택된 날짜 & 패널 상태
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<'day' | 'series' | 'new-plan' | 'new-series'>('day');

  // 새 계획 폼
  const [newPlan, setNewPlan] = useState({
    title: '', content_type: 'video' as ContentType, platform: 'youtube' as Platform,
    status: 'idea' as PlanStatus, notes: '', series_id: '', episode_number: 0,
    source_trend_title: '', source_trend_url: '',
  });

  // 새 시리즈 폼
  const [newSeries, setNewSeries] = useState({ title: '', topic: '', description: '', episode_count: 5 });
  const [generatingOutline, setGeneratingOutline] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);
  const [savingSeries, setSavingSeries] = useState(false);

  // URL params에서 트렌드 정보 읽기
  useEffect(() => {
    const trendTitle = searchParams.get('title');
    const trendUrl = searchParams.get('trendUrl');
    if (trendTitle) {
      setNewPlan(p => ({ ...p, title: trendTitle, source_trend_title: trendTitle, source_trend_url: trendUrl ?? '' }));
      setActivePanel('new-plan');
      setSelectedDate(today.toISOString().split('T')[0]);
    }
  }, [searchParams]);

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    const [plansRes, seriesRes] = await Promise.all([
      fetch(`/api/calendar/plans?year=${viewYear}&month=${viewMonth}`),
      fetch('/api/calendar/series'),
    ]);
    const plansData = await plansRes.json();
    const seriesData = await seriesRes.json();
    setPlans(plansData.plans ?? []);
    setSeries(seriesData.series ?? []);
    setLoading(false);
  }, [viewYear, viewMonth]);

  useEffect(() => { fetchPlans(); }, [fetchPlans]);

  // ─── 캘린더 날짜 계산 ────────────────────────────────────────
  const firstDay = new Date(viewYear, viewMonth - 1, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;

  const plansByDate = plans.reduce<Record<string, ContentPlan[]>>((acc, p) => {
    if (p.scheduled_at) {
      acc[p.scheduled_at] = [...(acc[p.scheduled_at] ?? []), p];
    }
    return acc;
  }, {});

  function prevMonth() {
    if (viewMonth === 1) { setViewYear(y => y - 1); setViewMonth(12); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 12) { setViewYear(y => y + 1); setViewMonth(1); }
    else setViewMonth(m => m + 1);
  }

  function formatDate(y: number, m: number, d: number) {
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  function handleDayClick(dateStr: string) {
    setSelectedDate(dateStr);
    setActivePanel('day');
  }

  // ─── 계획 저장 ────────────────────────────────────────────────
  async function handleSavePlan() {
    if (!newPlan.title.trim() || !selectedDate) return;
    setSavingPlan(true);
    const res = await fetch('/api/calendar/plans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newPlan, scheduled_at: selectedDate }),
    });
    if (res.ok) {
      await fetchPlans();
      setNewPlan({ title: '', content_type: 'video', platform: 'youtube', status: 'idea', notes: '', series_id: '', episode_number: 0, source_trend_title: '', source_trend_url: '' });
      setActivePanel('day');
    }
    setSavingPlan(false);
  }

  // ─── 계획 삭제 ────────────────────────────────────────────────
  async function handleDeletePlan(id: string) {
    await fetch('/api/calendar/plans', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    setPlans(prev => prev.filter(p => p.id !== id));
  }

  // ─── 상태 업데이트 ────────────────────────────────────────────
  async function handleUpdateStatus(id: string, status: PlanStatus) {
    await fetch('/api/calendar/plans', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) });
    setPlans(prev => prev.map(p => p.id === id ? { ...p, status } : p));
  }

  // ─── 시리즈 저장 ─────────────────────────────────────────────
  async function handleSaveSeries() {
    if (!newSeries.title.trim() || !newSeries.topic.trim()) return;
    setSavingSeries(true);
    setGeneratingOutline(true);
    const res = await fetch('/api/calendar/series', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newSeries, generateOutline: true }),
    });
    setGeneratingOutline(false);
    if (res.ok) {
      await fetchPlans();
      setNewSeries({ title: '', topic: '', description: '', episode_count: 5 });
      setActivePanel('series');
    }
    setSavingSeries(false);
  }

  // ─── 시리즈 삭제 ─────────────────────────────────────────────
  async function handleDeleteSeries(id: string) {
    if (!confirm('시리즈를 삭제하시겠습니까? 연결된 콘텐츠 계획은 유지됩니다.')) return;
    await fetch('/api/calendar/series', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    setSeries(prev => prev.filter(s => s.id !== id));
  }

  // ─── 시리즈 에피소드 → 캘린더에 일괄 추가 ───────────────────
  async function handleAddEpisodesToCalendar(s: ContentSeries) {
    if (!s.episodes?.length) return;
    const startDate = new Date();
    await Promise.all(
      s.episodes.map(async (ep, i) => {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i * 7); // 1주 간격
        await fetch('/api/calendar/plans', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: ep.title,
            content_type: 'video',
            platform: 'youtube',
            status: 'idea',
            scheduled_at: d.toISOString().split('T')[0],
            series_id: s.id,
            episode_number: ep.episode_number,
            notes: ep.description,
          }),
        });
      })
    );
    await fetchPlans();
  }

  const selectedDayPlans = selectedDate ? (plansByDate[selectedDate] ?? []) : [];

  return (
    <div className="max-w-[1400px] mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="w-1 h-7 bg-[#22c55e]" />
          <div>
            <h1 className="text-[18px] font-black tracking-tight text-white uppercase">콘텐츠 캘린더</h1>
            <p className="text-[11px] text-white/30 font-mono tracking-widest mt-0.5">CONTENT CALENDAR & SERIES</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* 범례 */}
          {(Object.entries(TYPE_CONFIG) as [ContentType, typeof TYPE_CONFIG[ContentType]][]).map(([type, cfg]) => (
            <div key={type} className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cfg.color }} />
              <span className="text-[10px] font-mono text-white/30">{cfg.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-5">
        {/* ─── 캘린더 ─────────────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          {/* 월 네비게이션 */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <button onClick={prevMonth} className="w-7 h-7 flex items-center justify-center rounded-lg border border-white/10 hover:border-white/25 text-white/50 hover:text-white/80 transition-colors">
                <ChevronLeft size={14} />
              </button>
              <h2 className="text-[16px] font-black text-white w-32 text-center">
                {viewYear}년 {viewMonth}월
              </h2>
              <button onClick={nextMonth} className="w-7 h-7 flex items-center justify-center rounded-lg border border-white/10 hover:border-white/25 text-white/50 hover:text-white/80 transition-colors">
                <ChevronRight size={14} />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setSelectedDate(today.toISOString().split('T')[0]); setActivePanel('new-plan'); }}
                className="flex items-center gap-1.5 bg-[#22c55e] hover:bg-[#16a34a] text-black font-black text-[12px] px-3 py-1.5 rounded-lg transition-colors"
              >
                <Plus size={13} />콘텐츠 추가
              </button>
              <button
                onClick={() => setActivePanel('new-series')}
                className="flex items-center gap-1.5 border border-white/15 hover:border-white/30 text-white/60 hover:text-white text-[12px] font-bold px-3 py-1.5 rounded-lg transition-colors"
              >
                <BookOpen size={13} />시리즈 기획
              </button>
              <button
                onClick={() => setActivePanel('series')}
                className="flex items-center gap-1.5 border border-white/10 text-white/40 hover:text-white/70 text-[12px] font-mono px-3 py-1.5 rounded-lg transition-colors"
              >
                내 시리즈 {series.length > 0 && <span className="bg-white/10 rounded-full px-1.5 py-0.5 text-[10px]">{series.length}</span>}
              </button>
            </div>
          </div>

          {/* 요일 헤더 */}
          <div className="grid grid-cols-7 mb-1">
            {DAYS_OF_WEEK.map((d, i) => (
              <div key={d} className={`text-center py-2 text-[11px] font-bold font-mono ${i === 0 ? 'text-red-400/60' : i === 6 ? 'text-blue-400/60' : 'text-white/30'}`}>
                {d}
              </div>
            ))}
          </div>

          {/* 날짜 그리드 */}
          {loading ? (
            <div className="h-[480px] flex items-center justify-center text-white/20">
              <Loader2 size={20} className="animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-px bg-white/5 rounded-xl overflow-hidden border border-white/8">
              {Array.from({ length: totalCells }).map((_, cellIdx) => {
                const dayNum = cellIdx - firstDay + 1;
                const isCurrentMonth = dayNum >= 1 && dayNum <= daysInMonth;
                const dateStr = isCurrentMonth ? formatDate(viewYear, viewMonth, dayNum) : '';
                const isToday = dateStr === today.toISOString().split('T')[0];
                const isSelected = dateStr === selectedDate;
                const dayPlans = dateStr ? (plansByDate[dateStr] ?? []) : [];
                const isWeekend = cellIdx % 7 === 0 || cellIdx % 7 === 6;

                return (
                  <div
                    key={cellIdx}
                    onClick={() => isCurrentMonth && handleDayClick(dateStr)}
                    className={`min-h-[90px] p-1.5 transition-colors cursor-pointer ${
                      isCurrentMonth ? 'bg-[#0d0d0d] hover:bg-white/[0.04]' : 'bg-black/20'
                    } ${isSelected ? 'ring-1 ring-inset ring-[#22c55e]/50' : ''}`}
                  >
                    {isCurrentMonth && (
                      <>
                        <div className={`text-[12px] font-bold w-6 h-6 flex items-center justify-center rounded-full mb-1 ${
                          isToday ? 'bg-[#22c55e] text-black' : isWeekend ? (cellIdx % 7 === 0 ? 'text-red-400/60' : 'text-blue-400/60') : 'text-white/50'
                        }`}>
                          {dayNum}
                        </div>
                        <div className="space-y-0.5">
                          {dayPlans.slice(0, 3).map(plan => {
                            const cfg = TYPE_CONFIG[plan.content_type];
                            return (
                              <div
                                key={plan.id}
                                className="text-[9px] font-bold px-1 py-0.5 rounded truncate"
                                style={{ backgroundColor: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
                              >
                                {PLATFORM_ICONS[plan.platform]} {plan.title}
                              </div>
                            );
                          })}
                          {dayPlans.length > 3 && (
                            <div className="text-[9px] font-mono text-white/30 pl-1">+{dayPlans.length - 3}개 더</div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* 이번 달 통계 */}
          <div className="mt-4 flex items-center gap-4">
            {(Object.keys(TYPE_CONFIG) as ContentType[]).map(type => {
              const count = plans.filter(p => p.content_type === type).length;
              if (count === 0) return null;
              const cfg = TYPE_CONFIG[type];
              return (
                <div key={type} className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cfg.color }} />
                  <span className="text-[11px] font-mono text-white/40">{cfg.label} {count}</span>
                </div>
              );
            })}
            <div className="ml-auto flex items-center gap-4">
              {(['idea', 'writing', 'scheduled', 'published'] as PlanStatus[]).map(st => {
                const count = plans.filter(p => p.status === st).length;
                if (count === 0) return null;
                const cfg = STATUS_CONFIG[st];
                return (
                  <div key={st} className={`flex items-center gap-1 text-[11px] font-mono ${cfg.color}`}>
                    {cfg.icon} {cfg.label} {count}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ─── 우측 패널 ───────────────────────────────────────── */}
        <div className="w-[320px] shrink-0 space-y-3">
          {/* 날짜 상세 */}
          {activePanel === 'day' && (
            <div className="rounded-xl border border-white/8 bg-white/[0.02] overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/6">
                <p className="text-[13px] font-bold text-white">
                  {selectedDate
                    ? new Date(selectedDate + 'T00:00:00').toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })
                    : '날짜를 선택하세요'}
                </p>
                {selectedDate && (
                  <button
                    onClick={() => setActivePanel('new-plan')}
                    className="flex items-center gap-1 text-[11px] font-mono text-[#22c55e]/70 hover:text-[#22c55e] transition-colors"
                  >
                    <Plus size={11} />추가
                  </button>
                )}
              </div>
              {selectedDayPlans.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <p className="text-[12px] text-white/20 font-mono">예정된 콘텐츠가 없습니다</p>
                  {selectedDate && (
                    <button
                      onClick={() => setActivePanel('new-plan')}
                      className="text-[11px] text-[#22c55e]/40 hover:text-[#22c55e] transition-colors mt-2 block mx-auto font-mono"
                    >
                      + 콘텐츠 추가
                    </button>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {selectedDayPlans.map(plan => {
                    const typeCfg = TYPE_CONFIG[plan.content_type];
                    const statusCfg = STATUS_CONFIG[plan.status];
                    return (
                      <div key={plan.id} className="px-4 py-3 group">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0" style={{ backgroundColor: typeCfg.bg, color: typeCfg.color }}>
                              {typeCfg.label}
                            </span>
                            <span className="text-[13px] font-bold text-white/90 truncate">{plan.title}</span>
                          </div>
                          <button
                            onClick={() => handleDeletePlan(plan.id)}
                            className="opacity-0 group-hover:opacity-100 text-red-400/40 hover:text-red-400 transition-all shrink-0"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className={`flex items-center gap-1 text-[10px] font-mono ${statusCfg.color}`}>
                            {statusCfg.icon}
                            <span>{statusCfg.label}</span>
                          </div>
                          {/* 상태 변경 드롭다운 */}
                          <select
                            value={plan.status}
                            onChange={e => handleUpdateStatus(plan.id, e.target.value as PlanStatus)}
                            className="text-[10px] font-mono bg-white/5 border border-white/10 text-white/50 rounded px-1.5 py-0.5 outline-none cursor-pointer"
                          >
                            {(Object.entries(STATUS_CONFIG) as [PlanStatus, typeof STATUS_CONFIG[PlanStatus]][]).map(([s, cfg]) => (
                              <option key={s} value={s}>{cfg.label}</option>
                            ))}
                          </select>
                        </div>
                        {plan.source_trend_title && (
                          <div className="flex items-center gap-1 mt-1.5">
                            <span className="text-[9px] font-mono text-white/20">트렌드:</span>
                            <span className="text-[9px] font-mono text-[#22c55e]/50 truncate">{plan.source_trend_title}</span>
                          </div>
                        )}
                        {plan.content_series && (
                          <div className="text-[9px] font-mono text-white/25 mt-1">
                            📚 {plan.content_series.title} {plan.episode_number ? `EP.${plan.episode_number}` : ''}
                          </div>
                        )}
                        {/* 빠른 액션 */}
                        <div className="flex items-center gap-1.5 mt-2">
                          <button
                            onClick={() => { const params = new URLSearchParams({ topic: plan.title }); router.push(`/dashboard/script?${params}`); }}
                            className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded border border-white/10 text-white/40 hover:text-white/70 transition-colors"
                          >
                            <PenLine size={9} />대본
                          </button>
                          {plan.source_trend_url && (
                            <a href={plan.source_trend_url} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded border border-white/10 text-white/40 hover:text-white/70 transition-colors"
                            >
                              <ExternalLink size={9} />원본
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 새 계획 추가 */}
          {activePanel === 'new-plan' && (
            <div className="rounded-xl border border-white/8 bg-white/[0.02] overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/6">
                <p className="text-[13px] font-bold text-white">콘텐츠 추가</p>
                <button onClick={() => setActivePanel('day')} className="text-white/30 hover:text-white/70"><X size={14} /></button>
              </div>
              <div className="px-4 py-4 space-y-3">
                <div>
                  <p className="text-[10px] font-mono text-white/30 mb-1 uppercase tracking-wider">날짜</p>
                  <input
                    type="date"
                    value={selectedDate ?? ''}
                    onChange={e => setSelectedDate(e.target.value)}
                    className="w-full bg-white/[0.03] border border-white/8 rounded-lg px-3 py-1.5 text-[12px] text-white/70 font-mono outline-none focus:border-[#22c55e]/40"
                  />
                </div>
                <div>
                  <p className="text-[10px] font-mono text-white/30 mb-1 uppercase tracking-wider">제목</p>
                  <input
                    type="text"
                    value={newPlan.title}
                    onChange={e => setNewPlan(p => ({ ...p, title: e.target.value }))}
                    placeholder="콘텐츠 제목..."
                    className="w-full bg-white/[0.03] border border-white/8 rounded-lg px-3 py-1.5 text-[12px] text-white/80 outline-none focus:border-[#22c55e]/40 placeholder-white/20"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[10px] font-mono text-white/30 mb-1 uppercase tracking-wider">유형</p>
                    <select
                      value={newPlan.content_type}
                      onChange={e => setNewPlan(p => ({ ...p, content_type: e.target.value as ContentType }))}
                      className="w-full bg-white/[0.03] border border-white/8 rounded-lg px-2 py-1.5 text-[12px] text-white/70 font-mono outline-none focus:border-[#22c55e]/40"
                    >
                      {(Object.entries(TYPE_CONFIG) as [ContentType, typeof TYPE_CONFIG[ContentType]][]).map(([t, c]) => (
                        <option key={t} value={t}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <p className="text-[10px] font-mono text-white/30 mb-1 uppercase tracking-wider">플랫폼</p>
                    <select
                      value={newPlan.platform}
                      onChange={e => setNewPlan(p => ({ ...p, platform: e.target.value as Platform }))}
                      className="w-full bg-white/[0.03] border border-white/8 rounded-lg px-2 py-1.5 text-[12px] text-white/70 font-mono outline-none focus:border-[#22c55e]/40"
                    >
                      {(Object.keys(PLATFORM_ICONS) as Platform[]).map(pl => (
                        <option key={pl} value={pl}>{pl}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {series.length > 0 && (
                  <div>
                    <p className="text-[10px] font-mono text-white/30 mb-1 uppercase tracking-wider">시리즈 (선택)</p>
                    <select
                      value={newPlan.series_id}
                      onChange={e => setNewPlan(p => ({ ...p, series_id: e.target.value }))}
                      className="w-full bg-white/[0.03] border border-white/8 rounded-lg px-2 py-1.5 text-[12px] text-white/70 font-mono outline-none focus:border-[#22c55e]/40"
                    >
                      <option value="">없음</option>
                      {series.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <p className="text-[10px] font-mono text-white/30 mb-1 uppercase tracking-wider">메모</p>
                  <textarea
                    value={newPlan.notes}
                    onChange={e => setNewPlan(p => ({ ...p, notes: e.target.value }))}
                    placeholder="키워드, 레퍼런스..."
                    rows={2}
                    className="w-full bg-white/[0.03] border border-white/8 rounded-lg px-3 py-1.5 text-[12px] text-white/70 font-mono outline-none resize-none focus:border-[#22c55e]/40 placeholder-white/20"
                  />
                </div>
                <button
                  onClick={handleSavePlan}
                  disabled={savingPlan || !newPlan.title.trim()}
                  className="w-full bg-[#22c55e] hover:bg-[#16a34a] disabled:opacity-40 text-black font-black text-[12px] uppercase py-2 rounded-lg transition-colors"
                >
                  {savingPlan ? <Loader2 size={13} className="animate-spin inline" /> : '저장'}
                </button>
              </div>
            </div>
          )}

          {/* 시리즈 목록 */}
          {activePanel === 'series' && (
            <div className="rounded-xl border border-white/8 bg-white/[0.02] overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/6">
                <p className="text-[13px] font-bold text-white">내 시리즈</p>
                <button
                  onClick={() => setActivePanel('new-series')}
                  className="flex items-center gap-1 text-[11px] font-mono text-[#22c55e]/70 hover:text-[#22c55e] transition-colors"
                >
                  <Plus size={11} />새 시리즈
                </button>
              </div>
              {series.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <p className="text-[12px] text-white/20 font-mono">시리즈가 없습니다</p>
                  <button onClick={() => setActivePanel('new-series')} className="text-[11px] text-[#22c55e]/40 hover:text-[#22c55e] mt-2 block mx-auto font-mono transition-colors">
                    + 시리즈 기획
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-white/5 max-h-[600px] overflow-y-auto">
                  {series.map(s => {
                    const publishedCount = s.content_plans?.filter(p => p.status === 'published').length ?? 0;
                    const totalEp = s.episode_count;
                    const progress = totalEp > 0 ? Math.round((publishedCount / totalEp) * 100) : 0;
                    return (
                      <div key={s.id} className="px-4 py-3 group">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div>
                            <p className="text-[13px] font-bold text-white/90">{s.title}</p>
                            <p className="text-[10px] font-mono text-white/30 mt-0.5">{s.topic} · {totalEp}편</p>
                          </div>
                          <button
                            onClick={() => handleDeleteSeries(s.id)}
                            className="opacity-0 group-hover:opacity-100 text-red-400/40 hover:text-red-400 transition-all"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                        {/* 진행 바 */}
                        <div className="mb-2">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[9px] font-mono text-white/25">{publishedCount}/{totalEp} 발행</span>
                            <span className="text-[9px] font-mono text-white/25">{progress}%</span>
                          </div>
                          <div className="h-1 bg-white/8 rounded-full overflow-hidden">
                            <div className="h-full bg-[#22c55e] rounded-full transition-all" style={{ width: `${progress}%` }} />
                          </div>
                        </div>
                        {/* 에피소드 목록 */}
                        {s.episodes?.length > 0 && (
                          <div className="space-y-1 mb-2">
                            {s.episodes.slice(0, 3).map(ep => (
                              <div key={ep.episode_number} className="text-[10px] font-mono text-white/40 flex items-start gap-1.5">
                                <span className="text-[#22c55e]/50 shrink-0">EP.{ep.episode_number}</span>
                                <span className="truncate">{ep.title}</span>
                              </div>
                            ))}
                            {s.episodes.length > 3 && (
                              <p className="text-[9px] font-mono text-white/20">+{s.episodes.length - 3}개 더...</p>
                            )}
                          </div>
                        )}
                        <button
                          onClick={() => handleAddEpisodesToCalendar(s)}
                          className="w-full text-[10px] font-mono py-1 rounded border border-white/10 text-white/40 hover:text-white/70 hover:border-white/25 transition-colors"
                        >
                          캘린더에 일정 추가
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 새 시리즈 */}
          {activePanel === 'new-series' && (
            <div className="rounded-xl border border-white/8 bg-white/[0.02] overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/6">
                <div className="flex items-center gap-2">
                  <Wand2 size={13} className="text-[#22c55e]/70" />
                  <p className="text-[13px] font-bold text-white">AI 시리즈 기획</p>
                </div>
                <button onClick={() => setActivePanel('series')} className="text-white/30 hover:text-white/70"><X size={14} /></button>
              </div>
              <div className="px-4 py-4 space-y-3">
                <div>
                  <p className="text-[10px] font-mono text-white/30 mb-1 uppercase tracking-wider">시리즈명</p>
                  <input
                    type="text"
                    value={newSeries.title}
                    onChange={e => setNewSeries(s => ({ ...s, title: e.target.value }))}
                    placeholder="예: AI 툴 완전 정복 시리즈"
                    className="w-full bg-white/[0.03] border border-white/8 rounded-lg px-3 py-1.5 text-[12px] text-white/80 outline-none focus:border-[#22c55e]/40 placeholder-white/20"
                  />
                </div>
                <div>
                  <p className="text-[10px] font-mono text-white/30 mb-1 uppercase tracking-wider">핵심 주제</p>
                  <input
                    type="text"
                    value={newSeries.topic}
                    onChange={e => setNewSeries(s => ({ ...s, topic: e.target.value }))}
                    placeholder="예: 직장인을 위한 AI 생산성 툴"
                    className="w-full bg-white/[0.03] border border-white/8 rounded-lg px-3 py-1.5 text-[12px] text-white/80 outline-none focus:border-[#22c55e]/40 placeholder-white/20"
                  />
                </div>
                <div>
                  <p className="text-[10px] font-mono text-white/30 mb-1 uppercase tracking-wider">설명 (선택)</p>
                  <textarea
                    value={newSeries.description}
                    onChange={e => setNewSeries(s => ({ ...s, description: e.target.value }))}
                    placeholder="타겟 시청자, 차별화 포인트..."
                    rows={2}
                    className="w-full bg-white/[0.03] border border-white/8 rounded-lg px-3 py-1.5 text-[12px] text-white/70 font-mono outline-none resize-none focus:border-[#22c55e]/40 placeholder-white/20"
                  />
                </div>
                <div>
                  <p className="text-[10px] font-mono text-white/30 mb-1 uppercase tracking-wider">에피소드 수</p>
                  <div className="flex gap-1.5">
                    {[3, 5, 7, 10].map(n => (
                      <button
                        key={n}
                        onClick={() => setNewSeries(s => ({ ...s, episode_count: n }))}
                        className={`flex-1 py-1.5 rounded-lg border text-[12px] font-mono transition-colors ${
                          newSeries.episode_count === n ? 'border-[#22c55e]/40 bg-[#22c55e]/10 text-white' : 'border-white/8 text-white/40 hover:text-white/60'
                        }`}
                      >
                        {n}편
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-[#22c55e]/5 border border-[#22c55e]/15 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Wand2 size={11} className="text-[#22c55e]/60" />
                    <span className="text-[11px] font-bold text-[#22c55e]/70">AI 에피소드 구성 자동 생성</span>
                  </div>
                  <p className="text-[10px] font-mono text-white/30">주제를 입력하면 AI가 {newSeries.episode_count}편의 에피소드 제목, 설명, 키워드를 자동으로 기획합니다.</p>
                </div>

                <button
                  onClick={handleSaveSeries}
                  disabled={savingSeries || !newSeries.title.trim() || !newSeries.topic.trim()}
                  className="w-full flex items-center justify-center gap-2 bg-[#22c55e] hover:bg-[#16a34a] disabled:opacity-40 text-black font-black text-[12px] uppercase py-2.5 rounded-lg transition-colors"
                >
                  {generatingOutline ? (
                    <><Loader2 size={13} className="animate-spin" />AI 기획 중...</>
                  ) : (
                    <><Wand2 size={13} />AI로 시리즈 기획</>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
