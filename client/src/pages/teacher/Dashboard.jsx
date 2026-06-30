import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../../components/shared/Layout'
import api from '../../lib/axios'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

const fetchDashboardData = () =>
  Promise.all([
    api.get('/courses'),
    api.get('/parents/teacher/students'),
  ])

const quickLinks = [
  { label: 'Courses', path: '/teacher/courses', note: 'Build and publish classes', color: 'bg-[#6fa8ff]' },
  { label: 'Assessments', path: '/teacher/assessments', note: 'Manage evaluation flow', color: 'bg-[#ffd84d]' },
  { label: 'Performance', path: '/teacher/performance', note: 'Review learner outcomes', color: 'bg-[#97e675]' },
]

export default function TeacherDashboard() {
  const [courses, setCourses] = useState([])
  const [students, setStudents] = useState([])
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [attendanceDrafts, setAttendanceDrafts] = useState({})
  const [behaviourNote, setBehaviourNote] = useState('')
  const [messageForm, setMessageForm] = useState('')
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingAttendanceId, setSavingAttendanceId] = useState('')
  const [error, setError] = useState('')

  const loadData = async (studentIdToKeep = '') => {
    try {
      const [courseRes, studentRes] = await fetchDashboardData()
      setCourses(courseRes.data)
      setStudents(studentRes.data)

      const nextStudentId = studentIdToKeep || selectedStudentId || studentRes.data[0]?.id || ''
      setSelectedStudentId(nextStudentId)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load teacher dashboard')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    const nextDrafts = students.reduce((acc, student) => {
      acc[student.id] = {
        present: String(student.attendance?.present ?? 0),
        absent: String(student.attendance?.absent ?? 0),
      }
      return acc
    }, {})
    setAttendanceDrafts(nextDrafts)

    const selectedStudent = students.find((student) => student.id === selectedStudentId)
    if (!selectedStudent) {
      setMessages([])
      return
    }

    const loadMessages = async () => {
      try {
        const res = await api.get('/parents/messages', { params: { studentId: selectedStudentId } })
        setMessages(res.data)
      } catch (err) {
        if (err.response?.status !== 400) {
          setError(err.response?.data?.message || 'Failed to load parent messages')
        }
      }
    }

    if (selectedStudentId) {
      loadMessages()
    }
  }, [selectedStudentId, students])

  const selectedStudent = useMemo(
    () => students.find((student) => student.id === selectedStudentId) || null,
    [selectedStudentId, students]
  )

  const connectedParents = students.filter((student) => student.hasParentAccount).length
  const publishedCourses = courses.filter((course) => course.isPublished).length
  const studentsWithBehaviour = students.filter((student) => student.latestBehaviourNote)

  const stats = [
    { label: 'Courses', value: courses.length, accent: 'bg-[#6fa8ff]' },
    { label: 'Students', value: students.length, accent: 'bg-[#ffd84d]' },
    { label: 'Published', value: publishedCourses, accent: 'bg-[#97e675]' },
    { label: 'Parents Linked', value: connectedParents, accent: 'bg-[#ff8db3]' },
  ]

  const chartData = courses.map((course) => ({
    name: course.title.length > 12 ? `${course.title.slice(0, 12)}...` : course.title,
    students: course.students?.length || 0,
  }))

  const updateAttendanceDraft = (studentId, field, value) => {
    setAttendanceDrafts((current) => ({
      ...current,
      [studentId]: {
        present: current[studentId]?.present ?? '0',
        absent: current[studentId]?.absent ?? '0',
        [field]: value,
      },
    }))
  }

  const submitAttendance = async (studentId) => {
    if (!studentId) return
    setSaving(true)
    setSavingAttendanceId(studentId)
    setError('')
    try {
      await api.post(`/parents/teacher/students/${studentId}/attendance`, {
        present: attendanceDrafts[studentId]?.present ?? '0',
        absent: attendanceDrafts[studentId]?.absent ?? '0',
      })
      await loadData(studentId)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save attendance')
    } finally {
      setSavingAttendanceId('')
      setSaving(false)
    }
  }

  const submitBehaviour = async (e) => {
    e.preventDefault()
    if (!selectedStudentId || !behaviourNote.trim()) return
    setSaving(true)
    setError('')
    try {
      await api.post(`/parents/teacher/students/${selectedStudentId}/behaviour`, {
        note: behaviourNote.trim(),
      })
      setBehaviourNote('')
      await loadData(selectedStudentId)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save behaviour note')
    } finally {
      setSaving(false)
    }
  }

  const submitMessage = async (e) => {
    e.preventDefault()
    if (!selectedStudent || !messageForm.trim()) return
    setSaving(true)
    setError('')
    try {
      await api.post('/parents/messages', {
        studentId: selectedStudent.id,
        email: selectedStudent.email,
        rollNo: selectedStudent.rollNo,
        message: messageForm.trim(),
      })
      setMessageForm('')
      const res = await api.get('/parents/messages', { params: { studentId: selectedStudent.id } })
      setMessages(res.data)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send parent message')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Layout>
      <div className="space-y-6">
        <section className="retro-shell overflow-hidden">
          <div className="grid gap-0 lg:grid-cols-[1.2fr,0.8fr]">
            <div className="border-b-[3px] border-black bg-[#6fa8ff] p-6 lg:border-b-0 lg:border-r-[3px]">
              <div className="retro-chip bg-white">Teacher dashboard</div>
              <h1 className="retro-title mt-4 text-4xl sm:text-5xl">Run classes, track students, and keep parents in sync.</h1>
              <p className="mt-4 max-w-2xl text-base font-medium text-black/75">
                The same dashboard system as student and parent, now tuned for teaching operations, attendance, behaviour updates, and outreach.
              </p>
            </div>
            <div className="bg-[#fff8e8] p-6">
              <div className="grid grid-cols-2 gap-4">
                {stats.map((stat) => (
                  <div key={stat.label} className={`rounded-[22px] border-[3px] border-black p-4 shadow-[5px_5px_0_#111111] ${stat.accent}`}>
                    <p className="retro-mono text-xs uppercase tracking-[0.18em] text-black/70">{stat.label}</p>
                    <p className="mt-3 text-3xl font-black text-black">{stat.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {error && (
          <div className="retro-panel bg-[#ffb3cb] p-4">
            <p className="font-bold text-black">{error}</p>
          </div>
        )}

        <section className="grid gap-6 xl:grid-cols-[1.35fr,0.65fr]">
          <div className="retro-panel p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="retro-chip bg-[#d9e9ff]">Class load</p>
                <h2 className="retro-title mt-3 text-3xl">Students Per Course</h2>
              </div>
              <span className="retro-chip bg-[#ffefab]">{courses.length} total courses</span>
            </div>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData} margin={{ top: 10, right: 16, left: -12, bottom: 0 }}>
                  <CartesianGrid stroke="#111111" strokeDasharray="5 5" />
                  <XAxis dataKey="name" stroke="#111111" tick={{ fill: '#111111', fontSize: 12, fontWeight: 700 }} />
                  <YAxis stroke="#111111" tick={{ fill: '#111111', fontSize: 12, fontWeight: 700 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff8e8',
                      border: '3px solid #111111',
                      borderRadius: '18px',
                      color: '#111111',
                      boxShadow: '5px 5px 0 #111111',
                    }}
                  />
                  <Bar dataKey="students" fill="#6fa8ff" stroke="#111111" strokeWidth={3} radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="rounded-[22px] border-[3px] border-dashed border-black bg-[#fff0e4] px-6 py-16 text-center">
                <p className="text-lg font-bold text-black">No courses yet.</p>
                <p className="mt-2 text-sm font-medium text-black/70">Create and publish your first course to populate the board.</p>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="retro-panel p-6">
              <p className="retro-chip bg-[#97e675]">Quick links</p>
              <div className="mt-4 grid gap-4">
                {quickLinks.map((link) => (
                  <Link key={link.path} to={link.path} className={`block rounded-[22px] border-[3px] border-black p-4 text-black shadow-[5px_5px_0_#111111] transition-transform hover:-translate-y-1 ${link.color}`}>
                    <p className="text-lg font-black uppercase">{link.label}</p>
                    <p className="mt-1 text-sm font-medium text-black/75">{link.note}</p>
                  </Link>
                ))}
              </div>
            </div>

            <div className="retro-panel bg-[#111111] p-6 text-white shadow-[6px_6px_0_#6fa8ff]">
              <p className="retro-mono text-xs uppercase tracking-[0.2em] text-white/70">Status</p>
              <p className="mt-3 text-3xl font-black">{loading ? 'Loading board...' : saving ? 'Saving changes...' : 'Teaching board ready'}</p>
              <p className="mt-2 text-sm font-medium text-white/75">
                {loading
                  ? 'Pulling course and student data.'
                  : `${students.length} students across ${courses.length} courses, with ${connectedParents} connected parent accounts.`}
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
          <div className="space-y-6">
            <div className="retro-panel p-6">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="retro-chip bg-[#fff0e4]">Attendance board</p>
                  <h2 className="retro-title mt-3 text-3xl">Assigned Students</h2>
                </div>
                <div className="min-w-[220px]">
                  <select
                    value={selectedStudentId}
                    onChange={(e) => setSelectedStudentId(e.target.value)}
                    className="retro-input py-3"
                    disabled={students.length === 0}
                  >
                    {students.length === 0 ? (
                      <option value="">No students available</option>
                    ) : (
                      students.map((student) => (
                        <option key={student.id} value={student.id}>
                          {student.name} • {student.rollNo || 'No Roll'}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              {loading ? (
                <p className="text-sm font-medium text-black/70">Loading students...</p>
              ) : students.length === 0 ? (
                <div className="rounded-[22px] border-[3px] border-dashed border-black bg-[#fff8e8] px-6 py-10 text-center">
                  <p className="text-lg font-bold text-black">No students assigned yet.</p>
                  <p className="mt-2 text-sm font-medium text-black/70">Once students join your courses, you can manage attendance and notes here.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {students.map((student, index) => (
                    <div
                      key={student.id}
                      className={`rounded-[22px] border-[3px] border-black p-4 shadow-[5px_5px_0_#111111] ${
                        index % 2 === 0 ? 'bg-[#fff8e8]' : 'bg-[#d9e9ff]'
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <p className="text-lg font-black text-black">{student.name}</p>
                          <p className="mt-1 text-sm font-medium text-black/70">{student.email}</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <span className="retro-chip bg-white">Roll no: {student.rollNo || 'N/A'}</span>
                            <span className="retro-chip bg-white">{student.courses?.length || 0} courses</span>
                            <span className={`retro-chip ${student.hasParentAccount ? 'bg-[#97e675]' : 'bg-[#ffefab]'}`}>
                              {student.hasParentAccount ? `Parent: ${student.parentName || 'Connected'}` : 'Parent not linked'}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedStudentId(student.id)}
                          className={`retro-button px-4 py-2 ${selectedStudentId === student.id ? 'bg-[#ff8db3]' : 'bg-white'}`}
                        >
                          {selectedStudentId === student.id ? 'Selected' : 'Open details'}
                        </button>
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr,1fr,auto]">
                        <input
                          type="number"
                          min="0"
                          value={attendanceDrafts[student.id]?.present ?? '0'}
                          onChange={(e) => updateAttendanceDraft(student.id, 'present', e.target.value)}
                          placeholder="Present"
                          className="retro-input"
                        />
                        <input
                          type="number"
                          min="0"
                          value={attendanceDrafts[student.id]?.absent ?? '0'}
                          onChange={(e) => updateAttendanceDraft(student.id, 'absent', e.target.value)}
                          placeholder="Absent"
                          className="retro-input"
                        />
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => submitAttendance(student.id)}
                          className="retro-button bg-[#97e675]"
                        >
                          {saving && savingAttendanceId === student.id ? 'Saving...' : 'Save attendance'}
                        </button>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {(student.courses || []).map((course) => (
                          <span key={course.id} className="retro-chip bg-[#ffefab]">
                            {course.title}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="retro-panel p-6">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="retro-chip bg-[#fff0e4]">Student detail</p>
                  <h2 className="retro-title mt-3 text-3xl">Behaviour Note</h2>
                </div>
              </div>
              {!selectedStudent ? (
                <div className="rounded-[22px] border-[3px] border-dashed border-black bg-[#fff8e8] px-6 py-10 text-center">
                  <p className="font-bold text-black">Select a student from the attendance board.</p>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="rounded-[22px] border-[3px] border-black bg-[#d9e9ff] p-4 shadow-[5px_5px_0_#111111]">
                    <p className="text-lg font-black text-black">{selectedStudent.name}</p>
                    <p className="mt-1 text-sm font-medium text-black/70">{selectedStudent.email}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="retro-chip bg-white">Roll no: {selectedStudent.rollNo || 'N/A'}</span>
                      <span className={`retro-chip ${selectedStudent.hasParentAccount ? 'bg-[#97e675]' : 'bg-[#ffefab]'}`}>
                        {selectedStudent.hasParentAccount ? `Parent: ${selectedStudent.parentName || 'Connected'}` : 'Parent not linked'}
                      </span>
                    </div>
                  </div>

                  <form onSubmit={submitBehaviour} className="rounded-[22px] border-[3px] border-black bg-[#fff8e8] p-4 shadow-[5px_5px_0_#111111]">
                    <div className="mb-4">
                      <p className="retro-chip bg-[#ffefab]">Behaviour</p>
                      <h3 className="retro-title mt-3 text-2xl">Add Note</h3>
                    </div>
                    <textarea
                      value={behaviourNote}
                      onChange={(e) => setBehaviourNote(e.target.value)}
                      rows={4}
                      placeholder="Add behaviour, discipline, or participation feedback"
                      className="retro-input min-h-[120px] resize-none"
                    />
                    <button type="submit" disabled={saving} className="retro-button mt-4 bg-[#ffd84d]">
                      {saving ? 'Saving...' : 'Add behaviour note'}
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="retro-panel p-6">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <p className="retro-chip bg-[#d9e9ff]">Parent communication</p>
                  <h2 className="retro-title mt-3 text-3xl">Messages</h2>
                </div>
              </div>
              {!selectedStudent ? (
                <div className="rounded-[22px] border-[3px] border-dashed border-black bg-[#fff8e8] px-6 py-10 text-center">
                  <p className="font-bold text-black">Select a student to open parent communication.</p>
                </div>
              ) : (
                <>
                  <p className="mb-4 text-sm font-medium text-black/70">
                    Messaging is tied to <span className="font-bold text-black">{selectedStudent.email}</span> and roll no{' '}
                    <span className="font-bold text-black">{selectedStudent.rollNo || 'N/A'}</span>.
                  </p>
                  <div className="space-y-3 max-h-80 overflow-auto pr-1">
                    {messages.length === 0 ? (
                      <div className="rounded-[22px] border-[3px] border-dashed border-black bg-[#fff8e8] px-6 py-10 text-center">
                        <p className="font-bold text-black">No parent conversation yet.</p>
                      </div>
                    ) : (
                      messages.map((message) => (
                        <div
                          key={message._id}
                          className={`rounded-[22px] border-[3px] border-black px-4 py-4 shadow-[5px_5px_0_#111111] ${
                            message.senderRole === 'teacher' ? 'mr-8 bg-[#6fa8ff]' : 'ml-8 bg-[#fff8e8]'
                          }`}
                        >
                          <p className="font-bold text-black">{message.message}</p>
                          <p className="retro-mono mt-2 text-[10px] uppercase tracking-[0.18em] text-black/70">
                            {message.senderRole === 'teacher' ? 'You' : 'Parent'} • {new Date(message.createdAt).toLocaleString()}
                          </p>
                        </div>
                      ))
                    )}
                  </div>

                  <form onSubmit={submitMessage} className="mt-5 space-y-3">
                    <textarea
                      value={messageForm}
                      onChange={(e) => setMessageForm(e.target.value)}
                      rows={4}
                      placeholder="Send a note to the parent"
                      className="retro-input min-h-[120px] resize-none"
                    />
                    <button type="submit" disabled={saving} className="retro-button bg-[#6fa8ff]">
                      {saving ? 'Sending...' : 'Send parent message'}
                    </button>
                  </form>
                </>
              )}
            </div>

            <div className="retro-panel p-6">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <p className="retro-chip bg-[#ffefab]">Latest behaviour</p>
                  <h2 className="retro-title mt-3 text-3xl">Recent Notes</h2>
                </div>
                <span className="retro-chip bg-[#97e675]">{studentsWithBehaviour.length} updates</span>
              </div>
              <div className="space-y-4">
                {studentsWithBehaviour.length === 0 ? (
                  <div className="rounded-[22px] border-[3px] border-dashed border-black bg-[#fff8e8] px-6 py-10 text-center">
                    <p className="font-bold text-black">No behaviour updates added yet.</p>
                  </div>
                ) : (
                  studentsWithBehaviour.slice(0, 6).map((student, index) => (
                    <div key={student.id} className={`rounded-[22px] border-[3px] border-black p-4 shadow-[5px_5px_0_#111111] ${index % 2 === 0 ? 'bg-[#fff8e8]' : 'bg-[#d9e9ff]'}`}>
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-lg font-black text-black">{student.name}</p>
                          <p className="mt-1 text-sm font-medium text-black/70">{student.rollNo || 'No Roll Number'}</p>
                        </div>
                        <span className="retro-chip bg-white">{new Date(student.latestBehaviourNote.createdAt).toLocaleDateString()}</span>
                      </div>
                      <p className="mt-3 text-sm font-medium text-black/80">{student.latestBehaviourNote.note}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </Layout>
  )
}
