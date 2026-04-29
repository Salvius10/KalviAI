import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../../lib/axios'
import useAuthStore from '../../store/authStore'
import ThemeToggle from '../../components/shared/ThemeToggle'

const portals = [
  { id: 'student', label: 'Student', color: 'bg-[#6fa8ff]' },
  { id: 'teacher', label: 'Teacher', color: 'bg-[#c6b3ff]' },
  { id: 'parent', label: 'Parent', color: 'bg-[#97e675]' },
]

const getDashboardPath = (role) => {
  if (role === 'teacher') return '/teacher/dashboard'
  if (role === 'parent') return '/parent/dashboard'
  return '/student/dashboard'
}

export default function Login() {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)
  const [portal, setPortal] = useState('student')
  const [form, setForm] = useState({ email: '', rollNo: '', password: '' })
  const [parentSetup, setParentSetup] = useState({ name: '', rollNo: '', password: '' })
  const [error, setError] = useState('')
  const [parentSetupError, setParentSetupError] = useState('')
  const [loading, setLoading] = useState(false)
  const [creatingParent, setCreatingParent] = useState(false)

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })
  const handleParentSetupChange = (e) => setParentSetup({ ...parentSetup, [e.target.name]: e.target.value })

  const handlePortalChange = (nextPortal) => {
    setPortal(nextPortal)
    setError('')
    setParentSetupError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await api.post('/auth/login', { ...form, portal })
      login(res.data.user, res.data.token)
      navigate(getDashboardPath(res.data.user.role))
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateParent = async (e) => {
    e.preventDefault()
    setParentSetupError('')
    setCreatingParent(true)
    try {
      const res = await api.post('/auth/register-parent', parentSetup)
      login(res.data.user, res.data.token)
      navigate('/parent/dashboard')
    } catch (err) {
      setParentSetupError(err.response?.data?.message || 'Parent setup failed')
    } finally {
      setCreatingParent(false)
    }
  }

  const activePortal = portals.find((item) => item.id === portal) || portals[0]

  return (
    <div className="theme-app min-h-screen retro-grid-bg px-4 py-6">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-6xl items-center justify-center">
        <div className="w-full space-y-6">
          <div className="flex justify-end">
            <ThemeToggle />
          </div>
          <section className="retro-shell overflow-hidden">
            <div className="grid lg:grid-cols-[1.05fr,0.95fr]">
              <div className="border-b-[3px] border-black bg-[#ffd84d] p-6 lg:border-b-0 lg:border-r-[3px]">
                <div className="retro-chip bg-white text-black border-black">Retro access</div>
                <h1 className="retro-title mt-5 text-5xl sm:text-6xl text-black">KalviAI Login</h1>
                <p className="mt-4 max-w-xl text-base font-medium text-black/75">
                  Teacher, student, and parent access now live in one retro-styled entry screen.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <span className="retro-chip bg-white text-black border-black">Student: email + roll no + password</span>
                  <span className="retro-chip bg-white text-black border-black">Teacher: email + password</span>
                  <span className="retro-chip bg-white text-black border-black">Parent: roll no + password</span>
                </div>
              </div>

              <div className="bg-[color:var(--retro-paper)] p-6">
                <div className="grid grid-cols-3 gap-3">
                  {portals.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handlePortalChange(item.id)}
                      className={`rounded-[18px] border-[3px] border-[color:var(--retro-ink)] px-4 py-3 text-sm font-black uppercase tracking-[0.12em] text-[color:var(--retro-ink)] transition-transform hover:-translate-y-0.5 ${
                        portal === item.id
                          ? `${item.color} !text-black !border-black shadow-[5px_5px_0_#111111]`
                          : 'bg-[color:var(--retro-paper)] shadow-[3px_3px_0_#111111]'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                <div className="mt-6 rounded-[24px] border-[3px] border-[color:var(--retro-ink)] bg-[color:var(--retro-paper)] p-5 shadow-[6px_6px_0_#111111]">
                  <p className="retro-mono text-xs uppercase tracking-[0.18em] text-[color:color-mix(in_srgb,var(--retro-ink)_70%,transparent)]">Selected portal</p>
                  <h2 className="retro-title mt-3 text-3xl">{portal} sign in</h2>
                  <p className="mt-2 text-sm font-medium text-[color:color-mix(in_srgb,var(--retro-ink)_70%,transparent)]">
                    {portal === 'student'
                      ? 'Students must enter email, roll number, and password.'
                      : portal === 'teacher'
                      ? 'Teachers log in with email and password only.'
                      : 'Parents log in with student roll number and parent password.'}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <div className={`grid gap-6 ${portal === 'parent' ? 'lg:grid-cols-[0.95fr,1.05fr]' : 'lg:grid-cols-1'}`}>
            <section className="retro-panel p-6">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <p className={`retro-chip ${activePortal.color}`}>Login form</p>
                  <h2 className="retro-title mt-3 text-4xl">
                    {portal === 'teacher' ? 'Teacher Access' : portal === 'parent' ? 'Parent Access' : 'Student Access'}
                  </h2>
                </div>
                <Link to="/register" className="retro-button bg-white px-4 py-2">
                  Register
                </Link>
              </div>

              {error && (
                <div className="mb-5 rounded-[18px] border-[3px] border-black bg-[#ffb3cb] px-4 py-3 shadow-[4px_4px_0_#111111]">
                  <p className="font-bold text-black">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {portal !== 'parent' && (
                  <div>
                    <label className="retro-mono mb-2 block text-xs uppercase tracking-[0.18em] text-[color:color-mix(in_srgb,var(--retro-ink)_70%,transparent)]">Email address</label>
                    <input
                      type="email"
                      name="email"
                      value={form.email}
                      onChange={handleChange}
                      placeholder={portal === 'teacher' ? 'teacher@example.com' : 'student@example.com'}
                      required={portal !== 'parent'}
                      className="retro-input"
                    />
                  </div>
                )}

                {(portal === 'student' || portal === 'parent') && (
                  <div>
                    <label className="retro-mono mb-2 block text-xs uppercase tracking-[0.18em] text-[color:color-mix(in_srgb,var(--retro-ink)_70%,transparent)]">
                      {portal === 'student' ? 'Roll number' : 'Student roll number'}
                    </label>
                    <input
                      type="text"
                      name="rollNo"
                      value={form.rollNo}
                      onChange={handleChange}
                      placeholder="KALVI-101"
                      required
                      className="retro-input uppercase"
                    />
                  </div>
                )}

                <div>
                  <label className="retro-mono mb-2 block text-xs uppercase tracking-[0.18em] text-black/70">
                    {portal === 'parent' ? 'Parent password' : 'Password'}
                  </label>
                  <input
                    type="password"
                    name="password"
                    value={form.password}
                    onChange={handleChange}
                    placeholder="••••••••"
                    required
                    className="retro-input"
                  />
                </div>

                <button type="submit" disabled={loading} className={`retro-button w-full ${activePortal.color}`}>
                  {loading ? 'Signing in...' : `Sign in as ${portal}`}
                </button>
              </form>

              <p className="mt-5 text-sm font-medium text-[color:color-mix(in_srgb,var(--retro-ink)_70%,transparent)]">
                Teacher or student account needed?{' '}
                <Link to="/register" className="font-black text-[color:var(--retro-ink)] underline">
                  Create one here
                </Link>
              </p>
            </section>

            {portal === 'parent' && (
              <section className="retro-panel p-6">
                <div className="mb-5">
                  <p className="retro-chip bg-[#97e675]">Parent account setup</p>
                  <h2 className="retro-title mt-3 text-4xl">Create Parent Access</h2>
                  <p className="mt-2 text-sm font-medium text-[color:color-mix(in_srgb,var(--retro-ink)_70%,transparent)]">
                    This setup is shown only for parents. Student and teacher login will not display it.
                  </p>
                </div>

                {parentSetupError && (
                  <div className="mb-5 rounded-[18px] border-[3px] border-black bg-[#ffb3cb] px-4 py-3 shadow-[4px_4px_0_#111111]">
                    <p className="font-bold text-black">{parentSetupError}</p>
                  </div>
                )}

                <form onSubmit={handleCreateParent} className="space-y-4">
                  <div>
                    <label className="retro-mono mb-2 block text-xs uppercase tracking-[0.18em] text-[color:color-mix(in_srgb,var(--retro-ink)_70%,transparent)]">Parent name</label>
                    <input
                      type="text"
                      name="name"
                      value={parentSetup.name}
                      onChange={handleParentSetupChange}
                      placeholder="Parent or guardian name"
                      required
                      className="retro-input"
                    />
                  </div>

                  <div>
                    <label className="retro-mono mb-2 block text-xs uppercase tracking-[0.18em] text-[color:color-mix(in_srgb,var(--retro-ink)_70%,transparent)]">Student roll number</label>
                    <input
                      type="text"
                      name="rollNo"
                      value={parentSetup.rollNo}
                      onChange={handleParentSetupChange}
                      placeholder="KALVI-101"
                      required
                      className="retro-input uppercase"
                    />
                  </div>

                  <div>
                    <label className="retro-mono mb-2 block text-xs uppercase tracking-[0.18em] text-[color:color-mix(in_srgb,var(--retro-ink)_70%,transparent)]">Create parent password</label>
                    <input
                      type="password"
                      name="password"
                      value={parentSetup.password}
                      onChange={handleParentSetupChange}
                      placeholder="••••••••"
                      required
                      className="retro-input"
                    />
                  </div>

                  <button type="submit" disabled={creatingParent} className="retro-button w-full bg-[#97e675]">
                    {creatingParent ? 'Creating parent access...' : 'Create parent access'}
                  </button>
                </form>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
