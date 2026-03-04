import { useEffect, useState } from 'react'
import Layout from '../../components/shared/Layout'
import api from '../../lib/axios'

export default function StudentAssessments() {
  const [courses, setCourses] = useState([])
  const [assessments, setAssessments] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeAssessment, setActiveAssessment] = useState(null)
  const [answers, setAnswers] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null)
  const [timeLeft, setTimeLeft] = useState(null)

  const fetchData = async () => {
  try {
    const res = await api.get('/assessments/student/all')
    setAssessments(res.data.map(a => ({
      ...a,
      courseTitle: a.course?.title || 'Unknown Course'
    })))
  } catch (err) {
    console.error(err)
  } finally {
    setLoading(false)
  }
}

  useEffect(() => { fetchData() }, [])

  // Timer countdown
  useEffect(() => {
    if (!timeLeft) return
    if (timeLeft <= 0) { handleSubmit(); return }
    const timer = setTimeout(() => setTimeLeft(t => t - 1), 1000)
    return () => clearTimeout(timer)
  }, [timeLeft])

  const startAssessment = (assessment) => {
    setActiveAssessment(assessment)
    setAnswers(assessment.questions.map(() => ({ studentAnswer: '' })))
    setResult(null)
    setTimeLeft(assessment.duration * 60)
  }

  const handleAnswer = (index, value) => {
    const updated = [...answers]
    updated[index] = { studentAnswer: value }
    setAnswers(updated)
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      const res = await api.post('/submissions', {
        assessmentId: activeAssessment._id,
        answers,
      })
      setResult(res.data)
      setActiveAssessment(null)
      setTimeLeft(null)
    } catch (err) {
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0')
    const s = (seconds % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  const difficultyColor = {
    easy: 'text-green-400 bg-green-500/10',
    medium: 'text-yellow-400 bg-yellow-500/10',
    hard: 'text-red-400 bg-red-500/10'
  }

  // Result Screen
  if (result) {
    return (
      <Layout>
        <div className="max-w-lg mx-auto text-center space-y-6 py-12">
          <div className={`text-6xl mb-4 ${result.percentage >= 70 ? '' : result.percentage >= 40 ? '' : ''}`}>
            {result.percentage >= 70 ? '🎉' : result.percentage >= 40 ? '👍' : '😔'}
          </div>
          <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-8">
            <h2 className="text-white text-2xl font-bold mb-1">Assessment Complete!</h2>
            <p className="text-slate-400 text-sm mb-6">Here are your results</p>
            <div className={`text-5xl font-bold mb-2 ${result.percentage >= 70 ? 'text-green-400' : result.percentage >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
              {Math.round(result.percentage)}%
            </div>
            <p className="text-slate-300 text-sm">{result.totalScore} / {result.maxScore} marks</p>
            <div className="mt-6 w-full bg-slate-700 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${result.percentage >= 70 ? 'bg-green-400' : result.percentage >= 40 ? 'bg-yellow-400' : 'bg-red-400'}`}
                style={{ width: `${result.percentage}%` }}
              />
            </div>
            <p className="text-slate-400 text-xs mt-3">
              {result.percentage >= 70 ? 'Excellent work! Keep it up!' : result.percentage >= 40 ? 'Good effort! Review the topics and try again.' : 'Keep practicing! You\'ll do better next time.'}
            </p>
          </div>
          <button
            onClick={() => setResult(null)}
            className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-6 py-3 rounded-xl transition-all"
          >
            Back to Assessments
          </button>
        </div>
      </Layout>
    )
  }

  // Active Assessment Screen
  if (activeAssessment) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto space-y-6">

          {/* Timer Header */}
          <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl px-6 py-4 flex items-center justify-between">
            <div>
              <h2 className="text-white font-bold">{activeAssessment.title}</h2>
              <p className="text-slate-400 text-xs mt-0.5">{activeAssessment.questions.length} questions</p>
            </div>
            <div className={`text-xl font-bold font-mono ${timeLeft < 60 ? 'text-red-400' : 'text-white'}`}>
              ⏱️ {formatTime(timeLeft)}
            </div>
          </div>

          {/* Questions */}
          <div className="space-y-4">
            {activeAssessment.questions.map((q, qi) => (
              <div key={qi} className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-5 space-y-3">
                <div className="flex items-start gap-3">
                  <span className="bg-blue-600/20 text-blue-400 text-xs font-bold px-2.5 py-1 rounded-lg flex-shrink-0">
                    Q{qi + 1}
                  </span>
                  <p className="text-white text-sm font-medium">{q.questionText}</p>
                </div>

                {q.type === 'mcq' && (
                  <div className="space-y-2 pl-8">
                    {q.options.filter(o => o).map((opt, oi) => (
                      <label key={oi} className="flex items-center gap-3 cursor-pointer group">
                        <input
                          type="radio"
                          name={`q-${qi}`}
                          value={opt}
                          checked={answers[qi]?.studentAnswer === opt}
                          onChange={() => handleAnswer(qi, opt)}
                          className="accent-blue-500"
                        />
                        <span className={`text-sm transition-colors ${answers[qi]?.studentAnswer === opt ? 'text-blue-400' : 'text-slate-300'}`}>
                          {opt}
                        </span>
                      </label>
                    ))}
                  </div>
                )}

                {(q.type === 'short_answer') && (
                  <input
                    type="text"
                    value={answers[qi]?.studentAnswer || ''}
                    onChange={(e) => handleAnswer(qi, e.target.value)}
                    placeholder="Type your answer..."
                    className="w-full bg-slate-700/50 border border-slate-600/50 text-white placeholder-slate-500 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 ml-8"
                  />
                )}

                {q.type === 'descriptive' && (
                  <textarea
                    value={answers[qi]?.studentAnswer || ''}
                    onChange={(e) => handleAnswer(qi, e.target.value)}
                    placeholder="Write your answer..."
                    rows={3}
                    className="w-full bg-slate-700/50 border border-slate-600/50 text-white placeholder-slate-500 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none ml-8"
                  />
                )}

                <div className="flex justify-end">
                  <span className="text-xs text-slate-500">{q.marks} mark{q.marks > 1 ? 's' : ''}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Submit */}
          <div className="flex gap-3">
            <button
              onClick={() => { setActiveAssessment(null); setTimeLeft(null) }}
              className="flex-1 bg-slate-700/50 hover:bg-slate-600/50 text-white text-sm font-medium py-3 rounded-xl transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold py-3 rounded-xl transition-all"
            >
              {submitting ? 'Submitting...' : 'Submit Assessment'}
            </button>
          </div>
        </div>
      </Layout>
    )
  }

  // Assessments List
  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Assessments</h1>
          <p className="text-slate-400 text-sm mt-1">Take assessments assigned by your teachers</p>
        </div>

        {loading ? (
          <div className="text-slate-400 text-sm">Loading assessments...</div>
        ) : assessments.length === 0 ? (
          <div className="text-center py-20 bg-slate-800/60 border border-slate-700/50 rounded-2xl">
            <p className="text-4xl mb-3">📝</p>
            <p className="text-white font-semibold">No assessments available</p>
            <p className="text-slate-400 text-sm mt-1">Your teacher hasn't assigned any assessments yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {assessments.map((assessment) => (
              <div key={assessment._id} className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-5 flex items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-white font-semibold text-sm">{assessment.title}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${difficultyColor[assessment.difficulty]}`}>
                      {assessment.difficulty}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-1.5 text-xs text-slate-400">
                    <span>📚 {assessment.courseTitle}</span>
                    <span>❓ {assessment.questions?.length || 0} questions</span>
                    <span>⏱️ {assessment.duration} mins</span>
                    {assessment.topic && <span>🏷️ {assessment.topic}</span>}
                  </div>
                </div>
                <button
                  onClick={() => startAssessment(assessment)}
                  className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-all flex-shrink-0"
                >
                  Start →
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}