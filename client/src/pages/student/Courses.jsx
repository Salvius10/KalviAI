import { useEffect, useState } from 'react'
import Layout from '../../components/shared/Layout'
import api from '../../lib/axios'
import useAuthStore from '../../store/authStore'

export default function StudentCourses() {
  const { user } = useAuthStore()
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [enrolling, setEnrolling] = useState(null)
  const [search, setSearch] = useState('')

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

  const handleEnroll = async (courseId) => {
    setEnrolling(courseId)
    try {
      await api.post(`/courses/${courseId}/enroll`)
      fetchCourses()
    } catch (err) {
      console.error(err)
    } finally {
      setEnrolling(null)
    }
  }

  const isEnrolled = (course) => {
    return course.students?.some(
      (s) => s._id === user?.id || s === user?.id
    )
  }

  const filtered = courses.filter((c) =>
    c.title.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <Layout>
      <div className="space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white">Courses</h1>
          <p className="text-slate-400 text-sm mt-1">
            Browse and enroll in available courses
          </p>
        </div>

        {/* Search */}
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
            🔍
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search courses..."
            className="w-full bg-slate-800/60 border border-slate-700/50 text-white placeholder-slate-500 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
          />
        </div>

        {/* Stats Bar */}
        <div className="flex items-center gap-4 text-sm">
          <span className="text-slate-400">
            <span className="text-white font-semibold">{courses.length}</span> courses available
          </span>
          <span className="text-slate-600">•</span>
          <span className="text-slate-400">
            <span className="text-white font-semibold">
              {courses.filter(isEnrolled).length}
            </span> enrolled
          </span>
        </div>

        {/* Course Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-5 animate-pulse space-y-3"
              >
                <div className="h-4 bg-slate-700 rounded w-3/4" />
                <div className="h-3 bg-slate-700 rounded w-full" />
                <div className="h-3 bg-slate-700 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 bg-slate-800/60 border border-slate-700/50 rounded-2xl">
            <p className="text-4xl mb-3">📚</p>
            <p className="text-white font-semibold">No courses found</p>
            <p className="text-slate-400 text-sm mt-1">
              {search ? 'Try a different search term' : 'No published courses available yet'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((course) => (
              <div
                key={course._id}
                className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-5 flex flex-col gap-3 hover:border-slate-600 transition-all"
              >
                {/* Top */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <h3 className="text-white font-semibold text-sm leading-snug">
                      {course.title}
                    </h3>
                    <p className="text-slate-400 text-xs mt-1 line-clamp-2">
                      {course.description || 'No description provided'}
                    </p>
                  </div>
                  {isEnrolled(course) && (
                    <span className="text-xs px-2 py-1 rounded-full bg-green-500/10 text-green-400 flex-shrink-0 font-medium">
                      ✅ Enrolled
                    </span>
                  )}
                </div>

                {/* Meta */}
                <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                  <span>👨‍🏫 {course.teacher?.name || 'Unknown'}</span>
                  <span>🧑‍🎓 {course.students?.length || 0} students</span>
                  <span>📄 {course.materials?.length || 0} materials</span>
                </div>

                {/* Materials Preview */}
                {course.materials?.length > 0 && (
                  <div className="border-t border-slate-700/50 pt-3 space-y-1.5">
                    <p className="text-xs text-slate-400 font-medium mb-1">
                      Course Materials
                    </p>
                    {course.materials.slice(0, 3).map((mat, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 text-xs text-slate-300 bg-slate-700/30 rounded-lg px-3 py-1.5"
                      >
                        <span>
                          {mat.type === 'pdf'
                            ? '📄'
                            : mat.type === 'video'
                            ? '🎬'
                            : '🔗'}
                        </span>
                        <span className="truncate">{mat.title}</span>
                      </div>
                    ))}
                    {course.materials.length > 3 && (
                      <p className="text-xs text-slate-500 pl-1">
                        +{course.materials.length - 3} more materials
                      </p>
                    )}
                  </div>
                )}

                {/* Action Button */}
                <div className="pt-1 border-t border-slate-700/50 mt-auto">
                  {isEnrolled(course) ? (
                    <div className="w-full text-xs bg-green-500/10 text-green-400 py-2.5 rounded-xl flex items-center justify-center font-medium">
                      ✅ Already Enrolled
                    </div>
                  ) : (
                    <button
                      onClick={() => handleEnroll(course._id)}
                      disabled={enrolling === course._id}
                      className="w-full text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-xl transition-all"
                    >
                      {enrolling === course._id ? (
                        <span className="flex items-center justify-center gap-2">
                          <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                          </svg>
                          Enrolling...
                        </span>
                      ) : (
                        '+ Enroll in Course'
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}