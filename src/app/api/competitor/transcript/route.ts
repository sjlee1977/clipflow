import { NextRequest, NextResponse } from 'next/server';
import { YoutubeTranscript } from '@/lib/youtube';
import { createClient } from '@/lib/supabase-server';

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([A-Za-z0-9_-]{11})/,
    /^([A-Za-z0-9_-]{11})$/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function parseDuration(iso: string): string {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return '';
  const h = parseInt(match[1] ?? '0');
  const m = parseInt(match[2] ?? '0');
  const s = parseInt(match[3] ?? '0');
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { url } = body;
  if (!url) return NextResponse.json({ error: 'URL을 입력해주세요' }, { status: 400 });

  const videoId = extractVideoId(url.trim());
  if (!videoId) return NextResponse.json({ error: '유효한 YouTube URL이 아닙니다' }, { status: 400 });

  // 영상 메타데이터
  let title = '', channelName = '', channelId = '', publishedAt = '', thumbnail = '';
  let viewCount = 0, likeCount = 0, commentCount = 0, duration = '';

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (apiKey) {
    try {
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoId}&key=${apiKey}`
      );
      const data = await res.json();
      const item = data.items?.[0];
      if (item) {
        title = item.snippet?.title ?? '';
        channelName = item.snippet?.channelTitle ?? '';
        channelId = item.snippet?.channelId ?? '';
        publishedAt = item.snippet?.publishedAt ?? '';
        thumbnail =
          item.snippet?.thumbnails?.maxres?.url ||
          item.snippet?.thumbnails?.high?.url ||
          item.snippet?.thumbnails?.medium?.url ||
          `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
        viewCount = parseInt(item.statistics?.viewCount ?? '0');
        likeCount = parseInt(item.statistics?.likeCount ?? '0');
        commentCount = parseInt(item.statistics?.commentCount ?? '0');
        duration = parseDuration(item.contentDetails?.duration ?? '');
      }
    } catch { /* fallback */ }
  }

  if (!title) {
    try {
      const res = await fetch(
        `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
      );
      if (res.ok) {
        const data = await res.json();
        title = data.title ?? '';
        channelName = data.author_name ?? '';
        thumbnail = data.thumbnail_url ?? '';
      }
    } catch { /* ignore */ }
  }
  if (!thumbnail) thumbnail = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

  // 자막 추출
  let transcriptItems: { start: number; duration: number; text: string }[] = [];
  for (const lang of ['ko', 'a.ko', 'en', 'a.en']) {
    try {
      const items = await YoutubeTranscript.fetchTranscript(videoId, { lang });
      if (items && items.length > 0) { transcriptItems = items; break; }
    } catch { /* try next */ }
  }
  if (transcriptItems.length === 0) {
    try {
      const items = await YoutubeTranscript.fetchTranscript(videoId);
      if (items && items.length > 0) transcriptItems = items;
    } catch { /* no transcript */ }
  }

  return NextResponse.json({
    videoId, title, channelName, channelId, publishedAt, thumbnail,
    viewCount, likeCount, commentCount, duration,
    transcript: transcriptItems.map(t => t.text).join(' '),
    transcriptItems,
    hasTranscript: transcriptItems.length > 0,
  });
}
