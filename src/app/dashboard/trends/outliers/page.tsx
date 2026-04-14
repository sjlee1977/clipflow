'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { ArrowUpDown, Zap } from 'lucide-react';
import { TREND_CATEGORIES, SEARCH_REGIONS } from '@/lib/youtube-trends';

type OutlierSort = 'multiplier' | 'views' | 'publishedAt';
const OUTLIER_SORTS: { key: OutlierSort; label: string }[] = [
  { key: 'multiplier',  label: '배율순' },
  { key: 'views',       label: '조회수순' },
  { key: 'publishedAt', label: '최신순' },
];
import DateRangePicker from '@/components/DateRangePicker';

interface OutlierSignal {
  id: string;
  current_views: number;
  channel_avg_views: number;
  multiplier: number;
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
      subscriber_count: number;
      avg_views: number;
    } | null;
  };
}

export default function OutliersPage() {
  const [signals, setSignals] = useState<OutlierSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [collecting, setCollecting] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('');
  const [videoType, setVideoType] = useState<'regular' | 'short'>('regular');
  const [period, setPeriod] = useState('24h');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<OutlierSort>('multiplier');

  const sortedSignals = useMemo(() => {
    const arr = [...signals];
    if (sortKey === 'views') return arr.sort((a, b) => b.current_views - a.current_views);
    if (sortKey === 'publishedAt') return arr.sort((a, b) => new Date(b.trend_videos.published_at).getTime() - new Date(a.trend_videos.published_at).getTime());
    return arr.sort((a, b) => b.multiplier - a.multiplier);
  }, [signals, sortKey]);

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
    const res = await fetch(`/api/trends/outliers?${params}`);
    if (res.ok) {
      const data = await res.json();
      setSignals(data);
      setLastUpdated(new Date().toLocaleTimeString('ko-KR'));
    }
    setLoading(false);
  }, [selectedCategory, selectedRegion, videoType, period, dateFrom, dateTo]);

  async function triggerCollect() {
    setCollecting(true);
    const res = await fetch('/api/trends/trigger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        regions: selectedRegion ? [selectedRegion] : ['KR'],
        categories: selectedCategory ? [selectedCategory] : [],
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok) {
      await fetchSignals();
    } else {
      alert(body.error ?? '수집 실패');
    }
    setCollecting(false);
  }

  useEffect(() => {
    fetchSignals();
  }, [fetchSignals]);

  function formatViews(n: number) {
    if (n >= 100000000) return `${(n / 100000000).toFixed(1)}억`;
    if (n >= 10000) return `${(n / 10000).toFixed(1)}만`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}천`;
    return n.toLocaleString();
  }

  function timeAgo(dateStr: string) {
    const diff = (Date.now() - new Date(dateStr).getTime()) / 60000;
    if (diff < 60) return `${Math.round(diff)}분 전`;
    if (diff < 1440) return `${Math.round(diff / 60)}시간 전`;
    return `${Math.round(diff / 1440)}일 전`;
  }

  function multiplierColor(x: number) {
    if (x >= 10) return '#4f8ef7';
    if (x >= 5) return '#f59e0b';
    return '#64748b';
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="w-7 h-7 flex items-center justify-center rounded-lg shrink-0" style={{ background: 'rgba(79,142,247,0.06)', border: '1px solid rgba(79,142,247,0.22)', color: '#4f8ef7' }}>
            <Zap size={13} strokeWidth={1.8} />
          </span>
          <div>
            <span className="text-sm font-semibold text-white">채널 이상치 영상</span>
            {lastUpdated && (
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-faint)' }}>최종 갱신: {lastUpdated}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={triggerCollect}
            disabled={collecting || loading}
            className="px-2.5 py-1 rounded-lg text-xs transition-colors"
            style={{
              border: '1px solid #4f8ef7',
              color: collecting ? 'var(--text-faint)' : '#4f8ef7',
              background: 'transparent',
            }}
          >
            {collecting ? '수집 중...' : '지금 수집'}
          </button>
        </div>
      </div>

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
      </div>

      {/* 일반/쇼츠 탭 */}
      <div className="flex items-center gap-1 p-1 rounded-lg w-fit" style={{ background: 'var(--hover-bg)' }}>
        {(['regular', 'short'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setVideoType(t)}
            className="px-4 py-1.5 rounded-md text-sm font-medium transition-colors"
            style={
              videoType === t
                ? { background: 'var(--sidebar)', color: 'var(--text)', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }
                : { color: 'var(--text-faint)' }
            }
          >
            {t === 'regular' ? '📹 일반 영상' : '⚡ 쇼츠'}
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
      ) : signals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 rounded-xl" style={{ border: '1px dashed var(--border)' }}>
          <p className="text-2xl mb-2">📭</p>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>아직 수집된 이상치 영상이 없습니다</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-faint)' }}>설정에서 카테고리를 선택하면 자동으로 수집됩니다</p>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
          {/* 정렬 바 */}
          <div className="px-5 py-2 flex items-center justify-end gap-1.5" style={{ background: 'var(--sidebar)', borderBottom: '1px solid var(--border)' }}>
            <ArrowUpDown size={11} style={{ color: 'var(--text-faint)' }} />
            <div className="flex items-center gap-0.5 p-0.5 rounded-lg" style={{ background: 'var(--hover-bg)' }}>
              {OUTLIER_SORTS.map((s) => (
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
            style={{ gridTemplateColumns: '40px 1fr 130px 100px 100px 70px 80px', color: 'var(--text-faint)', background: 'var(--hover-bg)', borderBottom: '1px solid var(--border)' }}
          >
            <span>순위</span>
            <span>영상 정보</span>
            <span className="text-right">채널</span>
            <span className="text-right">채널 평균</span>
            <span className="text-right">현재 조회수</span>
            <span className="text-right">배율</span>
            <span className="text-right">게시일</span>
          </div>
          {/* 테이블 바디 */}
          <div style={{ background: 'var(--sidebar)' }}>
            {sortedSignals.map((signal, idx) => {
              const video = signal.trend_videos;
              const channel = video.trend_channels;
              const mult = signal.multiplier;
              return (
                <a
                  key={signal.id}
                  href={`https://www.youtube.com/watch?v=${video.video_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="grid items-center px-5 py-3 group"
                  style={{
                    gridTemplateColumns: '40px 1fr 130px 100px 100px 70px 80px',
                    borderBottom: idx < sortedSignals.length - 1 ? '1px solid var(--border)' : 'none',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--hover-bg)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <span className="text-sm font-bold" style={{ color: idx < 3 ? '#4f8ef7' : 'var(--text-faint)' }}>#{idx + 1}</span>
                  <div className="flex items-center gap-3 min-w-0">
                    {video.thumbnail ? (
                      <img src={video.thumbnail} alt={video.title ?? ''} className="w-[72px] h-[40px] rounded-lg object-cover shrink-0" />
                    ) : (
                      <div className="w-[72px] h-[40px] rounded-lg shrink-0" style={{ background: 'var(--hover-bg)' }} />
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate group-hover:text-[#4f8ef7] transition-colors" style={{ color: 'var(--text)' }}>{video.title}</p>
                      {video.category && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded mt-0.5 inline-block" style={{ border: '1px solid var(--border)', color: 'var(--text-faint)' }}>
                          {TREND_CATEGORIES[video.category]?.label ?? video.category}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right min-w-0">
                    <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{channel?.channel_name ?? '—'}</p>
                    {channel?.subscriber_count ? (
                      <p className="text-[10px]" style={{ color: 'var(--text-faint)' }}>구독 {formatViews(channel.subscriber_count)}</p>
                    ) : null}
                  </div>
                  <p className="text-xs text-right" style={{ color: 'var(--text-muted)' }}>{formatViews(signal.channel_avg_views)}회</p>
                  <p className="text-xs text-right font-medium" style={{ color: 'var(--text)' }}>{formatViews(signal.current_views)}회</p>
                  <p className="text-sm font-bold text-right" style={{ color: multiplierColor(mult) }}>{mult.toFixed(1)}x</p>
                  <p className="text-xs text-right" style={{ color: 'var(--text-faint)' }}>{timeAgo(video.published_at)}</p>
                </a>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
