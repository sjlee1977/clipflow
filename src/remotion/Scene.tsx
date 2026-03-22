import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
  interpolate,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { Scene as SceneType } from './types';
import { SubtitleOverlay } from './SubtitleOverlay';

type SceneProps = {
  scene: SceneType;
  globalOffset: number;
};

export const SceneComponent: React.FC<SceneProps> = ({ scene, globalOffset }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const duration = scene.durationInFrames;

  // Ken Burns effect: 시작 105% → 끝 115% zoom
  const scale = interpolate(frame, [0, duration], [1.05, 1.15], {
    easing: Easing.out(Easing.ease),
    extrapolateRight: 'clamp',
  });

  // 페이드 인 (첫 15프레임)
  const fadeIn = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // 페이드 아웃 (마지막 15프레임)
  const fadeOut = interpolate(frame, [duration - 15, duration], [1, 0], {
    extrapolateLeft: 'clamp',
  });

  const opacity = Math.min(fadeIn, fadeOut);

  return (
    <AbsoluteFill style={{ opacity }}>
      {/* 배경 이미지 (Ken Burns) */}
      <AbsoluteFill
        style={{
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
        }}
      >
        <Img
          src={scene.imageUrl}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      </AbsoluteFill>

      {/* 어두운 오버레이 (자막 가독성) */}
      <AbsoluteFill
        style={{
          background: 'linear-gradient(to bottom, transparent 50%, rgba(0,0,0,0.7) 100%)',
        }}
      />

      {/* 오디오 */}
      {scene.audioUrl && (
        <Audio src={scene.audioUrl} />
      )}

      {/* 자막 */}
      <SubtitleOverlay subtitles={scene.subtitles} />
    </AbsoluteFill>
  );
};
