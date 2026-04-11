import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

function getApiKey(): string {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error('YOUTUBE_API_KEY가 설정되지 않았습니다.');
  return key;
}

function extractHashtags(texts: string[]): string[] {
  const tagMap: Record<string, number> = {};
  for (const text of texts) {
    const matches = text.match(/#[\w가-힣ㄱ-ㅎㅏ-ㅣ]+/g) ?? [];
    for (const tag of matches) {
      tagMap[tag] = (tagMap[tag] ?? 0) + 1;
    }
  }
  return Object.entries(tagMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag]) => tag);
}

function calcSearchVolume(avgViews: number): { label: string; level: number } {
  if (avgViews >= 5_000_000) return { label: '매우 높음', level: 5 };
  if (avgViews >= 1_000_000) return { label: '높음', level: 4 };
  if (avgViews >= 100_000)   return { label: '보통', level: 3 };
  if (avgViews >= 10_000)    return { label: '낮음', level: 2 };
  return { label: '매우 낮음', level: 1 };
}

function calcCompetition(videos: { views: number; likeCount: number; subscriberCount: number }[]): { score: number; label: string } {
  if (videos.length === 0) return { score: 0, label: '정보 없음' };

  const avgViews = videos.reduce((s, v) => s + v.views, 0) / videos.length;
  const avgSubs = videos.reduce((s, v) => s + v.subscriberCount, 0) / videos.length;
  const avgLikes = videos.reduce((s, v) => s + v.likeCount, 0) / videos.length;

  // 점수 계산: 조회수(40) + 구독자(40) + 좋아요비율(20)
  const viewScore = Math.min(avgViews / 1_000_000, 1) * 40;
  const subScore  = Math.min(avgSubs  / 1_000_000, 1) * 40;
  const likeRatio = avgViews > 0 ? avgLikes / avgViews : 0;
  const likeScore = Math.min(likeRatio / 0.05, 1) * 20;

  const score = Math.round(viewScore + subScore + likeScore);

  let label = '여유 있음';
  if (score >= 70) label = '치열함';
  else if (score >= 40) label = '보통';

  return { score, label };
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const keyword = searchParams.get('keyword')?.trim();
  const regionCode = searchParams.get('region') ?? 'KR';

  if (!keyword) return NextResponse.json({ error: 'keyword 파라미터가 필요합니다.' }, { status: 400 });

  try {
    // 1. 키워드 검색 (상위 20개)
    const searchParams2 = new URLSearchParams({
      part: 'snippet',
      type: 'video',
      order: 'relevance',
      regionCode,
      q: keyword,
      maxResults: '20',
      key: getApiKey(),
    });

    const searchRes = await fetch(`${YOUTUBE_API_BASE}/search?${searchParams2}`);
    if (!searchRes.ok) {
      const err = await searchRes.json().catch(() => ({}));
      throw new Error(`YouTube search API 오류 (${searchRes.status}): ${JSON.stringify(err)}`);
    }
    const searchData = await searchRes.json();
    const items = (searchData.items ?? []).filter((i: any) => i.id?.videoId);
    const videoIds = items.map((i: any) => i.id.videoId as string);

    if (videoIds.length === 0) {
      return NextResponse.json({
        keyword,
        searchVolume: { label: '데이터 없음', level: 0 },
        competition: { score: 0, label: '데이터 없음' },
        topTags: [],
        topVideos: [],
      });
    }

    // 2. 영상 통계 조회
    const statsParams = new URLSearchParams({
      part: 'statistics,snippet',
      id: videoIds.join(','),
      key: getApiKey(),
    });
    const statsRes = await fetch(`${YOUTUBE_API_BASE}/videos?${statsParams}`);
    const statsData = await statsRes.json();
    const statsItems: any[] = statsData.items ?? [];

    // 3. 채널 정보 조회
    const channelIds = [...new Set(statsItems.map((i: any) => i.snippet?.channelId).filter(Boolean))] as string[];
    let channelMap: Record<string, { channelName: string; subscriberCount: number; thumbnail: string }> = {};
    if (channelIds.length > 0) {
      const chParams = new URLSearchParams({
        part: 'snippet,statistics',
        id: channelIds.slice(0, 50).join(','),
        key: getApiKey(),
      });
      const chRes = await fetch(`${YOUTUBE_API_BASE}/channels?${chParams}`);
      const chData = await chRes.json();
      for (const ch of chData.items ?? []) {
        channelMap[ch.id] = {
          channelName: ch.snippet?.title ?? '',
          subscriberCount: parseInt(ch.statistics?.subscriberCount ?? '0', 10),
          thumbnail: ch.snippet?.thumbnails?.default?.url ?? '',
        };
      }
    }

    // 4. 데이터 병합
    const videos = statsItems.map((item: any) => {
      const channelId = item.snippet?.channelId ?? '';
      const ch = channelMap[channelId];
      return {
        videoId: item.id,
        title: item.snippet?.title ?? '',
        thumbnail: item.snippet?.thumbnails?.medium?.url ?? item.snippet?.thumbnails?.default?.url ?? '',
        channelId,
        channelName: ch?.channelName ?? item.snippet?.channelTitle ?? '',
        channelThumbnail: ch?.thumbnail ?? '',
        subscriberCount: ch?.subscriberCount ?? 0,
        views: parseInt(item.statistics?.viewCount ?? '0', 10),
        likeCount: parseInt(item.statistics?.likeCount ?? '0', 10),
        commentCount: parseInt(item.statistics?.commentCount ?? '0', 10),
        publishedAt: item.snippet?.publishedAt ?? '',
        tags: item.snippet?.tags ?? [],
      };
    });

    // 5. 분석
    const avgViews = videos.length > 0
      ? videos.slice(0, 10).reduce((s, v) => s + v.views, 0) / Math.min(videos.length, 10)
      : 0;

    const searchVolume = calcSearchVolume(avgViews);
    const competition = calcCompetition(videos.slice(0, 10).map(v => ({
      views: v.views,
      likeCount: v.likeCount,
      subscriberCount: v.subscriberCount,
    })));

    // 태그: 영상 제목 + snippet tags에서 추출
    const allTitles = videos.map(v => v.title);
    const allTagTexts = videos.flatMap(v => v.tags.map((t: string) => `#${t}`));
    const topTags = extractHashtags([...allTitles, ...allTagTexts]);

    // snippet tags도 추가 (상위 5개 이하면 채우기)
    const snippetTags = [...new Set(videos.flatMap(v => v.tags as string[]))].slice(0, 20).map(t => `#${t}`);
    const finalTags = [...new Set([...topTags, ...snippetTags])].slice(0, 10);

    return NextResponse.json({
      keyword,
      searchVolume,
      competition,
      topTags: finalTags,
      totalResults: searchData.pageInfo?.totalResults ?? 0,
      topVideos: videos.slice(0, 10).map((v, i) => ({
        rank: i + 1,
        videoId: v.videoId,
        title: v.title,
        thumbnail: v.thumbnail,
        channelName: v.channelName,
        channelThumbnail: v.channelThumbnail,
        subscriberCount: v.subscriberCount,
        views: v.views,
        likeCount: v.likeCount,
        publishedAt: v.publishedAt,
      })),
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
