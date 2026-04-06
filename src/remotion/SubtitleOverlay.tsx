import { AbsoluteFill, interpolate, useCurrentFrame, spring, useVideoConfig } from 'remotion';
import { makeStar } from '@remotion/shapes';
import { SubtitleWord } from './types';

type Props = {
  subtitles: SubtitleWord[];
  style?: 'none' | 'typewriter' | 'fly-in' | 'pop-in' | 'fade-zoom' | 'clock-spin' | 'pulse-ring' | 'sparkle' | 'confetti' | 'rain' | 'snow' | 'fire' | 'heart' | 'stars' | 'thunder' | 'chart-up' | 'film-roll' | 'magnifier' | 'lock-secure' | 'camera-flash' | 'stagger-words' | 'kinetic-bounce' | 'focus-highlight';
  position?: 'bottom' | 'center' | 'top';
  fontFamily?: string;
};

const ClockSpin: React.FC<{ frame: number }> = ({ frame }) => {
  const rotation = interpolate(frame, [0, 60], [0, 360]);
  return (
    <div style={{ position: 'absolute', top: '15%', right: '10%', opacity: 0.6 }}>
      <svg width="140" height="140" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="45" fill="none" stroke="white" strokeWidth="2" />
        <line x1="50" y1="50" x2="50" y2="20" stroke="white" strokeWidth="4" strokeLinecap="round" transform={`rotate(${rotation * 12}, 50, 50)`} />
        <line x1="50" y1="50" x2="75" y2="50" stroke="white" strokeWidth="3" strokeLinecap="round" transform={`rotate(${rotation}, 50, 50)`} />
      </svg>
    </div>
  );
};

const PulseRing: React.FC<{ frame: number }> = ({ frame }) => {
  const progress = (frame % 30) / 30;
  const scale = interpolate(progress, [0, 1], [0.5, 2.5]);
  const opacity = interpolate(progress, [0, 0.4, 1], [0, 0.5, 0]);
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', pointerEvents: 'none' }}>
      <div style={{ width: 400, height: 400, borderRadius: '50%', border: '6px solid white', transform: `scale(${scale})`, opacity }} />
      <div style={{ position: 'absolute', width: 250, height: 250, borderRadius: '50%', border: '3px solid white', transform: `scale(${scale * 0.7})`, opacity: opacity * 0.7 }} />
    </AbsoluteFill>
  );
};

const Sparkle: React.FC<{ frame: number }> = ({ frame }) => {
  const { path, width, height } = makeStar({ innerRadius: 5, outerRadius: 13, points: 5 });
  return (
    <AbsoluteFill>
      {[...Array(8)].map((_, i) => {
        const seed = i * 45678;
        const x = (Math.sin(seed + frame * 0.04) * 45 + 50) + '%';
        const y = (Math.cos(seed + frame * 0.06) * 45 + 50) + '%';
        const opacity = interpolate(Math.sin(frame * 0.15 + i), [-1, 1], [0, 0.7]);
        const scale = interpolate(Math.sin(frame * 0.1 + i), [-1, 1], [0.5, 1.2]);
        const rotation = frame * 3 + i * 45;
        return (
          <div key={i} style={{ position: 'absolute', left: x, top: y, opacity, transform: `scale(${scale}) rotate(${rotation}deg)` }}>
            <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
              <path d={path} fill="white" />
            </svg>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

const Confetti: React.FC<{ frame: number }> = ({ frame }) => {
  return (
    <AbsoluteFill>
      {[...Array(20)].map((_, i) => {
        const fall = interpolate(frame + (i * 10), [0, 60], [-50, 1050]);
        const rotate = frame * 5 + i * 20;
        const color = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff'][i % 5];
        return (
          <div key={i} style={{ position: 'absolute', left: (i * 5) + '%', top: fall, transform: `rotate(${rotate}deg)`, width: 15, height: 15, backgroundColor: color, borderRadius: i % 3 === 0 ? '50%' : '0' }} />
        );
      })}
    </AbsoluteFill>
  );
};

const Rain: React.FC<{ frame: number }> = ({ frame }) => {
  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      {[...Array(30)].map((_, i) => {
        const fall = ((frame * 20 + i * 50) % 1200) - 100;
        return (
          <div key={i} style={{ position: 'absolute', left: (i * 3.3) + '%', top: fall, width: 2, height: 40, backgroundColor: 'rgba(255,255,255,0.4)', borderRadius: 2 }} />
        );
      })}
    </AbsoluteFill>
  );
};

const Snow: React.FC<{ frame: number }> = ({ frame }) => {
  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      {[...Array(40)].map((_, i) => {
        const fall = ((frame * 3 + i * 40) % 1100) - 100;
        const drift = Math.sin(frame * 0.05 + i) * 20;
        return (
          <div key={i} style={{ position: 'absolute', left: (i * 2.5) + '%' + ` + ${drift}px`, top: fall, width: 8, height: 8, backgroundColor: 'white', borderRadius: '50%', opacity: 0.8 }} />
        );
      })}
    </AbsoluteFill>
  );
};

const Fire: React.FC<{ frame: number }> = ({ frame }) => {
  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center' }}>
      {[...Array(12)].map((_, i) => {
        const height = interpolate(Math.sin(frame * 0.2 + i), [-1, 1], [150, 300]);
        const opacity = interpolate(Math.sin(frame * 0.3 + i), [-1, 1], [0.3, 0.7]);
        return (
          <div key={i} style={{ position: 'absolute', left: (i * 8) + '%', bottom: -50, width: 60, height, background: 'linear-gradient(to top, #ff4d00, #ff9d00, transparent)', borderRadius: '50% 50% 0 0', opacity, filter: 'blur(10px)' }} />
        );
      })}
    </AbsoluteFill>
  );
};

const Heart: React.FC<{ frame: number }> = ({ frame }) => {
  return (
    <AbsoluteFill>
      {[...Array(6)].map((_, i) => {
        const up = interpolate(frame + (i * 15), [0, 90], [1100, -100]);
        const drift = Math.sin(frame * 0.1 + i) * 30;
        return (
          <div key={i} style={{ position: 'absolute', left: (20 + i * 12) + '%', top: up, transform: `translateX(${drift}px)`, opacity: 0.8 }}>
            <svg width="50" height="50" viewBox="0 0 24 24" fill="#ff4b2b">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

const Stars: React.FC<{ frame: number }> = ({ frame }) => {
  return (
    <AbsoluteFill>
      {[...Array(50)].map((_, i) => {
        const seed = i * 999;
        const x = (Math.cos(seed) * 50 + 50) + '%';
        const y = (Math.sin(seed * 2) * 50 + 50) + '%';
        const opacity = interpolate(Math.sin(frame * 0.1 + i), [-1, 1], [0.1, 0.9]);
        return (
          <div key={i} style={{ position: 'absolute', left: x, top: y, width: 3, height: 3, backgroundColor: 'white', borderRadius: '50%', opacity, boxShadow: '0 0 5px white' }} />
        );
      })}
    </AbsoluteFill>
  );
};

const Thunder: React.FC<{ frame: number }> = ({ frame }) => {
  // 씬 시작 시 1회만 번개: 0~4프레임 플래시, 10~13프레임 잔광
  const isMainFlash = frame < 5;
  const isAfterGlow = frame >= 10 && frame < 14;
  const opacity = isMainFlash ? 0.85 : isAfterGlow ? 0.3 : 0;
  if (opacity === 0) return null;
  return (
    <AbsoluteFill style={{ backgroundColor: `rgba(200,220,255,${opacity})` }}>
      <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path d="M50 0 L30 50 L60 40 L40 100" stroke="white" strokeWidth="2" fill="none" opacity={isMainFlash ? 1 : 0.4} />
      </svg>
    </AbsoluteFill>
  );
};

const ChartUp: React.FC<{ frame: number }> = ({ frame }) => {
  const len = interpolate(frame, [0, 30], [0, 200]);
  return (
    <div style={{ position: 'absolute', top: '30%', right: '15%' }}>
      <svg width="250" height="150" viewBox="0 0 200 100">
        <path d="M10 90 L50 70 L90 80 L140 40 L190 10" stroke="#00ffcc" strokeWidth="5" fill="none" strokeDasharray="300" strokeDashoffset={300 - len} />
        <path d="M180 15 L190 10 L185 20" stroke="#00ffcc" strokeWidth="5" fill="none" opacity={len > 180 ? 1 : 0} />
      </svg>
    </div>
  );
};

const FilmRoll: React.FC = () => {
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 100, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', flexDirection: 'column', justifyContent: 'space-around', alignItems: 'center' }}>
        {[...Array(10)].map((_, i) => <div key={i} style={{ width: 40, height: 60, border: '2px solid #555', borderRadius: 4 }} />)}
      </div>
      <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 100, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', flexDirection: 'column', justifyContent: 'space-around', alignItems: 'center' }}>
        {[...Array(10)].map((_, i) => <div key={i} style={{ width: 40, height: 60, border: '2px solid #555', borderRadius: 4 }} />)}
      </div>
    </AbsoluteFill>
  );
};

const Magnifier: React.FC<{ frame: number }> = ({ frame }) => {
  const x = Math.sin(frame * 0.05) * 100 + 100;
  return (
    <div style={{ position: 'absolute', right: '15%', top: '25%', transform: `translateX(${x}px)` }}>
      <svg width="150" height="150" viewBox="0 0 100 100">
        <circle cx="40" cy="40" r="30" fill="rgba(255,255,255,0.1)" stroke="white" strokeWidth="4" />
        <line x1="62" y1="62" x2="90" y2="90" stroke="white" strokeWidth="8" strokeLinecap="round" />
      </svg>
    </div>
  );
};

const LockSecure: React.FC<{ frame: number }> = ({ frame }) => {
  const opacity = interpolate(frame, [0, 15], [0, 0.8]);
  return (
    <div style={{ position: 'absolute', top: '20%', right: '10%', opacity }}>
      <svg width="100" height="100" viewBox="0 0 24 24" fill="white">
        <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
      </svg>
    </div>
  );
};

const CameraFlash: React.FC<{ frame: number }> = ({ frame }) => {
  // 씬 시작 시 1회만 플래시
  const opacity = interpolate(frame, [0, 2, 12], [0, 0.9, 0], { extrapolateRight: 'clamp' });
  return <AbsoluteFill style={{ backgroundColor: 'white', opacity }} />;
};

// 배경 효과 컴포넌트 목록 (씬 전체 duration 동안 지속)
const BG_EFFECTS = ['clock-spin','pulse-ring','sparkle','confetti','rain','snow','fire','heart','stars','thunder','chart-up','film-roll','magnifier','lock-secure','camera-flash'];

export const SubtitleOverlay: React.FC<Props> = ({
  subtitles,
  style = 'none',
  position = 'bottom',
  fontFamily = 'Noto Sans KR',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const currentSubtitleRaw = subtitles.find(
    (s) => frame >= s.startFrame && frame < s.endFrame
  );

  // [Normalizer] 1줄 보장: 27자 초과 시 문장 구조 기준으로 쪼개서 순차 출력
  const SUBTITLE_MAX = 27;

  function smartSplitSubtitle(text: string): string[] {
    const chunks: string[] = [];
    let rem = text.trim();
    while (rem.length > 0) {
      if (rem.length <= SUBTITLE_MAX) { chunks.push(rem); break; }
      let cut = -1;
      // 1순위: 문장 종결 부호
      for (let i = Math.min(rem.length - 1, SUBTITLE_MAX); i >= 6; i--) {
        if (/[.!?…。]/.test(rem[i])) { cut = i + 1; break; }
      }
      // 2순위: 쉼표/가운뎃점
      if (cut < 0) for (let i = Math.min(rem.length - 1, SUBTITLE_MAX); i >= 6; i--) {
        if (/[,，、·]/.test(rem[i])) { cut = i + 1; break; }
      }
      // 3순위: 공백
      if (cut < 0) for (let i = Math.min(rem.length - 1, SUBTITLE_MAX); i >= 6; i--) {
        if (rem[i] === ' ') { cut = i + 1; break; }
      }
      // 4순위: 강제 컷
      if (cut < 0) cut = SUBTITLE_MAX;
      chunks.push(rem.slice(0, cut).trim());
      rem = rem.slice(cut).trim();
    }
    return chunks.filter(c => c.length > 0);
  }

  const normalizedSubtitle = (() => {
    if (!currentSubtitleRaw) return null;
    const text = currentSubtitleRaw.text.trim();
    if (text.length <= SUBTITLE_MAX) return currentSubtitleRaw;

    const chunks = smartSplitSubtitle(text);
    // chunks.length <= 1이라도 text가 SUBTITLE_MAX 초과면 강제 컷
    if (chunks.length <= 1) {
      const clipped = text.slice(0, SUBTITLE_MAX);
      return { text: clipped, startFrame: currentSubtitleRaw.startFrame, endFrame: currentSubtitleRaw.endFrame };
    }

    const duration = currentSubtitleRaw.endFrame - currentSubtitleRaw.startFrame;
    const totalChars = chunks.reduce((s, c) => s + c.length, 0);

    // 현재 프레임이 어느 청크에 속하는지 계산
    let elapsed = 0;
    for (const chunk of chunks) {
      const chunkFrames = Math.round((chunk.length / totalChars) * duration);
      const chunkStart = currentSubtitleRaw.startFrame + elapsed;
      const chunkEnd = chunkStart + chunkFrames;
      if (frame < chunkEnd || chunk === chunks[chunks.length - 1]) {
        return { text: chunk, startFrame: chunkStart, endFrame: chunkEnd };
      }
      elapsed += chunkFrames;
    }
    return currentSubtitleRaw;
  })();

  // 위치 스타일
  const positionStyles: Record<string, React.CSSProperties> = {
    bottom: { justifyContent: 'flex-end', paddingBottom: 120 }, // PPT와 겹치지 않게 여유 공간 확보
    center: { justifyContent: 'center' },
    top: { justifyContent: 'flex-start', paddingTop: 80 },
  };

  // 배경 효과는 자막 여부와 무관하게 씬 전체에서 항상 렌더링
  const isBgEffect = BG_EFFECTS.includes(style);

  // 자막 없을 때: 배경 효과만 렌더링 (텍스트 없음)
  if (!normalizedSubtitle) {
    if (!isBgEffect) return null;
    return (
      <AbsoluteFill style={{ alignItems: 'center', ...positionStyles[position] }}>
        {style === 'clock-spin' && <ClockSpin frame={frame} />}
        {style === 'pulse-ring' && <PulseRing frame={frame} />}
        {style === 'sparkle' && <Sparkle frame={frame} />}
        {style === 'confetti' && <Confetti frame={frame} />}
        {style === 'rain' && <Rain frame={frame} />}
        {style === 'snow' && <Snow frame={frame} />}
        {style === 'fire' && <Fire frame={frame} />}
        {style === 'heart' && <Heart frame={frame} />}
        {style === 'stars' && <Stars frame={frame} />}
        {style === 'thunder' && <Thunder frame={frame} />}
        {style === 'chart-up' && <ChartUp frame={frame} />}
        {style === 'film-roll' && <FilmRoll />}
        {style === 'magnifier' && <Magnifier frame={frame} />}
        {style === 'lock-secure' && <LockSecure frame={frame} />}
        {style === 'camera-flash' && <CameraFlash frame={frame} />}
      </AbsoluteFill>
    );
  }

  const currentFrameInSubtitle = frame - normalizedSubtitle.startFrame;
  const subtitleDuration = normalizedSubtitle.endFrame - normalizedSubtitle.startFrame;

  // 기본 애니메이션 (None / Fade)
  const fadeIn = interpolate(currentFrameInSubtitle, [0, 5], [0, 1], { extrapolateRight: 'clamp' });
  const fadeOut = interpolate(currentFrameInSubtitle, [subtitleDuration - 5, subtitleDuration], [1, 0], { extrapolateLeft: 'clamp' });
  let opacity = Math.min(fadeIn, fadeOut);
  let translateY = interpolate(fadeIn, [0, 1], [10, 0]);
  let scale = 1;
  let text = normalizedSubtitle.text;

  // 1. 타이핑 효과 (Typewriter)
  if (style === 'typewriter') {
    const charsToShow = Math.floor(interpolate(currentFrameInSubtitle, [0, Math.min(20, subtitleDuration * 0.8)], [0, text.length], { extrapolateRight: 'clamp' }));
    text = text.slice(0, charsToShow);
    translateY = 0;
  }

  // 2. Fly-in
  if (style === 'fly-in') {
    const spr = spring({ frame: currentFrameInSubtitle, fps, config: { damping: 12 } });
    translateY = interpolate(spr, [0, 1], [100, 0]);
  }

  // 3. Pop-in / Fade-zoom
  if (style === 'pop-in' || style === 'fade-zoom') {
    const spr = spring({ frame: currentFrameInSubtitle, fps, config: { mass: 0.5 } });
    scale = interpolate(spr, [0, 1], [0.8, 1]);
  }

  return (
    <AbsoluteFill
      style={{
        alignItems: 'center',
        ...positionStyles[position],
        zIndex: 9999, // 최상단 노출 보장
        pointerEvents: 'none' // 클릭 이벤트 방해 금지
      }}
    >
      {/* 배경 효과: 씬 전체 frame 기준으로 지속 실행 */}
      {style === 'clock-spin' && <ClockSpin frame={frame} />}
      {style === 'pulse-ring' && <PulseRing frame={frame} />}
      {style === 'sparkle' && <Sparkle frame={frame} />}
      {style === 'confetti' && <Confetti frame={frame} />}
      {style === 'rain' && <Rain frame={frame} />}
      {style === 'snow' && <Snow frame={frame} />}
      {style === 'fire' && <Fire frame={frame} />}
      {style === 'heart' && <Heart frame={frame} />}
      {style === 'stars' && <Stars frame={frame} />}
      {style === 'thunder' && <Thunder frame={frame} />}
      {style === 'chart-up' && <ChartUp frame={frame} />}
      {style === 'film-roll' && <FilmRoll />}
      {style === 'magnifier' && <Magnifier frame={frame} />}
      {style === 'lock-secure' && <LockSecure frame={frame} />}
      {style === 'camera-flash' && <CameraFlash frame={frame} />}

      <div
        style={{
          opacity,
          transform: `translateY(${translateY}px) scale(${scale})`,
          maxWidth: '90%',
          textAlign: 'center',
          zIndex: 10,
        }}
      >
        <span
          style={{
            fontSize: position === 'center' ? 58 : 44,
            fontWeight: 800,
            color: '#FFFFFF',
            textShadow: '0 2px 12px rgba(0,0,0,0.9), 0 0 25px rgba(0,0,0,0.6)',
            lineHeight: 1.3,
            letterSpacing: '0.01em',
            display: 'inline-block',
            whiteSpace: 'nowrap',        // ← 1행 강제
            padding: '10px 24px',
            background: position === 'center' ? 'rgba(0,0,0,0.65)' : 'rgba(0,0,0,0.4)',
            borderRadius: 14,
            fontFamily: `"${fontFamily}", "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`,
          }}
        >
          {text.split(' ').map((rawWord, i) => {
            const isMarkup = rawWord.includes('**');
            const word = rawWord.replace(/\*\*/g, '');
            return (
              <span key={i} style={{ 
                color: isMarkup ? '#facc15' : 'inherit',
                fontSize: isMarkup ? '1.15em' : 'inherit',
                marginRight: '0.25em',
                display: 'inline-block'
              }}>
                {word}
              </span>
            );
          })}
          {style === 'typewriter' &&
           currentFrameInSubtitle < Math.min(20, subtitleDuration * 0.8) &&
           Math.floor(frame / 10) % 2 === 0 && (
            <span style={{ marginLeft: 2, color: '#facc15' }}>|</span>
          )}
        </span>
      </div>
    </AbsoluteFill>
  );
};
