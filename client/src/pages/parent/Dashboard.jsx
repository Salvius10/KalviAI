import { useState, useCallback } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import Layout from '../../components/shared/Layout'
import api from '../../lib/axios'
import { useAutoRefresh, LiveBadge } from '../../lib/useAutoRefresh'

const attendanceColors = ['#97e675', '#ff8db3']

export default function ParentDashboard() {
  const [data, setData] = useState(null)
  const [reply, setReply] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const loadDashboard = useCallback(async () => {
    try {
      const res = await api.get('/parents/dashboard')
      setData(res.data)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load parent dashboard')
    } finally {
      setLoading(false)
    }
  }, [])

  const { secondsAgo, refresh } = useAutoRefresh(loadDashboard, 30000)

  const handleReply = async (e) => {
    e.preventDefault()
    if (!reply.trim()) return
    setSending(true)
    try {
      await api.post('/parents/messages', { message: reply.trim() })
      setReply('')
      await loadDashboard()
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send message')
    } finally {
      setSending(false)
    }
  }

  const attendance = data?.student?.attendance || { present: 0, absent: 0 }
  const attendanceData = [
    { name: 'Present', value: attendance.present || 0 },
    { name: 'Absent', value: attendance.absent || 0 },
  ]

  return (
    <Layout>
      <div className="space-y-6">
        <section className="retro-shell overflow-hidden">
          <div className="grid lg:grid-cols-[1.1fr,0.9fr]">
            <div className="border-b-[3px] border-black bg-[#97e675] p-6 lg:border-b-0 lg:border-r-[3px]">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="retro-chip bg-white">Parent dashboard</div>
                <LiveBadge secondsAgo={secondsAgo} onRefresh={refresh} />
              </div>
              <h1 className="retro-title mt-4 text-4xl sm:text-5xl">See your child's progress in real time.</h1>
              <p className="mt-4 max-w-2xl text-base font-medium text-black/75">
                Quiz scores, PDF assignments, attendance, teacher notes — all updated automatically every 30 seconds.
              </p>
            </div>
            <div className="bg-[#fff8e8] p-6">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="rounded-[22px] border-[3px] border-black bg-[#6fa8ff] p-4 shadow-[5px_5px_0_#111111]">
                  <p className="retro-mono text-xs uppercase tracking-[0.18em] text-black/70">Student</p>
                  <p className="mt-2 text-lg font-black text-black truncate">{data?.student?.name || '...'}</p>
                </div>
                <div className="rounded-[22px] border-[3px] border-black bg-[#ffd84d] p-4 shadow-[5px_5px_0_#111111]">
                  <p className="retro-mono text-xs uppercase tracking-[0.18em] text-black/70">Quiz avg</p>
                  <p className="mt-2 text-2xl font-black text-black">{Math.round(data?.progress?.averageScore || 0)}%</p>
                </div>
                <div className="rounded-[22px] border-[3px] border-black bg-[#ff8db3] p-4 shadow-[5px_5px_0_#111111]">
                  <p className="retro-mono text-xs uppercase tracking-[0.18em] text-black/70">Passed</p>
                  <p className="mt-2 text-2xl font-black text-black">{data?.progress?.passCount ?? 0} / {data?.progress?.quizCount ?? 0}</p>
                </div>
                <div className="rounded-[22px] border-[3px] border-black bg-[#97e675] p-4 shadow-[5px_5px_0_#111111]">
                  <p className="retro-mono text-xs uppercase tracking-[0.18em] text-black/70">Quizzes</p>
                  <p className="mt-2 text-2xl font-black text-black">{data?.progress?.quizCount ?? 0}</p>
                </div>
                <div className="rounded-[22px] border-[3px] border-black bg-white p-4 shadow-[5px_5px_0_#111111]">
                  <p className="retro-mono text-xs uppercase tracking-[0.18em] text-black/70">PDFs submitted</p>
                  <p className="mt-2 text-2xl font-black text-black">{data?.progress?.pdfCount ?? 0}</p>
                </div>
                <div className="rounded-[22px] border-[3px] border-black bg-[#ffe0b2] p-4 shadow-[5px_5px_0_#111111]">
                  <p className="retro-mono text-xs uppercase tracking-[0.18em] text-black/70">Roll no</p>
                  <p className="mt-2 text-xl font-black text-black">{data?.student?.rollNo || '--'}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {error && (
          <div className="retro-panel bg-[#ffb3cb] p-4">
            <p className="font-bold text-black">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="retro-panel p-6">
            <p className="font-bold text-black">Loading parent dashboard...</p>
          </div>
        ) : !data ? null : (
          <section className="grid gap-6 xl:grid-cols-[0.78fr,1.22fr]">
            <div className="space-y-6">
              <div className="retro-panel p-6">
                <p className="retro-chip bg-[#e8ffd8]">Attendance</p>
                <h2 className="retro-title mt-4 text-3xl">Presence Split</h2>
                <div className="mt-4 h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={attendanceData} innerRadius={60} outerRadius={98} paddingAngle={4} dataKey="value">
                        {attendanceData.map((entry, index) => (
                          <Cell key={entry.name} fill={attendanceColors[index % attendanceColors.length]} stroke="#111111" strokeWidth={3} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#fff8e8',
                          border: '3px solid #111111',
                          borderRadius: '18px',
                          boxShadow: '5px 5px 0 #111111',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {attendanceData.map((item, index) => (
                    <div key={item.name} className="rounded-[20px] border-[3px] border-black bg-white px-4 py-3 shadow-[4px_4px_0_#111111]">
                      <p className="retro-mono text-xs uppercase tracking-[0.18em]" style={{ color: '#111111' }}>{item.name}</p>
                      <p className="mt-2 text-2xl font-black text-black">{item.value}</p>
                      <div className="mt-2 h-3 rounded-full border-[2px] border-black" style={{ backgroundColor: attendanceColors[index] }} />
                    </div>
                  ))}
                </div>
              </div>

              <div className="retro-panel p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="retro-chip bg-[#fff0e4]">Behaviour</p>
                    <h2 className="retro-title mt-3 text-3xl">Teacher Notes</h2>
                  </div>
                  <span className="retro-chip bg-[#ffefab]">{data.student.behaviourNotes?.length || 0} notes</span>
                </div>
                <div className="mt-5 space-y-4">
                  {(data.student.behaviourNotes || []).length === 0 ? (
                    <div className="rounded-[22px] border-[3px] border-dashed border-black bg-[#fff8e8] px-6 py-10 text-center">
                      <p className="font-bold text-black">No behaviour notes yet.</p>
                    </div>
                  ) : (
                    data.student.behaviourNotes.map((note, index) => (
                      <div key={note._id} className={`rounded-[22px] border-[3px] border-black p-4 shadow-[5px_5px_0_#111111] ${index % 2 === 0 ? 'bg-[#fff8e8]' : 'bg-[#d9e9ff]'}`}>
                        <p className="text-base font-bold text-black">{note.note}</p>
                        <p className="retro-mono mt-3 text-xs uppercase tracking-[0.18em] text-black/70">
                          {note.teacher?.name || 'Teacher'} • {new Date(note.createdAt).toLocaleString()}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="retro-panel p-6">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <div>
                    <p className="retro-chip bg-[#d9e9ff]">Progress</p>
                    <h2 className="retro-title mt-3 text-3xl">Student Progress</h2>
                  </div>
                  <span className="retro-chip bg-[#97e675]">{data.progress.totalAssessments} assessments</span>
                </div>
                {data.progress.recentScores?.length ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={data.progress.recentScores} margin={{ top: 10, right: 16, left: -12, bottom: 0 }}>
                      <CartesianGrid stroke="#111111" strokeDasharray="5 5" />
                      <XAxis dataKey="label" stroke="#111111" tick={{ fill: '#111111', fontSize: 12, fontWeight: 700 }} />
                      <YAxis stroke="#111111" domain={[0, 100]} tick={{ fill: '#111111', fontSize: 12, fontWeight: 700 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#fff8e8',
                          border: '3px solid #111111',
                          borderRadius: '18px',
                          boxShadow: '5px 5px 0 #111111',
                        }}
                      />
                      <Line type="monotone" dataKey="score" stroke="#111111" strokeWidth={4} dot={{ fill: '#6fa8ff', stroke: '#111111', strokeWidth: 3, r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="rounded-[22px] border-[3px] border-dashed border-black bg-[#fff0e4] px-6 py-16 text-center">
                    <p className="font-bold text-black">No progress data yet.</p>
                  </div>
                )}
              </div>

              <div className="retro-panel p-6">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <div>
                    <p className="retro-chip bg-[#ffefab]">Recent results</p>
                    <h2 className="retro-title mt-3 text-3xl">Assessments</h2>
                  </div>
                </div>
                <div className="space-y-4">
                  {(data.progress.recentAssessments || []).length === 0 ? (
                    <div className="rounded-[22px] border-[3px] border-dashed border-black bg-[#fff8e8] px-6 py-10 text-center">
                      <p className="font-bold text-black">No assessment submissions yet.</p>
                    </div>
                  ) : (
                    data.progress.recentAssessments.map((assessment, index) => (
                      <div key={assessment.id} className={`rounded-[22px] border-[3px] border-black px-4 py-4 shadow-[5px_5px_0_#111111] ${index % 2 === 0 ? 'bg-[#ffd84d]' : 'bg-[#fff8e8]'}`}>
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-base font-black text-black">{assessment.title}</p>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border border-black ${assessment.submissionType === 'pdf_assignment' ? 'bg-blue-200' : 'bg-green-200'}`}>
                                {assessment.submissionType === 'pdf_assignment' ? '📄 PDF' : '📝 Quiz'}
                              </span>
                            </div>
                            <p className="mt-1 text-xs font-medium text-black/70">{assessment.courseTitle}</p>
                          </div>
                          <div className="rounded-[16px] border-[3px] border-black bg-white px-3 py-2 text-right shadow-[3px_3px_0_#111111] flex-shrink-0">
                            {assessment.submissionType === 'pdf_assignment'
                              ? <p className="text-sm font-black text-blue-700">Submitted</p>
                              : <p className={`text-lg font-black ${assessment.percentage >= 70 ? 'text-green-700' : 'text-red-600'}`}>{assessment.percentage}%</p>
                            }
                            <p className="retro-mono text-[10px] uppercase tracking-[0.18em] text-black/70">
                              {new Date(assessment.submittedAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="retro-panel p-6">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <div>
                    <p className="retro-chip bg-[#d9e9ff]">Talk to teacher</p>
                    <h2 className="retro-title mt-3 text-3xl">Messages</h2>
                  </div>
                </div>
                <div className="space-y-3 max-h-80 overflow-auto pr-1">
                  {(data.messages || []).length === 0 ? (
                    <div className="rounded-[22px] border-[3px] border-dashed border-black bg-[#fff8e8] px-6 py-10 text-center">
                      <p className="font-bold text-black">No messages yet.</p>
                    </div>
                  ) : (
                    data.messages.map((message) => (
                      <div
                        key={message._id}
                        className={`rounded-[22px] border-[3px] border-black px-4 py-4 shadow-[5px_5px_0_#111111] ${
                          message.senderRole === 'parent' ? 'ml-8 bg-[#97e675]' : 'mr-8 bg-[#fff8e8]'
                        }`}
                      >
                        <p className="font-bold text-black">{message.message}</p>
                        <p className="retro-mono mt-2 text-[10px] uppercase tracking-[0.18em] text-black/70">
                          {message.senderRole === 'teacher' ? message.teacher?.name || 'Teacher' : 'You'} • {new Date(message.createdAt).toLocaleString()}
                        </p>
                      </div>
                    ))
                  )}
                </div>

                <form onSubmit={handleReply} className="mt-5 space-y-3">
                  <textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    rows={4}
                    placeholder="Reply to the teacher"
                    className="retro-input min-h-[120px] resize-none"
                  />
                  <button type="submit" disabled={sending} className="retro-button bg-[#6fa8ff]">
                    {sending ? 'Sending...' : 'Send message'}
                  </button>
                </form>
              </div>
            </div>
          </section>
        )}
      </div>
    </Layout>
  )
}
