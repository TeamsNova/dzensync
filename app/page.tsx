'use client'

import { useState, useRef, useEffect } from 'react'

interface Message {
  role: 'user' | 'assistant' | 'error'
  content: string
}

interface Chat {
  id: string
  title: string
  messages: Message[]
}

export default function Home() {
  const [chats, setChats] = useState<Chat[]>([])
  const [currentChatId, setCurrentChatId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const chatRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const saved = localStorage.getItem('zenith-chats')
    if (saved) {
      const parsed = JSON.parse(saved)
      setChats(parsed)
      if (parsed.length > 0) setCurrentChatId(parsed[0].id)
    }
  }, [])

  useEffect(() => {
    if (chats.length > 0) {
      localStorage.setItem('zenith-chats', JSON.stringify(chats))
    }
  }, [chats])

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight
    }
  }, [chats, currentChatId, isLoading])

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 150) + 'px'
    }
  }, [input])

  const currentChat = chats.find(c => c.id === currentChatId)
  const messages = currentChat?.messages || []

  const createNewChat = () => {
    const newChat: Chat = {
      id: Date.now().toString(),
      title: 'Новый чат',
      messages: []
    }
    setChats(prev => [newChat, ...prev])
    setCurrentChatId(newChat.id)
  }

  const closeChat = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const newChats = chats.filter(c => c.id !== id)
    setChats(newChats)
    if (currentChatId === id) {
      setCurrentChatId(newChats.length > 0 ? newChats[0].id : null)
    }
    if (newChats.length === 0) {
      localStorage.removeItem('zenith-chats')
    }
  }

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput('')

    let chatId = currentChatId
    if (!chatId) {
      const newChat: Chat = {
        id: Date.now().toString(),
        title: userMessage.slice(0, 25) + (userMessage.length > 25 ? '...' : ''),
        messages: []
      }
      setChats(prev => [newChat, ...prev])
      chatId = newChat.id
      setCurrentChatId(chatId)
    }

    setChats(prev => prev.map(chat => {
      if (chat.id === chatId) {
        const isFirst = chat.messages.length === 0
        return {
          ...chat,
          messages: [...chat.messages, { role: 'user' as const, content: userMessage }],
          title: isFirst ? userMessage.slice(0, 25) + (userMessage.length > 25 ? '...' : '') : chat.title
        }
      }
      return chat
    }))

    setIsLoading(true)

    try {
      const chatMessages = chats.find(c => c.id === chatId)?.messages || []
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: userMessage,
          history: [...chatMessages, { role: 'user', content: userMessage }].filter(m => m.role !== 'error').slice(-10)
        }),
      })

      const data = await response.json()

      setChats(prev => prev.map(chat => {
        if (chat.id === chatId) {
          return {
            ...chat,
            messages: [...chat.messages, { 
              role: data.error ? 'error' : 'assistant', 
              content: data.error || data.response 
            }]
          }
        }
        return chat
      }))
    } catch {
      setChats(prev => prev.map(chat => {
        if (chat.id === chatId) {
          return {
            ...chat,
            messages: [...chat.messages, { role: 'error', content: 'Ошибка соединения' }]
          }
        }
        return chat
      }))
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <>
      <div className="bg-effects">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
      </div>

      <div className="app">
        {/* Top Bar with Tabs */}
        <div className="topbar">
          <div className="tabs">
            {chats.map(chat => (
              <button
                key={chat.id}
                className={`tab ${chat.id === currentChatId ? 'active' : ''}`}
                onClick={() => setCurrentChatId(chat.id)}
              >
                <span className="tab-title">{chat.title}</span>
                <span className="tab-close" onClick={(e) => closeChat(chat.id, e)}>×</span>
              </button>
            ))}
          </div>
          <button className="new-tab-btn" onClick={createNewChat} title="Новый чат">+</button>
        </div>

        {/* Main */}
        <div className="main">
          <div className="chat-area" ref={chatRef}>
            {messages.length === 0 ? (
              <div className="welcome">
                <div className="welcome-icon">⚡</div>
                <h2>Чем могу помочь?</h2>
                <p>Задайте вопрос, и я постараюсь дать полезный ответ. Поддерживаю код, анализ, генерацию текста и многое другое.</p>
              </div>
            ) : (
              messages.map((msg, i) => (
                <div key={i} className={`message ${msg.role}`}>
                  <div className="message-avatar">
                    {msg.role === 'user' ? '👤' : '⚡'}
                  </div>
                  <div className="message-content">{msg.content}</div>
                </div>
              ))
            )}

            {isLoading && (
              <div className="typing">
                <div className="message-avatar">⚡</div>
                <div className="typing-dots">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="input-area">
            <div className="input-box">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Напишите сообщение..."
                disabled={isLoading}
                rows={1}
              />
              <button 
                className="send-btn" 
                onClick={sendMessage} 
                disabled={isLoading || !input.trim()}
              >
                ↑
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
