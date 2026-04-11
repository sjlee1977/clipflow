import React, { useState, useEffect } from 'react';
import { AbsoluteFill, delayRender, continueRender } from 'remotion';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { z } from 'zod';
import { SceneComponent } from './Scene';
import { SlideSceneComponent } from './SlideScene';
import { KineticSceneComponent } from './KineticScene';
import { ThreeDSceneComponent } from './ThreeDScene';
import { AudiogramSceneComponent } from './AudiogramScene';
import { CaptionsSceneComponent } from './CaptionsScene';
import { CinematicSceneComponent } from './CinematicScene';
import { CodeHikeSceneComponent } from './CodeHikeScene';
import { LightLeakSceneComponent } from './LightLeakScene';
import { MatrixSceneComponent } from './MatrixScene';
import { ParticleSceneComponent } from './ParticleScene';
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
  stats: z.array(z.object({ value: z.string(), label: z.string() })).optional(),
  comparisonData: z.object({
    leftTitle: z.string(),
    rightTitle: z.string(),
    leftItems: z.array(z.string()),
    rightItems: z.array(z.string()),
  }).optional(),
  analogyData: z.object({
    pairs: z.array(z.object({
      leftIcon: z.string(),
      leftLabel: z.string(),
      rightLabel: z.string(),
      rightSub: z.string().optional(),
      connector: z.string().optional(),
    })),
  }).optional(),
  summary: z.string().optional(),
  headerBadge: z.object({ icon: z.string().optional(), text: z.string() }).optional(),
  warningTag: z.string().optional(),
  decorIcons: z.array(z.string()).optional(),
  processSteps: z.array(z.object({ title: z.string(), subtitle: z.string().optional(), icon: z.string().optional() })).optional(),
  calendarData: z.object({ totalDays: z.number(), markedDays: z.array(z.number()) }).optional(),
});

export const SceneSchema = z.object({
  imageUrl: z.string(),
  displayText: z.string().optional(),
  videoUrl: z.string().optional(),
  gifUrl: z.string().optional(),
  audioUrl: z.string(),
  durationInFrames: z.number(),
  subtitles: z.array(SubtitleWordSchema),
  textAnimationStyle: z.string().optional(),
  textPosition: z.enum(['bottom', 'center', 'top']).optional(),
  slideData: SlideDataSchema.optional(),
  pptTheme: z.string().optional(),
});

export const VideoSchema = z.object({
  scenes: z.array(SceneSchema),
  fps: z.number().default(30),
  fontFamily: z.string().optional(),
  templateId: z.string().optional(),
  codeSnippet: z.string().optional(),
});

const PPT_EXTRA_FONTS = [
  'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css',
  'https://fonts.googleapis.com/css2?family=Black+Han+Sans&display=swap',
  'https://fonts.googleapis.com/css2?family=Nanum+Myeongjo:wght@700;800&display=swap',
];

export const VideoComposition: React.FC<VideoProps> = ({ 
  scenes, 
  fontFamily = DEFAULT_FONT_ID, 
  templateId = 'classic',
  codeSnippet
}) => {
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
          <React.Fragment key={i}>
            {i > 0 && (
              <TransitionSeries.Transition
                presentation={fade()}
                timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
              />
            )}
            <TransitionSeries.Sequence durationInFrames={scene.durationInFrames}>
              {templateId === 'audiogram' ? (
                <AudiogramSceneComponent scene={scene} fontFamily={fontFamily} />
              ) : templateId === 'captions' ? (
                <CaptionsSceneComponent scene={scene} fontFamily={fontFamily} />
              ) : templateId === 'cinematic' ? (
                <CinematicSceneComponent scene={scene} fontFamily={fontFamily} />
              ) : templateId === 'codehike' ? (
                <CodeHikeSceneComponent scene={scene} fontFamily={fontFamily} codeSnippet={codeSnippet} />
              ) : templateId === 'kinetic' ? (
                <KineticSceneComponent scene={scene} sceneIndex={i} fontFamily={fontFamily} />
              ) : templateId === '3d' ? (
                <ThreeDSceneComponent scene={scene} sceneIndex={i} fontFamily={fontFamily} />
              ) : templateId === 'lightleak' ? (
                <LightLeakSceneComponent scene={scene} fontFamily={fontFamily} />
              ) : templateId === 'matrix' ? (
                <MatrixSceneComponent scene={scene} fontFamily={fontFamily} />
              ) : templateId === 'particle' ? (
                <ParticleSceneComponent scene={scene} fontFamily={fontFamily} />
              ) : scene.slideData ? (
                <SlideSceneComponent scene={scene} slideIndex={i} fontFamily={fontFamily} />
              ) : (
                <SceneComponent scene={scene} globalOffset={0} fontFamily={fontFamily} />
              )}
            </TransitionSeries.Sequence>
          </React.Fragment>
        ))}
      </TransitionSeries>
    </AbsoluteFill>
  );
};
