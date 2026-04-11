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
import { Scene as SceneType, SubtitleWord } from './types';

type CaptionsSceneProps = {
  scene: SceneType;
  fontFamily?: string;
};

// 단어들을 N개씩 묶어 라인 그룹으로 분할
function groupSubtitles(subtitles: SubtitleWord[], groupSize = 3): SubtitleWord[][] {
  const groups: SubtitleWord[][] = [];
  for (let i = 0; i < subtitles.length; i += groupSize) {
    groups.push(subtitles.slice(i, i + groupSize));
  }
  return groups;
}

export const CaptionsSceneComponent: React.FC<CaptionsSceneProps> = ({ scene, fontFamily }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const groups = groupSubtitles(scene.subtitles, 3);

  // 현재 프레임에 해당하는 그룹 찾기
  const currentGroupIndex = groups.findIndex((group) => {
    const first = group[0];
    const last = group[group.length - 1];
    return frame >= first.startFrame && frame <= last.endFrame;
  });

  const currentGroup = currentGroupIndex >= 0 ? groups[currentGroupIndex] : null;

  // 현재 그룹 내 활성 단어 인덱스
  const activeWordIndex = currentGroup
    ? currentGroup.findIndex((w) => frame >= w.startFrame && frame <= w.endFrame)
    : -1;

  // 그룹 전환 시 슬라이드업 + 페이드인
  const groupStartFrame = currentGroup ? currentGroup[0].startFrame : 0;
  const groupAge = frame - groupStartFrame;
  const groupFadeIn = interpolate(groupAge, [0, 8], [0, 1], { extrapolateRight: 'clamp' });
  const groupSlideUp = interpolate(groupAge, [0, 8], [24, 0], { extrapolateRight: 'clamp' });

  const fontFamilyStr = fontFamily
    ? `"${fontFamily}", "Noto Sans KR", "Apple SD Gothic Neo", sans-serif`
    : '"Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';

  return (
    <AbsoluteFill>
      {/* 배경 이미지/비디오 */}
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
              transform: `scale(${interpolate(frame, [0, scene.durationInFrames], [1, 1.08])})`,
            }}
          />
        ) : (
          <AbsoluteFill style={{ backgroundColor: '#000' }} />
        )}
      </AbsoluteFill>

      {scene.audioUrl && <Audio src={scene.audioUrl} />}

      {/* 하단 자막 - 틱톡/캡컷 스타일 */}
      {currentGroup && (
        <div
          style={{
            position: 'absolute',
            bottom: 110,
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            opacity: groupFadeIn,
            transform: `translateY(${groupSlideUp}px)`,
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '10px 14px',
              justifyContent: 'center',
              alignItems: 'center',
              maxWidth: '88%',
              padding: '14px 24px',
              backgroundColor: 'rgba(0,0,0,0.52)',
              borderRadius: 18,
            }}
          >
            {currentGroup.map((word, i) => {
              const isActive = i === activeWordIndex;
              const isPast = activeWordIndex >= 0 && i < activeWordIndex;

              const wordSpr = isActive
                ? spring({
                    frame: frame - word.startFrame,
                    fps,
                    config: { stiffness: 400, damping: 18 },
                  })
                : 0;

              return (
                <span
                  key={i}
                  style={{
                    fontSize: 54,
                    fontWeight: 900,
                    fontFamily: fontFamilyStr,
                    color: isActive
                      ? '#FFE600'
                      : isPast
                      ? 'rgba(255,255,255,0.42)'
                      : 'rgba(255,255,255,0.88)',
                    textShadow: isActive
                      ? '0 0 28px rgba(255,230,0,0.55), 0 2px 10px rgba(0,0,0,0.95)'
                      : '0 2px 10px rgba(0,0,0,0.85)',
                    transform: `scale(${isActive ? 1 + wordSpr * 0.1 : 1})`,
                    display: 'inline-block',
                    lineHeight: 1.25,
                    letterSpacing: '-0.01em',
                    transition: 'color 0.08s ease',
                  }}
                >
                  {word.text}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
