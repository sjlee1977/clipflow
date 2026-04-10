import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const signalType = searchParams.get('signalType') ?? 'views_per_sub'; // views_per_sub | subscriber_growth
  const category = searchParams.get('category');
  const region = searchParams.get('region');
  const videoType = searchParams.get('videoType');
  const subMin = searchParams.get('subMin') ? parseInt(searchParams.get('subMin')!) : null;
  const subMax = searchParams.get('subMax') ? parseInt(searchParams.get('subMax')!) : null;
  const period = searchParams.get('period') ?? '24h';
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 100);

  const periodHours: Record<string, number> = { '6h': 6, '24h': 24, '1m': 720, '3m': 2160, '6m': 4380, '1y': 8760 };
  const since = new Date(Date.now() - (periodHours[period] ?? 24) * 3600000).toISOString();

  // 1단계: 시그널 조회
  const { data: signals, error: signalError } = await supabase
    .from('trend_signals')
    .select('*')
    .eq('signal_type', signalType)
    .gte('updated_at', since)
    .order('score', { ascending: false })
    .limit(limit);

  if (signalError) return NextResponse.json({ error: signalError.message }, { status: 500 });
  if (!signals || signals.length === 0) return NextResponse.json([]);

  const videoIds = signals.map((s) => s.video_id);

  // 2단계: 영상 정보 조회 (필터 적용)
  let videoQuery = supabase
    .from('trend_videos')
    .select('video_id, title, thumbnail, category, region, video_type, published_at, channel_id')
    .in('video_id', videoIds);
  if (category) videoQuery = videoQuery.eq('category', category);
  if (region) videoQuery = videoQuery.eq('region', region);
  if (videoType) videoQuery = videoQuery.eq('video_type', videoType);

  const { data: videos, error: videoError } = await videoQuery;
  if (videoError) return NextResponse.json({ error: videoError.message }, { status: 500 });
  if (!videos || videos.length === 0) return NextResponse.json([]);

  // 3단계: 채널 정보 조회 (구독자 범위 필터 포함)
  const channelIds = [...new Set(videos.map((v) => v.channel_id).filter(Boolean))];
  let channelQuery = supabase
    .from('trend_channels')
    .select('channel_id, channel_name, channel_thumbnail, avg_views, subscriber_count')
    .in('channel_id', channelIds);
  if (subMin) channelQuery = channelQuery.gte('subscriber_count', subMin);
  if (subMax) channelQuery = channelQuery.lte('subscriber_count', subMax);

  const { data: channels } = await channelQuery;
  const channelMap = new Map((channels ?? []).map((c) => [c.channel_id, c]));

  // 4단계: 병합 (채널 범위 필터 통과한 것만)
  const videoMap = new Map(videos.map((v) => [v.video_id, v]));
  const result = signals
    .filter((s) => {
      const video = videoMap.get(s.video_id);
      if (!video) return false;
      return channelMap.has(video.channel_id);
    })
    .map((s) => {
      const video = videoMap.get(s.video_id)!;
      return {
        ...s,
        trend_videos: {
          ...video,
          trend_channels: channelMap.get(video.channel_id) ?? null,
        },
      };
    });

  return NextResponse.json(result);
}
