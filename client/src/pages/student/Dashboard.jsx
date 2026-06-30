import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import Layout from '../../components/shared/Layout'
import api from '../../lib/axios'
import useAuthStore from '../../store/authStore'

const quickLinks = [
  { label: 'AI Tutor', path: '/student/ai-tutor', note: 'Ask for guided hints', color: 'bg-[#6fa8ff]' },
  { label: 'Flashcards', path: '/student/flashcards', note: 'Revise with quick cards', color: 'bg-[#ff8db3]' },
  { label: 'Study Tracker', path: '/student/study-sessions', note: 'Track focus hours', color: 'bg-[#97e675]' },
  { label: 'Assessments', path: '/student/assessments', note: 'Open pending work', color: 'bg-[#ffd84d]' },
]

export default function StudentDashboard() {
  const { user } = useAuthStore()
  const [attendance, setAttendance] = useState({ present: 0, absent: 0 })
  const [performance, setPerformance] = useState(null)
  const [courses, setCourses] = useState([])
  const [assessments, setAssessments] = useState([])
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [perfRes, courseRes, sessionRes, assessmentRes, meRes] = await Promise.all([
          api.get('/performance/me'),
          api.get('/courses'),
          api.get('/study-sessions/my'),
          api.get('/assessments/student/all'),
          api.get('/auth/me'),
        ])
        setPerformance(perfRes.data)
        setCourses(courseRes.data)
        setSessions(sessionRes.data)
        setAssessments(assessmentRes.data)
        setAttendance(meRes.data?.attendance || { present: 0, absent: 0 })
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const chartData = performance?.submissions?.slice(-7).map((sub, i) => ({
    name: `T${i + 1}`,
    score: Math.round(sub.percentage || 0),
  })) || []
  const stats = [
    { label: 'Courses', value: courses.length, accent: 'bg-[#6fa8ff]' },
    { label: 'Assessments', value: assessments.length, accent: 'bg-[#ffd84d]' },
    { label: 'Average Score', value: `${Math.round(performance?.averageScore || 0)}%`, accent: 'bg-[#ff8db3]' },
    { label: 'Study Sessions', value: sessions.length, accent: 'bg-[#97e675]' },
  ]

  return (
    <Layout>
      <div className="space-y-6">
        <section className="retro-shell overflow-hidden">
          <div className="grid gap-0 lg:grid-cols-[1.3fr,0.7fr]">
            <div className="border-b-[3px] border-black bg-[#ffd84d] p-6 lg:border-b-0 lg:border-r-[3px]">
              <div className="retro-chip bg-white">Student dashboard</div>
              <h1 className="retro-title mt-4 text-4xl sm:text-5xl">
                {user?.name?.split(' ')[0]}, keep the streak loud.
              </h1>
              <p className="mt-4 max-w-2xl text-base font-medium text-black/75">
                Your workbench for courses, scores, focus sessions, and fast jumps into study tools.
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

        <section className="grid gap-6 xl:grid-cols-[1.35fr,0.65fr]">
          <div className="retro-panel p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="retro-chip bg-[#d9e9ff]">Progress tape</p>
                <h2 className="retro-title mt-3 text-3xl">Recent Scores</h2>
              </div>
              <span className="retro-chip bg-[#ffefab]">Last 7 attempts</span>
            </div>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={chartData} margin={{ top: 10, right: 16, left: -12, bottom: 0 }}>
                  <CartesianGrid stroke="#111111" strokeDasharray="5 5" />
                  <XAxis dataKey="name" stroke="#111111" tick={{ fill: '#111111', fontSize: 12, fontWeight: 700 }} />
                  <YAxis stroke="#111111" domain={[0, 100]} tick={{ fill: '#111111', fontSize: 12, fontWeight: 700 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff8e8',
                      border: '3px solid #111111',
                      borderRadius: '18px',
                      color: '#111111',
                      boxShadow: '5px 5px 0 #111111',
                    }}
                  />
                  <Line type="monotone" dataKey="score" stroke="#111111" strokeWidth={4} dot={{ fill: '#ff8db3', stroke: '#111111', strokeWidth: 3, r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="rounded-[22px] border-[3px] border-dashed border-black bg-[#fff0e4] px-6 py-16 text-center">
                <p className="text-lg font-bold text-black">No scores yet.</p>
                <p className="mt-2 text-sm font-medium text-black/70">Take an assessment to start the chart.</p>
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

            <div className="retro-panel bg-[#111111] p-6 text-white shadow-[6px_6px_0_#ff8db3]">
              <p className="retro-mono text-xs uppercase tracking-[0.2em] text-white/70">Status</p>
              <p className="mt-3 text-3xl font-black">{loading ? 'Loading data...' : 'Ready to study'}</p>
              <p className="mt-2 text-sm font-medium text-white/75">
                {loading ? 'Pulling your courses and performance.' : `${courses.length} active courses and ${assessments.length} assigned assessments.`}
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <div className="retro-panel p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="retro-chip bg-[#97e675]">Attendance</p>
                <h2 className="retro-title mt-3 text-3xl">Presence Summary</h2>
              </div>
              <span className="retro-chip bg-white">Updated by teacher</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-[22px] border-[3px] border-black bg-[#97e675] p-4 shadow-[5px_5px_0_#111111]">
                <p className="retro-mono text-xs uppercase tracking-[0.18em] text-black/70">Present</p>
                <p className="mt-3 text-3xl font-black text-black">{attendance.present || 0}</p>
              </div>
              <div className="rounded-[22px] border-[3px] border-black bg-[#ff8db3] p-4 shadow-[5px_5px_0_#111111]">
                <p className="retro-mono text-xs uppercase tracking-[0.18em] text-black/70">Absent</p>
                <p className="mt-3 text-3xl font-black text-black">{attendance.absent || 0}</p>
              </div>
            </div>
            <p className="mt-4 text-sm font-medium text-black/70">
              Your teacher updates this record. Parents can see the same attendance status in their dashboard.
            </p>
          </div>

          <div className="retro-panel p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="retro-chip bg-[#d9e9ff]">Courses</p>
                <h2 className="retro-title mt-3 text-3xl">Enrolled Courses</h2>
              </div>
              <Link to="/student/courses" className="retro-button bg-[#6fa8ff] px-4 py-2">
                Open all
              </Link>
            </div>
            {loading ? (
              <p className="text-sm font-medium text-black/70">Loading courses...</p>
            ) : courses.length === 0 ? (
              <div className="rounded-[22px] border-[3px] border-dashed border-black bg-[#fff0e4] px-6 py-10 text-center">
                <p className="text-lg font-bold text-black">No courses assigned.</p>
                <p className="mt-2 text-sm font-medium text-black/70">Your teacher needs to add you first.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {courses.map((course, index) => (
                  <div key={course._id} className={`rounded-[22px] border-[3px] border-black px-4 py-4 shadow-[5px_5px_0_#111111] ${index % 2 === 0 ? 'bg-[#fff8e8]' : 'bg-[#d9e9ff]'}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-lg font-black text-black">{course.title}</p>
                        <p className="mt-1 text-sm font-medium text-black/70">Teacher: {course.teacher?.name}</p>
                      </div>
                      <span className="retro-chip bg-white">Assigned</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="retro-panel p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="retro-chip bg-[#ffefab]">Assessments</p>
                <h2 className="retro-title mt-3 text-3xl">Upcoming Work</h2>
              </div>
              <Link to="/student/assessments" className="retro-button bg-[#ffd84d] px-4 py-2">
                View all
              </Link>
            </div>
            {loading ? (
              <p className="text-sm font-medium text-black/70">Loading assessments...</p>
            ) : assessments.length === 0 ? (
              <div className="rounded-[22px] border-[3px] border-dashed border-black bg-[#e8ffd8] px-6 py-10 text-center">
                <p className="text-lg font-bold text-black">Nothing pending.</p>
                <p className="mt-2 text-sm font-medium text-black/70">You are clear for now.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {assessments.slice(0, 4).map((assessment, index) => (
                  <div key={assessment._id} className={`rounded-[22px] border-[3px] border-black px-4 py-4 shadow-[5px_5px_0_#111111] ${index % 2 === 0 ? 'bg-[#ff8db3]' : 'bg-[#fff8e8]'}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-lg font-black text-black">{assessment.title}</p>
                        <p className="mt-1 text-sm font-medium text-black/70">{assessment.course?.title || 'Assigned course'}</p>
                      </div>
                      <span className="retro-chip bg-white">{assessment.difficulty || 'medium'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </Layout>
  )
}
