import { AbsoluteFill, Sequence } from 'remotion';
import { z } from 'zod';
import { SceneComponent } from './Scene';
import { VideoProps } from './types';

export const SubtitleWordSchema = z.object({
  text: z.string(),
  startFrame: z.number(),
  endFrame: z.number(),
});

export const SceneSchema = z.object({
  imageUrl: z.string(),
  audioUrl: z.string(),
  durationInFrames: z.number(),
  subtitles: z.array(SubtitleWordSchema),
});

export const VideoSchema = z.object({
  scenes: z.array(SceneSchema),
  fps: z.number().default(30),
});

export const VideoComposition: React.FC<VideoProps> = ({ scenes }) => {
  let offset = 0;

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {scenes.map((scene, i) => {
        const start = offset;
        offset += scene.durationInFrames;

        return (
          <Sequence key={i} from={start} durationInFrames={scene.durationInFrames}>
            <SceneComponent scene={scene} globalOffset={start} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
