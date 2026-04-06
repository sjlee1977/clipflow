import {
  AbsoluteFill,
  Audio,
  Img,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
  Video,
} from 'remotion';
import { useAudioData, visualizeAudioWaveform } from '@remotion/media-utils';
import { Scene as SceneType } from './types';
import { SubtitleOverlay } from './SubtitleOverlay';

type AudiogramSceneProps = {
  scene: SceneType;
  fontFamily?: string;
};

export const AudiogramSceneComponent: React.FC<AudiogramSceneProps> = ({ scene, fontFamily }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  
  // 오디오 데이터 분석
  const audioData = useAudioData(scene.audioUrl);
  
  if (!audioData) {
    return <AbsoluteFill style={{ backgroundColor: '#000' }} />;
  }

  // 파형 시각화 설정
  const visualization = visualizeAudioWaveform({
    audioData,
    fps,
    numberOfSamples: 64, // 바 개수
    frame,
    windowInSeconds: 0.1,
  });

  // 배경 이미지/비디오 가공 (약간 어둡고 블러 처리)
  return (
    <AbsoluteFill>
      <AbsoluteFill>
        {scene.videoUrl ? (
          <Video
            src={scene.videoUrl}
            style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.4) blur(4px)' }}
          />
        ) : scene.imageUrl ? (
          <Img
            src={scene.imageUrl}
            style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.4) blur(4px)' }}
          />
        ) : (
          <AbsoluteFill style={{ backgroundColor: '#0d0d0d' }} />
        )}
      </AbsoluteFill>

      {/* 중앙 파형 애니메이션 */}
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '4px', height: '120px', alignItems: 'center' }}>
          {visualization.map((v, i) => {
            const barHeight = interpolate(v, [0, 1], [10, 100]);
            return (
              <div
                key={i}
                style={{
                  width: '6px',
                  height: `${barHeight}%`,
                  backgroundColor: '#17BEBB',
                  borderRadius: '10px',
                  boxShadow: '0 0 15px rgba(23,190,187,0.5)',
                  opacity: interpolate(v, [0, 0.5], [0.3, 1]),
                }}
              />
            );
          })}
        </div>
      </AbsoluteFill>

      {/* 오디오 재생 */}
      {scene.audioUrl && <Audio src={scene.audioUrl} />}

      {/* 자막 오버레이 (상단 또는 하단) */}
      <SubtitleOverlay
        subtitles={scene.subtitles}
        style="fade-zoom"
        position="bottom"
        fontFamily={fontFamily}
      />

      {/* 상단 텍스트 가독성을 위한 오버레이 */}
      <AbsoluteFill
        style={{
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, transparent 40%, transparent 60%, rgba(0,0,0,0.5) 100%)',
          pointerEvents: 'none',
        }}
      />
    </AbsoluteFill>
  );
};
