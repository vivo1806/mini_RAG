import { useState, useRef, useEffect, useCallback } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

/* ─── Typing Indicator (three bouncing dots) ─── */
function TypingIndicator() {
  return (
    <div className="flex items-start gap-3 animate-fade-in-up">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shrink-0 shadow-lg shadow-primary-500/20">
        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
        </svg>
      </div>
      <div className="bg-surface-800/80 backdrop-blur-sm rounded-2xl rounded-tl-sm px-5 py-3.5 border border-surface-700/50">
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-2 h-2 bg-primary-400 rounded-full"
              style={{
                animation: 'pulse-dot 1.4s infinite ease-in-out',
                animationDelay: `${i * 0.2}s`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

/* ─── Chat Message Bubble ─── */
function ChatMessage({ message, index }) {
  const isUser = message.role === 'user'

  return (
    <div
      className={`flex items-start gap-3 animate-fade-in-up ${isUser ? 'flex-row-reverse' : ''}`}
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      {/* Avatar */}
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-lg ${
          isUser
            ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-emerald-500/20'
            : 'bg-gradient-to-br from-primary-500 to-primary-700 shadow-primary-500/20'
        }`}
      >
        {isUser ? (
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
          </svg>
        ) : (
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
          </svg>
        )}
      </div>

      {/* Message bubble */}
      <div className={`max-w-[75%] flex flex-col gap-1.5`}>
        <div
          className={`rounded-2xl px-4 py-3 leading-relaxed text-[0.9375rem] ${
            isUser
              ? 'bg-gradient-to-br from-emerald-500/90 to-emerald-600/90 text-white rounded-tr-sm'
              : 'bg-surface-800/80 backdrop-blur-sm text-surface-100 rounded-tl-sm border border-surface-700/50'
          }`}
        >
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>

        {/* Sources (bot only) */}
        {!isUser && message.sources && message.sources.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-1">
            {message.sources.map((src, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-surface-800/60 text-surface-400 border border-surface-700/40"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
                {src.source}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Welcome Screen ─── */
function WelcomeScreen() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-6 animate-fade-in-up">
      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center mb-6 shadow-2xl shadow-primary-500/30">
        <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
        </svg>
      </div>
      <h2 className="text-2xl font-bold text-surface-100 mb-2">
        Indecimal Assistant
      </h2>
      <p className="text-surface-400 max-w-md leading-relaxed">
        Ask me anything about Indecimal's construction services, processes, and offerings. I'll find the answer from our company documents.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-2">
        {[
          'What services does Indecimal offer?',
          'Tell me about the construction process',
          'What materials do you use?',
        ].map((q) => (
          <span
            key={q}
            className="px-3 py-1.5 text-sm rounded-full bg-surface-800/60 text-surface-400 border border-surface-700/40 cursor-default"
          >
            {q}
          </span>
        ))}
      </div>
    </div>
  )
}

/* ─── Main App ─── */
export default function App() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const sendMessage = useCallback(async () => {
    const query = input.trim()
    if (!query || isLoading) return

    // Add user message
    const userMessage = { role: 'user', content: query }
    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const res = await fetch(`${API_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.detail || `Server error (${res.status})`)
      }

      const data = await res.json()
      const botMessage = {
        role: 'assistant',
        content: data.answer,
        sources: data.sources || [],
      }
      setMessages((prev) => [...prev, botMessage])
    } catch (error) {
      const errorMessage = {
        role: 'assistant',
        content: `Sorry, I encountered an error: ${error.message}. Please try again.`,
        sources: [],
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
      inputRef.current?.focus()
    }
  }, [input, isLoading])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="flex flex-col h-screen bg-surface-950">
      {/* ── Header ── */}
      <header className="shrink-0 border-b border-surface-800/80 bg-surface-900/50 backdrop-blur-xl">
        <div className="max-w-3xl mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-lg shadow-primary-500/20">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
              </svg>
            </div>
            <div>
              <h1 className="text-sm font-semibold text-surface-100">Indecimal Assistant</h1>
              <p className="text-xs text-surface-500">Powered by RAG Pipeline</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-lg shadow-emerald-400/50"></span>
            <span className="text-xs text-surface-500">Online</span>
          </div>
        </div>
      </header>

      {/* ── Chat Area ── */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-6">
          {messages.length === 0 && !isLoading ? (
            <WelcomeScreen />
          ) : (
            <div className="flex flex-col gap-5">
              {messages.map((msg, i) => (
                <ChatMessage key={i} message={msg} index={i} />
              ))}
              {isLoading && <TypingIndicator />}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </main>

      {/* ── Input Area ── */}
      <footer className="shrink-0 border-t border-surface-800/80 bg-surface-900/50 backdrop-blur-xl">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex items-end gap-3 bg-surface-800/60 rounded-2xl border border-surface-700/50 px-4 py-2 focus-within:border-primary-500/50 focus-within:shadow-lg focus-within:shadow-primary-500/5 transition-all duration-200">
            <textarea
              ref={inputRef}
              id="chat-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question about Indecimal..."
              rows={1}
              className="flex-1 bg-transparent text-surface-100 placeholder-surface-500 resize-none outline-none text-[0.9375rem] leading-relaxed max-h-32 py-1"
              disabled={isLoading}
            />
            <button
              id="send-button"
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 text-white flex items-center justify-center shrink-0 hover:from-primary-400 hover:to-primary-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 hover:shadow-lg hover:shadow-primary-500/25 active:scale-95"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            </button>
          </div>
          <p className="text-center text-xs text-surface-600 mt-2">
            Answers are grounded in Indecimal company documents via RAG
          </p>
        </div>
      </footer>
    </div>
  )
}
