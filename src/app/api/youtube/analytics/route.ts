import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase-server';

async function refreshToken(
  refreshToken: string
): Promise<{ access_token: string; expiry: string } | null> {
  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.YOUTUBE_OAUTH_CLIENT_ID!,
        client_secret: process.env.YOUTUBE_OAUTH_CLIENT_SECRET!,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      access_token: data.access_token,
      expiry: new Date(Date.now() + (data.expires_in ?? 3600) * 1000).toISOString(),
    };
  } catch {
    return null;
  }
}

const TRAFFIC_LABELS: Record<string, string> = {
  YT_SEARCH: 'YouTube 검색',
  BROWSE_FEATURES: 'YouTube 홈/탐색',
  RELATED_VIDEO: '추천 영상',
  EXTERNAL: '외부 링크',
  YT_CHANNEL: '채널 홈',
  NO_LINK_EMBEDDED: '삽입 영상',
  NOTIFICATION: '알림',
  PLAYLIST: '재생목록',
  SHORTS: 'Shorts',
  END_SCREEN: '최종화면',
  SUBSCRIBER: '구독 피드',
};

export async function GET(req: NextRequest) {
  // OAuth 설정 확인
  if (!process.env.YOUTUBE_OAUTH_CLIENT_ID || !process.env.YOUTUBE_OAUTH_CLIENT_SECRET) {
    return NextResponse.json({ status: 'not_configured' });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = await createAdminClient();
  const { data: tokenRow, error: tokenError } = await admin
    .from('youtube_oauth_tokens')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!tokenRow) return NextResponse.json({ status: 'not_connected' });

  let accessToken: string = tokenRow.access_token;

  // 만료 시 갱신
  if (new Date(tokenRow.expiry) <= new Date(Date.now() + 60000)) {
    if (!tokenRow.refresh_token) {
      await admin.from('youtube_oauth_tokens').delete().eq('user_id', user.id);
      return NextResponse.json({ status: 'not_connected' });
    }
    const refreshed = await refreshToken(tokenRow.refresh_token);
    if (!refreshed) {
      return NextResponse.json({ status: 'not_connected' });
    }
    accessToken = refreshed.access_token;
    await admin
      .from('youtube_oauth_tokens')
      .update({ access_token: refreshed.access_token, expiry: refreshed.expiry, updated_at: new Date().toISOString() })
      .eq('user_id', user.id);
  }

  const { searchParams } = new URL(req.url);
  const endDate = new Date().toISOString().slice(0, 10);
  const periodDays: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 };
  const days = periodDays[searchParams.get('period') ?? '30d'] ?? 30;
  const startDate = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

  const authHeader = { Authorization: `Bearer ${accessToken}` };

  async function fetchReport(params: Record<string, string>) {
    const url = new URL('https://youtubeanalytics.googleapis.com/v2/reports');
    url.searchParams.set('ids', 'channel==MINE');
    url.searchParams.set('startDate', startDate);
    url.searchParams.set('endDate', endDate);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const res = await fetch(url.toString(), { headers: authHeader });
    if (!res.ok) throw new Error(`HTTP_${res.status}:${await res.text()}`);
    return res.json();
  }

  try {
    // 일별 기본 지표 (모든 채널 접근 가능)
    const daily = await fetchReport({
      metrics: 'views,estimatedMinutesWatched',
      dimensions: 'day',
      sort: 'day',
    });

    // 일별 수익 지표 (수익화 채널만, 실패해도 무시)
    const dailyRevenue = await fetchReport({
      metrics: 'estimatedRevenue,estimatedAdRevenue,estimatedRedPartnerRevenue,cpm',
      dimensions: 'day',
      sort: 'day',
    }).catch(() => ({ rows: [] }));

    // 상위 영상 (기본 지표)
    const topVideos = await fetchReport({
      metrics: 'views,estimatedMinutesWatched',
      dimensions: 'video',
      sort: '-views',
      maxResults: '10',
    }).catch(() => ({ rows: [] }));

    // 유입 경로
    const traffic = await fetchReport({
      metrics: 'views,estimatedMinutesWatched',
      dimensions: 'insightTrafficSourceType',
      sort: '-views',
    }).catch(() => ({ rows: [] }));

    // 수익 데이터를 day 기준으로 매핑
    const revenueByDay = new Map<string, number[]>();
    for (const r of (dailyRevenue.rows ?? [])) {
      revenueByDay.set(String(r[0]), [Number(r[1]), Number(r[2]), Number(r[3]), Number(r[4])]);
    }

    // 집계 (day, views, revenue, adRevenue, premiumRevenue, cpm, watchMinutes)
    const rows: number[][] = (daily.rows ?? []).map((r: (string | number)[]) => {
      const rev = revenueByDay.get(String(r[0])) ?? [0, 0, 0, 0];
      return [r[0], Number(r[1]), rev[0], rev[1], rev[2], rev[3], Number(r[2])];
    });

    const totals = rows.reduce(
      (acc, r) => ({
        views: acc.views + r[1],
        revenue: acc.revenue + r[2],
        adRevenue: acc.adRevenue + r[3],
        premiumRevenue: acc.premiumRevenue + r[4],
        watchMinutes: acc.watchMinutes + r[6],
      }),
      { views: 0, revenue: 0, adRevenue: 0, premiumRevenue: 0, watchMinutes: 0 }
    );

    const avgCpm =
      rows.length > 0 ? rows.reduce((s, r) => s + r[5], 0) / (rows.filter(r => r[5] > 0).length || 1) : 0;

    // 유입 경로 변환
    const trafficRows = ((traffic.rows ?? []) as [string, number, number][]).map(([src, views, minutes]) => ({
      source: TRAFFIC_LABELS[src] ?? src,
      views,
      watchMinutes: minutes,
    }));

    return NextResponse.json({
      status: 'connected',
      channel: {
        id: tokenRow.channel_id,
        name: tokenRow.channel_name,
        thumbnail: tokenRow.channel_thumbnail,
      },
      period: { startDate, endDate, days },
      totals: { ...totals, avgCpm },
      dailyRows: rows,
      topVideos: topVideos.rows ?? [],
      trafficSources: trafficRows,
    });
  } catch (err) {
    const msg = (err as Error).message;
    if (msg.includes('HTTP_401')) {
      // 토큰 만료/무효 → 삭제 후 재연결 유도
      await admin.from('youtube_oauth_tokens').delete().eq('user_id', user.id);
      return NextResponse.json({ status: 'not_connected' });
    }
    if (msg.includes('HTTP_403') || msg.includes('unauthorized') || msg.includes('Insufficient permission')) {
      // 권한 없음 (수익화 미가입 등) → 토큰 유지, 에러 메시지 표시
      return NextResponse.json({
        status: 'connected',
        channel: {
          id: tokenRow.channel_id,
          name: tokenRow.channel_name,
          thumbnail: tokenRow.channel_thumbnail,
        },
        period: { startDate, endDate, days },
        totals: { views: 0, revenue: 0, adRevenue: 0, premiumRevenue: 0, watchMinutes: 0, avgCpm: 0 },
        dailyRows: [],
        topVideos: [],
        trafficSources: [],
        error: 'YouTube Analytics 데이터에 접근할 수 없습니다. 채널이 YouTube 파트너 프로그램(수익 창출)에 가입되어 있어야 합니다.',
      });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const admin = await createAdminClient();
  await admin.from('youtube_oauth_tokens').delete().eq('user_id', user.id);
  return NextResponse.json({ ok: true });
}
