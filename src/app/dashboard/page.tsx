'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-browser';
import {
  PenLine, CalendarPlus, ArrowRight, TrendingUp, ChevronRight,
  CheckCircle2, Clock, FileEdit, Lightbulb, Loader2,
  Flame, ChevronDown, ChevronUp, Zap, Eye,
} from 'lucide-react';
import type { TrendInsight } from '@/app/api/trends/insights/route';

// ─── Types ───────────────────────────────────────────────────────────────────

type Plan = {
  id: string;
  title: string;
  status: 'idea' | 'writing' | 'editing' | 'scheduled' | 'published';
  platform: string;
  scheduled_date: string | null;
  episode_number: number | null;
  content_series?: { title: string } | null;
};

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_META: Record<Plan['status'], { label: string; color: string; icon: React.ReactNode }> = {
  idea:      { label: '기획',   color: 'rgba(255,255,255,0.15)', icon: <Lightbulb size={11} /> },
  writing:   { label: '대본',   color: '#eab308',                icon: <PenLine size={11} /> },
  editing:   { label: '제작중', color: '#f97316',                icon: <FileEdit size={11} /> },
  scheduled: { label: '예약',   color: '#3b82f6',                icon: <Clock size={11} /> },
  published: { label: '발행',   color: '#22c55e',                icon: <CheckCircle2 size={11} /> },
};

const PIPELINE_ORDER: Plan['status'][] = ['idea', 'writing', 'editing', 'scheduled', 'published'];

const PLATFORM_COLOR: Record<string, string> = {
  youtube: '#FF0000', blog: '#a855f7', linkedin: '#0A66C2',
  instagram: '#E1306C', tiktok: '#FF0050', twitter: '#1DA1F2',
};

const OPPORTUNITY_META: Record<TrendInsight['opportunity'], { label: string; color: string; bg: string }> = {
  high:  { label: '선점 기회', color: '#22c55e',  bg: 'rgba(34,197,94,0.12)' },
  medium:{ label: '주목',      color: '#f59e0b',  bg: 'rgba(245,158,11,0.12)' },
  watch: { label: '관찰 중',   color: 'rgba(255,255,255,0.3)', bg: 'rgba(255,255,255,0.04)' },
};

// ─── Week strip helpers ───────────────────────────────────────────────────────

function getWeekDays(): Date[] {
  const today = new Date();
  const dow = today.getDay();
  const mon = new Date(today);
  mon.setDate(today.getDate() - ((dow + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    return d;
  });
}

const DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'];

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}

// ─── Insight Card ─────────────────────────────────────────────────────────────

function InsightCard({ insight, onScript }: { insight: TrendInsight; onScript: (keyword: string, category: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const opp = OPPORTUNITY_META[insight.opportunity];

  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] overflow-hidden">
      {/* Layer 1 + 2: 인사이트 헤더 */}
      <div className="p-3.5">
        <div className="flex items-start gap-2.5">
          {/* 기회 배지 */}
          <span
            className="shrink-0 text-[9px] font-black px-1.5 py-0.5 rounded mt-0.5"
            style={{ color: opp.color, backgroundColor: opp.bg }}
          >
            {opp.label}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-[11px] font-black text-white">{insight.keyword}</span>
              <span className="text-[9px] text-white/25">· {insight.categoryLabel}</span>
            </div>
            {/* Layer 1: AI 인사이트 한 줄 */}
            <p className="text-[11px] text-white/60 leading-relaxed">{insight.summary}</p>
          </div>
        </div>

        {/* Layer 2: 액션 버튼 */}
        <div className="flex items-center gap-2 mt-2.5">
          <button
            onClick={() => onScript(insight.keyword, insight.category)}
            className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-lg border border-[#22c55e]/40 bg-[#22c55e]/8 text-[#22c55e] hover:bg-[#22c55e]/15 transition-colors"
          >
            <PenLine size={10} />이 주제로 대본 생성
          </button>
          <Link
            href={`/dashboard/trends/viral?category=${insight.category}`}
            className="flex items-center gap-1 text-[10px] px-2.5 py-1.5 rounded-lg border border-white/10 text-white/40 hover:text-white/60 hover:border-white/20 transition-colors"
          >
            <Eye size={10} />영상 보기
          </Link>
          <button
            onClick={() => setExpanded(v => !v)}
            className="ml-auto flex items-center gap-1 text-[10px] text-white/25 hover:text-white/50 transition-colors"
          >
            {expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
            <span>{insight.signal_count}개 신호</span>
          </button>
        </div>
      </div>

      {/* Layer 3: 원시 데이터 (펼침) */}
      {expanded && (
        <div className="border-t border-white/6 px-3.5 py-3 space-y-3">
          {insight.raw_viral.length > 0 && (
            <div>
              <p className="text-[9px] font-bold text-white/25 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                <Flame size={9} className="text-orange-400" />급상승 영상
              </p>
              <div className="space-y-1">
                {insight.raw_viral.map(v => (
                  <div key={v.video_id} className="flex items-center gap-2">
                    <a
                      href={`https://www.youtube.com/watch?v=${v.video_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 text-[10px] text-white/50 hover:text-white/80 truncate transition-colors"
                    >
                      {v.title}
                    </a>
                    {v.growth_rate_hourly && (
                      <span className="text-[9px] text-orange-400/70 shrink-0">
                        +{Math.round(v.growth_rate_hourly).toLocaleString()}/h
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {insight.raw_outliers.length > 0 && (
            <div>
              <p className="text-[9px] font-bold text-white/25 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                <Zap size={9} className="text-yellow-400" />채널 이상치
              </p>
              <div className="space-y-1">
                {insight.raw_outliers.map(v => (
                  <div key={v.video_id} className="flex items-center gap-2">
                    <a
                      href={`https://www.youtube.com/watch?v=${v.video_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 text-[10px] text-white/50 hover:text-white/80 truncate transition-colors"
                    >
                      {v.title}
                    </a>
                    <span className="text-[9px] text-yellow-400/70 shrink-0">
                      {v.multiplier ? `${v.multiplier.toFixed(1)}×` : ''}
                      {v.subscriber_count ? ` · ${Math.round(v.subscriber_count / 10000)}만ch` : ''}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-[9px] text-white/20 mt-2">
                ↑ 작은 채널이 터뜨린 영상 — 주제만 좋으면 구독자 없이도 됩니다
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DashboardHome() {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [insights, setInsights] = useState<TrendInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [insightsLoading, setInsightsLoading] = useState(true);

  const weekDays = getWeekDays();
  const todayStr = toDateStr(new Date());

  const fetchPlans = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('content_plans')
      .select('id, title, status, platform, scheduled_date, episode_number, content_series(title)')
      .order('scheduled_date', { ascending: true });
    setPlans((data ?? []) as Plan[]);
    setLoading(false);
  }, []);

  const fetchInsights = useCallback(async () => {
    try {
      const res = await fetch('/api/trends/insights');
      const data = await res.json();
      setInsights(data.insights ?? []);
    } catch {
      setInsights([]);
    } finally {
      setInsightsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlans();
    fetchInsights();
  }, [fetchPlans, fetchInsights]);

  // Derived
  const pipelineCounts = PIPELINE_ORDER.reduce((acc, s) => {
    acc[s] = plans.filter(p => p.status === s).length;
    return acc;
  }, {} as Record<Plan['status'], number>);

  const weekPlansMap = weekDays.reduce((acc, d) => {
    const key = toDateStr(d);
    acc[key] = plans.filter(p => p.scheduled_date?.slice(0, 10) === key);
    return acc;
  }, {} as Record<string, Plan[]>);

  const recentPublished = plans.filter(p => p.status === 'published').slice(0, 4);
  const inProgress = plans.filter(p => ['writing', 'editing'].includes(p.status)).slice(0, 3);
  const maxCount = Math.max(...Object.values(pipelineCounts), 1);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={20} className="animate-spin text-white/20" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5">

      {/* ── 헤더 ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="w-1 h-7 bg-[#22c55e]" />
          <div>
            <h1 className="text-[18px] font-black tracking-tight text-white uppercase">대시보드</h1>
            <p className="text-[11px] text-white/30 font-mono tracking-widest mt-0.5">
              {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
            </p>
          </div>
        </div>
        <Link
          href="/dashboard/calendar"
          className="flex items-center gap-1.5 text-[11px] font-mono text-white/30 hover:text-white/60 transition-colors"
        >
          월간 캘린더 <ChevronRight size={12} />
        </Link>
      </div>

      {/* ── Row 1: 위클리 스트립 + 파이프라인 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-4">

        {/* 위클리 스트립 */}
        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-bold text-white/40 uppercase tracking-widest">이번 주 일정</p>
            <span className="text-[10px] text-white/20">
              {weekDays[0].getMonth() + 1}/{weekDays[0].getDate()} – {weekDays[6].getMonth() + 1}/{weekDays[6].getDate()}
            </span>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {weekDays.map((d, i) => {
              const key = toDateStr(d);
              const isToday = key === todayStr;
              const dayPlans = weekPlansMap[key] ?? [];
              return (
                <div key={key} className={`rounded-lg p-1.5 min-h-[90px] border transition-colors ${
                  isToday ? 'border-[#22c55e]/30 bg-[#22c55e]/5' : 'border-white/6 bg-white/[0.01]'
                }`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-[10px] font-bold ${isToday ? 'text-[#22c55e]' : 'text-white/30'}`}>{DAY_LABELS[i]}</span>
                    <span className={`text-[9px] ${isToday ? 'text-[#22c55e]' : 'text-white/20'}`}>{d.getDate()}</span>
                  </div>
                  <div className="space-y-0.5">
                    {dayPlans.slice(0, 3).map(p => (
                      <div
                        key={p.id}
                        title={p.title}
                        className="w-full h-1.5 rounded-full cursor-pointer"
                        style={{ backgroundColor: STATUS_META[p.status].color }}
                        onClick={() => router.push('/dashboard/calendar')}
                      />
                    ))}
                    {dayPlans.length > 3 && (
                      <p className="text-[8px] text-white/20 text-center">+{dayPlans.length - 3}</p>
                    )}
                  </div>
                  {dayPlans.length === 0 && (
                    <button
                      onClick={() => router.push(`/dashboard/calendar?date=${key}`)}
                      className="w-full mt-1 flex items-center justify-center text-white/10 hover:text-white/30 transition-colors"
                    >
                      <CalendarPlus size={10} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            {PIPELINE_ORDER.map(s => (
              <div key={s} className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: STATUS_META[s].color }} />
                <span className="text-[10px] font-light tracking-widest text-white/45">{STATUS_META[s].label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 파이프라인 카운터 */}
        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
          <p className="text-[11px] font-bold text-white/40 uppercase tracking-widest mb-3">제작 파이프라인</p>
          <div className="space-y-2">
            {PIPELINE_ORDER.map(s => {
              const count = pipelineCounts[s];
              const meta = STATUS_META[s];
              return (
                <div key={s} className="flex items-center gap-2.5">
                  <div className="flex items-center gap-1.5 w-[60px] shrink-0">
                    <span style={{ color: meta.color }}>{meta.icon}</span>
                    <span className="text-[11px] font-mono text-white/40">{meta.label}</span>
                  </div>
                  <div className="flex-1 bg-white/5 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: count > 0 ? `${Math.min(100, (count / maxCount) * 100)}%` : '0%',
                        backgroundColor: meta.color,
                      }}
                    />
                  </div>
                  <span className={`text-[13px] font-black w-5 text-right ${count > 0 ? 'text-white' : 'text-white/20'}`}>{count}</span>
                </div>
              );
            })}
          </div>

          {inProgress.length > 0 && (
            <div className="mt-4 space-y-1.5 border-t border-white/6 pt-3">
              <p className="text-[10px] text-white/25 mb-2">이어서 작업</p>
              {inProgress.map(p => (
                <button
                  key={p.id}
                  onClick={() => router.push(p.status === 'writing' ? '/dashboard/script' : '/dashboard/video')}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg border border-white/6 hover:border-white/15 hover:bg-white/[0.03] transition-all group"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold text-white/70 truncate">{p.title || '제목 없음'}</p>
                    <p className="text-[9px]" style={{ color: STATUS_META[p.status].color }}>
                      {STATUS_META[p.status].label}
                    </p>
                  </div>
                  <ArrowRight size={11} className="text-white/20 group-hover:text-white/50 shrink-0 transition-colors" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Row 2: 트렌드 인사이트 + 최근 발행 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* 트렌드 인사이트 (3층 구조) */}
        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Flame size={13} className="text-orange-400" />
              <p className="text-[11px] font-bold text-white/40 uppercase tracking-widest">트렌드 인사이트</p>
            </div>
            <Link href="/dashboard/trends/viral" className="text-[10px] text-white/25 hover:text-white/50 transition-colors flex items-center gap-1">
              전체 <ChevronRight size={10} />
            </Link>
          </div>

          {insightsLoading ? (
            <div className="flex items-center gap-2 py-6 justify-center">
              <Loader2 size={13} className="animate-spin text-white/20" />
              <span className="text-[11px] font-mono text-white/20">AI 분석 중...</span>
            </div>
          ) : insights.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-[12px] font-mono text-white/20">수집된 트렌드 없음</p>
              <p className="text-[10px] text-white/15 mt-1">설정에서 카테고리를 선택하고 트렌드를 수집하세요</p>
            </div>
          ) : (
            <div className="space-y-2">
              {insights.map(insight => (
                <InsightCard
                  key={insight.id}
                  insight={insight}
                  onScript={(keyword, category) => {
                    const params = new URLSearchParams({ topic: keyword, category });
                    router.push(`/dashboard/script?${params.toString()}`);
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* 최근 발행 */}
        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp size={13} className="text-[#22c55e]" />
              <p className="text-[11px] font-bold text-white/40 uppercase tracking-widest">최근 발행</p>
            </div>
            <Link href="/dashboard/calendar" className="text-[10px] text-white/25 hover:text-white/50 transition-colors flex items-center gap-1">
              캘린더 <ChevronRight size={10} />
            </Link>
          </div>

          {recentPublished.length === 0 ? (
            <div className="py-8 flex flex-col items-center gap-3">
              <p className="text-[12px] font-mono text-white/20">아직 발행된 콘텐츠가 없습니다</p>
              <button
                onClick={() => router.push('/dashboard/calendar')}
                className="flex items-center gap-1.5 text-[11px] font-mono px-3 py-1.5 border border-[#22c55e]/30 text-[#22c55e]/70 hover:border-[#22c55e]/60 hover:text-[#22c55e] rounded-lg transition-all"
              >
                <CalendarPlus size={11} />첫 콘텐츠 예약하기
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {recentPublished.map(p => (
                <div key={p.id} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg border border-white/6 hover:border-white/12 hover:bg-white/[0.02] transition-all">
                  <div
                    className="w-1.5 h-8 rounded-full shrink-0"
                    style={{ backgroundColor: PLATFORM_COLOR[p.platform] ?? 'rgba(255,255,255,0.2)' }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-bold text-white/70 truncate">{p.title || '제목 없음'}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[9px] text-white/25 capitalize">{p.platform}</span>
                      {p.content_series && (
                        <span className="text-[9px] text-purple-400/50">
                          {p.content_series.title}{p.episode_number ? ` EP${p.episode_number}` : ''}
                        </span>
                      )}
                    </div>
                  </div>
                  <CheckCircle2 size={13} className="text-[#22c55e]/50 shrink-0" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
