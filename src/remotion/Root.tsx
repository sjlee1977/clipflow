import React from 'react';
import { Composition } from 'remotion';
import { VideoComposition, VideoSchema, TRANSITION_FRAMES } from './VideoComposition';

export const RemotionRoot: React.FC = () => {
  return (
    <>

      {/* 유튜브 롱폼 (가로형 16:9) */}
      <Composition
        id="ClipFlowLandscape"
        component={VideoComposition}
        durationInFrames={18000}
        fps={30}
        width={1920}
        height={1080}
        schema={VideoSchema}
        defaultProps={{
          scenes: [],
          fps: 30,
        }}
      />

      {/* 템플릿 기반 컴포지션들: 가로(Landscape) 및 세로(Shorts) 버전 각각 생성 */}
      {['Classic', 'Audiogram', 'Captions', 'Cinematic', 'CodeHike', 'Split', 'Slides', 'Map', 'Kinetic', '3D'].flatMap(t => [
        { id: `ClipFlow${t}Landscape`, width: 1920, height: 1080, name: t },
        { id: `ClipFlow${t}`, width: 1080, height: 1920, name: t }
      ]).map(comp => (
        <Composition
          key={comp.id}
          id={comp.id}
          component={VideoComposition}
          durationInFrames={900}
          fps={30}
          width={comp.width}
          height={comp.height}
          schema={VideoSchema}
          defaultProps={{
            scenes: [],
            fps: 30,
            templateId: comp.name.toLowerCase()
          }}
          calculateMetadata={({ props }) => {
            const totalFrames = props.scenes.reduce((sum, s) => sum + s.durationInFrames, 0);
            return {
              durationInFrames: totalFrames > 0 ? totalFrames : 900,
            };
          }}
        />
      ))}
    </>
  );
};
