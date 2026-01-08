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
  createdAt: number
}

export default function Home() {
  const [chats, setChats] = useState<Chat[]>([])
  const [currentChatId, setCurrentChatId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const chatRef = useRef<HTMLDivElement>(null)

  // Load chats from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('zenith-chats')
    if (saved) {
      const parsed = JSON.parse(saved)
      setChats(parsed)
      if (parsed.length > 0) {
        setCurrentChatId(parsed[0].id)
      }
    }
  }, [])

  // Save chats to localStorage
  useEffect(() => {
    if (chats.length > 0) {
      localStorage.setItem('zenith-chats', JSON.stringify(chats))
    }
  }, [chats])

  // Auto scroll
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight
    }
  }, [chats, currentChatId, isLoading])

  const currentChat = chats.find(c => c.id === currentChatId)
  const messages = currentChat?.messages || []

  const createNewChat = () => {
    const newChat: Chat = {
      id: Date.now().toString(),
      title: 'Новый чат',
      messages: [],
      createdAt: Date.now()
    }
    setChats(prev => [newChat, ...prev])
    setCurrentChatId(newChat.id)
    setSidebarOpen(false)
  }

  const deleteChat = (id: string) => {
    setChats(prev => prev.filter(c => c.id !== id))
    if (currentChatId === id) {
      const remaining = chats.filter(c => c.id !== id)
      setCurrentChatId(remaining.length > 0 ? remaining[0].id : null)
    }
  }

  const clearAllChats = () => {
    setChats([])
    setCurrentChatId(null)
    localStorage.removeItem('zenith-chats')
  }

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput('')

    // Create new chat if none exists
    let chatId = currentChatId
    if (!chatId) {
      const newChat: Chat = {
        id: Date.now().toString(),
        title: userMessage.slice(0, 30) + (userMessage.length > 30 ? '...' : ''),
        messages: [],
        createdAt: Date.now()
      }
      setChats(prev => [newChat, ...prev])
      chatId = newChat.id
      setCurrentChatId(chatId)
    }

    // Add user message
    setChats(prev => prev.map(chat => {
      if (chat.id === chatId) {
        const newMessages = [...chat.messages, { role: 'user' as const, content: userMessage }]
        return {
          ...chat,
          messages: newMessages,
          title: chat.messages.length === 0 ? userMessage.slice(0, 30) + (userMessage.length > 30 ? '...' : '') : chat.title
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

      {/* Sidebar Overlay */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`sidebar glass ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h2>💬 Чаты</h2>
          <button className="icon-btn" onClick={() => setSidebarOpen(false)}>✕</button>
        </div>
        
        <button className="new-chat-btn" onClick={createNewChat}>
          <span>+</span> Новый чат
        </button>

        <div className="chat-list">
          {chats.map(chat => (
            <div 
              key={chat.id} 
              className={`chat-item ${chat.id === currentChatId ? 'active' : ''}`}
              onClick={() => { setCurrentChatId(chat.id); setSidebarOpen(false) }}
            >
              <span className="chat-title">{chat.title}</span>
              <button 
                className="delete-btn"
                onClick={(e) => { e.stopPropagation(); deleteChat(chat.id) }}
              >
                🗑
              </button>
            </div>
          ))}
          {chats.length === 0 && (
            <p className="no-chats">Нет чатов</p>
          )}
        </div>

        {chats.length > 0 && (
          <button className="clear-all-btn" onClick={clearAllChats}>
            Очистить всё
          </button>
        )}
      </aside>

      {/* Main */}
      <div className="container">
        <header className="header glass">
          <button className="menu-btn" onClick={() => setSidebarOpen(true)}>☰</button>
          <div className="header-center">
            <h1>⚡ Zenith Sync 3.0</h1>
            <p>AI Assistant • Groq</p>
          </div>
          <button className="icon-btn" onClick={createNewChat}>+</button>
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
