import { useEffect, useState } from 'react'
import Layout from '../../components/shared/Layout'
import api from '../../lib/axios'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, BarChart, Bar, RadialBarChart, RadialBar
} from 'recharts'

export default function StudentPerformance() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await api.get('/performance/me')
        setData(res.data)
      } catch (err) { console.error(err) } finally { setLoading(false) }
    }
    fetch()
  }, [])

  if (loading) return <Layout><div className="text-slate-400 text-sm p-6">Loading...</div></Layout>

  const submissions = data?.submissions || []
  const avg = Math.round(data?.averageScore || 0)

  const lineData = submissions.map((sub, i) => ({
    name: `#${i + 1}`,
    score: Math.round(sub.percentage || 0),
    topic: sub.assessment?.topic || '',
  }))

  const topicMap = {}
  submissions.forEach((sub) => {
    const topic = sub.assessment?.topic || 'General'
    if (!topicMap[topic]) topicMap[topic] = { scores: [], total: 0, count: 0 }
    topicMap[topic].scores.push(sub.percentage)
    topicMap[topic].total += sub.percentage
    topicMap[topic].count += 1
  })

  const topicData = Object.entries(topicMap).map(([topic, val]) => ({
    topic: topic.length > 10 ? topic.slice(0, 10) + '...' : topic,
    average: Math.round(val.total / val.count),
  }))

  const stats = [
    { label: 'Assessments Taken', value: submissions.length,              icon: '📝', color: 'bg-blue-500/10 border-blue-500/30 text-blue-400' },
    { label: 'Average Score',     value: `${avg}%`,                       icon: '🎯', color: 'bg-purple-500/10 border-purple-500/30 text-purple-400' },
    { label: 'Highest Score',     value: submissions.length ? `${Math.round(Math.max(...submissions.map(s => s.percentage)))}%` : '0%', icon: '🏆', color: 'bg-green-500/10 border-green-500/30 text-green-400' },
    { label: 'Lowest Score',      value: submissions.length ? `${Math.round(Math.min(...submissions.map(s => s.percentage)))}%` : '0%', icon: '📉', color: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400' },
  ]

  return (
    <Layout>
      <div className="space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white">My Performance</h1>
          <p className="text-slate-400 text-sm mt-1">Track your learning progress over time</p>
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

        {submissions.length === 0 ? (
          <div className="text-center py-16 bg-slate-800/60 border border-slate-700/50 rounded-2xl">
            <p className="text-4xl mb-3">📊</p>
            <p className="text-white font-semibold">No data yet</p>
            <p className="text-slate-400 text-sm mt-1">Take some assessments to see your performance here</p>
          </div>
        ) : (
          <>
            {/* Score Over Time */}
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6">
              <h2 className="text-white font-semibold mb-4">Score Over Time</h2>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={lineData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 12 }} />
                  <YAxis stroke="#94a3b8" domain={[0, 100]} tick={{ fontSize: 12 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px', color: '#fff' }} />
                  <Line type="monotone" dataKey="score" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6', r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Topic Performance */}
            {topicData.length > 0 && (
              <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6">
                <h2 className="text-white font-semibold mb-4">Performance by Topic</h2>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={topicData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="topic" stroke="#94a3b8" tick={{ fontSize: 12 }} />
                    <YAxis stroke="#94a3b8" domain={[0, 100]} tick={{ fontSize: 12 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px', color: '#fff' }} />
                    <Bar dataKey="average" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Submissions History */}
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6">
              <h2 className="text-white font-semibold mb-4">Submission History</h2>
              <div className="space-y-3">
                {submissions.map((sub, i) => (
                  <div key={sub._id} className="flex items-center justify-between bg-slate-700/30 rounded-xl px-4 py-3">
                    <div>
                      <p className="text-white text-sm font-medium">
                        {sub.assessment?.title || `Assessment #${i + 1}`}
                      </p>
                      <div className="flex items-center gap-3 mt-0.5">
                        {sub.assessment?.topic && (
                          <span className="text-slate-400 text-xs">🏷️ {sub.assessment.topic}</span>
                        )}
                        {sub.assessment?.difficulty && (
                          <span className="text-slate-400 text-xs capitalize">📊 {sub.assessment.difficulty}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-bold ${sub.percentage >= 70 ? 'text-green-400' : sub.percentage >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {Math.round(sub.percentage)}%
                      </p>
                      <p className="text-slate-400 text-xs">{sub.totalScore}/{sub.maxScore} marks</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  )
}