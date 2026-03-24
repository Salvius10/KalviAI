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
  const [performance, setPerformance] = useState(null)
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
        setPerformance(res.data)
      } catch (err) { console.error(err) } finally { setLoading(false) }
    }
    fetchSubmissions()
  }, [selectedCourse])

  const submissions = performance?.submissions || []
  const slowLearners = performance?.slowLearners || []
  const studentData = (performance?.studentAnalytics || []).map((student) => ({
    name: student.name,
    average: Math.round(student.averageScore),
    attempts: student.attempts,
    bestScore: Math.round(student.bestScore),
  }))

  const assessmentTrendData = (performance?.assessmentBreakdown || []).map((assessment) => ({
    title: assessment.title,
    averageScore: Math.round(assessment.averageScore),
    passRate: Math.round(assessment.passRate),
  }))

  const plagiarismCount = performance?.overview?.plagiarismFlags || 0
  const passed = performance?.overview?.passCount || 0
  const failed = performance?.overview?.failCount || 0

  const pieData = [
    { name: 'Passed (≥70%)', value: passed, color: '#22c55e' },
    { name: 'Failed (<70%)', value: failed, color: '#ef4444' },
  ]

  const stats = [
    { label: 'Total Submissions', value: performance?.overview?.totalSubmissions || 0, icon: '📝', color: 'bg-purple-500/10 border-purple-500/30 text-purple-400' },
    { label: 'Average Score',     value: `${Math.round(performance?.overview?.averageScore || 0)}%`, icon: '🎯', color: 'bg-blue-500/10 border-blue-500/30 text-blue-400' },
    { label: 'Active Students',   value: performance?.overview?.activeStudents || 0, icon: '👥', color: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400' },
    { label: 'Passed',            value: passed,                                      icon: '✅', color: 'bg-green-500/10 border-green-500/30 text-green-400' },
    { label: 'Slow Learners',     value: performance?.overview?.slowLearnerCount || 0, icon: '🧠', color: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300' },
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
        <div className="grid grid-cols-2 xl:grid-cols-6 gap-4">
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
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h2 className="text-white font-semibold">Early Identification of Slow Learners</h2>
                  <p className="text-slate-400 text-sm mt-1">
                    Based on average assessment marks. Students below 60% are surfaced for early teacher intervention.
                  </p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <span className="text-xs px-3 py-1 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                    High risk: {performance?.overview?.highRiskCount || 0}
                  </span>
                  <span className="text-xs px-3 py-1 rounded-full bg-yellow-500/10 text-yellow-300 border border-yellow-500/20">
                    Watchlist: {(performance?.overview?.slowLearnerCount || 0) - (performance?.overview?.highRiskCount || 0)}
                  </span>
                </div>
              </div>
              {slowLearners.length === 0 ? (
                <div className="mt-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-5 py-4 text-sm text-emerald-300">
                  No slow learners identified in this course from current marks.
                </div>
              ) : (
                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {slowLearners.map((student) => (
                    <div key={student.studentId} className="rounded-2xl border border-slate-700/50 bg-slate-900/60 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-white text-sm font-semibold">{student.name}</p>
                          <p className="text-slate-400 text-xs mt-1">{student.rollNo || 'No roll no'} • {student.email}</p>
                        </div>
                        <span className={`text-[11px] px-2.5 py-1 rounded-full border ${
                          student.learnerBand.status === 'high_risk'
                            ? 'bg-red-500/10 text-red-400 border-red-500/20'
                            : 'bg-yellow-500/10 text-yellow-300 border-yellow-500/20'
                        }`}>
                          {student.learnerBand.label}
                        </span>
                      </div>
                      <div className="mt-4 flex items-center gap-3 text-xs">
                        <span className="rounded-full bg-slate-800 px-3 py-1 text-white">
                          Avg {Math.round(student.averageScore)}%
                        </span>
                        <span className="rounded-full bg-slate-800 px-3 py-1 text-slate-300">
                          Attempts {student.scoredAttempts}
                        </span>
                        <span className="rounded-full bg-slate-800 px-3 py-1 text-slate-300">
                          Best {Math.round(student.bestScore)}%
                        </span>
                      </div>
                      <p className="text-slate-400 text-xs mt-3">{student.learnerBand.note}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

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

            <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6">
              <h2 className="text-white font-semibold mb-4">Assessment Trends</h2>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={assessmentTrendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="title" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#94a3b8" domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px', color: '#fff' }} />
                  <Line type="monotone" dataKey="averageScore" stroke="#60a5fa" strokeWidth={3} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="passRate" stroke="#22c55e" strokeWidth={3} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Student Table */}
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6">
              <h2 className="text-white font-semibold mb-4">Student Performance Summary</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-slate-400 text-xs border-b border-slate-700/50">
                      <th className="text-left pb-3 font-medium">Student</th>
                      <th className="text-left pb-3 font-medium">Roll No</th>
                      <th className="text-left pb-3 font-medium">Attempts</th>
                      <th className="text-left pb-3 font-medium">Average</th>
                      <th className="text-left pb-3 font-medium">Best</th>
                      <th className="text-left pb-3 font-medium">Learner Status</th>
                      <th className="text-left pb-3 font-medium">Pass / Fail</th>
                      <th className="text-left pb-3 font-medium">Last Submission</th>
                      <th className="text-left pb-3 font-medium">Flags</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/30">
                    {(performance?.studentAnalytics || []).map((student) => (
                      <tr key={student.studentId} className="text-slate-300">
                        <td className="py-3">
                          <div>
                            <p className="text-white text-xs font-medium">{student.name}</p>
                            <p className="text-slate-500 text-xs">{student.email}</p>
                          </div>
                        </td>
                        <td className="py-3 text-xs text-slate-300">{student.rollNo || 'N/A'}</td>
                        <td className="py-3 text-xs">{student.attempts}</td>
                        <td className="py-3">
                          <span className={`text-xs font-bold ${student.averageScore >= 70 ? 'text-green-400' : student.averageScore >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                            {Math.round(student.averageScore)}%
                          </span>
                        </td>
                        <td className="py-3 text-xs text-white">{Math.round(student.bestScore)}%</td>
                        <td className="py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            student.learnerBand?.status === 'high_risk'
                              ? 'bg-red-500/10 text-red-400'
                              : student.learnerBand?.status === 'watchlist'
                              ? 'bg-yellow-500/10 text-yellow-300'
                              : 'bg-green-500/10 text-green-400'
                          }`}>
                            {student.learnerBand?.label || 'On track'}
                          </span>
                        </td>
                        <td className="py-3">
                          <span className="text-xs text-slate-300">{student.passedCount} / {student.failedCount}</span>
                        </td>
                        <td className="py-3 text-xs text-slate-400">
                          {student.lastSubmittedAt ? new Date(student.lastSubmittedAt).toLocaleDateString() : 'N/A'}
                        </td>
                        <td className="py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${student.plagiarismFlags ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'}`}>
                            {student.plagiarismFlags ? `${student.plagiarismFlags} flagged` : 'Clean'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6">
              <h2 className="text-white font-semibold mb-4">Recent Assessment Submissions</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-slate-400 text-xs border-b border-slate-700/50">
                      <th className="text-left pb-3 font-medium">Student</th>
                      <th className="text-left pb-3 font-medium">Assessment</th>
                      <th className="text-left pb-3 font-medium">Score</th>
                      <th className="text-left pb-3 font-medium">Marks</th>
                      <th className="text-left pb-3 font-medium">Submitted</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/30">
                    {submissions.slice(0, 12).map((sub) => (
                      <tr key={sub._id} className="text-slate-300">
                        <td className="py-3 text-xs text-white">{sub.student?.name || 'Unknown'}</td>
                        <td className="py-3 text-xs">{sub.assessment?.title || 'N/A'}</td>
                        <td className="py-3 text-xs">{Math.round(sub.percentage)}%</td>
                        <td className="py-3 text-xs">{sub.totalScore}/{sub.maxScore}</td>
                        <td className="py-3 text-xs text-slate-400">
                          {sub.submittedAt ? new Date(sub.submittedAt).toLocaleString() : 'N/A'}
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
