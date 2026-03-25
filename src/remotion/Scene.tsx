import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
  interpolate,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  Video,
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

  // 유니크한 시드 생성 (URL 해시 활용)
  const seed = scene.imageUrl.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const animType = seed % 4; // 0: Zoom In, 1: Zoom Out, 2: Pan Left, 3: Pan Right

  // Ken Burns effect: 다양화
  const scale = interpolate(
    frame,
    [0, duration],
    animType === 1 ? [1.2, 1.05] : [1.05, 1.2], // Zoom In (default) or Zoom Out
    { easing: Easing.out(Easing.ease), extrapolateRight: 'clamp' }
  );

  const translateX = interpolate(
    frame,
    [0, duration],
    animType === 2 ? [-5, 5] : animType === 3 ? [5, -5] : [0, 0], // Pan Left or Right
    { easing: Easing.out(Easing.quad), extrapolateRight: 'clamp' }
  );

  const translateY = interpolate(
    frame,
    [0, duration],
    animType === 0 ? [-2, 2] : [0, 0], // Zoom In 시 약간의 수직 이동 추가
    { easing: Easing.out(Easing.quad), extrapolateRight: 'clamp' }
  );

  // 페이드 인/아웃
  const fadeIn = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
  const fadeOut = interpolate(frame, [duration - 15, duration], [1, 0], { extrapolateLeft: 'clamp' });
  const opacity = Math.min(fadeIn, fadeOut);

  return (
    <AbsoluteFill style={{ opacity }}>
      {/* 배경 이미지 또는 비디오 (Ken Burns) */}
      <AbsoluteFill
        style={{
          transform: `scale(${scale}) translateX(${translateX}%) translateY(${translateY}%)`,
          transformOrigin: 'center center',
        }}
      >
        {scene.videoUrl ? (
          <Video
            src={scene.videoUrl}
            loop
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        ) : (
          <Img
            src={scene.imageUrl}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        )}
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
