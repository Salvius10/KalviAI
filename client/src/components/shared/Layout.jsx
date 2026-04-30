import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import useAuthStore from '../../store/authStore'
import useThemeStore from '../../store/themeStore'
import ThemeToggle from './ThemeToggle'

const teacherLinks = [
  { path: '/teacher/dashboard', label: 'Dashboard', icon: '🏠' },
  { path: '/teacher/workspace', label: 'Workspace', icon: '🧩' },
  { path: '/teacher/courses', label: 'Courses', icon: '📚' },
  { path: '/teacher/assessments', label: 'Assessments', icon: '📝' },
  { path: '/teacher/performance', label: 'Performance', icon: '📊' },
]

const studentLinks = [
  { path: '/student/dashboard',      label: 'Dashboard',     icon: '🏠' },
  { path: '/student/workspace',      label: 'Workspace',     icon: '🧩' },
  { path: '/student/courses',        label: 'My Courses',    icon: '📚' },
  { path: '/student/assessments',    label: 'Assessments',   icon: '📝' },
  { path: '/student/performance',    label: 'Performance',   icon: '📊' },
  { path: '/student/ai-tutor',       label: 'AI Tutor',      icon: '🤖' },
  { path: '/student/flashcards',     label: 'Flashcards',    icon: '🃏' },
  { path: '/student/study-sessions', label: 'Study Tracker', icon: '⏱️' },
  { path: '/student/learning-path',  label: 'Learning Path', icon: '🎯' },
  { path: '/student/analytics',      label: 'Analytics',     icon: '📈' },
]

const parentLinks = [
  { path: '/parent/dashboard', label: 'Parent Dashboard', icon: '🏠' },
  { path: '/parent/workspace', label: 'Workspace', icon: '🧩' },
]

const roleTheme = {
  teacher: {
    accent: 'bg-violet-400',
    soft: 'bg-violet-200',
    shell: 'bg-black',
  },
  student: {
    accent: 'bg-[#6fa8ff]',
    soft: 'bg-[#d9e9ff]',
    shell: 'bg-[#fff7d6]',
  },
  parent: {
    accent: 'bg-[#97e675]',
    soft: 'bg-[#e4ffd6]',
    shell: 'bg-[#fff0e4]',
  },
}

export default function Layout({ children }) {
  const { user, logout } = useAuthStore()
  const themeMode = useThemeStore((s) => s.theme)
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const links = user?.role === 'teacher'
    ? teacherLinks
    : user?.role === 'parent'
    ? parentLinks
    : studentLinks

  const theme = roleTheme[user?.role] || roleTheme.student
  const useBlackGrid = themeMode === 'dark' || user?.role === 'teacher'
  const workspacePath = user?.role === 'teacher'
    ? '/teacher/workspace'
    : user?.role === 'parent'
    ? '/parent/workspace'
    : '/student/workspace'

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div
      className={`theme-app min-h-screen ${useBlackGrid ? '' : 'retro-grid-bg'} ${useBlackGrid ? 'bg-black' : theme.shell}`}
      style={
        useBlackGrid
          ? {
              backgroundImage:
                'linear-gradient(to right, rgba(148,163,184,0.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.12) 1px, transparent 1px)',
              backgroundSize: '28px 28px',
            }
          : undefined
      }
    >
      <div className="mx-auto flex min-h-screen max-w-[1700px] gap-4 p-4 lg:p-5">
        <aside className={`${sidebarOpen ? 'w-72' : 'w-20'} retro-shell hidden shrink-0 flex-col overflow-hidden transition-all duration-300 lg:flex`}>
          <div className="border-b-[3px] border-black px-4 py-5">
            <div className="flex items-center gap-3">
              <div className={`flex h-12 w-12 items-center justify-center rounded-[18px] border-[3px] border-black text-xl ${theme.accent}`}>
                🎓
              </div>
              {sidebarOpen && (
                <div>
                  <p className="retro-title text-2xl">KalviAI</p>
                  <p className="retro-mono text-xs uppercase tracking-[0.2em] text-[color:color-mix(in_srgb,var(--retro-ink)_70%,transparent)]">{user?.role} portal</p>
                </div>
              )}
            </div>
          </div>

          <nav className="flex-1 space-y-3 p-4">
            {links.map((link) => {
              const isActive = location.pathname === link.path
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`flex items-center gap-3 rounded-[18px] border-[3px] border-black px-3 py-3 text-sm font-bold text-[color:var(--retro-ink)] transition-transform hover:-translate-y-0.5 ${
                    isActive ? `${theme.accent} shadow-[5px_5px_0_#111111]` : `${theme.soft} shadow-[3px_3px_0_#111111]`
                  }`}
                >
                  <span className="text-lg">{link.icon}</span>
                  {sidebarOpen && <span>{link.label}</span>}
                </Link>
              )
            })}
          </nav>

          <div className="border-t-[3px] border-black p-4">
            {sidebarOpen && (
              <div className="mb-3 rounded-[18px] border-[3px] border-black bg-white px-3 py-3 shadow-[4px_4px_0_#111111]">
                <p className="font-bold text-[color:var(--retro-ink)]">{user?.name}</p>
                <p className="retro-mono mt-1 text-xs uppercase tracking-[0.18em] text-[color:color-mix(in_srgb,var(--retro-ink)_70%,transparent)]">{user?.role}</p>
              </div>
            )}
            <button onClick={handleLogout} className="retro-button w-full bg-[#ff8db3]">
              <span>{sidebarOpen ? 'Logout' : '↗'}</span>
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <header className="retro-shell px-4 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button onClick={() => setSidebarOpen(!sidebarOpen)} className={`retro-button ${theme.accent} px-4 py-2`}>
                Menu
              </button>
              <div className="flex items-center gap-3">
                <ThemeToggle />
                <Link to={workspacePath} className="retro-chip bg-white">
                  Workspace
                </Link>
                <span className={`retro-chip ${theme.soft}`}>{user?.role}</span>
                <span className="font-bold text-[color:var(--retro-ink)]">Hi, {user?.name?.split(' ')[0]}</span>
              </div>
            </div>
          </header>

          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </div>
    </div>
  )
}
