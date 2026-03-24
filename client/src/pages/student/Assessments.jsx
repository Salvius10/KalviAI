import { useEffect, useState } from 'react'
import Layout from '../../components/shared/Layout'
import api from '../../lib/axios'

const getAssessmentType = (assessment) => {
  if (assessment?.assessmentType === 'pdf_assignment') return 'pdf_assignment'
  if ((assessment?.instructions || '').trim() && (!assessment?.questions || assessment.questions.length === 0)) return 'pdf_assignment'
  return 'quiz'
}

export default function StudentAssessments() {
  const [assessments, setAssessments] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeAssessment, setActiveAssessment] = useState(null)
  const [answers, setAnswers] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null)
  const [timeLeft, setTimeLeft] = useState(null)
  const [uploadFiles, setUploadFiles] = useState({})
  const [submissionMap, setSubmissionMap] = useState({})
  const [error, setError] = useState('')

  const fetchData = async () => {
    try {
      const [assessmentRes, submissionRes] = await Promise.all([
        api.get('/assessments/student/all'),
        api.get('/submissions/my'),
      ])

      const submissionsByAssessment = Object.fromEntries(
        submissionRes.data.map((submission) => [submission.assessment?._id || submission.assessment, submission])
      )

      setSubmissionMap(submissionsByAssessment)
      setAssessments(assessmentRes.data.map((a) => ({
        ...a,
        courseTitle: a.course?.title || 'Unknown Course',
      })))
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  useEffect(() => {
    if (!timeLeft) return
    if (timeLeft <= 0) {
      setSubmitting(true)
      api.post('/submissions', {
        assessmentId: activeAssessment?._id,
        answers,
      })
        .then((res) => {
          setResult(res.data)
          setSubmissionMap((prev) => ({ ...prev, [activeAssessment._id]: res.data }))
          setActiveAssessment(null)
          setTimeLeft(null)
        })
        .catch((err) => {
          setError(err.response?.data?.message || 'Failed to submit assessment')
        })
        .finally(() => {
          setSubmitting(false)
        })
      return
    }
    const timer = setTimeout(() => setTimeLeft((t) => t - 1), 1000)
    return () => clearTimeout(timer)
  }, [activeAssessment, answers, timeLeft])

  const startAssessment = (assessment) => {
    setError('')
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
    setError('')
    try {
      const res = await api.post('/submissions', {
        assessmentId: activeAssessment._id,
        answers,
      })
      setResult(res.data)
      setSubmissionMap((prev) => ({ ...prev, [activeAssessment._id]: res.data }))
      setActiveAssessment(null)
      setTimeLeft(null)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit assessment')
    } finally {
      setSubmitting(false)
    }
  }

  const handlePdfUpload = async (assessmentId) => {
    const file = uploadFiles[assessmentId]
    if (!file) {
      setError('Choose a PDF file before uploading')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const formData = new FormData()
      formData.append('assessmentId', assessmentId)
      formData.append('file', file)

      const res = await api.post('/submissions/upload', formData)
      setSubmissionMap((prev) => ({ ...prev, [assessmentId]: res.data }))
      setUploadFiles((prev) => ({ ...prev, [assessmentId]: null }))
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to upload assignment PDF')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteSubmission = async (assessmentId) => {
    const submission = submissionMap[assessmentId]
    if (!submission?._id) return

    setSubmitting(true)
    setError('')
    try {
      await api.delete(`/submissions/${submission._id}`)
      setSubmissionMap((prev) => {
        const next = { ...prev }
        delete next[assessmentId]
        return next
      })
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete previous submission')
    } finally {
      setSubmitting(false)
    }
  }

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0')
    const s = (seconds % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  const formatDueDate = (value) => {
    if (!value) return ''
    return new Date(value).toLocaleString()
  }

  const getDueState = (value) => {
    if (!value) return { isOverdue: false, label: 'No deadline' }

    const due = new Date(value).getTime()
    const now = Date.now()
    if (Number.isNaN(due)) return { isOverdue: false, label: 'No deadline' }

    if (due < now) {
      return { isOverdue: true, label: `Overdue since ${formatDueDate(value)}` }
    }

    return { isOverdue: false, label: `Due ${formatDueDate(value)}` }
  }

  const difficultyColor = {
    easy: 'text-green-400 bg-green-500/10',
    medium: 'text-yellow-400 bg-yellow-500/10',
    hard: 'text-red-400 bg-red-500/10',
  }

  if (result) {
    return (
      <Layout>
        <div className="max-w-lg mx-auto text-center space-y-6 py-12">
          <div className="text-6xl mb-4">
            {result.percentage >= 70 ? '🎉' : result.percentage >= 40 ? '👍' : '😔'}
          </div>
          <div className="retro-panel p-8">
            <h2 className="retro-title text-4xl mb-1">Assessment Complete!</h2>
            <p className="text-black/70 text-sm mb-6">Here are your results</p>
            <div className={`text-5xl font-bold mb-2 ${result.percentage >= 70 ? 'text-green-400' : result.percentage >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
              {Math.round(result.percentage)}%
            </div>
            <p className="text-black/70 text-sm">{result.totalScore} / {result.maxScore} marks</p>
            <div className="mt-6 w-full bg-black/10 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${result.percentage >= 70 ? 'bg-green-400' : result.percentage >= 40 ? 'bg-yellow-400' : 'bg-red-400'}`}
                style={{ width: `${result.percentage}%` }}
              />
            </div>
          </div>
          <button
            onClick={() => setResult(null)}
            className="retro-button bg-[#6fa8ff] px-6 py-3"
          >
            Back to Assessments
          </button>
        </div>
      </Layout>
    )
  }

  if (activeAssessment) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto space-y-6">
          {error && (
            <div className="retro-panel bg-[#ffb3cb] text-black text-sm px-4 py-3">
              {error}
            </div>
          )}

          <div className="retro-panel px-6 py-4 flex items-center justify-between">
            <div>
              <h2 className="text-black font-bold">{activeAssessment.title}</h2>
              <p className="text-black/70 text-xs mt-0.5">{activeAssessment.questions.length} questions</p>
            </div>
            <div className={`text-xl font-bold font-mono ${timeLeft < 60 ? 'text-red-400' : 'text-black'}`}>
              ⏱️ {formatTime(timeLeft)}
            </div>
          </div>

          <div className="space-y-4">
            {activeAssessment.questions.map((q, qi) => (
              <div key={qi} className="rounded-[22px] border-[3px] border-black bg-[#fff8e8] p-5 space-y-3 shadow-[5px_5px_0_#111111]">
                <div className="flex items-start gap-3">
                  <span className="bg-[#6fa8ff] border-[2px] border-black text-black text-xs font-bold px-2.5 py-1 rounded-[12px] flex-shrink-0">
                    Q{qi + 1}
                  </span>
                  <p className="text-black text-sm font-medium">{q.questionText}</p>
                </div>

                {q.type === 'mcq' && (
                  <div className="space-y-2 pl-8">
                    {q.options.filter((o) => o).map((opt, oi) => (
                      <label key={oi} className="flex items-center gap-3 cursor-pointer group">
                        <input
                          type="radio"
                          name={`q-${qi}`}
                          value={opt}
                          checked={answers[qi]?.studentAnswer === opt}
                          onChange={() => handleAnswer(qi, opt)}
                          className="accent-blue-500"
                        />
                        <span className={`text-sm transition-colors ${answers[qi]?.studentAnswer === opt ? 'text-black font-semibold' : 'text-black/80'}`}>
                          {opt}
                        </span>
                      </label>
                    ))}
                  </div>
                )}

                {q.type === 'short_answer' && (
                  <input
                    type="text"
                    value={answers[qi]?.studentAnswer || ''}
                    onChange={(e) => handleAnswer(qi, e.target.value)}
                    placeholder="Type your answer..."
                    className="retro-input ml-8"
                  />
                )}

                {q.type === 'descriptive' && (
                  <textarea
                    value={answers[qi]?.studentAnswer || ''}
                    onChange={(e) => handleAnswer(qi, e.target.value)}
                    placeholder="Write your answer..."
                    rows={3}
                    className="retro-input resize-none ml-8"
                  />
                )}

                <div className="flex justify-end">
                  <span className="text-xs text-black/60">{q.marks} mark{q.marks > 1 ? 's' : ''}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => { setActiveAssessment(null); setTimeLeft(null) }}
              className="retro-button flex-1 bg-white py-3"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="retro-button flex-1 bg-[#6fa8ff] py-3 disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Submit Assessment'}
            </button>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="retro-shell overflow-hidden">
          <div className="grid gap-0 lg:grid-cols-[1.1fr,0.9fr]">
            <div className="border-b-[3px] border-black bg-[#ffd84d] p-6 lg:border-b-0 lg:border-r-[3px]">
              <div className="retro-chip bg-white">Student assessments</div>
              <h1 className="retro-title mt-4 text-4xl sm:text-5xl">Quizzes and PDF work with brighter cards.</h1>
              <p className="mt-4 max-w-2xl text-base font-medium text-black/75">Light mode now uses the same bold student palette instead of dark slate panels.</p>
            </div>
            <div className="bg-[#fff8e8] p-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-[22px] border-[3px] border-black bg-[#6fa8ff] p-4 shadow-[5px_5px_0_#111111]">
                  <p className="retro-mono text-xs uppercase tracking-[0.18em] text-black/70">Assigned</p>
                  <p className="mt-3 text-3xl font-black text-black">{assessments.length}</p>
                </div>
                <div className="rounded-[22px] border-[3px] border-black bg-[#97e675] p-4 shadow-[5px_5px_0_#111111]">
                  <p className="retro-mono text-xs uppercase tracking-[0.18em] text-black/70">Submitted</p>
                  <p className="mt-3 text-3xl font-black text-black">{Object.keys(submissionMap).length}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="retro-panel bg-[#ffb3cb] text-black text-sm px-4 py-3">
            {error}
          </div>
        )}

        {loading ? (
          <div className="retro-panel p-6 text-black/70 text-sm">Loading assessments...</div>
        ) : assessments.length === 0 ? (
          <div className="retro-panel text-center py-20">
            <p className="text-4xl mb-3">📝</p>
            <p className="font-semibold text-black">No assessments available</p>
            <p className="text-sm mt-1 text-black/70">Your teacher hasn't assigned any assessments yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {assessments.map((assessment) => {
              const submission = submissionMap[assessment._id]
              const isPdfAssignment = getAssessmentType(assessment) === 'pdf_assignment'
              const dueState = getDueState(assessment.dueDate)

              return (
                <div key={assessment._id} className="rounded-[22px] border-[3px] border-black bg-[#fff8e8] p-5 shadow-[5px_5px_0_#111111]">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-black font-semibold text-sm">{assessment.title}</h3>
                        <span className={`retro-chip ${isPdfAssignment ? 'bg-[#d9e9ff]' : 'bg-[#ffefab]'}`}>
                          {isPdfAssignment ? 'PDF Assignment' : 'Quiz'}
                        </span>
                        <span className={`retro-chip ${assessment.difficulty === 'easy' ? 'bg-[#97e675]' : assessment.difficulty === 'hard' ? 'bg-[#ff8db3]' : 'bg-white'}`}>
                          {assessment.difficulty}
                        </span>
                        {assessment.dueDate && (
                          <span className={`retro-chip ${dueState.isOverdue ? 'bg-[#ff8db3]' : 'bg-[#d9e9ff]'}`}>
                            {dueState.isOverdue ? 'Deadline passed' : 'Due'}
                          </span>
                        )}
                        {submission && (
                          <span className="retro-chip bg-[#97e675]">
                            Submitted
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1.5 text-xs text-black/70 flex-wrap">
                        <span>📚 {assessment.courseTitle}</span>
                        {isPdfAssignment ? (
                          <span>📄 Upload one PDF file</span>
                        ) : (
                          <>
                            <span>❓ {assessment.questions?.length || 0} questions</span>
                            <span>⏱️ {assessment.duration} mins</span>
                          </>
                        )}
                        {assessment.topic && <span>🏷️ {assessment.topic}</span>}
                      </div>
                      {assessment.dueDate && (
                        <p className={`text-xs mt-2 ${dueState.isOverdue ? 'text-red-500' : 'text-black/70'}`}>
                          {dueState.label}
                        </p>
                      )}
                      {assessment.instructions && (
                        <p className="text-black/80 text-sm mt-3">{assessment.instructions}</p>
                      )}
                      {submission && isPdfAssignment && (
                        <p className={`text-xs mt-3 ${submission.plagiarismFlag ? 'text-red-500' : 'text-black/70'}`}>
                          Similarity check: {Math.round(submission.plagiarismScore || 0)}% {submission.plagiarismReport ? `• ${submission.plagiarismReport}` : ''}
                        </p>
                      )}
                    </div>

                    {isPdfAssignment ? (
                      <div className="w-full max-w-xs space-y-3">
                        {submission ? (
                          <div className="space-y-3">
                            <div className="rounded-[18px] bg-[#d9e9ff] border-[3px] border-black px-4 py-3 shadow-[4px_4px_0_#111111]">
                              <p className="text-sm font-medium text-black">{submission.fileName || 'PDF submitted'}</p>
                              <p className="text-xs text-black/70 mt-1">Your work has been sent to the teacher.</p>
                            </div>
                            {!dueState.isOverdue && (
                              <button
                                onClick={() => handleDeleteSubmission(assessment._id)}
                                disabled={submitting}
                                className="retro-button w-full bg-[#ff8db3] text-xs disabled:opacity-50"
                              >
                                {submitting ? 'Deleting...' : 'Delete previous record'}
                              </button>
                            )}
                          </div>
                        ) : (
                          <>
                            <input
                              type="file"
                              accept=".pdf,application/pdf"
                              onChange={(e) => setUploadFiles((prev) => ({ ...prev, [assessment._id]: e.target.files?.[0] || null }))}
                              className="retro-input text-xs"
                              disabled={dueState.isOverdue}
                            />
                            <button
                              onClick={() => handlePdfUpload(assessment._id)}
                              disabled={submitting || dueState.isOverdue}
                              className="retro-button w-full bg-[#6fa8ff] text-xs disabled:opacity-50"
                            >
                              {dueState.isOverdue ? 'Deadline passed' : submitting ? 'Uploading...' : 'Upload PDF'}
                            </button>
                          </>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => startAssessment(assessment)}
                        disabled={Boolean(submission)}
                        className="retro-button bg-[#6fa8ff] text-xs px-4 py-2.5 disabled:opacity-50 flex-shrink-0"
                      >
                        {submission ? 'Submitted' : 'Start →'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Layout>
  )
}
