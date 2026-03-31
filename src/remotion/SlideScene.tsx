import React from 'react';
import { AbsoluteFill, Audio, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { Scene as SceneType } from './types';

type SlideSceneProps = {
  scene: SceneType;
  slideIndex: number;
  fontFamily?: string;
};

const COLORFUL_GRADIENTS = [
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
  'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
  'linear-gradient(135deg, #ff9a9e 0%, #fad0c4 100%)',
];

function getThemeStyle(theme: string | undefined, slideIndex: number) {
  switch (theme) {
    case 'simple-modern':
      return {
        background: '#ffffff',
        titleColor: '#1a1a1a',
        bodyColor: '#333333',
        accentColor: '#2563eb',
        bulletColor: '#2563eb',
        quoteMarkColor: '#2563eb',
        subtitleColor: '#555555',
      };
    case 'colorful':
      return {
        background: COLORFUL_GRADIENTS[slideIndex % COLORFUL_GRADIENTS.length],
        titleColor: '#ffffff',
        bodyColor: '#ffffff',
        accentColor: '#ffffff',
        bulletColor: '#ffffff',
        quoteMarkColor: 'rgba(255,255,255,0.4)',
        subtitleColor: 'rgba(255,255,255,0.85)',
      };
    case 'dark':
    default:
      return {
        background: '#0d0d0d',
        titleColor: '#ffffff',
        bodyColor: '#e5e5e5',
        accentColor: '#f97316',
        bulletColor: '#f97316',
        quoteMarkColor: 'rgba(249,115,22,0.3)',
        subtitleColor: 'rgba(255,255,255,0.7)',
      };
  }
}

export const SlideSceneComponent: React.FC<SlideSceneProps> = ({ scene, slideIndex, fontFamily }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const theme = scene.pptTheme ?? 'dark';
  const slideData = scene.slideData;
  const layout = slideData?.layout ?? 'title';
  const styles = getThemeStyle(theme, slideIndex);

  const titleSpring = spring({ frame, fps, config: { damping: 18, stiffness: 120 }, durationInFrames: 30 });
  const subtitleSpring = spring({ frame: Math.max(0, frame - 8), fps, config: { damping: 18, stiffness: 100 }, durationInFrames: 30 });

  const containerStyle: React.CSSProperties = {
    fontFamily: fontFamily ?? 'sans-serif',
    background: styles.background,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
    position: 'relative',
    overflow: 'hidden',
  };

  // title 레이아웃
  if (layout === 'title') {
    return (
      <AbsoluteFill style={containerStyle}>
        {scene.audioUrl && <Audio src={scene.audioUrl} />}
        <div style={{ textAlign: 'center', padding: '0 80px', width: '100%' }}>
          <div
            style={{
              fontSize: 72,
              fontWeight: 900,
              color: styles.titleColor,
              lineHeight: 1.15,
              letterSpacing: '-0.02em',
              opacity: titleSpring,
              transform: `translateY(${(1 - titleSpring) * 40}px)`,
            }}
          >
            {slideData?.title || ''}
          </div>
          {theme === 'simple-modern' && (
            <div
              style={{
                width: 80,
                height: 5,
                background: styles.accentColor,
                margin: '32px auto 0',
                opacity: subtitleSpring,
                transform: `scaleX(${subtitleSpring})`,
                transformOrigin: 'center',
              }}
            />
          )}
          {theme === 'dark' && (
            <div
              style={{
                width: 80,
                height: 3,
                background: styles.accentColor,
                margin: '28px auto 0',
                opacity: subtitleSpring,
              }}
            />
          )}
        </div>
      </AbsoluteFill>
    );
  }

  // bullets 레이아웃
  if (layout === 'bullets') {
    const bullets = slideData?.bullets ?? [];
    return (
      <AbsoluteFill style={containerStyle}>
        {scene.audioUrl && <Audio src={scene.audioUrl} />}
        <div style={{ padding: '60px 80px', width: '100%' }}>
          {/* 제목 */}
          <div
            style={{
              fontSize: 48,
              fontWeight: 800,
              color: styles.titleColor,
              marginBottom: 12,
              opacity: titleSpring,
              transform: `translateY(${(1 - titleSpring) * 30}px)`,
            }}
          >
            {slideData?.title || ''}
          </div>
          {/* 구분선 */}
          <div
            style={{
              width: 60,
              height: 4,
              background: styles.accentColor,
              marginBottom: 40,
              opacity: subtitleSpring,
            }}
          />
          {/* 불릿 포인트들 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {bullets.map((bullet, bi) => {
              const bulletSpring = spring({
                frame: Math.max(0, frame - 12 - bi * 6),
                fps,
                config: { damping: 16, stiffness: 100 },
                durationInFrames: 25,
              });
              return (
                <div
                  key={bi}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 20,
                    opacity: bulletSpring,
                    transform: `translateX(${(1 - bulletSpring) * 40}px)`,
                  }}
                >
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: styles.bulletColor,
                      flexShrink: 0,
                      marginTop: 10,
                    }}
                  />
                  <div
                    style={{
                      fontSize: 34,
                      fontWeight: 600,
                      color: styles.bodyColor,
                      lineHeight: 1.4,
                    }}
                  >
                    {bullet}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </AbsoluteFill>
    );
  }

  // quote 레이아웃
  if (layout === 'quote') {
    return (
      <AbsoluteFill style={containerStyle}>
        {scene.audioUrl && <Audio src={scene.audioUrl} />}
        <div style={{ textAlign: 'center', padding: '60px 100px', width: '100%' }}>
          {/* 인용부호 */}
          <div
            style={{
              fontSize: 160,
              lineHeight: 0.8,
              color: styles.quoteMarkColor,
              fontFamily: 'Georgia, serif',
              marginBottom: 20,
              opacity: spring({ frame, fps, config: { damping: 20, stiffness: 80 }, durationInFrames: 20 }),
            }}
          >
            "
          </div>
          {/* 인용 텍스트 */}
          <div
            style={{
              fontSize: 42,
              fontWeight: 700,
              color: styles.titleColor,
              lineHeight: 1.5,
              opacity: titleSpring,
              transform: `scale(${0.92 + titleSpring * 0.08})`,
            }}
          >
            {slideData?.title || ''}
          </div>
        </div>
      </AbsoluteFill>
    );
  }

  // fallback
  return (
    <AbsoluteFill style={containerStyle}>
      {scene.audioUrl && <Audio src={scene.audioUrl} />}
    </AbsoluteFill>
  );
};
