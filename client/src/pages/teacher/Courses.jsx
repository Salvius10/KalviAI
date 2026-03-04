import { useEffect, useState } from 'react'
import Layout from '../../components/shared/Layout'
import api from '../../lib/axios'

const emptyForm = { title: '', description: '', isPublished: false }

export default function TeacherCourses() {
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingCourse, setEditingCourse] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showStudentModal, setShowStudentModal] = useState(false)
  const [selectedCourse, setSelectedCourse] = useState(null)
  const [studentEmail, setStudentEmail] = useState('')
  const [allUsers, setAllUsers] = useState([])

  const fetchCourses = async () => {
    try {
      const res = await api.get('/courses')
      setCourses(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchCourses() }, [])

  const openCreate = () => {
    setEditingCourse(null)
    setForm(emptyForm)
    setError('')
    setShowModal(true)
  }

  const openEdit = (course) => {
    setEditingCourse(course)
    setForm({ title: course.title, description: course.description, isPublished: course.isPublished })
    setError('')
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.title.trim()) return setError('Title is required')
    setSaving(true)
    try {
      if (editingCourse) {
        await api.put(`/courses/${editingCourse._id}`, form)
      } else {
        await api.post('/courses', form)
      }
      setShowModal(false)
      fetchCourses()
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this course?')) return
    try {
      await api.delete(`/courses/${id}`)
      fetchCourses()
    } catch (err) {
      console.error(err)
    }
  }

  const handleTogglePublish = async (course) => {
    try {
      await api.put(`/courses/${course._id}`, { ...course, isPublished: !course.isPublished })
      fetchCourses()
    } catch (err) {
      console.error(err)
    }
  }

  const openStudentModal = (course) => {
    setSelectedCourse(course)
    setStudentEmail('')
    setShowStudentModal(true)
  }

  const handleAddStudent = async () => {
    if (!studentEmail.trim()) return
    try {
      // Find user by email then add to course
      const res = await api.get(`/courses/${selectedCourse._id}`)
      alert('Student adding feature requires student to enroll themselves via the student portal.')
      setShowStudentModal(false)
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <Layout>
      <div className="space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Courses</h1>
            <p className="text-slate-400 text-sm mt-1">Manage your courses and coursework</p>
          </div>
          <button
            onClick={openCreate}
            className="bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all"
          >
            + New Course
          </button>
        </div>

        {/* Course Grid */}
        {loading ? (
          <div className="text-slate-400 text-sm">Loading courses...</div>
        ) : courses.length === 0 ? (
          <div className="text-center py-20 bg-slate-800/60 border border-slate-700/50 rounded-2xl">
            <p className="text-4xl mb-3">📚</p>
            <p className="text-white font-semibold">No courses yet</p>
            <p className="text-slate-400 text-sm mt-1">Create your first course to get started</p>
            <button
              onClick={openCreate}
              className="mt-4 bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all"
            >
              + Create Course
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {courses.map((course) => (
              <div key={course._id} className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-5 flex flex-col gap-3">
                
                {/* Course Header */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-white font-semibold text-sm">{course.title}</h3>
                    <p className="text-slate-400 text-xs mt-1 line-clamp-2">{course.description || 'No description'}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium flex-shrink-0 ${course.isPublished ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-400'}`}>
                    {course.isPublished ? 'Published' : 'Draft'}
                  </span>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 text-xs text-slate-400">
                  <span>🧑‍🎓 {course.students?.length || 0} students</span>
                  <span>📄 {course.materials?.length || 0} materials</span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-1 border-t border-slate-700/50">
                  <button
                    onClick={() => openEdit(course)}
                    className="flex-1 text-xs bg-slate-700/50 hover:bg-slate-600/50 text-white py-2 rounded-lg transition-all"
                  >
                    ✏️ Edit
                  </button>
                  <button
                    onClick={() => handleTogglePublish(course)}
                    className={`flex-1 text-xs py-2 rounded-lg transition-all ${course.isPublished ? 'bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400' : 'bg-green-500/10 hover:bg-green-500/20 text-green-400'}`}
                  >
                    {course.isPublished ? '📤 Unpublish' : '✅ Publish'}
                  </button>
                  <button
                    onClick={() => handleDelete(course._id)}
                    className="flex-1 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 py-2 rounded-lg transition-all"
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700/50 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-white font-bold text-lg mb-4">
              {editingCourse ? 'Edit Course' : 'Create New Course'}
            </h2>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3 mb-4">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Course Title</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Introduction to Mathematics"
                  className="w-full bg-slate-700/50 border border-slate-600/50 text-white placeholder-slate-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="What will students learn in this course?"
                  rows={3}
                  className="w-full bg-slate-700/50 border border-slate-600/50 text-white placeholder-slate-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all resize-none"
                />
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="publish"
                  checked={form.isPublished}
                  onChange={(e) => setForm({ ...form, isPublished: e.target.checked })}
                  className="w-4 h-4 accent-purple-500"
                />
                <label htmlFor="publish" className="text-sm text-slate-300">
                  Publish immediately
                </label>
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
                {saving ? 'Saving...' : editingCourse ? 'Save Changes' : 'Create Course'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}