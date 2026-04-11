import React from 'react';
import { AbsoluteFill, Audio, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { MatrixRain } from 'remotion-bits';
import { Scene as SceneType } from './types';
import { SubtitleOverlay } from './SubtitleOverlay';

type MatrixSceneProps = {
  scene: SceneType;
  fontFamily?: string;
};

export const MatrixSceneComponent: React.FC<MatrixSceneProps> = ({ scene, fontFamily }) => {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();
  const duration = scene.durationInFrames;

  const titleOpacity = interpolate(frame, [0, 12, duration - 12, duration], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const isWide = width > 800;

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {/* 매트릭스 레인 배경 */}
      <AbsoluteFill>
        <MatrixRain
          fontSize={isWide ? 16 : 12}
          color="#00ff41"
          speed={1.2}
          density={0.7}
          streamLength={20}
        />
      </AbsoluteFill>

      {/* 어두운 오버레이 — 가독성 확보 */}
      <AbsoluteFill style={{ background: 'rgba(0,0,0,0.55)', pointerEvents: 'none' }} />

      {/* 씬 제목 (displayText) */}
      {scene.displayText && (
        <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <div style={{
            opacity: titleOpacity,
            color: '#00ff41',
            fontFamily: "'Courier New', monospace",
            fontSize: isWide ? 42 : 28,
            fontWeight: 900,
            textAlign: 'center',
            textShadow: '0 0 20px rgba(0,255,65,0.8), 0 0 40px rgba(0,255,65,0.4)',
            padding: '0 40px',
            letterSpacing: '0.05em',
          }}>
            {scene.displayText}
          </div>
        </AbsoluteFill>
      )}

      {/* 오디오 */}
      {scene.audioUrl && <Audio src={scene.audioUrl} />}

      {/* 자막 */}
      <SubtitleOverlay subtitles={scene.subtitles} style="fly-in" position="bottom" fontFamily={fontFamily} />
    </AbsoluteFill>
  );
};
