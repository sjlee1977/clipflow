import React from 'react';
import {
  AbsoluteFill, Audio, Img,
  interpolate, spring, Easing,
  useCurrentFrame, useVideoConfig, Video,
} from 'remotion';
import { Scene as SceneType } from './types';
import { SubtitleOverlay } from './SubtitleOverlay';

type Props = {
  scene: SceneType;
  sceneIndex: number;
  fontFamily?: string;
};

// 씬별 3D 연출 변형 (회전 방향 / 줌 방향 다양하게)
const VARIANTS = [
  { rotX: 12, rotY:  0, zoomFrom: 1.15, zoomTo: 1.0,  panX:  0, panY: -3 },
  { rotX:  0, rotY: 10, zoomFrom: 1.0,  zoomTo: 1.12, panX:  4, panY:  0 },
  { rotX: -8, rotY:  0, zoomFrom: 1.1,  zoomTo: 1.02, panX:  0, panY:  4 },
  { rotX:  0, rotY:-10, zoomFrom: 1.02, zoomTo: 1.1,  panX: -4, panY:  0 },
  { rotX:  6, rotY:  6, zoomFrom: 1.12, zoomTo: 1.0,  panX:  3, panY: -2 },
];

function variant(i: number) {
  return VARIANTS[i % VARIANTS.length];
}

export const ThreeDSceneComponent: React.FC<Props> = ({ scene, sceneIndex, fontFamily = 'Noto Sans KR' }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const v = variant(sceneIndex);

  // 씬 시작 시 3D 틸트 → 정면으로 복귀 (0.8초)
  const tiltDuration = Math.min(fps * 0.8, durationInFrames * 0.4);
  const tiltSpr = spring({ frame, fps, config: { damping: 22, stiffness: 55 } });
  const rotX = interpolate(tiltSpr, [0, 1], [v.rotX, 0]);
  const rotY = interpolate(tiltSpr, [0, 1], [v.rotY, 0]);

  // 배경 이미지 Zoom + Pan
  const scale = interpolate(frame, [0, durationInFrames], [v.zoomFrom, v.zoomTo], {
    easing: Easing.inOut(Easing.quad), extrapolateRight: 'clamp',
  });
  const panX = interpolate(frame, [0, durationInFrames], [0, v.panX], {
    easing: Easing.inOut(Easing.quad), extrapolateRight: 'clamp',
  });
  const panY = interpolate(frame, [0, durationInFrames], [0, v.panY], {
    easing: Easing.inOut(Easing.quad), extrapolateRight: 'clamp',
  });

  // 전경 깊이 레이어 (배경보다 느리게 이동 → 패럴랙스 효과)
  const fgPanX = panX * 0.35;
  const fgPanY = panY * 0.35;

  // 씬 전환 플래시 (시작 1프레임)
  const flashOp = interpolate(frame, [0, 1, 6], [0.25, 0.25, 0], { extrapolateRight: 'clamp' });

  // 상단 비네트 (공간감 강조)
  const vignetteIn = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });

  const fontFamilyStr = `"${fontFamily}", "Noto Sans KR", sans-serif`;

  return (
    <AbsoluteFill style={{ backgroundColor: '#000', overflow: 'hidden' }}>
      {/* ── 배경 이미지/비디오 — 3D 틸트 + Zoom/Pan ── */}
      <AbsoluteFill
        style={{
          perspective: 900,
          perspectiveOrigin: '50% 50%',
        }}
      >
        <AbsoluteFill
          style={{
            transform: `
              perspective(900px)
              rotateX(${rotX}deg)
              rotateY(${rotY}deg)
              scale(${scale})
              translate(${panX}%, ${panY}%)
            `,
            transformOrigin: 'center center',
            // 틸트 중 가장자리 공백 방지
            willChange: 'transform',
          }}
        >
          {scene.videoUrl ? (
            <Video src={scene.videoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : scene.imageUrl ? (
            <Img src={scene.imageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <AbsoluteFill style={{ background: 'linear-gradient(145deg, #0a0a1a, #1a0a2a)' }} />
          )}
        </AbsoluteFill>
      </AbsoluteFill>

      {/* ── 깊이감 오버레이 (가장자리 어둠, 중앙 부각) ── */}
      <AbsoluteFill
        style={{
          opacity: vignetteIn * 0.75,
          background: `
            radial-gradient(ellipse 70% 65% at 50% 50%,
              transparent 30%,
              rgba(0,0,0,0.35) 60%,
              rgba(0,0,0,0.72) 100%)
          `,
          pointerEvents: 'none',
        }}
      />

      {/* ── 하단 그라데이션 (자막 가독성) ── */}
      <AbsoluteFill
        style={{
          background: 'linear-gradient(to bottom, transparent 45%, rgba(0,0,0,0.75) 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* ── 패럴랙스 전경 레이어: 미세한 깊이 강조 장식 ── */}
      <AbsoluteFill
        style={{
          transform: `translate(${fgPanX}%, ${fgPanY}%)`,
          pointerEvents: 'none',
          opacity: 0.18,
        }}
      >
        {/* 좌상단 + 우하단 코너 프레임 */}
        <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
          {/* 좌상 코너 */}
          <polyline points="40,80 40,40 80,40" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" />
          {/* 우상 코너 */}
          <polyline points="calc(100% - 40),80 calc(100% - 40),40 calc(100% - 80),40" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" />
          {/* 좌하 코너 */}
          <polyline points="40,calc(100% - 80) 40,calc(100% - 40) 80,calc(100% - 40)" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" />
          {/* 우하 코너 */}
          <polyline points="calc(100% - 40),calc(100% - 80) calc(100% - 40),calc(100% - 40) calc(100% - 80),calc(100% - 40)" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </AbsoluteFill>

      {/* ── 씬 시작 플래시 ── */}
      {flashOp > 0 && (
        <AbsoluteFill style={{ backgroundColor: `rgba(255,255,255,${flashOp})`, pointerEvents: 'none' }} />
      )}

      {/* ── 오디오 ── */}
      {scene.audioUrl && <Audio src={scene.audioUrl} />}

      {/* ── 자막: 깊이감 있는 텍스트 ── */}
      <SubtitleOverlay
        subtitles={scene.subtitles}
        style={scene.textAnimationStyle ?? 'fly-in'}
        position={scene.textPosition ?? 'bottom'}
        fontFamily={fontFamily}
      />
    </AbsoluteFill>
  );
};
