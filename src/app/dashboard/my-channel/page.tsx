'use client';

import { useEffect, useState } from 'react';
import { Tv, ExternalLink, Unlink, TrendingUp, Eye, Clock, DollarSign, RefreshCw } from 'lucide-react';
import { useSearchParams } from 'next/navigation';

interface Channel { id: string; name: string; thumbnail: string }
interface Totals {
  views: number; revenue: number; adRevenue: number;
  premiumRevenue: number; watchMinutes: number; avgCpm: number;
}
interface DailyRow { day: string; views: number; revenue: number; cpm: number }
interface TrafficSource { source: string; views: number; watchMinutes: number }
interface AnalyticsData {
  status: 'connected' | 'not_connected' | 'not_configured';
  channel?: Channel;
  period?: { startDate: string; endDate: string; days: number };
  totals?: Totals;
  dailyRows?: (string | number)[][];
  topVideos?: (string | number)[][];
  trafficSources?: TrafficSource[];
  error?: string;
}

const PERIODS = [
  { key: '7d', label: '7일' }, { key: '30d', label: '30일' },
  { key: '90d', label: '90일' }, { key: '1y', label: '1년' },
];

function fmtMoney(n: number) {
  if (n === 0) return '$0.00';
  return `$${n.toFixed(2)}`;
}
function fmtN(n: number) {
  if (n >= 100000000) return `${(n / 100000000).toFixed(1)}억`;
  if (n >= 10000) return `${(n / 10000).toFixed(1)}만`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}천`;
  return n.toLocaleString();
}
function fmtMinutes(m: number) {
  if (m >= 60) return `${(m / 60).toFixed(1)}시간`;
  return `${Math.round(m)}분`;
}

export default function MyChannelPage() {
  const searchParams = useSearchParams();
  const [period, setPeriod] = useState('30d');
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const connectedParam = searchParams.get('connected');
  const errorParam = searchParams.get('error');

  async function fetchData(p = period) {
    setLoading(true);
    try {
      const res = await fetch(`/api/youtube/analytics?period=${p}`);
      const json = await res.json();
      setData(json);
    } catch { /* ignore */ }
    setLoading(false);
  }

  useEffect(() => { fetchData(); }, []);
  useEffect(() => {
    if (data?.status === 'connected') fetchData(period);
  }, [period]);

  async function handleConnect() {
    setConnecting(true);
    try {
      const res = await fetch('/api/youtube/oauth');
      const { authUrl, error } = await res.json();
      if (error) { alert(error); setConnecting(false); return; }
      window.location.href = authUrl;
    } catch { setConnecting(false); }
  }

  async function handleDisconnect() {
    if (!confirm('YouTube 계정 연결을 해제하시겠습니까?')) return;
    setDisconnecting(true);
    await fetch('/api/youtube/analytics', { method: 'DELETE' });
    setData({ status: 'not_connected' });
    setDisconnecting(false);
  }

  async function handleRefresh() {
    setRefreshing(true);
    await fetchData(period);
    setRefreshing(false);
  }

  const daily: DailyRow[] = (data?.dailyRows ?? []).map(r => ({
    day: String(r[0]), views: Number(r[1]),
    revenue: Number(r[2]), cpm: Number(r[5]),
  }));
  const maxRevenue = Math.max(...daily.map(d => d.revenue), 0.001);

  // ── not_configured ─────────────────────────────────────────────────────────
  if (!loading && data?.status === 'not_configured') {
    return (
      <div className="space-y-6">
        <PageHeader />
        <div className="max-w-xl space-y-5">
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(245,158,11,0.25)', background: 'rgba(245,158,11,0.04)' }}>
            <div className="px-5 py-3" style={{ borderBottom: '1px solid rgba(245,158,11,0.15)' }}>
              <p className="text-[13px] font-semibold" style={{ color: '#f59e0b' }}>Google OAuth 설정 필요</p>
            </div>
            <div className="px-5 py-4 space-y-4 text-[12px]" style={{ color: 'var(--text)' }}>
              <p style={{ color: 'var(--text-muted)' }}>수익 데이터에 접근하려면 Google OAuth 인증이 필요합니다. 아래 단계를 따라 설정해주세요.</p>
              <ol className="space-y-3 list-none">
                {[
                  { n: 1, text: 'Google Cloud Console에서 프로젝트 선택 또는 신규 생성', link: 'https://console.cloud.google.com', linkLabel: 'Cloud Console 열기' },
                  { n: 2, text: 'YouTube Analytics API 및 YouTube Data API v3 활성화' },
                  { n: 3, text: '사용자 인증 정보 → OAuth 2.0 클라이언트 ID 생성 (웹 애플리케이션)' },
                  { n: 4, text: '승인된 리디렉션 URI에 추가:', extra: `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/youtube/oauth/callback` },
                  { n: 5, text: '.env 파일에 아래 변수 추가:' },
                ].map(item => (
                  <li key={item.n} className="flex gap-3">
                    <span className="w-5 h-5 rounded flex items-center justify-center text-[11px] font-bold shrink-0"
                      style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>
                      {item.n}
                    </span>
                    <div className="space-y-1">
                      <p style={{ color: 'var(--text)' }}>{item.text}</p>
                      {item.link && (
                        <a href={item.link} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[11px] hover:underline"
                          style={{ color: '#4f8ef7' }}>
                          {item.linkLabel} <ExternalLink size={10} />
                        </a>
                      )}
                      {item.extra && (
                        <code className="block text-[11px] px-2 py-1 rounded font-mono"
                          style={{ background: 'rgba(255,255,255,0.06)', color: '#4f8ef7' }}>
                          {item.extra}
                        </code>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
              <div className="rounded-lg px-4 py-3 font-mono text-[11px] space-y-1"
                style={{ background: 'rgba(0,0,0,0.3)', color: '#4ade80' }}>
                <p>YOUTUBE_OAUTH_CLIENT_ID=<span style={{ color: 'var(--text-faint)' }}>your-client-id</span></p>
                <p>YOUTUBE_OAUTH_CLIENT_SECRET=<span style={{ color: 'var(--text-faint)' }}>your-client-secret</span></p>
              </div>
              <p className="text-[11px]" style={{ color: 'var(--text-faint)' }}>설정 후 Next.js 서버를 재시작하면 이 화면이 사라집니다.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── not_connected ───────────────────────────────────────────────────────────
  if (!loading && data?.status === 'not_connected') {
    return (
      <div className="space-y-6">
        <PageHeader />
        {errorParam && (
          <div className="max-w-xl px-4 py-3 rounded-xl text-[12px]"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}>
            {errorParam === 'cancelled' ? '연결이 취소되었습니다.' : `연결 오류: ${errorParam}`}
          </div>
        )}
        <div className="max-w-md">
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            <div className="px-6 py-8 flex flex-col items-center gap-5 text-center"
              style={{ background: 'var(--sidebar)' }}>
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ background: 'rgba(79,142,247,0.08)', border: '1px solid rgba(79,142,247,0.2)' }}>
                <Tv size={28} style={{ color: '#4f8ef7', opacity: 0.7 }} />
              </div>
              <div>
                <p className="text-[15px] font-semibold" style={{ color: 'var(--text)' }}>YouTube 채널 연결</p>
                <p className="text-[12px] mt-1.5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  채널 수익(CPM), 광고 유형별 성과,<br />조회수·시청 시간·유입 경로를 분석합니다.
                </p>
              </div>
              <ul className="text-left space-y-2 w-full">
                {['수익 및 CPM 일별 추이', '광고 수익 vs YouTube Premium 수익', '상위 영상별 수익', '유입 경로 분석 (검색/추천/홈 등)'].map(item => (
                  <li key={item} className="flex items-center gap-2 text-[12px]" style={{ color: 'var(--text-muted)' }}>
                    <span style={{ color: '#4ade80' }}>✓</span> {item}
                  </li>
                ))}
              </ul>
              <button
                onClick={handleConnect} disabled={connecting}
                className="w-full py-2.5 rounded-xl text-[13px] font-semibold transition-all"
                style={{
                  background: connecting ? 'rgba(79,142,247,0.1)' : 'linear-gradient(135deg, rgba(79,142,247,0.25), rgba(79,142,247,0.15))',
                  border: '1px solid rgba(79,142,247,0.4)', color: connecting ? 'rgba(79,142,247,0.4)' : '#4f8ef7',
                }}
              >
                {connecting ? '연결 중...' : 'YouTube 계정 연결'}
              </button>
              <p className="text-[10px]" style={{ color: 'var(--text-faint)' }}>
                읽기 전용 권한만 요청합니다. 영상 업로드·삭제 불가.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── loading ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader />
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 rounded-xl animate-pulse"
              style={{ background: 'var(--sidebar)', border: '1px solid var(--border)' }} />
          ))}
        </div>
      </div>
    );
  }

  // ── connected ───────────────────────────────────────────────────────────────
  const totals = data?.totals;
  const ch = data?.channel;

  return (
    <div className="space-y-6 px-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {ch?.thumbnail && (
            <img src={ch.thumbnail} alt={ch.name} className="w-9 h-9 rounded-full" />
          )}
          <div>
            <span className="text-[19px] font-semibold text-white leading-none translate-y-px">{ch?.name ?? '내 채널'}</span>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-faint)' }}>
              {data?.period?.startDate} ~ {data?.period?.endDate}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleRefresh} disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] transition-all"
            style={{ border: '1px solid var(--border)', color: refreshing ? 'var(--text-faint)' : 'var(--text-muted)', background: 'transparent' }}>
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />갱신
          </button>
          <button onClick={handleDisconnect} disabled={disconnecting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] transition-all"
            style={{ border: '1px solid rgba(239,68,68,0.3)', color: 'rgba(239,68,68,0.6)', background: 'transparent' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(239,68,68,0.6)')}
          >
            <Unlink size={12} />연결 해제
          </button>
        </div>
      </div>

      {/* 기간 선택 */}
      <div className="flex items-center gap-0.5 p-1 rounded-xl w-fit" style={{ background: 'var(--hover-bg)' }}>
        {PERIODS.map(p => (
          <button key={p.key} onClick={() => setPeriod(p.key)}
            className="px-4 py-1.5 rounded-lg text-[12px] font-medium transition-all"
            style={period === p.key
              ? { background: 'linear-gradient(135deg, #4f8ef7, #16a34a)', color: '#fff', boxShadow: '0 0 10px rgba(56,189,248,0.35)' }
              : { color: 'var(--text-faint)' }}>
            {p.label}
          </button>
        ))}
      </div>

      {/* 요약 카드 4개 */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { icon: <DollarSign size={16} />, label: '총 수익', value: fmtMoney(totals?.revenue ?? 0), sub: `광고 ${fmtMoney(totals?.adRevenue ?? 0)} + Premium ${fmtMoney(totals?.premiumRevenue ?? 0)}`, color: '#4ade80' },
          { icon: <TrendingUp size={16} />, label: '평균 CPM', value: `$${(totals?.avgCpm ?? 0).toFixed(2)}`, sub: '1,000회당 수익', color: '#4f8ef7' },
          { icon: <Eye size={16} />, label: '총 조회수', value: fmtN(totals?.views ?? 0), sub: '기간 합산', color: '#f59e0b' },
          { icon: <Clock size={16} />, label: '시청 시간', value: fmtMinutes(totals?.watchMinutes ?? 0), sub: '기간 합산', color: '#c084fc' },
        ].map(card => (
          <div key={card.label} className="rounded-xl px-5 py-4 space-y-1"
            style={{ border: '1px solid var(--border)', background: 'var(--sidebar)' }}>
            <div className="flex items-center gap-2 mb-2" style={{ color: card.color, opacity: 0.8 }}>
              {card.icon}
              <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-faint)' }}>{card.label}</span>
            </div>
            <p className="text-[22px] font-bold" style={{ color: 'var(--text)' }}>{card.value}</p>
            <p className="text-[10px]" style={{ color: 'var(--text-faint)' }}>{card.sub}</p>
          </div>
        ))}
      </div>

      {/* 일별 수익 차트 */}
      {daily.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
          <div className="px-5 py-3" style={{ background: 'var(--sidebar)', borderBottom: '1px solid var(--border)' }}>
            <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-faint)' }}>
              일별 수익
            </p>
          </div>
          <div className="px-5 py-4" style={{ background: 'var(--bg)' }}>
            <div className="flex items-end gap-0.5 h-32">
              {daily.map((d, i) => {
                const pct = maxRevenue > 0 ? (d.revenue / maxRevenue) * 100 : 0;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-0.5 group relative">
                    <div className="absolute bottom-full mb-1 bg-black/80 text-white text-[9px] px-1.5 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10">
                      {d.day} · {fmtMoney(d.revenue)}
                    </div>
                    <div className="w-full rounded-sm transition-all"
                      style={{
                        height: `${Math.max(pct, 2)}%`,
                        background: pct > 70 ? 'linear-gradient(180deg, #4ade80, #16a34a)' :
                          pct > 30 ? 'linear-gradient(180deg, #4f8ef7, #2563eb)' :
                            'rgba(79,142,247,0.3)',
                      }} />
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between mt-1.5">
              <span className="text-[9px]" style={{ color: 'var(--text-faint)' }}>{daily[0]?.day}</span>
              <span className="text-[9px]" style={{ color: 'var(--text-faint)' }}>{daily[daily.length - 1]?.day}</span>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-5">
        {/* 유입 경로 */}
        {(data?.trafficSources ?? []).length > 0 && (
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            <div className="px-5 py-3" style={{ background: 'var(--sidebar)', borderBottom: '1px solid var(--border)' }}>
              <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-faint)' }}>유입 경로</p>
            </div>
            <div className="px-5 py-3 space-y-2.5" style={{ background: 'var(--bg)' }}>
              {(() => {
                const sources = data?.trafficSources ?? [];
                const maxViews = Math.max(...sources.map(s => s.views), 1);
                return sources.slice(0, 8).map((s, i) => (
                  <div key={i} className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span style={{ color: 'var(--text-muted)' }}>{s.source}</span>
                      <span style={{ color: 'var(--text-faint)' }}>{fmtN(s.views)}회</span>
                    </div>
                    <div className="h-1 rounded-full" style={{ background: 'rgba(79,142,247,0.1)' }}>
                      <div className="h-full rounded-full"
                        style={{ width: `${(s.views / maxViews) * 100}%`, background: 'linear-gradient(90deg, #4f8ef7, #4ade80)' }} />
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        )}

        {/* 상위 영상 수익 */}
        {(data?.topVideos ?? []).length > 0 && (
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            <div className="px-5 py-3" style={{ background: 'var(--sidebar)', borderBottom: '1px solid var(--border)' }}>
              <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-faint)' }}>상위 영상 수익</p>
            </div>
            <div className="divide-y" style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
              {(data?.topVideos ?? []).slice(0, 8).map((row, i) => (
                <a key={i}
                  href={`https://www.youtube.com/watch?v=${row[0]}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-between px-5 py-2.5 transition-colors"
                  style={{ borderColor: 'var(--border)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[11px] font-bold shrink-0"
                      style={{ color: i < 3 ? '#4f8ef7' : 'var(--text-faint)' }}>
                      #{i + 1}
                    </span>
                    <span className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
                      {String(row[0]).slice(0, 11)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[11px]" style={{ color: 'var(--text-faint)' }}>{fmtN(Number(row[1]))}회</span>
                    <span className="text-[12px] font-semibold" style={{ color: '#4ade80' }}>{fmtMoney(Number(row[2]))}</span>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PageHeader() {
  return (
    <div className="flex items-center gap-3 mt-4">
      <span className="w-7 h-7 flex items-center justify-center rounded-lg shrink-0"
        style={{ background: 'rgba(79,142,247,0.06)', border: '1px solid rgba(79,142,247,0.22)', color: '#4f8ef7' }}>
        <Tv size={13} strokeWidth={1.8} />
      </span>
      <div>
        <span className="text-[19px] font-semibold text-white leading-none translate-y-px">내 채널</span>
        <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-faint)' }}>
          YouTube Analytics · 수익 · CPM · 유입 경로
        </p>
      </div>
    </div>
  );
}
