export type SubtitleWord = {
  text: string;
  startFrame: number;
  endFrame: number;
};

export type Scene = {
  imageUrl: string;
  videoUrl?: string; // AI generated video
  audioUrl: string;
  durationInFrames: number;
  subtitles: SubtitleWord[];
  textAnimationStyle?: 'none' | 'typewriter' | 'fly-in' | 'pop-in' | 'fade-zoom' | 'clock-spin' | 'pulse-ring' | 'sparkle' | 'confetti' | 'rain' | 'snow' | 'fire' | 'heart' | 'stars' | 'thunder' | 'chart-up' | 'film-roll' | 'magnifier' | 'lock-secure' | 'camera-flash';
  textPosition?: 'bottom' | 'center' | 'top';
};

export type VideoProps = {
  scenes: Scene[];
  fps: number;
  fontFamily?: string;
};
