import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../../lib/axios'
import useAuthStore from '../../store/authStore'
import ThemeToggle from '../../components/shared/ThemeToggle'

export default function Register() {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'student', rollNo: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const payload = form.role === 'student' ? form : { ...form, rollNo: '' }
      const res = await api.post('/auth/register', payload)
      login(res.data.user, res.data.token)
      navigate(res.data.user.role === 'teacher' ? '/teacher/dashboard' : '/student/dashboard')
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="theme-app min-h-screen retro-grid-bg px-4 py-6">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-5xl items-center justify-center">
        <div className="w-full space-y-6">
          <div className="flex justify-end">
            <ThemeToggle />
          </div>
          <section className="retro-shell overflow-hidden">
            <div className="grid lg:grid-cols-[1fr,1fr]">
              <div className="border-b-[3px] border-black bg-[#6fa8ff] p-6 lg:border-b-0 lg:border-r-[3px]">
                <div className="retro-chip bg-white">Account setup</div>
                <h1 className="retro-title mt-5 text-5xl sm:text-6xl">Register</h1>
                <p className="mt-4 max-w-xl text-base font-medium text-black/75">
                  Create a student or teacher account. Students must include a roll number.
                </p>
              </div>
              <div className="bg-[#fff8e8] p-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-[22px] border-[3px] border-black bg-[#ffd84d] p-4 shadow-[5px_5px_0_#111111]">
                    <p className="retro-mono text-xs uppercase tracking-[0.18em] text-black/70">Student</p>
                    <p className="mt-2 text-lg font-black text-black">Needs email, password, and roll number</p>
                  </div>
                  <div className="rounded-[22px] border-[3px] border-black bg-[#c6b3ff] p-4 shadow-[5px_5px_0_#111111]">
                    <p className="retro-mono text-xs uppercase tracking-[0.18em] text-black/70">Teacher</p>
                    <p className="mt-2 text-lg font-black text-black">Needs email and password</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="retro-panel p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="retro-chip bg-[#ffd84d]">Create account</p>
                <h2 className="retro-title mt-3 text-4xl">Join KalviAI</h2>
              </div>
              <Link to="/login" className="retro-button bg-white px-4 py-2">
                Login
              </Link>
            </div>

            {error && (
              <div className="mb-5 rounded-[18px] border-[3px] border-black bg-[#ffb3cb] px-4 py-3 shadow-[4px_4px_0_#111111]">
                <p className="font-bold text-black">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="retro-mono mb-2 block text-xs uppercase tracking-[0.18em] text-black/70">Full name</label>
                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="John Doe"
                  required
                  className="retro-input"
                />
              </div>

              <div>
                <label className="retro-mono mb-2 block text-xs uppercase tracking-[0.18em] text-black/70">Email address</label>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="you@example.com"
                  required
                  className="retro-input"
                />
              </div>

              <div>
                <label className="retro-mono mb-2 block text-xs uppercase tracking-[0.18em] text-black/70">Password</label>
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

              <div className="md:col-span-2">
                <label className="retro-mono mb-2 block text-xs uppercase tracking-[0.18em] text-black/70">Role</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, role: 'student' })}
                    className={`rounded-[18px] border-[3px] border-black px-4 py-4 text-sm font-black uppercase tracking-[0.12em] text-black transition-transform hover:-translate-y-0.5 ${
                      form.role === 'student' ? 'bg-[#6fa8ff] shadow-[5px_5px_0_#111111]' : 'bg-white shadow-[3px_3px_0_#111111]'
                    }`}
                  >
                    Student
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, role: 'teacher' })}
                    className={`rounded-[18px] border-[3px] border-black px-4 py-4 text-sm font-black uppercase tracking-[0.12em] text-black transition-transform hover:-translate-y-0.5 ${
                      form.role === 'teacher' ? 'bg-[#c6b3ff] shadow-[5px_5px_0_#111111]' : 'bg-white shadow-[3px_3px_0_#111111]'
                    }`}
                  >
                    Teacher
                  </button>
                </div>
              </div>

              {form.role === 'student' && (
                <div className="md:col-span-2">
                  <label className="retro-mono mb-2 block text-xs uppercase tracking-[0.18em] text-black/70">Roll number</label>
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

              <div className="md:col-span-2">
                <button type="submit" disabled={loading} className="retro-button w-full bg-[#ffd84d]">
                  {loading ? 'Creating account...' : 'Create account'}
                </button>
              </div>
            </form>

            <p className="mt-5 text-sm font-medium text-black/70">
              Parent setup is available only from the parent login screen. Already have an account?{' '}
              <Link to="/login" className="font-black text-black underline">
                Sign in
              </Link>
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
