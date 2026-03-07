import { useState, useRef, useEffect } from 'react'
import Layout from '../../components/shared/Layout'
import useAuthStore from '../../store/authStore'
import api from '../../lib/axios'

export default function AITutor() {
  const { user } = useAuthStore()
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: `Hi ${user?.name?.split(' ')[0] || 'there'}! 👋 I'm your AI Tutor. I'm here to help you understand concepts and solve problems — but I won't just give you the answers! I'll guide you step by step so you truly learn. What topic would you like help with today?`,
    }
  ])
  const [input, setInput] = useState('')
  const [selectedFile, setSelectedFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [lastQuestion, setLastQuestion] = useState('')
  const [attemptCount, setAttemptCount] = useState(0)
  const [stage, setStage] = useState('hint')
  const [showActions, setShowActions] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    loadChatHistory()
  }, [])

  const loadChatHistory = async () => {
    try {
      console.log('📖 Loading chat history...')
      const response = await api.get('/ai/tutor/history')
      const { data } = response
      
      if (data.messages && data.messages.length > 0) {
        console.log('✅ Loaded', data.messages.length, 'messages from database')
        setMessages(data.messages)
        setLastQuestion(data.lastQuestion || '')
        setAttemptCount(data.attemptCount || 0)
        setStage(data.stage || 'hint')
      } else {
        console.log('ℹ️ No messages found in database, keeping initial greeting')
      }
    } catch (err) {
      console.error('❌ Failed to load chat history:', err)
    }
  }

  const handleClearChat = async () => {
    if (!confirm('Are you sure you want to clear your chat history?')) return
    
    try {
      await api.delete('/ai/tutor/history')
      setMessages([{
        role: 'assistant',
        content: `Hi ${user?.name?.split(' ')[0] || 'there'}! 👋 I'm your AI Tutor. I'm here to help you understand concepts and solve problems — but I won't just give you the answers! I'll guide you step by step so you truly learn. What topic would you like help with today?`,
      }])
      setLastQuestion('')
      setAttemptCount(0)
      setStage('hint')
      setShowActions(false)
      setError('')
    } catch (err) {
      setError('Failed to clear chat history')
    }
  }

  const handleSend = async (forcedQuestion = null, forceAttempt = null) => {
    if (loading) return

    const questionText = typeof forcedQuestion === 'string' ? forcedQuestion : input
    const question = questionText.trim()
    
    if (!question) return

    const normalizedCurrent = question.toLowerCase()
    const normalizedLast = lastQuestion.toLowerCase()
    
    const nextAttempt = forceAttempt !== null 
      ? forceAttempt
      : (normalizedCurrent && normalizedCurrent === normalizedLast
          ? Math.min(attemptCount + 1, 3)
          : 1)

    const userMessage = { role: 'user', content: question }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setError('')
    setLoading(true)
    setShowActions(false)

    try {
      let response
      
      if (selectedFile) {
        const formData = new FormData()
        formData.append('question', question)
        formData.append('attemptCount', String(nextAttempt))
        formData.append('messages', JSON.stringify(messages))
        formData.append('document', selectedFile)
        console.log('📤 Sending request with file...')
        response = await api.post('/ai/tutor', formData)
      } else {
        console.log('📤 Sending request without file...', { question, attempt: nextAttempt, messagesCount: messages.length })
        response = await api.post('/ai/tutor', {
          question,
          attemptCount: nextAttempt,
          messages: JSON.stringify(messages)
        })
      }

      const { data } = response

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data?.reply || 'No response received from AI tutor.',
      }])

      setLastQuestion(question)
      setAttemptCount(data?.attempt || nextAttempt)
      setStage(data?.stage || (nextAttempt >= 3 ? 'solution' : 'hint'))
      setSelectedFile(null)
      
      if (data?.stage === 'hint' && data?.attempt < 3) {
        setShowActions(true)
      } else {
        setShowActions(false)
      }
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to connect to AI Tutor. Please try again.')
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'I ran into a connection issue while generating your tutor response. Please retry.',
      }])
      setShowActions(false)
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const suggestedTopics = [
    'Explain recursion to me',
    'Help me understand sorting algorithms',
    'What is Big O notation?',
    'I need help with linked lists',
  ]

  return (
    <Layout>
      <div className="flex flex-col h-[calc(100vh-140px)]">

        <div className="mb-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-white">AI Tutor</h1>
            <p className="text-slate-400 text-sm mt-1">
              Ask me anything — I'll guide you to the answer, not give it away!
            </p>
          </div>
          <button
            onClick={handleClearChat}
            className="bg-red-600/20 hover:bg-red-600/30 border border-red-500/50 text-red-300 px-4 py-2 rounded-xl text-sm font-medium transition-all"
          >
            🗑️ Clear Chat
          </button>
        </div>

        <div className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-xs rounded-xl px-4 py-3 mb-4 space-y-1">
          <p>Hint flow active: attempts 1-2 give hints, attempt 3 gives full explanation + solution.</p>
          <p>Current mode: {stage === 'solution' ? 'Full solution' : 'Guided hint'}{attemptCount ? ` (attempt ${attemptCount}/3)` : ''}</p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-xs rounded-xl px-4 py-3 mb-4">
            {error}
          </div>
        )}

        <div className="flex-1 bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4 overflow-y-auto space-y-4 mb-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex items-start gap-3 max-w-[80%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm ${msg.role === 'user' ? 'bg-blue-600' : 'bg-purple-600'}`}>
                  {msg.role === 'user' ? user?.name?.charAt(0).toUpperCase() : '🤖'}
                </div>
                <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white rounded-tr-sm'
                    : 'bg-slate-700/70 text-slate-200 rounded-tl-sm'
                }`}>
                  {msg.content}
                </div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-sm">🤖</div>
                <div className="bg-slate-700/70 rounded-2xl rounded-tl-sm px-4 py-3">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {showActions && !loading && lastQuestion && (
            <div className="flex justify-center gap-3">
              <button
                onClick={() => handleSend(lastQuestion)}
                className="bg-yellow-600/20 hover:bg-yellow-600/30 border border-yellow-500/50 text-yellow-300 px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2"
              >
                💡 Give me another hint
              </button>
              <button
                onClick={() => handleSend(lastQuestion, 3)}
                className="bg-yellow-600/20 hover:bg-yellow-600/30 border border-yellow-500/50 text-yellow-300 px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2"
              >
                ✨ Show full solution
              </button>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {messages.length === 1 && (
          <div className="flex gap-2 flex-wrap mb-3">
            {suggestedTopics.map((topic) => (
              <button
                key={topic}
                onClick={() => setInput(topic)}
                className="text-xs bg-slate-800/60 border border-slate-700/50 hover:border-blue-500/40 text-slate-300 px-3 py-1.5 rounded-full transition-all"
              >
                {topic}
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-3 mb-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask me a question... (Enter to send)"
            rows={2}
            className="flex-1 bg-slate-800/60 border border-slate-700/50 text-white placeholder-slate-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none transition-all"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || loading}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 rounded-xl transition-all font-semibold text-sm"
          >
            Send
          </button>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-xs text-slate-300 bg-slate-800/60 border border-slate-700/50 rounded-xl px-3 py-2 cursor-pointer hover:border-blue-500/40 transition-all">
            📎 Upload PDF/Word
            <input
              type="file"
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openx mlformats-officedocument.wordprocessingml.document"
              className="hidden"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
            />
          </label>
          {selectedFile && (
            <p className="text-xs text-slate-400">Attached: {selectedFile.name}</p>
          )}
        </div>
      </div>
    </Layout>
  )
}