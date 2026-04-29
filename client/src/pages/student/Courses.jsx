import { useEffect, useState } from 'react'
import Layout from '../../components/shared/Layout'
import api from '../../lib/axios'
import { API_BASE_URL } from '../../lib/utils'

const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '')

export default function StudentCourses() {
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
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

  const filtered = courses.filter((c) =>
    c.title.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <Layout>
      <div className="space-y-6">
        <div className="retro-shell overflow-hidden">
          <div className="grid gap-0 lg:grid-cols-[1.1fr,0.9fr]">
            <div className="border-b-[3px] border-black bg-[#6fa8ff] p-6 lg:border-b-0 lg:border-r-[3px]">
              <div className="retro-chip bg-white">Student courses</div>
              <h1 className="retro-title mt-4 text-4xl sm:text-5xl">Assigned learning, bright and easy to scan.</h1>
              <p className="mt-4 max-w-2xl text-base font-medium text-black/75">
                Browse teacher-assigned courses, open materials, and search fast without the dark cards.
              </p>
            </div>
            <div className="bg-[#fff8e8] p-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-[22px] border-[3px] border-black bg-[#ffd84d] p-4 shadow-[5px_5px_0_#111111]">
                  <p className="retro-mono text-xs uppercase tracking-[0.18em] text-black/70">Assigned</p>
                  <p className="mt-3 text-3xl font-black text-black">{courses.length}</p>
                </div>
                <div className="rounded-[22px] border-[3px] border-black bg-[#97e675] p-4 shadow-[5px_5px_0_#111111]">
                  <p className="retro-mono text-xs uppercase tracking-[0.18em] text-black/70">Visible</p>
                  <p className="mt-3 text-3xl font-black text-black">{filtered.length}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="retro-panel relative p-4">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
            🔍
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search courses..."
            className="retro-input pl-10"
          />
        </div>

        <div className="flex items-center gap-4 text-sm">
          <span className="font-medium text-black/70">
            <span className="font-black text-black">{courses.length}</span> assigned courses
          </span>
        </div>

        {/* Course Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-[22px] border-[3px] border-black bg-[#fff8e8] p-5 animate-pulse space-y-3 shadow-[5px_5px_0_#111111]"
              >
                <div className="h-4 bg-black/15 rounded w-3/4" />
                <div className="h-3 bg-black/15 rounded w-full" />
                <div className="h-3 bg-black/15 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="retro-panel text-center py-20">
            <p className="text-4xl mb-3">📚</p>
            <p className="font-semibold text-black">No courses found</p>
            <p className="text-sm mt-1 text-black/70">
              {search ? 'Try a different search term' : 'No courses have been assigned to you yet'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((course) => (
              <div
                key={course._id}
                className="rounded-[22px] border-[3px] border-black bg-[#fff8e8] p-5 flex flex-col gap-3 shadow-[5px_5px_0_#111111] transition-transform hover:-translate-y-1"
              >
                {/* Top */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <h3 className="text-black font-semibold text-sm leading-snug">
                      {course.title}
                    </h3>
                    <p className="text-black/70 text-xs mt-1 line-clamp-2">
                      {course.description || 'No description provided'}
                    </p>
                  </div>
                  <span className="retro-chip bg-[#97e675] flex-shrink-0">
                    ✅ Assigned
                  </span>
                </div>

                {/* Meta */}
                <div className="flex items-center gap-3 text-xs text-black/70 flex-wrap">
                  <span>👨‍🏫 {course.teacher?.name || 'Unknown'}</span>
                  <span>🧑‍🎓 {course.students?.length || 0} students</span>
                  <span>📄 {course.materials?.length || 0} materials</span>
                </div>

                {/* Materials Preview */}
                {course.materials?.length > 0 && (
                  <div className="border-t-[3px] border-black pt-3 space-y-1.5">
                    <p className="text-xs text-black/70 font-medium mb-1">
                      Course Materials
                    </p>
                    {course.materials.slice(0, 3).map((mat, i) => (
                      <div key={i} className="text-xs text-black bg-[#d9e9ff] rounded-[16px] border-[2px] border-black px-3 py-2 space-y-1">
                        <div className="flex items-center gap-2">
                          <span>
                            {mat.type === 'pdf'
                              ? '📄'
                              : mat.type === 'video'
                              ? '🎬'
                              : '🔗'}
                          </span>
                          {mat.url ? (
                            <a
                              href={mat.url}
                              target="_blank"
                              rel="noreferrer"
                              className="truncate text-black underline"
                            >
                              {mat.title}
                            </a>
                          ) : mat.fileUrl ? (
                            <a
                              href={`${API_ORIGIN}${mat.fileUrl}`}
                              target="_blank"
                              rel="noreferrer"
                              className="truncate text-black underline"
                            >
                              {mat.title}
                            </a>
                          ) : (
                            <span className="truncate">{mat.title}</span>
                          )}
                        </div>
                        {mat.content && <p className="text-black/70 truncate">{mat.content}</p>}
                      </div>
                    ))}
                    {course.materials.length > 3 && (
                      <p className="text-xs text-black/60 pl-1">
                        +{course.materials.length - 3} more materials
                      </p>
                    )}
                  </div>
                )}

                {/* Action Button */}
                <div className="pt-1 border-t-[3px] border-black mt-auto">
                  <div className="w-full text-xs bg-[#6fa8ff] border-[3px] border-black py-2.5 rounded-[16px] flex items-center justify-center font-medium text-black shadow-[3px_3px_0_#111111]">
                    Assigned by teacher
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}
