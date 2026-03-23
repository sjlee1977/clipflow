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
};

export type VideoProps = {
  scenes: Scene[];
  fps: number;
};
