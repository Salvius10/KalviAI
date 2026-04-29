import { useEffect, useState } from 'react'
import Layout from '../../components/shared/Layout'
import api from '../../lib/axios'
import { useRef } from 'react'

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
  const [tabSwitches, setTabSwitches] = useState(0)   // 0 = clean, 1 = warned, 2 = auto-submit
  const [warningModal, setWarningModal] = useState(false)

  const tabSwitchRef = useRef(0)
  const submittedRef = useRef(false)
  const submittingRef = useRef(false)
  const lastSwitchTime = useRef(0)

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
      submitQuiz('Time expired')
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
    setTabSwitches(0)
    setWarningModal(false)
    tabSwitchRef.current = 0
    lastSwitchTime.current = 0
    submittedRef.current = false
    submittingRef.current = false
  }

  const handleAnswer = (index, value) => {
    const updated = [...answers]
    updated[index] = { studentAnswer: value }
    setAnswers(updated)
  }

  const submitQuiz = async (reason = 'Manual submission') => {
    if (!activeAssessment?._id || submittingRef.current || submittedRef.current) return

    submittingRef.current = true
    setSubmitting(true)
    if (reason === 'Manual submission') {
      setError('')
    }

    try {
      const res = await api.post('/submissions', {
        assessmentId: activeAssessment._id,
        answers,
      })
      submittedRef.current = true
      setResult({ ...res.data, autoSubmitted: reason !== 'Manual submission' })
      setSubmissionMap((prev) => ({ ...prev, [activeAssessment._id]: res.data }))
      setActiveAssessment(null)
      setTimeLeft(null)
      setViolations(0)
    } catch (err) {
      setError(
        reason === 'Manual submission'
          ? err.response?.data?.message || 'Failed to submit assessment'
          : err.response?.data?.message || `Auto-submit failed after ${reason.toLowerCase()}`
      )
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  const handleSubmit = async () => {
    await submitQuiz('Manual submission')
  }

  // ── Tab-switch guard — only visibilitychange counts ─────────────────────────
  useEffect(() => {
    if (!activeAssessment || getAssessmentType(activeAssessment) !== 'quiz') return undefined

    const onVisibilityChange = async () => {
      if (!document.hidden) return                                  // returning to tab — ignore
      if (submittedRef.current || submittingRef.current) return

      // Debounce: browsers sometimes fire twice in quick succession
      const now = Date.now()
      if (now - lastSwitchTime.current < 1500) return
      lastSwitchTime.current = now

      tabSwitchRef.current += 1
      setTabSwitches(tabSwitchRef.current)

      if (tabSwitchRef.current >= 2) {
        // Second switch → auto-submit immediately
        setWarningModal(false)
        await submitQuiz('Tab switch — auto submitted')
      } else {
        // First switch → show warning, student gets one chance
        setWarningModal(true)
      }
    }

    // Block copy/paste/context-menu silently (no violation counted)
    const block = (e) => e.preventDefault()
    const blockKey = (e) => {
      const k = e.key.toLowerCase()
      if ((e.ctrlKey || e.metaKey) && ['c', 'v', 'x'].includes(k)) e.preventDefault()
      if (k === 'f12' || ((e.ctrlKey || e.metaKey) && e.shiftKey && ['i','j','c'].includes(k))) e.preventDefault()
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    document.addEventListener('copy', block)
    document.addEventListener('cut', block)
    document.addEventListener('paste', block)
    document.addEventListener('contextmenu', block)
    document.addEventListener('keydown', blockKey)

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      document.removeEventListener('copy', block)
      document.removeEventListener('cut', block)
      document.removeEventListener('paste', block)
      document.removeEventListener('contextmenu', block)
      document.removeEventListener('keydown', blockKey)
    }
  }, [activeAssessment, answers])

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
    const pct = Math.round(result.percentage)
    const review = result.reviewedAnswers || []
    const correct = review.filter(r => r.isCorrect).length
    const wrong = review.filter(r => !r.isCorrect && r.studentAnswer).length
    const skipped = review.filter(r => !r.studentAnswer).length

    return (
      <Layout>
        <div className="max-w-2xl mx-auto space-y-6 py-8">

          {/* Score card */}
          <div className="retro-panel p-6 text-center">
            <div className="text-5xl mb-3">
              {pct >= 70 ? '🎉' : pct >= 40 ? '👍' : '😔'}
            </div>
            <h2 className="retro-title text-3xl mb-1">Assessment Complete!</h2>
            {result.autoSubmitted && (
              <p className="text-red-500 text-xs font-bold mb-2 uppercase tracking-wide">
                Auto-submitted due to tab switch violation
              </p>
            )}
            <div className={`text-5xl font-black my-3 ${pct >= 70 ? 'text-green-500' : pct >= 40 ? 'text-yellow-500' : 'text-red-500'}`}>
              {pct}%
            </div>
            <p className="text-black/70 text-sm">{result.totalScore} / {result.maxScore} marks</p>
            <div className="mt-4 w-full bg-black/10 rounded-full h-2.5">
              <div
                className={`h-2.5 rounded-full transition-all ${pct >= 70 ? 'bg-green-400' : pct >= 40 ? 'bg-yellow-400' : 'bg-red-400'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            {review.length > 0 && (
              <div className="flex justify-center gap-6 mt-4 text-sm font-semibold">
                <span className="text-green-600">✅ {correct} correct</span>
                <span className="text-red-500">❌ {wrong} wrong</span>
                {skipped > 0 && <span className="text-black/40">— {skipped} skipped</span>}
              </div>
            )}
          </div>

          {/* Question-by-question review */}
          {review.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-bold text-black text-lg">Review Answers</h3>
              {review.map((item, idx) => (
                <div
                  key={idx}
                  className={`rounded-[20px] border-[3px] p-5 shadow-[4px_4px_0_#111] ${
                    item.isCorrect
                      ? 'border-green-500 bg-[#f0fff4]'
                      : 'border-red-400 bg-[#fff5f5]'
                  }`}
                >
                  {/* Question */}
                  <div className="flex items-start gap-3 mb-3">
                    <span className={`text-xs font-black px-2.5 py-1 rounded-[10px] border-[2px] border-black flex-shrink-0 ${item.isCorrect ? 'bg-green-400' : 'bg-red-300'}`}>
                      Q{idx + 1}
                    </span>
                    <p className="text-black text-sm font-semibold">{item.questionText}</p>
                  </div>

                  {/* MCQ options */}
                  {item.questionType === 'mcq' && item.options?.length > 0 && (
                    <div className="space-y-1.5 pl-9 mb-3">
                      {item.options.filter(o => o).map((opt, oi) => {
                        const isCorrectOpt = opt.trim().toLowerCase() === item.correctAnswer?.trim().toLowerCase()
                        const isStudentOpt = opt.trim().toLowerCase() === item.studentAnswer?.trim().toLowerCase()
                        return (
                          <div
                            key={oi}
                            className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg border ${
                              isCorrectOpt
                                ? 'bg-green-100 border-green-400 font-semibold text-green-800'
                                : isStudentOpt && !isCorrectOpt
                                ? 'bg-red-100 border-red-400 text-red-700 line-through'
                                : 'bg-white/60 border-black/10 text-black/60'
                            }`}
                          >
                            {isCorrectOpt && <span>✅</span>}
                            {isStudentOpt && !isCorrectOpt && <span>❌</span>}
                            {opt}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Short answer */}
                  {item.questionType !== 'mcq' && (
                    <div className="pl-9 space-y-1.5 text-sm">
                      <p className={`px-3 py-1.5 rounded-lg border ${item.isCorrect ? 'bg-green-100 border-green-400 text-green-800' : 'bg-red-100 border-red-400 text-red-700'}`}>
                        Your answer: {item.studentAnswer || <span className="italic opacity-60">No answer</span>}
                      </p>
                      {!item.isCorrect && item.correctAnswer && (
                        <p className="px-3 py-1.5 rounded-lg border bg-green-100 border-green-400 text-green-800">
                          Correct: {item.correctAnswer}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Marks */}
                  <p className="pl-9 text-xs text-black/50 mt-2">
                    {item.marksAwarded} / {item.marks} mark{item.marks !== 1 ? 's' : ''}
                  </p>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={() => setResult(null)}
            className="retro-button bg-[#6fa8ff] w-full py-3"
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
        {/* ── Tab-switch warning modal (first offence) ── */}
        {warningModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm">
            <div className="rounded-[28px] border-[4px] border-black bg-[#ffd84d] shadow-[10px_10px_0_#111] max-w-sm w-full mx-4 p-8 text-center space-y-5">
              <div className="text-6xl animate-bounce">🚨</div>
              <h2 className="retro-title text-3xl text-black">Tab Switch!</h2>
              <div className="rounded-[18px] border-[3px] border-black bg-white px-5 py-4 space-y-2">
                <p className="text-black font-bold text-sm">This is your <span className="text-red-600">ONLY warning.</span></p>
                <p className="text-black/80 text-sm leading-relaxed">
                  You switched away from the quiz tab. Switching again will
                  <strong> automatically submit</strong> your quiz — even if it's incomplete.
                </p>
              </div>
              <div className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 rounded-full bg-[#ff8db3] border-2 border-black inline-block" />
                <span className="w-4 h-4 rounded-full bg-black/20 border-2 border-black inline-block" />
                <span className="retro-mono text-xs text-black/70 ml-2 uppercase tracking-wide">1 of 2 — next = auto submit</span>
              </div>
              <button
                onClick={() => setWarningModal(false)}
                className="retro-button w-full bg-[#ff8db3] border-black py-3"
              >
                I understand — back to quiz
              </button>
            </div>
          </div>
        )}

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
            <div className="text-right">
              <div className={`text-xl font-bold font-mono ${timeLeft < 60 ? 'text-red-400' : 'text-black'}`}>
                ⏱️ {formatTime(timeLeft)}
              </div>
              <div className="mt-1 flex items-center justify-end gap-1.5">
                <span className={`w-3 h-3 rounded-full border-[2px] border-black ${tabSwitches >= 1 ? 'bg-[#ff8db3]' : 'bg-black/10'}`} />
                <span className={`w-3 h-3 rounded-full border-[2px] border-black ${tabSwitches >= 2 ? 'bg-red-500' : 'bg-black/10'}`} />
                <span className={`text-xs font-bold ml-1 ${tabSwitches > 0 ? 'text-red-500' : 'text-black/50'}`}>
                  {tabSwitches === 0 ? 'No switches' : tabSwitches === 1 ? '1 warning' : 'Auto-submitted'}
                </span>
              </div>
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
              onClick={() => {
                setActiveAssessment(null)
                setTimeLeft(null)
                setTabSwitches(0)
                setWarningModal(false)
                tabSwitchRef.current = 0
                lastSwitchTime.current = 0
                submittedRef.current = false
                submittingRef.current = false
              }}
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
