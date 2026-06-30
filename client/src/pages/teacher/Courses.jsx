import { useEffect, useState } from 'react'
import Layout from '../../components/shared/Layout'
import api from '../../lib/axios'

const emptyMaterial = { title: '', type: 'text', url: '', content: '', file: null, fileName: '', fileUrl: '' }
const emptyForm = { title: '', description: '', isPublished: false, materials: [] }

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
  const [assigningStudent, setAssigningStudent] = useState(false)
  const [studentError, setStudentError] = useState('')

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
    setForm({
      title: course.title,
      description: course.description,
      isPublished: course.isPublished,
      materials: Array.isArray(course.materials)
        ? course.materials.map((m) => ({
            title: m.title || '',
            type: m.type || 'text',
            url: m.url || '',
            content: m.content || '',
            fileUrl: m.fileUrl || '',
            fileName: m.fileName || (m.fileUrl ? m.fileUrl.split('/').pop() : ''),
            file: null,
          }))
        : [],
    })
    setError('')
    setShowModal(true)
  }

  const addMaterial = () => {
    setForm((prev) => ({ ...prev, materials: [...(prev.materials || []), { ...emptyMaterial }] }))
  }

  const removeMaterial = (index) => {
    setForm((prev) => ({
      ...prev,
      materials: (prev.materials || []).filter((_, i) => i !== index),
    }))
  }

  const updateMaterial = (index, field, value) => {
    setForm((prev) => ({
      ...prev,
      materials: (prev.materials || []).map((material, i) =>
        i === index ? { ...material, [field]: value } : material
      ),
    }))
  }

  const handleMaterialFileChange = (index, file) => {
    setForm((prev) => ({
      ...prev,
      materials: (prev.materials || []).map((material, i) =>
        i === index
          ? {
              ...material,
              file,
              fileName: file?.name || '',
              // Auto-fill title from filename if teacher hasn't entered one yet.
              title:
                !material.title?.trim() && file?.name
                  ? file.name.replace(/\.[^/.]+$/, '')
                  : material.title,
            }
          : material
      ),
    }))
  }

  const handleSave = async () => {
    if (!form.title.trim()) return setError('Title is required')
    
    setSaving(true)
    try {
      // Build materials with file handling
      const formData = new FormData()
      
      // Add course basic info
      formData.append('title', form.title)
      formData.append('description', form.description)
      formData.append('isPublished', form.isPublished)
      
      // Add materials
      const materialsMetadata = [];
      (form.materials || []).forEach((material, index) => {
        const derivedTitle =
          material.title?.trim() ||
          material.fileName?.trim()?.replace(/\.[^/.]+$/, '') ||
          ''

        const hasAnyContent = Boolean(
          derivedTitle ||
          material.url?.trim() ||
          material.content?.trim() ||
          material.file
        )

        if (!hasAnyContent) return
        
        const materialData = {
          title: derivedTitle || `Material ${index + 1}`,
          type: material.type || 'text',
          url: material.url?.trim() || '',
          content: material.content?.trim() || '',
          fileName: material.fileName || '',
          fileUrl: material.fileUrl || '',
        }
        
        // If file exists, add it to FormData
        if (material.file) {
          formData.append(`material_${index}_file`, material.file)
        }
        
        materialsMetadata.push(materialData)
      })
      
      formData.append('materialsMetadata', JSON.stringify(materialsMetadata))
      
      if (editingCourse) {
        await api.put(`/courses/${editingCourse._id}`, formData)
      } else {
        await api.post('/courses', formData)
      }
      setShowModal(false)
      fetchCourses()
    } catch (err) {
      const serverMessage = err.response?.data?.message
      const fallback = err.message || 'Failed to save'
      setError(serverMessage || fallback)
      console.error('Course save failed:', {
        status: err.response?.status,
        data: err.response?.data,
        message: err.message,
      })
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
      await api.put(`/courses/${course._id}`, { isPublished: !course.isPublished })
      fetchCourses()
    } catch (err) {
      console.error(err)
    }
  }

  const openStudentModal = (course) => {
    setSelectedCourse(course)
    setStudentEmail('')
    setStudentError('')
    setShowStudentModal(true)
  }

  const handleAddStudent = async () => {
    if (!studentEmail.trim()) {
      setStudentError('Student email is required')
      return
    }

    setStudentError('')
    setAssigningStudent(true)
    try {
      await api.post(`/courses/${selectedCourse._id}/students`, {
        email: studentEmail.trim(),
      })
      setShowStudentModal(false)
      fetchCourses()
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to assign student'
      setStudentError(message)
    } finally {
      setAssigningStudent(false)
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
                    onClick={() => openStudentModal(course)}
                    className="flex-1 text-xs bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 py-2 rounded-lg transition-all"
                  >
                    👤 Assign
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

              <div className="border-t border-slate-700/50 pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-slate-300">Course Materials</label>
                  <button
                    type="button"
                    onClick={addMaterial}
                    className="text-xs bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 px-3 py-1.5 rounded-lg"
                  >
                    + Add Material
                  </button>
                </div>

                {(form.materials || []).length === 0 ? (
                  <p className="text-xs text-slate-500">No materials added yet.</p>
                ) : (
                  <div className="space-y-3">
                    {(form.materials || []).map((material, index) => (
                      <div key={index} className="bg-slate-700/30 border border-slate-600/30 rounded-xl p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-slate-300 font-medium">Material {index + 1}</p>
                          <button
                            type="button"
                            onClick={() => removeMaterial(index)}
                            className="text-xs text-red-400 hover:text-red-300"
                          >
                            Remove
                          </button>
                        </div>

                        <input
                          type="text"
                          value={material.title}
                          onChange={(e) => updateMaterial(index, 'title', e.target.value)}
                          placeholder="Material title"
                          className="w-full bg-slate-700/50 border border-slate-600/50 text-white placeholder-slate-500 rounded-lg px-3 py-2 text-xs focus:outline-none"
                        />

                        <select
                          value={material.type}
                          onChange={(e) => updateMaterial(index, 'type', e.target.value)}
                          className="w-full bg-slate-700/50 border border-slate-600/50 text-white rounded-lg px-3 py-2 text-xs focus:outline-none"
                        >
                          <option value="text">Text</option>
                          <option value="link">Link</option>
                          <option value="video">Video</option>
                          <option value="pdf">PDF</option>
                        </select>

                        {material.type === 'pdf' ? (
                          <div className="space-y-2">
                            {material.fileName ? (
                              <div className="flex items-center justify-between bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-2">
                                <span className="text-xs text-green-300">✓ {material.fileName}</span>
                                <button
                                  type="button"
                                  onClick={() => handleMaterialFileChange(index, null)}
                                  className="text-xs text-green-400 hover:text-green-300"
                                >
                                  Remove
                                </button>
                              </div>
                            ) : (
                              <label className="block">
                                <input
                                  type="file"
                                  accept=".pdf,.doc,.docx,.txt"
                                  onChange={(e) => handleMaterialFileChange(index, e.target.files?.[0] || null)}
                                  className="w-full bg-slate-700/50 border border-slate-600/50 text-white placeholder-slate-500 rounded-lg px-3 py-2 text-xs cursor-pointer file:mr-2 file:bg-purple-600 file:text-white file:px-3 file:py-1 file:rounded-md file:border-0 file:text-xs file:cursor-pointer hover:file:bg-purple-500"
                                />
                              </label>
                            )}
                          </div>
                        ) : (
                          <input
                            type="text"
                            value={material.url}
                            onChange={(e) => updateMaterial(index, 'url', e.target.value)}
                            placeholder="URL (required for links, videos, PDFs)"
                            className="w-full bg-slate-700/50 border border-slate-600/50 text-white placeholder-slate-500 rounded-lg px-3 py-2 text-xs focus:outline-none"
                          />
                        )}

                        <textarea
                          value={material.content}
                          onChange={(e) => updateMaterial(index, 'content', e.target.value)}
                          rows={2}
                          placeholder="Notes/content (optional)"
                          className="w-full bg-slate-700/50 border border-slate-600/50 text-white placeholder-slate-500 rounded-lg px-3 py-2 text-xs focus:outline-none resize-none"
                        />
                      </div>
                    ))}
                  </div>
                )}
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

      {showStudentModal && selectedCourse && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700/50 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="text-white font-bold text-lg">Assign Student</h2>
                <p className="text-slate-400 text-sm mt-1">{selectedCourse.title}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowStudentModal(false)}
                className="text-slate-400 hover:text-white text-xl"
              >
                ✕
              </button>
            </div>

            {studentError && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3 mb-4">
                {studentError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Student Email</label>
                <input
                  type="email"
                  value={studentEmail}
                  onChange={(e) => setStudentEmail(e.target.value)}
                  placeholder="student@example.com"
                  className="w-full bg-slate-700/50 border border-slate-600/50 text-white placeholder-slate-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowStudentModal(false)}
                  className="px-4 py-2.5 rounded-xl text-sm text-slate-300 bg-slate-700/60 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddStudent}
                  disabled={assigningStudent}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {assigningStudent ? 'Assigning...' : 'Assign Student'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
