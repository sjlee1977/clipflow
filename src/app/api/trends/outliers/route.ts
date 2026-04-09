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

  let query = supabase
    .from('trend_signals')
    .select(`
      *,
      trend_videos!inner (
        video_id,
        title,
        thumbnail,
        category,
        region,
        video_type,
        published_at,
        channel_id,
        trend_channels (
          channel_name,
          channel_thumbnail,
          subscriber_count,
          avg_views
        )
      )
    `)
    .eq('signal_type', 'outlier')
    .order('multiplier', { ascending: false })
    .limit(limit);

  if (category) query = query.eq('trend_videos.category', category);
  if (region) query = query.eq('trend_videos.region', region);
  if (videoType) query = query.eq('trend_videos.video_type', videoType);
  query = query.gte('updated_at', since);
  if (until) query = query.lte('updated_at', until);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data ?? []);
}
