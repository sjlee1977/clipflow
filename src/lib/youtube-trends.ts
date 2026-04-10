const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

export const SEARCH_REGIONS: Record<string, { label: string; language: string }> = {
  KR: { label: '한국',   language: 'ko' },
  US: { label: '미국',   language: 'en' },
  GB: { label: '영국',   language: 'en' },
  JP: { label: '일본',   language: 'ja' },
  FR: { label: '프랑스', language: 'fr' },
};

// 카테고리 정의 (YouTube categoryId 또는 키워드 검색)
export const TREND_CATEGORIES: Record<string, { label: string; youtubeId?: string; keyword?: string }> = {
  gaming:        { label: '게임',       youtubeId: '20' },
  music:         { label: '음악',       youtubeId: '10' },
  entertainment: { label: '엔터테인먼트', youtubeId: '24' },
  education:     { label: '교육',       youtubeId: '27' },
  beauty:        { label: '뷰티/패션',  youtubeId: '26' },
  sports:        { label: '스포츠',     youtubeId: '17' },
  tech:          { label: 'IT/테크',    youtubeId: '28' },
  finance:       { label: '경제/금융',  keyword: '경제 주식 재테크 투자' },
  food:          { label: '음식/요리',  keyword: '요리 레시피 맛집 먹방' },
  travel:        { label: '여행',       keyword: '여행 vlog 해외여행' },
  animals:       { label: '동물',       keyword: '동물 강아지 고양이 펫' },
  ai:            { label: 'AI 영상',    keyword: 'AI generated video shorts' },
  funny:         { label: '유머/짤',    keyword: '웃긴 영상 짤 meme funny' },
};

export interface YTVideoItem {
  videoId: string;
  channelId: string;
  title: string;
  thumbnail: string;
  publishedAt: string;
}

export interface YTVideoStats {
  videoId: string;
  views: number;
  likes: number;
}

export interface YTChannelInfo {
  channelId: string;
  channelName: string;
  channelThumbnail: string;
  subscriberCount: number;
}

function getApiKey(): string {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key || key.startsWith('여기에')) throw new Error('YOUTUBE_API_KEY가 설정되지 않았습니다.');
  return key;
}

// ISO 8601 duration → 초 변환 (PT1H2M3S 등)
function parseIsoDuration(iso: string): number {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  return (parseInt(match[1] ?? '0', 10) * 3600) +
         (parseInt(match[2] ?? '0', 10) * 60) +
         (parseInt(match[3] ?? '0', 10));
}

// youtubeId 있는 카테고리: mostPopular 사용 (1 유닛)
async function fetchMostPopularVideos(
  categoryId: string,
  maxResults: number,
  regionCode: string,
  videoType: 'short' | 'regular'
): Promise<YTVideoItem[]> {
  const params = new URLSearchParams({
    part: 'snippet,contentDetails',
    chart: 'mostPopular',
    regionCode,
    videoCategoryId: categoryId,
    maxResults: '50',
    key: getApiKey(),
  });

  const res = await fetch(`${YOUTUBE_API_BASE}/videos?${params}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`YouTube mostPopular API 오류 (${res.status}): ${JSON.stringify(err)}`);
  }

  const data = await res.json();
  return (data.items ?? [])
    .filter((item: any) => {
      const secs = parseIsoDuration(item.contentDetails?.duration ?? '');
      return videoType === 'short' ? secs < 240 : secs >= 240;
    })
    .slice(0, maxResults)
    .map((item: any) => ({
      videoId: item.id,
      channelId: item.snippet.channelId,
      title: item.snippet.title,
      thumbnail:
        item.snippet.thumbnails?.medium?.url ||
        item.snippet.thumbnails?.default?.url ||
        '',
      publishedAt: item.snippet.publishedAt,
    }));
}

// 카테고리별 최근 영상 검색
// - youtubeId 있는 카테고리: videos.list mostPopular (1 유닛)
// - keyword 기반 카테고리: search.list (100 유닛, 불가피)
export async function searchRecentVideos(
  category: string,
  maxResults = 30,
  hoursAgo = 24,
  regionCode = 'KR',
  videoType: 'short' | 'regular' = 'regular'
): Promise<YTVideoItem[]> {
  const cat = TREND_CATEGORIES[category];
  if (!cat) return [];

  // youtubeId 있으면 mostPopular 사용 (1 유닛)
  if (cat.youtubeId) {
    return fetchMostPopularVideos(cat.youtubeId, maxResults, regionCode, videoType);
  }

  // keyword 기반: search.list 사용 (100 유닛)
  const region = SEARCH_REGIONS[regionCode] ?? SEARCH_REGIONS.KR;
  const publishedAfter = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();

  const params = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    order: 'viewCount',
    regionCode,
    relevanceLanguage: region.language,
    maxResults: String(Math.min(maxResults, 50)),
    publishedAfter,
    q: cat.keyword!,
    videoDuration: videoType === 'short' ? 'short' : 'medium',
    key: getApiKey(),
  });

  const res = await fetch(`${YOUTUBE_API_BASE}/search?${params}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`YouTube search API 오류 (${res.status}): ${JSON.stringify(err)}`);
  }

  const data = await res.json();
  return (data.items ?? [])
    .filter((item: any) => item.id?.videoId)
    .map((item: any) => ({
      videoId: item.id.videoId,
      channelId: item.snippet.channelId,
      title: item.snippet.title,
      thumbnail:
        item.snippet.thumbnails?.medium?.url ||
        item.snippet.thumbnails?.default?.url ||
        '',
      publishedAt: item.snippet.publishedAt,
    }));
}

// 영상 통계 조회 (최대 50개씩 배치)
export async function fetchVideoStats(videoIds: string[]): Promise<YTVideoStats[]> {
  if (videoIds.length === 0) return [];

  const results: YTVideoStats[] = [];
  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);
    const params = new URLSearchParams({
      part: 'statistics',
      id: batch.join(','),
      key: getApiKey(),
    });

    const res = await fetch(`${YOUTUBE_API_BASE}/videos?${params}`);
    if (!res.ok) continue;

    const data = await res.json();
    for (const item of data.items ?? []) {
      results.push({
        videoId: item.id,
        views: parseInt(item.statistics?.viewCount ?? '0', 10),
        likes: parseInt(item.statistics?.likeCount ?? '0', 10),
      });
    }
  }
  return results;
}

// 채널 정보 조회
export async function fetchChannelInfo(channelIds: string[]): Promise<YTChannelInfo[]> {
  if (channelIds.length === 0) return [];

  const params = new URLSearchParams({
    part: 'snippet,statistics',
    id: channelIds.slice(0, 50).join(','),
    key: getApiKey(),
  });

  const res = await fetch(`${YOUTUBE_API_BASE}/channels?${params}`);
  if (!res.ok) return [];

  const data = await res.json();
  return (data.items ?? []).map((item: any) => ({
    channelId: item.id,
    channelName: item.snippet.title,
    channelThumbnail: item.snippet.thumbnails?.default?.url ?? '',
    subscriberCount: parseInt(item.statistics?.subscriberCount ?? '0', 10),
  }));
}

// 채널 최근 N개 영상의 평균 조회수 계산
// search.list(100 units) 대신 playlistItems.list(1 unit) 사용
export async function calcChannelAvgViews(channelId: string, count = 20): Promise<number> {
  // 1. 채널의 업로드 플레이리스트 ID 조회 (1 unit)
  const chParams = new URLSearchParams({
    part: 'contentDetails',
    id: channelId,
    key: getApiKey(),
  });
  const chRes = await fetch(`${YOUTUBE_API_BASE}/channels?${chParams}`);
  if (!chRes.ok) return 0;

  const chData = await chRes.json();
  const uploadsPlaylistId = chData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsPlaylistId) return 0;

  // 2. 업로드 플레이리스트에서 최근 영상 ID 조회 (1 unit)
  const plParams = new URLSearchParams({
    part: 'contentDetails',
    playlistId: uploadsPlaylistId,
    maxResults: String(count),
    key: getApiKey(),
  });
  const plRes = await fetch(`${YOUTUBE_API_BASE}/playlistItems?${plParams}`);
  if (!plRes.ok) return 0;

  const plData = await plRes.json();
  const ids = (plData.items ?? [])
    .map((item: any) => item.contentDetails?.videoId)
    .filter(Boolean);
  if (ids.length === 0) return 0;

  // 3. 영상 통계 조회 (1 unit)
  const stats = await fetchVideoStats(ids);
  if (stats.length === 0) return 0;

  const total = stats.reduce((sum, s) => sum + s.views, 0);
  return Math.round(total / stats.length);
}
