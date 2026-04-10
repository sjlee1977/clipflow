import { createAdminClient } from '@/lib/supabase-server';
import {
  searchRecentVideos,
  fetchVideoStats,
  fetchChannelInfo,
  calcChannelAvgViews,
  SEARCH_REGIONS,
} from '@/lib/youtube-trends';

const DEFAULT_OUTLIER_MULTIPLIER = 3.0;
const DEFAULT_VIRAL_THRESHOLD = 300.0;

export interface CollectSummary {
  discovered: number;
  snapshots: number;
  viral: number;
  outliers: number;
  errors: string[];
}

export async function runTrendsCollection(
  regions?: string[],
  categories?: string[],
  videoTypes?: ('regular' | 'short')[],
): Promise<CollectSummary> {
  const supabase = await createAdminClient();
  const summary: CollectSummary = { discovered: 0, snapshots: 0, viral: 0, outliers: 0, errors: [] };
  const now = new Date();

  // 1. 활성 사용자 설정 조회 (없으면 기본값 사용)
  const { data: settings } = await supabase
    .from('trend_settings')
    .select('categories, outlier_multiplier, viral_threshold_hourly')
    .eq('is_active', true);

  // 호출 시 명시적으로 전달된 값 우선, 없으면 DB 설정, 그것도 없으면 에러
  const allCategories = categories && categories.length > 0
    ? categories
    : settings && settings.length > 0
      ? [...new Set(settings.flatMap((s) => s.categories as string[]))]
      : [];

  const targetRegions = regions && regions.length > 0
    ? regions
    : ['KR']; // 기본값은 한국만

  const targetVideoTypes: ('regular' | 'short')[] =
    videoTypes && videoTypes.length > 0 ? videoTypes : ['regular', 'short'];

  if (allCategories.length === 0) {
    summary.errors.push('수집할 카테고리가 없습니다. 카테고리를 선택해주세요.');
    return summary;
  }

  const avgOutlierMultiplier = settings && settings.length > 0
    ? settings.reduce((s, r) => s + (r.outlier_multiplier ?? DEFAULT_OUTLIER_MULTIPLIER), 0) / settings.length
    : DEFAULT_OUTLIER_MULTIPLIER;

  const avgViralThreshold = settings && settings.length > 0
    ? settings.reduce((s, r) => s + (r.viral_threshold_hourly ?? DEFAULT_VIRAL_THRESHOLD), 0) / settings.length
    : DEFAULT_VIRAL_THRESHOLD;

  // 2. 탐색 단계 - 6시간마다 새 영상 수집
  const { data: lastSetting } = await supabase
    .from('trend_settings')
    .select('last_discovery_at')
    .eq('is_active', true)
    .order('last_discovery_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  const lastDiscovery = lastSetting?.last_discovery_at
    ? new Date(lastSetting.last_discovery_at)
    : new Date(0);
  const hoursSinceDiscovery = (now.getTime() - lastDiscovery.getTime()) / 3600000;
  const shouldDiscover = hoursSinceDiscovery >= 6;

  if (shouldDiscover) {
    for (const region of targetRegions) {
      for (const category of allCategories) {
        for (const videoType of targetVideoTypes) {
        try {
          const videos = await searchRecentVideos(category, 20, 24, region, videoType);

          // 새 채널 처리
          const channelIds = [...new Set(videos.map((v) => v.channelId))];
          if (channelIds.length > 0) {
            const { data: existingChannels } = await supabase
              .from('trend_channels')
              .select('channel_id')
              .in('channel_id', channelIds);
            const existingIds = new Set((existingChannels ?? []).map((c) => c.channel_id));
            const newChannelIds = channelIds.filter((id) => !existingIds.has(id));

            if (newChannelIds.length > 0) {
              const channelInfos = await fetchChannelInfo(newChannelIds);
              for (const ch of channelInfos) {
                const avg = await calcChannelAvgViews(ch.channelId, 20);
                await supabase.from('trend_channels').upsert(
                  {
                    channel_id: ch.channelId,
                    channel_name: ch.channelName,
                    channel_thumbnail: ch.channelThumbnail,
                    category,
                    subscriber_count: ch.subscriberCount,
                    avg_views: avg,
                    avg_views_updated_at: now.toISOString(),
                  },
                  { onConflict: 'channel_id' }
                );
              }
            }
          }

          // 새 영상 등록
          for (const v of videos) {
            await supabase.from('trend_videos').upsert(
              {
                video_id: v.videoId,
                channel_id: v.channelId,
                title: v.title,
                thumbnail: v.thumbnail,
                category,
                region,
                video_type: videoType,
                published_at: v.publishedAt,
                is_active: true,
              },
              { onConflict: 'video_id' }
            );
            summary.discovered++;
          }
        } catch (e) {
          summary.errors.push(`탐색 오류 [${region}/${category}/${videoType}]: ${(e as Error).message}`);
        }
        } // end videoType loop
      }
    }

    // last_discovery_at 업데이트 (설정 있는 경우만)
    if (settings && settings.length > 0) {
      await supabase
        .from('trend_settings')
        .update({ last_discovery_at: now.toISOString() })
        .eq('is_active', true);
    }
  }

  // 3. 조회수 스냅샷 수집 (선택된 카테고리/지역만)
  let activeVideoQuery = supabase
    .from('trend_videos')
    .select('video_id')
    .eq('is_active', true);
  if (allCategories.length > 0) activeVideoQuery = activeVideoQuery.in('category', allCategories);
  if (targetRegions.length > 0) activeVideoQuery = activeVideoQuery.in('region', targetRegions);
  activeVideoQuery = activeVideoQuery.in('video_type', targetVideoTypes);
  const { data: activeVideos } = await activeVideoQuery;

  const videoIds = (activeVideos ?? []).map((v) => v.video_id);

  if (videoIds.length > 0) {
    const stats = await fetchVideoStats(videoIds);

    if (stats.length > 0) {
      await supabase.from('trend_snapshots').insert(
        stats.map((s) => ({
          video_id: s.videoId,
          views: s.views,
          likes: s.likes,
          captured_at: now.toISOString(),
        }))
      );
      summary.snapshots = stats.length;
    }

    // 4. 시그널 감지
    for (const s of stats) {
      try {
        // 바이럴: 최근 2개 스냅샷 비교
        const { data: snaps } = await supabase
          .from('trend_snapshots')
          .select('views, captured_at')
          .eq('video_id', s.videoId)
          .order('captured_at', { ascending: false })
          .limit(2);

        if (snaps && snaps.length === 2) {
          const deltaViews = snaps[0].views - snaps[1].views;
          const deltaHours =
            (new Date(snaps[0].captured_at).getTime() - new Date(snaps[1].captured_at).getTime()) / 3600000;
          const hourlyRate = deltaHours > 0 ? deltaViews / deltaHours : 0;

          if (hourlyRate >= avgViralThreshold) {
            await supabase.from('trend_signals').upsert(
              {
                video_id: s.videoId,
                signal_type: 'viral',
                current_views: s.views,
                growth_rate_hourly: hourlyRate,
                score: hourlyRate,
                detected_at: now.toISOString(),
                updated_at: now.toISOString(),
              },
              { onConflict: 'video_id,signal_type' }
            );
            summary.viral++;
          }
        }

        // 이상치: 채널 평균 대비
        const { data: video } = await supabase
          .from('trend_videos')
          .select('channel_id')
          .eq('video_id', s.videoId)
          .maybeSingle();

        if (video?.channel_id) {
          const { data: channel } = await supabase
            .from('trend_channels')
            .select('avg_views')
            .eq('channel_id', video.channel_id)
            .maybeSingle();

          const channelAvg = channel?.avg_views ?? 0;
          if (channelAvg > 0) {
            const multiplier = s.views / channelAvg;
            if (multiplier >= avgOutlierMultiplier) {
              await supabase.from('trend_signals').upsert(
                {
                  video_id: s.videoId,
                  signal_type: 'outlier',
                  current_views: s.views,
                  channel_avg_views: channelAvg,
                  multiplier,
                  score: multiplier,
                  detected_at: now.toISOString(),
                  updated_at: now.toISOString(),
                },
                { onConflict: 'video_id,signal_type' }
              );
              summary.outliers++;
            }
          }
        }
      } catch {
        // 개별 영상 오류 무시
      }
    }
  }

  // 5. 7일 이상 된 영상 비활성화
  await supabase
    .from('trend_videos')
    .update({ is_active: false })
    .lt('published_at', new Date(now.getTime() - 7 * 24 * 3600000).toISOString())
    .eq('is_active', true);

  return summary;
}
