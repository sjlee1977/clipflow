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
          margin: '180px auto 0', // 제목과의 간격 대폭 확대
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
        paddingTop: 200, // 더 과감하게 상단에서 시작 (240 -> 200으로 살짝 올려서 전체 높이 확보)
        zIndex: 1,
      }}>
      <div style={{ padding: t.isColorful ? '0 160px' : '0 140px', width: '100%', textAlign: 'center' }}>
        {/* 제목 */}
        <div style={{
          fontSize: 72, // 상향 (62 -> 72)
          fontWeight: 900, // 최상위 굵기 (Black)
          fontFamily: bodyFont,
          color: t.isColorful ? t.accent : t.title,
          lineHeight: 1.2,
          letterSpacing: '-0.02em',
          marginBottom: 240, // 160 -> 240 (제목-내용 간격 대폭 확대)
          opacity: titleOpacity,
          transform: `translateY(${interpolate(titleX, [-40, 0], [20, 0])}px)`,
        }}>
          {renderHighlighted(scene.slideData?.title || '', t.isColorful ? t.accent2 : t.accent, {
            fontSize: 72, fontWeight: 900, fontFamily: bodyFont, lineHeight: 1.2,
            color: t.isColorful ? t.accent : t.title,
          })}
        </div>

        {/* 구분선 */}
        <div style={{
          width: 56, height: 4,
          background: t.line, borderRadius: 2,
          margin: '0 auto 240px', // 구분선 하단 간격 대폭 확대 (180 -> 240)
          transform: `scaleX(${lineScale})`, transformOrigin: 'center',
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
            rowGap: 120, // 항목 간 간격 극대화 (80 -> 120)
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

            return (
              <React.Fragment key={si}>
                {/* 단계 카드 */}
                <div style={{
                  flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20,
                  opacity: ss,
                  transform: `translateY(${interpolate(ss, [0, 1], [40, 0])}px)`,
                }}>
                  {/* 번호 원 */}
                  <div style={{
                    width: 80, height: 80, borderRadius: '50%',
                    background: `${color}cc`,
                    border: `3px solid ${color}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: `0 0 20px ${color}55`,
                    transform: `scale(${interpolate(ss, [0, 1], [0.5, 1])})`,
                  }}>
                    <span style={{ fontSize: 34, fontWeight: 900, color: '#000', fontFamily: bodyFont }}>
                      {si + 1}
                    </span>
                  </div>
                  {/* 텍스트 박스 */}
                  <div style={{
                    background: t.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                    borderRadius: 16,
                    border: `1.5px solid ${color}44`,
                    padding: '20px 16px',
                    textAlign: 'center', width: '100%',
                  }}>
                    <div style={{
                      fontSize: steps.length <= 3 ? 30 : 24,
                      fontWeight: 700, fontFamily: bodyFont,
                      color: t.body, lineHeight: 1.4,
                    }}>
                      {step}
                    </div>
                  </div>
                </div>

                {/* 화살표 연결 */}
                {!isLast && (
                  <div style={{
                    width: 40, flexShrink: 0, display: 'flex', alignItems: 'flex-start',
                    paddingTop: 28, justifyContent: 'center',
                    opacity: interpolate(frame, [delay + 10, delay + 25], [0, 1], { extrapolateRight: 'clamp' }),
                  }}>
                    <div style={{
                      fontSize: 28, color: t.muted, fontWeight: 900,
                    }}>→</div>
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* 하단 진행 바 */}
        <div style={{
          marginTop: 60, width: '100%', height: 6,
          background: t.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
          borderRadius: 3, overflow: 'hidden',
        }}>
          <div style={{
            height: '100%', borderRadius: 3,
            background: `linear-gradient(90deg, ${boxColors[0]}, ${boxColors[Math.min(steps.length - 1, boxColors.length - 1)]})`,
            width: `${interpolate(frame, [10, 10 + steps.length * 20], [0, 100], { extrapolateRight: 'clamp' })}%`,
          }} />
        </div>
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
// 스크린샷 스타일: 둥근 박스에 텍스트, 좌측 컬러 테두리 강조
const BoxListLayout: React.FC<{ scene: SceneType; slideIndex: number; bodyFont: string }> = ({ scene, slideIndex, bodyFont }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = getTheme(scene.pptTheme, slideIndex);
  const p = t.isColorful ? pal(slideIndex) : null;
  const bullets = scene.slideData?.bullets ?? [];

  const titleS = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 25 });
  const titleOpacity = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: 'clamp' });

  // 박스별 색상 사이클
  const boxColors = p
    ? [p.accent, p.accent2, '#ff79c6', '#50fa7b', '#ffb86c']
    : [t.accent, t.accent2 || '#ff6b6b', '#00d4ff', '#06ffa5', '#f7c948'];

  return (
    <AbsoluteFill style={{ background: t.bg, overflow: 'hidden' }}>
      {scene.audioUrl && <Audio src={scene.audioUrl} />}
      {p && <BgShapes p={p} frame={frame} fps={fps} />}

      <div style={{
        position: 'absolute', inset: 0, zIndex: 1,
        display: 'flex', flexDirection: 'column',
        padding: '180px 100px 60px',
      }}>
        {/* 헤더 박스 (제목을 colored box로) */}
        <div style={{
          alignSelf: 'flex-start',
          background: t.isColorful ? `${p?.accent}22` : `${t.accent}18`,
          border: `2px solid ${t.accent}`,
          borderRadius: 14,
          padding: '18px 36px',
          marginBottom: 60,
          opacity: titleOpacity,
          transform: `translateY(${interpolate(titleS, [0, 1], [-20, 0])}px)`,
        }}>
          <div style={{
            fontSize: 40, fontWeight: 800, fontFamily: bodyFont,
            color: t.accent, letterSpacing: '-0.01em',
          }}>
            {scene.slideData?.title || ''}
          </div>
        </div>

        {/* 아이템 박스들 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28, flex: 1 }}>
          {bullets.map((bullet, bi) => {
            const delay = 15 + bi * 12;
            const bs = spring({ frame: Math.max(0, frame - delay), fps, config: { damping: 18, stiffness: 130 }, durationInFrames: 30 });
            const bOpacity = interpolate(frame, [delay, delay + 15], [0, 1], { extrapolateRight: 'clamp' });
            const color = boxColors[bi % boxColors.length];

            return (
              <div key={bi} style={{
                display: 'flex', alignItems: 'stretch',
                opacity: bOpacity,
                transform: `translateX(${interpolate(bs, [0, 1], [-60, 0])}px)`,
              }}>
                {/* 좌측 컬러 바 */}
                <div style={{
                  width: 6, borderRadius: '6px 0 0 6px',
                  background: color, flexShrink: 0,
                  transform: `scaleY(${bs})`, transformOrigin: 'top',
                }} />
                {/* 박스 본체 */}
                <div style={{
                  flex: 1,
                  background: t.isDark ? 'rgba(255,255,255,0.05)' : t.isColorful ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.04)',
                  border: `1px solid ${color}33`,
                  borderLeft: 'none',
                  borderRadius: '0 14px 14px 0',
                  padding: '22px 32px',
                  display: 'flex', alignItems: 'center', gap: 20,
                }}>
                  {/* 인덱스 번호 (작게, 박스 안에) */}
                  <div style={{
                    width: 36, height: 36, borderRadius: 8,
                    background: `${color}22`, border: `2px solid ${color}55`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <span style={{ fontSize: 16, fontWeight: 800, color, fontFamily: bodyFont }}>
                      {String(bi + 1).padStart(2, '0')}
                    </span>
                  </div>
                  {/* 텍스트 */}
                  <div style={{
                    fontSize: 38, fontWeight: 600, fontFamily: bodyFont,
                    color: t.body, lineHeight: 1.45,
                  }}>
                    {renderHighlighted(bullet, color, {
                      fontSize: 38, fontWeight: 600, fontFamily: bodyFont,
                      lineHeight: 1.45, color: t.body,
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
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
        padding: '240px 100px 60px', // 상단 여백 통일
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
          marginBottom: 140, // 간격 확대 (100 -> 140)
          opacity: titleOpacity,
        }}>
          {renderHighlighted(scene.slideData?.title || '', t.accent, { fontSize: 54, fontWeight: 800, fontFamily: bodyFont })}
        </div>

        <div style={{ display: 'flex', gap: 60, flex: 1, alignItems: 'stretch' }}>
          {/* 왼쪽 박스 */}
          <div style={{
            flex: 1,
            background: t.isDark ? 'rgba(255,255,255,0.06)' : t.isColorful ? 'rgba(255,255,255,0.08)' : 'rgba(37,99,235,0.04)',
            borderRadius: 20,
            border: `3px solid ${t.accent}`,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            transform: `translateX(${interpolate(leftSlide, [0, 1], [-100, 0])}px)`,
            opacity: leftSlide,
          }}>
            {/* 컬러 헤더 박스 */}
            <div style={{
              background: t.accent,
              padding: '20px 32px',
              display: 'flex', alignItems: 'center', gap: 14,
            }}>
              <span style={{ fontSize: 26, color: '#fff' }}>✓</span>
              <span style={{ fontSize: 34, fontWeight: 900, color: '#fff', fontFamily: bodyFont }}>
                {data.leftTitle}
              </span>
            </div>
            {/* 아이템들 */}
            <div style={{ display: 'flex', flexDirection: 'column', padding: '24px 32px', gap: 22 }}>
              {data.leftItems.map((item, i) => {
                const itemEntry = spring({ frame: Math.max(0, frame - 30 - i * 10), fps, config: { damping: 18, stiffness: 130 } });
                // 아이템마다 다른 색상
                const itemColors = t.isDark || t.isColorful
                  ? [t.accent, t.accent2 || '#06ffa5', '#f7c948', '#ff79c6']
                  : ['#2563eb', '#059669', '#d97706', '#dc2626'];
                const itemColor = itemColors[i % itemColors.length];
                return (
                  <div key={i} style={{
                    fontSize: 36, fontFamily: bodyFont,
                    fontWeight: 700, lineHeight: 1.4,
                    color: itemColor,
                    opacity: itemEntry,
                    transform: `translateX(${interpolate(itemEntry, [0, 1], [28, 0])}px)`,
                  }}>
                    {item}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 오른쪽 박스 */}
          <div style={{
            flex: 1,
            background: t.isDark ? 'rgba(255,255,255,0.06)' : t.isColorful ? 'rgba(255,255,255,0.08)' : 'rgba(220,38,38,0.04)',
            borderRadius: 20,
            border: `3px solid ${t.accent2 || '#ff6b6b'}`,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            transform: `translateX(${interpolate(rightSlide, [0, 1], [100, 0])}px)`,
            opacity: rightSlide,
          }}>
            {/* 컬러 헤더 박스 (다른 색) */}
            <div style={{
              background: t.accent2 || '#ff6b6b',
              padding: '20px 32px',
              display: 'flex', alignItems: 'center', gap: 14,
            }}>
              <span style={{ fontSize: 26, color: '#fff' }}>✗</span>
              <span style={{ fontSize: 34, fontWeight: 900, color: '#fff', fontFamily: bodyFont }}>
                {data.rightTitle}
              </span>
            </div>
            {/* 아이템들 */}
            <div style={{ display: 'flex', flexDirection: 'column', padding: '24px 32px', gap: 22 }}>
              {data.rightItems.map((item, i) => {
                const itemEntry = spring({ frame: Math.max(0, frame - 40 - i * 10), fps, config: { damping: 18, stiffness: 130 } });
                const itemColors = t.isDark || t.isColorful
                  ? [t.accent2 || '#ff6b6b', '#ff79c6', '#ffb86c', t.accent]
                  : ['#dc2626', '#9333ea', '#d97706', '#0891b2'];
                const itemColor = itemColors[i % itemColors.length];
                return (
                  <div key={i} style={{
                    fontSize: 36, fontFamily: bodyFont,
                    fontWeight: 700, lineHeight: 1.4,
                    color: itemColor,
                    opacity: itemEntry,
                    transform: `translateX(${interpolate(itemEntry, [0, 1], [-28, 0])}px)`,
                  }}>
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
