import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import useAuthStore from '../../store/authStore'

const teacherLinks = [
  { path: '/teacher/dashboard',   label: 'Dashboard',    icon: '🏠' },
  { path: '/teacher/courses',     label: 'Courses',      icon: '📚' },
  { path: '/teacher/assessments', label: 'Assessments',  icon: '📝' },
  { path: '/teacher/performance', label: 'Performance',  icon: '📊' },
]

const studentLinks = [
  { path: '/student/dashboard',      label: 'Dashboard',      icon: '🏠' },
  { path: '/student/courses',        label: 'My Courses',     icon: '📚' },
  { path: '/student/assessments',    label: 'Assessments',    icon: '📝' },
  { path: '/student/performance',    label: 'Performance',    icon: '📊' },
  { path: '/student/ai-tutor',       label: 'AI Tutor',       icon: '🤖' },
  { path: '/student/flashcards',     label: 'Flashcards',     icon: '🃏' },
  { path: '/student/study-sessions', label: 'Study Tracker',  icon: '⏱️' },
]

export default function Layout({ children }) {
  const { user, logout } = useAuthStore()
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const links = user?.role === 'teacher' ? teacherLinks : studentLinks
  const roleColor = user?.role === 'teacher' ? 'purple' : 'blue'

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-slate-900 flex">

      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-16'} transition-all duration-300 bg-slate-800/80 border-r border-slate-700/50 flex flex-col`}>

        {/* Logo */}
        <div className="p-4 border-b border-slate-700/50 flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${user?.role === 'teacher' ? 'bg-purple-600' : 'bg-blue-600'}`}>
            <span className="text-lg">🎓</span>
          </div>
          {sidebarOpen && (
            <div>
              <h1 className="text-white font-bold text-sm">KalviAI</h1>
              <p className={`text-xs capitalize ${user?.role === 'teacher' ? 'text-purple-400' : 'text-blue-400'}`}>
                {user?.role} Portal
              </p>
            </div>
          )}
        </div>

        {/* Nav Links */}
        <nav className="flex-1 p-3 space-y-1">
          {links.map((link) => {
            const isActive = location.pathname === link.path
            return (
              <Link
                key={link.path}
                to={link.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? user?.role === 'teacher'
                      ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30'
                      : 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <span className="text-base flex-shrink-0">{link.icon}</span>
                {sidebarOpen && <span>{link.label}</span>}
              </Link>
            )
          })}
        </nav>

        {/* User Info + Logout */}
        <div className="p-3 border-t border-slate-700/50">
          {sidebarOpen && (
            <div className="flex items-center gap-3 px-3 py-2 mb-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 ${user?.role === 'teacher' ? 'bg-purple-600' : 'bg-blue-600'}`}>
                {user?.name?.charAt(0).toUpperCase()}
              </div>
              <div className="overflow-hidden">
                <p className="text-white text-sm font-medium truncate">{user?.name}</p>
                <p className="text-slate-500 text-xs capitalize">{user?.role}</p>
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
          >
            <span className="flex-shrink-0">🚪</span>
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Top Bar */}
        <header className="bg-slate-800/50 border-b border-slate-700/50 px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-slate-400 hover:text-white transition-colors text-xl"
          >
            ☰
          </button>
          <div className="flex items-center gap-3">
            <span className="text-slate-400 text-sm">Welcome back,</span>
            <span className="text-white text-sm font-semibold">{user?.name}</span>
            <div className={`w-2 h-2 rounded-full ${user?.role === 'teacher' ? 'bg-purple-400' : 'bg-blue-400'}`} />
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}