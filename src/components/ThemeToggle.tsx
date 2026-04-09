'use client';

import { useTheme } from '@/lib/useTheme';

export default function ThemeToggle() {
  const { isDark, toggle } = useTheme();

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? '라이트 모드로 전환' : '다크 모드로 전환'}
      className="group relative flex items-center shrink-0"
      style={{ width: 44, height: 24 }}
    >
      {/* 트랙 */}
      <span
        className="absolute inset-0 rounded-full transition-all duration-500"
        style={{
          background: isDark
            ? 'linear-gradient(135deg, #0f0c29 0%, #1a1a3e 50%, #24243e 100%)'
            : 'linear-gradient(135deg, #f7971e 0%, #ffd200 100%)',
          boxShadow: isDark
            ? 'inset 0 1px 4px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.07)'
            : 'inset 0 1px 3px rgba(0,0,0,0.1), 0 0 0 1px rgba(255,180,0,0.3), 0 0 8px rgba(255,200,0,0.2)',
        }}
      />

      {/* 다크: 별 장식들 */}
      <span className="absolute transition-all duration-300 select-none"
        style={{ right: 6, top: 4, fontSize: 7, color: '#fff', opacity: isDark ? 0.8 : 0, transitionDelay: isDark ? '0.15s' : '0s' }}>★</span>
      <span className="absolute transition-all duration-300 select-none"
        style={{ right: 13, bottom: 5, fontSize: 5, color: '#c8d6ff', opacity: isDark ? 0.5 : 0, transitionDelay: isDark ? '0.25s' : '0s' }}>●</span>
      <span className="absolute transition-all duration-300 select-none"
        style={{ right: 9, top: 7, fontSize: 4, color: '#a0b4ff', opacity: isDark ? 0.4 : 0, transitionDelay: isDark ? '0.2s' : '0s' }}>●</span>

      {/* 라이트: 햇살 ray들 */}
      {[0, 45, 90, 135].map((deg, i) => (
        <span
          key={deg}
          className="absolute transition-all duration-300 select-none"
          style={{
            left: 6,
            top: '50%',
            width: 2,
            height: 2,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.9)',
            transform: `translateY(-50%) rotate(${deg}deg) translateX(${isDark ? 0 : 7}px)`,
            opacity: isDark ? 0 : 0.7,
            transitionDelay: `${i * 0.04}s`,
          }}
        />
      ))}

      {/* 썸 */}
      <span
        className="absolute flex items-center justify-center rounded-full transition-all duration-500"
        style={{
          width: 18,
          height: 18,
          top: 3,
          left: isDark ? 3 : 23,
          background: isDark
            ? 'linear-gradient(135deg, #d4d4e8 0%, #b8b8d0 100%)'
            : 'linear-gradient(135deg, #ffffff 0%, #fff0a0 100%)',
          boxShadow: isDark
            ? '0 1px 4px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.3)'
            : '0 0 0 2px rgba(255,210,0,0.4), 0 2px 6px rgba(255,160,0,0.4), inset 0 1px 0 rgba(255,255,255,0.8)',
        }}
      >
        {/* 달 크레이터 */}
        {isDark ? (
          <>
            <span className="absolute block rounded-full"
              style={{ width: 5, height: 5, background: 'rgba(80,80,110,0.35)', top: 3, left: 8 }} />
            <span className="absolute block rounded-full"
              style={{ width: 3, height: 3, background: 'rgba(80,80,110,0.25)', top: 7, left: 4 }} />
          </>
        ) : (
          /* 태양 중심 광점 */
          <span className="block rounded-full"
            style={{ width: 6, height: 6, background: 'radial-gradient(circle, #ffd700 0%, #ffaa00 100%)', boxShadow: '0 0 4px rgba(255,200,0,0.6)' }} />
        )}
      </span>
    </button>
  );
}
