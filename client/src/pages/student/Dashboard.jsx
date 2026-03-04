import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../../components/shared/Layout'
import api from '../../lib/axios'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import useAuthStore from '../../store/authStore'

export default function StudentDashboard() {
  const { user } = useAuthStore()
  const [performance, setPerformance] = useState(null)
  const [courses, setCourses] = useState([])
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [perfRes, courseRes, sessionRes] = await Promise.all([
          api.get('/performance/me'),
          api.get('/courses'),
          api.get('/study-sessions/my'),
        ])
        setPerformance(perfRes.data)
        setCourses(courseRes.data)
        setSessions(sessionRes.data)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const stats = [
    { label: 'Enrolled Courses',  value: courses.length,                                icon: '📚', color: 'blue'   },
    { label: 'Assessments Taken', value: performance?.totalAttempted || 0,              icon: '📝', color: 'purple' },
    { label: 'Average Score',     value: `${Math.round(performance?.averageScore || 0)}%`, icon: '🎯', color: 'green'  },
    { label: 'Study Sessions',    value: sessions.length,                               icon: '⏱️', color: 'yellow' },
  ]

  const chartData = performance?.submissions?.slice(-7).map((sub, i) => ({
    name: `#${i + 1}`,
    score: Math.round(sub.percentage || 0),
  })) || []

  const colorMap = {
    blue:   'bg-blue-500/10 border-blue-500/30 text-blue-400',
    purple: 'bg-purple-500/10 border-purple-500/30 text-purple-400',
    green:  'bg-green-500/10 border-green-500/30 text-green-400',
    yellow: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400',
  }

  const quickLinks = [
    { label: 'AI Tutor',      path: '/student/ai-tutor',       icon: '🤖', desc: 'Get help from AI'       },
    { label: 'Flashcards',    path: '/student/flashcards',     icon: '🃏', desc: 'Quick revision'         },
    { label: 'Study Tracker', path: '/student/study-sessions', icon: '⏱️', desc: 'Track your study time' },
    { label: 'Assessments',   path: '/student/assessments',    icon: '📝', desc: 'Take your assessments' },
  ]

  return (
    <Layout>
      <div className="space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white">
            Welcome back, {user?.name?.split(' ')[0]} 👋
          </h1>
          <p className="text-slate-400 text-sm mt-1">Here's your learning overview</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className={`border rounded-2xl p-5 ${colorMap[stat.color]}`}
            >
              <div className="text-2xl mb-2">{stat.icon}</div>
              <div className="text-2xl font-bold text-white">{stat.value}</div>
              <div className="text-sm mt-1 opacity-80">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Performance Chart */}
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6">
          <h2 className="text-white font-semibold mb-4">Recent Assessment Scores</h2>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 12 }} />
                <YAxis stroke="#94a3b8" domain={[0, 100]} tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '12px',
                    color: '#fff',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ fill: '#3b82f6', r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-40 flex items-center justify-center text-slate-500 text-sm">
              No assessments taken yet. Start one to see your progress!
            </div>
          )}
        </div>

        {/* Quick Access */}
        <div>
          <h2 className="text-white font-semibold mb-3">Quick Access</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {quickLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className="bg-slate-800/60 border border-slate-700/50 hover:border-blue-500/40 rounded-2xl p-4 transition-all hover:bg-slate-700/50 block"
              >
                <div>
                  <div className="text-2xl mb-2">{link.icon}</div>
                  <p className="text-white text-sm font-medium">{link.label}</p>
                  <p className="text-slate-500 text-xs mt-0.5">{link.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Enrolled Courses */}
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6">
          <h2 className="text-white font-semibold mb-4">Enrolled Courses</h2>
          {loading ? (
            <div className="text-slate-400 text-sm">Loading...</div>
          ) : courses.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-slate-500 text-sm">You're not enrolled in any courses yet.</p>
              <Link
                to="/student/courses"
                className="text-blue-400 text-sm hover:underline mt-1 inline-block"
              >
                Browse courses →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {courses.map((course) => (
                <div
                  key={course._id}
                  className="flex items-center justify-between bg-slate-700/30 rounded-xl px-4 py-3"
                >
                  <div>
                    <p className="text-white text-sm font-medium">{course.title}</p>
                    <p className="text-slate-400 text-xs mt-0.5">
                      by {course.teacher?.name}
                    </p>
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 font-medium">
                    Enrolled
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </Layout>
  )
}