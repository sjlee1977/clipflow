import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const category = searchParams.get('category');
  const region = searchParams.get('region');
  const videoType = searchParams.get('videoType');
  const period = searchParams.get('period') ?? '24h';
  const dateFrom = searchParams.get('dateFrom');
  const dateTo = searchParams.get('dateTo');
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 100);

  let since: string;
  let until: string | null = null;
  if (dateFrom) {
    since = new Date(dateFrom).toISOString();
    until = dateTo ? new Date(new Date(dateTo).setHours(23, 59, 59, 999)).toISOString() : null;
  } else {
    const periodHours: Record<string, number> = { '6h': 6, '24h': 24, '1m': 720, '3m': 2160, '6m': 4380, '1y': 8760 };
    since = new Date(Date.now() - (periodHours[period] ?? 24) * 3600000).toISOString();
  }

  // 1단계: viral 시그널 조회
  let signalQuery = supabase
    .from('trend_signals')
    .select('*')
    .eq('signal_type', 'viral')
    .gte('updated_at', since)
    .order('growth_rate_hourly', { ascending: false })
    .limit(limit);
  if (until) signalQuery = signalQuery.lte('updated_at', until);

  const { data: signals, error: signalError } = await signalQuery;
  if (signalError) {
    console.error('[viral API] signal error:', JSON.stringify(signalError));
    return NextResponse.json({ error: signalError.message }, { status: 500 });
  }
  console.log(`[viral API] signals found: ${signals?.length ?? 0}, since: ${since}, filters: category=${category} region=${region} videoType=${videoType}`);
  if (!signals || signals.length === 0) return NextResponse.json([]);

  const videoIds = signals.map((s) => s.video_id);

  // 2단계: 영상 정보 조회 (필터 없이 먼저 전체 조회)
  const { data: allVideos } = await supabase
    .from('trend_videos')
    .select('video_id, title, category, region, video_type')
    .in('video_id', videoIds);
  console.log(`[viral API] videos (no filter):`, JSON.stringify(allVideos));

  // 필터 적용
  let videoQuery = supabase
    .from('trend_videos')
    .select('video_id, title, thumbnail, category, region, video_type, published_at, channel_id')
    .in('video_id', videoIds);
  if (category) videoQuery = videoQuery.eq('category', category);
  if (region) videoQuery = videoQuery.eq('region', region);
  if (videoType) videoQuery = videoQuery.eq('video_type', videoType);

  const { data: videos, error: videoError } = await videoQuery;
  if (videoError) {
    console.error('[viral API] video error:', JSON.stringify(videoError));
    return NextResponse.json({ error: videoError.message }, { status: 500 });
  }
  console.log(`[viral API] videos (filtered): ${videos?.length ?? 0}`);
  if (!videos || videos.length === 0) return NextResponse.json([]);

  // 3단계: 채널 정보 조회
  const channelIds = [...new Set(videos.map((v) => v.channel_id).filter(Boolean))];
  let channelMap: Record<string, { channel_name: string; channel_thumbnail: string; avg_views: number }> = {};
  if (channelIds.length > 0) {
    const { data: channels } = await supabase
      .from('trend_channels')
      .select('channel_id, channel_name, channel_thumbnail, avg_views')
      .in('channel_id', channelIds);
    if (channels) {
      channelMap = Object.fromEntries(channels.map((c) => [c.channel_id, c]));
    }
  }

  // 4단계: 병합
  const videoMap = new Map(videos.map((v) => [v.video_id, v]));
  const result = signals
    .filter((s) => videoMap.has(s.video_id))
    .map((s) => {
      const video = videoMap.get(s.video_id)!;
      return {
        ...s,
        trend_videos: {
          ...video,
          trend_channels: channelMap[video.channel_id] ?? null,
        },
      };
    });

  return NextResponse.json(result);
}
