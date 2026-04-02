export type SubtitleWord = {
  text: string;
  startFrame: number;
  endFrame: number;
};

export type SlideLayout = 'title' | 'bullets' | 'quote' | 'comparison';
export type PptTheme = 'simple-modern' | 'dark' | 'colorful';
export type SlideData = {
  layout: SlideLayout;
  title?: string;
  bullets?: string[];
  comparisonData?: {
    leftTitle: string;
    rightTitle: string;
    leftItems: string[];
    rightItems: string[];
  };
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
};
