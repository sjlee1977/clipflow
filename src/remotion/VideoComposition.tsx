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

export const SlideDataSchema = z.object({
  layout: z.string(),
  title: z.string().optional(),
  bullets: z.array(z.string()).optional(),
});

export const SceneSchema = z.object({
  imageUrl: z.string(),
  videoUrl: z.string().optional(),
  gifUrl: z.string().optional(),
  audioUrl: z.string(),
  durationInFrames: z.number(),
  subtitles: z.array(SubtitleWordSchema),
  slideData: SlideDataSchema.optional(),
  pptTheme: z.string().optional(),
});

export const VideoSchema = z.object({
  scenes: z.array(SceneSchema),
  fps: z.number().default(30),
  fontFamily: z.string().optional(),
});

const PPT_EXTRA_FONTS = [
  'https://fonts.googleapis.com/css2?family=Black+Han+Sans&display=swap',
  'https://fonts.googleapis.com/css2?family=Nanum+Myeongjo:wght@700;800&display=swap',
];

export const VideoComposition: React.FC<VideoProps> = ({ scenes, fontFamily = DEFAULT_FONT_ID }) => {
  const [handle] = useState(() => delayRender(`Loading font: ${fontFamily}`));
  const hasPptSlides = scenes.some(s => s.slideData);
  const [pptHandle] = useState(() => delayRender('Loading PPT fonts'));

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

  useEffect(() => {
    if (!hasPptSlides) {
      continueRender(pptHandle);
      return;
    }
    const links: HTMLLinkElement[] = [];
    let loaded = 0;
    PPT_EXTRA_FONTS.forEach(href => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.onload = link.onerror = () => {
        loaded++;
        if (loaded === PPT_EXTRA_FONTS.length) continueRender(pptHandle);
      };
      document.head.appendChild(link);
      links.push(link);
    });
    return () => links.forEach(l => { if (document.head.contains(l)) document.head.removeChild(l); });
  }, [hasPptSlides, pptHandle]);

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
