import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Img,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
  Video,
} from 'remotion';
import { Particles, Spawner, Behavior } from 'remotion-bits';
import { Scene as SceneType } from './types';
import { SubtitleOverlay } from './SubtitleOverlay';

type ParticleSceneProps = {
  scene: SceneType;
  fontFamily?: string;
};

const GlowOrb: React.FC<{ color?: string; size?: number }> = ({ color = '#ffffff', size = 6 }) => (
  <div style={{
    width: size,
    height: size,
    borderRadius: '50%',
    backgroundColor: color,
    boxShadow: `0 0 ${size * 2}px ${size}px ${color}60`,
  }} />
);

export const ParticleSceneComponent: React.FC<ParticleSceneProps> = ({ scene, fontFamily }) => {
  const frame = useCurrentFrame();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { width, height } = useVideoConfig();

  const bgOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {/* 배경 이미지 (흐리게) */}
      {(scene.imageUrl || scene.videoUrl) && (
        <AbsoluteFill style={{ opacity: bgOpacity }}>
          {scene.videoUrl ? (
            <Video
              src={scene.videoUrl}
              style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(6px) brightness(0.35)' }}
            />
          ) : (
            <Img
              src={scene.imageUrl!}
              style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(6px) brightness(0.35)', transform: 'scale(1.05)' }}
            />
          )}
        </AbsoluteFill>
      )}

      {/* 파티클 시스템 */}
      <AbsoluteFill style={{ pointerEvents: 'none' }}>
        <Particles startFrame={0}>
          <Behavior
            gravity={{ y: -0.3 }}
            drag={0.98}
            opacity={[1, 0]}
          />
          {/* 흰 파티클 — 화면 하단에서 위로 */}
          <Spawner
            rate={3}
            max={60}
            position={{ x: 0.5, y: 1.0 }}
            area={{ width: 0.8, height: 0.1 }}
            velocity={{ x: 0, y: -1.5, varianceX: 0.5, varianceY: 0.5 }}
            lifespan={60}
          >
            <GlowOrb color="#ffffff" size={5} />
          </Spawner>
          {/* 골드 파티클 */}
          <Spawner
            rate={1.5}
            max={30}
            position={{ x: 0.5, y: 0.95 }}
            area={{ width: 0.6, height: 0.1 }}
            velocity={{ x: 0, y: -1.2, varianceX: 0.3, varianceY: 0.3 }}
            lifespan={80}
          >
            <GlowOrb color="#ffd700" size={4} />
          </Spawner>
        </Particles>
      </AbsoluteFill>

      {/* 하단 그라데이션 */}
      <AbsoluteFill style={{
        background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 50%)',
        pointerEvents: 'none',
      }} />

      {/* 오디오 */}
      {scene.audioUrl && <Audio src={scene.audioUrl} />}

      {/* 자막 */}
      <SubtitleOverlay subtitles={scene.subtitles} style="fade-zoom" position="bottom" fontFamily={fontFamily} />
    </AbsoluteFill>
  );
};
