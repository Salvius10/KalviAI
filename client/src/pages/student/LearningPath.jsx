import { useState, useEffect } from 'react'
import axios from 'axios'
import useAuthStore from '../../store/authStore'

const PRIORITY_STYLES = {
  high:   'bg-red-500/20 text-red-400 border border-red-500/30',
  medium: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
  low:    'bg-green-500/20 text-green-400 border border-green-500/30',
}

const TYPE_ICON = { material: '📄', assessment: '✏️', review: '🔁' }

export default function LearningPath() {
  const { token } = useAuthStore()
  const [path, setPath]           = useState(null)
  const [loading, setLoading]     = useState(true)
  const [regenerating, setRegen]  = useState(false)
  const [editGoal, setEditGoal]   = useState(false)
  const [goalInput, setGoalInput] = useState('')
  const [error, setError]         = useState(null)

  const headers = { headers: { Authorization: `Bearer ${token}` } }

  const fetchPath = async () => {
    try {
      setLoading(true)
      setError(null)
      const { data } = await axios.get('/api/learning-path', headers)
      setPath(data.data)
      setGoalInput(data.data.goal || '')
    } catch {
      setError('Could not load your learning path. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchPath() }, [])

  const handleRegenerate = async () => {
    try {
      setRegen(true)
      setError(null)
      const { data } = await axios.post('/api/learning-path/regenerate', {}, headers)
      setPath(data.data)
      setGoalInput(data.data.goal || '')
    } catch {
      setError('Regeneration failed. Please try again.')
    } finally {
      setRegen(false)
    }
  }

  const handleMarkComplete = async (stepId) => {
    try {
      const { data } = await axios.patch(`/api/learning-path/step/${stepId}/complete`, {}, headers)
      setPath(data.data)
    } catch {
      setError('Could not mark step complete.')
    }
  }

  const handleSaveGoal = async () => {
    if (!goalInput.trim()) return
    try {
      await axios.patch('/api/learning-path/goal', { goal: goalInput }, headers)
      setEditGoal(false)
      fetchPath()
    } catch {
      setError('Could not update goal.')
    }
  }

  // ── Loading screen ──────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4 shadow-lg shadow-blue-500/30 animate-pulse">
          <span className="text-2xl">🎯</span>
        </div>
        <p className="text-slate-400 text-sm mt-2">AI is building your personalized path…</p>
      </div>
    </div>
  )

  // ── Error screen ────────────────────────────────────────────────────────────
  if (error) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
      <div className="text-center">
        <p className="text-red-400 mb-4">{error}</p>
        <button onClick={fetchPath} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm transition">
          Retry
        </button>
      </div>
    </div>
  )

  if (!path) return null

  const pct = path.totalSteps > 0 ? Math.round((path.completedSteps / path.totalSteps) * 100) : 0

  // ── Main page ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-3xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">My Learning Path</h1>
            <p className="text-slate-400 text-sm mt-1">Personalized by AI · refreshes weekly</p>
          </div>
          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-xl text-sm text-slate-300 disabled:opacity-50 transition"
          >
            {regenerating
              ? <><span className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin inline-block" /> Regenerating…</>
              : '↻ Regenerate'}
          </button>
        </div>

        {/* Goal */}
        <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Your Goal</span>
            {!editGoal && (
              <button onClick={() => setEditGoal(true)} className="text-xs text-slate-400 hover:text-white transition">Edit</button>
            )}
          </div>
          {editGoal ? (
            <div className="flex gap-2">
              <input
                className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={goalInput}
                onChange={(e) => setGoalInput(e.target.value)}
                placeholder="e.g. Score 85% in my upcoming exams"
              />
              <button onClick={handleSaveGoal} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition">Save</button>
              <button onClick={() => setEditGoal(false)} className="px-3 py-1.5 text-slate-400 hover:text-white text-sm transition">Cancel</button>
            </div>
          ) : (
            <p className="text-slate-200 text-sm">{path.goal}</p>
          )}
        </div>

        {/* AI Summary */}
        {path.summary && (
          <div className="bg-slate-800/60 border border-purple-500/30 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-purple-400">✦</span>
              <span className="text-xs font-semibold text-purple-400 uppercase tracking-wider">AI Coach Summary</span>
            </div>
            <p className="text-slate-300 text-sm leading-relaxed">{path.summary}</p>
          </div>
        )}

        {/* Weak / Strong topics */}
        {(path.weakTopics?.length > 0 || path.strongTopics?.length > 0) && (
          <div className="grid grid-cols-2 gap-4">
            {path.weakTopics?.length > 0 && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4">
                <p className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-2">Needs Attention</p>
                <div className="flex flex-wrap gap-1.5">
                  {path.weakTopics.map((t) => (
                    <span key={t} className="text-xs bg-red-500/20 text-red-300 border border-red-500/30 px-2 py-0.5 rounded-full">{t}</span>
                  ))}
                </div>
              </div>
            )}
            {path.strongTopics?.length > 0 && (
              <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-4">
                <p className="text-xs font-semibold text-green-400 uppercase tracking-wider mb-2">Strengths</p>
                <div className="flex flex-wrap gap-1.5">
                  {path.strongTopics.map((t) => (
                    <span key={t} className="text-xs bg-green-500/20 text-green-300 border border-green-500/30 px-2 py-0.5 rounded-full">{t}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Progress bar */}
        <div>
          <div className="flex justify-between text-sm text-slate-400 mb-2">
            <span>{path.completedSteps} of {path.totalSteps} steps done</span>
            <span>{pct}%</span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-2">
            <div className="bg-blue-500 h-2 rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {/* Steps list */}
        <div className="space-y-3">
          {path.steps.map((step, idx) => (
            <div
              key={step._id || idx}
              className={`flex gap-4 p-4 rounded-2xl border transition-all ${
                step.completed
                  ? 'bg-slate-800/30 border-slate-700/50 opacity-50'
                  : 'bg-slate-800/60 border-slate-700 hover:border-slate-500'
              }`}
            >
              {/* Circle */}
              <div className="flex-shrink-0 mt-0.5">
                {step.completed
                  ? <div className="w-7 h-7 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center text-green-400 text-sm">✓</div>
                  : <div className="w-7 h-7 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center text-slate-400 text-xs font-medium">{step.order}</div>
                }
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-0.5">
                  <span className="text-sm">{TYPE_ICON[step.type] || '📌'}</span>
                  <span className={`text-sm font-medium ${step.completed ? 'line-through text-slate-500' : 'text-white'}`}>
                    {step.title}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_STYLES[step.priority]}`}>
                    {step.priority}
                  </span>
                </div>
                {step.reason && <p className="text-xs text-slate-400 italic mt-0.5">{step.reason}</p>}
                {step.estimatedMinutes && <p className="text-xs text-slate-500 mt-1">~{step.estimatedMinutes} min</p>}
              </div>

              {/* Done button */}
              {!step.completed && (
                <button
                  onClick={() => handleMarkComplete(step._id)}
                  className="flex-shrink-0 self-center px-3 py-1.5 text-xs bg-slate-700 hover:bg-blue-600 border border-slate-600 hover:border-blue-500 text-slate-300 hover:text-white rounded-lg transition"
                >
                  Done
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        {path.estimatedTotalMinutes > 0 && (
          <p className="text-xs text-slate-500 text-center pb-4">
            ~{Math.round(path.estimatedTotalMinutes / 60)}h total · refreshes{' '}
            {new Date(path.nextRefreshAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </p>
        )}

      </div>
    </div>
  )
}
