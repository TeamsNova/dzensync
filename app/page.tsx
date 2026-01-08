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
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const chatRef = useRef<HTMLDivElement>(null)

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

  const deleteChat = (id: string) => {
    const newChats = chats.filter(c => c.id !== id)
    setChats(newChats)
    if (currentChatId === id) {
      setCurrentChatId(newChats.length > 0 ? newChats[0].id : null)
    }
    if (newChats.length === 0) {
      localStorage.removeItem('zenith-chats')
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

    let chatId = currentChatId
    if (!chatId) {
      const newChat: Chat = {
        id: Date.now().toString(),
        title: userMessage.slice(0, 30) + (userMessage.length > 30 ? '...' : ''),
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
          title: isFirst ? userMessage.slice(0, 30) + (userMessage.length > 30 ? '...' : '') : chat.title
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
    <div className="app">
      {/* Sidebar Overlay (Mobile) */}
      <div 
        className={`sidebar-overlay ${sidebarOpen ? 'show' : ''}`} 
        onClick={() => setSidebarOpen(false)} 
      />

      {/* Sidebar - Left */}
      <aside className={`sidebar ${!sidebarOpen ? 'hidden' : ''}`}>
        <div className="sidebar-header">
          <h2>Чаты</h2>
          <button className="close-sidebar-btn" onClick={() => setSidebarOpen(false)}>✕</button>
        </div>
        
        <button className="new-chat-btn" onClick={createNewChat}>
          + Новый чат
        </button>

        <div className="chat-list">
          {chats.map(chat => (
            <div 
              key={chat.id} 
              className={`chat-item ${chat.id === currentChatId ? 'active' : ''}`}
              onClick={() => setCurrentChatId(chat.id)}
            >
              <span className="chat-title">{chat.title}</span>
              <button 
                className="delete-btn"
                onClick={(e) => { e.stopPropagation(); deleteChat(chat.id) }}
              >
                ✕
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

      {/* Main Content */}
      <div className="main">
        {/* Top Bar */}
        <div className="topbar">
          <button className="toggle-sidebar-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
            ☰
          </button>
          <span className="topbar-title">Zenith Sync</span>
        </div>

        {/* Chat Area */}
        <div className="chat-area" ref={chatRef}>
          {messages.length === 0 ? (
            <div className="welcome">
              <h2>Чем могу помочь?</h2>
              <p>Задайте любой вопрос — помогу с кодом, текстом, анализом и многим другим.</p>
            </div>
          ) : (
            <div className="messages">
              {messages.map((msg, i) => (
                <div key={i} className={`message ${msg.role}`}>
                  {msg.content}
                </div>
              ))}

              {isLoading && (
                <div className="typing">
                  <span />
                  <span />
                  <span />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Input */}
        <div className="input-area">
          <div className="input-box">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Напишите сообщение..."
              disabled={isLoading}
            />
            <button 
              className="send-btn" 
              onClick={sendMessage} 
              disabled={isLoading || !input.trim()}
            >
              Отправить
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
