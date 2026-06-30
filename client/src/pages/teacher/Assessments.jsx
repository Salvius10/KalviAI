import { useEffect, useState } from 'react'
import Layout from '../../components/shared/Layout'
import api from '../../lib/axios'
import { API_BASE_URL } from '../../lib/utils'

const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '')

const emptyForm = {
  title: '',
  courseId: '',
  topic: '',
  difficulty: 'medium',
  assessmentType: 'quiz',
  instructions: '',
  dueDate: '',
  duration: 60,
  questions: [],
}

const emptyQuestion = {
  questionText: '',
  type: 'mcq',
  options: ['', '', '', ''],
  correctAnswer: '',
  marks: 1,
}

const getAssessmentType = (assessment) => {
  if (assessment?.assessmentType === 'pdf_assignment') return 'pdf_assignment'
  if ((assessment?.instructions || '').trim() && (!assessment?.questions || assessment.questions.length === 0)) return 'pdf_assignment'
  return 'quiz'
}

export default function TeacherAssessments() {
  const [assessments, setAssessments] = useState([])
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [questions, setQuestions] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [viewSubmissions, setViewSubmissions] = useState(null)
  const [submissions, setSubmissions] = useState([])
  const [expandedSubmissionId, setExpandedSubmissionId] = useState(null)
  const [aiGenerating, setAiGenerating] = useState(false)
  const [aiMaterialFile, setAiMaterialFile] = useState(null)
  const [aiMaterialText, setAiMaterialText] = useState('')
  const [aiQuestionCount, setAiQuestionCount] = useState(10)
  const [sourceFile, setSourceFile] = useState(null)

  const sanitizeQuestions = (inputQuestions = []) =>
    inputQuestions
      .map((q) => ({
        ...q,
        questionText: q.questionText?.trim() || '',
        correctAnswer: q.correctAnswer?.trim() || '',
        options: Array.isArray(q.options) ? q.options.map((o) => o?.trim() || '') : [],
        marks: Number(q.marks) > 0 ? Number(q.marks) : 1,
      }))
      .filter((q) => q.questionText)

  const fetchData = async () => {
    try {
      const courseRes = await api.get('/courses')
      setCourses(courseRes.data)
      // Fetch teacher-visible assessments across all their courses.
      const all = []
      for (const c of courseRes.data) {
        const res = await api.get(`/assessments/course/${c._id}`)
        all.push(...res.data.map(a => ({ ...a, courseTitle: c.title })))
      }
      setAssessments(all)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const openCreate = () => {
    setForm(emptyForm)
    setQuestions([{ ...emptyQuestion, options: ['', '', '', ''] }])
    setAiMaterialFile(null)
    setAiMaterialText('')
    setAiQuestionCount(10)
    setSourceFile(null)
    setError('')
    setShowModal(true)
  }

  const addQuestion = () => {
    setQuestions([...questions, { ...emptyQuestion, options: ['', '', '', ''] }])
  }

  const removeQuestion = (index) => {
    setQuestions(questions.filter((_, i) => i !== index))
  }

  const updateQuestion = (index, field, value) => {
    const updated = [...questions]
    updated[index] = { ...updated[index], [field]: value }
    setQuestions(updated)
  }

  const updateOption = (qIndex, oIndex, value) => {
    const updated = [...questions]
    updated[qIndex].options[oIndex] = value
    setQuestions(updated)
  }

  const handleSave = async () => {
    if (!form.title.trim()) return setError('Title is required')
    if (!form.courseId) return setError('Please select a course')
    const normalizedQuestions = sanitizeQuestions(questions)
    if (form.assessmentType === 'quiz' && normalizedQuestions.length === 0) return setError('Add at least one valid question')
    if (form.assessmentType === 'pdf_assignment' && !form.instructions.trim()) return setError('Add assignment instructions')
    if (form.assessmentType === 'pdf_assignment' && !form.dueDate) return setError('Add a submission deadline')
    setSaving(true)
    try {
      await api.post('/assessments', {
        title: form.title,
        course: form.courseId,
        topic: form.topic,
        difficulty: form.difficulty,
        assessmentType: form.assessmentType,
        instructions: form.instructions.trim(),
        dueDate: form.dueDate || undefined,
        duration: form.assessmentType === 'quiz' ? (Number(form.duration) > 0 ? Number(form.duration) : 60) : 0,
        questions: form.assessmentType === 'quiz' ? normalizedQuestions : [],
        sourceFile: sourceFile || undefined,
        isPublished: true,
      })
      setShowModal(false)
      fetchData()
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleGenerateWithAI = async () => {
    if (!aiMaterialFile && !aiMaterialText.trim()) {
      return setError('Upload study material or paste study text to generate quiz')
    }

    setAiGenerating(true)
    setError('')

    try {
      const formData = new FormData()
      formData.append('questionCount', String(aiQuestionCount))
      formData.append('difficulty', form.difficulty)
      formData.append('topic', form.topic)
      if (aiMaterialFile) formData.append('material', aiMaterialFile)
      if (aiMaterialText.trim()) formData.append('materialText', aiMaterialText.trim())

      console.log('📤 Sending AI generation request:', {
        questionCount: aiQuestionCount,
        difficulty: form.difficulty,
        topic: form.topic,
        hasFile: !!aiMaterialFile,
        fileName: aiMaterialFile?.name,
        fileSize: aiMaterialFile?.size,
        materialTextLength: aiMaterialText.trim().length,
      })

      const res = await api.post('/ai/generate-quiz-from-material', formData)

      const generated = sanitizeQuestions(res.data?.questions || [])
      if (!generated.length) {
        setError('AI did not generate valid questions. Please try different material.')
        return
      }

      setQuestions(generated)
      if (res.data?.sourceFile) setSourceFile(res.data.sourceFile)
      if (!form.title.trim()) {
        const selectedCourse = courses.find((course) => course._id === form.courseId)
        setForm((prev) => ({
          ...prev,
          title: prev.topic?.trim()
            ? `${prev.topic.trim()} Quiz`
            : `${selectedCourse?.title || 'AI Generated'} Quiz`,
        }))
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message || 'Failed to generate quiz with AI'
      console.error('🔴 Quiz generation failed:', { error: err, message: errorMsg, status: err.response?.status })
      setError(errorMsg)
    } finally {
      setAiGenerating(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this assessment?')) return
    try {
      await api.delete(`/assessments/${id}`)
      fetchData()
    } catch (err) { console.error(err) }
  }

  const handleViewSubmissions = async (assessment) => {
    setViewSubmissions(assessment)
    setExpandedSubmissionId(null)
    try {
      const res = await api.get(`/submissions/assessment/${assessment._id}`)
      setSubmissions(res.data)
    } catch (err) { console.error(err) }
  }

  const difficultyColor = { easy: 'text-green-400 bg-green-500/10', medium: 'text-yellow-400 bg-yellow-500/10', hard: 'text-red-400 bg-red-500/10' }

  return (
    <Layout>
      <div className="space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Assessments</h1>
            <p className="text-slate-400 text-sm mt-1">Create and manage student assessments</p>
          </div>
          <button
            onClick={openCreate}
            className="bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all"
          >
            + New Assessment
          </button>
        </div>

        {/* Assessments List */}
        {loading ? (
          <div className="text-slate-400 text-sm">Loading...</div>
        ) : assessments.length === 0 ? (
          <div className="text-center py-20 bg-slate-800/60 border border-slate-700/50 rounded-2xl">
            <p className="text-4xl mb-3">📝</p>
            <p className="text-white font-semibold">No assessments yet</p>
            <p className="text-slate-400 text-sm mt-1">Create your first assessment</p>
            <button
              onClick={openCreate}
              className="mt-4 bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all"
            >
              + Create Assessment
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {assessments.map((assessment) => {
              const assessmentType = getAssessmentType(assessment)
              return (
              <div key={assessment._id} className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-white font-semibold text-sm">{assessment.title}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${assessmentType === 'pdf_assignment' ? 'text-blue-300 bg-blue-500/10' : 'text-purple-300 bg-purple-500/10'}`}>
                        {assessmentType === 'pdf_assignment' ? 'PDF Assignment' : 'Quiz'}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${difficultyColor[assessment.difficulty]}`}>
                        {assessment.difficulty}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-1.5 text-xs text-slate-400">
                      <span>📚 {assessment.courseTitle}</span>
                      {assessmentType === 'quiz' ? (
                        <>
                          <span>❓ {assessment.questions?.length || 0} questions</span>
                          <span>⏱️ {assessment.duration} mins</span>
                        </>
                      ) : (
                        <span>📄 Student PDF upload</span>
                      )}
                      {assessment.dueDate && <span>📅 Due {new Date(assessment.dueDate).toLocaleString()}</span>}
                      {assessment.topic && <span>🏷️ {assessment.topic}</span>}
                      {assessment.sourceFile?.fileName && (
                        <span className="text-blue-300">📎 {assessment.sourceFile.fileName}</span>
                      )}
                    </div>
                    {assessmentType === 'pdf_assignment' && assessment.instructions && (
                      <p className="text-slate-300 text-xs mt-2 line-clamp-2">{assessment.instructions}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleViewSubmissions(assessment)}
                      className="text-xs bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 px-3 py-2 rounded-lg transition-all"
                    >
                      👁️ Submissions
                    </button>
                    <button
                      onClick={() => handleDelete(assessment._id)}
                      className="text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 px-3 py-2 rounded-lg transition-all"
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              </div>
            )})}
          </div>
        )}
      </div>

      {/* Submissions Modal */}
      {viewSubmissions && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700/50 rounded-2xl p-6 w-full max-w-2xl shadow-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-bold text-lg">Submissions — {viewSubmissions.title}</h2>
              <button onClick={() => setViewSubmissions(null)} className="text-slate-400 hover:text-white text-xl">✕</button>
            </div>
            {submissions.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-8">No submissions yet</p>
            ) : (
              <div className="space-y-3">
                {submissions.map((sub) => (
                  <div key={sub._id} className="bg-slate-700/30 rounded-xl px-4 py-3 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-white text-sm font-medium">{sub.student?.name}</p>
                        <p className="text-slate-400 text-xs">{sub.student?.email}</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-bold ${sub.percentage >= 70 ? 'text-green-400' : sub.percentage >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                          {sub.submissionType === 'pdf_assignment' ? 'PDF' : `${Math.round(sub.percentage)}%`}
                        </p>
                        <p className="text-slate-400 text-xs">
                          {sub.submissionType === 'pdf_assignment'
                            ? `${sub.fileName || 'Uploaded file'}`
                            : `${sub.totalScore}/${sub.maxScore} marks`}
                        </p>
                        <p className={`text-xs mt-0.5 ${sub.plagiarismFlag ? 'text-red-400' : 'text-slate-400'}`}>
                          Similarity: {Math.round(sub.plagiarismScore || 0)}%
                        </p>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <button
                        onClick={() => setExpandedSubmissionId((prev) => (prev === sub._id ? null : sub._id))}
                        className="text-xs bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 px-3 py-1.5 rounded-lg transition-all"
                      >
                        {expandedSubmissionId === sub._id
                          ? 'Hide Details'
                          : sub.submissionType === 'pdf_assignment'
                          ? 'View Submission'
                          : 'View Answers'}
                      </button>
                    </div>

                    {expandedSubmissionId === sub._id && (
                      <div className="space-y-2 pt-2 border-t border-slate-600/40">
                        {sub.submissionType === 'pdf_assignment' ? (
                          <div className="bg-slate-800/40 rounded-lg p-3 space-y-2">
                            <p className="text-xs text-slate-300">File: {sub.fileName || 'Uploaded PDF'}</p>
                            {sub.fileUrl && (
                              <a
                                href={`${API_ORIGIN}${sub.fileUrl}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex text-xs bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 px-3 py-1.5 rounded-lg transition-all"
                              >
                                Open PDF
                              </a>
                            )}
                            <p className={`text-xs ${sub.plagiarismFlag ? 'text-red-300' : 'text-slate-300'}`}>
                              {sub.plagiarismReport || 'No plagiarism report available.'}
                            </p>
                          </div>
                        ) : (
                          (sub.reviewedAnswers || []).map((ans, idx) => (
                            <div key={`${sub._id}-${idx}`} className="bg-slate-800/40 rounded-lg p-3">
                              <p className="text-xs text-slate-300 font-medium">Q{idx + 1}. {ans.questionText}</p>
                              {ans.questionType === 'mcq' && ans.options?.length > 0 && (
                                <p className="text-xs text-slate-400 mt-1">Options: {ans.options.join(' | ')}</p>
                              )}
                              <p className="text-xs text-blue-300 mt-1">Student answer: {ans.studentAnswer || 'No answer'}</p>
                              <p className="text-xs text-green-300">Correct answer: {ans.correctAnswer || 'N/A'}</p>
                              <p className="text-xs text-slate-400 mt-1">
                                Marks: {ans.marksAwarded}/{ans.marks} {ans.isCorrect ? '• Correct' : '• Incorrect'}
                              </p>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Assessment Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700/50 rounded-2xl p-6 w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-bold text-lg">Create Assessment</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white text-xl">✕</button>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3 mb-4">
                {error}
              </div>
            )}

            {/* AI Placeholder Notice */}
            <div className="bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs rounded-lg px-4 py-3 mb-4 space-y-2">
              <p className="font-medium">Generate Quiz With AI (Groq)</p>
              <p>Upload study material from PDF, Word, PowerPoint, or pasted notes and generate 5 to 10 MCQ questions using your selected topic and difficulty.</p>
            </div>

            <div className="space-y-4">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Assessment Title</label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="e.g. Chapter 1 Quiz"
                    className="w-full bg-slate-700/50 border border-slate-600/50 text-white placeholder-slate-500 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Assessment Type</label>
                  <select
                    value={form.assessmentType}
                    onChange={(e) => setForm({ ...form, assessmentType: e.target.value })}
                    className="w-full bg-slate-700/50 border border-slate-600/50 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  >
                    <option value="quiz">Quiz</option>
                    <option value="pdf_assignment">PDF Assignment</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Course</label>
                  <select
                    value={form.courseId}
                    onChange={(e) => setForm({ ...form, courseId: e.target.value })}
                    className="w-full bg-slate-700/50 border border-slate-600/50 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  >
                    <option value="">Select course</option>
                    {courses.map(c => <option key={c._id} value={c._id}>{c.title}</option>)}
                  </select>
                </div>
                <div className={form.assessmentType === 'quiz' ? '' : 'col-span-2'}>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Difficulty</label>
                  <select
                    value={form.difficulty}
                    onChange={(e) => setForm({ ...form, difficulty: e.target.value })}
                    className="w-full bg-slate-700/50 border border-slate-600/50 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Topic</label>
                  <input
                    type="text"
                    value={form.topic}
                    onChange={(e) => setForm({ ...form, topic: e.target.value })}
                    placeholder="e.g. Algebra"
                    className="w-full bg-slate-700/50 border border-slate-600/50 text-white placeholder-slate-500 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Duration (mins)</label>
                  <input
                    type="number"
                    value={form.duration}
                    onChange={(e) => setForm({ ...form, duration: e.target.value })}
                    disabled={form.assessmentType !== 'quiz'}
                    className="w-full bg-slate-700/50 border border-slate-600/50 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  />
                </div>
                <div className={form.assessmentType === 'pdf_assignment' ? 'col-span-2' : ''}>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Deadline</label>
                  <input
                    type="datetime-local"
                    value={form.dueDate}
                    onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                    className="w-full bg-slate-700/50 border border-slate-600/50 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  />
                </div>
                {form.assessmentType === 'pdf_assignment' && (
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Assignment Instructions</label>
                    <textarea
                      value={form.instructions}
                      onChange={(e) => setForm({ ...form, instructions: e.target.value })}
                      rows={4}
                      placeholder="Describe the work students need to complete and submit as PDF."
                      className="w-full bg-slate-700/50 border border-slate-600/50 text-white placeholder-slate-500 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none"
                    />
                  </div>
                )}
              </div>

              {form.assessmentType === 'quiz' && (
                <>
                  <div className="bg-slate-900/40 border border-slate-700/50 rounded-xl p-4 space-y-3">
                    <h3 className="text-sm font-semibold text-white">AI Quiz Generator</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-slate-400 mb-1.5">Upload material (PDF, DOC, DOCX, PPT, PPTX, TXT)</label>
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,text/plain,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                          onChange={(e) => { setAiMaterialFile(e.target.files?.[0] || null); setSourceFile(null) }}
                          className="w-full bg-slate-700/50 border border-slate-600/50 text-slate-300 rounded-lg px-3 py-2 text-xs"
                        />
                        {aiMaterialFile && (
                          <div className="mt-1.5 flex items-center gap-1.5 text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-1.5">
                            <span>📄</span>
                            <span className="truncate">{aiMaterialFile.name}</span>
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1.5">Question count (5-10)</label>
                        <input
                          type="number"
                          min={5}
                          max={10}
                          value={aiQuestionCount}
                          onChange={(e) => setAiQuestionCount(Math.max(5, Math.min(10, Number(e.target.value) || 10)))}
                          className="w-full bg-slate-700/50 border border-slate-600/50 text-white rounded-lg px-3 py-2 text-sm focus:outline-none"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1.5">Or paste study material text</label>
                      <textarea
                        value={aiMaterialText}
                        onChange={(e) => setAiMaterialText(e.target.value)}
                        rows={4}
                        placeholder="Paste notes or study text here..."
                        className="w-full bg-slate-700/50 border border-slate-600/50 text-white placeholder-slate-500 rounded-lg px-3 py-2 text-xs focus:outline-none resize-none"
                      />
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <button
                        onClick={handleGenerateWithAI}
                        disabled={aiGenerating}
                        className="bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-all"
                      >
                        {aiGenerating ? 'Generating Quiz...' : 'Generate Questions With AI'}
                      </button>
                      {sourceFile && (
                        <span className="text-xs text-blue-300 bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-1.5 flex items-center gap-1.5">
                          <span>📎</span>
                          <span className="truncate max-w-[180px]">{sourceFile.fileName}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-sm font-medium text-slate-300">Questions ({questions.length})</label>
                      <button
                        onClick={addQuestion}
                        className="text-xs bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 px-3 py-1.5 rounded-lg transition-all"
                      >
                        + Add Question
                      </button>
                    </div>

                    <div className="space-y-4">
                      {questions.map((q, qi) => (
                        <div key={qi} className="bg-slate-700/30 border border-slate-600/30 rounded-xl p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-400 font-medium">Question {qi + 1}</span>
                            <button onClick={() => removeQuestion(qi)} className="text-xs text-red-400 hover:text-red-300">Remove</button>
                          </div>

                          <input
                            type="text"
                            value={q.questionText}
                            onChange={(e) => updateQuestion(qi, 'questionText', e.target.value)}
                            placeholder="Enter your question..."
                            className="w-full bg-slate-700/50 border border-slate-600/50 text-white placeholder-slate-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                          />

                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <label className="text-xs text-slate-400 mb-1 block">Type</label>
                              <select
                                value={q.type}
                                onChange={(e) => updateQuestion(qi, 'type', e.target.value)}
                                className="w-full bg-slate-700/50 border border-slate-600/50 text-white rounded-lg px-2 py-1.5 text-xs focus:outline-none"
                              >
                                <option value="mcq">MCQ</option>
                                <option value="short_answer">Short Answer</option>
                                <option value="descriptive">Descriptive</option>
                              </select>
                            </div>
                            <div>
                              <label className="text-xs text-slate-400 mb-1 block">Marks</label>
                              <input
                                type="number"
                                value={q.marks}
                                onChange={(e) => updateQuestion(qi, 'marks', parseInt(e.target.value))}
                                min={1}
                                className="w-full bg-slate-700/50 border border-slate-600/50 text-white rounded-lg px-2 py-1.5 text-xs focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-slate-400 mb-1 block">Answer</label>
                              <input
                                type="text"
                                value={q.correctAnswer}
                                onChange={(e) => updateQuestion(qi, 'correctAnswer', e.target.value)}
                                placeholder="Correct answer"
                                className="w-full bg-slate-700/50 border border-slate-600/50 text-white placeholder-slate-500 rounded-lg px-2 py-1.5 text-xs focus:outline-none"
                              />
                            </div>
                          </div>

                          {q.type === 'mcq' && (
                            <div className="grid grid-cols-2 gap-2">
                              {q.options.map((opt, oi) => (
                                <input
                                  key={oi}
                                  type="text"
                                  value={opt}
                                  onChange={(e) => updateOption(qi, oi, e.target.value)}
                                  placeholder={`Option ${oi + 1}`}
                                  className="bg-slate-700/50 border border-slate-600/50 text-white placeholder-slate-500 rounded-lg px-3 py-1.5 text-xs focus:outline-none"
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 bg-slate-700/50 hover:bg-slate-600/50 text-white text-sm font-medium py-2.5 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-xl transition-all"
              >
                {saving ? 'Saving...' : 'Create Assessment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
