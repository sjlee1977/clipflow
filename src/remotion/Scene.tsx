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
import { noise2D } from '@remotion/noise';
import { Gif } from '@remotion/gif';
import { Scene as SceneType } from './types';
import { SubtitleOverlay } from './SubtitleOverlay';

type SceneProps = {
  scene: SceneType;
  globalOffset: number;
  fontFamily?: string;
};

export const SceneComponent: React.FC<SceneProps> = ({ scene, globalOffset, fontFamily }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const duration = scene.durationInFrames;

  // 유니크한 시드 생성 (URL 해시 활용)
  const seed = scene.imageUrl.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const animType = seed % 4; // 0: Zoom In, 1: Zoom Out, 2: Pan Left, 3: Pan Right

  // Ken Burns effect: 기본 이동 값
  const baseScale = interpolate(
    frame,
    [0, duration],
    animType === 1 ? [1.2, 1.05] : [1.05, 1.2],
    { easing: Easing.out(Easing.ease), extrapolateRight: 'clamp' }
  );

  const baseTranslateX = interpolate(
    frame,
    [0, duration],
    animType === 2 ? [-5, 5] : animType === 3 ? [5, -5] : [0, 0],
    { easing: Easing.out(Easing.quad), extrapolateRight: 'clamp' }
  );

  const baseTranslateY = interpolate(
    frame,
    [0, duration],
    animType === 0 ? [-2, 2] : [0, 0],
    { easing: Easing.out(Easing.quad), extrapolateRight: 'clamp' }
  );

  // @remotion/noise: 자연스러운 미세 흔들림 추가
  const noiseX = noise2D('translateX', frame * 0.005, seed * 0.001) * 2;
  const noiseY = noise2D('translateY', frame * 0.005, seed * 0.001) * 1.5;

  const scale = baseScale;
  const translateX = baseTranslateX + noiseX;
  const translateY = baseTranslateY + noiseY;

  return (
    <AbsoluteFill>
      {/* 배경 이미지 또는 비디오 (Ken Burns + Noise) */}
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

      {/* GIF 오버레이 (@remotion/gif) */}
      {scene.gifUrl && (
        <AbsoluteFill style={{ zIndex: 5 }}>
          <Gif
            src={scene.gifUrl}
            fit="contain"
            style={{ width: '100%', height: '100%' }}
          />
        </AbsoluteFill>
      )}

      {/* 오디오 */}
      {scene.audioUrl && (
        <Audio src={scene.audioUrl} />
      )}

      {/* 자막 */}
      <SubtitleOverlay
        subtitles={scene.subtitles}
        style={scene.textAnimationStyle}
        position={scene.textPosition}
        fontFamily={fontFamily}
      />
    </AbsoluteFill>
  );
};
