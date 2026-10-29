import { create } from 'zustand'
import { readString, writeString } from '@/lib/persisted-json'

const THEME_KEY = 'finance-theme'

type Theme = 'light' | 'dark'

interface ThemeState {
  theme: Theme
  toggleTheme: () => void
}

function applyTheme(theme: Theme) {
  const root = document.documentElement
  if (theme === 'dark') {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
  writeString(THEME_KEY, theme)
}

function getInitialTheme(): Theme {
  return readString(THEME_KEY) === 'dark' ? 'dark' : 'light'
}

const initialTheme = getInitialTheme()
// Apply immediately on module load to prevent flash
applyTheme(initialTheme)

export const useThemeStore = create<ThemeState>()((set) => ({
  theme: initialTheme,
  toggleTheme: () =>
    set((state) => {
      const next: Theme = state.theme === 'light' ? 'dark' : 'light'
      applyTheme(next)
      return { theme: next }
    }),
}))
