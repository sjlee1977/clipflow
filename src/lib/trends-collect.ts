import { createAdminClient } from '@/lib/supabase-server';
import {
  searchRecentVideos,
  fetchVideoStats,
  fetchChannelInfo,
  calcChannelAvgViews,
} from '@/lib/youtube-trends';

const DEFAULT_OUTLIER_MULTIPLIER = 3.0;
const DEFAULT_VIRAL_THRESHOLD = 300.0;
const DEFAULT_VIEWS_PER_SUB_THRESHOLD = 0.1;   // 구독자의 10% 이상 조회 = 이상치
const DEFAULT_SUB_GROWTH_THRESHOLD = 0.05;      // 시간당 0.5% 이상 구독자 증가 = 급성장

export interface CollectSummary {
  discovered: number;
  snapshots: number;
  viral: number;
  outliers: number;
  subscriberGrowth: number;
  viewsPerSub: number;
  errors: string[];
}

export async function runTrendsCollection(
  regions?: string[],
  categories?: string[],
  videoTypes?: ('regular' | 'short')[],
  subscriberRange?: { min?: number; max?: number },
  forceDiscover = false,  // 수동 수집 시 6시간 제한 무시
): Promise<CollectSummary> {
  const supabase = await createAdminClient();
  const summary: CollectSummary = {
    discovered: 0, snapshots: 0, viral: 0, outliers: 0,
    subscriberGrowth: 0, viewsPerSub: 0, errors: [],
  };
  const now = new Date();

  // 1. 활성 사용자 설정 조회
  const { data: settings } = await supabase
    .from('trend_settings')
    .select('categories, outlier_multiplier, viral_threshold_hourly')
    .eq('is_active', true);

  const allCategories = categories && categories.length > 0
    ? categories
    : settings && settings.length > 0
      ? [...new Set(settings.flatMap((s) => s.categories as string[]))]
      : [];

  const targetRegions = regions && regions.length > 0 ? regions : ['KR'];
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
  const shouldDiscover = forceDiscover || (now.getTime() - lastDiscovery.getTime()) / 3600000 >= 6;

  if (shouldDiscover) {
    for (const region of targetRegions) {
      for (const category of allCategories) {
        for (const videoType of targetVideoTypes) {
          try {
            const videos = await searchRecentVideos(category, 50, 24, region, videoType);

            // 채널 처리
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
                  // 구독자 범위 필터 적용
                  if (subscriberRange?.min && ch.subscriberCount < subscriberRange.min) continue;
                  if (subscriberRange?.max && ch.subscriberCount > subscriberRange.max) continue;

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

              // 기존 채널 구독자 수 업데이트 + 스냅샷 저장
              const allChannelInfos = await fetchChannelInfo(channelIds);
              for (const ch of allChannelInfos) {
                // 구독자 스냅샷 저장
                await supabase.from('channel_snapshots').insert({
                  channel_id: ch.channelId,
                  subscriber_count: ch.subscriberCount,
                  captured_at: now.toISOString(),
                });
                // trend_channels 구독자 수 최신화
                await supabase
                  .from('trend_channels')
                  .update({ subscriber_count: ch.subscriberCount })
                  .eq('channel_id', ch.channelId);
              }
            }

            // 새 영상 등록 (구독자 범위 필터 적용)
            for (const v of videos) {
              if (subscriberRange?.min || subscriberRange?.max) {
                const { data: ch } = await supabase
                  .from('trend_channels')
                  .select('subscriber_count')
                  .eq('channel_id', v.channelId)
                  .maybeSingle();
                if (ch) {
                  if (subscriberRange.min && ch.subscriber_count < subscriberRange.min) continue;
                  if (subscriberRange.max && ch.subscriber_count > subscriberRange.max) continue;
                }
              }
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
        }
      }
    }

    if (settings && settings.length > 0) {
      await supabase
        .from('trend_settings')
        .update({ last_discovery_at: now.toISOString() })
        .eq('is_active', true);
    }
  }

  // 3. 조회수 스냅샷 수집
  let activeVideoQuery = supabase
    .from('trend_videos')
    .select('video_id, channel_id, published_at')
    .eq('is_active', true);
  if (allCategories.length > 0) activeVideoQuery = activeVideoQuery.in('category', allCategories);
  if (targetRegions.length > 0) activeVideoQuery = activeVideoQuery.in('region', targetRegions);
  activeVideoQuery = activeVideoQuery.in('video_type', targetVideoTypes);
  const { data: activeVideos } = await activeVideoQuery;

  const videoIds = (activeVideos ?? []).map((v) => v.video_id);
  const videoChannelMap = new Map((activeVideos ?? []).map((v) => [v.video_id, v.channel_id]));
  const videoPublishedMap = new Map((activeVideos ?? []).map((v) => [v.video_id, v.published_at as string | null]));

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
        const channelId = videoChannelMap.get(s.videoId);

        // 채널 정보 조회
        const { data: channel } = await supabase
          .from('trend_channels')
          .select('avg_views, subscriber_count')
          .eq('channel_id', channelId)
          .maybeSingle();

        // 4-1. 바이럴: 최근 2개 스냅샷 비교
        const { data: snaps } = await supabase
          .from('trend_snapshots')
          .select('views, captured_at')
          .eq('video_id', s.videoId)
          .order('captured_at', { ascending: false })
          .limit(2);

        if (snaps && snaps.length >= 2) {
          // 스냅샷 델타 방식 (가장 정확)
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
        } else if (snaps && snaps.length === 1) {
          // 발행일 기준 시간당 조회수 방식 (첫 번째 수집 직후 즉시 감지)
          const publishedAt = videoPublishedMap.get(s.videoId);
          if (publishedAt) {
            const hoursSincePublished = (now.getTime() - new Date(publishedAt).getTime()) / 3600000;
            const hourlyRate = hoursSincePublished > 0 ? s.views / hoursSincePublished : 0;

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
        }

        // 4-2. 이상치: 채널 평균 조회수 대비
        if (channel?.avg_views && channel.avg_views > 0) {
          const multiplier = s.views / channel.avg_views;
          if (multiplier >= avgOutlierMultiplier) {
            await supabase.from('trend_signals').upsert(
              {
                video_id: s.videoId,
                signal_type: 'outlier',
                current_views: s.views,
                channel_avg_views: channel.avg_views,
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

        // 4-3. 구독자 대비 조회수 비율 (views_per_sub)
        if (channel?.subscriber_count && channel.subscriber_count > 0) {
          const viewsPerSub = s.views / channel.subscriber_count;
          if (viewsPerSub >= DEFAULT_VIEWS_PER_SUB_THRESHOLD) {
            await supabase.from('trend_signals').upsert(
              {
                video_id: s.videoId,
                signal_type: 'views_per_sub',
                current_views: s.views,
                subscriber_count: channel.subscriber_count,
                views_per_sub: viewsPerSub,
                score: viewsPerSub,
                detected_at: now.toISOString(),
                updated_at: now.toISOString(),
              },
              { onConflict: 'video_id,signal_type' }
            );
            summary.viewsPerSub++;
          }
        }
      } catch {
        // 개별 영상 오류 무시
      }
    }
  }

  // 5. 구독자 급성장 채널 감지
  const { data: activeChannels } = await supabase
    .from('trend_channels')
    .select('channel_id, subscriber_count');

  for (const ch of activeChannels ?? []) {
    try {
      const { data: subSnaps } = await supabase
        .from('channel_snapshots')
        .select('subscriber_count, captured_at')
        .eq('channel_id', ch.channel_id)
        .order('captured_at', { ascending: false })
        .limit(2);

      if (subSnaps && subSnaps.length === 2) {
        const deltaSubs = subSnaps[0].subscriber_count - subSnaps[1].subscriber_count;
        const deltaHours =
          (new Date(subSnaps[0].captured_at).getTime() - new Date(subSnaps[1].captured_at).getTime()) / 3600000;
        const growthRate = deltaHours > 0 && subSnaps[1].subscriber_count > 0
          ? (deltaSubs / subSnaps[1].subscriber_count) / deltaHours
          : 0;

        if (growthRate >= DEFAULT_SUB_GROWTH_THRESHOLD) {
          // 해당 채널의 가장 최근 영상에 시그널 기록
          const { data: latestVideo } = await supabase
            .from('trend_videos')
            .select('video_id')
            .eq('channel_id', ch.channel_id)
            .eq('is_active', true)
            .order('published_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (latestVideo) {
            await supabase.from('trend_signals').upsert(
              {
                video_id: latestVideo.video_id,
                signal_type: 'subscriber_growth',
                subscriber_count: subSnaps[0].subscriber_count,
                subscriber_growth_rate: growthRate,
                score: growthRate * 1000,
                detected_at: now.toISOString(),
                updated_at: now.toISOString(),
              },
              { onConflict: 'video_id,signal_type' }
            );
            summary.subscriberGrowth++;
          }
        }
      }
    } catch {
      // 개별 채널 오류 무시
    }
  }

  // 6. 7일 이상 된 영상 비활성화
  await supabase
    .from('trend_videos')
    .update({ is_active: false })
    .lt('published_at', new Date(now.getTime() - 7 * 24 * 3600000).toISOString())
    .eq('is_active', true);


  return summary;
}
