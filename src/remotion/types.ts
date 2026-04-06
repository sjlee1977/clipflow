export type SubtitleWord = {
  text: string;
  startFrame: number;
  endFrame: number;
};

export type SlideLayout = 'title' | 'bullets' | 'quote' | 'comparison' | 'bigword' | 'boxlist' | 'statcard' | 'timeline' | 'icongrid' | 'progress' | 'chatwindow' | 'dialogsplit';
export type BulletStyle = 'dot' | 'typewriter' | 'multicolor' | 'cascade';
export type PptTheme = 'simple-modern' | 'dark' | 'colorful';
export type SlideData = {
  layout: SlideLayout;
  bulletStyle?: BulletStyle;
  title?: string;
  bullets?: string[];
  stats?: { value: string; label: string }[];
  comparisonData?: {
    leftTitle: string;
    rightTitle: string;
    leftItems: string[];
    rightItems: string[];
  };
  summary?: string;            // 하단 요약 배지 텍스트 (progress 등)
  headerBadge?: { icon?: string; text: string }; // 상단 헤더 배지 (boxlist 등)
  warningTag?: string;         // 하단 경고/알림 태그
};

export type Scene = {
  imageUrl: string;
  videoUrl?: string; // AI generated video
  gifUrl?: string;   // GIF overlay (위에 합성)
  audioUrl: string;
  durationInFrames: number;
  subtitles: SubtitleWord[];
  textAnimationStyle?: 'none' | 'typewriter' | 'fly-in' | 'pop-in' | 'fade-zoom' | 'clock-spin' | 'pulse-ring' | 'sparkle' | 'confetti' | 'rain' | 'snow' | 'fire' | 'heart' | 'stars' | 'thunder' | 'chart-up' | 'film-roll' | 'magnifier' | 'lock-secure' | 'camera-flash' | 'stagger-words' | 'kinetic-bounce' | 'focus-highlight';
  textPosition?: 'bottom' | 'center' | 'top';
  displayText?: string; // 키네틱 모드: 화면 중앙에 크게 표시할 핵심 포인트 (나레이션 전체와 별개)
  slideData?: SlideData;
  pptTheme?: PptTheme;
};

export type VideoProps = {
  scenes: Scene[];
  fps: number;
  fontFamily?: string;
  templateId?: string;
  codeSnippet?: string;
};
