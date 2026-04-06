'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
const LLM_MODELS = [
  { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash', price: '균형' },
  { id: 'google/gemini-2.5-pro', name: 'Gemini 2.5 Pro', price: '고품질' },
];

const IMAGE_MODELS = [
  { id: 'google/gemini-2.5-flash-image', name: 'Gemini 2.5 Flash (이미지)', price: '균형' },
  { id: 'fal/z-image-turbo', name: 'Z-Image Turbo (fal.ai)', price: '빠름' },
  { id: 'fal/z-image-base', name: 'Z-Image Base (fal.ai)', price: '고품질' },
];

const VIDEO_MODELS = [
  { id: 'kling-v3', name: 'Kling v3 (최신)', price: '최고품질' },
  { id: 'kling-v2-1-master', name: 'Kling v2.1 Master', price: '최고품질' },
  { id: 'kling-v2-master', name: 'Kling v2 Master', price: '고품질' },
  { id: 'kling-v2-6', name: 'Kling v2.6', price: '고품질' },
  { id: 'kling-v1-6', name: 'Kling v1.6 (가성비)', price: '균형' },
  { id: 'fal-wan-v2.1', name: 'WAN 2.1 (fal.ai)', price: '빠름' },
];
import { MINIMAX_VOICES } from '@/lib/minimax-tts';
import { GOOGLE_VOICES } from '@/lib/google';
export const ELEVENLABS_VOICES: { id: string; name: string; desc: string; gender: 'male' | 'female' }[] = [
  // ── 여성 ──────────────────────────────────────────────
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah',   desc: '부드럽고 따뜻한',    gender: 'female' },
  { id: 'FGY2WhTYpPnrIDTdsKH5', name: 'Laura',   desc: '밝고 활기찬',        gender: 'female' },
  { id: 'XB0fDUnXU5powFXDhCwa', name: 'Charlotte', desc: '세련되고 차분한',  gender: 'female' },
  { id: 'Xb7hH8MSUJpSbSDYk0k2', name: 'Alice',   desc: '신뢰감 있는',        gender: 'female' },
  { id: 'cgSgspJ2msm6clMCkdW9', name: 'Jessica', desc: '표현력 있는',        gender: 'female' },
  { id: 'jBpfuIE2acCo8z3wKNLl', name: 'Matilda', desc: '따뜻하고 친근한',   gender: 'female' },
  { id: 'oWAxZDx7w5VEj9dCyTzz', name: 'Grace',   desc: '우아하고 감성적인',  gender: 'female' },
  { id: 'pFZP5JQG7iQjIQuC4Bku', name: 'Lily',    desc: '명랑하고 산뜻한',   gender: 'female' },
  { id: 'ThT5KcBeq8keWAlS799P', name: 'Rachel',  desc: '안정적이고 명확한',  gender: 'female' },
  { id: 'pqHfZKP75CvOlQylNhV4', name: 'Bill',    desc: '성숙하고 진지한',    gender: 'female' },
  // ── 남성 ──────────────────────────────────────────────
  { id: 'CwhRBWXzGAHq8TQ4Fs17', name: 'Roger',   desc: '자신감 있는',        gender: 'male' },
  { id: 'IKne3meq5aSn9XLyUdCD', name: 'Charlie', desc: '편안하고 자연스러운', gender: 'male' },
  { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George',  desc: '중후하고 권위있는',  gender: 'male' },
  { id: 'N2lVS1w4EtoT3dr4eOWO', name: 'Callum',  desc: '강렬하고 드라마틱한', gender: 'male' },
  { id: 'ODq5zmih8GrVes37Dizd', name: 'Patrick', desc: '명확하고 신뢰감 있는', gender: 'male' },
  { id: 'SOYHLrjzK2X1ezoPC6cr', name: 'Harry',   desc: '젊고 활기찬',        gender: 'male' },
  { id: 'TX3LPaxmHKxFdv7VOQHJ', name: 'Liam',    desc: '청명하고 또렷한',    gender: 'male' },
  { id: 'bIHbv24MWmeRgasZH58o', name: 'Will',    desc: '친근하고 캐주얼한',  gender: 'male' },
  { id: 'iP95p4xoKVk53GoZ742B', name: 'Chris',   desc: '편안한 나레이션',    gender: 'male' },
  { id: 'nPczCjzI2devNBz1zQrb', name: 'Brian',   desc: '깊고 안정적인',      gender: 'male' },
  { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel',  desc: '뉴스 앵커 스타일',   gender: 'male' },
  { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam',    desc: '클리어하고 전문적인', gender: 'male' },
  { id: 't0jbNlBVZ17f02VDIeMI', name: 'Jessie',  desc: '역동적인 나레이션',  gender: 'male' },
];
import { supabase } from '@/lib/supabase';
import { KOREAN_FONTS, DEFAULT_FONT_ID } from '@/lib/fonts';
import { TEMPLATES, DEFAULT_TEMPLATE_ID, TemplateId } from '@/lib/templates';

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
  { id: 'lineart', label: '라인아트' },
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
  displayText?: string; // 키네틱 모드: 화면 중앙 초대형 표시용 핵심 포인트
  imageUrl: string;
  imagePrompt: string;
  motionPrompt?: string;
  shouldAnimate?: boolean;
  videoUrl?: string;
  isAnimating?: boolean;
  isLoading?: boolean;
  textAnimationStyle?: 'none' | 'typewriter' | 'fly-in' | 'pop-in' | 'fade-zoom' | 'clock-spin' | 'pulse-ring' | 'sparkle' | 'confetti' | 'rain' | 'snow' | 'fire' | 'heart' | 'stars' | 'thunder' | 'chart-up' | 'film-roll' | 'magnifier' | 'lock-secure' | 'camera-flash';
  textPosition?: 'bottom' | 'center' | 'top';
  slideData?: { layout: string; title?: string; bullets?: string[] };
  pptTheme?: string;
  subtitles?: { text: string; startFrame: number; endFrame: number }[];
};

/**
 * [공통 유틸리티] 텍스트를 의미 단위로 균형 있게 분할하여 자막 배열 생성
 * - 괄호 () [] 보호
 * - 30자 기준 Balanced Split (중심 탐색)
 */
function isInsideBracket(str: string, pos: number): boolean {
  let depth = 0;
  for (let i = 0; i < pos; i++) {
    if (str[i] === '(' || str[i] === '[') depth++;
    if (str[i] === ')' || str[i] === ']') depth = Math.max(0, depth - 1);
  }
  return depth > 0;
}

function splitTextToSubtitles(text: string, maxChars = 30): { text: string; startFrame: number; endFrame: number }[] {
  const txt = text.trim();
  if (!txt) return [];
  const minChars = 10;
  const totalFrames = 300;

  function findSplitAt(remaining: string): number {
    if (remaining.length <= maxChars) return remaining.length;
    const mid = Math.floor(remaining.length / 2);
    let bestSplit = -1;
    let minDiff = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      if (isInsideBracket(remaining, i)) continue;
      const char = remaining[i] || '';
      const isPunc = /[.!?…,，。]/.test(char);
      const isSpace = /\s/.test(char);

      if (isPunc || isSpace) {
        const diff = Math.abs(i - mid);
        const weightedDiff = isPunc ? Math.max(0, diff - 5) : diff;
        if (weightedDiff < minDiff) {
          minDiff = weightedDiff;
          bestSplit = i + 1;
        }
      }
    }
    if (bestSplit === -1 || bestSplit < minChars || bestSplit > remaining.length - minChars) {
      return Math.min(maxChars, remaining.length);
    }
    return bestSplit;
  }

  const chunks: string[] = [];
  let rem = txt;
  while (rem.length > maxChars) {
    const splitAt = findSplitAt(rem);
    chunks.push(rem.slice(0, splitAt).trim());
    rem = rem.slice(splitAt).trim();
  }
  if (rem) chunks.push(rem);

  const totalChars = chunks.reduce((sum, c) => sum + c.length, 0);
  let currentF = 0;
  return chunks.map((chunk, j) => {
    const frames = j === chunks.length - 1 
      ? totalFrames - currentF 
      : Math.max(30, Math.round((chunk.length / totalChars) * totalFrames));
    const entry = { text: chunk, startFrame: currentF, endFrame: currentF + frames };
    currentF += frames;
    return entry;
  });
}

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
  const [llmModelId, setLlmModelId] = useState('google/gemini-2.5-flash');
  const [ttsProvider, setTtsProvider] = useState<'minimax' | 'google' | 'elevenlabs' | 'none'>('google');
  const [videoModelId, setVideoModelId] = useState('kling-v2-6');
  const [voiceId, setVoiceId] = useState('Kore');
  const [characterImageBase64, setCharacterImageBase64] = useState<string | null>(null);
  const [characterPreview, setCharacterPreview] = useState<string | null>(null);
  const [subCharacters, setSubCharacters] = useState<{ preview: string; base64: string; name: string }[]>([]);
  const [imageStyle, setImageStyle] = useState<ImageStyle>('cinematic');
  const [templateId, setTemplateId] = useState<TemplateId>(DEFAULT_TEMPLATE_ID);
  const [codeSnippet, setCodeSnippet] = useState('');
  const [fontFamily, setFontFamily] = useState(DEFAULT_FONT_ID);
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
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [scenes, setScenes] = useState<PreviewScene[]>([]);
  const [videoUrl, setVideoUrl] = useState('');
  const [genTotal, setGenTotal] = useState(0);
  const [genCompleted, setGenCompleted] = useState(0);
  const [pptMode, setPptMode] = useState(false);
  const [pptTheme, setPptTheme] = useState<'simple-modern' | 'dark' | 'colorful'>('dark');

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
          // 키네틱 스타일이었다면 복구 시 이미지 URL 제거 (이전 스타일 이미지 혼입 방지)
          const restoredScenes = data.imageStyle === 'kinetic'
            ? data.scenes.map((s: PreviewScene) => ({ ...s, imageUrl: '' }))
            : data.scenes;
          setScenes(restoredScenes);
          if (data.format) setFormat(data.format);
          if (data.imageModelId) setImageModelId(data.imageModelId);
          if (data.imageStyle) setImageStyle(data.imageStyle);
          if (data.voiceId) setVoiceId(data.voiceId);
          if (data.ttsProvider) setTtsProvider(data.ttsProvider);
          if (data.videoModelId) setVideoModelId(data.videoModelId);
          if (data.templateId) {
            setTemplateId(data.templateId);
            setPptMode(data.templateId === 'slides');
          }
          // savedEdit(히스토리)에서 온 경우 항상 preview로 — 자막/이미지 편집 + 재렌더링 가능
          if (savedEdit) {
            setStatus('preview');
          } else if (data.videoUrl) {
            setVideoUrl(data.videoUrl);
            setStatus('done');
          } else {
            setStatus('preview');
          }
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
        setScenes([]);
        setStatus('idle');
      }
    };

    // 4. 히스토리에서 장면 편집 클릭 시 (페이지 이미 마운트된 경우 대응)
    const handleEditScenesUpdate = () => {
      const raw = sessionStorage.getItem('clipflow_edit_scenes');
      if (!raw) return;
      try {
        const data = JSON.parse(raw);
        if (data.scenes?.length) {
          const restoredScenes = data.imageStyle === 'kinetic'
            ? data.scenes.map((s: PreviewScene) => ({ ...s, imageUrl: '' }))
            : data.scenes;
          setScenes(restoredScenes);
          if (data.format) setFormat(data.format);
          if (data.imageModelId) setImageModelId(data.imageModelId);
          if (data.imageStyle) setImageStyle(data.imageStyle);
          if (data.voiceId) setVoiceId(data.voiceId);
          if (data.ttsProvider) setTtsProvider(data.ttsProvider);
          setVideoUrl('');
          setStatus('preview');
        }
      } catch (err) {
        console.error('[Dashboard] Edit scenes restore failed:', err);
      }
      sessionStorage.removeItem('clipflow_edit_scenes');
      sessionStorage.removeItem('clipflow_active_scenes');
    };

    window.addEventListener('clipflow_script_updated', handleScriptUpdate);
    window.addEventListener('clipflow_edit_scenes_updated', handleEditScenesUpdate);
    return () => {
      window.removeEventListener('clipflow_script_updated', handleScriptUpdate);
      window.removeEventListener('clipflow_edit_scenes_updated', handleEditScenesUpdate);
    };
  }, []);

  // [상태 자동 저장] 장면이나 설정이 바뀌면 실시간 보존 (새로고침 사고 대비)
  useEffect(() => {
    if (scenes.length > 0) {
      const stateToSave = {
        scenes, format, imageModelId, imageStyle, voiceId, ttsProvider, videoModelId, templateId,
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
          allowedAnimations: selectedTextAnims,
          pptMode,
          pptTheme,
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
              displayText: event.displayText,
              imagePrompt: event.imagePrompt,
              imageUrl: event.imageUrl,
              motionPrompt: event.motionPrompt,
              shouldAnimate: event.shouldAnimate,
              textAnimationStyle: event.textAnimationStyle,
              textPosition: event.textPosition,
              slideData: event.slideData,
              pptTheme: event.pptTheme,
                  subtitles: event.text ? splitTextToSubtitles(event.text, 30) : [],
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
          duration: 10,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '애니메이션 시작 실패');

      const { taskId } = data;

      // 최대 8분 (4초 × 120회)
      const MAX_POLLS = 120;
      let pollCount = 0;

      const poll = async () => {
        if (pollCount >= MAX_POLLS) {
          setError(`AI 비디오 변환 시간 초과 (장면 ${index + 1}): 8분 내 완료되지 않았습니다. 다시 시도해주세요.`);
          setScenes(prev => prev.map((s, i) => i === index ? { ...s, isAnimating: false } : s));
          setAnimatingCount(prev => Math.max(0, prev - 1));
          return;
        }
        pollCount++;
        try {
          const sRes = await fetch(`/api/animate-scene?taskId=${encodeURIComponent(taskId)}&provider=${provider}`);
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
      setError(`AI 비디오 시작 실패 (장면 ${index + 1}): ${err.message}`);
      setScenes(prev => prev.map((s, i) => i === index ? { ...s, isAnimating: false } : s));
      setAnimatingCount(prev => Math.max(0, prev - 1));
    }
  }

  async function handleAutoAnimate() {
    const targets = scenes
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => s.shouldAnimate && !s.videoUrl && !s.isAnimating && s.imageUrl);
    for (let t = 0; t < targets.length; t++) {
      handleAnimateScene(targets[t].i);
      if (t < targets.length - 1) await new Promise(r => setTimeout(r, 1500));
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
        body: JSON.stringify({ scenes, voiceId, speed: playbackRate, format, ttsProvider, fontFamily, templateId, codeSnippet }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '영상 생성 시작 실패');

      const { renderId, bucketName } = data;

      // 비동기 폴링 상태 확인
      const pollStart = Date.now();
      const TIMEOUT_MS = 30 * 60 * 1000; // 30분 타임아웃

      const poll = async () => {
        try {
          // 타임아웃 체크
          if (Date.now() - pollStart > TIMEOUT_MS) {
            throw new Error('렌더링 시간 초과 (30분). AWS Lambda 상태를 확인해주세요.');
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
              scenes: scenes.map(s => ({ text: s.text, displayText: s.displayText, imageUrl: s.imageUrl, imagePrompt: s.imagePrompt, motionPrompt: s.motionPrompt, shouldAnimate: s.shouldAnimate, videoUrl: s.videoUrl, textAnimationStyle: s.textAnimationStyle, textPosition: s.textPosition })),
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

      {/* 라이트박스 */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm"
          onClick={() => setLightboxUrl(null)}
        >
          <img
            src={lightboxUrl}
            alt="원본 이미지"
            className="max-w-[90vw] max-h-[90vh] object-contain rounded shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
          <button
            className="absolute top-4 right-6 text-white/60 hover:text-white text-3xl leading-none"
            onClick={() => setLightboxUrl(null)}
          >×</button>
        </div>
      )}

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
                <span className="text-[10.5px] tracking-widest uppercase font-mono" style={{color:'#8B9A3A'}}>
                  {pptMode ? 'SLIDE DATA (TITLE & BULLETS)' : 'SCRIPT INPUT'}
                </span>
                <span className="text-[11px] font-mono tabular-nums" style={{ color: '#8B9A3A' }}>
                  {script.length.toLocaleString()}자
                </span>
              </div>

              {/* 텍스트 영역 */}
              <textarea
                value={script}
                onChange={e => setScript(e.target.value)}
                placeholder={pptMode 
                  ? "슬라이드 내용을 입력하세요. (제목: ..., 내용: ... 형식)\n\n예) '제목: 인공지능의 미래, 내용: - AI 기술 현황 - 향후 전망'" 
                  : "대본 또는 주제를 입력하세요.\n\n예) '커피의 역사에 대해 60초 영상을 만들어줘'"}
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
                {scenes.filter(s => s.shouldAnimate && !s.videoUrl && !s.isAnimating).length > 0 && (
                  <button
                    onClick={handleAutoAnimate}
                    className="flex items-center gap-1.5 bg-[#17BEBB]/10 border border-[#17BEBB]/40 hover:border-[#17BEBB] text-[#17BEBB] text-[11px] font-mono px-2 py-0.5 rounded-full transition-colors"
                  >
                    ✦ AI 추천 {scenes.filter(s => s.shouldAnimate && !s.videoUrl && !s.isAnimating).length}개 일괄 생성
                  </button>
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
            <div className="space-y-2 mt-2">
              {scenes.map((scene, i) => (
                <div
                  key={i}
                  className={`group rounded-lg overflow-hidden transition-all duration-200 ${
                    scene.videoUrl
                      ? 'bg-[#0c1a1a] border border-[#17BEBB]/40 shadow-[0_2px_12px_rgba(23,190,187,0.08)]'
                      : scene.isAnimating
                      ? 'bg-[#151005] border border-orange-400/35 shadow-[0_2px_12px_rgba(251,146,60,0.08)]'
                      : 'bg-[#111] border border-white/15 hover:border-white/30'
                  }`}
                >
                  {/* ── 헤더 행: 씬번호 + 미리듣기 + AI애니메이션 + 스타일 + 재생성/교체 ── */}
                  <div className={`flex items-center gap-2.5 px-4 py-2.5 border-b ${
                    scene.videoUrl ? 'border-[#17BEBB]/25 bg-[#17BEBB]/8' :
                    scene.isAnimating ? 'border-orange-400/25 bg-orange-400/8' :
                    'border-white/10 bg-white/[0.04]'
                  }`}>
                    {/* 씬 번호 */}
                    <span className={`text-[11px] font-medium tracking-widest uppercase shrink-0 ${
                      scene.videoUrl ? 'text-[#17BEBB]' : scene.isAnimating ? 'text-orange-400' : 'text-white/50'
                    }`}>
                      Scene {i + 1}
                    </span>

                    <div className="w-px h-4 bg-white/20 shrink-0" />

                    {/* 글자 수 뱃지 */}
                    {!scene.isLoading && (
                      <span className={`text-[12px] font-mono tabular-nums px-2 py-0.5 rounded shrink-0 ${
                        scene.text.length < 150 ? 'text-red-400 bg-red-400/15 border border-red-400/30' :
                        scene.text.length > 200 ? 'text-yellow-300 bg-yellow-400/15 border border-yellow-400/30' :
                        'text-white/60 bg-white/8 border border-white/15'
                      }`}>
                        {scene.text.length}자
                      </span>
                    )}

                    {/* 스페이서 */}
                    <div className="flex-1" />

                    {/* 미리듣기 */}
                    {!scene.isLoading && (
                      <button
                        onClick={() => handlePlayScene(i, scene.text)}
                        disabled={loadingAudioIndex !== null && loadingAudioIndex !== i || scene.isAnimating}
                        className="flex items-center gap-1.5 text-[13px] font-medium px-3 py-1.5 rounded border transition-colors disabled:opacity-30 shrink-0
                          border-white/25 text-white/70 hover:text-yellow-300 hover:border-yellow-400/50 hover:bg-yellow-400/8"
                      >
                        {loadingAudioIndex === i ? (
                          <><span className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />로딩</>
                        ) : playingIndex === i ? (
                          <>■ 정지</>
                        ) : (
                          <>▶ 미리듣기</>
                        )}
                      </button>
                    )}

                    {/* AI 애니메이션 */}
                    {!scene.isLoading && (
                      <button
                        onClick={() => handleAnimateScene(i)}
                        disabled={status !== 'preview' || !!scene.videoUrl || scene.isAnimating}
                        className={`flex items-center gap-1.5 text-[13px] font-medium px-3 py-1.5 rounded border transition-all shrink-0 ${
                          scene.videoUrl
                            ? 'text-[#17BEBB] bg-[#17BEBB]/12 border-[#17BEBB]/50 cursor-default'
                            : scene.isAnimating
                            ? 'text-orange-300 bg-orange-400/12 border-orange-400/40 animate-pulse cursor-wait'
                            : 'text-[#17BEBB] border-[#17BEBB]/40 hover:border-[#17BEBB]/70 hover:bg-[#17BEBB]/8 disabled:opacity-30 disabled:cursor-not-allowed'
                        }`}
                      >
                        {scene.isAnimating ? (
                          <><span className="w-3 h-3 border border-orange-400/50 border-t-orange-300 rounded-full animate-spin" />변환 중</>
                        ) : scene.videoUrl ? (
                          <>✓ AI 비디오</>
                        ) : (
                          <>✦ AI 애니메이션</>
                        )}
                      </button>
                    )}

                    {status === 'preview' && !scene.isLoading && (
                      <>
                        <div className="w-px h-4 bg-white/20 shrink-0" />
                        {/* 텍스트 애니메이션 스타일 */}
                        <select
                          value={scene.textAnimationStyle ?? 'none'}
                          onChange={e => updateSceneStyle(i, e.target.value as PreviewScene['textAnimationStyle'])}
                          className="text-[13px] font-medium bg-[#1a1a1a] border border-white/25 text-white/75 hover:border-white/45 hover:text-white rounded px-2.5 py-1.5 cursor-pointer focus:outline-none shrink-0"
                        >
                          <option value="none" className="bg-[#1a1a1a]">없음</option>
                          <optgroup label="진입" className="bg-[#1a1a1a]">
                            <option value="fly-in" className="bg-[#1a1a1a]">fly-in</option>
                            <option value="typewriter" className="bg-[#1a1a1a]">typewriter</option>
                            <option value="pop-in" className="bg-[#1a1a1a]">pop-in</option>
                            <option value="fade-zoom" className="bg-[#1a1a1a]">fade-zoom</option>
                          </optgroup>
                          <optgroup label="타이포" className="bg-[#1a1a1a]">
                            <option value="stagger-words" className="bg-[#1a1a1a]">stagger-words</option>
                            <option value="kinetic-bounce" className="bg-[#1a1a1a]">kinetic-bounce</option>
                            <option value="focus-highlight" className="bg-[#1a1a1a]">focus-highlight</option>
                          </optgroup>
                          <optgroup label="에너지" className="bg-[#1a1a1a]">
                            <option value="pulse-ring" className="bg-[#1a1a1a]">pulse-ring</option>
                            <option value="sparkle" className="bg-[#1a1a1a]">sparkle</option>
                            <option value="thunder" className="bg-[#1a1a1a]">thunder</option>
                            <option value="fire" className="bg-[#1a1a1a]">fire</option>
                            <option value="confetti" className="bg-[#1a1a1a]">confetti</option>
                            <option value="heart" className="bg-[#1a1a1a]">heart</option>
                          </optgroup>
                          <optgroup label="감성" className="bg-[#1a1a1a]">
                            <option value="rain" className="bg-[#1a1a1a]">rain</option>
                            <option value="snow" className="bg-[#1a1a1a]">snow</option>
                            <option value="stars" className="bg-[#1a1a1a]">stars</option>
                          </optgroup>
                          <optgroup label="정보" className="bg-[#1a1a1a]">
                            <option value="chart-up" className="bg-[#1a1a1a]">chart-up</option>
                            <option value="clock-spin" className="bg-[#1a1a1a]">clock-spin</option>
                            <option value="magnifier" className="bg-[#1a1a1a]">magnifier</option>
                            <option value="lock-secure" className="bg-[#1a1a1a]">lock-secure</option>
                            <option value="camera-flash" className="bg-[#1a1a1a]">camera-flash</option>
                            <option value="film-roll" className="bg-[#1a1a1a]">film-roll</option>
                          </optgroup>
                        </select>
                        {/* 재생성 */}
                        <button
                          onClick={() => handleRegenerateImage(i)}
                          disabled={regeneratingIndex !== null}
                          className="flex items-center gap-1.5 text-[13px] font-medium px-3 py-1.5 rounded border border-white/20 text-white/65 hover:text-orange-300 hover:border-orange-400/45 hover:bg-orange-400/8 transition-colors disabled:opacity-30 shrink-0"
                        >
                          ↺ 재생성
                        </button>
                        {/* 교체 */}
                        <button
                          onClick={() => replaceInputRefs.current[i]?.click()}
                          className="flex items-center gap-1.5 text-[13px] font-medium px-3 py-1.5 rounded border border-white/20 text-white/65 hover:text-[#17BEBB] hover:border-[#17BEBB]/45 hover:bg-[#17BEBB]/8 transition-colors shrink-0"
                        >
                          ↑ 교체
                        </button>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          ref={el => { replaceInputRefs.current[i] = el; }}
                          onChange={e => { const f = e.target.files?.[0]; if (f) handleReplaceImage(i, f); e.target.value = ''; }}
                        />
                      </>
                    )}
                  </div>

                  {/* ── 바디: 썸네일 + 텍스트 ── */}
                  <div className="flex gap-3 p-3">
                    {/* 썸네일 */}
                    <div
                      className={`relative w-[108px] h-[78px] shrink-0 overflow-hidden rounded-md bg-black/40 border border-white/10 ${scene.imageUrl ? 'cursor-zoom-in hover:border-white/30' : ''}`}
                      onClick={() => scene.imageUrl && setLightboxUrl(scene.imageUrl)}
                    >
                      {scene.isLoading ? (
                        <div className="w-full h-full flex items-center justify-center bg-white/[0.03]">
                          <span className="w-4 h-4 border-2 border-white/15 border-t-orange-400/70 rounded-full animate-spin" />
                        </div>
                      ) : regeneratingIndex === i ? (
                        <div className="w-full h-full flex items-center justify-center bg-black/70 backdrop-blur-sm">
                          <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        </div>
                      ) : scene.slideData ? (
                        <div className={`w-full h-full flex flex-col items-center justify-center p-1.5 text-center ${
                          scene.pptTheme === 'simple-modern' ? 'bg-white' :
                          scene.pptTheme === 'colorful' ? 'bg-gradient-to-br from-indigo-500 to-purple-600' :
                          'bg-[#0d0d0d]'
                        }`}>
                          <span className={`text-[7px] font-bold leading-tight ${scene.pptTheme === 'simple-modern' ? 'text-gray-800' : 'text-white'}`}>
                            {scene.slideData.title?.slice(0, 12) || 'SLIDE'}
                          </span>
                        </div>
                      ) : scene.imageUrl ? (
                        <img
                          src={scene.imageUrl}
                          alt={`장면 ${i + 1}`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-black p-1.5">
                          <span className="text-[9px] text-white/70 font-bold text-center leading-tight" style={{ wordBreak: 'keep-all' }}>
                            {scene.displayText?.slice(0, 16) || '키네틱'}
                          </span>
                        </div>
                      )}
                      {/* 비디오 뱃지 */}
                      {scene.videoUrl && (
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end justify-center pb-1">
                          <span className="text-[8px] font-bold font-mono text-[#17BEBB] tracking-widest">VIDEO</span>
                        </div>
                      )}
                      {scene.isAnimating && (
                        <div className="absolute inset-0 bg-black/55 flex items-center justify-center">
                          <span className="w-5 h-5 border-2 border-orange-400/40 border-t-orange-400 rounded-full animate-spin" />
                        </div>
                      )}
                    </div>

                    {/* 텍스트 */}
                    <div className="flex-1 min-w-0">
                      {scene.isLoading ? (
                        <div className="space-y-2 pt-1.5">
                          <div className="h-2.5 bg-white/[0.07] rounded-full animate-pulse w-full" />
                          <div className="h-2.5 bg-white/[0.07] rounded-full animate-pulse w-4/5" />
                          <div className="h-2.5 bg-white/[0.07] rounded-full animate-pulse w-3/5" />
                        </div>
                      ) : (
                        <textarea
                          value={scene.text}
                          onChange={e => updateSceneText(i, e.target.value)}
                          disabled={status !== 'preview'}
                          rows={3}
                          className="w-full h-full bg-transparent text-white/70 text-[12px] leading-relaxed border-0 focus:outline-none resize-none disabled:opacity-70 placeholder:text-white/25"
                          style={{ fontFamily: "'Inter', 'Pretendard', sans-serif", letterSpacing: '0.01em' }}
                        />
                      )}
                    </div>
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

            {(status === 'error' || status === 'preview') && error && (
              <div className="mt-8 border-l-2 border-red-500 pl-4 py-1.5 bg-red-500/5">
                <p className="text-red-400 font-mono text-[12.5px] leading-relaxed">
                  <span className="font-bold flex items-center gap-1.5 mb-1">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    {error.includes('비디오') ? '비디오 변환 실패' : '오류 발생'}
                  </span>
                  {error.includes('Quota exceeded') || error.includes('429') ? (
                    <>
                      일일 할당량 초과, 다른 모델로 교체하세요.
                    </>
                  ) : error}
                </p>
                <div className="mt-3 flex items-center gap-4">
                  <button
                    onClick={() => { if (status === 'error') setStatus('preview'); setError(''); }}
                    className="text-white/40 hover:text-white/80 font-mono transition-colors text-[12px] flex items-center gap-1"
                  >
                    <span>↺</span> {status === 'error' ? '다시 시도' : '오류 닫기'}
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
                <div className={`flex flex-wrap gap-1 mb-4 ${pptMode ? 'opacity-40' : ''}`}>
                  {IMAGE_STYLES.filter(s => s.id !== 'none').map(s => (
                    <button
                      key={s.id}
                      onClick={() => { setImageStyle(s.id); }}
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
                  <button
                    onClick={() => { setImageStyle('none'); }}
                    disabled={isProcessing}
                    className={`px-3 py-1.5 text-[12.5px] font-mono border transition-colors ${
                      imageStyle === 'none'
                        ? 'border-yellow-400 text-yellow-400'
                        : 'border-white/10 text-white/30 hover:border-white/30 hover:text-white/60'
                    }`}
                  >
                    선택 없음
                  </button>
                </div>


                <div className="mt-4">
                  <PanelAccordion
                    label="영상 스타일"
                    value={TEMPLATES.find(t => t.id === templateId)?.label || templateId}
                    closeOnSelect
                  >
                    <div className="space-y-0.5">
                      {TEMPLATES.map(t => (
                        <OptionItem
                          key={t.id}
                          active={templateId === t.id}
                          onClick={() => {
                            setTemplateId(t.id);
                            const isPpt = t.id === 'slides';
                            setPptMode(isPpt);
                            if (isPpt) setImageStyle('none');
                            if (t.id === 'kinetic') setImageStyle('none');
                          }}
                        >
                          <div className="flex flex-col items-start gap-0.5 text-left">
                            <span>{t.label}</span>
                            <p className="text-[10px] text-white/30 font-mono leading-tight">
                              {t.description}
                            </p>
                          </div>
                        </OptionItem>
                      ))}
                    </div>

                    {templateId === 'codehike' && (
                      <div className="mt-4 px-2 pb-2">
                        <p className="text-[#17BEBB] text-[10px] font-mono tracking-widest uppercase mb-2">Code Snippet</p>
                        <textarea
                          value={codeSnippet}
                          onChange={(e) => setCodeSnippet(e.target.value)}
                          rows={6}
                          placeholder="분석할 코드를 입력하세요..."
                          className="w-full bg-black/40 text-sky-200/90 border border-white/5 focus:border-[#17BEBB]/40 focus:outline-none text-[11px] font-mono p-3 rounded-sm resize-none"
                        />
                      </div>
                    )}
                  </PanelAccordion>

                  {pptMode && (
                    <div className="flex gap-1.5 mt-3 mb-2">
                      {([
                        { id: 'simple-modern', label: '심플 모던', desc: '흰 배경 · 깔끔' },
                        { id: 'dark', label: '다크', desc: '어두운 · 세련' },
                        { id: 'colorful', label: '컬러풀', desc: '그라디언트 · 화사' },
                      ] as const).map(t => (
                        <button key={t.id} onClick={() => setPptTheme(t.id)}
                          className={`flex flex-col items-start px-2 py-2 border text-left transition-colors flex-1 ${pptTheme === t.id ? 'border-orange-400 bg-orange-400/10' : 'border-white/10 hover:border-white/30'}`}>
                          <span className={`text-[11px] font-mono font-bold ${pptTheme === t.id ? 'text-orange-400' : 'text-white/60'}`}>{t.label}</span>
                          <span className="text-[9px] font-mono text-white/30 mt-0.5">{t.desc}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-2 text-white/50">
                <PanelAccordion label="자막 폰트" value={KOREAN_FONTS.find(f => f.id === fontFamily)?.label ?? ''} closeOnSelect>
                  <div className="space-y-0.5">
                    {KOREAN_FONTS.map((font) => (
                      <OptionItem key={font.id} active={fontFamily === font.id} onClick={() => setFontFamily(font.id)}>
                        {font.label}
                      </OptionItem>
                    ))}
                  </div>
                </PanelAccordion>
                </div>


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
                <p className="text-white/30 text-[11px] font-mono mb-1.5">메인 캐릭터</p>
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
                <p className="text-white/30 text-[11px] font-mono mt-3 mb-1.5">서브 캐릭터 <span className="text-white/20">({subCharacters.length}/5)</span></p>
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




              <div className="relative">
                <div className={pptMode ? 'opacity-30 pointer-events-none select-none' : ''}>
                  <PanelAccordion label="이미지 AI" value={pptMode ? '' : (IMAGE_MODELS.find(m => m.id === imageModelId)?.name ?? '')} closeOnSelect>
                    <div className="space-y-0.5">
                      {IMAGE_MODELS.map(m => (
                        <OptionItem key={m.id} active={imageModelId === m.id} onClick={() => setImageModelId(m.id)} sub={m.price}>
                          {m.name}
                        </OptionItem>
                      ))}
                    </div>
                  </PanelAccordion>
                </div>
                {pptMode && (
                  <div className="absolute inset-0 flex items-center justify-end pr-8 pointer-events-none">
                    <span className="text-[10px] font-mono text-white/30 bg-white/5 px-2 py-0.5 rounded border border-white/10 uppercase tracking-tighter">
                      PPT 모드 비활성화
                    </span>
                  </div>
                )}
              </div>

              <div className="relative">
                <div className={pptMode ? 'opacity-30 pointer-events-none select-none' : ''}>
                  <PanelAccordion label="영상 AI" value={pptMode ? '' : (VIDEO_MODELS.find(m => m.id === videoModelId)?.name ?? '')} closeOnSelect>
                    <div className="space-y-0.5">
                      {VIDEO_MODELS.map(m => (
                        <OptionItem key={m.id} active={videoModelId === m.id} onClick={() => setVideoModelId(m.id)} sub={m.price}>
                          {m.name}
                        </OptionItem>
                      ))}
                    </div>
                  </PanelAccordion>
                </div>
                {pptMode && (
                  <div className="absolute inset-0 flex items-center justify-end pr-8 pointer-events-none">
                    <span className="text-[10px] font-mono text-white/30 bg-white/5 px-2 py-0.5 rounded border border-white/10 uppercase tracking-tighter">
                      PPT 모드 비활성화
                    </span>
                  </div>
                )}
              </div>
            </>
          )}

          {/* 미리보기 단계 설정 */}
          {(status === 'previewing' && genTotal > 0 || status === 'preview' || status === 'rendering' || (status === 'error' && scenes.length > 0)) && (
            <>
              <PanelSection label="보이스">
                <div className="space-y-1">
                  {/* 음성 없음 */}
                  <button
                    onClick={() => setTtsProvider('none')}
                    className={`w-full flex items-center justify-between px-2 py-2 text-[13px] font-mono border-l-2 transition-colors ${
                      ttsProvider === 'none'
                        ? 'border-yellow-400 text-yellow-400 bg-yellow-400/5'
                        : 'border-transparent text-white/65 hover:text-white hover:border-white/30'
                    }`}
                  >
                    <span>음성 없음</span>
                    <span className="text-[11px] text-white/30 font-mono">자막만 표시</span>
                  </button>
                  {/* Google TTS */}
                  <PanelAccordion
                    label="Google TTS"
                    value={ttsProvider === 'google' ? (GOOGLE_VOICES.find(v => v.id === voiceId)?.name ?? '') : ''}
                    closeOnSelect
                  >
                    <div className="space-y-0.5">
                      {GOOGLE_VOICES.map(v => (
                        <button
                          key={v.id}
                          onClick={() => { setVoiceId(v.id); setTtsProvider('google'); }}
                          className={`w-full flex items-center justify-between px-2 py-1.5 text-[12px] font-mono border transition-colors ${
                            ttsProvider === 'google' && voiceId === v.id
                              ? 'border-yellow-400 text-yellow-400 bg-yellow-400/5'
                              : 'border-white/8 text-white/50 hover:border-white/20 hover:text-white/70'
                          }`}
                        >
                          <span>{v.name}</span>
                          <span className={`text-[11.5px] font-light ${ttsProvider === 'google' && voiceId === v.id ? 'text-yellow-400/60' : 'text-white/45'}`}>
                            {v.gender === 'female' ? '여성' : '남성'} · {v.desc}
                          </span>
                        </button>
                      ))}
                    </div>
                  </PanelAccordion>
                  {/* MiniMax TTS */}
                  <PanelAccordion
                    label="MiniMax TTS"
                    value={ttsProvider === 'minimax' ? (MINIMAX_VOICES.find(v => v.id === voiceId)?.name ?? '') : ''}
                    closeOnSelect
                  >
                    <div className="space-y-0.5">
                      {MINIMAX_VOICES.map(v => (
                        <button
                          key={v.id}
                          onClick={() => { setVoiceId(v.id); setTtsProvider('minimax'); }}
                          className={`w-full flex items-center justify-between px-2 py-1.5 text-[12px] font-mono border transition-colors ${
                            ttsProvider === 'minimax' && voiceId === v.id
                              ? 'border-yellow-400 text-yellow-400 bg-yellow-400/5'
                              : 'border-white/8 text-white/50 hover:border-white/20 hover:text-white/70'
                          }`}
                        >
                          <span>{v.name}</span>
                          <span className={`text-[11.5px] font-light ${ttsProvider === 'minimax' && voiceId === v.id ? 'text-yellow-400/60' : 'text-white/45'}`}>
                            {v.gender === 'female' ? '여성' : '남성'} · {v.desc}
                          </span>
                        </button>
                      ))}
                    </div>
                  </PanelAccordion>
                  {/* ElevenLabs */}
                  <PanelAccordion
                    label="ElevenLabs"
                    value={ttsProvider === 'elevenlabs' ? (ELEVENLABS_VOICES.find(v => v.id === voiceId)?.name ?? '') : ''}
                    closeOnSelect
                  >
                    <div className="space-y-0.5">
                      {ELEVENLABS_VOICES.map(v => (
                        <button
                          key={v.id}
                          onClick={() => { setVoiceId(v.id); setTtsProvider('elevenlabs'); }}
                          className={`w-full flex items-center justify-between px-2 py-1.5 text-[12px] font-mono border transition-colors ${
                            ttsProvider === 'elevenlabs' && voiceId === v.id
                              ? 'border-yellow-400 text-yellow-400 bg-yellow-400/5'
                              : 'border-white/8 text-white/50 hover:border-white/20 hover:text-white/70'
                          }`}
                        >
                          <span>{v.name}</span>
                          <span className={`text-[11.5px] font-light ${ttsProvider === 'elevenlabs' && voiceId === v.id ? 'text-yellow-400/60' : 'text-white/45'}`}>
                            {v.gender === 'female' ? '여성' : '남성'} · {v.desc}
                          </span>
                        </button>
                      ))}
                    </div>
                  </PanelAccordion>
                </div>
              </PanelSection>

              <PanelSection label="나레이션 속도">
                <div className="px-1">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-white/30 text-[13px] font-mono">속도</span>
                    <span className="text-yellow-400 text-[13px] font-mono">{playbackRate.toFixed(2)}x</span>
                  </div>
                  <input
                    type="range" min={0.5} max={2.0} step={0.05} value={playbackRate}
                    onChange={e => setPlaybackRate(parseFloat(e.target.value))}
                    className="w-full accent-yellow-400 h-0.5"
                  />
                  <div className="flex justify-between text-white/15 text-[12px] font-mono mt-2">
                    <span>0.5x</span><span>0.75x</span><span>1.0x</span><span>1.5x</span><span>2.0x</span>
                  </div>
                </div>
              </PanelSection>

              {/* 현재 설정 요약 */}
              <div className="mt-4 space-y-1.5">
                <p className="text-[#17BEBB]/70 text-[13px] tracking-widest uppercase mb-2">설정 요약</p>
                <div className="flex justify-between text-[13px] font-mono">
                  <span className="text-white/20">갤러리 레이아웃</span>
                  <span className="text-[#17BEBB]/80 truncate max-w-[120px]">{TEMPLATES.find(t => t.id === templateId)?.label}</span>
                </div>
                <div className="flex justify-between text-[13px] font-mono">
                  <span className="text-white/20">이미지 테마</span>
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
                  <span className="text-white/40">{ttsProvider === 'none' ? '없음' : selectedVoice?.name}</span>
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
                <span className="text-white/20">레이아웃</span>
                <span className="text-[#17BEBB]/80">{TEMPLATES.find(t => t.id === templateId)?.label}</span>
              </div>
              <div className="flex justify-between text-[13px] font-mono">
                <span className="text-white/20">이미지 테마</span>
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
