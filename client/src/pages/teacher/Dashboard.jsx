import { useEffect, useState } from 'react'
import Layout from '../../components/shared/Layout'
import api from '../../lib/axios'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

export default function TeacherDashboard() {
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.get('/courses')
        setCourses(res.data)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const stats = [
    { label: 'Total Courses',     value: courses.length,                                          icon: '📚', color: 'purple' },
    { label: 'Total Students',    value: courses.reduce((s, c) => s + (c.students?.length || 0), 0), icon: '🧑‍🎓', color: 'blue' },
    { label: 'Published Courses', value: courses.filter(c => c.isPublished).length,               icon: '✅', color: 'green' },
    { label: 'Draft Courses',     value: courses.filter(c => !c.isPublished).length,              icon: '📄', color: 'yellow' },
  ]

  const chartData = courses.map(c => ({
    name: c.title.length > 12 ? c.title.slice(0, 12) + '...' : c.title,
    students: c.students?.length || 0,
  }))

  const colorMap = {
    purple: 'bg-purple-500/10 border-purple-500/30 text-purple-400',
    blue:   'bg-blue-500/10 border-blue-500/30 text-blue-400',
    green:  'bg-green-500/10 border-green-500/30 text-green-400',
    yellow: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400',
  }

  return (
    <Layout>
      <div className="space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white">Teacher Dashboard</h1>
          <p className="text-slate-400 text-sm mt-1">Overview of your courses and students</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <div key={stat.label} className={`border rounded-2xl p-5 ${colorMap[stat.color]}`}>
              <div className="text-2xl mb-2">{stat.icon}</div>
              <div className="text-2xl font-bold text-white">{stat.value}</div>
              <div className="text-sm mt-1 opacity-80">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Chart */}
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6">
          <h2 className="text-white font-semibold mb-4">Students per Course</h2>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 12 }} />
                <YAxis stroke="#94a3b8" tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px', color: '#fff' }}
                />
                <Bar dataKey="students" fill="#a855f7" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-slate-500">
              No courses yet. Create your first course!
            </div>
          )}
        </div>

        {/* Recent Courses */}
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6">
          <h2 className="text-white font-semibold mb-4">Your Courses</h2>
          {loading ? (
            <div className="text-slate-400 text-sm">Loading...</div>
          ) : courses.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-slate-500 text-sm">No courses yet.</p>
              <a href="/teacher/courses" className="text-purple-400 text-sm hover:underline mt-1 inline-block">
                Create your first course →
              </a>
            </div>
          ) : (
            <div className="space-y-3">
              {courses.map((course) => (
                <div key={course._id} className="flex items-center justify-between bg-slate-700/30 rounded-xl px-4 py-3">
                  <div>
                    <p className="text-white text-sm font-medium">{course.title}</p>
                    <p className="text-slate-400 text-xs mt-0.5">{course.students?.length || 0} students enrolled</p>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${course.isPublished ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-400'}`}>
                    {course.isPublished ? 'Published' : 'Draft'}
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