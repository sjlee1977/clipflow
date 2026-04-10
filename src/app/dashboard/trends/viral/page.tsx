'use client';

import { useEffect, useState, useCallback } from 'react';
import { Video, Zap } from 'lucide-react';
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
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>
            🔥 급상승 영상
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            시간당 조회수 증가량이 급격히 높은 영상
            {lastUpdated && (
              <span className="ml-2 text-[11px]" style={{ color: 'var(--text-faint)' }}>
                최종 갱신: {lastUpdated}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={triggerCollect}
              disabled={collecting || loading}
              className="px-2.5 py-1 rounded-lg text-xs transition-colors"
              style={{
                border: '1px solid #22c55e',
                color: collecting ? 'var(--text-faint)' : '#22c55e',
                background: 'transparent',
              }}
            >
              {collecting ? '수집 중...' : '지금 수집'}
            </button>
          )}
        </div>
      </div>

      {/* 수집 결과 메시지 */}
      {collectStatus && (
        <div
          className="px-4 py-2.5 rounded-lg text-sm"
          style={{
            background: collectStatus.ok ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
            border: `1px solid ${collectStatus.ok ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
            color: collectStatus.ok ? '#22c55e' : '#ef4444',
          }}
        >
          {collectStatus.ok ? '✓ ' : '✗ '}{collectStatus.msg}
          {collectStatus.ok && !collectStatus.msg.includes('바이럴 0개') === false && (
            <span className="ml-2 opacity-70 text-xs">— 바이럴 감지는 2번째 수집부터 동작합니다</span>
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
                      background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                      color: '#fff',
                      boxShadow: '0 0 10px rgba(34,197,94,0.35)',
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
          className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${selectedRegion === '' ? 'bg-[#22c55e]/10 border border-[#22c55e]/60 text-[#22c55e]' : ''}`}
          style={selectedRegion !== '' ? { border: '1px solid var(--border)', color: 'var(--text-muted)' } : {}}
        >
          전체
        </button>
        {Object.entries(SEARCH_REGIONS).map(([code, r]) => (
          <button
            key={code}
            onClick={() => setSelectedRegion(code)}
            className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${selectedRegion === code ? 'bg-[#22c55e]/10 border border-[#22c55e]/60 text-[#22c55e]' : ''}`}
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
              ? 'bg-[#22c55e]/10 border border-[#22c55e]/60 text-[#22c55e]'
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
                ? 'bg-[#22c55e]/10 border border-[#22c55e]/60 text-[#22c55e]'
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
        <div className="grid grid-cols-1 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-[88px] rounded-xl animate-pulse"
              style={{ background: 'var(--hover-bg)' }}
            />
          ))}
        </div>
      ) : signals.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-20 rounded-xl"
          style={{ border: '1px dashed var(--border)' }}
        >
          <p className="text-2xl mb-2">📭</p>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            아직 수집된 바이럴 영상이 없습니다
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-faint)' }}>
            설정에서 카테고리를 선택하면 자동으로 수집됩니다
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {signals.map((signal, idx) => {
            const video = signal.trend_videos;
            const channel = video.trend_channels;
            return (
              <a
                key={signal.id}
                href={`https://www.youtube.com/watch?v=${video.video_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-4 p-4 rounded-xl transition-colors group"
                style={{
                  border: '1px solid var(--border)',
                  background: 'var(--sidebar)',
                }}
              >
                {/* 순위 */}
                <span
                  className="text-sm font-bold shrink-0 w-6 text-center"
                  style={{ color: idx < 3 ? '#22c55e' : 'var(--text-faint)' }}
                >
                  {idx + 1}
                </span>

                {/* 썸네일 */}
                {video.thumbnail ? (
                  <img
                    src={video.thumbnail}
                    alt={video.title ?? ''}
                    className="w-[100px] h-[56px] rounded-lg object-cover shrink-0"
                  />
                ) : (
                  <div
                    className="w-[100px] h-[56px] rounded-lg shrink-0"
                    style={{ background: 'var(--hover-bg)' }}
                  />
                )}

                {/* 정보 */}
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm font-medium truncate group-hover:text-[#22c55e] transition-colors"
                    style={{ color: 'var(--text)' }}
                  >
                    {video.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    {channel?.channel_name && (
                      <span className="text-xs" style={{ color: 'var(--text-faint)' }}>
                        {channel.channel_name}
                      </span>
                    )}
                    <span className="text-xs" style={{ color: 'var(--text-faint)' }}>
                      · {timeAgo(video.published_at)}
                    </span>
                    {video.category && (
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded"
                        style={{ border: '1px solid var(--border)', color: 'var(--text-faint)' }}
                      >
                        {TREND_CATEGORIES[video.category]?.label ?? video.category}
                      </span>
                    )}
                  </div>
                </div>

                {/* 지표 */}
                <div className="shrink-0 text-right space-y-1">
                  <p className="text-sm font-bold text-[#22c55e]">
                    {formatHourlyRate(signal.growth_rate_hourly)}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    총 {formatViews(signal.current_views)}회
                  </p>
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
