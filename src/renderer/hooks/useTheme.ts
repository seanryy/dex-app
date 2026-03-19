import { useState, useEffect, useCallback } from 'react'

export type ThemeMode = 'light' | 'dark'

export interface AccentColor {
  name: string
  hsl: [number, number, number]
}

export const ACCENT_PRESETS: AccentColor[] = [
  { name: 'Indigo',  hsl: [239, 84, 67] },
  { name: 'Blue',    hsl: [217, 91, 60] },
  { name: 'Cyan',    hsl: [189, 94, 43] },
  { name: 'Teal',    hsl: [168, 76, 42] },
  { name: 'Green',   hsl: [142, 71, 45] },
  { name: 'Yellow',  hsl: [45, 93, 47] },
  { name: 'Orange',  hsl: [25, 95, 53] },
  { name: 'Red',     hsl: [0, 84, 60] },
  { name: 'Pink',    hsl: [330, 81, 60] },
  { name: 'Purple',  hsl: [271, 81, 56] },
]

const STORAGE_KEY_MODE = 'dex-theme-mode'
const STORAGE_KEY_ACCENT = 'dex-accent-color'

function applyMode(mode: ThemeMode) {
  document.documentElement.setAttribute('data-theme', mode)
}

function applyAccent(hsl: [number, number, number]) {
  document.documentElement.style.setProperty('--accent-h', `${hsl[0]}`)
  document.documentElement.style.setProperty('--accent-s', `${hsl[1]}%`)
  document.documentElement.style.setProperty('--accent-l', `${hsl[2]}%`)
}

export function useTheme() {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    return (localStorage.getItem(STORAGE_KEY_MODE) as ThemeMode) || 'dark'
  })

  const [accent, setAccentState] = useState<AccentColor>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_ACCENT)
      if (stored) return JSON.parse(stored)
    } catch { /* ignore */ }
    return ACCENT_PRESETS[0]
  })

  useEffect(() => {
    applyMode(mode)
    applyAccent(accent.hsl)
  }, [])

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m)
    localStorage.setItem(STORAGE_KEY_MODE, m)
    applyMode(m)
  }, [])

  const setAccent = useCallback((a: AccentColor) => {
    setAccentState(a)
    localStorage.setItem(STORAGE_KEY_ACCENT, JSON.stringify(a))
    applyAccent(a.hsl)
  }, [])

  return { mode, accent, setMode, setAccent }
}
