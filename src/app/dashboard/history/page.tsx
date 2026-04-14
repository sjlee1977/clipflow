'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Film } from 'lucide-react';
import { createClient } from '@/lib/supabase-browser';
const supabase = createClient();

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
    const handleMeta = () => { video.currentTime = 0.5; };
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
      {!ready && <div className="absolute inset-0 bg-black/80 flex items-center justify-center"><span className="w-3 h-3 border border-white/20 border-t-white/60 rounded-full animate-spin" /></div>}
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
  template_id: string;
  tts_provider: string;
  file_name: string;
  created_at: string;
  scenes?: any[];
};

const IMAGE_STYLE_LABELS: Record<string, string> = {
  cinematic: '영화', realistic: '실사', anime: '애니', documentary: '다큐',
  '3d': '3D', watercolor: '수채화', cartoon: '카툰', noir: '누아르', kinetic: '키네틱',
  lineart: '라인아트', none: '없음',
};

const TEMPLATE_LABELS: Record<string, string> = {
  classic: '클래식', cinematic: '시네마틱', audiogram: '오디오그램',
  captions: 'TikTok', codehike: '코드하이크', slides: 'PPT 슬라이드',
  kinetic: '키네틱', '3d': '3D', lightleak: '라이트릭', matrix: '매트릭스', particle: '파티클',
};

const IMAGE_MODEL_LABELS: Record<string, string> = {
  'qwen/qwen-image-2.0': 'Qwen Image',
  'fal/fast-sdxl': 'SDXL',
  'fal/flux/dev': 'FLUX Dev',
  'fal/flux/schnell': 'FLUX Schnell',
  'fal/stable-diffusion-v3-medium': 'SD3',
  'fal/aura-flow': 'AuraFlow',
  'fal/hyper-sdxl': 'Hyper SDXL',
  'imagen-3.0-generate-001': 'Imagen 3',
  'imagen-3.0-fast-generate-001': 'Imagen 3 Fast',
};

const ALL_VOICES: { id: string; name: string }[] = [
  { id: 'ko-KR-Standard-A', name: 'Standard A' }, { id: 'ko-KR-Standard-B', name: 'Standard B' },
  { id: 'ko-KR-Wavenet-A', name: 'Wavenet A' }, { id: 'ko-KR-Neural2-A', name: 'Neural2 A' },
  { id: 'Korean_SoothingLady', name: 'Soothing' }, { id: 'Korean_SweetGirl', name: 'Sweet' },
  { id: 'Korean_ReliableSister', name: 'Reliable' }, { id: 'Korean_MatureLady', name: 'Mature' },
  { id: 'Korean_StrictBoss', name: 'Boss' }, { id: 'Korean_WiseTeacher', name: 'Teacher' },
  { id: 'Korean_IntellectualMan', name: 'Intellectual' }, { id: 'Korean_OptimisticYouth', name: 'Optimistic' },
];

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
    } catch (e: any) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = proxyUrl;
  a.download = `${title || 'video'}.mp4`;
  a.click();
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}일 전`;
  if (hours > 0) return `${hours}시간 전`;
  return `${mins}분 전`;
}

export default function HistoryPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const router = useRouter();

  function handleEditScenes(v: Video) {
    if (!v.scenes?.length) return;
    sessionStorage.removeItem('clipflow_active_scenes');
    sessionStorage.removeItem('clipflow_script');
    sessionStorage.setItem('clipflow_edit_scenes', JSON.stringify({
      scenes: v.scenes, format: v.format === 'landscape' ? 'landscape' : 'shorts',
      imageModelId: v.image_model, imageStyle: v.image_style,
      voiceId: v.voice_id, ttsProvider: v.tts_provider,
    }));
    window.dispatchEvent(new Event('clipflow_edit_scenes_updated'));
    router.push('/dashboard/video');
  }

  useEffect(() => {
    supabase.from('videos').select('*').order('created_at', { ascending: false })
      .then(({ data }: { data: unknown[] | null }) => { setVideos((data ?? []) as Video[]); setLoading(false); });
  }, []);

  const handleDelete = async (id: string) => {
    if (!window.confirm('영상과 관련 파일이 모두 삭제됩니다. 계속하시겠습니까?')) return;
    try {
      const res = await fetch('/api/delete-video', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
      if (!res.ok) { const { error } = await res.json(); throw new Error(error); }
      setVideos(prev => prev.filter(v => v.id !== id));
    } catch (err) { alert('삭제 중 오류가 발생했습니다'); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32 gap-3 text-white/20">
        <span className="w-4 h-4 border border-white/20 border-t-white/60 rounded-full animate-spin" />
        <span className="text-[12px] font-mono tracking-widest uppercase">Loading...</span>
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <span className="w-7 h-7 flex items-center justify-center rounded-lg shrink-0" style={{ background: 'rgba(79,142,247,0.06)', border: '1px solid rgba(79,142,247,0.22)', color: '#4f8ef7' }}>
            <Film size={13} strokeWidth={1.8} />
          </span>
          <span className="text-sm font-semibold text-white">내 영상</span>
        </div>
        <div className="flex flex-col items-center justify-center py-32 gap-5">
          <div className="w-16 h-16 border border-white/8 rounded-2xl flex items-center justify-center">
            <span className="text-2xl text-white/10">▶</span>
          </div>
          <div className="text-center">
            <p className="text-[13px] text-white/30 font-mono">아직 생성된 영상이 없습니다</p>
            <a href="/dashboard/video" className="text-[12px] text-[#4f8ef7]/50 hover:text-[#4f8ef7] transition-colors mt-1 block font-mono">
              영상 만들기 →
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="w-7 h-7 flex items-center justify-center rounded-lg shrink-0" style={{ background: 'rgba(79,142,247,0.06)', border: '1px solid rgba(79,142,247,0.22)', color: '#4f8ef7' }}>
            <Film size={13} strokeWidth={1.8} />
          </span>
          <span className="text-sm font-semibold text-white">내 영상</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-white/20 tracking-widest uppercase">Total</span>
          <span className="text-[13px] font-black font-mono text-[#4f8ef7]">{videos.length}</span>
        </div>
      </div>

      {/* 테이블 헤더 */}
      <div className="grid grid-cols-[36px_96px_1fr_72px_130px] gap-4 items-center px-4 py-2 mb-1 border-b border-white/6">
        <span className="text-[10px] font-mono text-white/25 tracking-widest uppercase">순위</span>
        <span className="text-[10px] font-mono text-white/25 tracking-widest uppercase">썸네일</span>
        <span className="text-[10px] font-mono text-white/25 tracking-widest uppercase">제목 / 옵션</span>
        <span className="text-[10px] font-mono text-white/25 tracking-widest uppercase text-right">게시일</span>
        <span className="text-[10px] font-mono text-white/25 tracking-widest uppercase text-right">액션</span>
      </div>

      {/* 영상 리스트 */}
      <div className="space-y-0.5">
        {videos.map((v, i) => (
          <div key={v.id} className="group rounded-xl border border-white/5 hover:border-white/12 bg-white/[0.015] hover:bg-white/[0.035] transition-all duration-150 overflow-hidden">
            <div className="grid grid-cols-[36px_96px_1fr_72px_130px] gap-4 items-center px-4 py-2.5">

              {/* 순위 */}
              <span className={`text-[13px] font-black font-mono tabular-nums ${i < 3 ? 'text-[#4f8ef7]' : 'text-white/25'}`}>
                #{i + 1}
              </span>

              {/* 썸네일 — 고정 크기 */}
              <div className="relative w-[96px] h-[60px] rounded overflow-hidden bg-black/60 border border-white/8 flex-shrink-0">
                  <div className="cursor-pointer w-full h-full relative" onClick={() => setPlaying(playing === v.id ? null : v.id)}>
                    {v.scenes?.[0]?.imageUrl ? (
                      <img src={v.scenes[0].imageUrl} alt={v.title} className="absolute inset-0 w-full h-full object-cover opacity-75 group-hover:opacity-95 transition-opacity" />
                    ) : (
                      <VideoThumbnail src={v.video_url} className="absolute inset-0 w-full h-full object-cover opacity-75 group-hover:opacity-95 transition-opacity" />
                    )}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="w-6 h-6 flex items-center justify-center bg-black/50 rounded-full text-white text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">▶</span>
                    </div>
                    <span className={`absolute bottom-0.5 left-0.5 text-[8px] font-mono font-bold px-1 rounded-sm ${v.format === 'shorts' ? 'bg-purple-500/80 text-white' : 'bg-blue-500/80 text-white'}`}>
                      {v.format === 'shorts' ? '9:16' : v.format === 'landscape' ? '16:9' : '1:1'}
                    </span>
                  </div>
              </div>

              {/* 제목 + 모든 뱃지 (영상스타일·이미지·TTS 통합) */}
              <div className="min-w-0">
                <p
                  className="text-[13px] font-semibold text-white/85 truncate leading-tight mb-1.5 cursor-pointer hover:text-white transition-colors"
                  onClick={() => setPlaying(playing === v.id ? null : v.id)}
                >
                  {v.title || '제목 없는 영상'}
                  <span className={`ml-1.5 text-[10px] font-mono text-white/20 transition-transform inline-block ${playing === v.id ? 'rotate-180' : ''}`}>▾</span>
                </p>
                <div className="flex items-center gap-1 flex-wrap">
                  {v.scene_count > 0 && (
                    <span className="text-[10px] font-mono text-white/40 bg-white/6 border border-white/10 px-1.5 py-0.5 rounded">
                      {v.scene_count}장면
                    </span>
                  )}
                  {v.template_id && (
                    <span className="text-[10px] font-mono text-purple-300/80 bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 rounded">
                      {TEMPLATE_LABELS[v.template_id] ?? v.template_id}
                    </span>
                  )}
                  {v.image_style && v.image_style !== 'none' && (
                    <span className="text-[10px] font-mono text-sky-300/70 bg-sky-500/8 border border-sky-500/15 px-1.5 py-0.5 rounded">
                      {IMAGE_STYLE_LABELS[v.image_style] ?? v.image_style}
                    </span>
                  )}
                  {v.image_model && (
                    <span className="text-[10px] font-mono text-amber-300/60 bg-amber-500/8 border border-amber-500/15 px-1.5 py-0.5 rounded">
                      {IMAGE_MODEL_LABELS[v.image_model] ?? v.image_model.split('/').pop()}
                    </span>
                  )}
                  {v.tts_provider && (
                    <span className="text-[10px] font-mono text-emerald-300/60 bg-emerald-500/8 border border-emerald-500/15 px-1.5 py-0.5 rounded">
                      {v.tts_provider === 'google' ? 'Google' : v.tts_provider === 'minimax' ? 'MiniMax' : 'ElevenLabs'}
                      {ALL_VOICES.find(vo => vo.id === v.voice_id) ? ` · ${ALL_VOICES.find(vo => vo.id === v.voice_id)!.name}` : ''}
                    </span>
                  )}
                </div>
              </div>

              {/* 게시일 */}
              <div className="text-right">
                <span className="text-[12px] font-mono text-white/40">{timeAgo(v.created_at)}</span>
              </div>

              {/* 액션 버튼 */}
              <div className="flex items-center justify-end gap-1.5">
                {v.scenes?.length ? (
                  <button
                    onClick={() => handleEditScenes(v)}
                    className="text-[11px] font-mono px-2.5 py-1 border border-white/12 hover:border-white/30 text-white/40 hover:text-white/75 rounded transition-colors"
                  >
                    편집
                  </button>
                ) : null}
                <button
                  onClick={() => handleDelete(v.id)}
                  className="text-[11px] font-mono px-2.5 py-1 border border-red-500/15 hover:border-red-500/40 text-red-400/50 hover:text-red-400 rounded transition-colors"
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
                  className="bg-[#4f8ef7] hover:bg-[#0284c7] disabled:opacity-40 text-black font-black text-[11px] tracking-tight uppercase px-3 py-1 rounded transition-colors"
                >
                  {downloading === v.id ? '...' : '↓ MP4'}
                </button>
              </div>

            </div>

            {/* 펼침 영상 플레이어 */}
            {playing === v.id && (
              <div className="border-t border-white/6 bg-black/40 px-4 py-4">
                <div className={`mx-auto relative bg-black rounded-xl overflow-hidden ${v.format === 'shorts' ? 'max-w-[280px]' : 'max-w-[640px]'}`}>
                  <video
                    src={v.video_url}
                    controls
                    autoPlay
                    className="w-full block"
                    style={{ maxHeight: v.format === 'shorts' ? '500px' : '360px', objectFit: 'contain' }}
                  />
                </div>
                <div className="flex items-center justify-center mt-2">
                  <button
                    onClick={() => setPlaying(null)}
                    className="text-[11px] font-mono text-white/30 hover:text-white/60 transition-colors"
                  >
                    ▴ 닫기
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

    </div>
  );
}
