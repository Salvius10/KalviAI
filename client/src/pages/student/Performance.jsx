import { useState, useCallback } from 'react'
import Layout from '../../components/shared/Layout'
import api from '../../lib/axios'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, BarChart, Bar, RadialBarChart, RadialBar
} from 'recharts'
import { useAutoRefresh, LiveBadge } from '../../lib/useAutoRefresh'

export default function StudentPerformance() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    try {
      const res = await api.get('/performance/me')
      setData(res.data)
    } catch (err) { console.error(err) } finally { setLoading(false) }
  }, [])

  const { secondsAgo, refresh } = useAutoRefresh(loadData, 30000)

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
    { label: 'Total Submissions',  value: submissions.length,                                                                              icon: '📝', color: 'bg-blue-500/10 border-blue-500/30 text-blue-400' },
    { label: 'Quiz Average',       value: `${avg}%`,                                                                                       icon: '🎯', color: 'bg-purple-500/10 border-purple-500/30 text-purple-400' },
    { label: 'Quizzes Taken',      value: data?.quizCount ?? 0,                                                                            icon: '✅', color: 'bg-green-500/10 border-green-500/30 text-green-400' },
    { label: 'PDFs Submitted',     value: data?.pdfCount ?? 0,                                                                             icon: '📄', color: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400' },
    { label: 'Passed',             value: data?.passCount ?? 0,                                                                            icon: '🏆', color: 'bg-green-500/10 border-green-500/30 text-green-400' },
    { label: 'Failed',             value: data?.failCount ?? 0,                                                                            icon: '❌', color: 'bg-red-500/10 border-red-500/30 text-red-400' },
  ]

  return (
    <Layout>
      <div className="space-y-6">
        <div className="retro-shell overflow-hidden">
          <div className="grid gap-0 lg:grid-cols-[1.15fr,0.85fr]">
            <div className="border-b-[3px] border-black bg-[#ff8db3] p-6 lg:border-b-0 lg:border-r-[3px]">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="retro-chip bg-white">Student performance</div>
                <LiveBadge secondsAgo={secondsAgo} onRefresh={refresh} />
              </div>
              <h1 className="retro-title mt-4 text-4xl sm:text-5xl">Your scores, quizzes and assignments — all in one view.</h1>
              <p className="mt-4 max-w-2xl text-base font-medium text-black/75">Auto-refreshes every 30 seconds. Includes both quiz scores and PDF assignment submissions.</p>
            </div>
            <div className="bg-[#fff8e8] p-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-[22px] border-[3px] border-black bg-[#6fa8ff] p-4 shadow-[5px_5px_0_#111111]">
                  <p className="retro-mono text-xs uppercase tracking-[0.18em] text-black/70">Attempts</p>
                  <p className="mt-3 text-3xl font-black text-black">{submissions.length}</p>
                </div>
                <div className="rounded-[22px] border-[3px] border-black bg-[#ffd84d] p-4 shadow-[5px_5px_0_#111111]">
                  <p className="retro-mono text-xs uppercase tracking-[0.18em] text-black/70">Average</p>
                  <p className="mt-3 text-3xl font-black text-black">{avg}%</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-[22px] border-[3px] border-black bg-[#fff8e8] p-5 shadow-[5px_5px_0_#111111]">
              <div className="text-2xl mb-2">{stat.icon}</div>
              <div className="text-2xl font-bold text-black">{stat.value}</div>
              <div className="text-sm mt-1 text-black/70">{stat.label}</div>
            </div>
          ))}
        </div>

        {submissions.length === 0 ? (
          <div className="retro-panel text-center py-16">
            <p className="text-4xl mb-3">📊</p>
            <p className="font-semibold text-black">No data yet</p>
            <p className="text-sm mt-1 text-black/70">Take some assessments to see your performance here</p>
          </div>
        ) : (
          <>
            <div className="retro-panel p-6">
              <h2 className="retro-title text-3xl mb-4">Score Over Time</h2>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={lineData}>
                  <CartesianGrid strokeDasharray="5 5" stroke="#111111" />
                  <XAxis dataKey="name" stroke="#111111" tick={{ fontSize: 12, fill: '#111111', fontWeight: 700 }} />
                  <YAxis stroke="#111111" domain={[0, 100]} tick={{ fontSize: 12, fill: '#111111', fontWeight: 700 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#fff8e8', border: '3px solid #111111', borderRadius: '18px', color: '#111111', boxShadow: '5px 5px 0 #111111' }} />
                  <Line type="monotone" dataKey="score" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6', r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {topicData.length > 0 && (
              <div className="retro-panel p-6">
                <h2 className="retro-title text-3xl mb-4">Performance by Topic</h2>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={topicData}>
                    <CartesianGrid strokeDasharray="5 5" stroke="#111111" />
                    <XAxis dataKey="topic" stroke="#111111" tick={{ fontSize: 12, fill: '#111111', fontWeight: 700 }} />
                    <YAxis stroke="#111111" domain={[0, 100]} tick={{ fontSize: 12, fill: '#111111', fontWeight: 700 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#fff8e8', border: '3px solid #111111', borderRadius: '18px', color: '#111111', boxShadow: '5px 5px 0 #111111' }} />
                    <Bar dataKey="average" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="retro-panel p-6">
              <h2 className="retro-title text-3xl mb-4">Submission History</h2>
              <div className="space-y-3">
                {submissions.map((sub, i) => (
                  <div key={sub._id} className="flex items-center justify-between rounded-[20px] border-[3px] border-black bg-[#fff8e8] px-4 py-3 shadow-[4px_4px_0_#111111]">
                    <div>
                      <p className="text-black text-sm font-medium">
                        {sub.assessment?.title || `Assessment #${i + 1}`}
                      </p>
                      <div className="flex items-center gap-3 mt-0.5">
                        {sub.assessment?.topic && (
                          <span className="text-black/70 text-xs">🏷️ {sub.assessment.topic}</span>
                        )}
                        {sub.assessment?.difficulty && (
                          <span className="text-black/70 text-xs capitalize">📊 {sub.assessment.difficulty}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-bold ${sub.percentage >= 70 ? 'text-green-400' : sub.percentage >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {Math.round(sub.percentage)}%
                      </p>
                      <p className="text-black/70 text-xs">{sub.totalScore}/{sub.maxScore} marks</p>
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
