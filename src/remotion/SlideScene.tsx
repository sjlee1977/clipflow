import React from 'react';
import {
  AbsoluteFill, Audio, Sequence,
  spring, interpolate, Easing,
  useCurrentFrame, useVideoConfig,
} from 'remotion';
import { Lottie } from '@remotion/lottie';
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
  { bg: '#050a15', grad: '#0a1428', accent: '#00ff88', accent2: '#00ccff', dot: '#00ff88' },
  { bg: '#150510', grad: '#280a1e', accent: '#ff0077', accent2: '#aa00ff', dot: '#ff0077' },
];

function pal(idx: number) {
  return PALETTES[idx % PALETTES.length];
}

// 다크 테마용 BgShapes 팔레트 (배경 장식 활성화)
function darkPal(slideIndex: number) {
  const dv = DARK_VARIANTS[slideIndex % DARK_VARIANTS.length];
  return {
    bg: '#0d0d0d', grad: '#1a1a1a',
    accent: dv.accent, accent2: dv.accent2 ?? dv.accent, dot: dv.accent,
  };
}

// 레이아웃 컴포넌트에서 팔레트 가져오기 (다크 테마도 BgShapes 표시)
function getPal(theme: ReturnType<typeof getTheme>, slideIndex: number) {
  if (theme.isColorful) return pal(slideIndex);
  if (theme.isDark) return darkPal(slideIndex);
  return null;
}

// ─── 테마 스타일 ──────────────────────────────────────────────────────────────
// 다크 테마 슬라이드별 배경 + 액센트 변주 (각 슬라이드가 시각적으로 달라 보임)
const DARK_VARIANTS = [
  { bg: 'linear-gradient(145deg, #0d0d0d 0%, #1a0f00 100%)', accent: '#f97316', accent2: '#fde68a' }, // 오렌지
  { bg: 'linear-gradient(145deg, #030d1a 0%, #061428 100%)', accent: '#38bdf8', accent2: '#7dd3fc' }, // 스카이블루
  { bg: 'linear-gradient(145deg, #0a0d03 0%, #141f06 100%)', accent: '#84cc16', accent2: '#bef264' }, // 라임
  { bg: 'linear-gradient(145deg, #0d0314 0%, #1a0628 100%)', accent: '#c084fc', accent2: '#e9d5ff' }, // 퍼플
  { bg: 'linear-gradient(145deg, #0d0303 0%, #280606 100%)', accent: '#f87171', accent2: '#fca5a5' }, // 레드
  { bg: 'linear-gradient(145deg, #00100d 0%, #001f1a 100%)', accent: '#2dd4bf', accent2: '#99f6e4' }, // 틸
  { bg: 'linear-gradient(145deg, #0d0a00 0%, #1f1800 100%)', accent: '#fbbf24', accent2: '#fde68a' }, // 앰버
  { bg: 'linear-gradient(145deg, #030d0d 0%, #061a1a 100%)', accent: '#22d3ee', accent2: '#a5f3fc' }, // 시안
  { bg: 'linear-gradient(145deg, #0a000d 0%, #150020 100%)', accent: '#e879f9', accent2: '#f5d0fe' }, // 핑크
  { bg: 'linear-gradient(145deg, #000d06 0%, #001a0f 100%)', accent: '#4ade80', accent2: '#bbf7d0' }, // 그린
];

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
  // dark — 슬라이드 인덱스마다 배경과 액센트 색을 다르게 배정
  const dv = DARK_VARIANTS[slideIndex % DARK_VARIANTS.length];
  return {
    isColorful: false,
    isDark: true,
    bg: dv.bg,
    title: '#ffffff',
    body: '#dddddd',
    accent: dv.accent,
    accent2: dv.accent2,
    dot: dv.accent,
    line: dv.accent,
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
const BgShapes: React.FC<{ p: ReturnType<typeof pal>; frame: number; fps: number; slideIndex: number }> = ({ p, frame, fps, slideIndex }) => {
  const s = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 40 });
  const rot = interpolate(frame, [0, 300], [0, 360], { extrapolateRight: 'clamp' });
  const pulse = interpolate(
    frame % 60, [0, 30, 60], [1, 1.05, 1],
    { extrapolateRight: 'clamp', easing: Easing.inOut(Easing.sin) }
  );
  
  // 슬라이드 인덱스에 따라 도형 배치 변형
  const variant = slideIndex % 3;

  return (
    <>
      {/* 부유하는 빛 무리 (Blob) */}
      <div style={{
        position: 'absolute', top: variant === 0 ? '-10%' : '60%', left: variant === 1 ? '-10%' : '70%',
        width: 800, height: 800, borderRadius: '50%',
        background: `radial-gradient(circle, ${p.accent}15 0%, transparent 70%)`,
        filter: 'blur(80px)',
        transform: `scale(${s * pulse}) translate(${Math.sin(frame * 0.02) * 50}px, ${Math.cos(frame * 0.02) * 50}px)`,
        opacity: 0.6,
      }} />
      <div style={{
        position: 'absolute', top: variant === 2 ? '-10%' : '20%', left: variant === 0 ? '50%' : '10%',
        width: 600, height: 600, borderRadius: '50%',
        background: `radial-gradient(circle, ${p.accent2}12 0%, transparent 70%)`,
        filter: 'blur(60px)',
        transform: `scale(${s}) translate(${Math.cos(frame * 0.015) * 40}px, ${Math.sin(frame * 0.015) * 40}px)`,
        opacity: 0.5,
      }} />

      {/* 오른쪽 상단 큰 원 */}
      <div style={{
        position: 'absolute', top: -200, right: -200,
        width: 560, height: 560, borderRadius: '50%',
        background: `radial-gradient(circle, ${p.accent}22 0%, transparent 70%)`,
        transform: `scale(${s * pulse})`,
      }} />
      {/* 회전 사각형 */}
      <div style={{
        position: 'absolute', 
        top: variant === 0 ? 100 : 600, 
        right: variant === 1 ? 100 : 800,
        width: 120, height: 120,
        border: `2px solid ${p.accent}44`,
        borderRadius: 20,
        transform: `rotate(${rot + slideIndex * 45}deg) scale(${s})`,
      }} />
      {/* 작은 점들 - 파티클 느낌 */}
      {[...Array(6)].map((_, i) => (
        <div key={i} style={{
          position: 'absolute',
          top: (200 + i * 150 + slideIndex * 100) % 1000,
          left: (100 + i * 250 + slideIndex * 50) % 1800,
          width: 6, height: 6, borderRadius: '50%',
          background: i % 2 === 0 ? p.accent : p.accent2,
          opacity: interpolate(s, [0.5, 1], [0, 0.4]),
          transform: `translateY(${Math.sin(frame * 0.05 + i) * 20}px)`,
        }} />
      ))}
      {/* 상단 가로 라인 */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 4,
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
  const p = getPal(t, slideIndex);
  const align = scene.slideData?.align || 'center';
  const variant = scene.slideData?.variant || 'default';

  const lineScale = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 30 });
  const titleText = scene.slideData?.title || '';
  const typeFrame = Math.max(0, frame - 8);
  const charsToShow = Math.floor(typeFrame * 1.8);
  const typedText = titleText.slice(0, charsToShow);
  const showCursor = charsToShow < titleText.length;
  const titleOpacity = interpolate(frame, [8, 14], [0, 1], { extrapolateRight: 'clamp', easing: Easing.out(Easing.quad) });
  
  // 숨쉬는 효과 (Breathing scale)
  const breathe = interpolate(Math.sin(frame * 0.05), [-1, 1], [0.99, 1.01]);

  return (
    <AbsoluteFill style={{ background: t.bg, overflow: 'hidden' }}>
      {scene.audioUrl && <Audio src={scene.audioUrl} />}
      {p && <BgShapes p={p} frame={frame} fps={fps} slideIndex={slideIndex} />}

      {/* Dark 모드 전용 배경 장식 */}
      {t.isDark && (
        <div style={{
          position: 'absolute', left: 0, top: 0, width: 6, height: '100%',
          background: `linear-gradient(180deg, transparent 0%, ${t.accent} 30%, ${t.accent} 70%, transparent 100%)`,
          transform: `scaleY(${lineScale})`, transformOrigin: 'center',
        }} />
      )}

      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        display: 'flex', 
        alignItems: align === 'center' ? 'center' : 'center', 
        justifyContent: align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center',
        padding: align === 'center' ? '0' : '0 120px',
        zIndex: 1,
      }}>
        <div style={{ 
          textAlign: align, 
          padding: t.isColorful ? '0 160px' : '0 120px', 
          width: '100%',
          transform: `scale(${breathe})`,
        }}>
          {/* 배지/번호 효과 */}
          <div style={{
            fontSize: variant === 'point' ? 28 : 18, 
            fontWeight: 800, letterSpacing: '0.3em',
            color: t.accent, textTransform: 'uppercase',
            marginBottom: 28,
            opacity: lineScale,
            transform: `translateY(${(1 - lineScale) * 16}px)`,
            textShadow: variant === 'point' ? `0 0 20px ${t.accent}44` : 'none'
          }}>
            {variant === 'point' ? '✦ FEATURE POINT ✦' : `${String(slideIndex + 1).padStart(2, '0')} / SLIDE`}
          </div>

          {/* 제목 */}
          <div style={{
            fontSize: variant === 'point' ? 120 : 100, 
            fontWeight: 900, fontFamily: bodyFont,
            color: t.title, lineHeight: 1.15, letterSpacing: '-0.02em',
            opacity: titleOpacity,
            transform: variant === 'point' ? `scale(${interpolate(lineScale, [0, 1], [0.95, 1])})` : 'none'
          }}>
            {renderHighlighted(typedText, t.accent, {
              fontSize: variant === 'point' ? 120 : 100, fontWeight: 900, fontFamily: bodyFont, lineHeight: 1.15,
            })}
            {showCursor && (
              <span style={{
                display: 'inline-block', width: 4, height: '0.9em',
                background: t.accent, marginLeft: 4, verticalAlign: 'middle',
                opacity: Math.floor(frame / 8) % 2 === 0 ? 1 : 0,
              }} />
            )}
          </div>

          {/* 구분선 - 정렬에 따라 위치 조정 */}
          <div style={{
            width: variant === 'point' ? 240 : 100, 
            height: variant === 'point' ? 8 : 6,
            background: t.accent,
            margin: align === 'center' ? '50px auto 0' : align === 'left' ? '50px 0 0 0' : '50px 0 0 auto',
            borderRadius: 4,
            transform: `scaleX(${lineScale})`, transformOrigin: align,
            boxShadow: variant === 'point' ? `0 4px 20px ${t.accent}66` : 'none'
          }} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─── BULLETS 레이아웃 ─────────────────────────────────────────────────────────
// ─── BULLETS 레이아웃 ─────────────────────────────────────────────────────────
const BulletsLayout: React.FC<{ scene: SceneType; slideIndex: number; bodyFont: string }> = ({ scene, slideIndex, bodyFont }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = getTheme(scene.pptTheme, slideIndex);
  const p = getPal(t, slideIndex);
  const bullets = scene.slideData?.bullets ?? [];
  const align = scene.slideData?.align || 'left';
  const variant = scene.slideData?.variant || 'default';

  const lineScale = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 25 });
  const titleOpacity = interpolate(frame, [4, 22], [0, 1], { extrapolateRight: 'clamp', easing: Easing.out(Easing.quad) });
  const titleY = interpolate(frame, [4, 22], [-20, 0], { extrapolateRight: 'clamp' });
  
  const breathe = interpolate(Math.sin(frame * 0.05), [-1, 1], [0.998, 1.002]);

  return (
    <AbsoluteFill style={{ background: t.bg, overflow: 'hidden' }}>
      {scene.audioUrl && <Audio src={scene.audioUrl} />}
      {p && <BgShapes p={p} frame={frame} fps={fps} slideIndex={slideIndex} />}

      <div style={{
        position: 'absolute', inset: 0, zIndex: 1,
        display: 'flex', flexDirection: 'column',
        justifyContent: 'center',
        padding: '70px 100px',
        transform: `scale(${breathe})`,
      }}>
        {/* 제목 */}
        <div style={{
          marginBottom: 44,
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
          textAlign: align,
        }}>
          <div style={{
            fontSize: 62, fontWeight: 900, fontFamily: bodyFont,
            color: t.title, letterSpacing: '-0.02em', lineHeight: 1.2,
          }}>
            {renderHighlighted(scene.slideData?.title || '', t.accent, { fontSize: 62, fontWeight: 900, fontFamily: bodyFont })}
          </div>
          <div style={{
            marginTop: 10, height: 4, width: 60,
            background: t.accent, borderRadius: 2,
            margin: align === 'center' ? '12px auto 0' : align === 'left' ? '12px 0 0 0' : '12px 0 0 auto',
            transform: `scaleX(${lineScale})`, transformOrigin: align,
          }} />
        </div>

        {/* 불릿 목록 — 그리드 변형 지원 */}
        <div style={{ 
          display: variant === 'grid' ? 'grid' : 'flex',
          gridTemplateColumns: variant === 'grid' ? 'repeat(2, 1fr)' : 'none',
          flexDirection: variant === 'grid' ? 'row' : 'column',
          gap: 30,
        }}>
          {bullets.map((bullet, bi) => {
            const delay = 15 + bi * 10;
            const bOpacity = interpolate(frame, [delay, delay + 20], [0, 1], { extrapolateRight: 'clamp' });
            const s = spring({ frame: Math.max(0, frame - delay), fps, config: { damping: 18, stiffness: 130 } });

            return (
              <div key={bi} style={{
                background: variant === 'grid' ? 'rgba(255,255,255,0.05)' : 'transparent',
                borderRadius: 16,
                padding: variant === 'grid' ? '30px' : '0',
                border: variant === 'grid' ? '1px solid rgba(255,255,255,0.1)' : 'none',
                opacity: bOpacity,
                transform: `translateX(${interpolate(s, [0, 1], [30, 0])}px) scale(${s})`,
                display: 'flex', alignItems: 'center', gap: 20,
              }}>
                <div style={{
                  width: 12, height: 12, borderRadius: '50%',
                  background: t.accent, flexShrink: 0,
                  boxShadow: `0 0 10px ${t.accent}aa`,
                }} />
                <div style={{ fontSize: 38, fontWeight: 700, fontFamily: bodyFont, color: t.body, lineHeight: 1.4 }}>
                  {renderHighlighted(bullet, t.accent, { fontSize: 38, fontWeight: 700, fontFamily: bodyFont })}
                </div>
              </div>
            );
          })}
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
  const p = getPal(t, slideIndex);

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
      {p && <BgShapes p={p} frame={frame} fps={fps} slideIndex={slideIndex} />}

      {/* Dark 모드 전용 — 거대 인용 부호 배경 장식 */}
      {t.isDark && (
        <>
          <div style={{
            position: 'absolute', top: -60, left: 60,
            fontSize: 400, fontWeight: 900,
            color: `${t.accent}12`,
            fontFamily: 'Georgia, serif',
            lineHeight: 1,
            userSelect: 'none',
            transform: `scale(${interpolate(quoteMarkS, [0, 1], [0.5, 1])})`,
            transformOrigin: 'top left',
            opacity: quoteMarkS,
          }}>
            ❝
          </div>
          <div style={{
            position: 'absolute', bottom: -120, right: 60,
            fontSize: 400, fontWeight: 900,
            color: `${t.accent}08`,
            fontFamily: 'Georgia, serif',
            lineHeight: 1,
            userSelect: 'none',
          }}>
            ❞
          </div>
          {/* 좌측 accent 세로 바 */}
          <div style={{
            position: 'absolute', left: 0, top: '20%', height: '60%', width: 5,
            background: `linear-gradient(180deg, transparent, ${t.accent}, transparent)`,
            transform: `scaleY(${quoteMarkS})`, transformOrigin: 'center',
          }} />
        </>
      )}

      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1,
      }}>
      <div style={{ textAlign: 'center', padding: '0 160px', width: '100%' }}>
        {/* 인용 부호 아이콘 (small) */}
        {!t.isDark && (
          <div style={{
            width: 60, height: 5, background: t.line,
            margin: '0 auto 50px',
            borderRadius: 3,
            transform: `scaleX(${quoteMarkS})`, transformOrigin: 'center',
            opacity: quoteMarkS,
          }} />
        )}
        {t.isDark && (
          <div style={{
            fontSize: 52, color: t.accent,
            marginBottom: 24, opacity: quoteMarkS,
            fontFamily: 'Georgia, serif',
          }}>❝</div>
        )}

        {/* 인용 텍스트 */}
        <div style={{
          fontSize: t.isDark ? 54 : 48,
          fontWeight: 700,
          fontFamily: t.isDark ? bodyFont : "'Nanum Myeongjo', serif",
          color: t.isDark ? '#ffffff' : t.title,
          lineHeight: 1.65,
          opacity: textOpacity,
          transform: `scale(${textScale})`,
          fontStyle: t.isDark ? 'normal' : 'italic',
        }}>
          {renderHighlighted(scene.slideData?.title || '', t.accent, {
            fontSize: t.isDark ? 54 : 48, fontWeight: 700,
            lineHeight: 1.65,
          })}
        </div>

        {/* 하단 라인 */}
        <div style={{
          width: 90, height: 4, background: t.line,
          margin: '60px auto 0', borderRadius: 2,
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
  const p = getPal(t, slideIndex);
  const stats = scene.slideData?.stats ?? [];
  const boxColors = p
    ? [p.accent, p.accent2, '#ff79c6', '#50fa7b']
    : [t.accent, t.accent2 || '#00d4ff', '#06ffa5', '#f7c948'];

  const titleS = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 25 });
  const titleOpacity = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ background: t.bg, overflow: 'hidden' }}>
      {scene.audioUrl && <Audio src={scene.audioUrl} />}
      {p && <BgShapes p={p} frame={frame} fps={fps} slideIndex={slideIndex} />}
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
                flex: '1 1 240px', maxWidth: 300,
                background: `linear-gradient(145deg, ${color}30 0%, ${color}12 100%)`,
                borderRadius: 20,
                border: `2.5px solid ${color}80`,
                padding: '36px 28px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
                opacity: cs,
                transform: `translateY(${interpolate(cs, [0, 1], [60, 0])}px) scale(${interpolate(cs, [0, 1], [0.85, 1])})`,
                boxShadow: `0 8px 32px ${color}30, 0 2px 8px ${color}20, inset 0 1px 0 ${color}45`,
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
  const p = getPal(t, slideIndex);
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
      {p && <BgShapes p={p} frame={frame} fps={fps} slideIndex={slideIndex} />}

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
                    background: `linear-gradient(135deg, ${color}25 0%, ${color}0e 100%)`,
                    borderRadius: 14,
                    border: `2px solid ${color}65`,
                    padding: '14px 24px',
                    display: 'flex', alignItems: 'center', gap: 20,
                    boxShadow: `0 4px 18px ${color}20, inset 0 1px 0 ${color}30`,
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
  const p = getPal(t, slideIndex);
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
      {p && <BgShapes p={p} frame={frame} fps={fps} slideIndex={slideIndex} />}

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
                background: `linear-gradient(145deg, ${color}28 0%, ${color}10 100%)`,
                borderRadius: 18,
                border: `2px solid ${color}70`,
                padding: '28px 22px',
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: 14, textAlign: 'center',
                opacity: cs,
                transform: `scale(${interpolate(cs, [0, 1], [0.7, 1])}) translateY(${interpolate(cs, [0, 1], [30, 0])}px)`,
                boxShadow: `0 6px 24px ${color}25, inset 0 1px 0 ${color}35`,
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
  const p = getPal(t, slideIndex);
  const steps = scene.slideData?.bullets ?? [];
  const boxColors = p
    ? [p.accent, p.accent2, '#ff79c6', '#50fa7b', '#ffb86c']
    : [t.accent, t.accent2 || '#00d4ff', '#06ffa5', '#f7c948', '#ff79c6'];

  const titleS = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 25 });

  return (
    <AbsoluteFill style={{ background: t.bg, overflow: 'hidden' }}>
      {scene.audioUrl && <Audio src={scene.audioUrl} />}
      {p && <BgShapes p={p} frame={frame} fps={fps} slideIndex={slideIndex} />}

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
  const p = getPal(t, slideIndex);

  const word = scene.slideData?.title || '';
  const typeFrame = Math.max(0, frame - 10);
  const charsToShow = Math.floor(typeFrame * 2.5);
  const typedText = word.slice(0, charsToShow);
  const showCursor = charsToShow < word.length;

  const scaleS = spring({ frame: Math.max(0, frame - 3), fps, config: { damping: 18, stiffness: 120 }, durationInFrames: 40 });
  const iconsS = spring({ frame, fps, config: { damping: 20, stiffness: 100 }, durationInFrames: 30 });
  const sub = interpolate(frame, [35, 55], [0, 1], { extrapolateRight: 'clamp', easing: Easing.out(Easing.quad) });
  const subtitleText = scene.slideData?.bullets?.[0] ?? '';
  // 장식 아이콘: decorIcons 또는 bullets 2번째 이후 (공백 파싱)
  const decorIcons = scene.slideData?.decorIcons ?? [];
  const color = t.isColorful && p ? p.accent : t.accent;
  const color2 = t.isColorful && p ? p.accent2 : (t.accent2 || '#888888');

  return (
    <AbsoluteFill style={{ background: t.bg, overflow: 'hidden' }}>
      {scene.audioUrl && <Audio src={scene.audioUrl} />}
      {p && <BgShapes p={p} frame={frame} fps={fps} slideIndex={slideIndex} />}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', zIndex: 1,
        padding: '0 100px',
      }}>
        {/* 상단 장식 아이콘 행 */}
        {decorIcons.length > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 28,
            marginBottom: 48,
            opacity: iconsS,
            transform: `translateY(${interpolate(iconsS, [0, 1], [-30, 0])}px)`,
          }}>
            {decorIcons.map((icon, i) => {
              const iconColor = i % 2 === 0 ? color : color2;
              const size = i === Math.floor(decorIcons.length / 2) ? 68 : 52;
              return (
                <div key={i} style={{
                  width: size, height: size,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: size * 0.55,
                  color: iconColor,
                  opacity: i === Math.floor(decorIcons.length / 2) ? 1 : 0.55,
                }}>
                  {icon}
                </div>
              );
            })}
          </div>
        )}

        {/* Dark 모드 전용 — 라디얼 글로우 */}
        {t.isDark && (
          <div style={{
            position: 'absolute', inset: 0,
            background: `radial-gradient(ellipse 70% 50% at 50% 50%, ${t.accent}18 0%, transparent 65%)`,
            transform: `scale(${interpolate(scaleS, [0, 1], [0.5, 1])})`,
            opacity: interpolate(scaleS, [0, 1], [0, 1], { extrapolateRight: 'clamp' }),
          }} />
        )}

        {/* 대형 키워드 */}
        <div style={{
          fontSize: 118, fontWeight: 900, fontFamily: bodyFont,
          // dark 모드에서 accent 색상으로 텍스트 — TitleLayout과 차별화
          color: t.isDark ? t.accent : (t.isColorful ? t.accent : t.title),
          lineHeight: 1.1, textAlign: 'center', letterSpacing: '-0.03em',
          transform: `scale(${interpolate(scaleS, [0, 1], [0.7, 1])})`,
          opacity: interpolate(scaleS, [0, 0.3], [0, 1], { extrapolateRight: 'clamp' }),
          textShadow: t.isDark ? `0 0 60px ${t.accent}55` : 'none',
        }}>
          {renderHighlighted(typedText, t.accent2 || t.accent, {
            fontSize: 118, fontWeight: 900, fontFamily: bodyFont, lineHeight: 1.1,
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
            marginTop: 44, fontSize: 36, fontWeight: 500, fontFamily: bodyFont,
            color: t.isDark ? 'rgba(255,255,255,0.6)' : t.muted,
            textAlign: 'center', opacity: sub,
            transform: `translateY(${interpolate(sub, [0, 1], [20, 0])}px)`,
            letterSpacing: '0.02em',
          }}>
            {subtitleText}
          </div>
        )}
        {/* 하단 accent 라인 — dark 모드에서 더 두껍고 glow */}
        <div style={{
          marginTop: 52, width: interpolate(scaleS, [0, 1], [0, t.isDark ? 200 : 160]),
          height: t.isDark ? 3 : 5,
          background: t.isDark
            ? `linear-gradient(90deg, transparent, ${t.accent}, transparent)`
            : t.accent,
          borderRadius: 3,
          boxShadow: t.isDark ? `0 0 20px ${t.accent}88` : 'none',
        }} />
      </div>
    </AbsoluteFill>
  );
};

// ─── EQUATION 레이아웃 ────────────────────────────────────────────────────────
// A = B 방정식 스타일 비유 설명 (예: 치킨 가격 = 연예인 광고비)
const EquationLayout: React.FC<{ scene: SceneType; slideIndex: number; bodyFont: string }> = ({ scene, slideIndex, bodyFont }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = getTheme(scene.pptTheme, slideIndex);
  const p = getPal(t, slideIndex);
  const pairs = scene.slideData?.analogyData?.pairs ?? [];

  const titleS = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 25 });
  const titleOpacity = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: 'clamp' });

  const accentColors = p
    ? [p.accent, p.accent2, '#ff79c6', '#50fa7b']
    : [t.accent, t.accent2 || '#ff6b6b', '#06ffa5', '#f7c948'];

  const boxBg = t.isDark ? 'rgba(255,255,255,0.06)' : t.isColorful ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)';
  const boxBorder = t.isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.12)';

  return (
    <AbsoluteFill style={{ background: t.bg, overflow: 'hidden' }}>
      {scene.audioUrl && <Audio src={scene.audioUrl} />}
      {p && <BgShapes p={p} frame={frame} fps={fps} slideIndex={slideIndex} />}

      <div style={{
        position: 'absolute', inset: 0, zIndex: 1,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '80px 120px',
        gap: 0,
      }}>
        {/* 제목 */}
        {scene.slideData?.title && (
          <div style={{
            fontSize: 48, fontWeight: 900, fontFamily: bodyFont,
            color: t.isColorful ? t.accent : t.title,
            marginBottom: 56, textAlign: 'center',
            opacity: titleOpacity,
            transform: `translateY(${interpolate(titleS, [0, 1], [-20, 0])}px)`,
            letterSpacing: '-0.02em',
          }}>
            {scene.slideData.title}
          </div>
        )}

        {/* 방정식 쌍들 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0, width: '100%', maxWidth: 700 }}>
          {pairs.map((pair, pi) => {
            const delay = 10 + pi * 22;
            const rowS = spring({ frame: Math.max(0, frame - delay), fps, config: { damping: 20, stiffness: 110 }, durationInFrames: 30 });
            const accentColor = accentColors[pi % accentColors.length];

            return (
              <React.Fragment key={pi}>
                {/* 구분자 (첫 번째 쌍 이후) */}
                {pi > 0 && pair.connector && (
                  <div style={{
                    textAlign: 'center', padding: '14px 0',
                    fontSize: 22, fontWeight: 600, fontFamily: bodyFont,
                    color: t.muted, letterSpacing: '0.05em',
                    opacity: interpolate(frame, [delay - 10, delay], [0, 1], { extrapolateRight: 'clamp' }),
                  }}>
                    ↕ {pair.connector}
                  </div>
                )}

                {/* 방정식 행 */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 20,
                  opacity: rowS,
                  transform: `scale(${interpolate(rowS, [0, 1], [0.85, 1])}) translateY(${interpolate(rowS, [0, 1], [30, 0])}px)`,
                }}>
                  {/* 왼쪽 박스 (아이콘 + 라벨) */}
                  <div style={{
                    flex: 1,
                    background: boxBg,
                    borderRadius: 16,
                    border: `2px solid ${boxBorder}`,
                    padding: '24px 20px',
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', gap: 10,
                    boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                  }}>
                    <span style={{ fontSize: 42 }}>{pair.leftIcon}</span>
                    <span style={{
                      fontSize: 26, fontWeight: 700, fontFamily: bodyFont,
                      color: t.body, textAlign: 'center', lineHeight: 1.3,
                    }}>{pair.leftLabel}</span>
                  </div>

                  {/* = 기호 */}
                  <div style={{
                    fontSize: 44, fontWeight: 900, color: t.muted,
                    flexShrink: 0, width: 44, textAlign: 'center',
                    fontFamily: bodyFont,
                  }}>
                    =
                  </div>

                  {/* 오른쪽 박스 (결과 — accent 색상) */}
                  <div style={{
                    flex: 1,
                    background: `linear-gradient(135deg, ${accentColor}25 0%, ${accentColor}10 100%)`,
                    borderRadius: 16,
                    border: `2.5px solid ${accentColor}80`,
                    padding: '24px 20px',
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', gap: 6,
                    boxShadow: `0 4px 24px ${accentColor}25, inset 0 1px 0 ${accentColor}35`,
                  }}>
                    <span style={{
                      fontSize: 28, fontWeight: 900, fontFamily: bodyFont,
                      color: accentColor, textAlign: 'center', lineHeight: 1.3,
                      letterSpacing: '-0.01em',
                    }}>{pair.rightLabel}</span>
                    {pair.rightSub && (
                      <span style={{
                        fontSize: 20, fontWeight: 500, fontFamily: bodyFont,
                        color: t.muted, textAlign: 'center',
                      }}>{pair.rightSub}</span>
                    )}
                  </div>
                </div>
              </React.Fragment>
            );
          })}
        </div>

        {/* 하단 요약 */}
        {scene.slideData?.summary && (
          <div style={{
            marginTop: 52,
            fontSize: 28, fontWeight: 700, fontFamily: bodyFont,
            color: t.accent, textAlign: 'center',
            opacity: interpolate(frame, [pairs.length * 22 + 20, pairs.length * 22 + 40], [0, 1], { extrapolateRight: 'clamp' }),
            letterSpacing: '-0.01em',
          }}>
            → {scene.slideData.summary}
          </div>
        )}
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
  const p = getPal(t, slideIndex);
  const bullets = scene.slideData?.bullets ?? [];

  const titleOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });
  const titleY = interpolate(frame, [0, 20], [-16, 0], { extrapolateRight: 'clamp' });

  const accentColors = p
    ? [p.accent, p.accent2, '#ff79c6', '#50fa7b', '#ffb86c']
    : [t.accent, t.accent2 || '#06ffa5', '#f7c948', '#ff79c6', '#00d4ff'];

  return (
    <AbsoluteFill style={{ background: t.bg, overflow: 'hidden' }}>
      {scene.audioUrl && <Audio src={scene.audioUrl} />}
      {p && <BgShapes p={p} frame={frame} fps={fps} slideIndex={slideIndex} />}

      <div style={{
        position: 'absolute', inset: 0, zIndex: 1,
        display: 'flex', flexDirection: 'column',
        justifyContent: 'center',
        padding: '70px 100px',
      }}>
        {/* 상단 헤더 배지 */}
        {scene.slideData?.headerBadge && (
          <div style={{
            marginBottom: 24,
            opacity: titleOpacity,
            display: 'flex', justifyContent: 'center',
          }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 10,
              background: `linear-gradient(135deg, ${t.accent}30, ${t.accent}18)`,
              border: `2px solid ${t.accent}cc`,
              borderRadius: 40, padding: '10px 28px',
              boxShadow: `0 4px 20px ${t.accent}40, inset 0 1px 0 ${t.accent}50`,
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
          marginBottom: scene.slideData?.headerBadge ? 28 : 44,
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
                display: 'flex', alignItems: 'stretch', gap: 0,
                opacity: bOpacity,
                transform: `translateX(${interpolate(bs, [0, 1], [-50, 0])}px)`,
              }}>
                {/* 컬러 라인 바 — 두께 7px, 그라디언트 */}
                <div style={{
                  width: 7, alignSelf: 'stretch', minHeight: subText ? 72 : 60,
                  background: `linear-gradient(180deg, ${color} 0%, ${color}88 100%)`,
                  borderRadius: '4px 0 0 4px', flexShrink: 0,
                  transform: `scaleY(${bs})`, transformOrigin: 'top',
                  boxShadow: `2px 0 12px ${color}50`,
                }} />
                {/* 카드 본체 — 색상 있는 배경 + 입체 테두리 */}
                <div style={{
                  flex: 1,
                  background: `linear-gradient(135deg, ${color}28 0%, ${color}10 100%)`,
                  borderRadius: '0 10px 10px 0',
                  border: `1.5px solid ${color}70`,
                  borderLeft: 'none',
                  padding: subText ? '12px 24px' : '14px 24px',
                  display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4,
                  boxShadow: `0 4px 18px ${color}20, inset 0 1px 0 ${color}35`,
                }}>
                  {/* 메인 텍스트 */}
                  <div style={{
                    fontSize: subText ? 34 : 40, fontWeight: 800, fontFamily: bodyFont,
                    color: t.body, lineHeight: 1.3, letterSpacing: '-0.01em',
                  }}>
                    {renderHighlighted(mainText, color, {
                      fontSize: subText ? 34 : 40, fontWeight: 800, fontFamily: bodyFont,
                      lineHeight: 1.3, color: t.body,
                    })}
                  </div>
                  {/* 서브 텍스트 */}
                  {subText && (
                    <div style={{
                      fontSize: 21, fontWeight: 500, fontFamily: bodyFont,
                      color: color, lineHeight: 1.3, opacity: 0.8,
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
            marginTop: 28,
            display: 'flex', justifyContent: 'center',
            opacity: interpolate(frame, [bullets.length * 10 + 22, bullets.length * 10 + 40], [0, 1], { extrapolateRight: 'clamp' }),
          }}>
            <div style={{
              background: `linear-gradient(135deg, ${t.accent}22, ${t.accent}10)`,
              border: `2px solid ${t.accent}aa`,
              borderRadius: 30, padding: '10px 28px',
              fontSize: 22, fontWeight: 700, fontFamily: bodyFont,
              color: t.accent, letterSpacing: '-0.01em',
              boxShadow: `0 4px 16px ${t.accent}30`,
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
// ─── COMPARISON 레이아웃 (카드형 고도화) ───────────────────────────────────────
const ComparisonLayout: React.FC<{ scene: SceneType; slideIndex: number; bodyFont: string }> = ({ scene, slideIndex, bodyFont }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = getTheme(scene.pptTheme, slideIndex);
  const p = getPal(t, slideIndex);
  const data = scene.slideData?.comparisonData;

  const titleOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });
  const titleY = interpolate(frame, [0, 20], [-20, 0], { extrapolateRight: 'clamp' });

  if (!data) return <TitleLayout scene={scene} slideIndex={slideIndex} bodyFont={bodyFont} />;

  const vsScale = spring({ frame: Math.max(0, frame - 20), fps, config: { damping: 12, stiffness: 150 } });
  const vsRotate = interpolate(frame, [20, 100], [0, 360], { extrapolateRight: 'clamp' });
  const vsPulse = interpolate(Math.sin(frame * 0.1), [-1, 1], [0.95, 1.05]);

  return (
    <AbsoluteFill style={{ background: t.bg, overflow: 'hidden' }}>
      {scene.audioUrl && <Audio src={scene.audioUrl} />}
      {p && <BgShapes p={p} frame={frame} fps={fps} slideIndex={slideIndex} />}
      
      {/* 중앙 장식 라인 */}
      <div style={{
        position: 'absolute', top: '10%', left: '50%', transform: 'translateX(-50%)',
        width: 2, height: '80%', background: `linear-gradient(180deg, transparent, ${t.accent}44, transparent)`,
        opacity: interpolate(frame, [0, 20], [0, 1])
      }} />

      <div style={{
        position: 'absolute', inset: 0, zIndex: 5,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '60px 80px'
      }}>
        {/* 상단 제목 */}
        <div style={{
          marginBottom: 60, textAlign: 'center', 
          opacity: interpolate(frame, [0, 20], [0, 1]),
          transform: `translateY(${interpolate(frame, [0, 20], [-30, 0])}px)`
        }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: t.accent, letterSpacing: '0.2em', marginBottom: 12 }}>COMPARISON</div>
          <div style={{ fontSize: 72, fontWeight: 900, color: t.title, fontFamily: bodyFont }}>
            {renderHighlighted(scene.slideData?.title || '핵심 비교', t.accent, { fontSize: 72, fontWeight: 900, fontFamily: bodyFont })}
          </div>
        </div>

        <div style={{ 
          display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', 
          gap: 40, position: 'relative' 
        }}>
          {/* 왼쪽 카드 (기존/고정) */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 24 }}>
             <div style={{ 
               fontSize: 36, fontWeight: 800, color: t.isDark ? '#aaa' : '#666', marginBottom: 10,
               textAlign: 'center', opacity: interpolate(frame, [10, 25], [0, 1])
             }}>
               {data.leftTitle}
             </div>
             {data.leftItems.map((item, i) => {
               const s = spring({ frame: Math.max(0, frame - 15 - i * 8), fps, config: { damping: 15, stiffness: 120 } });
               return (
                 <div key={i} style={{
                   background: 'rgba(255,255,255,0.03)',
                   backdropFilter: 'blur(12px)',
                   borderRadius: 24,
                   border: `1.2px solid ${t.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}`,
                   padding: '24px 32px',
                   boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
                   transform: `translateX(${interpolate(s, [0, 1], [-40, 0])}px) scale(${s})`,
                   opacity: s,
                 }}>
                   <div style={{ fontSize: 32, fontWeight: 700, color: t.body, fontFamily: bodyFont }}>{item}</div>
                 </div>
               );
             })}
          </div>

          {/* 중앙 VS 배지 */}
          <div style={{ 
            width: 130, height: 130, borderRadius: '50%',
            background: `linear-gradient(135deg, ${t.accent}, ${t.accent2 || t.accent})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 48, fontWeight: 900, color: '#fff',
            boxShadow: `0 0 60px ${t.accent}77`,
            zIndex: 10, flexShrink: 0,
            transform: `scale(${vsScale * vsPulse}) rotate(${vsRotate}deg)`,
            opacity: vsScale
          }}>
            VS
          </div>

          {/* 오른쪽 카드 (변화/진실 - 강조형) */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 24 }}>
             <div style={{ 
               fontSize: 36, fontWeight: 800, color: t.accent, marginBottom: 10,
               textAlign: 'center', opacity: interpolate(frame, [15, 30], [0, 1])
             }}>
               {data.rightTitle}
             </div>
             {data.rightItems.map((item, i) => {
               const s = spring({ frame: Math.max(0, frame - 30 - i * 8), fps, config: { damping: 15, stiffness: 120 } });
               return (
                 <div key={i} style={{
                   background: `linear-gradient(135deg, ${t.accent}25 0%, ${t.accent}08 100%)`,
                   backdropFilter: 'blur(16px)',
                   borderRadius: 24,
                   border: `2px solid ${t.accent}66`,
                   padding: '24px 32px',
                   boxShadow: `0 15px 40px ${t.accent}22`,
                   transform: `translateX(${interpolate(s, [0, 1], [40, 0])}px) scale(${s})`,
                   opacity: s,
                   display: 'flex', alignItems: 'center', gap: 18
                 }}>
                   <div style={{ width: 12, height: 12, borderRadius: '50%', background: t.accent, boxShadow: `0 0 12px ${t.accent}` }} />
                   <div style={{ fontSize: 34, fontWeight: 800, color: t.title, fontFamily: bodyFont }}>{item}</div>
                 </div>
               );
             })}
          </div>
        </div>

        {/* 하단 요약 박스 */}
        {scene.slideData?.summary && (
          <div style={{ 
            marginTop: 80, textAlign: 'center',
            opacity: interpolate(frame, [60, 80], [0, 1])
          }}>
             <span style={{ 
               background: `${t.accent}18`, color: t.accent, padding: '14px 44px', borderRadius: 60,
               fontSize: 28, fontWeight: 800, border: `1.2px solid ${t.accent}44`,
               boxShadow: `0 8px 24px ${t.accent}11`
             }}>
               💡 {scene.slideData.summary}
             </span>
          </div>
        )}
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
  const p = getPal(t, slideIndex);

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
      {p && <BgShapes p={p} frame={frame} fps={fps} slideIndex={slideIndex} />}

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
  const p = getPal(t, slideIndex);

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
      {p && <BgShapes p={p} frame={frame} fps={fps} slideIndex={slideIndex} />}

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

// ─── STEPFLOW 레이아웃 ────────────────────────────────────────────────────────
// 가로형 흐름도: 카드 + 아이콘 + 화살표 (캡처 1번 스타일)
const StepFlowLayout: React.FC<{ scene: SceneType; slideIndex: number; bodyFont: string }> = ({ scene, slideIndex, bodyFont }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = getTheme(scene.pptTheme, slideIndex);
  const p = getPal(t, slideIndex);
  const steps = scene.slideData?.processSteps ?? [];
  const boxColors = p
    ? [p.accent, p.accent2, '#ff79c6', '#50fa7b']
    : [t.accent, t.accent2 || '#00d4ff', '#06ffa5', '#f7c948'];

  return (
    <AbsoluteFill style={{ background: t.bg, overflow: 'hidden' }}>
      {scene.audioUrl && <Audio src={scene.audioUrl} />}
      {p && <BgShapes p={p} frame={frame} fps={fps} slideIndex={slideIndex} />}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 1,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', padding: '160px 60px 60px',
      }}>
        <div style={{
          fontSize: 52, fontWeight: 800, fontFamily: bodyFont,
          color: t.title, marginBottom: 100, textAlign: 'center',
          opacity: interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' }),
        }}>
          {scene.slideData?.title || ''}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, width: '100%', justifyContent: 'center' }}>
          {steps.map((step, si) => {
            const delay = 15 + si * 25;
            const cardS = spring({ frame: Math.max(0, frame - delay), fps, config: { damping: 18, stiffness: 120 } });
            const color = boxColors[si % boxColors.length];
            const isLast = si === steps.length - 1;

            return (
              <React.Fragment key={si}>
                <div style={{
                  flex: 1, maxWidth: 300, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20,
                  opacity: cardS, transform: `translateY(${interpolate(cardS, [0, 1], [40, 0])}px)`,
                }}>
                  <div style={{
                    width: 120, height: 120, borderRadius: 24,
                    background: `linear-gradient(145deg, ${color}33, ${color}11)`,
                    border: `3px solid ${si === 0 ? color : color + '44'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 60,
                    boxShadow: si === 0 ? `0 0 30px ${color}44` : 'none',
                  }}>
                    {step.icon || '📦'}
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 32, fontWeight: 900, color: t.title, fontFamily: bodyFont }}>{step.title}</div>
                    <div style={{ fontSize: 18, color: t.muted, marginTop: 8, fontFamily: bodyFont }}>{step.subtitle}</div>
                  </div>
                </div>
                {!isLast && (
                  <div style={{
                    width: 60, textAlign: 'center', fontSize: 40, color: t.accent, fontWeight: 900,
                    opacity: interpolate(frame, [delay + 10, delay + 20], [0, 1]),
                  }}>
                    →
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─── CALENDAR 레이아웃 ────────────────────────────────────────────────────────
// 30일 그리드 + 빨간색 'X' 표시 (캡처 2번 스타일)
const CalendarLayout: React.FC<{ scene: SceneType; slideIndex: number; bodyFont: string }> = ({ scene, slideIndex, bodyFont }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = getTheme(scene.pptTheme, slideIndex);
  const cal = scene.slideData?.calendarData ?? { totalDays: 30, markedDays: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] };

  return (
    <AbsoluteFill style={{ background: t.bg, overflow: 'hidden' }}>
      {scene.audioUrl && <Audio src={scene.audioUrl} />}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 1,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: '60px',
      }}>
        <div style={{ fontSize: 48, fontWeight: 900, color: t.title, marginBottom: 60, fontFamily: bodyFont }}>
          {renderHighlighted(scene.slideData?.title || '', '#ff4d4d', { fontSize: 80, fontWeight: 900 })}
        </div>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12,
          background: 'rgba(255,255,255,0.05)', padding: 30, borderRadius: 20,
          border: '1px solid rgba(255,255,255,0.1)',
        }}>
          {Array.from({ length: cal.totalDays }).map((_, i) => {
            const day = i + 1;
            const isMarked = cal.markedDays.includes(day);
            const delay = 10 + i * 2;
            const s = spring({ frame: Math.max(0, frame - delay), fps, config: { damping: 20 } });
            
            return (
              <div key={i} style={{
                width: 80, height: 80, borderRadius: 10,
                background: isMarked ? 'rgba(255,77,77,0.15)' : 'rgba(255,255,255,0.05)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'relative', opacity: s,
              }}>
                <span style={{ fontSize: 20, fontWeight: 700, color: isMarked ? '#ff4d4d' : t.muted, fontFamily: bodyFont }}>{day}</span>
                {isMarked && (
                  <div style={{
                    position: 'absolute', inset: 0, fontSize: 60, color: '#ff4d4d',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transform: `scale(${s})`, opacity: s,
                  }}>×</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─── BARCHART 레이아웃 ────────────────────────────────────────────────────────
// 세로 막대기 비교 (캡처 3번 스타일)
const BarChartLayout: React.FC<{ scene: SceneType; slideIndex: number; bodyFont: string }> = ({ scene, slideIndex, bodyFont }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = getTheme(scene.pptTheme, slideIndex);
  const stats = scene.slideData?.stats ?? [{ value: '수십만원', label: '편집자' }, { value: '13만원', label: 'AI' }];

  return (
    <AbsoluteFill style={{ background: t.bg }}>
      <div style={{
        position: 'absolute', inset: 0, zIndex: 1,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 60, height: 400 }}>
          {stats.map((stat, i) => {
            const delay = 15 + i * 20;
            const s = spring({ frame: Math.max(0, frame - delay), fps, config: { damping: 15, stiffness: 100 } });
            const height = i === 0 ? 350 : 150;
            const color = i === 0 ? '#ff4d4d' : '#00e676';
            
            return (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
                <div style={{ fontSize: 32, fontWeight: 900, color, fontFamily: bodyFont, opacity: s }}>{stat.value}</div>
                <div style={{
                  width: 100, height: height * s, background: `linear-gradient(180deg, ${color}, ${color}44)`,
                  borderRadius: '10px 10px 0 0', boxShadow: `0 0 30px ${color}33`,
                }} />
                <div style={{ fontSize: 24, fontWeight: 700, color: t.muted, fontFamily: bodyFont }}>{stat.label}</div>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─── USERCLOUD 레이아웃 ────────────────────────────────────────────────────────
// 중앙 아이콘 + 주변 확산 (캡처 5번 스타일)
const UserCloudLayout: React.FC<{ scene: SceneType; slideIndex: number; bodyFont: string }> = ({ scene, slideIndex, bodyFont }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = getTheme(scene.pptTheme, slideIndex);
  const items = scene.slideData?.bullets ?? [];

  return (
    <AbsoluteFill style={{ background: t.bg }}>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ position: 'relative', width: 200, height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: 100, zIndex: 2 }}>🌐</div>
          {[...Array(12)].map((_, i) => {
            const angle = (i / 12) * Math.PI * 2;
            const dist = 180 + Math.sin(frame * 0.05 + i) * 10;
            const x = Math.cos(angle) * dist;
            const y = Math.sin(angle) * dist;
            const s = spring({ frame: Math.max(0, frame - 10 - i * 3), fps });
            return (
              <div key={i} style={{
                position: 'absolute', fontSize: 30,
                transform: `translate(${x}px, ${y}px) scale(${s})`,
                opacity: s * 0.6,
              }}>👤</div>
            );
          })}
        </div>
        <div style={{ marginTop: 100, textAlign: 'center', opacity: interpolate(frame, [30, 45], [0, 1]) }}>
          <div style={{ fontSize: 60, fontWeight: 900, color: t.title, fontFamily: bodyFont }}>{scene.slideData?.title}</div>
          <div style={{ fontSize: 28, color: t.accent, fontWeight: 700, marginTop: 10 }}>{items[0]}</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─── MOTION_LOGIC 레이아웃 ─────────────────────────────────────────────────────
// 1F~30F 타임라인 오렌지 원 이동 (캡처 6번 스타일)
const MotionLogicLayout: React.FC<{ scene: SceneType; slideIndex: number; bodyFont: string }> = ({ scene, slideIndex, bodyFont }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = getTheme(scene.pptTheme, slideIndex);
  
  const moveX = interpolate(frame % 90, [0, 60], [0, 1], { extrapolateRight: 'clamp', easing: Easing.inOut(Easing.quad) });
  const currentF = Math.round(moveX * 29) + 1;

  return (
    <AbsoluteFill style={{ background: t.bg }}>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 80px' }}>
        <div style={{ fontSize: 44, fontWeight: 800, color: t.title, marginBottom: 80, fontFamily: bodyFont }}>{scene.slideData?.title}</div>
        
        {/* 타임라인 메인 */}
        <div style={{ 
          width: '100%', height: 100, background: 'rgba(255,255,255,0.05)', 
          borderRadius: 15, position: 'relative', display: 'flex', alignItems: 'center', border: '1px solid rgba(255,255,255,0.1)' 
        }}>
          <div style={{ position: 'absolute', left: '10%', fontSize: 16, color: t.muted }}>1f</div>
          <div style={{ position: 'absolute', left: '50%', fontSize: 16, color: t.muted }}>10f</div>
          <div style={{ position: 'absolute', left: '90%', fontSize: 16, color: t.muted }}>30f</div>
          <div style={{ position: 'absolute', left: '10%', right: '10%', height: 2, background: 'rgba(255,255,255,0.2)', borderStyle: 'dashed' }} />
          
          {/* 움직이는 오렌지 원 */}
          <div style={{
            position: 'absolute', left: `${10 + moveX * 80}%`, 
            width: 40, height: 40, background: '#ff9800', borderRadius: '50%', 
            marginLeft: -20, boxShadow: '0 0 20px #ff9800',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column'
          }}>
            <div style={{ position: 'absolute', top: -35, fontSize: 14, color: '#ff9800', fontWeight: 900 }}>f={currentF}</div>
          </div>
        </div>

        {/* 하단 3개 카드 */}
        <div style={{ display: 'flex', gap: 30, marginTop: 60, width: '100%' }}>
          {[1, 10, 30].map((f, i) => {
            const isActive = currentF >= f;
            return (
              <div key={i} style={{ 
                flex: 1, height: 180, background: 'rgba(255,255,255,0.03)', borderRadius: 15, border: `1px solid ${isActive ? '#ff9800' : 'rgba(255,255,255,0.1)'}`,
                display: 'flex', flexDirection: 'column', overflow: 'hidden'
              }}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                  <div style={{ 
                    width: 60, height: 15, background: '#ff9800', borderRadius: 4,
                    transform: `translateX(${f === 1 ? -40 : f === 30 ? 40 : 0}px)`
                  }} />
                </div>
                <div style={{ height: 50, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, textAlign: 'center' }}>
                  {f}번째 그림<br/><span style={{ fontSize: 10, color: t.muted }}>{f === 1 ? '왼쪽에' : f === 30 ? '오른쪽으로' : '가운데로'}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─── GRAPHIC_BOX 레이아웃 ─────────────────────────────────────────────────────
// 비유용 그래픽 (벽돌 쌓기 등 - 캡처 4번 스타일)
// ─── GRAPHIC BOX (Denial → Solution) 레이아웃 ────────────────────────────────
// "기존 방식 ✕" → ↓ → "새로운 해결책" 패턴
const GraphicBoxLayout: React.FC<{ scene: SceneType; slideIndex: number; bodyFont: string }> = ({ scene, slideIndex, bodyFont }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = getTheme(scene.pptTheme, slideIndex);
  const p = getPal(t, slideIndex);

  const title = scene.slideData?.title || '';
  const bullets = scene.slideData?.bullets ?? [];
  const solutionTitle = bullets[0]?.replace(/^[\p{Emoji}\s]+/u, '') || '새로운 방법';
  const solutionSub = bullets[1] || scene.slideData?.summary || '';
  const solutionIcon = bullets[0]?.match(/^\p{Emoji}/u)?.[0] || '✅';

  // 애니메이션
  const strikeS = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 20 });
  const arrowS = spring({ frame: Math.max(0, frame - 20), fps, config: { damping: 20, stiffness: 80 } });
  const cardS = spring({ frame: Math.max(0, frame - 35), fps, config: { damping: 18, stiffness: 100 } });
  const strikeWidth = interpolate(strikeS, [0, 1], [0, 100]);

  const solutionColor = p?.accent2 || t.accent2 || '#06ffa5';

  return (
    <AbsoluteFill style={{ background: t.bg, overflow: 'hidden' }}>
      {scene.audioUrl && <Audio src={scene.audioUrl} />}
      {p && <BgShapes p={p} frame={frame} fps={fps} slideIndex={slideIndex} />}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 1,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 36, padding: '60px 120px',
      }}>
        {/* 부정/취소 영역 */}
        <div style={{ position: 'relative', textAlign: 'center' }}>
          <div style={{
            fontSize: 64, fontWeight: 900, fontFamily: bodyFont,
            color: '#ff4d6d', letterSpacing: '-0.02em',
            opacity: strikeS,
          }}>
            {title} ✕
          </div>
          {/* 취소선 애니메이션 */}
          <div style={{
            position: 'absolute', top: '50%', left: 0,
            height: 6, borderRadius: 3,
            background: '#ff4d6d',
            width: `${strikeWidth}%`,
            transform: 'translateY(-50%)',
            boxShadow: '0 0 12px #ff4d6d88',
          }} />
        </div>

        {/* 아래 화살표 */}
        <div style={{
          fontSize: 52, color: t.accent,
          opacity: arrowS,
          transform: `translateY(${interpolate(arrowS, [0, 1], [-20, 0])}px)`,
        }}>↓</div>

        {/* 해결책 카드 */}
        <div style={{
          background: `linear-gradient(145deg, ${solutionColor}18, ${solutionColor}08)`,
          border: `2.5px solid ${solutionColor}88`,
          borderRadius: 24,
          padding: '40px 60px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
          opacity: cardS,
          transform: `scale(${interpolate(cardS, [0, 1], [0.85, 1])})`,
          boxShadow: `0 0 40px ${solutionColor}22`,
          minWidth: 400,
        }}>
          <div style={{ fontSize: 52 }}>{solutionIcon}</div>
          <div style={{ fontSize: 40, fontWeight: 900, fontFamily: bodyFont, color: solutionColor, textAlign: 'center' }}>
            {solutionTitle}
          </div>
          {solutionSub && (
            <div style={{ fontSize: 22, color: t.muted, fontFamily: bodyFont, textAlign: 'center' }}>
              {solutionSub}
            </div>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─── CLOCK 레이아웃 ────────────────────────────────────────────────────────────
// 시계 초침 애니메이션 — "시간이 얼마나 걸리나?" 표현용
const ClockLayout: React.FC<{ scene: SceneType; slideIndex: number; bodyFont: string }> = ({ scene, slideIndex, bodyFont }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = getTheme(scene.pptTheme, slideIndex);
  const p = getPal(t, slideIndex);

  const title = scene.slideData?.title || '';
  const summary = scene.slideData?.summary || scene.slideData?.bullets?.[0] || '';

  // 시계 애니메이션: 초침은 빠르게 (2바퀴), 분침은 1바퀴
  const totalRotation = interpolate(frame, [0, fps * 4], [0, 720], { extrapolateRight: 'clamp' });
  const minuteRotation = interpolate(frame, [0, fps * 4], [0, 360], { extrapolateRight: 'clamp' });

  const fadeIn = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 20 });
  const summaryFade = interpolate(frame, [fps * 3.5, fps * 4.5], [0, 1], { extrapolateRight: 'clamp' });
  const pulse = interpolate(frame % 30, [0, 15, 30], [1, 1.04, 1], { extrapolateRight: 'clamp' });

  const clockSize = 260;
  const cx = clockSize / 2;
  const accentColor = p?.accent || t.accent;

  return (
    <AbsoluteFill style={{ background: t.bg, overflow: 'hidden' }}>
      {scene.audioUrl && <Audio src={scene.audioUrl} />}
      {p && <BgShapes p={p} frame={frame} fps={fps} slideIndex={slideIndex} />}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 1,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 48,
      }}>
        {/* 제목 */}
        {title && (
          <div style={{
            fontSize: 52, fontWeight: 800, fontFamily: bodyFont, color: t.title,
            textAlign: 'center', opacity: fadeIn,
            transform: `translateY(${interpolate(fadeIn, [0, 1], [-20, 0])}px)`,
          }}>
            {title}
          </div>
        )}

        {/* 시계 SVG */}
        <div style={{
          transform: `scale(${pulse})`,
          filter: `drop-shadow(0 0 24px ${accentColor}44)`,
          opacity: fadeIn,
        }}>
          <svg width={clockSize} height={clockSize} viewBox={`0 0 ${clockSize} ${clockSize}`}>
            {/* 시계 외곽 원 */}
            <circle cx={cx} cy={cx} r={cx - 8} fill="none" stroke={`${accentColor}44`} strokeWidth={3} />
            <circle cx={cx} cy={cx} r={cx - 8} fill="none" stroke={accentColor} strokeWidth={2}
              strokeDasharray={`${(cx - 8) * 2 * Math.PI * (frame / (fps * 4))}, ${(cx - 8) * 2 * Math.PI}`} />
            {/* 중심점 */}
            <circle cx={cx} cy={cx} r={6} fill={accentColor} />
            {/* 분침 (흰색, 짧음) */}
            <line
              x1={cx} y1={cx}
              x2={cx + Math.sin((minuteRotation * Math.PI) / 180) * (cx - 40)}
              y2={cx - Math.cos((minuteRotation * Math.PI) / 180) * (cx - 40)}
              stroke="rgba(255,255,255,0.8)" strokeWidth={4} strokeLinecap="round"
            />
            {/* 초침 (accent 색, 길음) */}
            <line
              x1={cx} y1={cx}
              x2={cx + Math.sin((totalRotation * Math.PI) / 180) * (cx - 24)}
              y2={cx - Math.cos((totalRotation * Math.PI) / 180) * (cx - 24)}
              stroke={accentColor} strokeWidth={2.5} strokeLinecap="round"
            />
            {/* 시각 표시 점 */}
            {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => (
              <circle key={deg}
                cx={cx + Math.sin((deg * Math.PI) / 180) * (cx - 18)}
                cy={cx - Math.cos((deg * Math.PI) / 180) * (cx - 18)}
                r={deg % 90 === 0 ? 4 : 2}
                fill={deg % 90 === 0 ? accentColor : `${accentColor}66`}
              />
            ))}
          </svg>
        </div>

        {/* 결론/해답 (시계 다 돌고 나서 등장) */}
        <div style={{
          fontSize: 44, fontWeight: 900, fontFamily: bodyFont,
          color: accentColor, textAlign: 'center',
          opacity: summaryFade,
          transform: `translateY(${interpolate(summaryFade, [0, 1], [20, 0])}px)`,
        }}>
          {summary || '?'}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─── LINE CHART 레이아웃 ──────────────────────────────────────────────────────
// 선형 추이 그래프 — draw-on 애니메이션
const LineChartLayout: React.FC<{ scene: SceneType; slideIndex: number; bodyFont: string }> = ({ scene, slideIndex, bodyFont }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = getTheme(scene.pptTheme, slideIndex);
  const p = getPal(t, slideIndex);
  const accentColor = p?.accent || t.accent;
  const stats = scene.slideData?.stats ?? [];
  const title = scene.slideData?.title || '';
  const summary = scene.slideData?.summary || '';

  const W = 1080, H = 560, PL = 80, PR = 60, PT = 60, PB = 80;
  const chartW = W - PL - PR, chartH = H - PT - PB;

  // stats에서 숫자 추출
  const values = stats.map(s => parseFloat(s.value.replace(/[^0-9.-]/g, '')) || 0);
  const labels = stats.map(s => s.label);
  const minVal = Math.min(...values) * 0.95;
  const maxVal = Math.max(...values) * 1.05;

  const toX = (i: number) => PL + (i / Math.max(values.length - 1, 1)) * chartW;
  const toY = (v: number) => PT + chartH - ((v - minVal) / (maxVal - minVal || 1)) * chartH;

  // SVG path 생성
  const pathD = values.map((v, i) => `${i === 0 ? 'M' : 'L'} ${toX(i)} ${toY(v)}`).join(' ');
  const areaD = values.length > 0
    ? `${pathD} L ${toX(values.length - 1)} ${PT + chartH} L ${toX(0)} ${PT + chartH} Z`
    : '';

  // 전체 path 길이 (근사값)
  const pathLength = values.length > 1 ? Math.sqrt(
    values.slice(1).reduce((sum, v, i) => {
      const dx = toX(i + 1) - toX(i); const dy = toY(v) - toY(values[i]);
      return sum + dx * dx + dy * dy;
    }, 0)
  ) : 0;

  const drawProgress = interpolate(frame, [10, 10 + fps * 2], [0, 1], { extrapolateRight: 'clamp' });
  const dashOffset = pathLength * (1 - drawProgress);

  const titleFade = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
  const summaryFade = interpolate(frame, [fps * 2.5, fps * 3], [0, 1], { extrapolateRight: 'clamp' });

  const isUp = values.length >= 2 && values[values.length - 1] >= values[0];
  const lineColor = isUp ? '#22c55e' : '#ef4444';

  return (
    <AbsoluteFill style={{ background: t.bg, overflow: 'hidden' }}>
      {scene.audioUrl && <Audio src={scene.audioUrl} />}
      {p && <BgShapes p={p} frame={frame} fps={fps} slideIndex={slideIndex} />}
      <div style={{ position: 'absolute', inset: 0, zIndex: 1, display: 'flex', flexDirection: 'column', padding: '60px 80px 40px' }}>
        {/* 제목 */}
        <div style={{ fontSize: 52, fontWeight: 800, fontFamily: bodyFont, color: t.title, marginBottom: 20, opacity: titleFade }}>
          {title}
          {summary && <span style={{ fontSize: 28, fontWeight: 600, color: isUp ? '#22c55e' : '#ef4444', marginLeft: 24 }}>{summary}</span>}
        </div>

        {/* 차트 SVG */}
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ flex: 1 }}>
          {/* 그리드 라인 */}
          {[0, 0.25, 0.5, 0.75, 1].map(r => {
            const y = PT + r * chartH;
            const val = maxVal - r * (maxVal - minVal);
            return (
              <g key={r}>
                <line x1={PL} y1={y} x2={PL + chartW} y2={y} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
                <text x={PL - 12} y={y + 5} textAnchor="end" fill="rgba(255,255,255,0.35)" fontSize={22}>
                  {val >= 10000 ? `${Math.round(val / 1000)}K` : Math.round(val)}
                </text>
              </g>
            );
          })}

          {/* 영역 채우기 */}
          {areaD && (
            <path d={areaD} fill={`url(#lineGrad${slideIndex})`} opacity={drawProgress * 0.3} />
          )}
          <defs>
            <linearGradient id={`lineGrad${slideIndex}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lineColor} stopOpacity={0.6} />
              <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
            </linearGradient>
          </defs>

          {/* 메인 라인 — draw-on */}
          <path
            d={pathD}
            fill="none"
            stroke={lineColor}
            strokeWidth={4}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={pathLength}
            strokeDashoffset={dashOffset}
            style={{ filter: `drop-shadow(0 0 8px ${lineColor}88)` }}
          />

          {/* 데이터 포인트 + 레이블 */}
          {values.map((v, i) => {
            const dotFade = interpolate(frame, [10 + fps * 2 * (i / Math.max(values.length - 1, 1)), 10 + fps * 2 * (i / Math.max(values.length - 1, 1)) + 10], [0, 1], { extrapolateRight: 'clamp' });
            return (
              <g key={i} opacity={dotFade}>
                <circle cx={toX(i)} cy={toY(v)} r={7} fill={lineColor} stroke={t.bg} strokeWidth={3} />
                <text x={toX(i)} y={PT + chartH + 40} textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize={22}>
                  {labels[i] || `P${i + 1}`}
                </text>
                <text x={toX(i)} y={toY(v) - 16} textAnchor="middle" fill={lineColor} fontSize={20} fontWeight={700}>
                  {stats[i]?.value}
                </text>
              </g>
            );
          })}

          {/* 축 */}
          <line x1={PL} y1={PT} x2={PL} y2={PT + chartH} stroke="rgba(255,255,255,0.2)" strokeWidth={2} />
          <line x1={PL} y1={PT + chartH} x2={PL + chartW} y2={PT + chartH} stroke="rgba(255,255,255,0.2)" strokeWidth={2} />
        </svg>

        {/* 방향 배지 */}
        <div style={{
          position: 'absolute', top: 60, right: 80,
          fontSize: 32, fontWeight: 900, fontFamily: bodyFont,
          color: isUp ? '#22c55e' : '#ef4444',
          background: isUp ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
          border: `2px solid ${isUp ? '#22c55e44' : '#ef444444'}`,
          borderRadius: 12, padding: '8px 20px',
          opacity: summaryFade,
        }}>
          {isUp ? '▲ 상승' : '▼ 하락'}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─── CANDLESTICK 레이아웃 ─────────────────────────────────────────────────────
// 캔들스틱 차트 — stats: [{value:"시가,고가,저가,종가", label:"날짜"}]
const CandlestickLayout: React.FC<{ scene: SceneType; slideIndex: number; bodyFont: string }> = ({ scene, slideIndex, bodyFont }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = getTheme(scene.pptTheme, slideIndex);
  const p = getPal(t, slideIndex);
  const stats = scene.slideData?.stats ?? [];
  const title = scene.slideData?.title || '';
  const summary = scene.slideData?.summary || '';

  // stats.value 형식: "시가,고가,저가,종가" 또는 단일 종가
  const candles = stats.map(s => {
    const parts = s.value.split(',').map(v => parseFloat(v.replace(/[^0-9.-]/g, '')) || 0);
    const close = parts[0], high = parts[1] ?? close * 1.02, low = parts[2] ?? close * 0.98, open = parts[3] ?? close * 0.99;
    return { open, high, low, close, label: s.label };
  });

  if (candles.length === 0) {
    // 데이터 없으면 샘플 캔들 생성
    const base = 50000;
    candles.push(
      { open: base, high: base * 1.03, low: base * 0.98, close: base * 1.02, label: '월' },
      { open: base * 1.02, high: base * 1.05, low: base * 1.00, close: base * 1.04, label: '화' },
      { open: base * 1.04, high: base * 1.06, low: base * 0.99, close: base * 1.01, label: '수' },
      { open: base * 1.01, high: base * 1.04, low: base * 0.97, close: base * 0.98, label: '목' },
      { open: base * 0.98, high: base * 1.02, low: base * 0.96, close: base * 1.03, label: '금' },
    );
  }

  const W = 1080, H = 540, PL = 90, PR = 40, PT = 40, PB = 70;
  const chartW = W - PL - PR, chartH = H - PT - PB;
  const allPrices = candles.flatMap(c => [c.high, c.low]);
  const minP = Math.min(...allPrices) * 0.99, maxP = Math.max(...allPrices) * 1.01;
  const toY = (v: number) => PT + chartH - ((v - minP) / (maxP - minP)) * chartH;
  const candleW = Math.min(80, (chartW / candles.length) * 0.6);
  const gap = chartW / candles.length;

  const titleFade = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ background: t.bg, overflow: 'hidden' }}>
      {scene.audioUrl && <Audio src={scene.audioUrl} />}
      {p && <BgShapes p={p} frame={frame} fps={fps} slideIndex={slideIndex} />}
      <div style={{ position: 'absolute', inset: 0, zIndex: 1, padding: '50px 60px 30px' }}>
        <div style={{ fontSize: 48, fontWeight: 800, fontFamily: bodyFont, color: t.title, marginBottom: 16, opacity: titleFade }}>
          {title}
          {summary && <span style={{ fontSize: 26, color: t.muted, marginLeft: 20, fontWeight: 500 }}>{summary}</span>}
        </div>
        <svg width="100%" viewBox={`0 0 ${W} ${H}`}>
          {/* 그리드 */}
          {[0, 0.25, 0.5, 0.75, 1].map(r => {
            const y = PT + r * chartH;
            const val = maxP - r * (maxP - minP);
            return (
              <g key={r}>
                <line x1={PL} y1={y} x2={PL + chartW} y2={y} stroke="rgba(255,255,255,0.07)" strokeWidth={1} />
                <text x={PL - 10} y={y + 5} textAnchor="end" fill="rgba(255,255,255,0.3)" fontSize={20}>
                  {val >= 10000 ? `${(val / 1000).toFixed(0)}K` : Math.round(val)}
                </text>
              </g>
            );
          })}

          {/* 캔들 */}
          {candles.map((c, i) => {
            const delay = 5 + i * 8;
            const s = spring({ frame: Math.max(0, frame - delay), fps, config: { damping: 18, stiffness: 140 } });
            const isGreen = c.close >= c.open;
            const color = isGreen ? '#22c55e' : '#ef4444';
            const cx = PL + gap * i + gap * 0.5;
            const bodyTop = toY(Math.max(c.open, c.close));
            const bodyBot = toY(Math.min(c.open, c.close));
            const bodyH = Math.max(2, bodyBot - bodyTop);

            return (
              <g key={i} opacity={s}>
                {/* 심지 */}
                <line x1={cx} y1={toY(c.high)} x2={cx} y2={toY(c.low)} stroke={color} strokeWidth={2} />
                {/* 몸통 */}
                <rect
                  x={cx - candleW / 2} y={bodyTop}
                  width={candleW} height={bodyH * s}
                  fill={isGreen ? `${color}cc` : `${color}cc`}
                  stroke={color} strokeWidth={1.5} rx={2}
                  style={{ filter: `drop-shadow(0 0 6px ${color}44)` }}
                />
                {/* 레이블 */}
                <text x={cx} y={PT + chartH + 45} textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize={20}>
                  {c.label}
                </text>
                {/* 종가 */}
                <text x={cx} y={toY(c.close) - 12} textAnchor="middle" fill={color} fontSize={18} fontWeight={700}>
                  {c.close >= 1000 ? `${(c.close / 1000).toFixed(1)}K` : c.close}
                </text>
              </g>
            );
          })}

          {/* 축 */}
          <line x1={PL} y1={PT} x2={PL} y2={PT + chartH} stroke="rgba(255,255,255,0.15)" strokeWidth={2} />
          <line x1={PL} y1={PT + chartH} x2={PL + chartW} y2={PT + chartH} stroke="rgba(255,255,255,0.15)" strokeWidth={2} />
        </svg>
      </div>
    </AbsoluteFill>
  );
};

// ─── GAUGE 레이아웃 ───────────────────────────────────────────────────────────
// 공포/탐욕 지수 반원 게이지
const GaugeLayout: React.FC<{ scene: SceneType; slideIndex: number; bodyFont: string }> = ({ scene, slideIndex, bodyFont }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = getTheme(scene.pptTheme, slideIndex);
  const p = getPal(t, slideIndex);

  const title = scene.slideData?.title || '시장 심리 지수';
  const stats = scene.slideData?.stats ?? [];
  const rawVal = parseFloat(stats[0]?.value?.replace(/[^0-9.-]/g, '') || '50');
  const gaugeValue = Math.min(100, Math.max(0, rawVal));
  const label = stats[0]?.label || '';
  const summary = scene.slideData?.summary || '';

  // 게이지 색 (0=공포=빨강, 50=중립=노랑, 100=탐욕=초록)
  const gaugeColor = gaugeValue < 25 ? '#ef4444'
    : gaugeValue < 45 ? '#f97316'
    : gaugeValue < 55 ? '#eab308'
    : gaugeValue < 75 ? '#84cc16'
    : '#22c55e';
  const gaugeLabel = gaugeValue < 25 ? '극도의 공포' : gaugeValue < 45 ? '공포' : gaugeValue < 55 ? '중립' : gaugeValue < 75 ? '탐욕' : '극도의 탐욕';

  // 애니메이션
  const progress = spring({ frame: Math.max(0, frame - 10), fps, config: { damping: 20, stiffness: 40 }, durationInFrames: 60 });
  const animatedValue = interpolate(progress, [0, 1], [0, gaugeValue]);
  const titleFade = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
  const labelFade = interpolate(frame, [30, 50], [0, 1], { extrapolateRight: 'clamp' });

  // 반원 게이지 (SVG arc)
  const R = 260, cx = 540, cy = 420;
  const startAngle = -180, endAngle = 0; // 반원
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const arcPath = (from: number, to: number, r: number) => {
    const x1 = cx + r * Math.cos(toRad(from)), y1 = cy + r * Math.sin(toRad(from));
    const x2 = cx + r * Math.cos(toRad(to)), y2 = cy + r * Math.sin(toRad(to));
    return `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`;
  };
  const totalArc = 2 * Math.PI * R * 0.5;
  const fillRatio = animatedValue / 100;
  const needleAngle = startAngle + (animatedValue / 100) * 180;

  return (
    <AbsoluteFill style={{ background: t.bg, overflow: 'hidden' }}>
      {scene.audioUrl && <Audio src={scene.audioUrl} />}
      {p && <BgShapes p={p} frame={frame} fps={fps} slideIndex={slideIndex} />}
      <div style={{ position: 'absolute', inset: 0, zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {/* 제목 */}
        <div style={{ fontSize: 52, fontWeight: 800, fontFamily: bodyFont, color: t.title, marginTop: 80, opacity: titleFade }}>
          {title}
        </div>

        {/* 게이지 SVG */}
        <svg width={900} height={520} viewBox="0 0 1080 520">
          {/* 배경 반원 */}
          <path d={arcPath(-180, 0, R)} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={36} strokeLinecap="round" />

          {/* 색상 구간 (공포→탐욕) */}
          {[
            { from: -180, to: -144, color: '#ef4444' },
            { from: -144, to: -108, color: '#f97316' },
            { from: -108, to: -72, color:  '#eab308' },
            { from: -72,  to: -36, color:  '#84cc16' },
            { from: -36,  to: 0,   color:  '#22c55e' },
          ].map((seg, i) => (
            <path key={i} d={arcPath(seg.from, seg.to, R)} fill="none"
              stroke={seg.color} strokeWidth={36} strokeLinecap="butt" opacity={0.25} />
          ))}

          {/* 채워진 부분 */}
          <path d={arcPath(-180, 0, R)} fill="none"
            stroke={gaugeColor} strokeWidth={36} strokeLinecap="round"
            strokeDasharray={`${totalArc * fillRatio} ${totalArc}`}
            style={{ filter: `drop-shadow(0 0 12px ${gaugeColor}88)` }}
          />

          {/* 바늘 */}
          <g transform={`rotate(${needleAngle}, ${cx}, ${cy})`}>
            <line x1={cx} y1={cy} x2={cx + R - 20} y2={cy}
              stroke="white" strokeWidth={5} strokeLinecap="round"
              style={{ filter: 'drop-shadow(0 0 6px rgba(255,255,255,0.8))' }} />
            <circle cx={cx} cy={cy} r={16} fill="white" />
            <circle cx={cx} cy={cy} r={8} fill={gaugeColor} />
          </g>

          {/* 수치 */}
          <text x={cx} y={cy - 40} textAnchor="middle" fill="white"
            fontSize={100} fontWeight={900} fontFamily="sans-serif">
            {Math.round(animatedValue)}
          </text>

          {/* 레이블 */}
          <text x={cx} y={cy + 30} textAnchor="middle" fill={gaugeColor}
            fontSize={42} fontWeight={800} fontFamily="sans-serif" opacity={labelFade}>
            {gaugeLabel}
          </text>

          {/* 축 레이블 */}
          <text x={cx - R - 20} y={cy + 10} textAnchor="end" fill="#ef444488" fontSize={22}>공포</text>
          <text x={cx + R + 20} y={cy + 10} textAnchor="start" fill="#22c55e88" fontSize={22}>탐욕</text>
        </svg>

        {/* 부가 설명 */}
        {(label || summary) && (
          <div style={{
            fontSize: 30, color: t.muted, fontFamily: bodyFont, textAlign: 'center',
            opacity: labelFade, marginTop: -20,
          }}>
            {label} {summary}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

// ─── PORTFOLIO 레이아웃 ───────────────────────────────────────────────────────
// 파이차트 포트폴리오 — stats: [{value:"40%", label:"반도체"}]
const PortfolioLayout: React.FC<{ scene: SceneType; slideIndex: number; bodyFont: string }> = ({ scene, slideIndex, bodyFont }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = getTheme(scene.pptTheme, slideIndex);
  const p = getPal(t, slideIndex);
  const stats = scene.slideData?.stats ?? [];
  const title = scene.slideData?.title || '포트폴리오';
  const summary = scene.slideData?.summary || '';

  const CHART_COLORS = ['#f97316', '#38bdf8', '#a78bfa', '#34d399', '#fb923c', '#60a5fa', '#f472b6', '#facc15'];

  // 퍼센트 파싱
  const items = stats.map((s, i) => ({
    label: s.label,
    value: parseFloat(s.value.replace(/[^0-9.-]/g, '')) || 0,
    color: CHART_COLORS[i % CHART_COLORS.length],
  }));
  const total = items.reduce((sum, it) => sum + it.value, 0) || 100;

  const progress = spring({ frame: Math.max(0, frame - 10), fps, config: { damping: 25, stiffness: 50 }, durationInFrames: 50 });
  const titleFade = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });

  // 파이 arc 생성
  const R = 200, cx = 360, cy = 300;
  let currentAngle = -90;
  const slices = items.map(it => {
    const pct = (it.value / total) * progress;
    const startA = currentAngle;
    const sweep = pct * 360;
    currentAngle += sweep;
    return { ...it, startA, sweep };
  });

  const toXY = (angle: number, r: number) => ({
    x: cx + r * Math.cos((angle * Math.PI) / 180),
    y: cy + r * Math.sin((angle * Math.PI) / 180),
  });

  return (
    <AbsoluteFill style={{ background: t.bg, overflow: 'hidden' }}>
      {scene.audioUrl && <Audio src={scene.audioUrl} />}
      {p && <BgShapes p={p} frame={frame} fps={fps} slideIndex={slideIndex} />}
      <div style={{ position: 'absolute', inset: 0, zIndex: 1, display: 'flex', flexDirection: 'column', padding: '60px 60px 40px' }}>
        {/* 제목 */}
        <div style={{ fontSize: 52, fontWeight: 800, fontFamily: bodyFont, color: t.title, marginBottom: 20, opacity: titleFade }}>
          {title}
          {summary && <span style={{ fontSize: 26, color: t.muted, marginLeft: 20, fontWeight: 400 }}>{summary}</span>}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', flex: 1, gap: 60 }}>
          {/* 파이차트 */}
          <svg width={720} height={600} viewBox="0 0 720 600">
            {slices.map((sl, i) => {
              if (sl.sweep < 0.5) return null;
              const p1 = toXY(sl.startA, R);
              const p2 = toXY(sl.startA + sl.sweep, R);
              const largeArc = sl.sweep > 180 ? 1 : 0;
              const mid = toXY(sl.startA + sl.sweep / 2, R * 0.65);
              const labelDelay = interpolate(frame, [20 + i * 8, 35 + i * 8], [0, 1], { extrapolateRight: 'clamp' });

              return (
                <g key={i}>
                  <path
                    d={`M ${cx} ${cy} L ${p1.x} ${p1.y} A ${R} ${R} 0 ${largeArc} 1 ${p2.x} ${p2.y} Z`}
                    fill={sl.color}
                    stroke={t.bg} strokeWidth={3}
                    style={{ filter: `drop-shadow(0 4px 12px ${sl.color}44)` }}
                    opacity={0.9}
                  />
                  {sl.sweep > 20 && (
                    <text x={mid.x} y={mid.y} textAnchor="middle" dominantBaseline="middle"
                      fill="white" fontSize={22} fontWeight={800} opacity={labelDelay}>
                      {sl.value}%
                    </text>
                  )}
                </g>
              );
            })}
            {/* 도넛 구멍 */}
            <circle cx={cx} cy={cy} r={90} fill={t.bg} />
            <text x={cx} y={cy - 10} textAnchor="middle" fill="white" fontSize={32} fontWeight={900}>
              {items.length}
            </text>
            <text x={cx} y={cy + 26} textAnchor="middle" fill={t.muted} fontSize={20}>
              종목
            </text>
          </svg>

          {/* 범례 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, flex: 1 }}>
            {items.map((it, i) => {
              const legFade = interpolate(frame, [15 + i * 8, 30 + i * 8], [0, 1], { extrapolateRight: 'clamp' });
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 16,
                  opacity: legFade,
                  transform: `translateX(${interpolate(legFade, [0, 1], [20, 0])}px)`,
                }}>
                  <div style={{ width: 20, height: 20, borderRadius: 4, background: it.color, flexShrink: 0 }} />
                  <div style={{ flex: 1, fontSize: 30, fontWeight: 600, fontFamily: bodyFont, color: t.title }}>{it.label}</div>
                  <div style={{ fontSize: 32, fontWeight: 900, fontFamily: bodyFont, color: it.color }}>{it.value}%</div>
                </div>
              );
            })}
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
  const hasAnalogy = !!scene.slideData?.analogyData?.pairs?.length;

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
    if (layout === 'equation') {
      return hasAnalogy
        ? <EquationLayout scene={scene} slideIndex={slideIndex} bodyFont={bodyFont} />
        : <BoxListLayout scene={scene} slideIndex={slideIndex} bodyFont={bodyFont} />;
    }
    if (layout === 'stepflow') {
      return (scene.slideData?.processSteps?.length ?? 0) > 0
        ? <StepFlowLayout scene={scene} slideIndex={slideIndex} bodyFont={bodyFont} />
        : <ProgressLayout scene={scene} slideIndex={slideIndex} bodyFont={bodyFont} />;
    }
    if (layout === 'calendar') {
      return <CalendarLayout scene={scene} slideIndex={slideIndex} bodyFont={bodyFont} />;
    }
    if (layout === 'barchart') {
      return hasStats
        ? <BarChartLayout scene={scene} slideIndex={slideIndex} bodyFont={bodyFont} />
        : <StatCardLayout scene={scene} slideIndex={slideIndex} bodyFont={bodyFont} />;
    }
    if (layout === 'usercloud') {
      return <UserCloudLayout scene={scene} slideIndex={slideIndex} bodyFont={bodyFont} />;
    }
    if (layout === 'motion_logic') {
      return <MotionLogicLayout scene={scene} slideIndex={slideIndex} bodyFont={bodyFont} />;
    }
    if (layout === 'graphic_box') {
      return <GraphicBoxLayout scene={scene} slideIndex={slideIndex} bodyFont={bodyFont} />;
    }
    if (layout === 'clock') {
      return <ClockLayout scene={scene} slideIndex={slideIndex} bodyFont={bodyFont} />;
    }
    if (layout === 'linechart') {
      return hasStats
        ? <LineChartLayout scene={scene} slideIndex={slideIndex} bodyFont={bodyFont} />
        : <StatCardLayout scene={scene} slideIndex={slideIndex} bodyFont={bodyFont} />;
    }
    if (layout === 'candlestick') {
      return <CandlestickLayout scene={scene} slideIndex={slideIndex} bodyFont={bodyFont} />;
    }
    if (layout === 'gauge') {
      return <GaugeLayout scene={scene} slideIndex={slideIndex} bodyFont={bodyFont} />;
    }
    if (layout === 'portfolio') {
      return hasStats
        ? <PortfolioLayout scene={scene} slideIndex={slideIndex} bodyFont={bodyFont} />
        : <StatCardLayout scene={scene} slideIndex={slideIndex} bodyFont={bodyFont} />;
    }
    return <TitleLayout scene={scene} slideIndex={slideIndex} bodyFont={bodyFont} />;
  };

  return (
    <AbsoluteFill style={{ zIndex: 999 }}>
      {/* Lottie 배경 (슬라이드 레이아웃 뒤에 배치) */}
      {scene.lottieData && (
        <AbsoluteFill style={{ zIndex: 0, opacity: 0.35 }}>
          <Lottie animationData={scene.lottieData as any} style={{ width: '100%', height: '100%' }} playbackRate={1} />
        </AbsoluteFill>
      )}
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
