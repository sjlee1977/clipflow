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
import { Scene as SceneType } from './types';
import { SubtitleOverlay } from './SubtitleOverlay';

type CodeHikeSceneProps = {
  scene: SceneType;
  fontFamily?: string;
  codeSnippet?: string;
};

export const CodeHikeSceneComponent: React.FC<CodeHikeSceneProps> = ({ 
  scene, 
  fontFamily,
  codeSnippet = '// 코드를 입력하세요' 
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // 코드 하이킹 효과를 위한 간단한 가공 (나중에 @code-hike/mdx와 연동)
  return (
    <AbsoluteFill style={{ backgroundColor: '#0d1117' }}>
      {/* 배경 이미지 (블러 + 어둡게) */}
      {scene.videoUrl ? (
        <AbsoluteFill style={{ filter: 'blur(8px) brightness(0.25)', transform: 'scale(1.05)' }}>
          <Video src={scene.videoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </AbsoluteFill>
      ) : scene.imageUrl ? (
        <AbsoluteFill style={{ filter: 'blur(8px) brightness(0.25)', transform: 'scale(1.05)' }}>
          <Img src={scene.imageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </AbsoluteFill>
      ) : null}

      {/* 백그라운드 그리드 느낌 */}
      <AbsoluteFill style={{ opacity: 0.1, backgroundImage: 'radial-gradient(#30363d 1px, transparent 1px)', backgroundSize: '30px 30px' }} />

      {/* 메인 코드 에디터 화면 */}
      <AbsoluteFill style={{ padding: '60px', justifyContent: 'center' }}>
        <div style={{
          backgroundColor: '#161b22',
          borderRadius: '12px',
          border: '1px solid #30363d',
          boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          height: '80%',
          transform: `scale(${interpolate(frame, [0, 30], [0.95, 1], { extrapolateRight: 'clamp' })})`,
        }}>
          {/* 에디터 바 */}
          <div style={{ height: '40px', backgroundColor: '#21262d', display: 'flex', alignItems: 'center', padding: '0 16px', gap: '8px', borderBottom: '1px solid #30363d' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#ff5f56' }} />
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#ffbd2e' }} />
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#27c93f' }} />
            <span style={{ marginLeft: '12px', color: '#8b949e', fontSize: '12px', fontFamily: 'monospace' }}>clipflow_snippet.tsx</span>
          </div>

          {/* 코드 본문 (Syntax Highlight 적용 예정) */}
          <div style={{ padding: '24px', flex: 1, overflow: 'hidden' }}>
            <pre style={{
              margin: 0,
              fontSize: '22px',
              lineHeight: '1.6',
              color: '#d1d5db',
              fontFamily: 'monospace',
            }}>
              {codeSnippet.split('\n').map((line, i) => (
                <div key={i} style={{ display: 'flex', gap: '20px' }}>
                  <span style={{ color: '#484f58', width: '30px', textAlign: 'right' }}>{i + 1}</span>
                  <span>{line}</span>
                </div>
              ))}
            </pre>
          </div>
        </div>
      </AbsoluteFill>

      {/* 오디오 재생 */}
      {scene.audioUrl && <Audio src={scene.audioUrl} />}

      {/* 자막 오버레이 */}
      <SubtitleOverlay
        subtitles={scene.subtitles}
        style="pop-in"
        position="bottom"
        fontFamily={fontFamily}
      />
    </AbsoluteFill>
  );
};
