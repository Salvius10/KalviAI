import { useState, useEffect } from 'react'
import Layout from '../../components/shared/Layout'
import api from '../../lib/axios'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid,
} from 'recharts'

const scoreColor = (s) => s >= 80 ? '#97e675' : s >= 60 ? '#ffd84d' : '#ff8db3'

const RetroTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ backgroundColor: '#fff8e8', border: '3px solid #111111', borderRadius: '18px', color: '#111111', boxShadow: '5px 5px 0 #111111', padding: '10px 14px' }}>
      <p className="font-bold text-xs uppercase tracking-wide mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="text-xs font-medium" style={{ color: p.color }}>{p.name}: {p.value}</p>
      ))}
    </div>
  )
}

function StatCard({ label, value, sub, color }) {
  return (
    <div className={`rounded-[22px] border-[3px] border-black p-5 shadow-[5px_5px_0_#111111] ${color}`}>
      <p className="retro-mono text-xs uppercase tracking-[0.18em] text-black/70">{label}</p>
      <p className="mt-3 text-3xl font-black text-black">{value}</p>
      {sub && <p className="text-xs font-medium text-black/60 mt-1">{sub}</p>}
    </div>
  )
}

export default function ProgressAnalytics() {
  const [analytics, setAnalytics]           = useState(null)
  const [aiInsight, setAiInsight]           = useState(null)
  const [loading, setLoading]               = useState(true)
  const [insightLoading, setInsightLoading] = useState(false)
  const [error, setError]                   = useState(null)

  useEffect(() => {
    api.get('/analytics/me')
      .then(({ data }) => setAnalytics(data.data))
      .catch(() => setError('Could not load analytics.'))
      .finally(() => setLoading(false))
  }, [])

  const fetchInsight = async () => {
    setInsightLoading(true)
    try {
      const { data } = await api.get('/analytics/ai-insight')
      setAiInsight(data.insight)
    } catch {
      setAiInsight('Could not generate insight right now.')
    } finally {
      setInsightLoading(false)
    }
  }

  if (loading) return (
    <Layout>
      <div className="retro-panel flex flex-col items-center justify-center py-24 gap-4">
        <div className="text-5xl animate-bounce">📊</div>
        <p className="retro-title text-2xl">Loading Analytics…</p>
        <p className="text-sm text-black/60 font-medium">Pulling your data from MongoDB</p>
      </div>
    </Layout>
  )

  if (error) return (
    <Layout>
      <div className="retro-panel flex flex-col items-center justify-center py-24 gap-4">
        <div className="text-5xl">⚠️</div>
        <p className="font-bold text-black text-lg">{error}</p>
      </div>
    </Layout>
  )

  if (!analytics) return null

  const { overallStats, courses, weeklyActivity, topicPerformance } = analytics
  const totalHours     = Math.round((overallStats.totalTimeSpentSeconds || 0) / 3600)
  const avgScore       = overallStats.avgAssessmentScore || 0
  const attendance     = overallStats.attendance || { present: 0, absent: 0 }
  const totalDays      = (attendance.present || 0) + (attendance.absent || 0)
  const attendancePct  = totalDays > 0 ? Math.round((attendance.present / totalDays) * 100) : null

  return (
    <Layout>
      <div className="space-y-6">

        {/* Hero */}
        <section className="retro-shell overflow-hidden">
          <div className="grid gap-0 lg:grid-cols-[1.3fr,0.7fr]">
            <div className="border-b-[3px] border-black bg-[#97e675] p-6 lg:border-b-0 lg:border-r-[3px]">
              <div className="retro-chip bg-white">Progress analytics</div>
              <h1 className="retro-title mt-4 text-4xl sm:text-5xl">
                Quizzes, assignments and attendance — all in one view.
              </h1>
              <p className="mt-4 max-w-2xl text-base font-medium text-black/75">
                Live data from MongoDB. Hit "Generate Insight" for a Groq AI analysis based on your quiz scores, submissions and attendance.
              </p>
            </div>
            <div className="bg-[#fff8e8] p-6">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-[22px] border-[3px] border-black bg-[#6fa8ff] p-4 shadow-[5px_5px_0_#111111]">
                  <p className="retro-mono text-xs uppercase tracking-[0.18em] text-black/70">Quiz Avg</p>
                  <p className="mt-2 text-3xl font-black text-black">{overallStats.avgQuizScore ?? avgScore}%</p>
                </div>
                <div className="rounded-[22px] border-[3px] border-black bg-[#ffd84d] p-4 shadow-[5px_5px_0_#111111]">
                  <p className="retro-mono text-xs uppercase tracking-[0.18em] text-black/70">Quizzes</p>
                  <p className="mt-2 text-3xl font-black text-black">{overallStats.quizzesTaken || 0}</p>
                </div>
                <div className="rounded-[22px] border-[3px] border-black bg-[#ff8db3] p-4 shadow-[5px_5px_0_#111111]">
                  <p className="retro-mono text-xs uppercase tracking-[0.18em] text-black/70">Assignments</p>
                  <p className="mt-2 text-3xl font-black text-black">{overallStats.assignmentsSubmitted || 0}</p>
                </div>
                <div className={`rounded-[22px] border-[3px] border-black p-4 shadow-[5px_5px_0_#111111] ${attendancePct !== null && attendancePct < 75 ? 'bg-[#ff8db3]' : 'bg-[#97e675]'}`}>
                  <p className="retro-mono text-xs uppercase tracking-[0.18em] text-black/70">Attendance</p>
                  <p className="mt-2 text-3xl font-black text-black">{attendancePct !== null ? `${attendancePct}%` : '—'}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Study Time"     value={`${totalHours}h`}   sub="total recorded"           color="bg-[#d9e9ff]" />
          <StatCard label="Avg Score"      value={`${avgScore}%`}     sub={`${overallStats.totalAssessmentsTaken || 0} total`} color={avgScore >= 70 ? 'bg-[#97e675]' : 'bg-[#ffd84d]'} />
          <StatCard label="Present / Absent" value={`${attendance.present}/${attendance.absent}`} sub={attendancePct !== null ? `${attendancePct}% rate` : 'no data'} color={attendancePct !== null && attendancePct < 75 ? 'bg-[#ff8db3]' : 'bg-[#97e675]'} />
          <StatCard label="Day Streak"     value={overallStats.streakDays || 0} sub="days active"  color="bg-[#ffd84d]" />
        </div>

        {/* AI Insight */}
        <div className="retro-panel p-6 bg-[#d9e9ff]">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div>
              <p className="retro-chip bg-white">✦ AI performance insight</p>
              <h2 className="retro-title mt-3 text-3xl">Ai Coach</h2>
            </div>
            {!aiInsight
              ? <button onClick={fetchInsight} disabled={insightLoading} className="retro-button bg-[#6fa8ff] px-5">
                  {insightLoading ? 'Analysing…' : 'Generate Insight'}
                </button>
              : <button onClick={fetchInsight} disabled={insightLoading} className="retro-button bg-white px-5">
                  {insightLoading ? 'Refreshing…' : '↻ Refresh'}
                </button>
            }
          </div>

          {insightLoading && (
            <div className="flex items-center gap-3 rounded-[18px] border-[3px] border-black bg-white px-4 py-3">
              <span className="w-5 h-5 border-[3px] border-black border-t-transparent rounded-full animate-spin inline-block flex-shrink-0" />
              <span className="text-sm font-medium text-black">Groq AI (Llama 3.3 70B) is analysing your progress…</span>
            </div>
          )}

          {aiInsight && !insightLoading && (
            <div className="rounded-[18px] border-[3px] border-black bg-white px-5 py-4">
              <p className="text-black font-medium leading-relaxed text-sm">{aiInsight}</p>
            </div>
          )}

          {!aiInsight && !insightLoading && (
            <p className="text-sm font-medium text-black/60 italic">
              Click "Generate Insight" for a personalised Groq AI analysis of your learning data.
            </p>
          )}
        </div>

        {/* Weekly activity chart */}
        <div className="retro-panel p-6">
          <div className="mb-5">
            <p className="retro-chip bg-[#ffd84d]">Weekly activity</p>
            <h2 className="retro-title mt-3 text-3xl">Last 7 Days</h2>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={weeklyActivity} barGap={4}>
              <CartesianGrid strokeDasharray="5 5" stroke="#111111" />
              <XAxis dataKey="day"  stroke="#111111" tick={{ fill: '#111111', fontSize: 12, fontWeight: 700 }} axisLine={false} tickLine={false} />
              <YAxis               stroke="#111111" tick={{ fill: '#111111', fontSize: 11, fontWeight: 700 }} axisLine={false} tickLine={false} width={28} />
              <Tooltip content={<RetroTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
              <Bar dataKey="materialsCompleted" name="Materials" fill="#6fa8ff" radius={[6,6,0,0]} />
              <Bar dataKey="minutesStudied"     name="Minutes"   fill="#ffd84d" radius={[6,6,0,0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 mt-3">
            <span className="flex items-center gap-1.5 text-xs font-bold text-black/70"><span className="w-3 h-3 rounded-sm bg-[#6fa8ff] inline-block border border-black" />Materials completed</span>
            <span className="flex items-center gap-1.5 text-xs font-bold text-black/70"><span className="w-3 h-3 rounded-sm bg-[#ffd84d] inline-block border border-black" />Minutes studied</span>
          </div>
        </div>

        {/* Topic performance */}
        {topicPerformance.length > 0 && (
          <div className="retro-panel p-6">
            <div className="mb-5">
              <p className="retro-chip bg-[#ff8db3]">Topic breakdown</p>
              <h2 className="retro-title mt-3 text-3xl">Assessment Scores by Topic</h2>
            </div>
            <div className="space-y-4">
              {[...topicPerformance].sort((a, b) => a.avgScore - b.avgScore).map((t) => (
                <div key={t.topic} className="flex items-center gap-4">
                  <span className="text-xs font-bold text-black/70 w-28 truncate flex-shrink-0">{t.topic}</span>
                  <div className="flex-1 bg-black/10 rounded-full h-3 border-[2px] border-black overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${t.avgScore}%`, backgroundColor: scoreColor(t.avgScore) }}
                    />
                  </div>
                  <span className="text-xs font-black w-10 text-right text-black">{t.avgScore}%</span>
                  <span className="retro-mono text-xs text-black/50 w-16 text-right">{t.attempts} try</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Course progress */}
        {courses.length > 0 && (
          <div className="retro-panel p-6">
            <div className="mb-5">
              <p className="retro-chip bg-[#97e675]">Courses</p>
              <h2 className="retro-title mt-3 text-3xl">Course Progress</h2>
            </div>
            <div className="space-y-5">
              {courses.map((c, i) => (
                <div
                  key={c.courseId}
                  className={`rounded-[22px] border-[3px] border-black px-5 py-4 shadow-[4px_4px_0_#111111] ${i % 2 === 0 ? 'bg-[#fff8e8]' : 'bg-[#d9e9ff]'}`}
                >
                  <div className="flex justify-between items-start mb-3 gap-3">
                    <p className="font-black text-black text-base truncate">{c.courseTitle}</p>
                    <span className="retro-chip bg-white flex-shrink-0">{c.completionPercent}%</span>
                  </div>
                  <div className="w-full bg-black/10 rounded-full h-3 border-[2px] border-black overflow-hidden mb-2">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${c.completionPercent}%`,
                        backgroundColor: c.completionPercent >= 100 ? '#97e675' : '#6fa8ff',
                      }}
                    />
                  </div>
                  <div className="flex justify-between">
                    <span className="retro-mono text-xs text-black/60 uppercase tracking-wide">{c.completedMaterials}/{c.totalMaterials} materials</span>
                    <span className="retro-mono text-xs text-black/60 uppercase tracking-wide">{Math.round(c.totalTimeSpentSeconds / 60)} min studied</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {topicPerformance.length === 0 && courses.length === 0 && (
          <div className="retro-panel text-center py-16">
            <p className="text-4xl mb-3">📭</p>
            <p className="font-black text-black text-xl">No data yet</p>
            <p className="text-sm mt-2 text-black/70 font-medium">Take assessments and open course materials to populate your analytics.</p>
          </div>
        )}

      </div>
    </Layout>
  )
}
