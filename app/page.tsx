'use client'

import { useState, useRef, useEffect } from 'react'

interface Message {
  role: 'user' | 'assistant' | 'error'
  content: string
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const chatRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight
    }
  }, [messages, isLoading])

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setIsLoading(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: userMessage,
          history: messages.filter(m => m.role !== 'error').slice(-10)
        }),
      })

      const data = await response.json()

      if (data.error) {
        setMessages(prev => [...prev, { role: 'error', content: data.error }])
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: data.response }])
      }
    } catch {
      setMessages(prev => [...prev, { role: 'error', content: 'Ошибка соединения' }])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <>
      {/* Background */}
      <div className="bg-effects">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
        <div className="grid-bg" />
      </div>

      <div className="container">
        <header className="header glass">
          <h1>⚡ Zenith Sync 3.0</h1>
          <p>AI Assistant • Groq</p>
        </header>

        <div className="chat-container glass" ref={chatRef}>
          {messages.length === 0 ? (
            <div className="welcome">
              <h2>Привет! 👋</h2>
              <p>Я Zenith — твой AI ассистент. Задай любой вопрос и получи мгновенный ответ.</p>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div key={i} className={`message ${msg.role}`}>
                {msg.content}
              </div>
            ))
          )}

          {isLoading && (
            <div className="typing">
              <span />
              <span />
              <span />
            </div>
          )}
        </div>

        <div className="input-container glass">
          <div className="input-wrapper">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Напиши сообщение..."
              disabled={isLoading}
            />
            <button onClick={sendMessage} disabled={isLoading || !input.trim()}>
              Отправить
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
