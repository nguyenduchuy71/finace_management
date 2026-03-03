import { create } from 'zustand'

type Theme = 'light' | 'dark'

interface ThemeState {
  theme: Theme
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
}

function applyTheme(theme: Theme) {
  const root = document.documentElement
  if (theme === 'dark') {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
  localStorage.setItem('finance-theme', theme)
}

function getInitialTheme(): Theme {
  const stored = localStorage.getItem('finance-theme') as Theme | null
  return stored === 'dark' ? 'dark' : 'light'
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
  setTheme: (theme) => {
    applyTheme(theme)
    set({ theme })
  },
}))
