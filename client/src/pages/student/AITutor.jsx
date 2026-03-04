import { useState, useRef, useEffect } from 'react'
import Layout from '../../components/shared/Layout'
import useAuthStore from '../../store/authStore'

export default function AITutor() {
  const { user } = useAuthStore()
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: `Hi ${user?.name?.split(' ')[0] || 'there'}! 👋 I'm your AI Tutor. I'm here to help you understand concepts and solve problems — but I won't just give you the answers! I'll guide you step by step so you truly learn. What topic would you like help with today?`,
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || loading) return
    const userMessage = { role: 'user', content: input.trim() }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)

    // ⚠️ AI HAS TO BE CREATED HERE — Send messages to AI tutor API
    // Simulate response for now
    setTimeout(() => {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '⚠️ AI Tutor has to be connected here. This is where the Socratic method AI will guide you through your question without giving direct answers.',
      }])
      setLoading(false)
    }, 1000)
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

        {/* Header */}
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-white">AI Tutor</h1>
          <p className="text-slate-400 text-sm mt-1">
            Ask me anything — I'll guide you to the answer, not give it away!
          </p>
        </div>

        {/* AI Notice */}
        <div className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-xs rounded-xl px-4 py-3 mb-4">
          ⚠️ AI HAS TO BE CREATED HERE — Connect Gemini/OpenAI API to power the Socratic tutoring experience
        </div>

        {/* Chat Area */}
        <div className="flex-1 bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4 overflow-y-auto space-y-4 mb-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex items-start gap-3 max-w-[80%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>

                {/* Avatar */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm ${msg.role === 'user' ? 'bg-blue-600' : 'bg-purple-600'}`}>
                  {msg.role === 'user' ? user?.name?.charAt(0).toUpperCase() : '🤖'}
                </div>

                {/* Bubble */}
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

          {/* Loading dots */}
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
          <div ref={bottomRef} />
        </div>

        {/* Suggested Topics */}
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

        {/* Input */}
        <div className="flex gap-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask me a question... (Enter to send)"
            rows={2}
            className="flex-1 bg-slate-800/60 border border-slate-700/50 text-white placeholder-slate-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none transition-all"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 rounded-xl transition-all font-semibold text-sm"
          >
            Send
          </button>
        </div>
      </div>
    </Layout>
  )
}