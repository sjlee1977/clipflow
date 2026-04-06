import React from 'react';
import {
  AbsoluteFill, Audio, Sequence,
  spring, interpolate, Easing,
  useCurrentFrame, useVideoConfig,
} from 'remotion';
import { Scene as SceneType } from './types';
import { SubtitleOverlay } from './SubtitleOverlay';

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
    return <span key={i} style={baseStyle}>{part.replace(/\*\*/g, '')}</span>;
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

      {/* 상단 정렬 래퍼 (BulletsLayout과 동일하게 구조 통일) */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: 240, // 상단 정렬
        zIndex: 1,
      }}>
      <div style={{ textAlign: 'center', padding: t.isColorful ? '0 160px' : '0 140px', width: '100%' }}>
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
          fontSize: 105, // 살짝 상향
          fontWeight: 900, // 최상위 굵기 (Black)
          fontFamily: bodyFont,
          color: t.title,
          lineHeight: 1.15,
          letterSpacing: '-0.02em', // 더 세련된 자간
          opacity: titleOpacity,
        }}>
          {renderHighlighted(typedText, t.accent, {
            fontSize: 105, fontWeight: 900, fontFamily: bodyFont, lineHeight: 1.15,
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
          width: 100, height: 6,
          background: t.line,
          margin: '52px auto 0',
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

      {/* 상단 정렬 래퍼 (기존 중앙 정렬에서 변경) */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: 130,
        zIndex: 1,
      }}>
      <div style={{ padding: t.isColorful ? '0 160px' : '0 140px', width: '100%', textAlign: 'left' }}>
        {/* 제목 */}
        <div style={{
          fontSize: 72, // 상향 (62 -> 72)
          fontWeight: 900, // 최상위 굵기 (Black)
          fontFamily: bodyFont,
          color: t.isColorful ? t.accent : t.title,
          lineHeight: 1.2,
          letterSpacing: '-0.02em',
          marginBottom: 16,
          opacity: titleOpacity,
          transform: `translateY(${interpolate(titleX, [-40, 0], [20, 0])}px)`,
        }}>
          {renderHighlighted(scene.slideData?.title || '', t.isColorful ? t.accent2 : t.accent, {
            fontSize: 72, fontWeight: 900, fontFamily: bodyFont, lineHeight: 1.2,
            color: t.isColorful ? t.accent : t.title,
          })}
        </div>

        {/* 구분선 — 좌측 정렬로 TitleLayout과 차별화 */}
        <div style={{
          width: 44, height: 4,
          background: t.line, borderRadius: 2,
          margin: '0 0 44px 0',
          transform: `scaleX(${lineScale})`, transformOrigin: 'left',
          opacity: lineScale,
        }} />

        {/* 불릿 목록 컨테이너 */}
        <div style={{ 
          marginTop: 0,
          width: '100%',
          display: 'flex',
          justifyContent: 'center'
        }}>
          <div style={{ 
            display: 'inline-grid',
            gridTemplateColumns: 'min-content 1fr',
            columnGap: 28,
            rowGap: 52,
            textAlign: 'left'
          }}>
          {bullets.map((bullet, bi) => {
            const delay = 18 + bi * 10;
            const bOpacity = interpolate(frame, [delay, delay + 18], [0, 1], { extrapolateRight: 'clamp' });
            const bs = spring({ frame: Math.max(0, frame - delay), fps, config: { damping: 18, stiffness: 140 }, durationInFrames: 28 });
            const isEven = bi % 2 === 0;

            return (
              <React.Fragment key={bi}>
                {/* 1열: 마커 (수직 정렬의 핵심) */}
                <div style={{
                  opacity: bOpacity,
                  transform: `translateY(${interpolate(bs, [0, 1], [24, 0])}px)`,
                  display: 'flex',
                  justifyContent: 'center'
                }}>
                  {t.isColorful && p ? (
                    <div style={{
                      minWidth: 48, maxWidth: 48, height: 48, borderRadius: 10,
                      background: isEven ? p.accent : p.accent2,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: `0 4px 16px ${isEven ? p.accent : p.accent2}55`,
                      marginTop: 4 
                    }}>
                      <span style={{ fontSize: 22, fontWeight: 900, color: '#000', fontFamily: bodyFont }}>{bi + 1}</span>
                    </div>
                  ) : (
                    <div style={{
                      width: 14, height: 14, borderRadius: '50%',
                      background: t.dot, flexShrink: 0,
                      boxShadow: `0 0 10px ${t.dot}aa`,
                      marginTop: 22 
                    }} />
                  )}
                </div>

                {/* 2열: 텍스트 */}
                <div style={{ 
                  opacity: bOpacity,
                  transform: `translateY(${interpolate(bs, [0, 1], [24, 0])}px)`,
                  fontSize: 42, // 상향 (38 -> 42)
                  fontWeight: 600, // 500 -> 600 (SemiBold)
                  fontFamily: bodyFont, 
                  color: t.body, 
                  lineHeight: 1.5, 
                  textAlign: 'left'
                }}>
                  {renderHighlighted(bullet, t.accent, { 
                    fontSize: 'inherit',
                    fontWeight: 'inherit',
                    fontFamily: 'inherit',
                    lineHeight: 'inherit',
                    color: 'inherit',
                    textAlign: 'left',
                    display: 'inline'
                  })}
                </div>
              </React.Fragment>
            );
          })}
          </div>
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
    <AbsoluteFill style={{ background: t.bg, overflow: 'hidden' }}>
      {scene.audioUrl && <Audio src={scene.audioUrl} />}
      {p && <BgShapes p={p} frame={frame} fps={fps} />}

      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: 240, // 상단 정렬 통일
        zIndex: 1,
      }}>
      <div style={{ textAlign: 'center', padding: '0 140px', width: '100%' }}>
        {/* accent 라인으로 대체 */}
        <div style={{
          width: 60, height: 5, background: t.line,
          margin: '0 auto 50px',
          borderRadius: 3,
          transform: `scaleX(${quoteMarkS})`, transformOrigin: 'center',
          opacity: quoteMarkS,
        }} />

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
          margin: '160px auto 0', borderRadius: 2, // 간격 대폭 확대 (120 -> 160)
          transform: `scaleX(${lineS})`, transformOrigin: 'center',
          opacity: lineS,
        }} />
      </div>
      </div>
    </AbsoluteFill>
  );
};

// ─── STATCARD 레이아웃 ────────────────────────────────────────────────────────
// 숫자/수치를 카드 형태로, 카운팅 애니메이션
const StatCardLayout: React.FC<{ scene: SceneType; slideIndex: number; bodyFont: string }> = ({ scene, slideIndex, bodyFont }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = getTheme(scene.pptTheme, slideIndex);
  const p = t.isColorful ? pal(slideIndex) : null;
  const stats = scene.slideData?.stats ?? [];
  const boxColors = p
    ? [p.accent, p.accent2, '#ff79c6', '#50fa7b']
    : [t.accent, t.accent2 || '#00d4ff', '#06ffa5', '#f7c948'];

  const titleS = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 25 });
  const titleOpacity = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ background: t.bg, overflow: 'hidden' }}>
      {scene.audioUrl && <Audio src={scene.audioUrl} />}
      {p && <BgShapes p={p} frame={frame} fps={fps} />}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 1,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', padding: '160px 80px 60px',
      }}>
        {/* 제목 */}
        <div style={{
          fontSize: 52, fontWeight: 800, fontFamily: bodyFont,
          color: t.title, marginBottom: 80, textAlign: 'center',
          opacity: titleOpacity,
          transform: `translateY(${interpolate(titleS, [0, 1], [-20, 0])}px)`,
        }}>
          {renderHighlighted(scene.slideData?.title || '', t.accent, { fontSize: 52, fontWeight: 800 })}
        </div>

        {/* 스탯 카드들 */}
        <div style={{
          display: 'flex', gap: 40, flexWrap: 'wrap',
          justifyContent: 'center', width: '100%',
        }}>
          {stats.map((stat, si) => {
            const delay = 15 + si * 15;
            const cs = spring({ frame: Math.max(0, frame - delay), fps, config: { damping: 18, stiffness: 110 }, durationInFrames: 35 });
            const color = boxColors[si % boxColors.length];

            // 숫자 카운팅 (숫자만 추출)
            const numMatch = stat.value.match(/(\d+\.?\d*)/);
            const numVal = numMatch ? parseFloat(numMatch[1]) : null;
            const prefix = numMatch ? stat.value.slice(0, numMatch.index) : '';
            const suffix = numMatch ? stat.value.slice((numMatch.index ?? 0) + numMatch[1].length) : stat.value;
            const displayNum = numVal !== null
              ? Math.round(interpolate(cs, [0, 1], [0, numVal], { extrapolateRight: 'clamp' }))
              : null;

            return (
              <div key={si} style={{
                flex: '1 1 260px', maxWidth: 320,
                background: t.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                borderRadius: 24,
                border: `2px solid ${color}55`,
                padding: '44px 32px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
                opacity: cs,
                transform: `translateY(${interpolate(cs, [0, 1], [60, 0])}px) scale(${interpolate(cs, [0, 1], [0.85, 1])})`,
                boxShadow: `0 8px 32px ${color}22`,
              }}>
                {/* 상단 컬러 바 */}
                <div style={{
                  width: '60%', height: 5, borderRadius: 3,
                  background: color,
                  transform: `scaleX(${cs})`, transformOrigin: 'center',
                }} />
                {/* 수치 */}
                <div style={{
                  fontSize: 88, fontWeight: 900, fontFamily: bodyFont,
                  color, lineHeight: 1, letterSpacing: '-0.04em',
                }}>
                  {prefix}{displayNum !== null ? displayNum : stat.value}{suffix}
                </div>
                {/* 라벨 */}
                <div style={{
                  fontSize: 26, fontWeight: 600, fontFamily: bodyFont,
                  color: t.body, textAlign: 'center', lineHeight: 1.4,
                  opacity: interpolate(cs, [0.5, 1], [0, 1], { extrapolateRight: 'clamp' }),
                }}>
                  {stat.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─── TIMELINE 레이아웃 ────────────────────────────────────────────────────────
// 연도/단계 타임라인, 세로 방향 연결선
const TimelineLayout: React.FC<{ scene: SceneType; slideIndex: number; bodyFont: string }> = ({ scene, slideIndex, bodyFont }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = getTheme(scene.pptTheme, slideIndex);
  const p = t.isColorful ? pal(slideIndex) : null;
  const items = scene.slideData?.bullets ?? [];
  const boxColors = p
    ? [p.accent, p.accent2, '#ff79c6', '#50fa7b', '#ffb86c']
    : [t.accent, t.accent2 || '#00d4ff', '#06ffa5', '#f7c948', '#ff79c6'];

  const titleS = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 25 });

  // 타임라인 선 전체 길이 애니메이션
  const lineProgress = interpolate(frame, [10, 10 + items.length * 18], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ background: t.bg, overflow: 'hidden' }}>
      {scene.audioUrl && <Audio src={scene.audioUrl} />}
      {p && <BgShapes p={p} frame={frame} fps={fps} />}

      <div style={{
        position: 'absolute', inset: 0, zIndex: 1,
        display: 'flex', flexDirection: 'column',
        padding: '160px 100px 80px',
      }}>
        {/* 제목 */}
        <div style={{
          fontSize: 50, fontWeight: 800, fontFamily: bodyFont,
          color: t.isColorful ? t.accent : t.title,
          marginBottom: 60,
          opacity: interpolate(frame, [0, 18], [0, 1], { extrapolateRight: 'clamp' }),
          transform: `translateY(${interpolate(titleS, [0, 1], [-20, 0])}px)`,
        }}>
          {scene.slideData?.title || ''}
        </div>

        {/* 타임라인 */}
        <div style={{ display: 'flex', flex: 1, gap: 0 }}>
          {/* 왼쪽 세로선 */}
          <div style={{ width: 60, position: 'relative', flexShrink: 0 }}>
            <div style={{
              position: 'absolute', left: 20, top: 12, width: 3,
              height: `${lineProgress * 100}%`,
              background: `linear-gradient(180deg, ${t.accent}, ${t.accent2 || t.accent}88)`,
              borderRadius: 3,
              transition: 'height 0.1s',
            }} />
          </div>

          {/* 이벤트 목록 */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 32 }}>
            {items.map((item, ii) => {
              const delay = 12 + ii * 16;
              const is = spring({ frame: Math.max(0, frame - delay), fps, config: { damping: 18, stiffness: 120 }, durationInFrames: 28 });
              const color = boxColors[ii % boxColors.length];

              // "·" 또는 ":" 기준으로 연도/키 분리
              const sepIdx = item.search(/[·:\-–]/);
              const key = sepIdx > 0 ? item.slice(0, sepIdx).trim() : '';
              const val = sepIdx > 0 ? item.slice(sepIdx + 1).trim() : item;

              return (
                <div key={ii} style={{
                  display: 'flex', alignItems: 'center', gap: 0,
                  opacity: is,
                  transform: `translateX(${interpolate(is, [0, 1], [-40, 0])}px)`,
                }}>
                  {/* 도트 (세로선 위) */}
                  <div style={{
                    width: 18, height: 18, borderRadius: '50%',
                    background: color,
                    boxShadow: `0 0 12px ${color}88`,
                    marginLeft: -49, marginRight: 31, flexShrink: 0,
                    transform: `scale(${is})`,
                  }} />

                  {/* 이벤트 카드 */}
                  <div style={{
                    flex: 1,
                    background: t.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                    borderRadius: 14,
                    border: `1.5px solid ${color}44`,
                    padding: '16px 28px',
                    display: 'flex', alignItems: 'center', gap: 20,
                  }}>
                    {key && (
                      <div style={{
                        fontSize: 26, fontWeight: 900, fontFamily: bodyFont,
                        color, flexShrink: 0, minWidth: 80,
                      }}>
                        {key}
                      </div>
                    )}
                    {key && <div style={{ width: 1, height: 32, background: `${color}44` }} />}
                    <div style={{
                      fontSize: 30, fontWeight: 600, fontFamily: bodyFont,
                      color: t.body, lineHeight: 1.4,
                    }}>
                      {val}
                    </div>
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

// ─── ICONGRID 레이아웃 ────────────────────────────────────────────────────────
// 이모지 아이콘 + 텍스트 그리드 카드
const IconGridLayout: React.FC<{ scene: SceneType; slideIndex: number; bodyFont: string }> = ({ scene, slideIndex, bodyFont }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = getTheme(scene.pptTheme, slideIndex);
  const p = t.isColorful ? pal(slideIndex) : null;
  const items = scene.slideData?.bullets ?? [];
  const boxColors = p
    ? [p.accent, p.accent2, '#ff79c6', '#50fa7b', '#ffb86c', '#40c4ff']
    : [t.accent, t.accent2 || '#00d4ff', '#06ffa5', '#f7c948', '#ff79c6', '#ff6b35'];

  const titleS = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 25 });

  // 2열 그리드
  const cols = items.length <= 4 ? 2 : 3;

  return (
    <AbsoluteFill style={{ background: t.bg, overflow: 'hidden' }}>
      {scene.audioUrl && <Audio src={scene.audioUrl} />}
      {p && <BgShapes p={p} frame={frame} fps={fps} />}

      <div style={{
        position: 'absolute', inset: 0, zIndex: 1,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', padding: '150px 80px 60px',
      }}>
        {/* 제목 */}
        <div style={{
          fontSize: 52, fontWeight: 800, fontFamily: bodyFont,
          color: t.isColorful ? t.accent : t.title,
          marginBottom: 60, textAlign: 'center',
          opacity: interpolate(frame, [0, 18], [0, 1], { extrapolateRight: 'clamp' }),
          transform: `translateY(${interpolate(titleS, [0, 1], [-20, 0])}px)`,
        }}>
          {scene.slideData?.title || ''}
        </div>

        {/* 그리드 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gap: 28, width: '100%',
        }}>
          {items.map((item, ii) => {
            const delay = 12 + ii * 10;
            const cs = spring({ frame: Math.max(0, frame - delay), fps, config: { damping: 16, stiffness: 160 }, durationInFrames: 30 });
            const color = boxColors[ii % boxColors.length];

            // 이모지 분리: 첫 번째 이모지 또는 특수문자 추출
            const emojiMatch = item.match(/^(\p{Emoji_Presentation}|\p{Extended_Pictographic})\s*/u);
            const emoji = emojiMatch ? emojiMatch[0].trim() : '';
            const text = emojiMatch ? item.slice(emojiMatch[0].length).trim() : item;

            return (
              <div key={ii} style={{
                background: t.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                borderRadius: 20,
                border: `2px solid ${color}44`,
                padding: '32px 28px',
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: 16, textAlign: 'center',
                opacity: cs,
                transform: `scale(${interpolate(cs, [0, 1], [0.7, 1])}) translateY(${interpolate(cs, [0, 1], [30, 0])}px)`,
                boxShadow: `0 4px 24px ${color}18`,
              }}>
                {/* 이모지 배경 원 */}
                <div style={{
                  width: 72, height: 72, borderRadius: '50%',
                  background: `${color}22`,
                  border: `2px solid ${color}55`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 36,
                }}>
                  {emoji || '⚡'}
                </div>
                {/* 텍스트 */}
                <div style={{
                  fontSize: items.length <= 4 ? 32 : 26,
                  fontWeight: 700, fontFamily: bodyFont,
                  color: t.body, lineHeight: 1.4,
                }}>
                  {text}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─── PROGRESS 레이아웃 ────────────────────────────────────────────────────────
// 단계별 프로세스, 진행 바 + 화살표 연결
const ProgressLayout: React.FC<{ scene: SceneType; slideIndex: number; bodyFont: string }> = ({ scene, slideIndex, bodyFont }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = getTheme(scene.pptTheme, slideIndex);
  const p = t.isColorful ? pal(slideIndex) : null;
  const steps = scene.slideData?.bullets ?? [];
  const boxColors = p
    ? [p.accent, p.accent2, '#ff79c6', '#50fa7b', '#ffb86c']
    : [t.accent, t.accent2 || '#00d4ff', '#06ffa5', '#f7c948', '#ff79c6'];

  const titleS = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 25 });

  return (
    <AbsoluteFill style={{ background: t.bg, overflow: 'hidden' }}>
      {scene.audioUrl && <Audio src={scene.audioUrl} />}
      {p && <BgShapes p={p} frame={frame} fps={fps} />}

      <div style={{
        position: 'absolute', inset: 0, zIndex: 1,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', padding: '150px 80px 80px',
      }}>
        {/* 제목 */}
        <div style={{
          fontSize: 52, fontWeight: 800, fontFamily: bodyFont,
          color: t.isColorful ? t.accent : t.title,
          marginBottom: 80, textAlign: 'center',
          opacity: interpolate(frame, [0, 18], [0, 1], { extrapolateRight: 'clamp' }),
          transform: `translateY(${interpolate(titleS, [0, 1], [-20, 0])}px)`,
        }}>
          {scene.slideData?.title || ''}
        </div>

        {/* 단계 카드 + 연결선 */}
        <div style={{
          display: 'flex', alignItems: 'center',
          width: '100%', gap: 0,
        }}>
          {steps.map((step, si) => {
            const delay = 12 + si * 20;
            const ss = spring({ frame: Math.max(0, frame - delay), fps, config: { damping: 18, stiffness: 120 }, durationInFrames: 30 });
            const color = boxColors[si % boxColors.length];
            const isLast = si === steps.length - 1;

            // "이모지 제목 · 서브텍스트" 또는 "이모지 제목 | 서브텍스트" 파싱
            const emojiMatch = step.match(/^(\p{Emoji_Presentation}|\p{Extended_Pictographic})\s*/u);
            const emoji = emojiMatch ? emojiMatch[0].trim() : '';
            const rest = emojiMatch ? step.slice(emojiMatch[0].length).trim() : step;
            const sepIdx = rest.search(/[·|]/);
            const mainText = sepIdx > 0 ? rest.slice(0, sepIdx).trim() : rest;
            const subText = sepIdx > 0 ? rest.slice(sepIdx + 1).trim() : '';

            return (
              <React.Fragment key={si}>
                {/* 단계 카드 */}
                <div style={{
                  flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
                  opacity: ss,
                  transform: `translateY(${interpolate(ss, [0, 1], [40, 0])}px)`,
                }}>
                  {/* 이모지 or 번호 원 */}
                  <div style={{
                    width: 76, height: 76, borderRadius: 18,
                    background: `${color}22`,
                    border: `2.5px solid ${color}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: `0 4px 20px ${color}44, 0 0 0 1px ${color}22`,
                    transform: `scale(${interpolate(ss, [0, 1], [0.5, 1])})`,
                  }}>
                    {emoji ? (
                      <span style={{ fontSize: 34 }}>{emoji}</span>
                    ) : (
                      <span style={{ fontSize: 30, fontWeight: 900, color, fontFamily: bodyFont }}>{si + 1}</span>
                    )}
                  </div>
                  {/* 텍스트 박스 */}
                  <div style={{
                    background: t.isDark ? `${color}0d` : `${color}08`,
                    borderRadius: 14,
                    border: `1.5px solid ${color}40`,
                    padding: '14px 14px',
                    textAlign: 'center', width: '100%',
                    boxShadow: `0 4px 16px ${color}14`,
                  }}>
                    <div style={{
                      fontSize: steps.length <= 3 ? 28 : 22,
                      fontWeight: 800, fontFamily: bodyFont,
                      color, lineHeight: 1.3, letterSpacing: '-0.01em',
                    }}>
                      {mainText}
                    </div>
                    {subText && (
                      <div style={{
                        marginTop: 6, fontSize: 18, fontWeight: 500, fontFamily: bodyFont,
                        color: t.muted, lineHeight: 1.3,
                        opacity: interpolate(ss, [0.5, 1], [0, 1], { extrapolateRight: 'clamp' }),
                      }}>
                        {subText}
                      </div>
                    )}
                  </div>
                </div>

                {/* 화살표 연결 */}
                {!isLast && (
                  <div style={{
                    width: 36, flexShrink: 0, display: 'flex', alignItems: 'flex-start',
                    paddingTop: 22, justifyContent: 'center',
                    opacity: interpolate(frame, [delay + 10, delay + 25], [0, 1], { extrapolateRight: 'clamp' }),
                  }}>
                    <div style={{ fontSize: 26, color: t.accent, fontWeight: 900 }}>→</div>
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* 하단 요약 배지 */}
        {scene.slideData?.summary && (
          <div style={{
            marginTop: 48,
            display: 'flex', justifyContent: 'center',
            opacity: interpolate(frame, [steps.length * 20 + 20, steps.length * 20 + 40], [0, 1], { extrapolateRight: 'clamp' }),
            transform: `translateY(${interpolate(
              spring({ frame: Math.max(0, frame - steps.length * 20 - 20), fps, config: { damping: 20, stiffness: 120 } }),
              [0, 1], [20, 0]
            )}px)`,
          }}>
            <div style={{
              background: t.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
              border: `2px solid ${t.accent}`,
              borderRadius: 40,
              padding: '14px 36px',
              fontSize: 28, fontWeight: 800, fontFamily: bodyFont,
              color: t.accent, letterSpacing: '-0.01em',
              boxShadow: `0 4px 24px ${t.accent}30`,
            }}>
              {scene.slideData.summary}
            </div>
          </div>
        )}

        {/* 하단 진행 바 (summary 없을 때만) */}
        {!scene.slideData?.summary && (
          <div style={{
            marginTop: 48, width: '100%', height: 5,
            background: t.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
            borderRadius: 3, overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', borderRadius: 3,
              background: `linear-gradient(90deg, ${boxColors[0]}, ${boxColors[Math.min(steps.length - 1, boxColors.length - 1)]})`,
              width: `${interpolate(frame, [10, 10 + steps.length * 20], [0, 100], { extrapolateRight: 'clamp' })}%`,
            }} />
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

// ─── BIGWORD 레이아웃 ─────────────────────────────────────────────────────────
const BigWordLayout: React.FC<{ scene: SceneType; slideIndex: number; bodyFont: string }> = ({ scene, slideIndex, bodyFont }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = getTheme(scene.pptTheme, slideIndex);
  const p = t.isColorful ? pal(slideIndex) : null;

  const word = scene.slideData?.title || '';
  const typeFrame = Math.max(0, frame - 5);
  const charsToShow = Math.floor(typeFrame * 2.5);
  const typedText = word.slice(0, charsToShow);
  const showCursor = charsToShow < word.length;

  const scaleS = spring({ frame: Math.max(0, frame - 3), fps, config: { damping: 18, stiffness: 120 }, durationInFrames: 40 });
  const sub = interpolate(frame, [30, 50], [0, 1], { extrapolateRight: 'clamp', easing: Easing.out(Easing.quad) });
  const subtitleText = scene.slideData?.bullets?.[0] ?? '';

  return (
    <AbsoluteFill style={{ background: t.bg, overflow: 'hidden' }}>
      {scene.audioUrl && <Audio src={scene.audioUrl} />}
      {p && <BgShapes p={p} frame={frame} fps={fps} />}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', zIndex: 1,
        padding: '0 100px',
      }}>
        {/* 대형 키워드 */}
        <div style={{
          fontSize: 130, fontWeight: 900, fontFamily: bodyFont,
          color: t.isColorful ? t.accent : t.title,
          lineHeight: 1.1, textAlign: 'center', letterSpacing: '-0.03em',
          transform: `scale(${interpolate(scaleS, [0, 1], [0.7, 1])})`,
          opacity: interpolate(scaleS, [0, 0.3], [0, 1], { extrapolateRight: 'clamp' }),
        }}>
          {renderHighlighted(typedText, t.accent2 || t.accent, {
            fontSize: 130, fontWeight: 900, fontFamily: bodyFont, lineHeight: 1.1,
          })}
          {showCursor && (
            <span style={{
              display: 'inline-block', width: 6, height: '0.85em',
              background: t.accent, marginLeft: 6, verticalAlign: 'middle',
              opacity: Math.floor(frame / 7) % 2 === 0 ? 1 : 0,
            }} />
          )}
        </div>
        {/* 보조 텍스트 */}
        {subtitleText && (
          <div style={{
            marginTop: 60, fontSize: 40, fontWeight: 500, fontFamily: bodyFont,
            color: t.muted, textAlign: 'center', opacity: sub,
            transform: `translateY(${interpolate(sub, [0, 1], [20, 0])}px)`,
          }}>
            {subtitleText}
          </div>
        )}
        {/* 하단 accent 라인 */}
        <div style={{
          marginTop: 80, width: interpolate(scaleS, [0, 1], [0, 160]),
          height: 6, background: t.accent, borderRadius: 3,
        }} />
      </div>
    </AbsoluteFill>
  );
};

// ─── BOXLIST 레이아웃 ─────────────────────────────────────────────────────────
// 미니멀 포인트 스타일: 좌측 얇은 컬러 라인 + 컴팩트 카드
const BoxListLayout: React.FC<{ scene: SceneType; slideIndex: number; bodyFont: string }> = ({ scene, slideIndex, bodyFont }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = getTheme(scene.pptTheme, slideIndex);
  const p = t.isColorful ? pal(slideIndex) : null;
  const bullets = scene.slideData?.bullets ?? [];

  const titleOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });
  const titleY = interpolate(frame, [0, 20], [-16, 0], { extrapolateRight: 'clamp' });

  const accentColors = p
    ? [p.accent, p.accent2, '#ff79c6', '#50fa7b', '#ffb86c']
    : [t.accent, t.accent2 || '#06ffa5', '#f7c948', '#ff79c6', '#00d4ff'];

  return (
    <AbsoluteFill style={{ background: t.bg, overflow: 'hidden' }}>
      {scene.audioUrl && <Audio src={scene.audioUrl} />}
      {p && <BgShapes p={p} frame={frame} fps={fps} />}

      <div style={{
        position: 'absolute', inset: 0, zIndex: 1,
        display: 'flex', flexDirection: 'column',
        justifyContent: 'center',
        padding: '80px 130px',
      }}>
        {/* 상단 헤더 배지 */}
        {scene.slideData?.headerBadge && (
          <div style={{
            marginBottom: 28,
            opacity: titleOpacity,
            display: 'flex', justifyContent: 'center',
          }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 10,
              background: 'transparent',
              border: `2px solid ${t.accent}`,
              borderRadius: 40, padding: '10px 28px',
              boxShadow: `0 0 20px ${t.accent}30`,
            }}>
              {scene.slideData.headerBadge.icon && (
                <span style={{ fontSize: 22 }}>{scene.slideData.headerBadge.icon}</span>
              )}
              <span style={{ fontSize: 24, fontWeight: 800, fontFamily: bodyFont, color: t.accent, letterSpacing: '-0.01em' }}>
                {scene.slideData.headerBadge.text}
              </span>
            </div>
          </div>
        )}

        {/* 제목: 심플 라인 언더라인 */}
        <div style={{
          marginBottom: scene.slideData?.headerBadge ? 36 : 52,
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
        }}>
          <div style={{
            fontSize: 46, fontWeight: 900, fontFamily: bodyFont,
            color: t.title, letterSpacing: '-0.02em', lineHeight: 1.2,
          }}>
            {scene.slideData?.title || ''}
          </div>
          {!scene.slideData?.headerBadge && (
            <div style={{
              marginTop: 10, height: 3, width: 60,
              background: t.accent, borderRadius: 2,
            }} />
          )}
        </div>

        {/* 아이템 카드들 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {bullets.map((bullet, bi) => {
            const delay = 12 + bi * 10;
            const bs = spring({ frame: Math.max(0, frame - delay), fps, config: { damping: 22, stiffness: 160 }, durationInFrames: 25 });
            const bOpacity = interpolate(frame, [delay, delay + 12], [0, 1], { extrapolateRight: 'clamp' });
            const color = accentColors[bi % accentColors.length];

            // "제목 | 서브텍스트" 파싱
            const sepIdx = bullet.indexOf('|');
            const mainText = sepIdx > 0 ? bullet.slice(0, sepIdx).trim() : bullet;
            const subText = sepIdx > 0 ? bullet.slice(sepIdx + 1).trim() : '';

            return (
              <div key={bi} style={{
                display: 'flex', alignItems: 'center', gap: 0,
                opacity: bOpacity,
                transform: `translateX(${interpolate(bs, [0, 1], [-50, 0])}px)`,
              }}>
                {/* 얇은 컬러 라인 */}
                <div style={{
                  width: 4, alignSelf: 'stretch', minHeight: subText ? 80 : 68,
                  background: color, borderRadius: 4, flexShrink: 0,
                  transform: `scaleY(${bs})`, transformOrigin: 'top',
                }} />
                {/* 카드 본체 */}
                <div style={{
                  flex: 1,
                  background: t.isDark
                    ? `${color}0d`
                    : t.isColorful ? `${color}0a` : `${color}08`,
                  borderRadius: '0 12px 12px 0',
                  padding: subText ? '14px 28px' : '16px 28px',
                  display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4,
                }}>
                  {/* 메인 텍스트 */}
                  <div style={{
                    fontSize: subText ? 36 : 42, fontWeight: 800, fontFamily: bodyFont,
                    color: t.body, lineHeight: 1.3, letterSpacing: '-0.01em',
                  }}>
                    {renderHighlighted(mainText, color, {
                      fontSize: subText ? 36 : 42, fontWeight: 800, fontFamily: bodyFont,
                      lineHeight: 1.3, color: t.body,
                    })}
                  </div>
                  {/* 서브 텍스트 */}
                  {subText && (
                    <div style={{
                      fontSize: 22, fontWeight: 500, fontFamily: bodyFont,
                      color: t.muted, lineHeight: 1.3,
                    }}>
                      {subText}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* 하단 경고/알림 태그 */}
        {scene.slideData?.warningTag && (
          <div style={{
            marginTop: 32,
            display: 'flex', justifyContent: 'center',
            opacity: interpolate(frame, [bullets.length * 10 + 22, bullets.length * 10 + 40], [0, 1], { extrapolateRight: 'clamp' }),
          }}>
            <div style={{
              background: 'transparent',
              border: `1.5px solid ${t.accent}88`,
              borderRadius: 30, padding: '10px 28px',
              fontSize: 22, fontWeight: 600, fontFamily: bodyFont,
              color: t.accent, letterSpacing: '-0.01em',
            }}>
              {scene.slideData.warningTag}
            </div>
          </div>
        )}
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
        padding: '120px 90px 80px',
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
          marginBottom: 52,
          opacity: titleOpacity,
        }}>
          {renderHighlighted(scene.slideData?.title || '', t.accent, { fontSize: 54, fontWeight: 800, fontFamily: bodyFont })}
        </div>

        <div style={{ display: 'flex', gap: 48, alignItems: 'flex-start' }}>
          {/* 왼쪽 박스 */}
          <div style={{
            flex: 1,
            background: t.isDark ? 'rgba(255,255,255,0.06)' : t.isColorful ? 'rgba(255,255,255,0.08)' : 'rgba(37,99,235,0.05)',
            borderRadius: 20,
            border: `2.5px solid ${t.accent}`,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: `0 8px 32px ${t.accent}28, 0 2px 8px rgba(0,0,0,0.12)`,
            transform: `translateX(${interpolate(leftSlide, [0, 1], [-100, 0])}px)`,
            opacity: leftSlide,
          }}>
            {/* 컬러 헤더 박스 */}
            <div style={{
              background: `linear-gradient(135deg, ${t.accent}, ${t.accent}cc)`,
              padding: '18px 28px',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <span style={{ fontSize: 24, color: '#fff' }}>✓</span>
              <span style={{ fontSize: 30, fontWeight: 900, color: '#fff', fontFamily: bodyFont, letterSpacing: '-0.01em' }}>
                {data.leftTitle}
              </span>
            </div>
            {/* 아이템들 */}
            <div style={{ display: 'flex', flexDirection: 'column', padding: '20px 24px', gap: 14 }}>
              {data.leftItems.map((item, i) => {
                const itemEntry = spring({ frame: Math.max(0, frame - 30 - i * 10), fps, config: { damping: 18, stiffness: 130 } });
                return (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    background: t.isDark ? 'rgba(255,255,255,0.05)' : `${t.accent}0a`,
                    borderRadius: 10,
                    border: `1.5px solid ${t.accent}30`,
                    padding: '12px 18px',
                    opacity: itemEntry,
                    transform: `translateX(${interpolate(itemEntry, [0, 1], [28, 0])}px)`,
                  }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: t.accent, flexShrink: 0,
                      boxShadow: `0 0 8px ${t.accent}88`,
                    }} />
                    <span style={{
                      fontSize: 36, fontFamily: bodyFont,
                      fontWeight: 800, lineHeight: 1.35,
                      color: t.body, letterSpacing: '-0.01em',
                    }}>
                      {item}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 오른쪽 박스 */}
          <div style={{
            flex: 1,
            background: t.isDark ? 'rgba(255,255,255,0.06)' : t.isColorful ? 'rgba(255,255,255,0.08)' : 'rgba(220,38,38,0.05)',
            borderRadius: 20,
            border: `2.5px solid ${t.accent2 || '#ff6b6b'}`,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: `0 8px 32px ${t.accent2 || '#ff6b6b'}28, 0 2px 8px rgba(0,0,0,0.12)`,
            transform: `translateX(${interpolate(rightSlide, [0, 1], [100, 0])}px)`,
            opacity: rightSlide,
          }}>
            {/* 컬러 헤더 박스 (다른 색) */}
            <div style={{
              background: `linear-gradient(135deg, ${t.accent2 || '#ff6b6b'}, ${t.accent2 || '#ff6b6b'}cc)`,
              padding: '18px 28px',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <span style={{ fontSize: 24, color: '#fff' }}>✗</span>
              <span style={{ fontSize: 30, fontWeight: 900, color: '#fff', fontFamily: bodyFont, letterSpacing: '-0.01em' }}>
                {data.rightTitle}
              </span>
            </div>
            {/* 아이템들 */}
            <div style={{ display: 'flex', flexDirection: 'column', padding: '20px 24px', gap: 14 }}>
              {data.rightItems.map((item, i) => {
                const itemEntry = spring({ frame: Math.max(0, frame - 40 - i * 10), fps, config: { damping: 18, stiffness: 130 } });
                const rightColor = t.accent2 || '#ff6b6b';
                return (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    background: t.isDark ? 'rgba(255,255,255,0.05)' : `${rightColor}0a`,
                    borderRadius: 10,
                    border: `1.5px solid ${rightColor}30`,
                    padding: '12px 18px',
                    opacity: itemEntry,
                    transform: `translateX(${interpolate(itemEntry, [0, 1], [-28, 0])}px)`,
                  }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: rightColor, flexShrink: 0,
                      boxShadow: `0 0 8px ${rightColor}88`,
                    }} />
                    <span style={{
                      fontSize: 36, fontFamily: bodyFont,
                      fontWeight: 800, lineHeight: 1.35,
                      color: t.body, letterSpacing: '-0.01em',
                    }}>
                      {item}
                    </span>
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

// ─── DIALOG SPLIT 레이아웃 ────────────────────────────────────────────────────
// 왼쪽: AI/화자 대화 카드 (타이핑 애니메이션), 오른쪽: AI 처리 시각화 패널
const DialogSplitLayout: React.FC<{ scene: SceneType; slideIndex: number; bodyFont: string }> = ({ scene, slideIndex, bodyFont }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = getTheme(scene.pptTheme, slideIndex);
  const p = t.isColorful ? pal(slideIndex) : null;

  // bullets[0] = 화자 이름 (예: "Claude"), bullets[1] = 오른쪽 패널 제목
  const speakerName = scene.slideData?.bullets?.[0] || 'Claude';
  const rightPanelTitle = scene.slideData?.bullets?.[1] || 'AI가 읽는 방식';
  const dialogText = scene.slideData?.title || '';

  // 왼쪽 카드 진입
  const leftEnter = spring({ frame, fps, config: { damping: 20, stiffness: 100 } });
  const rightEnter = spring({ frame: Math.max(0, frame - 15), fps, config: { damping: 20, stiffness: 100 } });

  // 타이핑 (10프레임 딜레이 후)
  const typeFrame = Math.max(0, frame - 18);
  const charsToShow = Math.min(dialogText.length, Math.floor(typeFrame * 1.2));
  const typedText = dialogText.slice(0, charsToShow);
  const isTyping = charsToShow < dialogText.length;

  // 오른쪽 패널: 로딩 바 애니메이션
  const barWidths = [0.85, 0.65, 0.9, 0.55, 0.75];
  const panelReady = frame > 40;

  const cardBg = t.isDark ? 'rgba(255,255,255,0.06)' : t.isColorful ? 'rgba(255,255,255,0.1)' : '#f0f4ff';
  const borderColor = t.isDark ? 'rgba(255,255,255,0.12)' : t.isColorful ? `${p?.accent}44` : 'rgba(37,99,235,0.2)';

  return (
    <AbsoluteFill style={{ background: t.bg, overflow: 'hidden' }}>
      {scene.audioUrl && <Audio src={scene.audioUrl} />}
      {p && <BgShapes p={p} frame={frame} fps={fps} />}

      <div style={{
        position: 'absolute', inset: 0, zIndex: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '80px 100px', gap: 48,
      }}>
        {/* 왼쪽: 대화 카드 */}
        <div style={{
          flex: 1.1,
          background: cardBg,
          borderRadius: 20,
          border: `1.5px solid ${borderColor}`,
          padding: '28px 32px',
          display: 'flex', flexDirection: 'column', gap: 16,
          boxShadow: t.isDark
            ? '0 8px 40px rgba(0,0,0,0.5)'
            : `0 8px 32px ${t.accent}18`,
          opacity: leftEnter,
          transform: `translateX(${interpolate(leftEnter, [0, 1], [-60, 0])}px)`,
        }}>
          {/* 화자 이름 뱃지 */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: `${t.accent}22`,
            border: `1px solid ${t.accent}55`,
            borderRadius: 8, padding: '5px 14px',
            alignSelf: 'flex-start',
          }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: t.accent }} />
            <span style={{ fontSize: 18, fontWeight: 700, fontFamily: bodyFont, color: t.accent }}>
              {speakerName}
            </span>
          </div>
          {/* 대화 텍스트 (타이핑) */}
          <div style={{
            fontSize: 32, fontWeight: 600, fontFamily: bodyFont,
            color: t.body, lineHeight: 1.65,
          }}>
            {renderHighlighted(typedText, t.accent, {
              fontSize: 32, fontWeight: 600, fontFamily: bodyFont, lineHeight: 1.65,
            })}
            {isTyping && (
              <span style={{
                display: 'inline-block', width: 2, height: '1.1em',
                background: t.accent, marginLeft: 2, verticalAlign: 'text-bottom',
                opacity: Math.floor(frame / 10) % 2 === 0 ? 1 : 0,
              }} />
            )}
          </div>
        </div>

        {/* 오른쪽: AI 처리 패널 */}
        <div style={{
          flex: 0.9,
          background: cardBg,
          borderRadius: 20,
          border: `1.5px solid ${borderColor}`,
          padding: '28px 32px',
          display: 'flex', flexDirection: 'column', gap: 18,
          boxShadow: t.isDark ? '0 8px 40px rgba(0,0,0,0.5)' : `0 8px 32px ${t.accent}18`,
          opacity: rightEnter,
          transform: `translateX(${interpolate(rightEnter, [0, 1], [60, 0])}px)`,
        }}>
          {/* 패널 제목 */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            borderBottom: `1px solid ${borderColor}`,
            paddingBottom: 14,
          }}>
            <div style={{
              width: 10, height: 10, borderRadius: '50%',
              background: t.accent, flexShrink: 0,
            }} />
            <span style={{ fontSize: 20, fontWeight: 700, fontFamily: bodyFont, color: t.muted }}>
              {rightPanelTitle}
            </span>
          </div>
          {/* 로딩 바들 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {barWidths.map((w, i) => {
              const barDelay = 20 + i * 12;
              const barProgress = interpolate(frame, [barDelay, barDelay + 30], [0, w], { extrapolateRight: 'clamp' });
              return (
                <div key={i} style={{
                  height: 14, borderRadius: 7,
                  background: t.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%', borderRadius: 7,
                    width: `${barProgress * 100}%`,
                    background: i % 2 === 0
                      ? `linear-gradient(90deg, ${t.accent}, ${t.accent}88)`
                      : `linear-gradient(90deg, ${t.accent2 || t.accent}88, ${t.accent2 || t.accent}44)`,
                  }} />
                </div>
              );
            })}
          </div>
          {/* 완료 메시지 */}
          {panelReady && (
            <div style={{
              fontSize: 20, fontWeight: 600, fontFamily: bodyFont,
              color: t.accent,
              opacity: interpolate(frame, [40, 55], [0, 1], { extrapolateRight: 'clamp' }),
            }}>
              → {scene.slideData?.summary || '처리 완료...'}
            </div>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─── CHAT WINDOW 레이아웃 ─────────────────────────────────────────────────────
const ChatWindowLayout: React.FC<{ scene: SceneType; slideIndex: number; bodyFont: string }> = ({ scene, slideIndex, bodyFont }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = getTheme(scene.pptTheme, slideIndex);
  const p = t.isColorful ? pal(slideIndex) : null;

  const promptText = scene.slideData?.title || '';
  const modelLabel = scene.slideData?.bullets?.[0] || 'Opus 4.5 · Agent';

  // 윈도우 진입 애니메이션
  const windowEnter = spring({ frame, fps, config: { damping: 20, stiffness: 120 }, durationInFrames: 30 });
  const windowY = interpolate(windowEnter, [0, 1], [60, 0]);
  const windowOpacity = interpolate(windowEnter, [0, 1], [0, 1]);

  // 타이핑: 8프레임 딜레이 후 1.5프레임/글자
  const TYPING_DELAY = 15;
  const CHARS_PER_FRAME = 0.9;
  const typeFrame = Math.max(0, frame - TYPING_DELAY);
  const charsToShow = Math.min(promptText.length, Math.floor(typeFrame * CHARS_PER_FRAME));
  const typedText = promptText.slice(0, charsToShow);
  const isTyping = charsToShow < promptText.length;
  const showCursor = isTyping || Math.floor(frame / 18) % 2 === 0;

  // 하이라이트: /word 패턴을 accent 색으로
  function renderPromptText(text: string) {
    const parts = text.split(/(\s\/\S+|\s\*\S+\*)/g);
    return parts.map((part, i) => {
      const isCmd = /^\s\//.test(part);
      const trimmed = part.trimStart();
      return (
        <span key={i}>
          {part.startsWith(' ') && !isCmd ? ' ' : ''}
          {isCmd ? (
            <span style={{
              backgroundColor: t.isColorful ? `${p?.accent}33` : 'rgba(99,102,241,0.25)',
              color: t.isColorful ? p?.accent : '#818cf8',
              borderRadius: 4, padding: '1px 5px',
              fontWeight: 600,
            }}>{trimmed}</span>
          ) : part}
        </span>
      );
    });
  }

  const bgColor = t.isColorful ? t.bg : '#1a1a1a';
  const windowBg = t.isColorful ? `${t.bg}dd` : '#212121';
  const borderColor = t.isColorful ? `${p?.accent}44` : 'rgba(255,255,255,0.1)';
  const accentColor = t.isColorful ? (p?.accent ?? '#818cf8') : '#818cf8';

  return (
    <AbsoluteFill style={{ background: bgColor, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', display: 'flex' }}>
      {scene.audioUrl && <Audio src={scene.audioUrl} />}
      {p && <BgShapes p={p} frame={frame} fps={fps} />}

      {/* 배경 그라디언트 글로우 */}
      <div style={{
        position: 'absolute', inset: 0,
        background: t.isColorful
          ? `radial-gradient(ellipse 70% 50% at 50% 50%, ${p?.accent}15 0%, transparent 70%)`
          : 'radial-gradient(ellipse 70% 50% at 50% 50%, rgba(99,102,241,0.08) 0%, transparent 70%)',
      }} />

      {/* 맥OS 윈도우 */}
      <div style={{
        width: 820,
        borderRadius: 14,
        border: `1px solid ${borderColor}`,
        background: windowBg,
        boxShadow: t.isColorful
          ? `0 40px 80px rgba(0,0,0,0.6), 0 0 0 1px ${p?.accent}22, inset 0 1px 0 rgba(255,255,255,0.06)`
          : '0 40px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.06), inset 0 1px 0 rgba(255,255,255,0.05)',
        transform: `translateY(${windowY}px)`,
        opacity: windowOpacity,
        overflow: 'hidden',
        fontFamily: "'SF Pro Text', 'Inter', 'Pretendard', system-ui, sans-serif",
      }}>
        {/* 타이틀바 */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '14px 18px',
          borderBottom: `1px solid ${borderColor}`,
          background: 'rgba(255,255,255,0.02)',
        }}>
          {/* 신호등 버튼 */}
          <div style={{ display: 'flex', gap: 7, marginRight: 10 }}>
            {['#ff5f57', '#febc2e', '#28c840'].map((color, i) => (
              <div key={i} style={{ width: 13, height: 13, borderRadius: '50%', background: color, opacity: 0.9 }} />
            ))}
          </div>
          {/* New Chat 탭 */}
          <div style={{
            fontSize: 13, color: 'rgba(255,255,255,0.55)',
            background: 'rgba(255,255,255,0.07)',
            padding: '4px 14px', borderRadius: 7,
            border: '1px solid rgba(255,255,255,0.1)',
          }}>
            New Chat
          </div>
        </div>

        {/* 채팅 본문 영역 */}
        <div style={{ minHeight: 80, padding: '24px 20px 8px' }} />

        {/* 입력창 */}
        <div style={{
          margin: '0 16px 14px',
          border: `1.5px solid ${t.isColorful ? `${p?.accent}55` : 'rgba(255,255,255,0.14)'}`,
          borderRadius: 10,
          background: 'rgba(255,255,255,0.04)',
          overflow: 'hidden',
        }}>
          {/* 텍스트 입력 영역 */}
          <div style={{
            padding: '14px 16px 10px',
            fontSize: 15,
            color: 'rgba(255,255,255,0.88)',
            lineHeight: 1.6,
            minHeight: 52,
            wordBreak: 'break-word',
          }}>
            {renderPromptText(typedText)}
            {showCursor && (
              <span style={{
                display: 'inline-block', width: 2, height: '1em',
                background: accentColor, marginLeft: 1,
                verticalAlign: 'text-bottom',
                borderRadius: 1,
              }} />
            )}
          </div>

          {/* 하단 툴바 */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 14px 10px',
            borderTop: `1px solid rgba(255,255,255,0.06)`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {/* Agent 뱃지 */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 5,
                fontSize: 12, color: 'rgba(255,255,255,0.5)',
                background: 'rgba(255,255,255,0.07)',
                padding: '3px 10px', borderRadius: 6,
                border: '1px solid rgba(255,255,255,0.1)',
              }}>
                <span style={{ fontSize: 10 }}>∞</span>
                <span>Agent</span>
                <span style={{ opacity: 0.4, fontSize: 10 }}>›</span>
              </div>
              {/* 모델 뱃지 */}
              <div style={{
                fontSize: 12, color: 'rgba(255,255,255,0.4)',
                background: 'rgba(255,255,255,0.05)',
                padding: '3px 10px', borderRadius: 6,
                border: '1px solid rgba(255,255,255,0.08)',
              }}>
                {modelLabel}
              </div>
            </div>
            {/* 전송 버튼 */}
            <div style={{
              width: 30, height: 30, borderRadius: 8,
              background: charsToShow >= promptText.length ? accentColor : 'rgba(255,255,255,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.3s',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M12 4l8 8-8 8M4 12h16" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        </div>

        {/* 하단 Local 라벨 */}
        <div style={{
          padding: '6px 20px 12px',
          fontSize: 11, color: 'rgba(255,255,255,0.25)',
          display: 'flex', alignItems: 'center', gap: 5,
        }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" />
            <path d="M9 9h6M9 12h6M9 15h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          Local
        </div>
      </div>

      {/* 슬라이드 번호 (컬러풀만) */}
      {t.isColorful && (
        <div style={{
          position: 'absolute', top: 60, left: 80,
          fontSize: 13, fontWeight: 700, letterSpacing: '0.2em',
          color: p?.accent, textTransform: 'uppercase', opacity: windowEnter,
        }}>
          {String(slideIndex + 1).padStart(2, '0')} / SLIDE
        </div>
      )}
    </AbsoluteFill>
  );
};

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────
export const SlideSceneComponent: React.FC<SlideSceneProps> = ({ scene, slideIndex, fontFamily }) => {
  // PPT 본문은 자막 폰트 설정을 따르지 않고 가독성 높은 기본 폰트(Pretendard 등)를 고정 사용함
  const bodyFont = "'Pretendard', 'Noto Sans KR', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";
  const layout = scene.slideData?.layout ?? 'title';

  const hasBullets = (scene.slideData?.bullets?.length ?? 0) > 0;
  const hasStats = (scene.slideData?.stats?.length ?? 0) > 0;
  const hasComparison = !!scene.slideData?.comparisonData;

  const renderLayout = () => {
    // 데이터 없으면 안전한 레이아웃으로 자동 대체
    if (layout === 'bullets') {
      return hasBullets
        ? <BulletsLayout scene={scene} slideIndex={slideIndex} bodyFont={bodyFont} />
        : <TitleLayout scene={scene} slideIndex={slideIndex} bodyFont={bodyFont} />;
    }
    if (layout === 'quote') {
      return <QuoteLayout scene={scene} slideIndex={slideIndex} bodyFont={bodyFont} />;
    }
    if (layout === 'comparison') {
      return hasComparison
        ? <ComparisonLayout scene={scene} slideIndex={slideIndex} bodyFont={bodyFont} />
        : <BulletsLayout scene={scene} slideIndex={slideIndex} bodyFont={bodyFont} />;
    }
    if (layout === 'bigword') {
      return <BigWordLayout scene={scene} slideIndex={slideIndex} bodyFont={bodyFont} />;
    }
    if (layout === 'boxlist') {
      return hasBullets
        ? <BoxListLayout scene={scene} slideIndex={slideIndex} bodyFont={bodyFont} />
        : <TitleLayout scene={scene} slideIndex={slideIndex} bodyFont={bodyFont} />;
    }
    if (layout === 'statcard') {
      return hasStats
        ? <StatCardLayout scene={scene} slideIndex={slideIndex} bodyFont={bodyFont} />
        : hasBullets
          ? <BoxListLayout scene={scene} slideIndex={slideIndex} bodyFont={bodyFont} />
          : <TitleLayout scene={scene} slideIndex={slideIndex} bodyFont={bodyFont} />;
    }
    if (layout === 'timeline') {
      return hasBullets
        ? <TimelineLayout scene={scene} slideIndex={slideIndex} bodyFont={bodyFont} />
        : <TitleLayout scene={scene} slideIndex={slideIndex} bodyFont={bodyFont} />;
    }
    if (layout === 'icongrid') {
      return hasBullets
        ? <IconGridLayout scene={scene} slideIndex={slideIndex} bodyFont={bodyFont} />
        : <TitleLayout scene={scene} slideIndex={slideIndex} bodyFont={bodyFont} />;
    }
    if (layout === 'progress') {
      return hasBullets
        ? <ProgressLayout scene={scene} slideIndex={slideIndex} bodyFont={bodyFont} />
        : <TitleLayout scene={scene} slideIndex={slideIndex} bodyFont={bodyFont} />;
    }
    if (layout === 'chatwindow') {
      return <ChatWindowLayout scene={scene} slideIndex={slideIndex} bodyFont={bodyFont} />;
    }
    if (layout === 'dialogsplit') {
      return <DialogSplitLayout scene={scene} slideIndex={slideIndex} bodyFont={bodyFont} />;
    }
    return <TitleLayout scene={scene} slideIndex={slideIndex} bodyFont={bodyFont} />;
  };

  return (
    <AbsoluteFill style={{ zIndex: 999 }}>
      <AbsoluteFill style={{ zIndex: 1 }}>
        {renderLayout()}
      </AbsoluteFill>
      <AbsoluteFill style={{ zIndex: 10, pointerEvents: 'none' }}>
        <SubtitleOverlay
          subtitles={scene.subtitles}
          style={scene.textAnimationStyle}
          position={scene.textPosition || 'bottom'}
          fontFamily={fontFamily}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
