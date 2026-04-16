'use client';

import { useEffect, useState } from 'react';

function getInitialDark(): boolean {
  if (typeof window === 'undefined') return true;
  const stored = localStorage.getItem('theme');
  return stored ? stored === 'dark' : true;
}

export function useTheme() {
  const [isDark, setIsDark] = useState(getInitialDark);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    document.documentElement.classList.toggle('light', !isDark);
  }, [isDark]);

  function toggle() {
    const next = !isDark;
    setIsDark(next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', next);
    document.documentElement.classList.toggle('light', !next);
  }

  return { isDark, toggle };
}
