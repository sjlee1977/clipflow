export type SubtitleWord = {
  text: string;
  startFrame: number;
  endFrame: number;
};

export type SlideLayout = 'title' | 'bullets' | 'quote' | 'comparison' | 'bigword' | 'boxlist' | 'statcard' | 'timeline' | 'icongrid' | 'progress' | 'chatwindow' | 'dialogsplit' | 'equation' | 'stepflow' | 'calendar' | 'barchart' | 'usercloud' | 'motion_logic' | 'graphic_box' | 'clock' | 'linechart' | 'candlestick' | 'gauge' | 'portfolio';
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
  analogyData?: {
    pairs: Array<{
      leftIcon: string;
      leftLabel: string;
      rightLabel: string;
      rightSub?: string;
      connector?: string;  // 쌍 사이 구분 텍스트 (예: "마찬가지로")
    }>;
  };
  summary?: string;            // 하단 요약 배지 텍스트 (progress 등)
  headerBadge?: { icon?: string; text: string }; // 상단 헤더 배지 (boxlist 등)
  warningTag?: string;         // 하단 경고/알림 태그
  decorIcons?: string[];       // bigword 상단 장식 아이콘들
  processSteps?: Array<{ title: string; subtitle?: string; icon?: string }>; // stepflow 전용
  calendarData?: { totalDays: number; markedDays: number[] }; // calendar 전용
  variant?: string;            // 레이아웃 세부 변형 (좌우 반전, 스타일 등)
  align?: 'left' | 'center' | 'right'; // 텍스트/카드 정렬 방향
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
  lottieData?: Record<string, unknown>; // Lottie JSON 애니메이션 데이터
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
