'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Video = {
  id: string;
  title: string;
  video_url: string;
  format: string;
  scene_count: number;
  voice_id: string;
  image_style: string;
  image_model: string;
  tts_provider: string;
  file_name: string;
  created_at: string;
};

const IMAGE_STYLE_LABELS: Record<string, string> = {
  cinematic: '영화', realistic: '실사', anime: '애니', documentary: '다큐',
  '3d': '3D', watercolor: '수채화', cartoon: '카툰', noir: '누아르',
};

const PAGE_SIZE = 6;

async function downloadVideo(url: string, title: string) {
  const proxyUrl = `/api/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(title || 'video')}`;

  if ('showSaveFilePicker' in window) {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: `${title || 'video'}.mp4`,
        types: [{ description: 'MP4 Video', accept: { 'video/mp4': ['.mp4'] } }],
      });
      const res = await fetch(proxyUrl);
      const blob = await res.blob();
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (e: any) {
      if (e.name === 'AbortError') return; // 사용자가 취소
    }
  }

  // fallback
  const a = document.createElement('a');
  a.href = proxyUrl;
  a.download = `${title || 'video'}.mp4`;
  a.click();
}

export default function HistoryPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('videos')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setVideos(data ?? []);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-3 text-white/20 text-xs font-mono">
        <span className="w-3 h-3 border border-white/20 border-t-white/60 rounded-full animate-spin" />
        불러오는 중...
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="text-white/20 text-xs font-mono">
        <p>아직 생성된 영상이 없습니다.</p>
        <p className="mt-1 text-white/10">영상 만들기에서 영상을 생성하면 여기에 저장됩니다.</p>
      </div>
    );
  }

  const totalPages = Math.ceil(videos.length / PAGE_SIZE);
  const paged = videos.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div>
      <p className="text-white/20 text-xs tracking-widest uppercase font-mono mb-4">
        총 {videos.length}개
      </p>

      <div className="grid grid-cols-3 gap-4">
        {paged.map((v) => (
          <div key={v.id} className="border border-white/10 flex flex-col">
            {/* 썸네일 / 영상 영역 */}
            <div className="relative bg-black h-48 overflow-hidden">
              {playing === v.id ? (
                <video
                  src={v.video_url}
                  controls
                  autoPlay
                  className="w-full h-full object-contain"
                />
              ) : (
                <button
                  onClick={() => setPlaying(v.id)}
                  className="w-full h-full flex items-center justify-center text-white/20 hover:text-white/60 transition-colors"
                >
                  <span className="text-2xl">▶</span>
                </button>
              )}
              {playing === v.id && (
                <button
                  onClick={() => setPlaying(null)}
                  className="absolute top-1 right-1 text-[10px] font-mono text-white/60 hover:text-white bg-black/70 px-1.5 py-0.5"
                >
                  ■
                </button>
              )}
              <span className="absolute top-1 left-1 text-[9px] font-mono text-white/30 bg-black/60 px-1 py-0.5">
                {v.format === 'shorts' ? '9:16' : '16:9'}
              </span>
            </div>

            {/* 정보 + 버튼 */}
            <div className="p-2 flex flex-col gap-1.5">
              <p className="text-white/60 text-[11px] font-mono leading-snug line-clamp-1">{v.title}</p>
              <div className="flex flex-wrap gap-1">
                <span className="text-[9px] font-mono text-white/30 border border-white/10 px-1 py-0.5">
                  {v.format === 'shorts' ? '9:16 쇼츠' : '16:9 유튜브'}
                </span>
                {v.image_style && (
                  <span className="text-[9px] font-mono text-white/30 border border-white/10 px-1 py-0.5">
                    {IMAGE_STYLE_LABELS[v.image_style] ?? v.image_style}
                  </span>
                )}
                {v.scene_count && (
                  <span className="text-[9px] font-mono text-white/30 border border-white/10 px-1 py-0.5">
                    {v.scene_count}장면
                  </span>
                )}
                {v.tts_provider && (
                  <span className="text-[9px] font-mono text-white/30 border border-white/10 px-1 py-0.5">
                    {v.tts_provider === 'google' ? 'Google TTS' : 'MiniMax TTS'}
                  </span>
                )}
              </div>
              <p className="text-white/30 text-[10px] font-mono">
                {new Date(v.created_at).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </p>
              {v.file_name && (
                <p className="text-white/15 text-[9px] font-mono">{v.file_name}.mp4</p>
              )}
              <button
                onClick={async () => {
                  setDownloading(v.id);
                  let fileName = v.file_name;
                  if (!fileName) {
                    const d = new Date(v.created_at);
                    const yy = String(d.getFullYear()).slice(2);
                    const mmdd = String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
                    const dateStr = d.toDateString();
                    const sameDay = videos.filter(x => new Date(x.created_at).toDateString() === dateStr);
                    const seq = String(sameDay.findIndex(x => x.id === v.id) + 1).padStart(3, '0');
                    fileName = `clipflow${yy}${mmdd}${seq}`;
                  }
                  await downloadVideo(v.video_url, fileName);
                  setDownloading(null);
                }}
                disabled={downloading === v.id}
                className="text-center text-[10px] font-mono text-black bg-yellow-400 hover:bg-yellow-300 disabled:bg-yellow-400/50 py-1 transition-colors w-full"
              >
                {downloading === v.id ? '다운 중...' : 'MP4 다운'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => setPage(p => p - 1)}
            disabled={page === 0}
            className="px-3 py-1.5 text-xs font-mono border border-white/10 text-white/40 hover:border-white/30 hover:text-white/70 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
          >
            ← 이전
          </button>
          <span className="text-white/20 text-xs font-mono">{page + 1} / {totalPages}</span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={page >= totalPages - 1}
            className="px-3 py-1.5 text-xs font-mono border border-white/10 text-white/40 hover:border-white/30 hover:text-white/70 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
          >
            다음 →
          </button>
        </div>
      )}
    </div>
  );
}
