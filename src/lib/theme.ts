import { useEffect, useState, useCallback } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'yukyu-theme';

function getStoredMode(): ThemeMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    // noop
  }
  return 'system';
}

function getSystemDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function resolveTheme(mode: ThemeMode): 'light' | 'dark' {
  return mode === 'system' ? (getSystemDark() ? 'dark' : 'light') : mode;
}

function applyTheme(theme: 'light' | 'dark') {
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
    root.style.colorScheme = 'dark';
  } else {
    root.classList.remove('dark');
    root.style.colorScheme = 'light';
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', theme === 'dark' ? '#000000' : '#f2f2f7');
  }
}

export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(() => getStoredMode());
  const [resolved, setResolved] = useState<'light' | 'dark'>(() => resolveTheme(getStoredMode()));

  useEffect(() => {
    const r = resolveTheme(mode);
    setResolved(r);
    applyTheme(r);
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // noop
    }
  }, [mode]);

  useEffect(() => {
    if (mode !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      const r = resolveTheme('system');
      setResolved(r);
      applyTheme(r);
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [mode]);

  const changeMode = useCallback((m: ThemeMode) => setMode(m), []);

  return { mode, resolved, changeMode };
}
