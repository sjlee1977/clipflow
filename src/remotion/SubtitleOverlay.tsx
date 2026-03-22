import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { SubtitleWord } from './types';

type Props = {
  subtitles: SubtitleWord[];
};

export const SubtitleOverlay: React.FC<Props> = ({ subtitles }) => {
  const frame = useCurrentFrame();

  const currentSubtitle = subtitles.find(
    (s) => frame >= s.startFrame && frame < s.endFrame
  );

  if (!currentSubtitle) return null;

  // 등장 애니메이션: 아래서 위로 슬라이드
  const progress = interpolate(
    frame,
    [currentSubtitle.startFrame, currentSubtitle.startFrame + 6],
    [0, 1],
    { extrapolateRight: 'clamp' }
  );

  const translateY = interpolate(progress, [0, 1], [20, 0]);
  const opacity = progress;

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingBottom: 80,
      }}
    >
      <div
        style={{
          opacity,
          transform: `translateY(${translateY}px)`,
          maxWidth: '85%',
          textAlign: 'center',
        }}
      >
        <span
          style={{
            fontSize: 48,
            fontWeight: 800,
            color: '#FFFFFF',
            textShadow: '0 2px 8px rgba(0,0,0,0.9), 0 0 20px rgba(0,0,0,0.8)',
            lineHeight: 1.3,
            display: 'inline-block',
            padding: '8px 20px',
            background: 'rgba(0,0,0,0.4)',
            borderRadius: 12,
          }}
        >
          {currentSubtitle.text}
        </span>
      </div>
    </AbsoluteFill>
  );
};
