'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { Video, Zap, ArrowUpDown, PenLine, CalendarPlus, TrendingUp } from 'lucide-react';
import { useRouter } from 'next/navigation';

type ViralSort = 'hourly' | 'views' | 'publishedAt';
const VIRAL_SORTS: { key: ViralSort; label: string }[] = [
  { key: 'hourly',     label: '시간당 증가순' },
  { key: 'views',      label: '조회수순' },
  { key: 'publishedAt', label: '최신순' },
];
import { TREND_CATEGORIES, SEARCH_REGIONS } from '@/lib/youtube-trends';
import DateRangePicker from '@/components/DateRangePicker';
import { createClient } from '@/lib/supabase-browser';

interface ViralSignal {
  id: string;
  current_views: number;
  growth_rate_hourly: number;
  detected_at: string;
  updated_at: string;
  trend_videos: {
    video_id: string;
    title: string;
    thumbnail: string;
    category: string;
    published_at: string;
    channel_id: string;
    trend_channels: {
      channel_name: string;
      channel_thumbnail: string;
      avg_views: number;
    } | null;
  };
}

export default function ViralPage() {
  const router = useRouter();
  const [signals, setSignals] = useState<ViralSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('');
  const [videoType, setVideoType] = useState<'regular' | 'short'>('regular');
  const [period, setPeriod] = useState('24h');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [collecting, setCollecting] = useState(false);
  const [collectStatus, setCollectStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [sortKey, setSortKey] = useState<ViralSort>('hourly');

  const sortedSignals = useMemo(() => {
    const arr = [...signals];
    if (sortKey === 'views') return arr.sort((a, b) => b.current_views - a.current_views);
    if (sortKey === 'publishedAt') return arr.sort((a, b) => new Date(b.trend_videos.published_at).getTime() - new Date(a.trend_videos.published_at).getTime());
    return arr.sort((a, b) => b.growth_rate_hourly - a.growth_rate_hourly);
  }, [signals, sortKey]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }: { data: { user: { email?: string } | null } }) => {
      const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? '';
      if (user?.email && adminEmail && user.email.toLowerCase() === adminEmail.toLowerCase()) {
        setIsAdmin(true);
      }
    });
  }, []);

  const fetchSignals = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (selectedCategory) params.set('category', selectedCategory);
    if (selectedRegion) params.set('region', selectedRegion);
    params.set('videoType', videoType);
    if (period === 'custom' && dateFrom) {
      params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
    } else if (period !== 'custom') {
      params.set('period', period);
    }
    const res = await fetch(`/api/trends/viral?${params}`);
    if (res.ok) {
      const data = await res.json();
      setSignals(data);
      setLastUpdated(new Date().toLocaleTimeString('ko-KR'));
    }
    setLoading(false);
  }, [selectedCategory, selectedRegion, videoType, period, dateFrom, dateTo]);

  useEffect(() => {
    fetchSignals();
  }, [fetchSignals]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { clearInterval(timer); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  function stripHtml(str: string): string {
    return str.replace(/<[^>]*>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#39;/g, "'");
  }

  function friendlyError(msg: string): string {
    const clean = stripHtml(msg);
    if (clean.includes('quotaExceeded') || clean.includes('quota')) return 'YouTube API 일일 할당량이 초과됐습니다. 내일 자동으로 리셋됩니다.';
    if (clean.includes('403')) return 'YouTube API 접근 권한 오류 (403). API 키를 확인해주세요.';
    if (clean.includes('401')) return 'YouTube API 인증 오류 (401). API 키를 확인해주세요.';
    return clean.length > 120 ? clean.slice(0, 120) + '…' : clean;
  }

  async function triggerCollect() {
    setCollecting(true);
    setCollectStatus(null);
    try {
      const res = await fetch('/api/trends/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          regions: selectedRegion ? [selectedRegion] : ['KR'],
          categories: selectedCategory ? [selectedCategory] : Object.keys(TREND_CATEGORIES),
          videoTypes: [videoType],
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        setCollectStatus({ ok: true, msg: '수집을 시작했습니다. 30초 후 자동으로 갱신됩니다.' });
        setCountdown(30);
        setTimeout(() => fetchSignals(), 30000);
      } else {
        setCollectStatus({ ok: false, msg: friendlyError(body.error ?? `오류 (${res.status})`) });
      }
    } catch (e) {
      setCollectStatus({ ok: false, msg: (e as Error).message });
    }
    setCollecting(false);
  }

  function formatViews(n: number) {
    if (n >= 100000000) return `${(n / 100000000).toFixed(1)}억`;
    if (n >= 10000) return `${(n / 10000).toFixed(1)}만`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}천`;
    return n.toLocaleString();
  }

  function formatHourlyRate(rate: number) {
    if (rate >= 10000) return `+${(rate / 10000).toFixed(1)}만/h`;
    if (rate >= 1000) return `+${(rate / 1000).toFixed(1)}천/h`;
    return `+${Math.round(rate).toLocaleString()}/h`;
  }

  function timeAgo(dateStr: string) {
    const diff = (Date.now() - new Date(dateStr).getTime()) / 60000;
    if (diff < 60) return `${Math.round(diff)}분 전`;
    if (diff < 1440) return `${Math.round(diff / 60)}시간 전`;
    return `${Math.round(diff / 1440)}일 전`;
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="w-7 h-7 flex items-center justify-center rounded-lg shrink-0" style={{ background: 'rgba(79,142,247,0.06)', border: '1px solid rgba(79,142,247,0.22)', color: '#4f8ef7' }}>
            <TrendingUp size={13} strokeWidth={1.8} />
          </span>
          <div>
            <span className="text-sm font-semibold text-white">급상승 영상</span>
            {lastUpdated && (
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-faint)' }}>최종 갱신: {lastUpdated}</p>
            )}
          </div>
        </div>
      </div>

      {/* 수집 결과 메시지 */}
      {collectStatus && (
        <div
          className="rounded-xl overflow-hidden text-sm"
          style={{
            background: collectStatus.ok ? 'rgba(56,189,248,0.06)' : 'rgba(239,68,68,0.06)',
            border: `1px solid ${collectStatus.ok ? 'rgba(56,189,248,0.25)' : 'rgba(239,68,68,0.25)'}`,
          }}
        >
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2.5">
              <span
                className="flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-bold shrink-0"
                style={{
                  background: collectStatus.ok ? 'rgba(56,189,248,0.15)' : 'rgba(239,68,68,0.15)',
                  color: collectStatus.ok ? '#4f8ef7' : '#ef4444',
                }}
              >
                {collectStatus.ok ? '✓' : '✗'}
              </span>
              <span style={{ color: collectStatus.ok ? '#4f8ef7' : '#ef4444' }}>{collectStatus.msg}</span>
            </div>

            {/* 카운트다운 프로그레스 */}
            {collectStatus.ok && countdown > 0 && (
              <div className="flex items-center gap-3 shrink-0 ml-6">
                {/* 원형 카운트다운 */}
                <div className="relative w-9 h-9">
                  <svg className="w-9 h-9 -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(56,189,248,0.12)" strokeWidth="2.5" />
                    <circle
                      cx="18" cy="18" r="15" fill="none"
                      stroke="#4f8ef7" strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 15}`}
                      strokeDashoffset={`${2 * Math.PI * 15 * (1 - countdown / 30)}`}
                      style={{ transition: 'stroke-dashoffset 1s linear', filter: 'drop-shadow(0 0 4px rgba(56,189,248,0.6))' }}
                    />
                  </svg>
                  <span
                    className="absolute inset-0 flex items-center justify-center text-[11px] font-bold"
                    style={{ color: '#4f8ef7' }}
                  >
                    {countdown}
                  </span>
                </div>

                {/* 세그먼트 바 */}
                <div className="flex items-center gap-[3px]">
                  {Array.from({ length: 10 }).map((_, i) => {
                    const filled = Math.ceil(countdown / 3) > (9 - i);
                    return (
                      <div
                        key={i}
                        className="w-1.5 rounded-full transition-all duration-500"
                        style={{
                          height: i % 3 === 1 ? '14px' : '10px',
                          background: filled ? '#4f8ef7' : 'rgba(56,189,248,0.15)',
                          boxShadow: filled ? '0 0 5px rgba(56,189,248,0.5)' : 'none',
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 하단 씬 프로그레스 라인 */}
          {collectStatus.ok && countdown > 0 && (
            <div className="h-[2px] w-full" style={{ background: 'rgba(56,189,248,0.1)' }}>
              <div
                className="h-full"
                style={{
                  width: `${(countdown / 30) * 100}%`,
                  background: 'linear-gradient(90deg, #16a34a, #4f8ef7)',
                  boxShadow: '0 0 8px rgba(56,189,248,0.6)',
                  transition: 'width 1s linear',
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* 기간 필터 */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs shrink-0" style={{ color: 'var(--text-faint)' }}>기간</span>

        {/* 세그먼트 pill */}
        <div
          className="flex items-center gap-0.5 p-1 rounded-xl"
          style={{ background: 'var(--hover-bg)' }}
        >
          {([['6h','6시간'], ['24h','24시간'], ['1m','1개월'], ['3m','3개월'], ['6m','6개월'], ['1y','1년']] as const).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setPeriod(val)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200"
              style={
                period === val
                  ? {
                      background: 'linear-gradient(135deg, #4f8ef7, #16a34a)',
                      color: '#fff',
                      boxShadow: '0 0 10px rgba(56,189,248,0.35)',
                    }
                  : { color: 'var(--text-faint)' }
              }
            >
              {label}
            </button>
          ))}
        </div>

        {/* 날짜 범위 팝오버 */}
        <DateRangePicker
          dateFrom={dateFrom}
          dateTo={dateTo}
          isActive={period === 'custom'}
          onApply={(from, to) => {
            setDateFrom(from);
            setDateTo(to);
            setPeriod('custom');
          }}
        />

        {/* 지금 수집 버튼 */}
        {isAdmin && (
          <button
            onClick={triggerCollect}
            disabled={collecting || loading}
            className="px-3 py-1.5 rounded-lg text-xs transition-colors ml-2"
            style={{ border: '1px solid #4f8ef7', color: collecting ? 'var(--text-faint)' : '#4f8ef7', background: 'transparent' }}
          >
            {collecting ? '수집 중...' : '지금 수집'}
          </button>
        )}
      </div>

      {/* 일반/쇼츠 탭 */}
      <div className="flex items-center gap-1 p-1 rounded-lg w-fit" style={{ background: 'var(--hover-bg)' }}>
        {(['regular', 'short'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setVideoType(t)}
            className="px-4 py-1.5 rounded-md text-xs font-medium transition-colors"
            style={
              videoType === t
                ? { background: 'var(--sidebar)', color: 'var(--text)', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }
                : { color: 'var(--text-faint)' }
            }
          >
            {t === 'regular'
              ? <><Video size={13} className="inline-block mr-1.5 opacity-80" />일반 영상</>
              : <><Zap size={13} className="inline-block mr-1.5 opacity-80" />쇼츠</>
            }
          </button>
        ))}
      </div>

      {/* 국가 필터 */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs shrink-0" style={{ color: 'var(--text-faint)' }}>국가</span>
        <button
          onClick={() => setSelectedRegion('')}
          className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${selectedRegion === '' ? 'bg-[#4f8ef7]/10 border border-[#4f8ef7]/60 text-[#4f8ef7]' : ''}`}
          style={selectedRegion !== '' ? { border: '1px solid var(--border)', color: 'var(--text-muted)' } : {}}
        >
          전체
        </button>
        {Object.entries(SEARCH_REGIONS).map(([code, r]) => (
          <button
            key={code}
            onClick={() => setSelectedRegion(code)}
            className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${selectedRegion === code ? 'bg-[#4f8ef7]/10 border border-[#4f8ef7]/60 text-[#4f8ef7]' : ''}`}
            style={selectedRegion !== code ? { border: '1px solid var(--border)', color: 'var(--text-muted)' } : {}}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* 카테고리 필터 */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs shrink-0" style={{ color: 'var(--text-faint)' }}>카테고리</span>
        <button
          onClick={() => setSelectedCategory('')}
          className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
            selectedCategory === ''
              ? 'bg-[#4f8ef7]/10 border border-[#4f8ef7]/60 text-[#4f8ef7]'
              : ''
          }`}
          style={
            selectedCategory !== ''
              ? { border: '1px solid var(--border)', color: 'var(--text-muted)' }
              : {}
          }
        >
          전체
        </button>
        {Object.entries(TREND_CATEGORIES).map(([key, cat]) => (
          <button
            key={key}
            onClick={() => setSelectedCategory(key)}
            className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
              selectedCategory === key
                ? 'bg-[#4f8ef7]/10 border border-[#4f8ef7]/60 text-[#4f8ef7]'
                : ''
            }`}
            style={
              selectedCategory !== key
                ? { border: '1px solid var(--border)', color: 'var(--text-muted)' }
                : {}
            }
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* 영상 목록 */}
      {loading ? (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-[72px] animate-pulse" style={{ background: i % 2 === 0 ? 'var(--hover-bg)' : 'var(--sidebar)', borderBottom: '1px solid var(--border)' }} />
          ))}
        </div>
      ) : signals.length === 0 && (collecting || countdown > 0) ? (
        /* 수집 중 모던 UI */
        <div className="relative rounded-xl overflow-hidden py-16 flex flex-col items-center gap-6" style={{ border: '1px solid rgba(56,189,248,0.2)', background: 'radial-gradient(ellipse at 50% 0%, rgba(56,189,248,0.06) 0%, transparent 70%)' }}>
          {/* 오비트 애니메이션 */}
          <div className="relative w-16 h-16">
            <style>{`
              @keyframes orbit { from { transform: rotate(0deg) translateX(28px) rotate(0deg); } to { transform: rotate(360deg) translateX(28px) rotate(-360deg); } }
              @keyframes orbit2 { from { transform: rotate(120deg) translateX(28px) rotate(-120deg); } to { transform: rotate(480deg) translateX(28px) rotate(-480deg); } }
              @keyframes orbit3 { from { transform: rotate(240deg) translateX(28px) rotate(-240deg); } to { transform: rotate(600deg) translateX(28px) rotate(-600deg); } }
              @keyframes pulse-ring { 0%,100% { opacity:0.15; transform:scale(1); } 50% { opacity:0.4; transform:scale(1.15); } }
            `}</style>
            {/* 중심 원 */}
            <div className="absolute inset-0 rounded-full" style={{ background: 'rgba(56,189,248,0.12)', animation: 'pulse-ring 2s ease-in-out infinite' }} />
            <div className="absolute inset-[6px] rounded-full flex items-center justify-center" style={{ background: 'rgba(56,189,248,0.18)', boxShadow: '0 0 20px rgba(56,189,248,0.3)' }}>
              <div className="w-2 h-2 rounded-full bg-[#4f8ef7]" style={{ boxShadow: '0 0 8px #4f8ef7' }} />
            </div>
            {/* 오비트 점들 */}
            {[
              { anim: 'orbit 1.8s linear infinite', color: '#4f8ef7' },
              { anim: 'orbit2 1.8s linear infinite', color: '#86efac' },
              { anim: 'orbit3 1.8s linear infinite', color: '#4ade80' },
            ].map((o, i) => (
              <div key={i} className="absolute inset-0 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full" style={{ background: o.color, animation: o.anim, boxShadow: `0 0 6px ${o.color}` }} />
              </div>
            ))}
          </div>
          {/* 텍스트 */}
          <div className="text-center space-y-1.5">
            <p className="text-sm font-medium tracking-wide" style={{ color: '#4f8ef7' }}>YouTube 데이터 수집 중</p>
            <p className="text-xs" style={{ color: 'var(--text-faint)' }}>급상승 영상을 분석하고 있습니다. 잠시만 기다려주세요.</p>
          </div>
          {/* 스캔 라인 */}
          <div className="w-48 h-[1px] relative overflow-hidden rounded-full" style={{ background: 'rgba(56,189,248,0.12)' }}>
            <div className="absolute inset-y-0 w-16 rounded-full" style={{ background: 'linear-gradient(90deg, transparent, #4f8ef7, transparent)', animation: 'orbit 1.5s linear infinite', animationName: 'scanline' }} />
            <style>{`@keyframes scanline { 0% { left: -4rem; } 100% { left: 100%; } }`}</style>
            <div className="absolute inset-y-0 w-16 rounded-full" style={{ background: 'linear-gradient(90deg, transparent, #4f8ef7, transparent)', animation: 'scanline 1.5s linear infinite' }} />
          </div>
        </div>
      ) : signals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 rounded-xl" style={{ border: '1px dashed var(--border)' }}>
          <p className="text-2xl mb-2">📭</p>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>아직 수집된 바이럴 영상이 없습니다</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-faint)' }}>설정에서 카테고리를 선택하면 자동으로 수집됩니다</p>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
          {/* 정렬 바 */}
          <div className="px-5 py-2 flex items-center justify-end gap-1.5" style={{ background: 'var(--sidebar)', borderBottom: '1px solid var(--border)' }}>
            <ArrowUpDown size={11} style={{ color: 'var(--text-faint)' }} />
            <div className="flex items-center gap-0.5 p-0.5 rounded-lg" style={{ background: 'var(--hover-bg)' }}>
              {VIRAL_SORTS.map((s) => (
                <button key={s.key} onClick={() => setSortKey(s.key)}
                  className="px-2.5 py-1 rounded-md text-[11px] font-medium transition-all"
                  style={sortKey === s.key
                    ? { background: 'var(--sidebar)', color: '#4f8ef7', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }
                    : { color: 'var(--text-faint)' }}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          {/* 컬럼 헤더 */}
          <div
            className="grid text-[11px] font-semibold tracking-wider uppercase px-5 py-2.5"
            style={{ gridTemplateColumns: '40px 1fr 130px 100px 100px 80px 120px', color: 'var(--text-faint)', background: 'var(--hover-bg)', borderBottom: '1px solid var(--border)' }}
          >
            <span>순위</span>
            <span>영상 정보</span>
            <span className="text-right">채널</span>
            <span className="text-right">시간당 증가</span>
            <span className="text-right">총 조회수</span>
            <span className="text-right">게시일</span>
            <span className="text-right">액션</span>
          </div>
          {/* 테이블 바디 */}
          <div style={{ background: 'var(--sidebar)' }}>
            {sortedSignals.map((signal, idx) => {
              const video = signal.trend_videos;
              const channel = video.trend_channels;
              return (
                <div
                  key={signal.id}
                  className="grid items-center px-5 py-3 group"
                  style={{
                    gridTemplateColumns: '40px 1fr 130px 100px 100px 80px 120px',
                    borderBottom: idx < sortedSignals.length - 1 ? '1px solid var(--border)' : 'none',
                    cursor: 'default',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--hover-bg)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <span className="text-sm font-bold" style={{ color: idx < 3 ? '#4f8ef7' : 'var(--text-faint)' }}>
                    #{idx + 1}
                  </span>
                  <a
                    href={`https://www.youtube.com/watch?v=${video.video_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 min-w-0"
                    onClick={e => e.stopPropagation()}
                  >
                    {video.thumbnail ? (
                      <img src={video.thumbnail} alt={video.title ?? ''} className="w-[72px] h-[40px] rounded-lg object-cover shrink-0" />
                    ) : (
                      <div className="w-[72px] h-[40px] rounded-lg shrink-0" style={{ background: 'var(--hover-bg)' }} />
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate group-hover:text-[#4f8ef7] transition-colors" style={{ color: 'var(--text)' }}>
                        {video.title}
                      </p>
                      {video.category && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded mt-0.5 inline-block" style={{ border: '1px solid var(--border)', color: 'var(--text-faint)' }}>
                          {TREND_CATEGORIES[video.category]?.label ?? video.category}
                        </span>
                      )}
                    </div>
                  </a>
                  <div className="text-right min-w-0">
                    <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{channel?.channel_name ?? '—'}</p>
                    {channel?.avg_views ? (
                      <p className="text-[10px]" style={{ color: 'var(--text-faint)' }}>평균 {formatViews(channel.avg_views)}회</p>
                    ) : null}
                  </div>
                  <p className="text-xs font-bold text-right text-[#4f8ef7]">{formatHourlyRate(signal.growth_rate_hourly)}</p>
                  <p className="text-xs text-right font-medium" style={{ color: 'var(--text)' }}>{formatViews(signal.current_views)}회</p>
                  <p className="text-xs text-right" style={{ color: 'var(--text-faint)' }}>{timeAgo(video.published_at)}</p>
                  {/* 액션 버튼 */}
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      title="대본 생성"
                      onClick={() => {
                        const params = new URLSearchParams({ topic: video.title ?? '', category: video.category ?? '' });
                        router.push(`/dashboard/script?${params.toString()}`);
                      }}
                      className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold transition-all opacity-0 group-hover:opacity-100"
                      style={{ background: 'rgba(56,189,248,0.15)', color: '#4f8ef7', border: '1px solid rgba(56,189,248,0.3)' }}
                    >
                      <PenLine size={10} />대본
                    </button>
                    <button
                      title="캘린더에 추가"
                      onClick={() => {
                        const params = new URLSearchParams({ title: video.title ?? '', trendUrl: `https://www.youtube.com/watch?v=${video.video_id}` });
                        router.push(`/dashboard/calendar?${params.toString()}`);
                      }}
                      className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold transition-all opacity-0 group-hover:opacity-100"
                      style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-faint)', border: '1px solid var(--border)' }}
                    >
                      <CalendarPlus size={10} />
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
