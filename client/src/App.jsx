import { Routes, Route, Navigate } from 'react-router-dom'
import useAuthStore from './store/authStore'

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

// Protected Route wrapper
const ProtectedRoute = ({ children, allowedRole }) => {
  const { user, token } = useAuthStore()
  if (!token || !user) return <Navigate to="/login" replace />
  if (allowedRole && user.role !== allowedRole) {
    return <Navigate to={user.role === 'teacher' ? '/teacher/dashboard' : '/student/dashboard'} replace />
  }
  return children
}

export default function App() {
  const { user } = useAuthStore()

  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Default redirect */}
      <Route path="/" element={
        user?.role === 'teacher'
          ? <Navigate to="/teacher/dashboard" replace />
          : user?.role === 'student'
          ? <Navigate to="/student/dashboard" replace />
          : <Navigate to="/login" replace />
      } />

      {/* Teacher Routes */}
      <Route path="/teacher/dashboard" element={<ProtectedRoute allowedRole="teacher"><TeacherDashboard /></ProtectedRoute>} />
      <Route path="/teacher/courses" element={<ProtectedRoute allowedRole="teacher"><TeacherCourses /></ProtectedRoute>} />
      <Route path="/teacher/assessments" element={<ProtectedRoute allowedRole="teacher"><TeacherAssessments /></ProtectedRoute>} />
      <Route path="/teacher/performance" element={<ProtectedRoute allowedRole="teacher"><TeacherPerformance /></ProtectedRoute>} />

      {/* Student Routes */}
      <Route path="/student/dashboard" element={<ProtectedRoute allowedRole="student"><StudentDashboard /></ProtectedRoute>} />
      <Route path="/student/courses" element={<ProtectedRoute allowedRole="student"><StudentCourses /></ProtectedRoute>} />
      <Route path="/student/assessments" element={<ProtectedRoute allowedRole="student"><StudentAssessments /></ProtectedRoute>} />
      <Route path="/student/performance" element={<ProtectedRoute allowedRole="student"><StudentPerformance /></ProtectedRoute>} />
      <Route path="/student/ai-tutor" element={<ProtectedRoute allowedRole="student"><AITutor /></ProtectedRoute>} />
      <Route path="/student/flashcards" element={<ProtectedRoute allowedRole="student"><Flashcards /></ProtectedRoute>} />
      <Route path="/student/study-sessions" element={<ProtectedRoute allowedRole="student"><StudySessions /></ProtectedRoute>} />

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}