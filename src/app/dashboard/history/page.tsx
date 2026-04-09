'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

// 영상 첫 프레임을 canvas로 캡처해 썸네일로 표시
function VideoThumbnail({ src, className }: { src: string; className?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const handleSeeked = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      setReady(true);
    };

    const handleMeta = () => {
      video.currentTime = 0.5;
    };

    video.addEventListener('loadedmetadata', handleMeta);
    video.addEventListener('seeked', handleSeeked);
    return () => {
      video.removeEventListener('loadedmetadata', handleMeta);
      video.removeEventListener('seeked', handleSeeked);
    };
  }, [src]);

  return (
    <>
      <video ref={videoRef} src={src} preload="metadata" muted style={{ display: 'none' }} crossOrigin="anonymous" />
      <canvas ref={canvasRef} className={className} style={{ display: ready ? 'block' : 'none' }} />
      {!ready && <div className="absolute inset-0 bg-black/80 flex items-center justify-center"><span className="w-4 h-4 border border-white/20 border-t-white/60 rounded-full animate-spin" /></div>}
    </>
  );
}

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
  scenes?: any[];
};

const IMAGE_STYLE_LABELS: Record<string, string> = {
  cinematic: '영화', realistic: '실사', anime: '애니', documentary: '다큐',
  '3d': '3D', watercolor: '수채화', cartoon: '카툰', noir: '누아르', kinetic: '키네틱',
};

const ALL_VOICES: { id: string; name: string }[] = [
  // Google TTS
  { id: 'ko-KR-Standard-A', name: 'Standard A' },
  { id: 'ko-KR-Standard-B', name: 'Standard B' },
  { id: 'ko-KR-Standard-C', name: 'Standard C' },
  { id: 'ko-KR-Standard-D', name: 'Standard D' },
  { id: 'ko-KR-Wavenet-A', name: 'Wavenet A' },
  { id: 'ko-KR-Wavenet-B', name: 'Wavenet B' },
  { id: 'ko-KR-Wavenet-C', name: 'Wavenet C' },
  { id: 'ko-KR-Wavenet-D', name: 'Wavenet D' },
  { id: 'ko-KR-Neural2-A', name: 'Neural2 A' },
  { id: 'ko-KR-Neural2-B', name: 'Neural2 B' },
  { id: 'ko-KR-Neural2-C', name: 'Neural2 C' },
  { id: 'female1', name: '여성 1' },
  { id: 'female2', name: '여성 2' },
  { id: 'male1', name: '남성 1' },
  { id: 'male2', name: '남성 2' },
  // ElevenLabs
  { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel' },
  { id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella' },
  { id: 'ErXwobaYiN019PkySvjV', name: 'Antoni' },
  { id: 'MF3mGyEYCl7XYWbV9V6O', name: 'Elli' },
  { id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh' },
  { id: 'VR6AewLTigWG4xSOukaG', name: 'Arnold' },
  { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam' },
  { id: 'yoZ06aMxZJJ28mfd3POQ', name: 'Sam' },
  { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel' },
  { id: 'oWAxZDx7w5VEj9dCyTzz', name: 'Grace' },
  { id: 'pFZP5JQG7iQjIQuC4Bku', name: 'Lily' },
  { id: 'ThT5KcBeq8keWAlS799P', name: 'Rachel' },
  { id: 'pqHfZKP75CvOlQylNhV4', name: 'Bill' },
  { id: 'CwhRBWXzGAHq8TQ4Fs17', name: 'Roger' },
  { id: 'IKne3meq5aSn9XLyUdCD', name: 'Charlie' },
  { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George' },
  { id: 'N2lVS1w4EtoT3dr4eOWO', name: 'Callum' },
  { id: 'ODq5zmih8GrVes37Dizd', name: 'Patrick' },
  { id: 'SOYHLrjzK2X1ezoPC6cr', name: 'Harry' },
  { id: 'TX3LPaxmHKxFdv7VOQHJ', name: 'Liam' },
  { id: 'bIHbv24MWmeRgasZH58o', name: 'Will' },
  { id: 'iP95p4xoKVk53GoZ742B', name: 'Chris' },
  { id: 'nPczCjzI2devNBz1zQrb', name: 'Brian' },
  { id: 't0jbNlBVZ17f02VDIeMI', name: 'Jessie' },
  // MiniMax TTS
  { id: 'Korean_SoothingLady',       name: 'Soothing' },
  { id: 'Korean_SweetGirl',          name: 'Sweet' },
  { id: 'Korean_ReliableSister',     name: 'Reliable' },
  { id: 'Korean_MatureLady',         name: 'Mature' },
  { id: 'Korean_ThoughtfulWoman',    name: 'Thoughtful' },
  { id: 'Korean_SassyGirl',          name: 'Sassy' },
  { id: 'Korean_QuirkyGirl',         name: 'Quirky' },
  { id: 'Korean_MysteriousGirl',     name: 'Mysterious' },
  { id: 'Korean_ShyGirl',            name: 'Shy' },
  { id: 'Korean_AirheadedGirl',      name: 'Airheaded' },
  { id: 'Korean_ReliableYouth',      name: 'Youth' },
  { id: 'Korean_OptimisticYouth',    name: 'Optimistic' },
  { id: 'Korean_IntellectualMan',    name: 'Intellectual' },
  { id: 'Korean_IntellectualSenior', name: 'Senior' },
  { id: 'Korean_LonelyWarrior',      name: 'Warrior' },
  { id: 'Korean_PlayboyCharmer',     name: 'Charmer' },
  { id: 'Korean_PossessiveMan',      name: 'Possessive' },
  { id: 'Korean_StrictBoss',         name: 'Boss' },
  { id: 'Korean_WiseTeacher',        name: 'Teacher' },
  { id: 'Korean_WiseElf',            name: 'Elf' },
];

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
  const router = useRouter();

  function handleEditScenes(v: Video) {
    if (!v.scenes?.length) return;
    // 기존 active 세션 완전 제거 → edit 데이터만 남김
    sessionStorage.removeItem('clipflow_active_scenes');
    sessionStorage.removeItem('clipflow_script');
    sessionStorage.setItem('clipflow_edit_scenes', JSON.stringify({
      scenes: v.scenes,
      format: v.format === 'landscape' ? 'landscape' : 'shorts',
      imageModelId: v.image_model,
      imageStyle: v.image_style,
      voiceId: v.voice_id,
      ttsProvider: v.tts_provider,
    }));
    window.dispatchEvent(new Event('clipflow_edit_scenes_updated'));
    router.push('/dashboard/video');
  }

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

  const handleDelete = async (id: string) => {
    if (!window.confirm('영상과 관련 파일(이미지, 오디오)이 모두 삭제됩니다. 계속하시겠습니까?')) return;

    try {
      const res = await fetch('/api/delete-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error);
      }
      setVideos(prev => prev.filter(v => v.id !== id));
    } catch (err) {
      alert('삭제 중 오류가 발생했습니다');
      console.error(err);
    }
  };

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
      <div className="flex items-center gap-3 mb-4">
        <div className="inline-flex items-center gap-1.5 px-4 py-1.5 border border-green-400/30 bg-[#0a0a0a]">
          <span className="w-1 h-1 bg-green-400 rounded-full" />
          <span className="text-green-400 text-[11px] font-mono tracking-widest uppercase">내 영상</span>
        </div>
        <span className="text-[#17BEBB]/70 text-xs tracking-widest uppercase font-mono">총 {videos.length}개</span>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {paged.map((v) => (
          <div key={v.id} className="border border-white/10 flex flex-col">
            {/* 썸네일 / 영상 영역 */}
            <div className="relative bg-black h-[320px] overflow-hidden">
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
                  className="w-full h-full flex items-center justify-center group relative"
                >
                  {/* 썸네일: 이미지가 있으면 img, 없으면 영상 첫 프레임 캡처 */}
                  {v.scenes?.[0]?.imageUrl ? (
                    <img
                      src={v.scenes[0].imageUrl}
                      alt={v.title}
                      className="absolute inset-0 w-full h-full object-cover opacity-70 group-hover:opacity-90 transition-opacity"
                    />
                  ) : (
                    <VideoThumbnail
                      src={v.video_url}
                      className="absolute inset-0 w-full h-full object-cover opacity-70 group-hover:opacity-90 transition-opacity"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />
                  <span className="relative text-3xl text-white/60 group-hover:text-white/90 transition-colors drop-shadow-lg z-10">▶</span>
                  {v.title && (
                    <span className="absolute bottom-2 left-2 right-2 text-white/80 text-[11px] font-mono line-clamp-2 leading-snug drop-shadow z-10">
                      {v.title}
                    </span>
                  )}
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
              <div className="flex flex-wrap gap-1">
                <span className="text-[13px] 2xl:text-[12px] font-mono text-[#17BEBB]/60 border border-[#17BEBB]/20 px-1 py-0.5">
                  {v.format === 'shorts' ? '9:16 쇼츠' : '16:9 유튜브'}
                </span>
                {v.image_style && v.image_style !== 'none' && (
                  <span className="text-[13px] 2xl:text-[12px] font-mono text-[#17BEBB]/60 border border-[#17BEBB]/20 px-1 py-0.5">
                    {IMAGE_STYLE_LABELS[v.image_style] ?? v.image_style}
                  </span>
                )}
                {v.scene_count && (
                  <span className="text-[13px] 2xl:text-[12px] font-mono text-[#17BEBB]/60 border border-[#17BEBB]/20 px-1 py-0.5">
                    {v.scene_count}장면
                  </span>
                )}
                {v.tts_provider && (
                  <span className="text-[13px] 2xl:text-[12px] font-mono text-[#17BEBB]/60 border border-[#17BEBB]/20 px-1 py-0.5">
                    {v.tts_provider === 'google' ? 'Google TTS' : v.tts_provider === 'minimax' ? 'MiniMax TTS' : 'ElevenLabs'}
                    {v.voice_id && ALL_VOICES.find(vo => vo.id === v.voice_id) && (
                      <> · {ALL_VOICES.find(vo => vo.id === v.voice_id)!.name}</>
                    )}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between gap-2">
                <p className="text-white/50 text-[13px] font-mono">
                  {new Date(v.created_at).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </p>
                <div className="flex items-center gap-2">
                  {v.scenes?.length ? (
                    <button
                      onClick={() => handleEditScenes(v)}
                      className="text-[12px] 2xl:text-[11.5px] font-mono text-[#17BEBB]/70 hover:text-[#17BEBB] border border-[#17BEBB]/30 hover:border-[#17BEBB]/60 px-2 py-1 transition-colors shrink-0"
                    >
                      장면 편집
                    </button>
                  ) : null}
                  <button
                    onClick={() => handleDelete(v.id)}
                    className="text-[13px] 2xl:text-[12.5px] font-mono text-red-500/70 hover:text-red-500 px-2 py-1 transition-colors shrink-0"
                  >
                    삭제
                  </button>
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
                    className="text-[12px] 2xl:text-[11.5px] font-mono text-black bg-yellow-400 hover:bg-yellow-300 disabled:bg-yellow-400/50 px-3 py-1 transition-colors shrink-0"
                  >
                    {downloading === v.id ? '다운 중...' : 'MP4 다운'}
                  </button>
                </div>
              </div>
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
