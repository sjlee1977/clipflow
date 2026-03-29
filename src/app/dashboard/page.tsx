'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
const LLM_MODELS = [
  { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash', price: '균형' },
  { id: 'google/gemini-2.5-pro', name: 'Gemini 2.5 Pro', price: '고품질' },
];

const IMAGE_MODELS = [
  { id: 'google/gemini-2.5-flash-image', name: 'Gemini 2.5 Flash Image', price: '균형' },
  { id: 'fal/z-image-turbo', name: 'Z-Image Turbo (fal.ai)', price: '빠름' },
  { id: 'fal/z-image-base', name: 'Z-Image Base (fal.ai)', price: '고품질' },
];

const VIDEO_MODELS = [
  { id: 'kling-v3', name: 'Kling v3 (최신 고성능)', price: '고품질' },
  { id: 'kling-v2-6', name: 'Kling v2.6 (가성비)', price: '균형' },
  { id: 'fal-wan-v2.1', name: 'WAN 2.1 (fal.ai)', price: '빠름' },
];
import { MINIMAX_VOICES } from '@/lib/minimax-tts';
import { GOOGLE_VOICES } from '@/lib/google';
export const ELEVENLABS_VOICES = [
  { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam (남성)', gender: 'male' },
  { id: 'jsCq9z7qwP5uCFS9ufK3', name: 'Bella (여성)', gender: 'female' },
  { id: 'ThT5KcBeq8keWAlS799P', name: 'Rachel (여성)', gender: 'female' },
];
import { supabase } from '@/lib/supabase';

type Status = 'idle' | 'previewing' | 'preview' | 'rendering' | 'done' | 'error';
type Format = 'shorts' | 'landscape' | 'square';

const IMAGE_STYLES = [
  { id: 'cinematic', label: '영화' },
  { id: 'realistic', label: '실사' },
  { id: 'anime', label: '애니' },
  { id: 'documentary', label: '다큐' },
  { id: '3d', label: '3D' },
  { id: 'watercolor', label: '수채화' },
  { id: 'cartoon', label: '카툰' },
  { id: 'noir', label: '누아르' },
  { id: 'none', label: '선택 없음' },
] as const;

type ImageStyle = typeof IMAGE_STYLES[number]['id'];

const TEXT_ANIMATIONS = [
  { id: 'typewriter', label: '타이핑' },
  { id: 'fly-in', label: '슬라이드' },
  { id: 'pop-in', label: '팝업' },
  { id: 'fade-zoom', label: '페이드 줌' },
  { id: 'clock-spin', label: '시계 바늘' },
  { id: 'pulse-ring', label: '맥박(강조)' },
  { id: 'sparkle', label: '반짝임' },
  { id: 'confetti', label: '축하 꽃가루' },
  { id: 'rain', label: '비 내림' },
  { id: 'snow', label: '눈 내림' },
  { id: 'fire', label: '불꽃/열정' },
  { id: 'heart', label: '사랑/하트' },
  { id: 'stars', label: '별밤/우주' },
  { id: 'thunder', label: '천둥/충격' },
  { id: 'chart-up', label: '성장/상승' },
  { id: 'film-roll', label: '영화/기록' },
  { id: 'magnifier', label: '돋보기/관찰' },
  { id: 'lock-secure', label: '보안/결론' },
  { id: 'camera-flash', label: '스포트라이트' },
] as const;

type TextAnimationId = typeof TEXT_ANIMATIONS[number]['id'];

type PreviewScene = {
  text: string;
  imageUrl: string;
  imagePrompt: string;
  motionPrompt?: string;
  shouldAnimate?: boolean;
  videoUrl?: string;
  isAnimating?: boolean;
  isLoading?: boolean;
  textAnimationStyle?: 'none' | 'typewriter' | 'fly-in' | 'pop-in' | 'fade-zoom';
  textPosition?: 'bottom' | 'center' | 'top';
};

/* ── 오른쪽 패널 섹션 (일반) ── */
function PanelSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-white/5 pb-4 mb-4">
      <p className="text-[#17BEBB]/60 text-[13px] tracking-widest uppercase mb-2">{label}</p>
      {children}
    </div>
  );
}

/* ── 오른쪽 패널 섹션 (아코디언) ── */
function PanelAccordion({ label, value, children, closeOnSelect = false }: {
  label: string;
  value: string;
  children: React.ReactNode;
  closeOnSelect?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-white/5 mb-1">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between py-3 group"
      >
        <span className="text-[#17BEBB]/70 text-[13px] tracking-widest uppercase">{label}</span>
        <span className="flex items-center gap-2">
          <span className="text-white/70 text-[13px] font-mono truncate max-w-[180px]">{value}</span>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
            className={`text-white/20 group-hover:text-white/40 transition-all duration-200 ${open ? 'rotate-180' : ''}`}>
            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </span>
      </button>
      {open && (
        <div className="pb-3" onClick={closeOnSelect ? () => setOpen(false) : undefined}>
          {children}
        </div>
      )}
    </div>
  );
}

/* ── 가격 티어 뱃지 ── */
function PriceBadge({ price }: { price?: string }) {
  if (!price) return null;
  const isFree = price.includes('무료');
  const val = parseFloat(price.replace(/[^0-9.]/g, ''));
  let cls = 'text-white/25 bg-white/5';
  if (isFree)      cls = 'text-green-400/80 bg-green-400/10';
  else if (val < 1) cls = 'text-yellow-400/70 bg-yellow-400/10';
  else if (val < 5) cls = 'text-orange-400/70 bg-orange-400/10';
  else              cls = 'text-red-400/60 bg-red-400/10';
  return (
    <span className={`text-[11px] font-mono px-1.5 py-0.5 rounded-sm whitespace-nowrap ${cls}`}>
      {isFree ? 'FREE' : price}
    </span>
  );
}

/* ── 오른쪽 패널 선택 버튼 ── */
function OptionItem({ active, onClick, children, sub }: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  sub?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between px-2 py-2 text-[13px] font-mono border-l-2 transition-colors ${
        active
          ? 'border-yellow-400 text-yellow-400 bg-yellow-400/5'
          : 'border-transparent text-white/65 hover:text-white hover:border-white/30'
      }`}
    >
      <span>{children}</span>
      <PriceBadge price={sub} />
    </button>
  );
}

export default function DashboardPage() {
  const [script, setScript] = useState('');
  const [format, setFormat] = useState<Format>('landscape');
  const [imageModelId, setImageModelId] = useState('google/gemini-2.5-flash-image');
  const [llmModelId, setLlmModelId] = useState('google/gemini-2.5-flash-lite');
  const [ttsProvider, setTtsProvider] = useState<'minimax' | 'google' | 'elevenlabs'>('google');
  const [videoModelId, setVideoModelId] = useState('fal-wan-v2.1');
  const [voiceId, setVoiceId] = useState('Kore');
  const [characterImageBase64, setCharacterImageBase64] = useState<string | null>(null);
  const [characterPreview, setCharacterPreview] = useState<string | null>(null);
  const [subCharacters, setSubCharacters] = useState<{ preview: string; base64: string; name: string }[]>([]);
  const [imageStyle, setImageStyle] = useState<ImageStyle>('cinematic');
  const [useTextAnims, setUseTextAnims] = useState(true);
  const [selectedTextAnims] = useState<TextAnimationId[]>([
    'typewriter', 'fly-in', 'pop-in', 'fade-zoom', 'clock-spin', 'pulse-ring', 'sparkle',
    'confetti', 'rain', 'snow', 'fire', 'heart', 'stars', 'thunder',
    'chart-up', 'film-roll', 'magnifier', 'lock-secure', 'camera-flash'
  ]);
  const characterInputRef = useRef<HTMLInputElement>(null);
  const subCharacterInputRef = useRef<HTMLInputElement>(null);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [renderProgress, setRenderProgress] = useState(0);
  const [animatingCount, setAnimatingCount] = useState(0);

  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');
  const [scenes, setScenes] = useState<PreviewScene[]>([]);
  const [videoUrl, setVideoUrl] = useState('');
  const [genTotal, setGenTotal] = useState(0);
  const [genCompleted, setGenCompleted] = useState(0);

  // [장면 보존 및 복구]
  useEffect(() => {
    const savedScript = sessionStorage.getItem('clipflow_script');
    const savedEdit = sessionStorage.getItem('clipflow_edit_scenes');
    const savedActive = sessionStorage.getItem('clipflow_active_scenes');

    // 1. 새 대본이 넘어온 경우 최우선 (기존 작업 내역 초기화)
    if (savedScript) {
      setScript(savedScript);
      setScenes([]);
      setStatus('idle');
      sessionStorage.removeItem('clipflow_script');
      // 기존 잔여 active state 삭제
      sessionStorage.removeItem('clipflow_active_scenes');
    } 
    // 2. 새 대본이 없으면 이전 세션(편집/활성) 복구
    else if (savedEdit || savedActive) {
      const source = savedEdit || savedActive;
      try {
        const data = JSON.parse(source!);
        if (data.scenes?.length) {
          setScenes(data.scenes);
          if (data.format) setFormat(data.format);
          if (data.imageModelId) setImageModelId(data.imageModelId);
          if (data.imageStyle) setImageStyle(data.imageStyle);
          if (data.voiceId) setVoiceId(data.voiceId);
          if (data.ttsProvider) setTtsProvider(data.ttsProvider);
          if (data.videoUrl) { setVideoUrl(data.videoUrl); setStatus('done'); } else setStatus('preview');
        }
      } catch (err) {
        console.error('[Dashboard] Restore failed:', err);
      }
      if (savedEdit) sessionStorage.removeItem('clipflow_edit_scenes');
    }
    // 3. 실시간 업데이트 리스너 (사이드바에서 선택 시)
    const handleScriptUpdate = () => {
      const updated = sessionStorage.getItem('clipflow_script');
      if (updated) {
        setScript(updated);
        // 필요하다면 기존 장면 데이터 초기화 (신규 대본이므로)
        setScenes([]);
        setStatus('idle');
      }
    };

    window.addEventListener('clipflow_script_updated', handleScriptUpdate);
    return () => window.removeEventListener('clipflow_script_updated', handleScriptUpdate);
  }, []);

  // [상태 자동 저장] 장면이나 설정이 바뀌면 실시간 보존 (새로고침 사고 대비)
  useEffect(() => {
    if (scenes.length > 0) {
      const stateToSave = { 
        scenes, format, imageModelId, imageStyle, voiceId, ttsProvider, 
        videoUrl: status === 'done' ? videoUrl : '' 
      };
      sessionStorage.setItem('clipflow_active_scenes', JSON.stringify(stateToSave));
    }
  }, [scenes, format, imageModelId, imageStyle, voiceId, ttsProvider, status, videoUrl]);
  const [usageInfo, setUsageInfo] = useState<{ promptTokens: number; completionTokens: number; imageCount: number; imageModelId: string; llmModelId: string } | null>(null);
  const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(null);
  const replaceInputRefs = useRef<{ [key: number]: HTMLInputElement | null }>({});

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const [loadingAudioIndex, setLoadingAudioIndex] = useState<number | null>(null);

  const isProcessing = status === 'previewing' || status === 'rendering';

  function handleCharacterUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setCharacterPreview(dataUrl);
      setCharacterImageBase64(dataUrl.split(',')[1]);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  function handleSubCharacterUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (subCharacters.length >= 5) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setSubCharacters(prev => [...prev, { preview: dataUrl, base64: dataUrl.split(',')[1], name: `캐릭터 ${prev.length + 2}` }]);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  function removeSubCharacter(index: number) {
    setSubCharacters(prev => prev.filter((_, i) => i !== index));
  }


  function updateSubCharacterName(index: number, name: string) {
    setSubCharacters(prev => prev.map((c, i) => i === index ? { ...c, name } : c));
  }

  async function handlePreview() {
    if (!script.trim()) return;
    setStatus('previewing');
    setError('');
    setScenes([]);
    setUsageInfo(null);
    setGenTotal(0);
    setGenCompleted(0);
    try {
      const res = await fetch('/api/generate-scenes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          script, 
          imageModelId, 
          llmModelId, 
          format, 
          characterImageBase64, 
          imageStyle, 
          subCharacters: subCharacters.map(c => ({ base64: c.base64, name: c.name })),
          allowedAnimations: useTextAnims ? selectedTextAnims : ['none']
        }),
      });
      if (!res.ok || !res.body) throw new Error('장면 생성 실패');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      const newScenes: PreviewScene[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const event = JSON.parse(line.slice(6));
          if (event.type === 'error') throw new Error(event.message);
          if (event.type === 'total') {
            setGenTotal(event.count);
            setScenes(Array.from({ length: event.count }, () => ({
              text: '', imageUrl: '', imagePrompt: '', isLoading: true,
            })));
          }
          if (event.type === 'scene') {
            setGenCompleted(prev => prev + 1);
            const sceneData = { 
              text: event.text, 
              imagePrompt: event.imagePrompt, 
              imageUrl: event.imageUrl,
              motionPrompt: event.motionPrompt,
              shouldAnimate: event.shouldAnimate,
              textAnimationStyle: event.textAnimationStyle,
              textPosition: event.textPosition
            };
            newScenes[event.index] = sceneData;
            setScenes(prev => {
              const next = [...prev];
              next[event.index] = sceneData;
              return next;
            });
          }
          if (event.type === 'done') {
            if (event.usage) setUsageInfo(event.usage);
            setStatus('preview');
            // 자동 애니메이션 시작 (RPM 초과 방지 위해 3초 간격)
            const animTargets = newScenes
              .map((s, idx) => ({ s, idx }))
              .filter(({ s }) => s && !s.videoUrl); // 비디오 없는 모든 장면 대상

            animTargets.forEach(({ idx }, i) => {
              setTimeout(() => {
                console.log(`[AutoAnim] Triggering scene ${idx + 1}`);
                handleAnimateScene(idx, newScenes);
              }, i * 3500);
            });
          }
        }
      }
    } catch (err: unknown) {
      setStatus('error');
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
    }
  }

  /**
   * 장면 애니메이션화 (MiniMax Video)
   */
  async function handleAnimateScene(index: number, currentScenes?: PreviewScene[]) {
    const targetScenes = currentScenes || scenes;
    const scene = targetScenes[index];
    if (!scene?.imageUrl || scene.isAnimating || scene.videoUrl) return;
    
    setAnimatingCount(prev => prev + 1);
    setScenes(prev => prev.map((s, i) => i === index ? { ...s, isAnimating: true } : s));

    try {
      const provider = videoModelId.startsWith('kling') ? 'kling' : videoModelId.startsWith('fal-') ? 'fal' : 'minimax';
      const res = await fetch('/api/animate-scene', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: scene.imageUrl,
          prompt: scene.motionPrompt || scene.text,
          provider,
          model: videoModelId,
          duration: (index === 0 || index === scenes.length - 1) ? 5 : 10,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '애니메이션 시작 실패');

      const { taskId } = data;

      const poll = async () => {
        try {
          const sRes = await fetch(`/api/animate-scene?taskId=${taskId}&provider=${provider}`);
          const sData = await sRes.json();
          if (!sRes.ok) throw new Error(sData.error || '상태 확인 실패');

          if (sData.task_status === 'succeed') {
            setScenes(prev => prev.map((s, i) => i === index ? { ...s, videoUrl: sData.video_url, isAnimating: false } : s));
            setAnimatingCount(prev => Math.max(0, prev - 1));
            return;
          }

          if (sData.task_status === 'failed') {
            throw new Error(sData.task_status_msg || '변환 중 오류 발생');
          }

          setTimeout(poll, 4000);
        } catch (pollErr: any) {
          console.error('[animate poll]', pollErr);
          setError(`AI 비디오 변환 실패 (장면 ${index + 1}): ${pollErr.message}`);
          setScenes(prev => prev.map((s, i) => i === index ? { ...s, isAnimating: false } : s));
          setAnimatingCount(prev => Math.max(0, prev - 1));
        }
      };

      poll();
    } catch (err: any) {
      setError(err.message);
      setScenes(prev => prev.map((s, i) => i === index ? { ...s, isAnimating: false } : s));
      setAnimatingCount(prev => Math.max(0, prev - 1));
    }
  }

  async function handleRender() {
    if (scenes.length === 0) return;
    setStatus('rendering');
    setRenderProgress(0);
    setError('');
    try {
      const res = await fetch('/api/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenes, voiceId, speed: playbackRate, format, ttsProvider }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '영상 생성 시작 실패');

      const { renderId, bucketName } = data;

      // 비동기 폴링 상태 확인
      const pollStart = Date.now();
      const TIMEOUT_MS = 10 * 60 * 1000; // 10분 타임아웃

      const poll = async () => {
        try {
          // 타임아웃 체크
          if (Date.now() - pollStart > TIMEOUT_MS) {
            throw new Error('렌더링 시간 초과 (10분). AWS Lambda 상태를 확인해주세요.');
          }

          const sRes = await fetch(`/api/get-render-status?renderId=${renderId}&bucketName=${bucketName}`);
          const sData = await sRes.json();
          if (!sRes.ok) throw new Error(sData.error || '상태 확인 실패');

          if (sData.done) {
            setVideoUrl(sData.outputFile);
            setStatus('done');
            setRenderProgress(1);
            // 파일명 생성: clipflow260324001
            const now = new Date();
            const yy = String(now.getFullYear()).slice(2);
            const mmdd = String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0');
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
            const { count } = await supabase.from('videos').select('*', { count: 'exact', head: true }).gte('created_at', todayStart);
            const seq = String((count ?? 0) + 1).padStart(3, '0');
            const fileName = `clipflow${yy}${mmdd}${seq}`;

            await supabase.from('videos').insert({
              title: script.slice(0, 50) || '제목 없음',
              video_url: sData.outputFile,
              format,
              scene_count: scenes.length,
              voice_id: voiceId,
              image_style: imageStyle,
              image_model: imageModelId,
              tts_provider: ttsProvider,
              file_name: fileName,
              scenes: scenes.map(s => ({ text: s.text, imageUrl: s.imageUrl, imagePrompt: s.imagePrompt, motionPrompt: s.motionPrompt, shouldAnimate: s.shouldAnimate, videoUrl: s.videoUrl })),
            });
            return;
          }

          if (sData.fatalErrorEncountered) {
            const errMessages = Array.isArray(sData.errors) && sData.errors.length > 0
              ? sData.errors.map((e: any) => e.message).filter(Boolean).join(' | ')
              : null;
            throw new Error(errMessages || '렌더링 중 치명적 오류가 발생했습니다. 서버 로그를 확인해주세요.');
          }

          setRenderProgress(sData.overallProgress);
          setTimeout(poll, 3000);
        } catch (pollErr: any) {
          setStatus('error');
          setError(pollErr.message || '렌더링 상태 확인 중 오류');
        }
      };

      poll();
    } catch (err: unknown) {
      setStatus('error');
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
    }
  }

  function updateSceneText(index: number, text: string) {
    setScenes(prev => prev.map((s, i) => (i === index ? { ...s, text } : s)));
  }

  function updateSceneStyle(index: number, style: PreviewScene['textAnimationStyle']) {
    setScenes(prev => prev.map((s, i) => (i === index ? { ...s, textAnimationStyle: style } : s)));
  }

  function updateScenePosition(index: number, position: PreviewScene['textPosition']) {
    setScenes(prev => prev.map((s, i) => (i === index ? { ...s, textPosition: position } : s)));
  }

  async function handleRegenerateImage(index: number) {
    const scene = scenes[index];
    if (!scene || regeneratingIndex !== null) return;
    setRegeneratingIndex(index);
    try {
      const res = await fetch('/api/regenerate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imagePrompt: scene.imagePrompt, imageModelId, format, imageStyle, characterImageBase64, subCharacters: subCharacters.map(c => ({ base64: c.base64, name: c.name })) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '재생성 실패');
      setScenes(prev => prev.map((s, i) => i === index ? { ...s, imageUrl: data.imageUrl } : s));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRegeneratingIndex(null);
    }
  }

  async function handleReplaceImage(index: number, file: File) {
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      try {
        const res = await fetch('/api/upload-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: dataUrl }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '업로드 실패');
        setScenes(prev => prev.map((s, i) => i === index ? { ...s, imageUrl: data.imageUrl } : s));
      } catch (err: any) {
        setError(err.message);
      }
    };
    reader.readAsDataURL(file);
  }

  const handlePlayScene = useCallback(async (index: number, text: string) => {
    if (playingIndex === index) {
      audioRef.current?.pause();
      audioRef.current = null;
      setPlayingIndex(null);
      return;
    }
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    setPlayingIndex(null);
    setLoadingAudioIndex(index);
    try {
      const res = await fetch('/api/preview-speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voiceId, ttsProvider }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || '음성 미리듣기 생성에 실패했습니다.');
      }
      
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.playbackRate = playbackRate;
      audioRef.current = audio;
      setPlayingIndex(index);
      audio.play();
      audio.onended = () => { URL.revokeObjectURL(url); setPlayingIndex(null); audioRef.current = null; };
    } catch (err: any) {
      setPlayingIndex(null);
      setError(err.message || '음성 미리듣기 생성 중 오류가 발생했습니다.');
    } finally {
      setLoadingAudioIndex(null);
    }
  }, [playingIndex, voiceId, playbackRate]);

  const selectedImageModel = IMAGE_MODELS.find(m => m.id === imageModelId);
  const selectedVoice =
    MINIMAX_VOICES.find(v => v.id === voiceId) ??
    GOOGLE_VOICES.find(v => v.id === voiceId);

  function calcEstimatedCost(info: typeof usageInfo): string | null {
    if (!info) return null;
    let cost = 0;
    const llm = LLM_MODELS.find(m => m.id === info.llmModelId);
    if (llm && !llm.price.includes('무료')) {
      const inM = llm.price.match(/입\$([0-9.]+)/);
      const outM = llm.price.match(/출\$([0-9.]+)/);
      if (inM) cost += (info.promptTokens / 1e6) * parseFloat(inM[1]);
      if (outM) cost += (info.completionTokens / 1e6) * parseFloat(outM[1]);
    }
    const img = IMAGE_MODELS.find(m => m.id === info.imageModelId);
    if (img && !img.price.includes('무료')) {
      const priceM = img.price.match(/\$([0-9.]+)/);
      if (priceM) cost += parseFloat(priceM[1]) * info.imageCount;
    }
    return cost > 0 ? `~$${cost.toFixed(3)}` : null;
  }

  return (
    /* 전체: 왼쪽 콘텐츠 + 오른쪽 패널 (w-56) */
    <div className="flex gap-0 -m-6 min-h-full">

      {/* ─── 왼쪽: 메인 콘텐츠 ─── */}
      <div className="flex-1 min-w-0 p-6 border-r border-white/5">

        {/* ── 입력 단계 ── */}
        {(status === 'idle' || (status === 'previewing' && genTotal === 0) || (status === 'error' && scenes.length === 0)) && (
          <div className="flex flex-col h-full">
            {/* 입력 카드 */}
            <div className="relative mt-10 flex flex-col">
              {/* 탭 레이블 */}
              <div className="absolute top-0 left-0 -translate-y-full inline-flex items-center gap-1.5 px-4 py-1.5 border-t border-l border-r border-orange-400/30 bg-[#0a0a0a]">
                <span className="w-1 h-1 bg-orange-400 rounded-full" />
                <span className="text-orange-400 text-[13px] font-mono tracking-widest uppercase">영상 만들기</span>
              </div>

              <div className={`flex flex-col border transition-colors duration-200 ${
                isProcessing ? 'border-white/5' : 'border-white/10 hover:border-orange-400/60 focus-within:border-orange-400/60'
              } bg-white/[0.02]`}>
              {/* 상단 라벨 */}
              <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-white/5">
                <span className="text-[10.5px] tracking-widest uppercase font-mono" style={{color:'#8B9A3A'}}>SCRIPT INPUT</span>
                <span className={`text-[10px] font-mono tabular-nums transition-colors ${script.length > 0 ? 'text-white/40' : 'text-white/15'}`}>
                  {script.length.toLocaleString()}자
                </span>
              </div>

              {/* 텍스트 영역 */}
              <textarea
                value={script}
                onChange={e => setScript(e.target.value)}
                placeholder="대본 또는 주제를 입력하세요.&#10;&#10;예) '커피의 역사에 대해 60초 영상을 만들어줘'"
                className="w-full h-[280px] overflow-y-auto bg-transparent text-white/90 border-0 focus:outline-none resize-none text-[13px] leading-relaxed font-mono placeholder:text-white/20 px-4 py-3"
                disabled={isProcessing}
              />

              {/* 하단: TIP + 버튼 */}
              <div className="px-4 pb-3 flex items-center justify-between border-t border-white/5 pt-3">
                <span className="text-[12px] text-white/20 font-mono">TIP. 구체적일수록 더 좋은 영상이 만들어집니다</span>
                <button
                  onClick={handlePreview}
                  disabled={!script.trim() || isProcessing}
                  className="flex items-center gap-2 bg-orange-400 hover:bg-orange-300 disabled:bg-white/5 disabled:cursor-not-allowed text-black disabled:text-white/20 font-bold text-[13px] tracking-wide uppercase font-mono px-3 py-1.5 transition-colors group"
                >
                  {status === 'previewing' ? (
                    <>
                      <span className="w-2.5 h-2.5 border-2 border-black border-t-transparent rounded-full animate-spin inline-block" />
                      생성 중...
                    </>
                  ) : (
                    <>
                      장면 미리보기
                      <span className="inline-block transition-transform group-hover:translate-x-0.5">→</span>
                    </>
                  )}
                </button>
              </div>
            </div>
            </div>

            {/* 생성 중 프로그레스바 */}
            {status === 'previewing' && (
              <div className="mt-4 border border-white/10 bg-white/[0.02] p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-orange-400 rounded-full animate-pulse" />
                    <span className="text-orange-400/80 text-[11px] font-mono tracking-widest uppercase">
                      {genTotal === 0 ? '장면 분석 중...' : `이미지 생성 중 ${genCompleted} / ${genTotal}`}
                    </span>
                  </div>
                  <span className="text-white/20 text-[10px] font-mono">
                    {genTotal > 0 ? `${Math.round((genCompleted / genTotal) * 100)}%` : ''}
                  </span>
                </div>

                {/* 프로그레스바 */}
                <div className="w-full h-1 bg-white/5 overflow-hidden">
                  <div
                    className="h-full bg-orange-400 transition-all duration-500 ease-out"
                    style={{ width: genTotal === 0 ? '5%' : `${Math.max(5, (genCompleted / genTotal) * 100)}%` }}
                  />
                </div>

                {/* 장면 썸네일 미리보기 */}
                {scenes.length > 0 && (
                  <div className="mt-3 flex gap-1.5 flex-wrap">
                    {scenes.map((scene, i) => scene?.imageUrl ? (
                      <div key={i} className="relative w-10 h-14 shrink-0 overflow-hidden border border-orange-400/30">
                        <img src={scene.imageUrl} alt="" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/20" />
                      </div>
                    ) : (
                      <div key={i} className="w-10 h-14 shrink-0 border border-white/5 bg-white/[0.02] flex items-center justify-center">
                        <span className="w-2.5 h-2.5 border border-white/20 border-t-white/50 rounded-full animate-spin" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 에러 */}
            {status === 'error' && scenes.length === 0 && (
              <div className="border-l-2 border-red-500 pl-4 mt-4">
                <p className="text-red-400 text-xs font-mono">{error}</p>
                <button onClick={() => setStatus('idle')} className="mt-2 text-white/25 hover:text-white/60 text-xs font-mono transition-colors">다시 시도 →</button>
              </div>
            )}
          </div>
        )}

        {/* ── 미리보기 단계 ── */}
        {(status === 'previewing' && genTotal > 0 || status === 'preview' || status === 'rendering' || status === 'done' || (status === 'error' && scenes.length > 0)) && scenes.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/5">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-[#17BEBB]/70 text-[13px] tracking-widest uppercase font-mono">{scenes.length}개 장면</span>
                {status === 'previewing' && (
                  <span className="flex items-center gap-2 text-orange-400/80 text-[11px] font-mono">
                    <span className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-pulse" />
                    이미지 생성 중 {genCompleted} / {genTotal}
                  </span>
                )}
                {usageInfo && (
                  <span className="text-white/25 text-[12px] font-mono">
                    LLM {(usageInfo.promptTokens + usageInfo.completionTokens).toLocaleString()}토큰 · 이미지 {usageInfo.imageCount}장
                    {calcEstimatedCost(usageInfo) && (
                      <span className="text-yellow-400/50 ml-1">{calcEstimatedCost(usageInfo)}</span>
                    )}
                  </span>
                )}
                {animatingCount > 0 && (
                  <span className="flex items-center gap-2 bg-yellow-400/10 text-yellow-400 text-[11px] font-mono px-2 py-0.5 rounded-full animate-pulse">
                    <span className="w-1 h-1 bg-yellow-400 rounded-full" />
                    {animatingCount}개 애니메이션 중
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {videoUrl && status === 'preview' && (
                  <button
                    onClick={() => setStatus('done')}
                    className="text-[#17BEBB]/40 hover:text-[#17BEBB]/80 text-xs font-mono transition-colors"
                  >완성 영상 →</button>
                )}
                {status === 'preview' && (
                  <button
                    onClick={() => { 
                      setStatus('idle'); 
                      setScenes([]); 
                      setVideoUrl(''); 
                      sessionStorage.removeItem('clipflow_active_scenes');
                    }}
                    className="text-white/20 hover:text-white/50 text-xs font-mono transition-colors"
                  >← 처음으로</button>
                )}
              </div>
            </div>

            {/* 장면 리스트 */}
            <div>
              {scenes.map((scene, i) => (
                <div key={i} className="flex gap-4 py-4 border-b border-white/5">
                  <span className="text-white/40 text-xs font-mono pt-0.5 w-5 shrink-0 tabular-nums">{String(i + 1).padStart(2, '0')}</span>
                  <div className="w-16 h-16 shrink-0 overflow-hidden bg-white/5">
                    {scene.isLoading ? (
                      <div className="w-full h-full flex items-center justify-center bg-white/[0.03] animate-pulse">
                        <span className="w-4 h-4 border-2 border-white/20 border-t-orange-400/60 rounded-full animate-spin" />
                      </div>
                    ) : regeneratingIndex === i ? (
                      <div className="w-full h-full flex items-center justify-center bg-black/60">
                        <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      </div>
                    ) : (
                      <img src={scene.imageUrl} alt={`장면 ${i + 1}`} className="w-full h-full object-cover" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    {scene.isLoading ? (
                      <div className="space-y-2 pt-1">
                        <div className="h-2.5 bg-white/[0.06] rounded animate-pulse w-full" />
                        <div className="h-2.5 bg-white/[0.06] rounded animate-pulse w-4/5" />
                        <div className="h-2.5 bg-white/[0.06] rounded animate-pulse w-3/5" />
                      </div>
                    ) : (
                    <textarea
                      value={scene.text}
                      onChange={e => updateSceneText(i, e.target.value)}
                      disabled={status !== 'preview'}
                      rows={3}
                      className="w-full bg-transparent text-white/80 text-[13px] font-mono leading-relaxed border-0 focus:outline-none resize-none disabled:opacity-60"
                    />
                    )}
                    {!scene.isLoading && <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="text-white/35 text-[12px] font-mono">{scene.text.length}자</span>
                      <button
                        onClick={() => handlePlayScene(i, scene.text)}
                        disabled={loadingAudioIndex !== null && loadingAudioIndex !== i || scene.isAnimating}
                        className="text-white/25 hover:text-yellow-400 text-[12px] font-mono transition-colors disabled:opacity-20"
                      >
                        {loadingAudioIndex === i ? '로딩...' : playingIndex === i ? '■ 정지' : '▶ 미리듣기'}
                      </button>
                      <button
                        onClick={() => handleAnimateScene(i)}
                        disabled={status !== 'preview' || !!scene.videoUrl || scene.isAnimating}
                        className={`text-[12px] font-mono transition-colors ${
                          scene.videoUrl
                            ? 'text-yellow-400/50 cursor-default'
                            : 'text-white/25 hover:text-yellow-400 disabled:opacity-20'
                        }`}
                      >
                        {scene.isAnimating ? '변환 중...' : scene.videoUrl ? '✓ AI 비디오' : '✧ AI 애니메이션'}
                      </button>
                      {status === 'preview' && (
                        <>
                          <button
                            onClick={() => handleRegenerateImage(i)}
                            disabled={regeneratingIndex !== null}
                            className="text-white/25 hover:text-orange-400 text-[12px] font-mono transition-colors disabled:opacity-20"
                          >
                            {regeneratingIndex === i ? '재생성 중...' : '↺ 재생성'}
                          </button>
                          <button
                            onClick={() => replaceInputRefs.current[i]?.click()}
                            className="text-white/25 hover:text-[#17BEBB] text-[12px] font-mono transition-colors"
                          >↑ 교체</button>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            ref={el => { replaceInputRefs.current[i] = el; }}
                            onChange={e => { const f = e.target.files?.[0]; if (f) handleReplaceImage(i, f); e.target.value = ''; }}
                          />
                        </>
                      )}
                    </div>}
                    
                    {!scene.isLoading && (
                      <div className="flex items-center gap-2 mt-2">
                        <select 
                          value={scene.textAnimationStyle || 'none'}
                          onChange={(e) => updateSceneStyle(i, e.target.value as any)}
                          className="bg-white/5 text-white/40 text-[10px] font-mono border border-white/10 rounded px-1.5 py-1 focus:outline-none focus:border-yellow-400/50 hover:text-white/70 transition-colors"
                        >
                          <option value="none" className="bg-[#111]">애니메이션: 없음</option>
                          <option value="typewriter" className="bg-[#111]">타이핑 (Typewriter)</option>
                          <option value="fly-in" className="bg-[#111]">슬라이드 (Fly-in)</option>
                          <option value="pop-in" className="bg-[#111]">팝업 (Pop-in)</option>
                          <option value="fade-zoom" className="bg-[#111]">페이드 줌</option>
                        </select>
                        <select 
                          value={scene.textPosition || 'bottom'}
                          onChange={(e) => updateScenePosition(i, e.target.value as any)}
                          className="bg-white/5 text-white/40 text-[10px] font-mono border border-white/10 rounded px-1.5 py-1 focus:outline-none focus:border-yellow-400/50 hover:text-white/70 transition-colors"
                        >
                          <option value="bottom" className="bg-[#111]">위치: 하단</option>
                          <option value="center" className="bg-[#111]">위치: 중앙</option>
                          <option value="top" className="bg-[#111]">위치: 상단</option>
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* 영상 생성 버튼 */}
            {status === 'preview' && (
              <button
                onClick={handleRender}
                className="w-full mt-8 bg-yellow-400 hover:bg-yellow-300 text-black font-black py-3.5 transition-colors text-[13px] tracking-widest uppercase font-mono"
              >
                영상 생성 →
              </button>
            )}

            {status === 'error' && error && (
              <div className="mt-8 border-l-2 border-red-500 pl-4 py-1.5 bg-red-500/5">
                <p className="text-red-400 font-mono text-[12.5px] leading-relaxed">
                  <span className="font-bold flex items-center gap-1.5 mb-1">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    영상 생성 실패
                  </span>
                  {error.includes('Quota exceeded') || error.includes('429') ? (
                    <>
                      일일 할당량 초과, 다른 모델로 교체하세요.
                    </>
                  ) : error}
                </p>
                <div className="mt-3 flex items-center gap-4">
                  <button
                    onClick={() => { setStatus('preview'); setError(''); }}
                    className="text-white/40 hover:text-white/80 font-mono transition-colors text-[12px] flex items-center gap-1"
                  >
                    <span>↺</span> 다시 시도
                  </button>
                  {(error.includes('Quota exceeded') || error.includes('429')) && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setTtsProvider('minimax');
                          setVoiceId('Korean_SoothingLady');
                          setStatus('preview');
                          setError('');
                        }}
                        className="px-3 py-1 bg-yellow-400/10 hover:bg-yellow-400/20 border border-yellow-400/30 text-yellow-400 text-[12px] font-bold font-mono transition-all"
                      >
                        MiniMax로 전환
                      </button>
                      <button
                        onClick={() => {
                          setTtsProvider('elevenlabs');
                          setVoiceId('pNInz6obpgDQGcFmaJgB');
                          setStatus('preview');
                          setError('');
                        }}
                        className="px-3 py-1 bg-orange-400/10 hover:bg-orange-400/20 border border-orange-400/30 text-orange-400 text-[12px] font-bold font-mono transition-all"
                      >
                        ElevenLabs로 전환
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {status === 'rendering' && (
              <div className="mt-8 border-l-2 border-yellow-400/40 pl-4 py-1">
                <div className="flex items-center gap-3 mb-3">
                  <span className="w-3.5 h-3.5 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin shrink-0" />
                  <div>
                    <p className="text-yellow-400/80 text-xs font-mono">영상 생성 중... {Math.round(renderProgress * 100)}%</p>
                    <p className="text-[#17BEBB]/60 text-[11px] tracking-widest uppercase font-mono mt-0.5">
                      {renderProgress > 0 ? 'AWS Lambda 렌더링 진행 중' : '나레이션(TTS) 생성 및 렌더링 준비 중...'}
                    </p>
                  </div>
                </div>
                {/* 미니 프로그레스 바 */}
                <div className="w-full h-0.5 bg-white/5 overflow-hidden rounded-full">
                  <div 
                    className="h-full bg-yellow-400 transition-all duration-500 ease-out" 
                    style={{ width: `${renderProgress * 100}%` }}
                  />
                </div>
              </div>
            )}
          </>
        )}

        {/* ── 완성 ── */}
        {status === 'done' && videoUrl && (
          <div className="mt-2 flex flex-col items-center">
            {/* 헤더 */}
            <div className="w-full flex items-center justify-between pb-3 border-b border-white/5 mb-5">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                <span className="text-[#17BEBB]/70 text-[13px] tracking-widest uppercase font-mono">완성 영상</span>
              </div>
              <button
                onClick={() => setStatus('preview')}
                className="text-white/20 hover:text-white/60 text-xs font-mono transition-colors"
              >← 장면 편집</button>
            </div>

            {/* 비디오 */}
            <div className={`w-full ${format === 'shorts' ? 'max-w-xs' : format === 'square' ? 'max-w-sm' : 'max-w-xl'} border border-white/10 overflow-hidden`}>
              <video src={videoUrl} controls className="w-full block" />
            </div>

            {/* 버튼 */}
            <div className={`w-full ${format === 'shorts' ? 'max-w-xs' : format === 'square' ? 'max-w-sm' : 'max-w-xl'} flex items-center justify-center gap-2 mt-4`}>
              <button
                onClick={async () => {
                  const proxyUrl = `/api/download?url=${encodeURIComponent(videoUrl)}&filename=clipflow`;
                  if ('showSaveFilePicker' in window) {
                    try {
                      const handle = await (window as any).showSaveFilePicker({
                        suggestedName: 'clipflow.mp4',
                        types: [{ description: 'MP4 Video', accept: { 'video/mp4': ['.mp4'] } }],
                      });
                      const res = await fetch(proxyUrl);
                      const blob = await res.blob();
                      const writable = await handle.createWritable();
                      await writable.write(blob);
                      await writable.close();
                      return;
                    } catch (e: any) {
                      if (e.name === 'AbortError') return;
                    }
                  }
                  const a = document.createElement('a');
                  a.href = proxyUrl;
                  a.download = 'clipflow.mp4';
                  a.click();
                }}
                className="flex items-center gap-2 bg-yellow-400 hover:bg-yellow-300 text-black font-bold text-[13px] tracking-widest uppercase font-mono px-4 py-1.5 transition-colors"
              >
                ↓ 다운로드
              </button>
              <button
                onClick={() => { setStatus('idle'); setScenes([]); setVideoUrl(''); setScript(''); }}
                className="flex items-center gap-2 border border-white/15 hover:border-white/30 text-white/40 hover:text-white/70 text-[13px] font-mono tracking-widest uppercase px-4 py-1.5 transition-colors"
              >
                ↺ 새 영상
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ─── 오른쪽: 설정 패널 (w-56, 왼쪽 nav와 동일 너비) ─── */}
      <aside className="w-96 shrink-0 flex flex-col border-l border-white/5 overflow-y-auto">
        <div className="flex-1 px-4 py-5 space-y-0">

          {/* 입력 단계 설정 */}
          {(status === 'idle' || (status === 'previewing' && genTotal === 0) || (status === 'error' && scenes.length === 0)) && (
            <>
              <PanelSection label="스타일">
                <div className="flex flex-wrap gap-1 mb-4">
                  {IMAGE_STYLES.map(s => (
                    <button
                      key={s.id}
                      onClick={() => setImageStyle(s.id)}
                      disabled={isProcessing}
                      className={`px-3 py-1.5 text-[12.5px] font-mono border transition-colors ${
                        imageStyle === s.id
                          ? 'border-yellow-400 text-yellow-400'
                          : 'border-white/10 text-white/30 hover:border-white/30 hover:text-white/60'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>

                <p className="text-[#17BEBB]/60 text-[13px] tracking-widest uppercase mb-2 mt-6">텍스트 애니메이션</p>
                <button 
                  onClick={() => setUseTextAnims(!useTextAnims)}
                  className={`w-full px-3 py-4 rounded-md border transition-all text-left group ${
                    useTextAnims 
                    ? 'border-yellow-400/50 bg-yellow-400/10 text-yellow-100' 
                    : 'border-white/10 bg-white/5 text-white/30 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-[13px] font-bold ${useTextAnims ? 'text-yellow-400' : 'text-white/40'}`}>
                      AI 자동 연출 효과
                    </span>
                    <div className={`w-8 h-4 rounded-full relative transition-colors ${useTextAnims ? 'bg-yellow-400' : 'bg-white/10'}`}>
                      <div className={`absolute top-1 w-2 h-2 rounded-full bg-white transition-all ${useTextAnims ? 'right-1' : 'left-1'}`} />
                    </div>
                  </div>
                  <p className="text-[11px] opacity-60 leading-relaxed">
                    {useTextAnims 
                      ? "21종의 시네마틱 효과(꽃가루, 시계, 하트 등)를 AI가 대본에 맞춰 자동 연출합니다."
                      : "특수효과 없이 깔끔한 자막 스타일로 영상을 제작합니다."}
                  </p>
                </button>
              </PanelSection>

              <PanelSection label="비율">
                <div className="space-y-0.5">
                  {([['landscape', '유튜브', '16:9'], ['shorts', '쇼츠/릴스', '9:16'], ['square', '인스타그램', '1:1']] as const).map(([val, label, ratio]) => (
                    <OptionItem key={val} active={format === val} onClick={() => setFormat(val)}>
                      <span className="flex items-center gap-2">
                        <span className={`border border-current inline-block shrink-0 ${val === 'shorts' ? 'w-2.5 h-4' : val === 'square' ? 'w-3.5 h-3.5' : 'w-4 h-2.5'}`} />
                        {label} <span className="text-white/40">{ratio}</span>
                      </span>
                    </OptionItem>
                  ))}
                </div>
              </PanelSection>

              <PanelSection label="캐릭터">
                {/* 메인 캐릭터 */}
                <p className="text-white/30 text-[10px] font-mono mb-1.5">메인 캐릭터</p>
                <div
                  onClick={() => !isProcessing && characterInputRef.current?.click()}
                  className={`w-full flex items-center gap-2 px-2 py-2 text-xs font-mono border border-white/10 text-white/30 transition-colors ${
                    !isProcessing ? 'hover:border-white/30 hover:text-white/60 cursor-pointer' : 'opacity-30 cursor-not-allowed'
                  }`}
                >
                  {characterPreview
                    ? <img src={characterPreview} alt="메인캐릭터" className="w-5 h-5 object-cover rounded-sm" />
                    : <span className="w-5 h-5 border border-white/20 flex items-center justify-center text-[11px]">+</span>
                  }
                  <span>{characterPreview ? '변경' : '이미지 선택'}</span>
                  {characterPreview && (
                    <button
                      onClick={e => { e.stopPropagation(); setCharacterPreview(null); setCharacterImageBase64(null); }}
                      className="ml-auto text-white/20 hover:text-red-400 transition-colors"
                    >✕</button>
                  )}
                </div>
                <input ref={characterInputRef} type="file" accept="image/*" className="hidden" onChange={handleCharacterUpload} />

                {/* 추가 캐릭터 */}
                <p className="text-white/30 text-[10px] font-mono mt-3 mb-1.5">서브 캐릭터 <span className="text-white/20">({subCharacters.length}/5)</span></p>
                <div className="space-y-1.5">
                  {subCharacters.map((char, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <img src={char.preview} alt={char.name} className="w-5 h-5 object-cover rounded-sm shrink-0" />
                      <input
                        type="text"
                        value={char.name}
                        onChange={e => updateSubCharacterName(i, e.target.value)}
                        className="flex-1 bg-transparent border border-white/10 px-2 py-1 text-[11px] font-mono text-white/60 focus:outline-none focus:border-white/30 min-w-0"
                        placeholder="캐릭터 이름"
                      />
                      <button
                        onClick={() => removeSubCharacter(i)}
                        className="text-white/20 hover:text-red-400 transition-colors text-xs shrink-0"
                      >✕</button>
                    </div>
                  ))}
                  {subCharacters.length < 5 && (
                    <div
                      onClick={() => !isProcessing && subCharacterInputRef.current?.click()}
                      className={`w-full flex items-center gap-2 px-2 py-2 text-xs font-mono border border-dashed border-white/10 text-white/20 transition-colors ${
                        !isProcessing ? 'hover:border-white/30 hover:text-white/40 cursor-pointer' : 'opacity-30 cursor-not-allowed'
                      }`}
                    >
                      <span className="w-5 h-5 border border-white/20 flex items-center justify-center text-[11px]">+</span>
                      <span>서브 캐릭터 추가</span>
                    </div>
                  )}
                </div>
                <input ref={subCharacterInputRef} type="file" accept="image/*" className="hidden" onChange={handleSubCharacterUpload} />
              </PanelSection>

              <PanelAccordion label="장면 AI" value={LLM_MODELS.find(m => m.id === llmModelId)?.name ?? ''} closeOnSelect>
                <div className="space-y-0.5">
                  {LLM_MODELS.map(m => (
                    <OptionItem key={m.id} active={llmModelId === m.id} onClick={() => setLlmModelId(m.id)} sub={m.price}>
                      {m.name}
                    </OptionItem>
                  ))}
                </div>
              </PanelAccordion>

              <PanelAccordion label="이미지 AI" value={IMAGE_MODELS.find(m => m.id === imageModelId)?.name ?? ''} closeOnSelect>
                <div className="space-y-0.5">
                  {IMAGE_MODELS.map(m => (
                    <OptionItem key={m.id} active={imageModelId === m.id} onClick={() => setImageModelId(m.id)} sub={m.price}>
                      {m.name}
                    </OptionItem>
                  ))}
                </div>
              </PanelAccordion>

              <PanelAccordion label="영상 AI" value={VIDEO_MODELS.find(m => m.id === videoModelId)?.name ?? ''} closeOnSelect>
                <div className="space-y-0.5">
                  {VIDEO_MODELS.map(m => (
                    <OptionItem key={m.id} active={videoModelId === m.id} onClick={() => setVideoModelId(m.id)} sub={m.price}>
                      {m.name}
                    </OptionItem>
                  ))}
                </div>
              </PanelAccordion>
            </>
          )}

          {/* 미리보기 단계 설정 */}
          {(status === 'previewing' && genTotal > 0 || status === 'preview' || status === 'rendering' || (status === 'error' && scenes.length > 0)) && (
            <>
              <PanelSection label="보이스">
                <div className="grid grid-cols-3 gap-1.5 px-0.5">
                  <div className="flex flex-col min-w-0">
                    <p className="text-white/25 text-[10px] font-mono tracking-wider uppercase mb-1.5 truncate">MiniMax</p>
                    <select
                      value={ttsProvider === 'minimax' ? voiceId : ''}
                      onChange={e => { setVoiceId(e.target.value); setTtsProvider('minimax'); }}
                      className="w-full bg-[#111] text-white/70 text-[12px] font-mono px-1 py-1.5 border border-white/10 hover:border-white/20 focus:outline-none focus:border-orange-400/50 transition-colors [&>option]:bg-[#111] [&>option]:text-white/80"
                    >
                      <option value="" disabled>선택</option>
                      {MINIMAX_VOICES.map(v => (
                        <option key={v.id} value={v.id}>{v.name.split(' (')[0]}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <p className="text-white/25 text-[10px] font-mono tracking-wider uppercase mb-1.5 truncate">Google</p>
                    <select
                      value={ttsProvider === 'google' ? voiceId : ''}
                      onChange={e => { setVoiceId(e.target.value); setTtsProvider('google'); }}
                      className="w-full bg-[#111] text-white/70 text-[12px] font-mono px-1 py-1.5 border border-white/10 hover:border-white/20 focus:outline-none focus:border-orange-400/50 transition-colors [&>option]:bg-[#111] [&>option]:text-white/80"
                    >
                      <option value="" disabled>선택</option>
                      {GOOGLE_VOICES.map(v => (
                        <option key={v.id} value={v.id}>{v.name.split(' (')[0]}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <p className="text-white/25 text-[10px] font-mono tracking-wider uppercase mb-1.5 truncate">ElevenLabs</p>
                    <select
                      value={ttsProvider === 'elevenlabs' ? voiceId : ''}
                      onChange={e => { setVoiceId(e.target.value); setTtsProvider('elevenlabs'); }}
                      className="w-full bg-[#111] text-white/70 text-[12px] font-mono px-1 py-1.5 border border-white/10 hover:border-white/20 focus:outline-none focus:border-orange-400/50 transition-colors [&>option]:bg-[#111] [&>option]:text-white/80"
                    >
                      <option value="" disabled>선택</option>
                      {ELEVENLABS_VOICES.map(v => (
                        <option key={v.id} value={v.id}>{v.name.split(' (')[0]}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </PanelSection>

              <PanelSection label="나레이션 속도">
                <div className="px-1">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-white/30 text-[13px] font-mono">속도</span>
                    <span className="text-yellow-400 text-[13px] font-mono">{playbackRate.toFixed(2)}x</span>
                  </div>
                  <input
                    type="range" min={0.5} max={2.0} step={0.25} value={playbackRate}
                    onChange={e => setPlaybackRate(parseFloat(e.target.value))}
                    className="w-full accent-yellow-400 h-0.5"
                  />
                  <div className="flex justify-between text-white/15 text-[12px] font-mono mt-2">
                    <span>0.5x</span><span>1.0x</span><span>2.0x</span>
                  </div>
                </div>
              </PanelSection>

              {/* 현재 설정 요약 */}
              <div className="mt-4 space-y-1.5">
                <p className="text-[#17BEBB]/70 text-[13px] tracking-widest uppercase mb-2">설정 요약</p>
                <div className="flex justify-between text-[13px] font-mono">
                  <span className="text-white/20">스타일</span>
                  <span className="text-white/40">{IMAGE_STYLES.find(s => s.id === imageStyle)?.label}</span>
                </div>
                <div className="flex justify-between text-[13px] font-mono">
                  <span className="text-white/20">비율</span>
                  <span className="text-white/40">{format === 'shorts' ? '9:16' : format === 'square' ? '1:1' : '16:9'}</span>
                </div>
                <div className="flex justify-between text-[13px] font-mono">
                  <span className="text-white/20">이미지 AI</span>
                  <span className="text-white/40">{selectedImageModel?.name?.split(' ').slice(0, 2).join(' ')}</span>
                </div>
                <div className="flex justify-between text-[13px] font-mono">
                  <span className="text-white/20">목소리</span>
                  <span className="text-white/40">{selectedVoice?.name}</span>
                </div>
              </div>
            </>
          )}

          {/* 완성 단계 */}
          {status === 'done' && (
            <div className="space-y-1.5">
              <p className="text-[#17BEBB]/70 text-[13px] tracking-widest uppercase mb-3">생성 완료</p>
              <div className="flex justify-between text-[13px] font-mono">
                <span className="text-white/20">장면 수</span>
                <span className="text-white/40">{scenes.length}개</span>
              </div>
              <div className="flex justify-between text-[13px] font-mono">
                <span className="text-white/20">스타일</span>
                <span className="text-white/40">{IMAGE_STYLES.find(s => s.id === imageStyle)?.label}</span>
              </div>
              <div className="flex justify-between text-[13px] font-mono">
                <span className="text-white/20">비율</span>
                <span className="text-white/40">{format === 'shorts' ? '9:16 쇼츠' : format === 'square' ? '1:1 인스타' : '16:9 유튜브'}</span>
              </div>
            </div>
          )}

        </div>
      </aside>

    </div>
  );
}
