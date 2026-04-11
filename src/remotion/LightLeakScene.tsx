import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
  Video,
} from 'remotion';
import { LightLeak } from '@remotion/light-leaks';
import { Scene as SceneType } from './types';
import { SubtitleOverlay } from './SubtitleOverlay';

type LightLeakSceneProps = {
  scene: SceneType;
  fontFamily?: string;
};

export const LightLeakSceneComponent: React.FC<LightLeakSceneProps> = ({ scene, fontFamily }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const duration = scene.durationInFrames;

  const scale = interpolate(frame, [0, duration], [1.05, 1.2], {
    easing: Easing.bezier(0.33, 1, 0.68, 1),
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {/* 배경 이미지/비디오 */}
      <AbsoluteFill style={{ transform: `scale(${scale})`, transformOrigin: 'center center' }}>
        {scene.videoUrl ? (
          <Video src={scene.videoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : scene.imageUrl ? (
          <Img src={scene.imageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <AbsoluteFill style={{ backgroundColor: '#1a0a00' }} />
        )}
      </AbsoluteFill>

      {/* 다크 오버레이 */}
      <AbsoluteFill style={{ background: 'rgba(0,0,0,0.25)', pointerEvents: 'none' }} />

      {/* 빛번짐 효과 */}
      <LightLeak seed={scene.imageUrl ? scene.imageUrl.charCodeAt(0) % 100 : 42} hueShift={20} />

      {/* 비네트 */}
      <AbsoluteFill style={{
        background: 'radial-gradient(circle, transparent 30%, rgba(0,0,0,0.55) 100%)',
        pointerEvents: 'none',
      }} />

      {/* 오디오 */}
      {scene.audioUrl && <Audio src={scene.audioUrl} />}

      {/* 자막 */}
      <SubtitleOverlay subtitles={scene.subtitles} style="fade-zoom" position="bottom" fontFamily={fontFamily} />

      {/* 시네마틱 블랙 바 */}
      {width > height && (
        <>
          <div style={{ position: 'absolute', top: 0, width: '100%', height: '10%', backgroundColor: 'black' }} />
          <div style={{ position: 'absolute', bottom: 0, width: '100%', height: '10%', backgroundColor: 'black' }} />
        </>
      )}
    </AbsoluteFill>
  );
};
