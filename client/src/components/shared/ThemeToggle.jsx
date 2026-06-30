import useThemeStore from '../../store/themeStore'

export default function ThemeToggle() {
  const { theme, toggleTheme } = useThemeStore()

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`retro-button px-4 py-2 ${theme === 'dark' ? 'bg-[#97e675]' : 'bg-white'}`}
    >
      {theme === 'dark' ? 'Light mode' : 'Dark mode'}
    </button>
  )
}
