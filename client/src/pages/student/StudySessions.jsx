import { useEffect, useState } from 'react'
import Layout from '../../components/shared/Layout'
import api from '../../lib/axios'

export default function StudySessions() {
  const [sessions, setSessions] = useState([])
  const [courses, setCourses] = useState([])
  const [activeSession, setActiveSession] = useState(null)
  const [selectedCourse, setSelectedCourse] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const [loading, setLoading] = useState(true)
  const [notes, setNotes] = useState('')

  const fetchData = async () => {
    try {
      const [sessionRes, courseRes] = await Promise.all([
        api.get('/study-sessions/my'),
        api.get('/courses'),
      ])
      setSessions(sessionRes.data)
      setCourses(courseRes.data)
      if (courseRes.data.length > 0) setSelectedCourse(courseRes.data[0]._id)
    } catch (err) { console.error(err) } finally { setLoading(false) }
  }

  useEffect(() => { fetchData() }, [])

  // Timer
  useEffect(() => {
    if (!activeSession) return
    const interval = setInterval(() => setElapsed(e => e + 1), 1000)
    return () => clearInterval(interval)
  }, [activeSession])

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0')
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0')
    const s = (seconds % 60).toString().padStart(2, '0')
    return `${h}:${m}:${s}`
  }

  const formatDuration = (minutes) => {
    if (minutes < 60) return `${minutes}m`
    return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
  }

  const handleStart = async () => {
    if (!selectedCourse) return
    try {
      const res = await api.post('/study-sessions/start', { courseId: selectedCourse })
      setActiveSession(res.data)
      setElapsed(0)
    } catch (err) { console.error(err) }
  }

  const handleStop = async () => {
    if (!activeSession) return
    try {
      await api.put(`/study-sessions/${activeSession._id}/end`, { notes })
      setActiveSession(null)
      setElapsed(0)
      setNotes('')
      fetchData()
    } catch (err) { console.error(err) }
  }

  // Group sessions by date
  const grouped = {}
  sessions.forEach((s) => {
    const date = new Date(s.startTime).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    if (!grouped[date]) grouped[date] = []
    grouped[date].push(s)
  })

  const totalMinutes = sessions.reduce((sum, s) => sum + (s.duration || 0), 0)
  const totalSessions = sessions.length
  const avgMinutes = totalSessions ? Math.round(totalMinutes / totalSessions) : 0

  const stats = [
    { label: 'Total Sessions',  value: totalSessions,              icon: '📚', color: 'bg-blue-500/10 border-blue-500/30 text-blue-400' },
    { label: 'Total Study Time', value: formatDuration(totalMinutes), icon: '⏱️', color: 'bg-purple-500/10 border-purple-500/30 text-purple-400' },
    { label: 'Avg Session',     value: formatDuration(avgMinutes), icon: '📊', color: 'bg-green-500/10 border-green-500/30 text-green-400' },
    { label: 'This Week',       value: sessions.filter(s => new Date(s.startTime) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length, icon: '🔥', color: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400' },
  ]

  return (
    <Layout>
      <div className="space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white">Study Tracker</h1>
          <p className="text-slate-400 text-sm mt-1">Track your study sessions and stay consistent</p>
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

        {/* Timer Card */}
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6">
          <h2 className="text-white font-semibold mb-4">
            {activeSession ? '⏱️ Session in Progress' : 'Start a Study Session'}
          </h2>

          {!activeSession ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Select Course</label>
                <select
                  value={selectedCourse}
                  onChange={(e) => setSelectedCourse(e.target.value)}
                  className="w-full bg-slate-700/50 border border-slate-600/50 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                >
                  {courses.map(c => <option key={c._id} value={c._id}>{c.title}</option>)}
                </select>
              </div>
              <button
                onClick={handleStart}
                disabled={!selectedCourse}
                className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-semibold px-6 py-3 rounded-xl transition-all text-sm"
              >
                ▶ Start Session
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Timer Display */}
              <div className="text-center py-6">
                <div className="text-5xl font-bold font-mono text-white mb-2">
                  {formatTime(elapsed)}
                </div>
                <p className="text-slate-400 text-sm">
                  Studying: <span className="text-blue-400 font-medium">
                    {courses.find(c => c._id === selectedCourse)?.title || 'Unknown'}
                  </span>
                </p>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Session Notes <span className="text-slate-500">(optional)</span>
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="What did you study today?"
                  rows={2}
                  className="w-full bg-slate-700/50 border border-slate-600/50 text-white placeholder-slate-500 rounded-xl px-4 py-3 text-sm focus:outline-none resize-none"
                />
              </div>

              <button
                onClick={handleStop}
                className="w-full bg-red-600 hover:bg-red-500 text-white font-semibold py-3 rounded-xl transition-all text-sm"
              >
                ⏹ Stop & Save Session
              </button>
            </div>
          )}
        </div>

        {/* Session Logs */}
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6">
          <h2 className="text-white font-semibold mb-4">Session History</h2>
          {loading ? (
            <p className="text-slate-400 text-sm">Loading...</p>
          ) : sessions.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-4xl mb-3">📖</p>
              <p className="text-white font-semibold">No sessions yet</p>
              <p className="text-slate-400 text-sm mt-1">Start your first study session above!</p>
            </div>
          ) : (
            <div className="space-y-5">
              {Object.entries(grouped).map(([date, daySessions]) => (
                <div key={date}>
                  <p className="text-xs text-slate-500 font-medium mb-2 uppercase tracking-wider">{date}</p>
                  <div className="space-y-2">
                    {daySessions.map((session) => (
                      <div key={session._id} className="flex items-center justify-between bg-slate-700/30 rounded-xl px-4 py-3">
                        <div>
                          <p className="text-white text-sm font-medium">
                            {session.course?.title || 'Unknown Course'}
                          </p>
                          {session.notes && (
                            <p className="text-slate-400 text-xs mt-0.5">📝 {session.notes}</p>
                          )}
                          <p className="text-slate-500 text-xs mt-0.5">
                            {new Date(session.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            {session.endTime && ` → ${new Date(session.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-blue-400 font-semibold text-sm">
                            {session.duration ? formatDuration(session.duration) : 'In progress'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}