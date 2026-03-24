import { useState } from 'react'
import Layout from '../../components/shared/Layout'
import api from '../../lib/axios'

export default function Flashcards() {
  const [topic, setTopic] = useState('')
  const [notes, setNotes] = useState('')
  const [flashcards, setFlashcards] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [mode, setMode] = useState('generate') // generate | study
  const [cardCount, setCardCount] = useState(8)
  const [error, setError] = useState('')
  const [source, setSource] = useState('')

  const handleGenerate = async () => {
    if (!topic.trim() && !notes.trim()) return
    setGenerating(true)
    setError('')

    try {
      const res = await api.post('/ai/flashcards', {
        topic: topic.trim(),
        notes: notes.trim(),
        cardCount,
      })

      setFlashcards(res.data?.flashcards || [])
      setSource(res.data?.source || '')
      setCurrentIndex(0)
      setFlipped(false)
      setMode('study')
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to generate flashcards')
    } finally {
      setGenerating(false)
    }
  }

  const handleNext = () => {
    setFlipped(false)
    setTimeout(() => setCurrentIndex(i => Math.min(i + 1, flashcards.length - 1)), 150)
  }

  const handlePrev = () => {
    setFlipped(false)
    setTimeout(() => setCurrentIndex(i => Math.max(i - 1, 0)), 150)
  }

  const handleShuffle = () => {
    const shuffled = [...flashcards].sort(() => Math.random() - 0.5)
    setFlashcards(shuffled)
    setCurrentIndex(0)
    setFlipped(false)
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="retro-shell overflow-hidden">
          <div className="grid gap-0 lg:grid-cols-[1.1fr,0.9fr]">
            <div className="border-b-[3px] border-black bg-[#ff8db3] p-6 lg:border-b-0 lg:border-r-[3px]">
              <div className="retro-chip bg-white">Flashcards</div>
              <h1 className="retro-title mt-4 text-4xl sm:text-5xl">Revision should look bright, not dim.</h1>
              <p className="mt-4 max-w-2xl text-base font-medium text-black/75">Generate cards, flip them, and study with stronger light-mode contrast.</p>
            </div>
            <div className="bg-[#fff8e8] p-6">
              <div className="rounded-[22px] border-[3px] border-black bg-[#ffd84d] p-4 shadow-[5px_5px_0_#111111]">
                <p className="retro-mono text-xs uppercase tracking-[0.18em] text-black/70">Mode</p>
                <p className="mt-3 text-3xl font-black text-black">{mode === 'generate' ? 'Create' : 'Study'}</p>
              </div>
              <div className="mt-4 rounded-[22px] border-[3px] border-black bg-[#97e675] p-4 shadow-[5px_5px_0_#111111]">
                <p className="retro-mono text-xs uppercase tracking-[0.18em] text-black/70">Cards</p>
                <p className="mt-3 text-3xl font-black text-black">{flashcards.length || cardCount}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="retro-panel bg-[#ffefab] text-black text-xs px-4 py-3">
          Topic-based flashcard generation is active. Add a topic or notes, and the page will create revision cards automatically.
        </div>

        {error && (
          <div className="retro-panel bg-[#ffb3cb] text-black text-sm px-4 py-3">
            {error}
          </div>
        )}

        {mode === 'generate' ? (
          /* Generate Form */
          <div className="retro-panel p-6 space-y-4 max-w-xl">
            <h2 className="retro-title text-3xl">Generate Flashcards</h2>

            <div>
              <label className="retro-mono mb-2 block text-xs uppercase tracking-[0.18em] text-black/70">Topic</label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Data Structures, Photosynthesis, World War II"
                className="retro-input"
              />
            </div>

            <div>
              <label className="retro-mono mb-2 block text-xs uppercase tracking-[0.18em] text-black/70">
                Paste Notes <span className="text-black/50">(optional)</span>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Paste your notes here and AI will generate flashcards from them..."
                rows={4}
                className="retro-input resize-none"
              />
            </div>

            <div>
              <label className="retro-mono mb-2 block text-xs uppercase tracking-[0.18em] text-black/70">Card Count</label>
              <input
                type="number"
                min="5"
                max="20"
                value={cardCount}
                onChange={(e) => setCardCount(Math.max(5, Math.min(20, Number(e.target.value) || 8)))}
                className="retro-input"
              />
            </div>

            <button
              onClick={handleGenerate}
              disabled={(!topic.trim() && !notes.trim()) || generating}
              className="retro-button w-full bg-[#6fa8ff] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generating ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Generating flashcards...
                </span>
              ) : '✨ Generate Flashcards'}
            </button>
          </div>
        ) : (
          /* Study Mode */
          <div className="space-y-6">

            {/* Progress */}
            <div className="flex items-center justify-between">
              <p className="text-black/70 text-sm">
                Card <span className="text-black font-semibold">{currentIndex + 1}</span> of{' '}
                <span className="text-black font-semibold">{flashcards.length}</span>
              </p>
              <div className="flex items-center gap-2">
                {source && <span className="retro-chip bg-white">{source === 'ai' ? 'AI generated' : 'Smart fallback'}</span>}
                <button
                  onClick={handleShuffle}
                  className="retro-button bg-white px-3 py-1.5 text-xs"
                >
                  🔀 Shuffle
                </button>
                <button
                  onClick={() => { setMode('generate'); setFlashcards([]) }}
                  className="retro-button bg-[#ffd84d] px-3 py-1.5 text-xs"
                >
                  + New Set
                </button>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-black/10 rounded-full h-1.5">
              <div
                className="h-1.5 bg-blue-500 rounded-full transition-all duration-300"
                style={{ width: `${((currentIndex + 1) / flashcards.length) * 100}%` }}
              />
            </div>

            {/* Flashcard */}
            <div className="flex justify-center">
              <div
                onClick={() => setFlipped(!flipped)}
                className="w-full max-w-lg h-64 cursor-pointer"
                style={{ perspective: '1000px' }}
              >
                <div
                  className="relative w-full h-full transition-transform duration-500"
                  style={{
                    transformStyle: 'preserve-3d',
                    transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                  }}
                >
                  {/* Front */}
                  <div
                    className="absolute inset-0 bg-[#fff8e8] border-[3px] border-black rounded-[24px] flex flex-col items-center justify-center p-8 text-center shadow-[6px_6px_0_#111111]"
                    style={{ backfaceVisibility: 'hidden' }}
                  >
                    <span className="text-xs text-blue-400 font-medium mb-4 uppercase tracking-wider">Question</span>
                    <p className="text-black text-lg font-semibold leading-relaxed">
                      {flashcards[currentIndex]?.question}
                    </p>
                    {flashcards[currentIndex]?.category && (
                      <span className="retro-chip mt-4 bg-white">{flashcards[currentIndex]?.category}</span>
                    )}
                    <p className="text-black/60 text-xs mt-6">Click to reveal answer</p>
                  </div>

                  {/* Back */}
                  <div
                    className="absolute inset-0 bg-[#d9e9ff] border-[3px] border-black rounded-[24px] flex flex-col items-center justify-center p-8 text-center shadow-[6px_6px_0_#111111]"
                    style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                  >
                    <span className="text-xs text-green-400 font-medium mb-4 uppercase tracking-wider">Answer</span>
                    <p className="text-black text-base leading-relaxed">
                      {flashcards[currentIndex]?.answer}
                    </p>
                    {flashcards[currentIndex]?.difficulty && (
                      <span className={`retro-chip mt-4 ${flashcards[currentIndex]?.difficulty === 'easy' ? 'bg-[#97e675]' : flashcards[currentIndex]?.difficulty === 'hard' ? 'bg-[#ff8db3]' : 'bg-[#ffd84d]'}`}>
                        {flashcards[currentIndex]?.difficulty}
                      </span>
                    )}
                    <p className="text-black/60 text-xs mt-6">Click to flip back</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={handlePrev}
                disabled={currentIndex === 0}
                className="retro-button bg-white px-6 py-2.5 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                ← Previous
              </button>
              <button
                onClick={() => setFlipped(!flipped)}
                className="retro-button bg-[#6fa8ff] px-6 py-2.5"
              >
                🔄 Flip
              </button>
              <button
                onClick={handleNext}
                disabled={currentIndex === flashcards.length - 1}
                className="retro-button bg-[#97e675] px-6 py-2.5 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
