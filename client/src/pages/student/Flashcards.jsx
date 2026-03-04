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

  const handleGenerate = async () => {
    if (!topic.trim()) return
    setGenerating(true)

    // ⚠️ AI HAS TO BE CREATED HERE — Call AI API to generate flashcards
    // Simulated flashcards for now
    setTimeout(() => {
      setFlashcards([
        { question: 'What is a Stack?', answer: 'A stack is a linear data structure that follows the Last In First Out (LIFO) principle.' },
        { question: 'What is a Queue?', answer: 'A queue is a linear data structure that follows the First In First Out (FIFO) principle.' },
        { question: 'What is Big O notation?', answer: 'Big O notation describes the worst-case time or space complexity of an algorithm.' },
        { question: 'What is recursion?', answer: 'Recursion is when a function calls itself directly or indirectly to solve a problem.' },
        { question: 'What is a linked list?', answer: 'A linked list is a linear data structure where elements are stored in nodes, each pointing to the next.' },
      ])
      setCurrentIndex(0)
      setFlipped(false)
      setMode('study')
      setGenerating(false)
    }, 1500)
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

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white">Flashcards</h1>
          <p className="text-slate-400 text-sm mt-1">Generate AI-powered flashcards for quick revision</p>
        </div>

        {/* AI Notice */}
        <div className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-xs rounded-xl px-4 py-3">
          ⚠️ AI HAS TO BE CREATED HERE — Connect AI API to generate smart flashcards from topic or notes
        </div>

        {mode === 'generate' ? (
          /* Generate Form */
          <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6 space-y-4 max-w-xl">
            <h2 className="text-white font-semibold">Generate Flashcards</h2>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Topic</label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Data Structures, Photosynthesis, World War II"
                className="w-full bg-slate-700/50 border border-slate-600/50 text-white placeholder-slate-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Paste Notes <span className="text-slate-500">(optional)</span>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Paste your notes here and AI will generate flashcards from them..."
                rows={4}
                className="w-full bg-slate-700/50 border border-slate-600/50 text-white placeholder-slate-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none transition-all"
              />
            </div>

            <button
              onClick={handleGenerate}
              disabled={!topic.trim() || generating}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all text-sm"
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
              <p className="text-slate-400 text-sm">
                Card <span className="text-white font-semibold">{currentIndex + 1}</span> of{' '}
                <span className="text-white font-semibold">{flashcards.length}</span>
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleShuffle}
                  className="text-xs bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 px-3 py-1.5 rounded-lg transition-all"
                >
                  🔀 Shuffle
                </button>
                <button
                  onClick={() => { setMode('generate'); setFlashcards([]) }}
                  className="text-xs bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 px-3 py-1.5 rounded-lg transition-all"
                >
                  + New Set
                </button>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-slate-700 rounded-full h-1.5">
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
                    className="absolute inset-0 bg-slate-800/60 border border-slate-700/50 rounded-2xl flex flex-col items-center justify-center p-8 text-center"
                    style={{ backfaceVisibility: 'hidden' }}
                  >
                    <span className="text-xs text-blue-400 font-medium mb-4 uppercase tracking-wider">Question</span>
                    <p className="text-white text-lg font-semibold leading-relaxed">
                      {flashcards[currentIndex]?.question}
                    </p>
                    <p className="text-slate-500 text-xs mt-6">Click to reveal answer</p>
                  </div>

                  {/* Back */}
                  <div
                    className="absolute inset-0 bg-blue-900/30 border border-blue-500/30 rounded-2xl flex flex-col items-center justify-center p-8 text-center"
                    style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                  >
                    <span className="text-xs text-green-400 font-medium mb-4 uppercase tracking-wider">Answer</span>
                    <p className="text-white text-base leading-relaxed">
                      {flashcards[currentIndex]?.answer}
                    </p>
                    <p className="text-slate-500 text-xs mt-6">Click to flip back</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={handlePrev}
                disabled={currentIndex === 0}
                className="bg-slate-700/50 hover:bg-slate-600/50 disabled:opacity-30 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-xl transition-all text-sm font-medium"
              >
                ← Previous
              </button>
              <button
                onClick={() => setFlipped(!flipped)}
                className="bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 px-6 py-2.5 rounded-xl transition-all text-sm font-medium border border-blue-500/30"
              >
                🔄 Flip
              </button>
              <button
                onClick={handleNext}
                disabled={currentIndex === flashcards.length - 1}
                className="bg-slate-700/50 hover:bg-slate-600/50 disabled:opacity-30 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-xl transition-all text-sm font-medium"
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