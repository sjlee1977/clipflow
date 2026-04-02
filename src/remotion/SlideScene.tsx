import React from 'react';
import {
  AbsoluteFill, Audio, Sequence,
  spring, interpolate, Easing,
  useCurrentFrame, useVideoConfig,
} from 'remotion';
import { Scene as SceneType } from './types';

type SlideSceneProps = {
  scene: SceneType;
  slideIndex: number;
  fontFamily?: string;
};

// ─── 팔레트 ────────────────────────────────────────────────────────────────────
const PALETTES = [
  { bg: '#0f0035', grad: '#1a0050', accent: '#f7c948', accent2: '#ff6b6b', dot: '#f7c948' },
  { bg: '#001f3f', grad: '#003366', accent: '#00d4ff', accent2: '#7efff5', dot: '#00d4ff' },
  { bg: '#1a0000', grad: '#3d0000', accent: '#ff6b35', accent2: '#ffd166', dot: '#ff6b35' },
  { bg: '#002d1f', grad: '#004d33', accent: '#06ffa5', accent2: '#b8ffdc', dot: '#06ffa5' },
  { bg: '#0d0d2b', grad: '#1a1a4e', accent: '#ff79c6', accent2: '#bd93f9', dot: '#ff79c6' },
  { bg: '#1c1c00', grad: '#3a3a00', accent: '#f4e04d', accent2: '#fff176', dot: '#f4e04d' },
  { bg: '#1a001a', grad: '#330033', accent: '#e040fb', accent2: '#ff80ab', dot: '#e040fb' },
  { bg: '#001a2c', grad: '#00324d', accent: '#40c4ff', accent2: '#82b1ff', dot: '#40c4ff' },
];

function pal(idx: number) {
  return PALETTES[idx % PALETTES.length];
}

// ─── 테마 스타일 ──────────────────────────────────────────────────────────────
function getTheme(theme: string | undefined, slideIndex: number) {
  if (theme === 'colorful') {
    const p = pal(slideIndex);
    return {
      isColorful: true,
      isDark: false,
      bg: `linear-gradient(145deg, ${p.bg} 0%, ${p.grad} 100%)`,
      title: '#ffffff',
      body: 'rgba(255,255,255,0.88)',
      accent: p.accent,
      accent2: p.accent2,
      dot: p.dot,
      line: p.accent,
      muted: 'rgba(255,255,255,0.35)',
    };
  }
  if (theme === 'simple-modern') {
    return {
      isColorful: false,
      isDark: false,
      bg: '#f8f8f8',
      title: '#111111',
      body: '#333333',
      accent: '#2563eb',
      accent2: '#bfdbfe',
      dot: '#2563eb',
      line: '#2563eb',
      muted: '#999999',
    };
  }
  // dark
  return {
    isColorful: false,
    isDark: true,
    bg: '#0d0d0d',
    title: '#ffffff',
    body: '#dddddd',
    accent: '#f97316',
    accent2: '#fde68a',
    dot: '#f97316',
    line: '#f97316',
    muted: 'rgba(255,255,255,0.3)',
  };
}

// ─── 헬퍼: 텍스트 강조 파싱 ──────────────────────────────────────────────────
// **텍스트** 패턴을 accent 색으로 강조
function renderHighlighted(text: string, accentColor: string, baseStyle: React.CSSProperties) {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <span key={i} style={{ ...baseStyle, color: accentColor, fontWeight: 900 }}>
          {part.slice(2, -2)}
        </span>
      );
    }
    return <span key={i} style={baseStyle}>{part}</span>;
  });
}

// ─── 배경 도형 (컬러풀 전용) ──────────────────────────────────────────────────
const BgShapes: React.FC<{ p: ReturnType<typeof pal>; frame: number; fps: number }> = ({ p, frame, fps }) => {
  const s = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 40 });
  const rot = interpolate(frame, [0, 300], [0, 360], { extrapolateRight: 'clamp' });
  const pulse = interpolate(
    frame % 60, [0, 30, 60], [1, 1.08, 1],
    { extrapolateRight: 'clamp', easing: Easing.inOut(Easing.sin) }
  );

  return (
    <>
      {/* 오른쪽 상단 큰 원 */}
      <div style={{
        position: 'absolute', top: -200, right: -200,
        width: 560, height: 560, borderRadius: '50%',
        background: `radial-gradient(circle, ${p.accent}22 0%, transparent 70%)`,
        transform: `scale(${s * pulse})`,
      }} />
      {/* 왼쪽 하단 원 */}
      <div style={{
        position: 'absolute', bottom: -140, left: -140,
        width: 380, height: 380, borderRadius: '50%',
        background: `radial-gradient(circle, ${p.accent2}18 0%, transparent 70%)`,
        transform: `scale(${s})`,
      }} />
      {/* 회전 사각형 */}
      <div style={{
        position: 'absolute', top: 60, right: 100,
        width: 80, height: 80,
        border: `3px solid ${p.accent}55`,
        borderRadius: 12,
        transform: `rotate(${rot}deg) scale(${s})`,
      }} />
      {/* 작은 점들 */}
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          position: 'absolute',
          bottom: 80 + i * 40,
          right: 60 + i * 30,
          width: 8, height: 8, borderRadius: '50%',
          background: p.dot,
          opacity: interpolate(s, [0, 1], [0, 0.5 - i * 0.1]),
        }} />
      ))}
      {/* 상단 가로 라인 */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 3,
        background: `linear-gradient(90deg, ${p.accent} 0%, ${p.accent2}88 50%, transparent 100%)`,
        transform: `scaleX(${s})`, transformOrigin: 'left',
      }} />
    </>
  );
};

// ─── TITLE 레이아웃 ───────────────────────────────────────────────────────────
const TitleLayout: React.FC<{ scene: SceneType; slideIndex: number; bodyFont: string }> = ({ scene, slideIndex, bodyFont }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = getTheme(scene.pptTheme, slideIndex);
  const p = t.isColorful ? pal(slideIndex) : null;

  // 애니메이션
  const lineScale = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 30 });
  const titleText = scene.slideData?.title || '';
  // 타이프라이터: 8프레임 딜레이 후 글자당 2프레임
  const typeFrame = Math.max(0, frame - 8);
  const charsToShow = Math.floor(typeFrame * 1.8);
  const typedText = titleText.slice(0, charsToShow);
  const showCursor = charsToShow < titleText.length;
  const titleOpacity = interpolate(frame, [8, 14], [0, 1], { extrapolateRight: 'clamp', easing: Easing.out(Easing.quad) });
  const sub1 = spring({ frame: Math.max(0, frame - 20), fps, config: { damping: 200 }, durationInFrames: 30 });
  const sub2 = spring({ frame: Math.max(0, frame - 26), fps, config: { damping: 200 }, durationInFrames: 30 });
  const titleY = 0;

  return (
    <AbsoluteFill style={{ background: t.bg, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {scene.audioUrl && <Audio src={scene.audioUrl} />}
      {p && <BgShapes p={p} frame={frame} fps={fps} />}

      {/* 심플모던: 왼쪽 세로 바 */}
      {!t.isColorful && !t.isDark && (
        <div style={{
          position: 'absolute', left: 0, top: 0, width: 10, height: '100%',
          background: t.accent,
          transform: `scaleY(${lineScale})`, transformOrigin: 'top',
        }} />
      )}

      <div style={{ textAlign: 'center', padding: '0 140px', width: '100%', position: 'relative', zIndex: 1 }}>
        {/* 슬라이드 넘버 라벨 */}
        {t.isColorful && (
          <Sequence from={0} layout="none">
            <div style={{
              fontSize: 18, fontWeight: 700, letterSpacing: '0.25em',
              color: t.accent, textTransform: 'uppercase',
              marginBottom: 28,
              opacity: lineScale,
              transform: `translateY(${(1 - lineScale) * 16}px)`,
            }}>
              {String(slideIndex + 1).padStart(2, '0')} / SLIDE
            </div>
          </Sequence>
        )}

        {/* 제목 — 타이프라이터 */}
        <div style={{
          fontSize: 100,
          fontWeight: 800,
          fontFamily: bodyFont,
          color: t.title,
          lineHeight: 1.15,
          letterSpacing: '0.015em',
          opacity: titleOpacity,
        }}>
          {renderHighlighted(typedText, t.accent, {
            fontSize: 100, fontWeight: 800, fontFamily: bodyFont, lineHeight: 1.15,
          })}
          {showCursor && (
            <span style={{
              display: 'inline-block', width: 4, height: '0.9em',
              background: t.accent, marginLeft: 4, verticalAlign: 'middle',
              opacity: Math.floor(frame / 8) % 2 === 0 ? 1 : 0,
            }} />
          )}
        </div>

        {/* 구분선 1 */}
        <div style={{
          width: 100, height: 5,
          background: t.line,
          margin: '36px auto 0',
          borderRadius: 3,
          transform: `scaleX(${sub1})`, transformOrigin: 'center',
          opacity: sub1,
        }} />
        {/* 구분선 2 (컬러풀만) */}
        {t.isColorful && p && (
          <div style={{
            width: 50, height: 5,
            background: p.accent2,
            margin: '8px auto 0',
            borderRadius: 3,
            transform: `scaleX(${sub2})`, transformOrigin: 'center',
            opacity: sub2,
          }} />
        )}
      </div>
    </AbsoluteFill>
  );
};

// ─── BULLETS 레이아웃 ─────────────────────────────────────────────────────────
const BulletsLayout: React.FC<{ scene: SceneType; slideIndex: number; bodyFont: string }> = ({ scene, slideIndex, bodyFont }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = getTheme(scene.pptTheme, slideIndex);
  const p = t.isColorful ? pal(slideIndex) : null;
  const bullets = scene.slideData?.bullets ?? [];

  const lineScale = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 25 });
  const titleOpacity = interpolate(frame, [4, 22], [0, 1], { extrapolateRight: 'clamp', easing: Easing.out(Easing.quad) });
  const titleX = interpolate(
    spring({ frame: Math.max(0, frame - 4), fps, config: { damping: 18, stiffness: 160 }, durationInFrames: 30 }),
    [0, 1], [-40, 0]
  );

  return (
    <AbsoluteFill style={{ background: t.bg, overflow: 'hidden' }}>
      {scene.audioUrl && <Audio src={scene.audioUrl} />}
      {p && <BgShapes p={p} frame={frame} fps={fps} />}

      {!t.isColorful && !t.isDark && (
        <div style={{
          position: 'absolute', left: 0, top: 0, width: 10, height: '100%',
          background: t.accent,
          transform: `scaleY(${lineScale})`, transformOrigin: 'top',
        }} />
      )}
      {t.isDark && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 4,
          background: `linear-gradient(90deg, ${t.accent}, transparent)`,
          transform: `scaleX(${lineScale})`, transformOrigin: 'left',
        }} />
      )}

      {/* 세로 중앙 정렬 래퍼 */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1,
      }}>
      <div style={{ padding: t.isColorful ? '60px 160px' : '60px 140px', width: '100%', textAlign: 'center' }}>
        {/* 제목 */}
        <div style={{
          fontSize: 62,
          fontWeight: 800,
          fontFamily: bodyFont,
          color: t.isColorful ? t.accent : t.title,
          lineHeight: 1.2,
          letterSpacing: '0.02em',
          marginBottom: 16,
          opacity: titleOpacity,
          transform: `translateY(${interpolate(titleX, [-40, 0], [20, 0])}px)`,
        }}>
          {renderHighlighted(scene.slideData?.title || '', t.isColorful ? t.accent2 : t.accent, {
            fontSize: 62, fontWeight: 800, fontFamily: bodyFont, lineHeight: 1.2,
            color: t.isColorful ? t.accent : t.title,
          })}
        </div>

        {/* 구분선 */}
        <div style={{
          width: 56, height: 4,
          background: t.line, borderRadius: 2,
          margin: '0 auto 40px',
          transform: `scaleX(${lineScale})`, transformOrigin: 'center',
          opacity: lineScale,
        }} />

        {/* 불릿 목록 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22, alignItems: 'center' }}>
          {bullets.map((bullet, bi) => {
            const delay = 18 + bi * 10;
            const bs = spring({ frame: Math.max(0, frame - delay), fps, config: { damping: 18, stiffness: 140 }, durationInFrames: 28 });
            const bOpacity = interpolate(frame, [delay, delay + 18], [0, 1], { extrapolateRight: 'clamp', easing: Easing.out(Easing.quad) });
            const isEven = bi % 2 === 0;

            return (
              <div key={bi} style={{
                display: 'flex', alignItems: 'center', gap: 20,
                opacity: bOpacity,
                transform: `translateY(${interpolate(bs, [0, 1], [24, 0])}px)`,
              }}>
                {/* 마커 */}
                {t.isColorful && p ? (
                  <div style={{
                    minWidth: 48, height: 48, borderRadius: 10,
                    background: isEven ? p.accent : p.accent2,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: `0 4px 16px ${isEven ? p.accent : p.accent2}55`,
                  }}>
                    <span style={{ fontSize: 22, fontWeight: 900, color: '#000', fontFamily: bodyFont }}>{bi + 1}</span>
                  </div>
                ) : (
                  <div style={{
                    width: 10, height: 10, borderRadius: '50%',
                    background: t.dot, flexShrink: 0,
                    boxShadow: `0 0 8px ${t.dot}88`,
                  }} />
                )}

                {/* 불릿 텍스트 */}
                <div style={{ fontSize: 38, fontWeight: 500, fontFamily: bodyFont, color: t.body, lineHeight: 1.5, letterSpacing: '0.01em' }}>
                  {renderHighlighted(bullet, t.accent, { fontSize: 38, fontWeight: 500, fontFamily: bodyFont, lineHeight: 1.5 })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      </div>
    </AbsoluteFill>
  );
};

// ─── QUOTE 레이아웃 ───────────────────────────────────────────────────────────
const QuoteLayout: React.FC<{ scene: SceneType; slideIndex: number; bodyFont: string }> = ({ scene, slideIndex, bodyFont }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = getTheme(scene.pptTheme, slideIndex);
  const p = t.isColorful ? pal(slideIndex) : null;

  const quoteMarkS = spring({ frame, fps, config: { damping: 20, stiffness: 80 }, durationInFrames: 25 });
  const textOpacity = interpolate(frame, [14, 36], [0, 1], { extrapolateRight: 'clamp', easing: Easing.out(Easing.quad) });
  const textScale = interpolate(
    spring({ frame: Math.max(0, frame - 14), fps, config: { damping: 200 }, durationInFrames: 35 }),
    [0, 1], [0.92, 1]
  );
  const lineS = spring({ frame: Math.max(0, frame - 30), fps, config: { damping: 200 }, durationInFrames: 25 });

  return (
    <AbsoluteFill style={{ background: t.bg, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {scene.audioUrl && <Audio src={scene.audioUrl} />}
      {p && <BgShapes p={p} frame={frame} fps={fps} />}

      <div style={{ textAlign: 'center', padding: '60px 140px', width: '100%', position: 'relative', zIndex: 1 }}>
        {/* 인용 부호 */}
        <div style={{
          fontSize: 200, lineHeight: 0.7,
          color: t.isColorful ? t.accent + '55' : t.line + '44',
          fontFamily: 'Georgia, serif',
          marginBottom: 20,
          opacity: quoteMarkS,
          transform: `scale(${interpolate(quoteMarkS, [0, 1], [0.5, 1])})`,
        }}>"</div>

        {/* 인용 텍스트 */}
        <div style={{
          fontSize: 48,
          fontWeight: 700,
          fontFamily: "'Nanum Myeongjo', serif",
          color: t.title,
          lineHeight: 1.75,
          opacity: textOpacity,
          transform: `scale(${textScale})`,
        }}>
          {renderHighlighted(scene.slideData?.title || '', t.accent, {
            fontSize: 48, fontWeight: 700,
            fontFamily: "'Nanum Myeongjo', serif",
            lineHeight: 1.75,
          })}
        </div>

        {/* 하단 라인 */}
        <div style={{
          width: 90, height: 4, background: t.line,
          margin: '36px auto 0', borderRadius: 2,
          transform: `scaleX(${lineS})`, transformOrigin: 'center',
          opacity: lineS,
        }} />
      </div>
    </AbsoluteFill>
  );
};

// ─── COMPARISON 레이아웃 ──────────────────────────────────────────────────────
const ComparisonLayout: React.FC<{ scene: SceneType; slideIndex: number; bodyFont: string }> = ({ scene, slideIndex, bodyFont }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = getTheme(scene.pptTheme, slideIndex);
  const p = t.isColorful ? pal(slideIndex) : null;
  const data = scene.slideData?.comparisonData;

  const titleOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });
  const leftSlide = spring({ frame: Math.max(0, frame - 15), fps, config: { damping: 20, stiffness: 100 } });
  const rightSlide = spring({ frame: Math.max(0, frame - 25), fps, config: { damping: 20, stiffness: 100 } });

  if (!data) return <TitleLayout scene={scene} slideIndex={slideIndex} bodyFont={bodyFont} />;

  return (
    <AbsoluteFill style={{ background: t.bg, overflow: 'hidden' }}>
      {scene.audioUrl && <Audio src={scene.audioUrl} />}
      {p && <BgShapes p={p} frame={frame} fps={fps} />}

      <div style={{
        padding: '60px 100px',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        zIndex: 1,
      }}>
        {/* 상단 제목 */}
        <div style={{
          fontSize: 54,
          fontWeight: 800,
          fontFamily: bodyFont,
          color: t.title,
          textAlign: 'center',
          marginBottom: 40,
          opacity: titleOpacity,
        }}>
          {renderHighlighted(scene.slideData?.title || '', t.accent, { fontSize: 54, fontWeight: 800, fontFamily: bodyFont })}
        </div>

        <div style={{ display: 'flex', gap: 60, flex: 1, alignItems: 'stretch' }}>
          {/* 왼쪽 박스 */}
          <div style={{
            flex: 1,
            background: t.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
            borderRadius: 24,
            border: `2px solid ${t.accent}44`,
            padding: 40,
            display: 'flex',
            flexDirection: 'column',
            transform: `translateX(${interpolate(leftSlide, [0, 1], [-100, 0])}px)`,
            opacity: leftSlide,
            boxShadow: t.isDark ? '0 10px 30px rgba(0,0,0,0.5)' : '0 10px 30px rgba(0,0,0,0.05)',
          }}>
            <div style={{
              fontSize: 36,
              fontWeight: 800,
              color: t.isColorful ? t.accent : t.title,
              marginBottom: 30,
              textAlign: 'center',
              borderBottom: `2px solid ${t.accent}22`,
              paddingBottom: 15,
            }}>
              {data.leftTitle}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
              {data.leftItems.map((item, i) => {
                const itemEntry = spring({ frame: Math.max(0, frame - 35 - i * 8), fps, config: { damping: 15 } });
                return (
                  <div key={i} style={{
                    fontSize: 28,
                    color: t.body,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    opacity: itemEntry,
                    transform: `translateX(${interpolate(itemEntry, [0, 1], [20, 0])}px)`,
                  }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: t.accent }} />
                    {item}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 오른쪽 박스 */}
          <div style={{
            flex: 1,
            background: t.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
            borderRadius: 24,
            border: `2px solid ${t.accent2 ? t.accent2 : t.accent}44`,
            padding: 40,
            display: 'flex',
            flexDirection: 'column',
            transform: `translateX(${interpolate(rightSlide, [0, 1], [100, 0])}px)`,
            opacity: rightSlide,
            boxShadow: t.isDark ? '0 10px 30px rgba(0,0,0,0.5)' : '0 10px 30px rgba(0,0,0,0.05)',
          }}>
            <div style={{
              fontSize: 36,
              fontWeight: 800,
              color: t.accent2 ? t.accent2 : t.title,
              marginBottom: 30,
              textAlign: 'center',
              borderBottom: `2px solid ${t.accent2 ? t.accent2 : t.accent}22`,
              paddingBottom: 15,
            }}>
              {data.rightTitle}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
              {data.rightItems.map((item, i) => {
                const itemEntry = spring({ frame: Math.max(0, frame - 45 - i * 8), fps, config: { damping: 15 } });
                return (
                  <div key={i} style={{
                    fontSize: 28,
                    color: t.body,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    opacity: itemEntry,
                    transform: `translateX(${interpolate(itemEntry, [0, 1], [20, 0])}px)`,
                  }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: t.accent2 ? t.accent2 : t.accent }} />
                    {item}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────
export const SlideSceneComponent: React.FC<SlideSceneProps> = ({ scene, slideIndex, fontFamily }) => {
  const bodyFont = fontFamily ?? 'sans-serif';
  const layout = scene.slideData?.layout ?? 'title';

  if (layout === 'bullets') {
    return <BulletsLayout scene={scene} slideIndex={slideIndex} bodyFont={bodyFont} />;
  }
  if (layout === 'quote') {
    return <QuoteLayout scene={scene} slideIndex={slideIndex} bodyFont={bodyFont} />;
  }
  if (layout === 'comparison') {
    return <ComparisonLayout scene={scene} slideIndex={slideIndex} bodyFont={bodyFont} />;
  }
  return <TitleLayout scene={scene} slideIndex={slideIndex} bodyFont={bodyFont} />;
};
