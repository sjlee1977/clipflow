'use client';

import { useEffect, useState, useCallback } from 'react';
import { Users, TrendingUp, Eye } from 'lucide-react';
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

  const subRange = SUB_RANGES[subRangeIdx];

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
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
        const s = body.summary;
        setCollectStatus({
          ok: s?.errors?.length === 0,
          msg: `수집 완료 — 영상 ${s?.discovered ?? 0}개 | 구독자비율 ${s?.viewsPerSub ?? 0}개 | 구독자급성장 ${s?.subscriberGrowth ?? 0}개`,
        });
        await fetchSignals();
      } else {
        setCollectStatus({ ok: false, msg: body.error ?? `오류 (${res.status})` });
      }
    } catch (e) {
      setCollectStatus({ ok: false, msg: (e as Error).message });
    }
    setCollecting(false);
  }

  function formatNum(n: number) {
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
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2" style={{ color: 'var(--text)' }}>
            <Users size={20} className="text-[#22c55e]" />
            구독자 분석
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            구독자 기반 이상 감지 — 구독자 대비 조회수 급등 / 구독자 급성장 채널
            {lastUpdated && (
              <span className="ml-2 text-[11px]" style={{ color: 'var(--text-faint)' }}>
                최종 갱신: {lastUpdated}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* 수집 결과 */}
      {collectStatus && (
        <div className="px-4 py-2.5 rounded-lg text-sm"
          style={{
            background: collectStatus.ok ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
            border: `1px solid ${collectStatus.ok ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
            color: collectStatus.ok ? '#22c55e' : '#ef4444',
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
                ? { background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: '#fff', boxShadow: '0 0 10px rgba(34,197,94,0.35)' }
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
            className="px-3 py-1.5 rounded-lg text-xs transition-colors"
            style={subRangeIdx === i
              ? { background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.6)', color: '#22c55e' }
              : { border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
            {r.label}
          </button>
        ))}
      </div>

      {/* 일반/쇼츠 탭 */}
      <div className="flex items-center gap-1 p-1 rounded-lg w-fit" style={{ background: 'var(--hover-bg)' }}>
        {(['regular', 'short'] as const).map((t) => (
          <button key={t} onClick={() => setVideoType(t)}
            className="px-4 py-1.5 rounded-md text-xs font-medium transition-colors"
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
          className="px-3 py-1.5 rounded-lg text-xs transition-colors"
          style={selectedRegion === ''
            ? { background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.6)', color: '#22c55e' }
            : { border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
          전체
        </button>
        {Object.entries(SEARCH_REGIONS).map(([code, r]) => (
          <button key={code} onClick={() => setSelectedRegion(code)}
            className="px-3 py-1.5 rounded-lg text-xs transition-colors"
            style={selectedRegion === code
              ? { background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.6)', color: '#22c55e' }
              : { border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
            {r.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs shrink-0" style={{ color: 'var(--text-faint)' }}>카테고리</span>
        <button onClick={() => setSelectedCategory('')}
          className="px-3 py-1.5 rounded-lg text-xs transition-colors"
          style={selectedCategory === ''
            ? { background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.6)', color: '#22c55e' }
            : { border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
          전체
        </button>
        {Object.entries(TREND_CATEGORIES).map(([key, cat]) => (
          <button key={key} onClick={() => setSelectedCategory(key)}
            className="px-3 py-1.5 rounded-lg text-xs transition-colors"
            style={selectedCategory === key
              ? { background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.6)', color: '#22c55e' }
              : { border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
            {cat.label}
          </button>
        ))}
        {isAdmin && (
          <button
            onClick={triggerCollect}
            disabled={collecting || loading}
            className="px-2.5 py-1.5 rounded-lg text-xs transition-colors ml-1"
            style={{ border: '1px solid #22c55e', color: collecting ? 'var(--text-faint)' : '#22c55e', background: 'transparent' }}
          >
            {collecting ? '수집 중...' : '지금 수집'}
          </button>
        )}
      </div>

      {/* 영상 목록 */}
      {loading ? (
        <div className="grid grid-cols-1 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-[88px] rounded-xl animate-pulse" style={{ background: 'var(--hover-bg)' }} />
          ))}
        </div>
      ) : signals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 rounded-xl"
          style={{ border: '1px dashed var(--border)' }}>
          <p className="text-2xl mb-2">📭</p>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {signalType === 'views_per_sub' ? '구독자 대비 조회수 이상 영상이 없습니다' : '구독자 급성장 채널이 없습니다'}
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-faint)' }}>
            "지금 수집" 버튼을 눌러 데이터를 수집하세요
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {signals.map((signal, idx) => {
            const video = signal.trend_videos;
            const channel = video.trend_channels;
            return (
              <a key={signal.id}
                href={`https://www.youtube.com/watch?v=${video.video_id}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-4 p-4 rounded-xl transition-colors group"
                style={{ border: '1px solid var(--border)', background: 'var(--sidebar)' }}>

                {/* 순위 */}
                <span className="text-sm font-bold shrink-0 w-6 text-center"
                  style={{ color: idx < 3 ? '#22c55e' : 'var(--text-faint)' }}>
                  {idx + 1}
                </span>

                {/* 썸네일 */}
                {video.thumbnail ? (
                  <img src={video.thumbnail} alt={video.title}
                    className="w-[100px] h-[56px] rounded-lg object-cover shrink-0" />
                ) : (
                  <div className="w-[100px] h-[56px] rounded-lg shrink-0" style={{ background: 'var(--hover-bg)' }} />
                )}

                {/* 정보 */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate group-hover:text-[#22c55e] transition-colors"
                    style={{ color: 'var(--text)' }}>
                    {video.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    {channel?.channel_name && (
                      <span className="text-xs" style={{ color: 'var(--text-faint)' }}>{channel.channel_name}</span>
                    )}
                    {channel?.subscriber_count != null && (
                      <span className="text-xs flex items-center gap-0.5" style={{ color: 'var(--text-faint)' }}>
                        <Users size={10} />
                        {formatNum(channel.subscriber_count)}
                      </span>
                    )}
                    <span className="text-xs" style={{ color: 'var(--text-faint)' }}>· {timeAgo(video.published_at)}</span>
                    {video.category && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded"
                        style={{ border: '1px solid var(--border)', color: 'var(--text-faint)' }}>
                        {TREND_CATEGORIES[video.category]?.label ?? video.category}
                      </span>
                    )}
                  </div>
                </div>

                {/* 지표 */}
                <div className="shrink-0 text-right space-y-1">
                  {signalType === 'views_per_sub' ? (
                    <>
                      <p className="text-sm font-bold text-[#22c55e] flex items-center gap-1 justify-end">
                        <Eye size={12} />
                        {(signal.views_per_sub * 100).toFixed(1)}%
                      </p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        조회 {formatNum(signal.current_views)}회
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-bold text-[#22c55e] flex items-center gap-1 justify-end">
                        <TrendingUp size={12} />
                        +{(signal.subscriber_growth_rate * 100).toFixed(2)}%/h
                      </p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        구독자 {formatNum(signal.subscriber_count)}명
                      </p>
                    </>
                  )}
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
