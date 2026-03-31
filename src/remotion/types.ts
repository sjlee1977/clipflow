export type SubtitleWord = {
  text: string;
  startFrame: number;
  endFrame: number;
};

export type SlideLayout = 'title' | 'bullets' | 'quote';
export type PptTheme = 'simple-modern' | 'dark' | 'colorful';
export type SlideData = {
  layout: SlideLayout;
  title?: string;
  bullets?: string[];
};

export type Scene = {
  imageUrl: string;
  videoUrl?: string; // AI generated video
  gifUrl?: string;   // GIF overlay (위에 합성)
  audioUrl: string;
  durationInFrames: number;
  subtitles: SubtitleWord[];
  textAnimationStyle?: 'none' | 'typewriter' | 'fly-in' | 'pop-in' | 'fade-zoom' | 'clock-spin' | 'pulse-ring' | 'sparkle' | 'confetti' | 'rain' | 'snow' | 'fire' | 'heart' | 'stars' | 'thunder' | 'chart-up' | 'film-roll' | 'magnifier' | 'lock-secure' | 'camera-flash';
  textPosition?: 'bottom' | 'center' | 'top';
  slideData?: SlideData;
  pptTheme?: PptTheme;
};

export type VideoProps = {
  scenes: Scene[];
  fps: number;
  fontFamily?: string;
};
