import { useState, useEffect } from 'react'
import axios from 'axios'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'
import useAuthStore from '../../store/authStore'

const scoreColor = (s) => s >= 80 ? '#22c55e' : s >= 60 ? '#eab308' : '#ef4444'

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-xs text-slate-200 shadow-lg">
      <p className="font-medium mb-1">{label}</p>
      {payload.map((p) => <p key={p.name} style={{ color: p.color }}>{p.name}: {p.value}</p>)}
    </div>
  )
}

function StatCard({ label, value, sub, color = 'text-blue-400' }) {
  return (
    <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-4">
      <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
    </div>
  )
}

export default function ProgressAnalytics() {
  const { token } = useAuthStore()
  const [analytics, setAnalytics]           = useState(null)
  const [aiInsight, setAiInsight]           = useState(null)
  const [loading, setLoading]               = useState(true)
  const [insightLoading, setInsightLoading] = useState(false)
  const [error, setError]                   = useState(null)

  const headers = { headers: { Authorization: `Bearer ${token}` } }

  useEffect(() => {
    axios.get('/api/analytics/me', headers)
      .then(({ data }) => setAnalytics(data.data))
      .catch(() => setError('Could not load analytics.'))
      .finally(() => setLoading(false))
  }, [])

  const fetchInsight = async () => {
    setInsightLoading(true)
    try {
      const { data } = await axios.get('/api/analytics/ai-insight', headers)
      setAiInsight(data.insight)
    } catch {
      setAiInsight('Could not generate insight right now.')
    } finally {
      setInsightLoading(false)
    }
  }

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4 shadow-lg shadow-blue-500/30 animate-pulse">
          <span className="text-2xl">📊</span>
        </div>
        <p className="text-slate-400 text-sm mt-2">Loading your analytics…</p>
      </div>
    </div>
  )

  if (error) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
      <p className="text-red-400">{error}</p>
    </div>
  )

  if (!analytics) return null

  const { overallStats, courses, weeklyActivity, topicPerformance } = analytics
  const totalHours = Math.round((overallStats.totalTimeSpentSeconds || 0) / 3600)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white">Progress Analytics</h1>
          <p className="text-slate-400 text-sm mt-1">Your learning performance at a glance</p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Study Time"    value={`${totalHours}h`}                            sub="total"               color="text-blue-400" />
          <StatCard label="Avg Score"     value={`${overallStats.avgAssessmentScore || 0}%`}  sub={`${overallStats.totalAssessmentsTaken || 0} assessments`} color={(overallStats.avgAssessmentScore || 0) >= 70 ? 'text-green-400' : 'text-yellow-400'} />
          <StatCard label="Courses Done"  value={`${overallStats.totalCoursesCompleted || 0}/${overallStats.totalCoursesEnrolled || 0}`} sub="completed" color="text-purple-400" />
          <StatCard label="Day Streak"    value={`${overallStats.streakDays || 0}`}            sub="days active"         color="text-orange-400" />
        </div>

        {/* AI Insight */}
        <div className="bg-slate-800/60 border border-purple-500/30 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-purple-400">✦</span>
              <span className="text-xs font-semibold text-purple-400 uppercase tracking-wider">AI Performance Insight</span>
            </div>
            {!aiInsight
              ? <button onClick={fetchInsight} disabled={insightLoading} className="text-xs px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg disabled:opacity-50 transition">
                  {insightLoading ? 'Analyzing…' : 'Generate Insight'}
                </button>
              : <button onClick={fetchInsight} disabled={insightLoading} className="text-xs text-purple-400 hover:text-purple-300 disabled:opacity-50 transition">
                  {insightLoading ? 'Refreshing…' : '↻ Refresh'}
                </button>
            }
          </div>
          {insightLoading && (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <span className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin inline-block" />
              GPT-4o is analyzing your progress…
            </div>
          )}
          {aiInsight && !insightLoading && <p className="text-slate-300 text-sm leading-relaxed">{aiInsight}</p>}
          {!aiInsight && !insightLoading && <p className="text-slate-500 text-sm italic">Click "Generate Insight" for a personalized AI analysis.</p>}
        </div>

        {/* Weekly activity chart */}
        <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Weekly Activity</h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={weeklyActivity} barGap={4}>
              <XAxis dataKey="day"  tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis                tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
              <Bar dataKey="materialsCompleted" name="Materials" fill="#3b82f6" radius={[4,4,0,0]} />
              <Bar dataKey="minutesStudied"     name="Minutes"   fill="#8b5cf6" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Topic performance */}
        {topicPerformance.length > 0 && (
          <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-slate-300 mb-4">Assessment Performance by Topic</h2>
            <div className="space-y-3">
              {topicPerformance.sort((a, b) => a.avgScore - b.avgScore).map((t) => (
                <div key={t.topic} className="flex items-center gap-3">
                  <span className="text-xs text-slate-400 w-32 truncate">{t.topic}</span>
                  <div className="flex-1 bg-slate-700 rounded-full h-2">
                    <div className="h-2 rounded-full transition-all duration-700" style={{ width: `${t.avgScore}%`, backgroundColor: scoreColor(t.avgScore) }} />
                  </div>
                  <span className="text-xs font-medium w-10 text-right" style={{ color: scoreColor(t.avgScore) }}>{t.avgScore}%</span>
                  <span className="text-xs text-slate-500 w-16 text-right">{t.attempts} attempt{t.attempts !== 1 ? 's' : ''}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Course progress */}
        {courses.length > 0 && (
          <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-slate-300 mb-4">Course Progress</h2>
            <div className="space-y-4">
              {courses.map((c) => (
                <div key={c.courseId}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-slate-200 truncate pr-2">{c.courseTitle}</span>
                    <span className="text-slate-400 text-xs flex-shrink-0">{c.completedMaterials}/{c.totalMaterials} materials</span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full transition-all duration-700" style={{ width: `${c.completionPercent}%`, backgroundColor: c.completionPercent >= 100 ? '#22c55e' : '#3b82f6' }} />
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-xs text-slate-500">{Math.round(c.totalTimeSpentSeconds / 60)} min studied</span>
                    <span className="text-xs text-slate-500">{c.completionPercent}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
