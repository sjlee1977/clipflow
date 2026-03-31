import { AbsoluteFill, delayRender, continueRender } from 'remotion';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { z } from 'zod';
import { useState, useEffect } from 'react';
import { SceneComponent } from './Scene';
import { SlideSceneComponent } from './SlideScene';
import { VideoProps } from './types';
import { KOREAN_FONTS, DEFAULT_FONT_ID } from '../lib/fonts';

export const TRANSITION_FRAMES = 15;

export const SubtitleWordSchema = z.object({
  text: z.string(),
  startFrame: z.number(),
  endFrame: z.number(),
});

export const SceneSchema = z.object({
  imageUrl: z.string(),
  videoUrl: z.string().optional(),
  gifUrl: z.string().optional(),
  audioUrl: z.string(),
  durationInFrames: z.number(),
  subtitles: z.array(SubtitleWordSchema),
});

export const VideoSchema = z.object({
  scenes: z.array(SceneSchema),
  fps: z.number().default(30),
  fontFamily: z.string().optional(),
});

export const VideoComposition: React.FC<VideoProps> = ({ scenes, fontFamily = DEFAULT_FONT_ID }) => {
  const [handle] = useState(() => delayRender(`Loading font: ${fontFamily}`));

  useEffect(() => {
    const font = KOREAN_FONTS.find(f => f.id === fontFamily);
    if (!font) {
      continueRender(handle);
      return;
    }

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = font.cssUrl;
    link.onload = () => continueRender(handle);
    link.onerror = () => continueRender(handle);
    document.head.appendChild(link);

    return () => {
      document.head.removeChild(link);
    };
  }, [fontFamily, handle]);

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <TransitionSeries>
        {scenes.map((scene, i) => (
          <>
            {i > 0 && (
              <TransitionSeries.Transition
                presentation={fade()}
                timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
              />
            )}
            <TransitionSeries.Sequence key={i} durationInFrames={scene.durationInFrames}>
              {scene.slideData ? (
                <SlideSceneComponent scene={scene} slideIndex={i} fontFamily={fontFamily} />
              ) : (
                <SceneComponent scene={scene} globalOffset={0} fontFamily={fontFamily} />
              )}
            </TransitionSeries.Sequence>
          </>
        ))}
      </TransitionSeries>
    </AbsoluteFill>
  );
};
