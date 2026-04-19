'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { Users, TrendingUp, Eye, ArrowUpDown } from 'lucide-react';

type SubSort = 'score' | 'views' | 'publishedAt';
const SUB_SORTS: { key: SubSort; label: string }[] = [
  { key: 'score',      label: '지표순' },
  { key: 'views',      label: '조회수순' },
  { key: 'publishedAt', label: '최신순' },
];
import { TREND_CATEGORIES, SEARCH_REGIONS } from '@/lib/youtube-trends';
import { createClient } from '@/lib/supabase-browser';

type SignalType = 'views_per_sub' | 'subscriber_growth';

interface SubSignal {
  id: string;
  video_id: string;
  signal_type: SignalType;
  current_views: number;
  subscriber_count: number;
  views_per_sub: number;
  subscriber_growth_rate: number;
  score: number;
  updated_at: string;
  trend_videos: {
    video_id: string;
    title: string;
    thumbnail: string;
    category: string;
    region: string;
    video_type: string;
    published_at: string;
    channel_id: string;
    trend_channels: {
      channel_name: string;
      channel_thumbnail: string;
      avg_views: number;
      subscriber_count: number;
    } | null;
  };
}

const SUB_RANGES = [
  { label: '전체', min: undefined, max: undefined },
  { label: '1만 미만', min: undefined, max: 10000 },
  { label: '1만~10만', min: 10000, max: 100000 },
  { label: '10만~100만', min: 100000, max: 1000000 },
  { label: '100만 이상', min: 1000000, max: undefined },
];

export default function SubscriberPage() {
  const [signals, setSignals] = useState<SubSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [signalType, setSignalType] = useState<SignalType>('views_per_sub');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('');
  const [videoType, setVideoType] = useState<'regular' | 'short'>('regular');
  const [period, setPeriod] = useState('24h');
  const [subRangeIdx, setSubRangeIdx] = useState(0);
  const [collecting, setCollecting] = useState(false);
  const [collectStatus, setCollectStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [sortKey, setSortKey] = useState<SubSort>('score');

  const sortedSignals = useMemo(() => {
    const arr = [...signals];
    if (sortKey === 'views') return arr.sort((a, b) => b.current_views - a.current_views);
    if (sortKey === 'publishedAt') return arr.sort((a, b) => new Date(b.trend_videos.published_at).getTime() - new Date(a.trend_videos.published_at).getTime());
    return arr.sort((a, b) => b.score - a.score);
  }, [signals, sortKey]);

  const subRange = SUB_RANGES[subRangeIdx];

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
    const params = new URLSearchParams({ signalType, period, videoType, limit: '100' });
    if (selectedCategory) params.set('category', selectedCategory);
    if (selectedRegion) params.set('region', selectedRegion);
    if (subRange.min) params.set('subMin', String(subRange.min));
    if (subRange.max) params.set('subMax', String(subRange.max));

    const res = await fetch(`/api/trends/subscriber?${params}`);
    if (res.ok) {
      setSignals(await res.json());
      setLastUpdated(new Date().toLocaleTimeString('ko-KR'));
    }
    setLoading(false);
  }, [signalType, period, videoType, selectedCategory, selectedRegion, subRange]);

  useEffect(() => { fetchSignals(); }, [fetchSignals]);

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
          subscriberRange: subRange.min || subRange.max
            ? { min: subRange.min, max: subRange.max }
            : undefined,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        setCollectStatus({ ok: true, msg: '수집을 시작했습니다. 잠시 후 자동으로 갱신됩니다.' });
        setTimeout(() => fetchSignals(), 15000);
      } else {
        setCollectStatus({ ok: false, msg: body.error ?? `오류 (${res.status})` });
      }
    } catch (e) {
      setCollectStatus({ ok: false, msg: (e as Error).message });
    }
    setCollecting(false);
  }

  function formatNum(n: number | null | undefined) {
    if (n == null) return '—';
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

  return (
    <div className="space-y-6 px-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between mt-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <span className="w-7 h-7 flex items-center justify-center rounded-lg shrink-0" style={{ background: 'rgba(79,142,247,0.06)', border: '1px solid rgba(79,142,247,0.22)', color: '#4f8ef7' }}>
              <Users size={13} strokeWidth={1.8} />
            </span>
            <span className="text-[19px] font-semibold text-white leading-none mt-0.5" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>구독자 분석</span>
          </div>
          {lastUpdated && (
            <p className="text-[11px] pl-10" style={{ color: 'var(--text-faint)' }}>최종 갱신: {lastUpdated}</p>
          )}
        </div>
      </div>

      {/* 수집 결과 */}
      {collectStatus && (
        <div className="px-4 py-2.5 rounded-lg text-sm"
          style={{
            background: collectStatus.ok ? 'rgba(56,189,248,0.08)' : 'rgba(239,68,68,0.08)',
            border: `1px solid ${collectStatus.ok ? 'rgba(56,189,248,0.3)' : 'rgba(239,68,68,0.3)'}`,
            color: collectStatus.ok ? '#4f8ef7' : '#ef4444',
          }}>
          {collectStatus.ok ? '✓ ' : '✗ '}{collectStatus.msg}
        </div>
      )}

      {/* 시그널 타입 탭 */}
      <div className="flex items-center gap-1 p-1 rounded-lg w-fit" style={{ background: 'var(--hover-bg)' }}>
        {([
          ['views_per_sub', '구독자 대비 조회수', Eye],
          ['subscriber_growth', '구독자 급성장', TrendingUp],
        ] as const).map(([type, label, Icon]) => (
          <button
            key={type}
            onClick={() => setSignalType(type)}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-medium transition-colors"
            style={
              signalType === type
                ? { background: 'var(--sidebar)', color: 'var(--text)', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }
                : { color: 'var(--text-faint)' }
            }
          >
            <Icon size={12} className="opacity-80" />{label}
          </button>
        ))}
      </div>

      {/* 기간 필터 */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs shrink-0" style={{ color: 'var(--text-faint)' }}>기간</span>
        <div className="flex items-center gap-0.5 p-1 rounded-xl" style={{ background: 'var(--hover-bg)' }}>
          {([['6h','6시간'], ['24h','24시간'], ['1w','1주일'], ['1m','1개월'], ['3m','3개월']] as const).map(([val, label]) => (
            <button key={val} onClick={() => setPeriod(val)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200"
              style={period === val
                ? { background: 'linear-gradient(135deg, #4f8ef7, #16a34a)', color: '#fff', boxShadow: '0 0 10px rgba(56,189,248,0.35)' }
                : { color: 'var(--text-faint)' }}>
              {label}
            </button>
          ))}
        </div>

      </div>

      {/* 구독자 범위 필터 */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs shrink-0 flex items-center gap-1" style={{ color: 'var(--text-faint)' }}>
          <Users size={11} />구독자
        </span>
        {SUB_RANGES.map((r, i) => (
          <button key={i} onClick={() => setSubRangeIdx(i)}
            className="cf-filter-btn px-3 py-1.5 rounded-lg text-xs transition-colors"
            style={subRangeIdx === i
              ? { background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.6)', color: '#4f8ef7' }
              : { border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
            {r.label}
          </button>
        ))}
      </div>

      {/* 일반/쇼츠 탭 */}
      <div className="flex items-center gap-1 p-1 rounded-lg w-fit" style={{ background: 'var(--hover-bg)' }}>
        {(['regular', 'short'] as const).map((t) => (
          <button key={t} onClick={() => setVideoType(t)}
            className="cf-filter-btn px-4 py-1.5 rounded-md text-xs font-medium transition-colors"
            style={videoType === t
              ? { background: 'var(--sidebar)', color: 'var(--text)', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }
              : { color: 'var(--text-faint)' }}>
            {t === 'regular' ? '일반 영상' : '쇼츠'}
          </button>
        ))}
      </div>

      {/* 국가 / 카테고리 필터 */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs shrink-0" style={{ color: 'var(--text-faint)' }}>국가</span>
        <button onClick={() => setSelectedRegion('')}
          className="cf-filter-btn px-3 py-1.5 rounded-lg text-xs transition-colors"
          style={selectedRegion === ''
            ? { background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.6)', color: '#4f8ef7' }
            : { border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
          전체
        </button>
        {Object.entries(SEARCH_REGIONS).map(([code, r]) => (
          <button key={code} onClick={() => setSelectedRegion(code)}
            className="cf-filter-btn px-3 py-1.5 rounded-lg text-xs transition-colors"
            style={selectedRegion === code
              ? { background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.6)', color: '#4f8ef7' }
              : { border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
            {r.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs shrink-0" style={{ color: 'var(--text-faint)' }}>카테고리</span>
        <button onClick={() => setSelectedCategory('')}
          className="cf-filter-btn px-3 py-1.5 rounded-lg text-xs transition-colors"
          style={selectedCategory === ''
            ? { background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.6)', color: '#4f8ef7' }
            : { border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
          전체
        </button>
        {Object.entries(TREND_CATEGORIES).map(([key, cat]) => (
          <button key={key} onClick={() => setSelectedCategory(key)}
            className="cf-filter-btn px-3 py-1.5 rounded-lg text-xs transition-colors"
            style={selectedCategory === key
              ? { background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.6)', color: '#4f8ef7' }
              : { border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
            {cat.label}
          </button>
        ))}
        {isAdmin && (
          <button
            onClick={triggerCollect}
            disabled={collecting || loading}
            className="px-2.5 py-1.5 rounded-lg text-xs transition-colors ml-1"
            style={{ border: '1px solid #4f8ef7', color: collecting ? 'var(--text-faint)' : '#4f8ef7', background: 'transparent' }}
          >
            {collecting ? '수집 중...' : '지금 수집'}
          </button>
        )}
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
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {signalType === 'views_per_sub' ? '구독자 대비 조회수 이상 영상이 없습니다' : '구독자 급성장 채널이 없습니다'}
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-faint)' }}>"지금 수집" 버튼을 눌러 데이터를 수집하세요</p>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
          {/* 정렬 바 */}
          <div className="px-5 py-2 flex items-center justify-end gap-1.5" style={{ background: 'var(--sidebar)', borderBottom: '1px solid var(--border)' }}>
            <ArrowUpDown size={11} style={{ color: 'var(--text-faint)' }} />
            <div className="flex items-center gap-0.5 p-0.5 rounded-lg" style={{ background: 'var(--hover-bg)' }}>
              {SUB_SORTS.map((s) => (
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
            style={{ gridTemplateColumns: '40px 1fr 140px 110px 100px 80px', color: 'var(--text-faint)', background: 'var(--hover-bg)', borderBottom: '1px solid var(--border)' }}
          >
            <span>순위</span>
            <span>영상 정보</span>
            <span className="text-right">채널 / 구독자</span>
            <span className="text-right">{signalType === 'views_per_sub' ? '조회율' : '구독자 성장률'}</span>
            <span className="text-right">조회수</span>
            <span className="text-right">게시일</span>
          </div>
          {/* 테이블 바디 */}
          <div style={{ background: 'var(--sidebar)' }}>
            {sortedSignals.map((signal, idx) => {
              const video = signal.trend_videos;
              const channel = video.trend_channels;
              return (
                <a
                  key={signal.id}
                  href={`https://www.youtube.com/watch?v=${video.video_id}`}
                  target="_blank" rel="noopener noreferrer"
                  className="grid items-center px-5 py-3 group"
                  style={{
                    gridTemplateColumns: '40px 1fr 140px 110px 100px 80px',
                    borderBottom: idx < sortedSignals.length - 1 ? '1px solid var(--border)' : 'none',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--hover-bg)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <span className="text-sm font-bold" style={{ color: idx < 3 ? '#4f8ef7' : 'var(--text-faint)' }}>#{idx + 1}</span>
                  <div className="flex items-center gap-3 min-w-0">
                    {video.thumbnail ? (
                      <img src={video.thumbnail} alt={video.title} className="w-[72px] h-[40px] rounded-lg object-cover shrink-0" />
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
                    {channel?.subscriber_count != null && (
                      <p className="text-[10px] flex items-center justify-end gap-0.5" style={{ color: 'var(--text-faint)' }}>
                        <Users size={9} />{formatNum(channel.subscriber_count)}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    {signalType === 'views_per_sub' ? (
                      <p className="text-xs font-bold text-[#4f8ef7]">{(signal.views_per_sub * 100).toFixed(1)}%</p>
                    ) : (
                      <p className="text-xs font-bold text-[#4f8ef7]">+{(signal.subscriber_growth_rate * 100).toFixed(2)}%/h</p>
                    )}
                  </div>
                  <p className="text-xs text-right font-medium" style={{ color: 'var(--text)' }}>{formatNum(signal.current_views)}회</p>
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
