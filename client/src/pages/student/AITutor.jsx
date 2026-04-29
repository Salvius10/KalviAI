import { useState, useRef, useEffect } from 'react'
import Layout from '../../components/shared/Layout'
import useAuthStore from '../../store/authStore'
import api from '../../lib/axios'

const formatInlineText = (text) => {
  const segments = String(text || '').split(/(\*\*[^*]+\*\*)/g)

  return segments.map((segment, index) => {
    const boldMatch = segment.match(/^\*\*([^*]+)\*\*$/)
    if (boldMatch) {
      return <strong key={`${segment}-${index}`} className="font-semibold text-black">{boldMatch[1]}</strong>
    }

    return <span key={`${segment}-${index}`}>{segment}</span>
  })
}

const renderMessageContent = (content) => {
  const normalized = String(content || '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  if (!normalized) return null

  const paragraphs = normalized.split('\n\n')

  return (
    <div className="space-y-3 text-left">
      {paragraphs.map((paragraph, paragraphIndex) => {
        const lines = paragraph.split('\n').map((line) => line.trim()).filter(Boolean)
        const bulletLines = lines.filter((line) => /^[-*]\s+/.test(line))
        const numberedLines = lines.filter((line) => /^\d+\.\s+/.test(line))
        const isBulletList = lines.length > 0 && bulletLines.length === lines.length
        const isNumberedList = lines.length > 0 && numberedLines.length === lines.length

        if (isBulletList) {
          return (
            <ul key={paragraphIndex} className="list-disc space-y-2 pl-5 marker:text-slate-400">
              {lines.map((line, lineIndex) => (
                <li key={lineIndex} className="pl-1">
                  {formatInlineText(line.replace(/^[-*]\s+/, ''))}
                </li>
              ))}
            </ul>
          )
        }

        if (isNumberedList) {
          return (
            <ol key={paragraphIndex} className="list-decimal space-y-2 pl-5 marker:text-slate-400">
              {lines.map((line, lineIndex) => (
                <li key={lineIndex} className="pl-1">
                  {formatInlineText(line.replace(/^\d+\.\s+/, ''))}
                </li>
              ))}
            </ol>
          )
        }

        return (
          <div key={paragraphIndex} className="space-y-2">
            {lines.map((line, lineIndex) => {
              const headingMatch = line.match(/^\*\*([^*]+)\*\*:?$/)

              if (headingMatch) {
                return (
                  <p key={lineIndex} className="font-semibold text-black">
                    {headingMatch[1]}
                  </p>
                )
              }

              return (
                <p key={lineIndex} className="whitespace-pre-wrap break-words">
                  {formatInlineText(line)}
                </p>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

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
    } catch {
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
        <div className="retro-shell mb-4 flex justify-between items-center gap-4 p-4">
          <div>
            <h1 className="retro-title text-3xl">AI Tutor</h1>
            <p className="text-black/70 text-sm mt-1">
              Ask me anything — I'll guide you to the answer, not give it away!
            </p>
          </div>
          <button
            onClick={handleClearChat}
            className="retro-button bg-[#ff8db3] px-4 py-2 text-sm"
          >
            🗑️ Clear Chat
          </button>
        </div>

        <div className="retro-panel bg-[#ffefab] text-black text-xs px-4 py-3 mb-4 space-y-1">
          <p>Hint flow active: attempts 1-2 give hints, attempt 3 gives full explanation + solution.</p>
          <p>Current mode: {stage === 'solution' ? 'Full solution' : 'Guided hint'}{attemptCount ? ` (attempt ${attemptCount}/3)` : ''}</p>
        </div>

        {error && (
          <div className="retro-panel bg-[#ffb3cb] text-black text-xs px-4 py-3 mb-4">
            {error}
          </div>
        )}

        <div className="retro-panel flex-1 p-4 overflow-y-auto space-y-4 mb-4 bg-[#fff8e8]">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex items-start gap-3 max-w-[80%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-full border-[3px] border-black flex items-center justify-center flex-shrink-0 text-sm ${msg.role === 'user' ? 'bg-[#6fa8ff]' : 'bg-[#ffd84d]'}`}>
                  {msg.role === 'user' ? user?.name?.charAt(0).toUpperCase() : '🤖'}
                </div>
                <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-[#6fa8ff] text-black border-[3px] border-black rounded-tr-sm shadow-[4px_4px_0_#111111]'
                    : 'bg-white text-black border-[3px] border-black rounded-tl-sm shadow-[4px_4px_0_#111111]'
                }`}>
                  {msg.role === 'assistant' ? renderMessageContent(msg.content) : (
                    <p className="whitespace-pre-wrap break-words text-left">{msg.content}</p>
                  )}
                </div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-sm">🤖</div>
                <div className="bg-white border-[3px] border-black rounded-2xl rounded-tl-sm px-4 py-3 shadow-[4px_4px_0_#111111]">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-black/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-black/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-black/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {showActions && !loading && lastQuestion && (
            <div className="flex justify-center gap-3">
              <button
                onClick={() => handleSend(lastQuestion)}
                className="retro-button bg-[#ffefab] px-4 py-2 text-sm flex items-center gap-2"
              >
                💡 Give me another hint
              </button>
              <button
                onClick={() => handleSend(lastQuestion, 3)}
                className="retro-button bg-[#ffd84d] px-4 py-2 text-sm flex items-center gap-2"
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
                className="retro-button bg-white px-3 py-1.5 text-xs"
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
            className="retro-input flex-1 resize-none"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || loading}
            className="retro-button bg-[#6fa8ff] px-5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>

        <div className="flex items-center gap-3">
          <label className="retro-button bg-white px-3 py-2 text-xs cursor-pointer">
            📎 Upload PDF/Word
            <input
              type="file"
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openx mlformats-officedocument.wordprocessingml.document"
              className="hidden"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
            />
          </label>
          {selectedFile && (
            <p className="text-xs text-black/70">Attached: {selectedFile.name}</p>
          )}
        </div>
      </div>
    </Layout>
  )
}
