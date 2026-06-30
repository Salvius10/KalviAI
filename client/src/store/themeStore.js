import { create } from 'zustand'

const applyTheme = (theme) => {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle('dark-mode', theme === 'dark')
  document.body.classList.toggle('dark-mode', theme === 'dark')
}

const getStoredTheme = () => {
  if (typeof window === 'undefined') return 'light'
  return localStorage.getItem('theme') || 'light'
}

const useThemeStore = create((set) => ({
  theme: getStoredTheme(),
  initializeTheme: () => {
    const theme = getStoredTheme()
    applyTheme(theme)
    set({ theme })
  },
  toggleTheme: () =>
    set((state) => {
      const nextTheme = state.theme === 'dark' ? 'light' : 'dark'
      localStorage.setItem('theme', nextTheme)
      applyTheme(nextTheme)
      return { theme: nextTheme }
    }),
}))

export default useThemeStore
