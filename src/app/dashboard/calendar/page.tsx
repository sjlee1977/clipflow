'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  ChevronLeft, ChevronRight, Plus, X, Wand2, Loader2,
  PenLine, BookOpen, ExternalLink, Trash2, CalendarDays,
} from 'lucide-react';

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
  video:    { label: '영상',   color: '#3b82f6', bg: 'rgba(59,130,246,0.15)',  border: 'rgba(59,130,246,0.35)' },
  short:    { label: '쇼츠',   color: '#4f8ef7', bg: 'rgba(56,189,248,0.15)',   border: 'rgba(56,189,248,0.35)' },
  blog:     { label: '블로그', color: '#a855f7', bg: 'rgba(168,85,247,0.15)',  border: 'rgba(168,85,247,0.35)' },
  carousel: { label: '캐러셀', color: '#f97316', bg: 'rgba(249,115,22,0.15)',  border: 'rgba(249,115,22,0.35)' },
  reel:     { label: '릴스',   color: '#ec4899', bg: 'rgba(236,72,153,0.15)',  border: 'rgba(236,72,153,0.35)' },
  thread:   { label: '스레드', color: '#8b5cf6', bg: 'rgba(139,92,246,0.15)', border: 'rgba(139,92,246,0.35)' },
};

const STATUS_PIPELINE: { key: PlanStatus; label: string }[] = [
  { key: 'idea',      label: '기획' },
  { key: 'writing',   label: '대본' },
  { key: 'editing',   label: '제작중' },
  { key: 'scheduled', label: '예약' },
  { key: 'published', label: '발행완료' },
];

const STATUS_ORDER: PlanStatus[] = ['idea', 'writing', 'editing', 'scheduled', 'published'];

const PLATFORM_META: Record<Platform, { label: string; icon: string; color: string }> = {
  youtube:   { label: 'YouTube',   icon: '▶', color: '#FF0000' },
  blog:      { label: 'Blog',      icon: '✎', color: '#4f8ef7' },
  linkedin:  { label: 'LinkedIn',  icon: 'in', color: '#0A66C2' },
  instagram: { label: 'Instagram', icon: '◈', color: '#E1306C' },
  tiktok:    { label: 'TikTok',    icon: '♪', color: '#FF0050' },
  twitter:   { label: 'X',         icon: '✕', color: '#FFFFFF' },
};

const SERIES_EMOJIS = ['🤖', '🚀', '🔥', '💡', '📊', '🎯', '⚡', '🌊'];

const DAYS_OF_WEEK = ['일', '월', '화', '수', '목', '금', '토'];

// ─── 메인 컴포넌트 ─────────────────────────────────────────────
export default function CalendarPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="w-5 h-5 border-2 border-white/10 border-t-white/40 rounded-full animate-spin" /></div>}>
      <CalendarPageInner />
    </Suspense>
  );
}

function CalendarPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth() + 1);
  const [plans, setPlans] = useState<ContentPlan[]>([]);
  const [series, setSeries] = useState<ContentSeries[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<ContentPlan | null>(null);
  const [activePanel, setActivePanel] = useState<'detail' | 'new-plan' | 'new-series'>('detail');

  const [newPlan, setNewPlan] = useState({
    title: '', content_type: 'video' as ContentType, platform: 'youtube' as Platform,
    status: 'idea' as PlanStatus, notes: '', series_id: '', episode_number: 0,
    source_trend_title: '', source_trend_url: '',
  });
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

  const fetchAll = useCallback(async () => {
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

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // 캘린더 계산
  const firstDay = new Date(viewYear, viewMonth - 1, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;

  const plansByDate = plans.reduce<Record<string, ContentPlan[]>>((acc, p) => {
    if (p.scheduled_at) acc[p.scheduled_at] = [...(acc[p.scheduled_at] ?? []), p];
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
  function fmtDate(y: number, m: number, d: number) {
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  async function handleSavePlan() {
    if (!newPlan.title.trim() || !selectedDate) return;
    setSavingPlan(true);
    const res = await fetch('/api/calendar/plans', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newPlan, scheduled_at: selectedDate }),
    });
    if (res.ok) {
      await fetchAll();
      setNewPlan({ title: '', content_type: 'video', platform: 'youtube', status: 'idea', notes: '', series_id: '', episode_number: 0, source_trend_title: '', source_trend_url: '' });
      setActivePanel('detail');
    }
    setSavingPlan(false);
  }

  async function handleDeletePlan(id: string) {
    await fetch('/api/calendar/plans', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    setPlans(prev => prev.filter(p => p.id !== id));
    if (selectedPlan?.id === id) setSelectedPlan(null);
  }

  async function handleUpdateStatus(plan: ContentPlan, status: PlanStatus) {
    await fetch('/api/calendar/plans', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: plan.id, status }) });
    const updated = { ...plan, status };
    setPlans(prev => prev.map(p => p.id === plan.id ? updated : p));
    setSelectedPlan(updated);
  }

  async function handleSaveSeries() {
    if (!newSeries.title.trim() || !newSeries.topic.trim()) return;
    setSavingSeries(true);
    setGeneratingOutline(true);
    const res = await fetch('/api/calendar/series', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newSeries, generateOutline: true }),
    });
    setGeneratingOutline(false);
    if (res.ok) {
      await fetchAll();
      setNewSeries({ title: '', topic: '', description: '', episode_count: 5 });
      setActivePanel('detail');
    }
    setSavingSeries(false);
  }

  async function handleDeleteSeries(id: string) {
    if (!confirm('시리즈를 삭제하시겠습니까?')) return;
    await fetch('/api/calendar/series', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    setSeries(prev => prev.filter(s => s.id !== id));
  }

  async function handleAddEpisodesToCalendar(s: ContentSeries) {
    if (!s.episodes?.length) return;
    const start = new Date();
    await Promise.all(s.episodes.map(async (ep, i) => {
      const d = new Date(start); d.setDate(d.getDate() + i * 7);
      await fetch('/api/calendar/plans', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: ep.title, content_type: 'video', platform: 'youtube', status: 'idea', scheduled_at: d.toISOString().split('T')[0], series_id: s.id, episode_number: ep.episode_number, notes: ep.description }),
      });
    }));
    await fetchAll();
  }

  const selectedDayPlans = selectedDate ? (plansByDate[selectedDate] ?? []) : [];

  return (
    <div className="space-y-6 px-6">
      {/* ─── 헤더 ─── */}
      <div className="flex items-center justify-between mt-4">
        <div className="flex items-center gap-3">
          <span className="w-7 h-7 flex items-center justify-center rounded-lg shrink-0" style={{ background: 'rgba(79,142,247,0.06)', border: '1px solid rgba(79,142,247,0.22)', color: '#4f8ef7' }}>
            <CalendarDays size={13} strokeWidth={1.8} />
          </span>
          <span className="text-[19px] font-semibold text-white leading-none translate-y-px" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>콘텐츠 캘린더</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setActivePanel('new-series'); setSelectedPlan(null); }}
            className="flex items-center gap-1.5 border border-white/15 hover:border-white/30 text-white/60 hover:text-white text-[12px] font-bold px-3 py-1.5 rounded-lg transition-colors">
            <BookOpen size={13} />시리즈 기획
          </button>
          <button onClick={() => { setActivePanel('new-plan'); setSelectedDate(today.toISOString().split('T')[0]); setSelectedPlan(null); }}
            className="flex items-center gap-1.5 bg-[#4f8ef7] hover:bg-[#0284c7] text-black font-black text-[12px] px-3 py-1.5 rounded-lg transition-colors">
            <Plus size={13} />콘텐츠 추가
          </button>
        </div>
      </div>

      {/* ─── 캘린더 + 패널 ─── */}
      <div className="flex gap-5">
        {/* 캘린더 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <button onClick={prevMonth} className="w-7 h-7 flex items-center justify-center rounded-lg border border-white/10 hover:border-white/25 text-white/50 hover:text-white/80 transition-colors">
                <ChevronLeft size={14} />
              </button>
              <h2 className="text-[15px] font-black text-white w-28 text-center">{viewYear}년 {viewMonth}월</h2>
              <button onClick={nextMonth} className="w-7 h-7 flex items-center justify-center rounded-lg border border-white/10 hover:border-white/25 text-white/50 hover:text-white/80 transition-colors">
                <ChevronRight size={14} />
              </button>
            </div>
            {/* 범례 */}
            <div className="flex items-center gap-3">
              {(Object.entries(TYPE_CONFIG) as [ContentType, typeof TYPE_CONFIG[ContentType]][]).map(([type, cfg]) => (
                <div key={type} className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cfg.color }} />
                  <span className="text-[10px] text-white/30">{cfg.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 요일 헤더 */}
          <div className="grid grid-cols-7 mb-1">
            {DAYS_OF_WEEK.map((d, i) => (
              <div key={d} className={`text-center py-2 text-[11px] font-bold font-mono ${i === 0 ? 'text-red-400/50' : i === 6 ? 'text-blue-400/50' : 'text-white/25'}`}>{d}</div>
            ))}
          </div>

          {loading ? (
            <div className="h-[480px] flex items-center justify-center text-white/20">
              <Loader2 size={20} className="animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-px bg-white/[0.04] rounded-xl overflow-hidden border border-white/6">
              {Array.from({ length: totalCells }).map((_, cellIdx) => {
                const dayNum = cellIdx - firstDay + 1;
                const isCurrentMonth = dayNum >= 1 && dayNum <= daysInMonth;
                const dateStr = isCurrentMonth ? fmtDate(viewYear, viewMonth, dayNum) : '';
                const isToday = dateStr === today.toISOString().split('T')[0];
                const isSelected = dateStr === selectedDate;
                const dayPlans = dateStr ? (plansByDate[dateStr] ?? []) : [];
                const isWeekend = cellIdx % 7 === 0 || cellIdx % 7 === 6;

                return (
                  <div
                    key={cellIdx}
                    onClick={() => { if (isCurrentMonth) { setSelectedDate(dateStr); setSelectedPlan(null); setActivePanel('detail'); } }}
                    className={`min-h-[88px] p-1.5 transition-colors cursor-pointer ${isCurrentMonth ? 'bg-[#0b0e14] hover:bg-white/[0.03]' : 'bg-black/30'} ${isSelected ? 'ring-1 ring-inset ring-[#4f8ef7]/40' : ''}`}
                  >
                    {isCurrentMonth && (
                      <>
                        <div className={`text-[11px] font-bold w-5 h-5 flex items-center justify-center rounded-full mb-1 ${
                          isToday ? 'bg-[#4f8ef7] text-black' : isWeekend ? (cellIdx % 7 === 0 ? 'text-red-400/50' : 'text-blue-400/50') : 'text-white/40'
                        }`}>{dayNum}</div>
                        <div className="space-y-0.5">
                          {dayPlans.slice(0, 3).map(plan => {
                            const cfg = TYPE_CONFIG[plan.content_type];
                            return (
                              <div
                                key={plan.id}
                                onClick={e => { e.stopPropagation(); setSelectedDate(dateStr); setSelectedPlan(plan); setActivePanel('detail'); }}
                                className="text-[9px] font-bold px-1 py-0.5 rounded truncate cursor-pointer hover:opacity-80 transition-opacity"
                                style={{ backgroundColor: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
                              >
                                {plan.title}
                              </div>
                            );
                          })}
                          {dayPlans.length > 3 && (
                            <div className="text-[9px] text-white/25 pl-1">+{dayPlans.length - 3}</div>
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
          {plans.length > 0 && (
            <div className="mt-3 flex items-center gap-5 px-1">
              {(Object.keys(TYPE_CONFIG) as ContentType[]).map(type => {
                const count = plans.filter(p => p.content_type === type).length;
                if (!count) return null;
                return (
                  <div key={type} className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: TYPE_CONFIG[type].color }} />
                    <span className="text-[10px] text-white/30">{TYPE_CONFIG[type].label} {count}</span>
                  </div>
                );
              })}
              <div className="ml-auto text-[10px] text-white/20">총 {plans.length}개 콘텐츠</div>
            </div>
          )}
        </div>

        {/* ─── 우측 패널 ─── */}
        <div className="w-[340px] shrink-0">

          {/* 아이템 상세 카드 (첨부 디자인 반영) */}
          {activePanel === 'detail' && (
            <div className="space-y-3">
              {selectedPlan ? (
                /* 선택된 콘텐츠 상세 */
                <div className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
                  {/* 상단 배지 + 닫기 */}
                  <div className="flex items-center justify-between px-4 pt-4 pb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      {selectedPlan.content_series && (
                        <span className="flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full border"
                          style={{ borderColor: 'rgba(168,85,247,0.4)', color: '#c084fc', background: 'rgba(168,85,247,0.1)' }}>
                          📚 {selectedPlan.content_series.title}
                          {selectedPlan.episode_number ? ` · EP${selectedPlan.episode_number}` : ''}
                        </span>
                      )}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        selectedPlan.status === 'published'
                          ? 'border-[#4f8ef7]/40 text-[#4f8ef7] bg-[#4f8ef7]/10'
                          : selectedPlan.status === 'scheduled'
                          ? 'border-blue-400/40 text-blue-400 bg-blue-400/10'
                          : selectedPlan.status === 'editing'
                          ? 'border-orange-400/40 text-orange-400 bg-orange-400/10'
                          : 'border-white/15 text-white/40 bg-white/5'
                      }`}>
                        {STATUS_PIPELINE.find(s => s.key === selectedPlan.status)?.label}
                      </span>
                    </div>
                    <button onClick={() => setSelectedPlan(null)} className="text-white/20 hover:text-white/60 transition-colors">
                      <X size={14} />
                    </button>
                  </div>

                  {/* 제목 */}
                  <div className="px-4 pb-3">
                    <h3 className="text-[18px] font-black text-white leading-tight">{selectedPlan.title}</h3>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[11px] font-mono text-white/30">
                        {new Date(selectedPlan.scheduled_at + 'T00:00:00').toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}
                      </span>
                      {selectedPlan.source_trend_url && (
                        <a href={selectedPlan.source_trend_url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[10px] text-[#4f8ef7]/50 hover:text-[#4f8ef7] transition-colors">
                          <ExternalLink size={9} />원본 트렌드
                        </a>
                      )}
                    </div>
                  </div>

                  {/* 플랫폼 버튼 */}
                  <div className="px-4 pb-3 flex items-center gap-2 flex-wrap">
                    {(['youtube', 'blog', 'linkedin', 'instagram', 'tiktok'] as Platform[]).map(pl => {
                      const meta = PLATFORM_META[pl];
                      const isActive = selectedPlan.platform === pl;
                      return (
                        <button key={pl}
                          onClick={async () => {
                            await fetch('/api/calendar/plans', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: selectedPlan.id, platform: pl }) });
                            const updated = { ...selectedPlan, platform: pl };
                            setPlans(prev => prev.map(p => p.id === selectedPlan.id ? updated : p));
                            setSelectedPlan(updated);
                          }}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all border"
                          style={isActive
                            ? { backgroundColor: meta.color + '22', borderColor: meta.color + '66', color: meta.color }
                            : { backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.35)' }
                          }
                        >
                          <span className="text-[10px]">{meta.icon}</span>{meta.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* 프로덕션 파이프라인 */}
                  <div className="px-4 pb-4">
                    <p className="text-[10px] text-white/25 mb-2 uppercase tracking-wider">프로덕션 파이프라인</p>
                    <div className="flex items-center gap-0">
                      {STATUS_PIPELINE.map((step, i) => {
                        const currentIdx = STATUS_ORDER.indexOf(selectedPlan.status);
                        const stepIdx = STATUS_ORDER.indexOf(step.key);
                        const isDone = stepIdx < currentIdx;
                        const isCurrent = step.key === selectedPlan.status;
                        const isLast = i === STATUS_PIPELINE.length - 1;
                        return (
                          <div key={step.key} className="flex items-center flex-1 min-w-0">
                            <button
                              onClick={() => handleUpdateStatus(selectedPlan, step.key)}
                              className="flex-1 text-center text-[10px] font-bold py-1.5 px-1 rounded-lg transition-all border truncate"
                              style={
                                isCurrent
                                  ? { background: 'rgba(56,189,248,0.15)', borderColor: 'rgba(56,189,248,0.5)', color: '#4f8ef7' }
                                  : isDone
                                  ? { background: 'rgba(56,189,248,0.06)', borderColor: 'rgba(56,189,248,0.2)', color: 'rgba(56,189,248,0.5)' }
                                  : { background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.25)' }
                              }
                            >
                              {step.label}
                            </button>
                            {!isLast && (
                              <div className="w-2 shrink-0 flex items-center justify-center">
                                <span className="text-[8px] text-white/15">›</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 액션 버튼 */}
                  <div className="grid grid-cols-2 gap-2 px-4 pb-4">
                    <button
                      onClick={() => { const params = new URLSearchParams({ topic: selectedPlan.title }); router.push(`/dashboard/script?${params}`); }}
                      className="flex items-center justify-center gap-1.5 bg-[#4f8ef7] hover:bg-[#0284c7] text-black font-black text-[12px] py-2 rounded-lg transition-colors"
                    >
                      <PenLine size={12} />대본 생성 →
                    </button>
                    <button
                      onClick={() => setActivePanel('new-plan')}
                      className="flex items-center justify-center gap-1.5 border border-white/12 hover:border-white/25 text-white/50 hover:text-white/80 text-[12px] font-bold py-2 rounded-lg transition-colors"
                    >
                      일정 변경
                    </button>
                  </div>

                  {/* 메모 */}
                  {selectedPlan.notes && (
                    <div className="px-4 pb-4">
                      <div className="bg-white/[0.03] border border-white/6 rounded-lg px-3 py-2">
                        <p className="text-[10px] text-white/25 mb-1">메모</p>
                        <p className="text-[11px] text-white/50 leading-relaxed">{selectedPlan.notes}</p>
                      </div>
                    </div>
                  )}

                  {/* 삭제 */}
                  <div className="px-4 pb-4">
                    <button onClick={() => handleDeletePlan(selectedPlan.id)}
                      className="w-full flex items-center justify-center gap-1.5 text-red-400/30 hover:text-red-400/70 text-[11px] font-mono transition-colors py-1">
                      <Trash2 size={11} />삭제
                    </button>
                  </div>
                </div>
              ) : (
                /* 날짜 선택 상태 */
                <div className="rounded-xl border border-white/8 bg-white/[0.02] overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-white/6">
                    <p className="text-[13px] font-bold text-white">
                      {selectedDate
                        ? new Date(selectedDate + 'T00:00:00').toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })
                        : '날짜를 선택하세요'}
                    </p>
                    {selectedDate && (
                      <button onClick={() => setActivePanel('new-plan')}
                        className="flex items-center gap-1 text-[11px] font-mono text-[#4f8ef7]/60 hover:text-[#4f8ef7] transition-colors">
                        <Plus size={11} />추가
                      </button>
                    )}
                  </div>
                  {selectedDayPlans.length === 0 ? (
                    <div className="px-4 py-10 text-center">
                      <p className="text-[12px] text-white/20 font-mono">{selectedDate ? '예정된 콘텐츠가 없습니다' : '달력에서 날짜를 클릭하세요'}</p>
                      {selectedDate && (
                        <button onClick={() => setActivePanel('new-plan')}
                          className="text-[11px] text-[#4f8ef7]/40 hover:text-[#4f8ef7] transition-colors mt-2 block mx-auto font-mono">
                          + 콘텐츠 추가
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="divide-y divide-white/5">
                      {selectedDayPlans.map(plan => {
                        const cfg = TYPE_CONFIG[plan.content_type];
                        return (
                          <button key={plan.id} onClick={() => setSelectedPlan(plan)}
                            className="w-full text-left px-4 py-3 hover:bg-white/[0.03] transition-colors group">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: cfg.bg, color: cfg.color }}>
                                {cfg.label}
                              </span>
                              <span className="text-[12px] font-bold text-white/80 truncate flex-1">{plan.title}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-white/25">{PLATFORM_META[plan.platform]?.label}</span>
                              <span className="text-[9px] text-white/20">·</span>
                              <span className="text-[10px] text-white/25">
                                {STATUS_PIPELINE.find(s => s.key === plan.status)?.label}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 새 계획 추가 */}
          {activePanel === 'new-plan' && (
            <div className="rounded-xl border border-white/8 bg-white/[0.02] overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/6">
                <p className="text-[13px] font-bold text-white">콘텐츠 추가</p>
                <button onClick={() => setActivePanel('detail')} className="text-white/30 hover:text-white/70"><X size={14} /></button>
              </div>
              <div className="px-4 py-4 space-y-3">
                <div>
                  <p className="text-[10px] text-white/25 mb-1.5 uppercase tracking-wider">날짜</p>
                  <input type="date" value={selectedDate ?? ''} onChange={e => setSelectedDate(e.target.value)}
                    className="w-full bg-white/[0.03] border border-white/8 rounded-lg px-3 py-1.5 text-[12px] text-white/70 font-mono outline-none focus:border-[#4f8ef7]/40" />
                </div>
                <div>
                  <p className="text-[10px] text-white/25 mb-1.5 uppercase tracking-wider">제목</p>
                  <input type="text" value={newPlan.title} onChange={e => setNewPlan(p => ({ ...p, title: e.target.value }))}
                    placeholder="콘텐츠 제목..."
                    className="w-full bg-white/[0.03] border border-white/8 rounded-lg px-3 py-1.5 text-[12px] text-white/80 outline-none focus:border-[#4f8ef7]/40 placeholder-white/20" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[10px] text-white/25 mb-1.5 uppercase tracking-wider">유형</p>
                    <select value={newPlan.content_type} onChange={e => setNewPlan(p => ({ ...p, content_type: e.target.value as ContentType }))}
                      className="w-full bg-white/[0.03] border border-white/8 rounded-lg px-2 py-1.5 text-[12px] text-white/70 font-mono outline-none focus:border-[#4f8ef7]/40">
                      {(Object.entries(TYPE_CONFIG) as [ContentType, typeof TYPE_CONFIG[ContentType]][]).map(([t, c]) => (
                        <option key={t} value={t}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <p className="text-[10px] text-white/25 mb-1.5 uppercase tracking-wider">플랫폼</p>
                    <select value={newPlan.platform} onChange={e => setNewPlan(p => ({ ...p, platform: e.target.value as Platform }))}
                      className="w-full bg-white/[0.03] border border-white/8 rounded-lg px-2 py-1.5 text-[12px] text-white/70 font-mono outline-none focus:border-[#4f8ef7]/40">
                      {(Object.keys(PLATFORM_META) as Platform[]).map(pl => <option key={pl} value={pl}>{PLATFORM_META[pl].label}</option>)}
                    </select>
                  </div>
                </div>
                {series.length > 0 && (
                  <div>
                    <p className="text-[10px] text-white/25 mb-1.5 uppercase tracking-wider">시리즈 연결</p>
                    <select value={newPlan.series_id} onChange={e => setNewPlan(p => ({ ...p, series_id: e.target.value }))}
                      className="w-full bg-white/[0.03] border border-white/8 rounded-lg px-2 py-1.5 text-[12px] text-white/70 font-mono outline-none focus:border-[#4f8ef7]/40">
                      <option value="">없음</option>
                      {series.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <p className="text-[10px] text-white/25 mb-1.5 uppercase tracking-wider">메모</p>
                  <textarea value={newPlan.notes} onChange={e => setNewPlan(p => ({ ...p, notes: e.target.value }))}
                    placeholder="키워드, 레퍼런스..." rows={2}
                    className="w-full bg-white/[0.03] border border-white/8 rounded-lg px-3 py-1.5 text-[12px] text-white/70 font-mono outline-none resize-none focus:border-[#4f8ef7]/40 placeholder-white/20" />
                </div>
                <button onClick={handleSavePlan} disabled={savingPlan || !newPlan.title.trim()}
                  className="w-full bg-[#4f8ef7] hover:bg-[#0284c7] disabled:opacity-40 text-black font-black text-[12px] uppercase py-2 rounded-lg transition-colors">
                  {savingPlan ? <Loader2 size={13} className="animate-spin inline" /> : '저장'}
                </button>
              </div>
            </div>
          )}

          {/* 새 시리즈 */}
          {activePanel === 'new-series' && (
            <div className="rounded-xl border border-white/8 bg-white/[0.02] overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/6">
                <div className="flex items-center gap-2">
                  <Wand2 size={13} className="text-[#4f8ef7]/70" />
                  <p className="text-[13px] font-bold text-white">AI 시리즈 기획</p>
                </div>
                <button onClick={() => setActivePanel('detail')} className="text-white/30 hover:text-white/70"><X size={14} /></button>
              </div>
              <div className="px-4 py-4 space-y-3">
                <div>
                  <p className="text-[10px] text-white/25 mb-1.5 uppercase tracking-wider">시리즈명</p>
                  <input type="text" value={newSeries.title} onChange={e => setNewSeries(s => ({ ...s, title: e.target.value }))}
                    placeholder="예: AI 툴 완전 정복 시리즈"
                    className="w-full bg-white/[0.03] border border-white/8 rounded-lg px-3 py-1.5 text-[12px] text-white/80 outline-none focus:border-[#4f8ef7]/40 placeholder-white/20" />
                </div>
                <div>
                  <p className="text-[10px] text-white/25 mb-1.5 uppercase tracking-wider">핵심 주제</p>
                  <input type="text" value={newSeries.topic} onChange={e => setNewSeries(s => ({ ...s, topic: e.target.value }))}
                    placeholder="예: 직장인을 위한 AI 생산성 툴"
                    className="w-full bg-white/[0.03] border border-white/8 rounded-lg px-3 py-1.5 text-[12px] text-white/80 outline-none focus:border-[#4f8ef7]/40 placeholder-white/20" />
                </div>
                <div>
                  <p className="text-[10px] text-white/25 mb-1.5 uppercase tracking-wider">에피소드 수</p>
                  <div className="flex gap-1.5">
                    {[3, 5, 7, 10].map(n => (
                      <button key={n} onClick={() => setNewSeries(s => ({ ...s, episode_count: n }))}
                        className={`cf-filter-btn flex-1 py-1.5 rounded-lg border text-[12px] font-mono transition-colors ${
                          newSeries.episode_count === n ? 'border-[#4f8ef7]/40 bg-[#4f8ef7]/10 text-white' : 'border-white/8 text-white/40 hover:text-white/60'
                        }`}>{n}편</button>
                    ))}
                  </div>
                </div>
                <div className="bg-[#4f8ef7]/5 border border-[#4f8ef7]/15 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Wand2 size={11} className="text-[#4f8ef7]/60" />
                    <span className="text-[11px] font-bold text-[#4f8ef7]/70">AI 에피소드 자동 구성</span>
                  </div>
                  <p className="text-[10px] text-white/30">{newSeries.episode_count}편의 에피소드 제목, 설명, 키워드를 AI가 자동으로 기획합니다.</p>
                </div>
                <button onClick={handleSaveSeries} disabled={savingSeries || !newSeries.title.trim() || !newSeries.topic.trim()}
                  className="w-full flex items-center justify-center gap-2 bg-[#4f8ef7] hover:bg-[#0284c7] disabled:opacity-40 text-black font-black text-[12px] uppercase py-2.5 rounded-lg transition-colors">
                  {generatingOutline ? <><Loader2 size={13} className="animate-spin" />AI 기획 중...</> : <><Wand2 size={13} />AI로 시리즈 기획</>}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── 시리즈 내러티브 아크 ─── */}
      {series.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-[14px]">▲</span>
            <h2 className="text-[14px] font-black text-white/80 uppercase tracking-wide">시리즈 내러티브 아크</h2>
            <button onClick={() => setActivePanel('new-series')}
              className="ml-auto flex items-center gap-1.5 text-[11px] font-mono text-white/30 hover:text-white/60 border border-white/8 hover:border-white/20 px-2.5 py-1 rounded-lg transition-colors">
              <Plus size={10} />새 시리즈
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {series.map((s, si) => {
              const publishedPlans = s.content_plans?.filter(p => p.status === 'published') ?? [];
              const scheduledPlans = s.content_plans?.filter(p => p.status === 'scheduled') ?? [];
              const publishedCount = publishedPlans.length;
              const totalEp = s.episode_count;
              const emoji = SERIES_EMOJIS[si % SERIES_EMOJIS.length];

              // 에피소드 블록 (총 episode_count개)
              const blocks = Array.from({ length: Math.min(totalEp, 10) }).map((_, i) => {
                const epNum = i + 1;
                const plan = s.content_plans?.find(p => p.episode_number === epNum);
                if (!plan) return 'empty';
                if (plan.status === 'published') return 'published';
                if (plan.status === 'scheduled') return 'scheduled';
                if (plan.status === 'editing') return 'editing';
                if (plan.status === 'writing') return 'writing';
                return 'idea';
              });

              return (
                <div key={s.id} className="rounded-xl border border-white/8 bg-white/[0.02] p-4 hover:border-white/15 transition-colors group">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[14px]">{emoji}</span>
                        <p className="text-[13px] font-bold text-white/90">{s.title}</p>
                      </div>
                      <p className="text-[10px] text-white/30">{s.topic}</p>
                    </div>
                    <button onClick={() => handleDeleteSeries(s.id)}
                      className="opacity-0 group-hover:opacity-100 text-red-400/30 hover:text-red-400 transition-all">
                      <Trash2 size={12} />
                    </button>
                  </div>

                  {/* 에피소드 블록 시각화 */}
                  <div className="flex items-end gap-1 mb-3 h-8">
                    {blocks.map((state, i) => {
                      const heights = ['h-3', 'h-4', 'h-5', 'h-6', 'h-5', 'h-7', 'h-4', 'h-6', 'h-5', 'h-4'];
                      const h = heights[i % heights.length];
                      const colors: Record<string, string> = {
                        published: '#4f8ef7',
                        scheduled: '#3b82f6',
                        editing:   '#f97316',
                        writing:   '#eab308',
                        idea:      'rgba(255,255,255,0.15)',
                        empty:     'rgba(255,255,255,0.06)',
                      };
                      return (
                        <div key={i} className={`flex-1 rounded-sm transition-all ${h}`}
                          style={{ backgroundColor: colors[state] ?? colors.empty }} />
                      );
                    })}
                  </div>

                  {/* 통계 */}
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono text-white/40">
                      {publishedCount}/{totalEp}편 발행
                      {scheduledPlans.length > 0 && <span className="text-blue-400/50 ml-1">· {scheduledPlans.length}예약</span>}
                    </span>
                    <button onClick={() => handleAddEpisodesToCalendar(s)}
                      className="text-[10px] text-white/25 hover:text-white/60 transition-colors border border-white/8 hover:border-white/20 px-2 py-0.5 rounded">
                      일정 등록
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
