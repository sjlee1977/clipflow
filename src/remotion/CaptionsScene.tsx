import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Img,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  Video,
} from 'remotion';
import { Scene as SceneType } from './types';

type CaptionsSceneProps = {
  scene: SceneType;
  fontFamily?: string;
};

export const CaptionsSceneComponent: React.FC<CaptionsSceneProps> = ({ scene, fontFamily }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill>
      {/* 배경 이미지/비디오 (Ken Burns Effect) */}
      <AbsoluteFill>
        {scene.videoUrl ? (
          <Video
            src={scene.videoUrl}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : scene.imageUrl ? (
          <Img
            src={scene.imageUrl}
            style={{ 
              width: '100%', 
              height: '100%', 
              objectFit: 'cover',
              transform: `scale(${interpolate(frame, [0, scene.durationInFrames], [1, 1.1])})`,
            }}
          />
        ) : (
          <AbsoluteFill style={{ backgroundColor: '#000' }} />
        )}
      </AbsoluteFill>

      {/* 오디오 재생 */}
      {scene.audioUrl && <Audio src={scene.audioUrl} />}

      {/* 하단 단어 단위 강조 자막 */}
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', bottom: '15%', height: 'fit-content' }}>
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          maxWidth: '80%',
          justifyContent: 'center'
        }}>
          {scene.subtitles.map((sub, i) => {
            const isActive = frame >= sub.startFrame && frame <= sub.endFrame;
            
            // 활성화될 때 톡 튀어나오는 효과
            const s = spring({
              frame: frame - sub.startFrame,
              fps,
              config: { stiffness: 200, damping: 10 },
            });

            return (
              <span
                key={i}
                style={{
                  fontSize: '48px',
                  fontWeight: 'bold',
                  fontFamily: fontFamily || 'sans-serif',
                  color: isActive ? '#17BEBB' : 'white',
                  textShadow: '0 0 20px rgba(0,0,0,1)',
                  transform: isActive ? `scale(${1 + s * 0.2})` : 'scale(1)',
                  opacity: isActive ? 1 : 0.4,
                  transition: 'opacity 0.2s ease',
                  backgroundColor: isActive ? 'rgba(0,0,0,0.6)' : 'transparent',
                  padding: '4px 12px',
                  borderRadius: '12px',
                }}
              >
                {sub.text}
              </span>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
