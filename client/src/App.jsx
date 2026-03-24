import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import useAuthStore from './store/authStore'
import useThemeStore from './store/themeStore'

// Auth Pages
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'

// Teacher Pages
import TeacherDashboard from './pages/teacher/Dashboard'
import TeacherCourses from './pages/teacher/Courses'
import TeacherAssessments from './pages/teacher/Assessments'
import TeacherPerformance from './pages/teacher/Performance'

// Student Pages
import StudentDashboard from './pages/student/Dashboard'
import StudentCourses from './pages/student/Courses'
import StudentAssessments from './pages/student/Assessments'
import StudentPerformance from './pages/student/Performance'
import AITutor from './pages/student/AITutor'
import Flashcards from './pages/student/Flashcards'
import StudySessions from './pages/student/StudySessions'
import ParentDashboard from './pages/parent/Dashboard'
import WorkspacePage from './pages/shared/Workspace'

const getDashboardPath = (role) => {
  if (role === 'teacher') return '/teacher/dashboard'
  if (role === 'parent') return '/parent/dashboard'
  return '/student/dashboard'
}

// Protected Route wrapper
const ProtectedRoute = ({ children, allowedRole }) => {
  const { user, token, initialized } = useAuthStore()
  
  if (!initialized) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4 shadow-lg shadow-blue-500/30 animate-pulse">
            <span className="text-2xl">🎓</span>
          </div>
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    )
  }
  
  if (!token || !user) return <Navigate to="/login" replace />
  if (allowedRole && user.role !== allowedRole) {
    return <Navigate to={getDashboardPath(user.role)} replace />
  }
  return children
}

export default function App() {
  const { user, setInitialized } = useAuthStore()
  const initializeTheme = useThemeStore((s) => s.initializeTheme)
  const [isInitializing, setIsInitializing] = useState(true)

  // Initialize auth state on app load
  useEffect(() => {
    const checkAuth = async () => {
      try {
        initializeTheme()
        // Auth state is loaded from localStorage in authStore
        // Just set initialized flag after component mounts
        setInitialized(true)
      } catch (error) {
        console.error('Auth initialization error:', error)
      } finally {
        setIsInitializing(false)
      }
    }
    
    checkAuth()
  }, [initializeTheme, setInitialized])

  // Show splash screen while initializing
  if (isInitializing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        </div>
        <div className="text-center relative">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4 shadow-lg shadow-blue-500/30 animate-pulse">
            <span className="text-2xl">🎓</span>
          </div>
          <h1 className="text-2xl font-bold text-white">KalviAI</h1>
          <p className="text-slate-400 mt-2">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <Routes>
      {/* Public Routes - Show login first for unauthenticated users */}
      <Route path="/login" element={!user ? <Login /> : <Navigate to={getDashboardPath(user.role)} replace />} />
      <Route path="/register" element={!user ? <Register /> : <Navigate to={getDashboardPath(user.role)} replace />} />

      {/* Default redirect */}
      <Route path="/" element={
        user?.role
          ? <Navigate to={getDashboardPath(user.role)} replace />
          : <Navigate to="/login" replace />
      } />

      {/* Teacher Routes */}
      <Route path="/teacher/dashboard" element={<ProtectedRoute allowedRole="teacher"><TeacherDashboard /></ProtectedRoute>} />
      <Route path="/teacher/courses" element={<ProtectedRoute allowedRole="teacher"><TeacherCourses /></ProtectedRoute>} />
      <Route path="/teacher/assessments" element={<ProtectedRoute allowedRole="teacher"><TeacherAssessments /></ProtectedRoute>} />
      <Route path="/teacher/performance" element={<ProtectedRoute allowedRole="teacher"><TeacherPerformance /></ProtectedRoute>} />
      <Route path="/teacher/workspace" element={<ProtectedRoute allowedRole="teacher"><WorkspacePage /></ProtectedRoute>} />

      {/* Student Routes */}
      <Route path="/student/dashboard" element={<ProtectedRoute allowedRole="student"><StudentDashboard /></ProtectedRoute>} />
      <Route path="/student/courses" element={<ProtectedRoute allowedRole="student"><StudentCourses /></ProtectedRoute>} />
      <Route path="/student/assessments" element={<ProtectedRoute allowedRole="student"><StudentAssessments /></ProtectedRoute>} />
      <Route path="/student/performance" element={<ProtectedRoute allowedRole="student"><StudentPerformance /></ProtectedRoute>} />
      <Route path="/student/ai-tutor" element={<ProtectedRoute allowedRole="student"><AITutor /></ProtectedRoute>} />
      <Route path="/student/flashcards" element={<ProtectedRoute allowedRole="student"><Flashcards /></ProtectedRoute>} />
      <Route path="/student/study-sessions" element={<ProtectedRoute allowedRole="student"><StudySessions /></ProtectedRoute>} />
      <Route path="/student/workspace" element={<ProtectedRoute allowedRole="student"><WorkspacePage /></ProtectedRoute>} />

      {/* Parent Routes */}
      <Route path="/parent/dashboard" element={<ProtectedRoute allowedRole="parent"><ParentDashboard /></ProtectedRoute>} />
      <Route path="/parent/workspace" element={<ProtectedRoute allowedRole="parent"><WorkspacePage /></ProtectedRoute>} />

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
