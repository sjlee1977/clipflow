import React from 'react';
import {
  AbsoluteFill, Audio,
  spring, interpolate, Easing,
  useCurrentFrame, useVideoConfig,
} from 'remotion';
import { makeStar } from '@remotion/shapes';
import { Scene as SceneType } from './types';

type Props = {
  scene: SceneType;
  sceneIndex: number;
  fontFamily?: string;
};

// ─── 씬별 배경 팔레트 (어둠~밝음 다양하게) ────────────────────────────────────
const PALETTES = [
  // 다크
  { bg1: '#0a0a0a', bg2: '#1c1c1e', accent: '#ffffff',  text: '#ffffff', dark: true  },
  { bg1: '#1c0a14', bg2: '#3a0d26', accent: '#ff375f',  text: '#ffffff', dark: true  },
  { bg1: '#0a1c10', bg2: '#0d3a1e', accent: '#30d158',  text: '#ffffff', dark: true  },
  { bg1: '#120a1c', bg2: '#220d3a', accent: '#bf5fff',  text: '#ffffff', dark: true  },
  // 미드톤
  { bg1: '#1a2a4a', bg2: '#0d1f3c', accent: '#64d2ff',  text: '#ffffff', dark: true  },
  { bg1: '#2a1a00', bg2: '#3d2800', accent: '#ffd60a',  text: '#ffffff', dark: true  },
  { bg1: '#1a0a2a', bg2: '#2d0d45', accent: '#ff79c6',  text: '#ffffff', dark: true  },
  // 밝은 배경
  { bg1: '#ffffff', bg2: '#f2f2f7', accent: '#1c1c1e',  text: '#1c1c1e', dark: false },
  { bg1: '#fff1f2', bg2: '#ffe4e8', accent: '#ff375f',  text: '#1c1c1e', dark: false },
  { bg1: '#f0fdf4', bg2: '#dcfce7', accent: '#16a34a',  text: '#14532d', dark: false },
  { bg1: '#fefce8', bg2: '#fef08a', accent: '#ca8a04',  text: '#713f12', dark: false },
  { bg1: '#eff6ff', bg2: '#dbeafe', accent: '#1d4ed8',  text: '#1e3a8a', dark: false },
  { bg1: '#faf5ff', bg2: '#ede9fe', accent: '#7c3aed',  text: '#4c1d95', dark: false },
  // 선명한 컬러 배경
  { bg1: '#ff375f', bg2: '#c0143c', accent: '#ffffff',  text: '#ffffff', dark: true  },
  { bg1: '#0a84ff', bg2: '#0060cc', accent: '#ffffff',  text: '#ffffff', dark: true  },
  { bg1: '#30d158', bg2: '#1a9e3f', accent: '#ffffff',  text: '#ffffff', dark: true  },
];

function pal(idx: number) { return PALETTES[idx % PALETTES.length]; }

// ─── 배경 파티클 효과 ──────────────────────────────────────────────────────────
const Sparkle: React.FC<{ frame: number; accent: string }> = ({ frame, accent }) => {
  const { path, width, height } = makeStar({ innerRadius: 4, outerRadius: 10, points: 5 });
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {[...Array(10)].map((_, i) => {
        const seed = i * 45678;
        const x = (Math.sin(seed + frame * 0.03) * 42 + 50) + '%';
        const y = (Math.cos(seed + frame * 0.05) * 42 + 50) + '%';
        const opacity = interpolate(Math.sin(frame * 0.12 + i), [-1, 1], [0, 0.6]);
        const sc = interpolate(Math.sin(frame * 0.08 + i), [-1, 1], [0.4, 1.2]);
        return (
          <div key={i} style={{ position: 'absolute', left: x, top: y, opacity, transform: `scale(${sc}) rotate(${frame * 2 + i * 36}deg)` }}>
            <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
              <path d={path} fill={accent} />
            </svg>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

const Rain: React.FC<{ frame: number }> = ({ frame }) => (
  <AbsoluteFill style={{ overflow: 'hidden', pointerEvents: 'none' }}>
    {[...Array(30)].map((_, i) => {
      const fall = ((frame * 18 + i * 45) % 1200) - 100;
      return <div key={i} style={{ position: 'absolute', left: (i * 3.3) + '%', top: fall, width: 1, height: 35, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 2 }} />;
    })}
  </AbsoluteFill>
);

const Snow: React.FC<{ frame: number }> = ({ frame }) => (
  <AbsoluteFill style={{ overflow: 'hidden', pointerEvents: 'none' }}>
    {[...Array(40)].map((_, i) => {
      const fall = ((frame * 2.5 + i * 38) % 1100) - 100;
      const drift = Math.sin(frame * 0.04 + i) * 18;
      return <div key={i} style={{ position: 'absolute', left: `calc(${i * 2.5}% + ${drift}px)`, top: fall, width: 6, height: 6, backgroundColor: 'white', borderRadius: '50%', opacity: 0.6 }} />;
    })}
  </AbsoluteFill>
);

const Fire: React.FC<{ frame: number; accent: string }> = ({ frame, accent }) => (
  <AbsoluteFill style={{ justifyContent: 'flex-end', pointerEvents: 'none' }}>
    {[...Array(10)].map((_, i) => {
      const h = interpolate(Math.sin(frame * 0.18 + i), [-1, 1], [100, 220]);
      const op = interpolate(Math.sin(frame * 0.25 + i), [-1, 1], [0.2, 0.5]);
      return <div key={i} style={{ position: 'absolute', left: (i * 10) + '%', bottom: -30, width: 80, height: h, background: `linear-gradient(to top, ${accent}, #ff9d00, transparent)`, borderRadius: '50% 50% 0 0', opacity: op, filter: 'blur(12px)' }} />;
    })}
  </AbsoluteFill>
);

const Heart: React.FC<{ frame: number; accent: string }> = ({ frame, accent }) => (
  <AbsoluteFill style={{ pointerEvents: 'none' }}>
    {[...Array(6)].map((_, i) => {
      const up = interpolate((frame + i * 18) % 110, [0, 110], [1100, -100]);
      const drift = Math.sin(frame * 0.08 + i) * 28;
      return (
        <div key={i} style={{ position: 'absolute', left: (15 + i * 14) + '%', top: up, transform: `translateX(${drift}px)`, opacity: 0.7 }}>
          <svg width="44" height="44" viewBox="0 0 24 24" fill={accent}>
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
        </div>
      );
    })}
  </AbsoluteFill>
);

const Stars: React.FC<{ frame: number }> = ({ frame }) => (
  <AbsoluteFill style={{ pointerEvents: 'none' }}>
    {[...Array(60)].map((_, i) => {
      const seed = i * 999;
      const x = (Math.cos(seed) * 50 + 50) + '%';
      const y = (Math.sin(seed * 2) * 50 + 50) + '%';
      const op = interpolate(Math.sin(frame * 0.08 + i), [-1, 1], [0.05, 0.7]);
      return <div key={i} style={{ position: 'absolute', left: x, top: y, width: i % 5 === 0 ? 4 : 2, height: i % 5 === 0 ? 4 : 2, backgroundColor: 'white', borderRadius: '50%', opacity: op, boxShadow: '0 0 4px white' }} />;
    })}
  </AbsoluteFill>
);

const PulseRing: React.FC<{ frame: number; accent: string }> = ({ frame, accent }) => {
  const rings = [0, 20, 40];
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', pointerEvents: 'none' }}>
      {rings.map((offset, i) => {
        const progress = ((frame + offset) % 60) / 60;
        const sc = interpolate(progress, [0, 1], [0.3, 2.2]);
        const op = interpolate(progress, [0, 0.3, 1], [0, 0.25, 0]);
        return <div key={i} style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', border: `3px solid ${accent}`, transform: `scale(${sc})`, opacity: op }} />;
      })}
    </AbsoluteFill>
  );
};

const Confetti: React.FC<{ frame: number }> = ({ frame }) => {
  const colors = ['#ff6b6b', '#06ffa5', '#00d4ff', '#f7c948', '#ff79c6', '#bf5fff'];
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {[...Array(24)].map((_, i) => {
        const fall = interpolate((frame + i * 8) % 90, [0, 90], [-60, 1140]);
        const rotate = frame * 4 + i * 22;
        return <div key={i} style={{ position: 'absolute', left: (i * 4.2) + '%', top: fall, transform: `rotate(${rotate}deg)`, width: 12, height: 12, backgroundColor: colors[i % colors.length], borderRadius: i % 3 === 0 ? '50%' : 2, opacity: 0.8 }} />;
      })}
    </AbsoluteFill>
  );
};

const Thunder: React.FC<{ frame: number }> = ({ frame }) => {
  const isFlash = frame < 5;
  const isAfterGlow = frame >= 10 && frame < 14;
  const opacity = isFlash ? 0.7 : isAfterGlow ? 0.2 : 0;
  if (opacity === 0) return null;
  return <AbsoluteFill style={{ backgroundColor: `rgba(200,220,255,${opacity})`, pointerEvents: 'none' }} />;
};

const ChartUp: React.FC<{ frame: number; accent: string }> = ({ frame, accent }) => {
  const len = interpolate(frame, [0, 45], [0, 220], { extrapolateRight: 'clamp' });
  return (
    <div style={{ position: 'absolute', bottom: '18%', right: '8%', opacity: 0.35 }}>
      <svg width="280" height="160" viewBox="0 0 220 120">
        <path d="M10 110 L55 85 L100 95 L155 50 L210 15" stroke={accent} strokeWidth="5" fill="none" strokeDasharray="280" strokeDashoffset={280 - len} strokeLinecap="round" />
        <path d="M200 20 L210 15 L205 26" stroke={accent} strokeWidth="5" fill="none" strokeLinecap="round" opacity={len > 200 ? 1 : 0} />
      </svg>
    </div>
  );
};

const ClockSpin: React.FC<{ frame: number }> = ({ frame }) => {
  const rot = interpolate(frame, [0, 60], [0, 360]);
  return (
    <div style={{ position: 'absolute', top: '12%', right: '8%', opacity: 0.3 }}>
      <svg width="120" height="120" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="44" fill="none" stroke="white" strokeWidth="2" />
        <line x1="50" y1="50" x2="50" y2="18" stroke="white" strokeWidth="3" strokeLinecap="round" transform={`rotate(${rot * 12}, 50, 50)`} />
        <line x1="50" y1="50" x2="74" y2="50" stroke="white" strokeWidth="2.5" strokeLinecap="round" transform={`rotate(${rot}, 50, 50)`} />
        <circle cx="50" cy="50" r="3" fill="white" />
      </svg>
    </div>
  );
};

const FilmRoll: React.FC = () => (
  <AbsoluteFill style={{ pointerEvents: 'none', opacity: 0.15 }}>
    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 70, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', flexDirection: 'column', justifyContent: 'space-around', alignItems: 'center', borderRight: '1px solid rgba(255,255,255,0.1)' }}>
      {[...Array(12)].map((_, i) => <div key={i} style={{ width: 30, height: 42, border: '1.5px solid #555', borderRadius: 3, backgroundColor: '#111' }} />)}
    </div>
    <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 70, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', flexDirection: 'column', justifyContent: 'space-around', alignItems: 'center', borderLeft: '1px solid rgba(255,255,255,0.1)' }}>
      {[...Array(12)].map((_, i) => <div key={i} style={{ width: 30, height: 42, border: '1.5px solid #555', borderRadius: 3, backgroundColor: '#111' }} />)}
    </div>
  </AbsoluteFill>
);

const Magnifier: React.FC<{ frame: number }> = ({ frame }) => {
  const x = Math.sin(frame * 0.04) * 80;
  const y = Math.sin(frame * 0.03 + 1) * 40;
  return (
    <div style={{ position: 'absolute', right: '10%', bottom: '20%', transform: `translate(${x}px, ${y}px)`, opacity: 0.2 }}>
      <svg width="120" height="120" viewBox="0 0 100 100">
        <circle cx="40" cy="40" r="28" fill="rgba(255,255,255,0.05)" stroke="white" strokeWidth="4" />
        <line x1="60" y1="60" x2="88" y2="88" stroke="white" strokeWidth="7" strokeLinecap="round" />
      </svg>
    </div>
  );
};

const LockSecure: React.FC<{ frame: number; accent: string }> = ({ frame, accent }) => {
  const op = interpolate(frame, [0, 20], [0, 0.3], { extrapolateRight: 'clamp' });
  return (
    <div style={{ position: 'absolute', top: '15%', left: '8%', opacity: op }}>
      <svg width="80" height="80" viewBox="0 0 24 24" fill={accent}>
        <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
      </svg>
    </div>
  );
};

const CameraFlash: React.FC<{ frame: number }> = ({ frame }) => {
  const op = interpolate(frame, [0, 2, 12], [0, 0.85, 0], { extrapolateRight: 'clamp' });
  return <AbsoluteFill style={{ backgroundColor: 'white', opacity: op, pointerEvents: 'none' }} />;
};

// ─── 텍스트 애니메이션 ────────────────────────────────────────────────────────
function useTextAnim(style: string, localFrame: number, fps: number, duration: number, text: string) {
  let opacity = 1;
  let translateY = 0;
  let scale = 1;
  let letterSpacing = -0.02; // Change to number
  let displayText = text;

  const fadeIn  = interpolate(localFrame, [0, 10], [0, 1], { extrapolateRight: 'clamp' });
  const fadeOut = interpolate(localFrame, [duration - 10, duration], [1, 0], { extrapolateLeft: 'clamp' });
  opacity = Math.min(fadeIn, fadeOut);

  if (style === 'fly-in') {
    const spr = spring({ frame: localFrame, fps, config: { damping: 14, stiffness: 70 } });
    translateY = interpolate(spr, [0, 1], [140, 0]);
    opacity = Math.min(interpolate(localFrame, [0, 12], [0, 1], { extrapolateRight: 'clamp' }), fadeOut);
  } else if (style === 'typewriter') {
    const chars = Math.floor(interpolate(localFrame, [0, Math.min(35, duration * 0.75)], [0, text.length], { extrapolateRight: 'clamp' }));
    displayText = text.slice(0, chars);
    opacity = fadeOut;
    translateY = 0;
  } else if (style === 'pop-in') {
    const spr = spring({ frame: localFrame, fps, config: { damping: 8, stiffness: 250, mass: 0.4 } });
    scale = interpolate(spr, [0, 1], [0.1, 1]);
    opacity = Math.min(interpolate(localFrame, [0, 6], [0, 1], { extrapolateRight: 'clamp' }), fadeOut);
  } else if (style === 'fade-zoom') {
    const spr = spring({ frame: localFrame, fps, config: { damping: 22, stiffness: 55 } });
    scale = interpolate(spr, [0, 1], [0.82, 1]);
    letterSpacing = interpolate(spr, [0, 1], [0.08, -0.02]);
  } else if (style === 'pulse-ring' || style === 'sparkle') {
    const spr = spring({ frame: localFrame, fps, config: { damping: 18, stiffness: 90 } });
    scale = interpolate(spr, [0, 1], [0.9, 1]);
    opacity = Math.min(interpolate(localFrame, [0, 8], [0, 1], { extrapolateRight: 'clamp' }), fadeOut);
  } else if (style === 'thunder' || style === 'camera-flash') {
    opacity = Math.min(interpolate(localFrame, [4, 14], [0, 1], { extrapolateRight: 'clamp' }), fadeOut);
    scale = interpolate(Math.min(localFrame, 14), [4, 14], [1.08, 1], { extrapolateRight: 'clamp' });
  } else if (style === 'confetti' || style === 'heart') {
    const spr = spring({ frame: localFrame, fps, config: { damping: 12, stiffness: 120 } });
    translateY = interpolate(spr, [0, 1], [80, 0]);
    opacity = Math.min(interpolate(localFrame, [0, 10], [0, 1], { extrapolateRight: 'clamp' }), fadeOut);
  } else if (style === 'stagger-words' || style === 'kinetic-bounce' || style === 'focus-highlight') {
    translateY = 0;
    scale = 1;
    // Parent container just handles fade out. Wait, we want the whole container to fade in gracefully as well.
    opacity = Math.min(interpolate(localFrame, [0, 6], [0, 1], { extrapolateRight: 'clamp' }), fadeOut);
  } else {
    // 기본: 위에서 아래로 부드럽게
    const spr = spring({ frame: localFrame, fps, config: { damping: 20, stiffness: 80 } });
    translateY = interpolate(spr, [0, 1], [-60, 0]);
    opacity = Math.min(interpolate(localFrame, [0, 8], [0, 1], { extrapolateRight: 'clamp' }), fadeOut);
  }

  return { opacity, translateY, scale, letterSpacing, displayText };
}

// ─── 메인 텍스트 렌더러 (displayText 기준, 씬 전체 duration) ──────────────────
function MainDisplay({
  text, animStyle, sceneFrame, sceneDuration, fps, p, fontFamily,
}: {
  text: string; animStyle: string; sceneFrame: number; sceneDuration: number;
  fps: number; p: ReturnType<typeof pal>; fontFamily: string;
}) {
  const { opacity, translateY, scale, letterSpacing, displayText: animText } = useTextAnim(
    animStyle, sceneFrame, fps, sceneDuration, text
  );
  const textLen = text.replace(/\*\*/g, '').length;
  const fontSize = textLen <= 6 ? 200 : textLen <= 10 ? 170 : textLen <= 16 ? 140 : textLen <= 22 ? 115 : 90;
  const mainColor = p.text;
  const glowColor = p.dark ? `${p.accent}55` : 'transparent';

  const commonSpanStyle: React.CSSProperties = {
    display: 'block',
    fontWeight: 900,
    letterSpacing: `${letterSpacing}em`,
    lineHeight: 1.1,
    fontFamily: `"${fontFamily}", "Noto Sans KR", sans-serif`,
    wordBreak: 'keep-all',
  };

  return (
    <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 80px 120px' }}>
      <div style={{ opacity, transform: `translateY(${translateY}px) scale(${scale})`, textAlign: 'center', maxWidth: '100%' }}>
        {animStyle === 'typewriter' ? (
          <span style={{ ...commonSpanStyle, fontSize, color: p.accent }}>
            {animText}
            {Math.floor(sceneFrame / 8) % 2 === 0 && <span style={{ opacity: 0.8 }}>|</span>}
          </span>
        ) : (
          <span style={{ ...commonSpanStyle, fontSize, color: mainColor, textShadow: `0 0 80px ${glowColor}` }}>
            {['stagger-words', 'kinetic-bounce', 'focus-highlight'].includes(animStyle) ? (
              text.split(' ').map((rawWord, i, arr) => {
                const isMarkup = rawWord.startsWith('**') && rawWord.endsWith('**');
                const word = isMarkup ? rawWord.slice(2, -2) : rawWord;
                let wordOpacity = 1, wordTransY = 0, wordScale = 1, wordColor = mainColor;

                if (animStyle === 'stagger-words') {
                  const wFrame = Math.max(0, sceneFrame - i * 5);
                  const spr = spring({ frame: wFrame, fps, config: { damping: 14, stiffness: 100 } });
                  wordTransY = interpolate(spr, [0, 1], [60, 0]);
                  wordOpacity = interpolate(wFrame, [0, 6], [0, 1], { extrapolateRight: 'clamp' });
                } else if (animStyle === 'kinetic-bounce') {
                  const wFrame = Math.max(0, sceneFrame - i * 4);
                  const spr = spring({ frame: wFrame, fps, config: { damping: 5, stiffness: 200, mass: 0.4 } });
                  wordScale = interpolate(spr, [0, 1], [0.1, 1]);
                  wordOpacity = interpolate(wFrame, [0, 4], [0, 1], { extrapolateRight: 'clamp' });
                } else if (animStyle === 'focus-highlight') {
                  const timePerWord = sceneDuration / Math.max(1, arr.length);
                  const focusStart = i * timePerWord;
                  const focusEnd = focusStart + timePerWord + 5;
                  const isFocused = sceneFrame >= focusStart && sceneFrame <= focusEnd;
                  wordColor = isFocused ? p.accent : p.dark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)';
                  const sprScale = spring({ frame: Math.max(0, sceneFrame - focusStart), fps, config: { damping: 12, stiffness: 150 } });
                  const unScale = spring({ frame: Math.max(0, sceneFrame - focusEnd), fps, config: { damping: 12, stiffness: 150 } });
                  wordScale = 1 + (0.2 * sprScale) - (0.2 * unScale);
                }

                const finalColor = isMarkup ? p.accent : wordColor;
                const finalScale = isMarkup ? wordScale * 1.2 : wordScale;
                return (
                  <span key={i} style={{
                    display: 'inline-block', marginRight: '0.2em',
                    opacity: wordOpacity, color: finalColor,
                    transform: `translateY(${wordTransY}px) scale(${finalScale})`,
                    textShadow: isMarkup ? `0 0 50px ${p.accent}99` : 'none',
                    transformOrigin: 'center', willChange: 'transform, opacity, color',
                  }}>{word}</span>
                );
              })
            ) : animText}
          </span>
        )}
        {/* accent 언더라인 */}
        <div style={{
          height: 3, background: p.accent, borderRadius: 2, marginTop: 24,
          opacity: opacity * 0.8, transform: `scaleX(${scale})`, transformOrigin: 'center',
        }} />
      </div>
    </AbsoluteFill>
  );
}

// ─── 하단 자막 (나레이션 전체, 타이밍 맞춤) ──────────────────────────────────
function SubtitleBar({ subtitles, frame, fontFamily, dark }: {
  subtitles: { text: string; startFrame: number; endFrame: number }[];
  frame: number; fontFamily: string; dark: boolean;
}) {
  const current = subtitles.find(s => frame >= s.startFrame && frame < s.endFrame);
  if (!current) return null;
  const localFrame = frame - current.startFrame;
  const dur = current.endFrame - current.startFrame;
  const fadeIn = interpolate(localFrame, [0, 6], [0, 1], { extrapolateRight: 'clamp' });
  const fadeOut = interpolate(localFrame, [dur - 6, dur], [1, 0], { extrapolateLeft: 'clamp' });
  const opacity = Math.min(fadeIn, fadeOut);
  const text = current.text.replace(/\*\*/g, '');
  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 40 }}>
      <span style={{
        opacity,
        fontSize: 28,
        fontWeight: 600,
        color: dark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.75)',
        textShadow: dark ? '0 2px 8px rgba(0,0,0,0.8)' : '0 1px 4px rgba(255,255,255,0.6)',
        background: dark ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.5)',
        padding: '8px 24px',
        borderRadius: 8,
        maxWidth: '85%',
        textAlign: 'center',
        lineHeight: 1.5,
        fontFamily: `"${fontFamily}", "Noto Sans KR", sans-serif`,
        wordBreak: 'keep-all',
        display: 'block',
      }}>{text}</span>
    </AbsoluteFill>
  );
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────
export const KineticSceneComponent: React.FC<Props> = ({ scene, sceneIndex, fontFamily = 'Noto Sans KR' }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const animStyle = scene.textAnimationStyle ?? 'stagger-words';
  const p = pal(sceneIndex);

  // displayText: LLM이 생성한 핵심 포인트.
  // 없으면 scene.text 앞부분을 슬로건으로 사용 (최대 25자, 문장 경계 우선)
  const rawFallback = scene.subtitles[0]?.text || scene.subtitles[0]?.text || '';
  const fallback = (() => {
    const src = scene.displayText?.trim() || rawFallback;
    if (!src) return '';
    // 첫 문장 끝(. ! ?)까지만, 없으면 25자 자름
    const m = src.match(/^[^.!?]{1,25}[.!?]?/);
    return m ? m[0].trim() : src.slice(0, 25).trim();
  })();
  const headline = fallback;

  // 중앙 spotlight radial gradient (모든 스타일 공통)
  const spotOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ background: `linear-gradient(145deg, ${p.bg1} 0%, ${p.bg2} 100%)`, overflow: 'hidden' }}>
      {scene.audioUrl && <Audio src={scene.audioUrl} />}

      {/* 중앙 spotlight — 공통 배경 효과 */}
      <AbsoluteFill style={{ opacity: spotOpacity, pointerEvents: 'none' }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: `radial-gradient(ellipse 80% 60% at 50% 45%, ${p.accent}22 0%, ${p.bg2}88 60%, transparent 100%)`,
        }} />
      </AbsoluteFill>

      {/* 씬별 배경 효과 */}
      {animStyle === 'sparkle'     && <Sparkle frame={frame} accent={p.accent} />}
      {animStyle === 'rain'        && <Rain frame={frame} />}
      {animStyle === 'snow'        && <Snow frame={frame} />}
      {animStyle === 'fire'        && <Fire frame={frame} accent={p.accent} />}
      {animStyle === 'heart'       && <Heart frame={frame} accent={p.accent} />}
      {animStyle === 'stars'       && <Stars frame={frame} />}
      {animStyle === 'confetti'    && <Confetti frame={frame} />}
      {animStyle === 'pulse-ring'  && <PulseRing frame={frame} accent={p.accent} />}
      {animStyle === 'thunder'     && <Thunder frame={frame} />}
      {animStyle === 'chart-up'    && <ChartUp frame={frame} accent={p.accent} />}
      {animStyle === 'clock-spin'  && <ClockSpin frame={frame} />}
      {animStyle === 'film-roll'   && <FilmRoll />}
      {animStyle === 'magnifier'   && <Magnifier frame={frame} />}
      {animStyle === 'lock-secure' && <LockSecure frame={frame} accent={p.accent} />}
      {animStyle === 'camera-flash'&& <CameraFlash frame={frame} />}

      {/* 상단 accent 라인 */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, transparent, ${p.accent}, transparent)`,
        opacity: 0.7,
      }} />

      {/* 화면 중앙: 핵심 포인트 — headline이 없어도 항상 렌더링 */}
      <MainDisplay
        text={headline}
        animStyle={animStyle}
        sceneFrame={frame}
        sceneDuration={durationInFrames}
        fps={fps}
        p={p}
        fontFamily={fontFamily}
      />

      {/* 하단: 나레이션 전체 자막 (타이밍에 맞춰) */}
      <SubtitleBar subtitles={scene.subtitles} frame={frame} fontFamily={fontFamily} dark={p.dark} />
    </AbsoluteFill>
  );
};
