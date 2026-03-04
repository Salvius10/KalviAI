import { useEffect, useState } from 'react'
import Layout from '../../components/shared/Layout'
import api from '../../lib/axios'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, LineChart, Line, PieChart, Pie, Cell
} from 'recharts'

export default function TeacherPerformance() {
  const [courses, setCourses] = useState([])
  const [selectedCourse, setSelectedCourse] = useState('')
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const res = await api.get('/courses')
        setCourses(res.data)
        if (res.data.length > 0) setSelectedCourse(res.data[0]._id)
      } catch (err) { console.error(err) }
    }
    fetchCourses()
  }, [])

  useEffect(() => {
    if (!selectedCourse) return
    const fetchSubmissions = async () => {
      setLoading(true)
      try {
        const res = await api.get(`/performance/course/${selectedCourse}`)
        setSubmissions(res.data)
      } catch (err) { console.error(err) } finally { setLoading(false) }
    }
    fetchSubmissions()
  }, [selectedCourse])

  // Group by student
  const studentMap = {}
  submissions.forEach((sub) => {
    const name = sub.student?.name || 'Unknown'
    if (!studentMap[name]) studentMap[name] = { name, scores: [], total: 0, count: 0 }
    studentMap[name].scores.push(sub.percentage)
    studentMap[name].total += sub.percentage
    studentMap[name].count += 1
  })

  const studentData = Object.values(studentMap).map((s) => ({
    name: s.name,
    average: Math.round(s.total / s.count),
    attempts: s.count,
  }))

  const plagiarismCount = submissions.filter(s => s.plagiarismFlag).length
  const passed = submissions.filter(s => s.percentage >= 70).length
  const failed = submissions.filter(s => s.percentage < 70).length

  const pieData = [
    { name: 'Passed (≥70%)', value: passed, color: '#22c55e' },
    { name: 'Failed (<70%)', value: failed, color: '#ef4444' },
  ]

  const stats = [
    { label: 'Total Submissions', value: submissions.length,                         icon: '📝', color: 'bg-purple-500/10 border-purple-500/30 text-purple-400' },
    { label: 'Average Score',     value: submissions.length ? `${Math.round(submissions.reduce((s, sub) => s + sub.percentage, 0) / submissions.length)}%` : '0%', icon: '🎯', color: 'bg-blue-500/10 border-blue-500/30 text-blue-400' },
    { label: 'Passed',            value: passed,                                      icon: '✅', color: 'bg-green-500/10 border-green-500/30 text-green-400' },
    { label: 'Plagiarism Flags',  value: plagiarismCount,                             icon: '⚠️', color: 'bg-red-500/10 border-red-500/30 text-red-400' },
  ]

  return (
    <Layout>
      <div className="space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white">Performance Analytics</h1>
            <p className="text-slate-400 text-sm mt-1">Track how your students are performing</p>
          </div>
          <select
            value={selectedCourse}
            onChange={(e) => setSelectedCourse(e.target.value)}
            className="bg-slate-800/60 border border-slate-700/50 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
          >
            {courses.map(c => <option key={c._id} value={c._id}>{c.title}</option>)}
          </select>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <div key={stat.label} className={`border rounded-2xl p-5 ${stat.color}`}>
              <div className="text-2xl mb-2">{stat.icon}</div>
              <div className="text-2xl font-bold text-white">{stat.value}</div>
              <div className="text-sm mt-1 opacity-80">{stat.label}</div>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="text-slate-400 text-sm">Loading performance data...</div>
        ) : submissions.length === 0 ? (
          <div className="text-center py-16 bg-slate-800/60 border border-slate-700/50 rounded-2xl">
            <p className="text-4xl mb-3">📊</p>
            <p className="text-white font-semibold">No submissions yet</p>
            <p className="text-slate-400 text-sm mt-1">Students haven't submitted any assessments for this course</p>
          </div>
        ) : (
          <>
            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

              {/* Bar Chart */}
              <div className="lg:col-span-2 bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6">
                <h2 className="text-white font-semibold mb-4">Average Score per Student</h2>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={studentData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                    <YAxis stroke="#94a3b8" domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px', color: '#fff' }} />
                    <Bar dataKey="average" fill="#a855f7" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Pie Chart */}
              <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6">
                <h2 className="text-white font-semibold mb-4">Pass / Fail Ratio</h2>
                {passed + failed > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={160}>
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value">
                          {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px', color: '#fff' }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-1.5 mt-2">
                      {pieData.map((d) => (
                        <div key={d.name} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                            <span className="text-slate-300">{d.name}</span>
                          </div>
                          <span className="text-white font-medium">{d.value}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="h-40 flex items-center justify-center text-slate-500 text-sm">No data</div>
                )}
              </div>
            </div>

            {/* Student Table */}
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6">
              <h2 className="text-white font-semibold mb-4">Student Submissions</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-slate-400 text-xs border-b border-slate-700/50">
                      <th className="text-left pb-3 font-medium">Student</th>
                      <th className="text-left pb-3 font-medium">Assessment</th>
                      <th className="text-left pb-3 font-medium">Score</th>
                      <th className="text-left pb-3 font-medium">Marks</th>
                      <th className="text-left pb-3 font-medium">Status</th>
                      <th className="text-left pb-3 font-medium">Plagiarism</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/30">
                    {submissions.map((sub) => (
                      <tr key={sub._id} className="text-slate-300">
                        <td className="py-3">
                          <div>
                            <p className="text-white text-xs font-medium">{sub.student?.name}</p>
                            <p className="text-slate-500 text-xs">{sub.student?.email}</p>
                          </div>
                        </td>
                        <td className="py-3 text-xs">{sub.assessment?.title || 'N/A'}</td>
                        <td className="py-3">
                          <span className={`text-xs font-bold ${sub.percentage >= 70 ? 'text-green-400' : sub.percentage >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                            {Math.round(sub.percentage)}%
                          </span>
                        </td>
                        <td className="py-3 text-xs">{sub.totalScore}/{sub.maxScore}</td>
                        <td className="py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${sub.percentage >= 70 ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                            {sub.percentage >= 70 ? 'Passed' : 'Failed'}
                          </span>
                        </td>
                        <td className="py-3">
                          {sub.plagiarismFlag ? (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-400">⚠️ Flagged</span>
                          ) : (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-400">✅ Clean</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  )
}