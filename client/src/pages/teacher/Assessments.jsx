import { useEffect, useState } from 'react'
import Layout from '../../components/shared/Layout'
import api from '../../lib/axios'

const emptyForm = {
  title: '',
  courseId: '',
  topic: '',
  difficulty: 'medium',
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

export default function TeacherAssessments() {
  const [assessments, setAssessments] = useState([])
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [questions, setQuestions] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('list')
  const [viewSubmissions, setViewSubmissions] = useState(null)
  const [submissions, setSubmissions] = useState([])

  const fetchData = async () => {
    try {
      const courseRes = await api.get('/courses')
      setCourses(courseRes.data)
      // fetch assessments for all courses
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
    if (questions.length === 0) return setError('Add at least one question')
    setSaving(true)
    try {
      await api.post('/assessments', {
        title: form.title,
        course: form.courseId,
        topic: form.topic,
        difficulty: form.difficulty,
        duration: form.duration,
        questions,
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

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this assessment?')) return
    try {
      await api.delete(`/assessments/${id}`)
      fetchData()
    } catch (err) { console.error(err) }
  }

  const handleViewSubmissions = async (assessment) => {
    setViewSubmissions(assessment)
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
            {assessments.map((assessment) => (
              <div key={assessment._id} className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-5">
                <div className="flex items-start justify-between gap-4">
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
            ))}
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
                  <div key={sub._id} className="bg-slate-700/30 rounded-xl px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-white text-sm font-medium">{sub.student?.name}</p>
                      <p className="text-slate-400 text-xs">{sub.student?.email}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-bold ${sub.percentage >= 70 ? 'text-green-400' : sub.percentage >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {Math.round(sub.percentage)}%
                      </p>
                      <p className="text-slate-400 text-xs">{sub.totalScore}/{sub.maxScore} marks</p>
                      {sub.plagiarismFlag && (
                        <p className="text-red-400 text-xs mt-0.5">⚠️ Plagiarism detected</p>
                      )}
                    </div>
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
            <div className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-xs rounded-lg px-4 py-3 mb-4">
              ⚠️ AI HAS TO BE CREATED HERE — Auto-generate questions using AI by providing topic + difficulty
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
                <div>
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
                    className="w-full bg-slate-700/50 border border-slate-600/50 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  />
                </div>
              </div>

              {/* Questions */}
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