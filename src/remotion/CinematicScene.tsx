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
import { Scene as SceneType } from './types';
import { SubtitleOverlay } from './SubtitleOverlay';

type CinematicSceneProps = {
  scene: SceneType;
  fontFamily?: string;
};

export const CinematicSceneComponent: React.FC<CinematicSceneProps> = ({ scene, fontFamily }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const duration = scene.durationInFrames;

  // Cinematic Ken Burns: 고급스러운 스케일 및 이동 애니메이션
  const scale = interpolate(
    frame,
    [0, duration],
    [1, 1.25], // 더 깊은 줌
    { easing: Easing.bezier(0.33, 1, 0.68, 1), extrapolateRight: 'clamp' }
  );

  const translateY = interpolate(
    frame,
    [0, duration],
    [0, -5], // 약간 위로 이동하여 시선 유도
    { easing: Easing.out(Easing.quad), extrapolateRight: 'clamp' }
  );

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {/* 배경 레이어 (Motion) */}
      <AbsoluteFill
        style={{
          transform: `scale(${scale}) translateY(${translateY}%)`,
          transformOrigin: 'center center',
        }}
      >
        {scene.videoUrl ? (
          <Video
            src={scene.videoUrl}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : scene.imageUrl ? (
          <Img
            src={scene.imageUrl}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <AbsoluteFill style={{ backgroundColor: '#111' }} />
        )}
      </AbsoluteFill>

      {/* 비네트 효과 (Vignette) */}
      <AbsoluteFill
        style={{
          background: 'radial-gradient(circle, transparent 20%, rgba(0,0,0,0.4) 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* 오디오 재생 */}
      {scene.audioUrl && <Audio src={scene.audioUrl} />}

      {/* 시네마틱 하단 자막 */}
      <SubtitleOverlay
        subtitles={scene.subtitles}
        style="fade-zoom"
        position="bottom"
        fontFamily={fontFamily}
      />

      {/* 상/하단 시네마틱 블랙 바 (선택적: 16:9 랜드스케이프 시 강조) */}
      {width > height && (
        <>
          <div style={{ position: 'absolute', top: 0, width: '100%', height: '10%', backgroundColor: 'black' }} />
          <div style={{ position: 'absolute', bottom: 0, width: '100%', height: '10%', backgroundColor: 'black' }} />
        </>
      )}
    </AbsoluteFill>
  );
};
