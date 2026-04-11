'use client';

import { useState, useMemo } from 'react';
import { Search, TrendingUp, Swords, Tag, BarChart2, ExternalLink, ArrowUpDown } from 'lucide-react';

type SortKey = 'relevance' | 'views' | 'likes' | 'publishedAt';
const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'relevance',  label: '관련도순' },
  { key: 'views',      label: '조회수순' },
  { key: 'likes',      label: '좋아요순' },
  { key: 'publishedAt', label: '최신순' },
];

interface KeywordResult {
  keyword: string;
  searchVolume: { label: string; level: number };
  competition: { score: number; label: string };
  topTags: string[];
  totalResults: number;
  topVideos: {
    rank: number;
    videoId: string;
    title: string;
    thumbnail: string;
    channelName: string;
    channelThumbnail: string;
    subscriberCount: number;
    views: number;
    likeCount: number;
    publishedAt: string;
  }[];
}

const VOLUME_COLORS: Record<number, string> = {
  5: '#22c55e',
  4: '#86efac',
  3: '#facc15',
  2: '#fb923c',
  1: '#f87171',
  0: 'var(--text-faint)',
};

const COMPETITION_COLOR = (score: number) => {
  if (score >= 70) return '#ef4444';
  if (score >= 40) return '#facc15';
  return '#22c55e';
};

function formatNum(n: number) {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`;
  if (n >= 10_000) return `${(n / 10_000).toFixed(1)}만`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}천`;
  return n.toLocaleString();
}

function timeAgo(dateStr: string) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 86400000;
  if (diff < 1) return '오늘';
  if (diff < 30) return `${Math.round(diff)}일 전`;
  if (diff < 365) return `${Math.round(diff / 30)}개월 전`;
  return `${Math.round(diff / 365)}년 전`;
}

export default function KeywordPage() {
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<KeywordResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('relevance');

  const sortedVideos = useMemo(() => {
    if (!result) return [];
    const videos = [...result.topVideos];
    if (sortKey === 'views') return videos.sort((a, b) => b.views - a.views);
    if (sortKey === 'likes') return videos.sort((a, b) => b.likeCount - a.likeCount);
    if (sortKey === 'publishedAt') return videos.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
    return videos; // relevance: 원래 순서
  }, [result, sortKey]);

  async function analyze() {
    if (!keyword.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/keyword/analyze?keyword=${encodeURIComponent(keyword.trim())}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '분석 오류');
      setResult(data);
    } catch (e) {
      setError((e as Error).message);
    }
    setLoading(false);
  }

  const volColor = result ? VOLUME_COLORS[result.searchVolume.level] : '#22c55e';
  const compColor = result ? COMPETITION_COLOR(result.competition.score) : '#22c55e';

  return (
    <div className="space-y-6 max-w-5xl">
      {/* 헤더 */}
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2" style={{ color: 'var(--text)' }}>
          <BarChart2 size={20} className="text-[#22c55e]" />
          키워드 분석
        </h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
          YouTube 키워드를 입력하고 데이터 기반의 인사이트를 얻으세요.
        </p>
      </div>

      {/* 검색 입력 */}
      <div className="flex gap-2">
        <div
          className="flex-1 flex items-center gap-2.5 px-4 rounded-xl"
          style={{ background: 'var(--sidebar)', border: '1px solid var(--border)' }}
        >
          <Search size={15} style={{ color: 'var(--text-faint)' }} />
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && analyze()}
            placeholder="분석할 키워드를 입력하세요 (예: 홈트레이닝)"
            className="flex-1 bg-transparent outline-none py-3 text-sm"
            style={{ color: 'var(--text)' }}
          />
        </div>
        <button
          onClick={analyze}
          disabled={loading || !keyword.trim()}
          className="px-5 py-3 rounded-xl text-sm font-medium transition-all"
          style={{
            background: loading || !keyword.trim() ? 'var(--hover-bg)' : 'linear-gradient(135deg, #22c55e, #16a34a)',
            color: loading || !keyword.trim() ? 'var(--text-faint)' : '#fff',
            boxShadow: loading || !keyword.trim() ? 'none' : '0 0 16px rgba(34,197,94,0.3)',
          }}
        >
          {loading ? '분석 중...' : '분석하기'}
        </button>
      </div>

      {/* 에러 */}
      {error && (
        <div className="px-4 py-3 rounded-xl text-sm" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444' }}>
          ✗ {error}
        </div>
      )}

      {/* 로딩 스켈레톤 */}
      {loading && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-[100px] rounded-xl animate-pulse" style={{ background: 'var(--hover-bg)' }} />
            ))}
          </div>
          <div className="h-[300px] rounded-xl animate-pulse" style={{ background: 'var(--hover-bg)' }} />
        </div>
      )}

      {/* 결과 */}
      {result && !loading && (
        <div className="space-y-5">
          {/* 3개 지표 카드 */}
          <div className="grid grid-cols-3 gap-4">
            {/* 검색량 */}
            <div
              className="p-5 rounded-xl flex flex-col gap-3"
              style={{ background: 'var(--sidebar)', border: '1px solid var(--border)' }}
            >
              <div className="flex items-center gap-2">
                <TrendingUp size={14} style={{ color: volColor }} />
                <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: 'var(--text-faint)' }}>검색량 추정</span>
              </div>
              <div>
                <p className="text-xl font-bold" style={{ color: volColor }}>{result.searchVolume.label}</p>
                <div className="flex gap-1 mt-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className="flex-1 h-1.5 rounded-full transition-all"
                      style={{ background: i <= result.searchVolume.level ? volColor : 'var(--hover-bg)' }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* 경쟁 강도 */}
            <div
              className="p-5 rounded-xl flex flex-col gap-3"
              style={{ background: 'var(--sidebar)', border: '1px solid var(--border)' }}
            >
              <div className="flex items-center gap-2">
                <Swords size={14} style={{ color: compColor }} />
                <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: 'var(--text-faint)' }}>경쟁 강도</span>
              </div>
              <div>
                <div className="flex items-end gap-2">
                  <p className="text-xl font-bold" style={{ color: compColor }}>{result.competition.label}</p>
                  <p className="text-xs mb-0.5" style={{ color: 'var(--text-faint)' }}>{result.competition.score}/100</p>
                </div>
                <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--hover-bg)' }}>
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${result.competition.score}%`,
                      background: `linear-gradient(90deg, #22c55e, ${compColor})`,
                      boxShadow: `0 0 8px ${compColor}60`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* 추천 태그 */}
            <div
              className="p-5 rounded-xl flex flex-col gap-3"
              style={{ background: 'var(--sidebar)', border: '1px solid var(--border)' }}
            >
              <div className="flex items-center gap-2">
                <Tag size={14} className="text-[#22c55e]" />
                <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: 'var(--text-faint)' }}>추천 태그 Top 10</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {result.topTags.length > 0 ? result.topTags.map((tag) => (
                  <span
                    key={tag}
                    className="text-[11px] px-2 py-0.5 rounded-lg"
                    style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', color: '#22c55e' }}
                  >
                    {tag}
                  </span>
                )) : (
                  <span className="text-xs" style={{ color: 'var(--text-faint)' }}>태그 데이터 없음</span>
                )}
              </div>
            </div>
          </div>

          {/* 상위 영상 테이블 */}
          <div
            className="rounded-xl overflow-hidden"
            style={{ border: '1px solid var(--border)' }}
          >
            <div className="px-5 py-3.5 flex items-center gap-3 flex-wrap" style={{ borderBottom: '1px solid var(--border)', background: 'var(--sidebar)' }}>
              <BarChart2 size={14} className="text-[#22c55e]" />
              <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>상위 노출 영상 상세 분석</span>
              <span className="text-xs" style={{ color: 'var(--text-faint)' }}>상위 {result.topVideos.length}개</span>
              {/* 정렬 */}
              <div className="ml-auto flex items-center gap-1.5">
                <ArrowUpDown size={12} style={{ color: 'var(--text-faint)' }} />
                <div className="flex items-center gap-0.5 p-0.5 rounded-lg" style={{ background: 'var(--hover-bg)' }}>
                  {SORT_OPTIONS.map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => setSortKey(opt.key)}
                      className="px-2.5 py-1 rounded-md text-[11px] font-medium transition-all"
                      style={
                        sortKey === opt.key
                          ? { background: 'var(--sidebar)', color: '#22c55e', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }
                          : { color: 'var(--text-faint)' }
                      }
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 테이블 헤더 */}
            <div
              className="grid text-[11px] font-semibold tracking-wider uppercase px-5 py-2.5"
              style={{
                gridTemplateColumns: '40px 1fr 110px 90px 80px 80px',
                color: 'var(--text-faint)',
                background: 'var(--hover-bg)',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <span>순위</span>
              <span>영상 정보</span>
              <span className="text-right">채널</span>
              <span className="text-right">조회수</span>
              <span className="text-right">좋아요</span>
              <span className="text-right">게시일</span>
            </div>

            {/* 테이블 바디 */}
            <div style={{ background: 'var(--sidebar)' }}>
              {sortedVideos.map((video, idx) => (
                <a
                  key={video.videoId}
                  href={`https://www.youtube.com/watch?v=${video.videoId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="grid items-center px-5 py-3 transition-colors group"
                  style={{
                    gridTemplateColumns: '40px 1fr 110px 90px 80px 80px',
                    borderBottom: idx < sortedVideos.length - 1 ? '1px solid var(--border)' : 'none',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--hover-bg)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  {/* 순위 */}
                  <span
                    className="text-sm font-bold"
                    style={{ color: idx < 3 ? '#22c55e' : 'var(--text-faint)' }}
                  >
                    #{video.rank}
                  </span>

                  {/* 영상 정보 */}
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={video.thumbnail}
                      alt={video.title}
                      className="w-[72px] h-[40px] rounded-lg object-cover shrink-0"
                    />
                    <div className="min-w-0">
                      <p
                        className="text-xs font-medium truncate group-hover:text-[#22c55e] transition-colors"
                        style={{ color: 'var(--text)' }}
                      >
                        {video.title}
                      </p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <ExternalLink size={10} style={{ color: 'var(--text-ultra)' }} />
                        <span className="text-[10px]" style={{ color: 'var(--text-ultra)' }}>YouTube</span>
                      </div>
                    </div>
                  </div>

                  {/* 채널 */}
                  <div className="text-right min-w-0">
                    <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{video.channelName}</p>
                    {video.subscriberCount > 0 && (
                      <p className="text-[10px]" style={{ color: 'var(--text-faint)' }}>
                        구독 {formatNum(video.subscriberCount)}
                      </p>
                    )}
                  </div>

                  {/* 조회수 */}
                  <p className="text-xs text-right font-medium" style={{ color: 'var(--text)' }}>
                    {formatNum(video.views)}회
                  </p>

                  {/* 좋아요 */}
                  <p className="text-xs text-right" style={{ color: 'var(--text-muted)' }}>
                    {formatNum(video.likeCount)}
                  </p>

                  {/* 게시일 */}
                  <p className="text-xs text-right" style={{ color: 'var(--text-faint)' }}>
                    {timeAgo(video.publishedAt)}
                  </p>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
