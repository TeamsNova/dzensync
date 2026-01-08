'use client'

import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'

interface Message {
  role: 'user' | 'assistant' | 'error'
  content: string
  mode?: 'normal' | 'thinking' | 'search'
}

interface Chat {
  id: string
  title: string
  messages: Message[]
}

interface CodePreview {
  code: string
  language: string
}

type Mode = 'normal' | 'thinking' | 'search'

export default function Home() {
  const [chats, setChats] = useState<Chat[]>([])
  const [currentChatId, setCurrentChatId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mode, setMode] = useState<Mode>('normal')
  const [openMenuId, setOpenMenuId] = useState<number | null>(null)
  const [speakingId, setSpeakingId] = useState<number | null>(null)
  const [isListening, setIsListening] = useState(false)
  const [codePreview, setCodePreview] = useState<CodePreview | null>(null)
  const chatRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<any>(null)

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
    const timer = setTimeout(() => {
      if (typeof window !== 'undefined' && (window as any).lucide) {
        (window as any).lucide.createIcons()
      }
    }, 100)
    return () => clearTimeout(timer)
  }, [chats, currentChatId, sidebarOpen, mode, openMenuId, codePreview])

  useEffect(() => {
    const handleClick = () => setOpenMenuId(null)
    if (openMenuId !== null) {
      document.addEventListener('click', handleClick)
      return () => document.removeEventListener('click', handleClick)
    }
  }, [openMenuId])

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

  const startListening = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Ваш браузер не поддерживает голосовой ввод')
      return
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    recognition.lang = 'ru-RU'
    recognition.continuous = false
    recognition.interimResults = false
    recognition.onstart = () => setIsListening(true)
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript
      setInput(prev => prev + (prev ? ' ' : '') + transcript)
      setIsListening(false)
    }
    recognition.onerror = () => setIsListening(false)
    recognition.onend = () => setIsListening(false)
    recognitionRef.current = recognition
    recognition.start()
  }

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      setIsListening(false)
    }
  }

  const stopSpeaking = () => {
    const audio = document.getElementById('tts-audio') as HTMLAudioElement
    if (audio) { audio.pause(); audio.currentTime = 0 }
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    setSpeakingId(null)
  }

  const speakText = async (text: string, index: number) => {
    if (speakingId === index) { stopSpeaking(); return }
    stopSpeaking()
    setSpeakingId(index)
    setOpenMenuId(null)
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = 'ru-RU'
      utterance.rate = 1
      const voices = window.speechSynthesis.getVoices()
      const ruVoice = voices.find(v => v.lang.startsWith('ru'))
      if (ruVoice) utterance.voice = ruVoice
      utterance.onend = () => setSpeakingId(null)
      utterance.onerror = () => setSpeakingId(null)
      window.speechSynthesis.speak(utterance)
    } else {
      setSpeakingId(null)
    }
  }

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text)
    setOpenMenuId(null)
  }

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code)
  }

  const openCodePreview = (code: string, language: string) => {
    setCodePreview({ code, language })
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
          messages: [...chat.messages, { role: 'user' as const, content: userMessage, mode }],
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
          history: [...chatMessages, { role: 'user', content: userMessage }].filter(m => m.role !== 'error').slice(-10),
          mode
        }),
      })
      const data = await response.json()
      setChats(prev => prev.map(chat => {
        if (chat.id === chatId) {
          return {
            ...chat,
            messages: [...chat.messages, { 
              role: data.error ? 'error' : 'assistant', 
              content: data.error || data.response,
              mode
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

  // Custom code block component
  const CodeBlock = ({ language, children }: { language: string; children: string }) => (
    <div className="code-block">
      <div className="code-header">
        <span className="code-lang">{language || 'code'}</span>
        <div className="code-actions">
          <button onClick={() => copyCode(children)} title="Копировать">
            <i data-lucide="copy" style={{width: 14, height: 14}}></i>
          </button>
          <button onClick={() => openCodePreview(children, language)} title="Открыть">
            <i data-lucide="maximize-2" style={{width: 14, height: 14}}></i>
          </button>
        </div>
      </div>
      <pre><code>{children}</code></pre>
    </div>
  )

  // Message content with custom code parsing
  const MessageContent = ({ content, onOpenCode, onCopyCode }: { content: string; onOpenCode: (code: string, lang: string) => void; onCopyCode: (code: string) => void }) => {
    // Parse code blocks manually: ```lang\ncode\n``` or ```\ncode\n```
    const parts: { type: 'text' | 'code'; content: string; language?: string }[] = []
    const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g
    let lastIndex = 0
    let match

    while ((match = codeBlockRegex.exec(content)) !== null) {
      // Add text before code block
      if (match.index > lastIndex) {
        parts.push({ type: 'text', content: content.slice(lastIndex, match.index) })
      }
      // Add code block
      parts.push({ type: 'code', content: match[2].trim(), language: match[1] || '' })
      lastIndex = match.index + match[0].length
    }
    // Add remaining text
    if (lastIndex < content.length) {
      parts.push({ type: 'text', content: content.slice(lastIndex) })
    }

    // If no code blocks found, just render as markdown
    if (parts.length === 0) {
      parts.push({ type: 'text', content })
    }

    return (
      <>
        {parts.map((part, idx) => {
          if (part.type === 'code') {
            return (
              <div key={idx} className="code-block">
                <div className="code-header">
                  <span className="code-lang">{part.language || 'code'}</span>
                  <div className="code-actions">
                    <button onClick={() => onCopyCode(part.content)} title="Копировать">
                      <i data-lucide="copy" style={{width: 14, height: 14}}></i>
                    </button>
                    <button onClick={() => onOpenCode(part.content, part.language || '')} title="Открыть">
                      <i data-lucide="maximize-2" style={{width: 14, height: 14}}></i>
                    </button>
                  </div>
                </div>
                <pre><code>{part.content}</code></pre>
              </div>
            )
          }
          // Render text with basic markdown
          return (
            <ReactMarkdown
              key={idx}
              components={{
                code({ children }) { return <code className="inline-code">{children}</code> },
                p({ children }) { return <p>{children}</p> },
                strong({ children }) { return <strong>{children}</strong> },
                em({ children }) { return <em>{children}</em> },
                ul({ children }) { return <ul>{children}</ul> },
                ol({ children }) { return <ol>{children}</ol> },
                li({ children }) { return <li>{children}</li> },
                h1({ children }) { return <h3>{children}</h3> },
                h2({ children }) { return <h4>{children}</h4> },
                h3({ children }) { return <h5>{children}</h5> },
              }}
            >
              {part.content}
            </ReactMarkdown>
          )
        })}
      </>
    )
  }

  return (
    <div className={`app ${codePreview ? 'with-preview' : ''}`}>
      {/* Sidebar Overlay */}
      <div className={`sidebar-overlay ${sidebarOpen ? 'show' : ''}`} onClick={() => setSidebarOpen(false)} />

      {/* Sidebar */}
      <aside className={`sidebar ${!sidebarOpen ? 'hidden' : ''}`}>
        <div className="sidebar-header">
          <h2>Чаты</h2>
          <button className="close-sidebar-btn" onClick={() => setSidebarOpen(false)}>
            <i data-lucide="x" style={{width: 18, height: 18}}></i>
          </button>
        </div>
        <button className="new-chat-btn" onClick={createNewChat}>
          <i data-lucide="plus" style={{width: 18, height: 18}}></i>
          Новый чат
        </button>
        <div className="chat-list">
          {chats.map(chat => (
            <div key={chat.id} className={`chat-item ${chat.id === currentChatId ? 'active' : ''}`} onClick={() => setCurrentChatId(chat.id)}>
              <i data-lucide="message-square" style={{width: 16, height: 16, opacity: 0.5}}></i>
              <span className="chat-title">{chat.title}</span>
              <button className="delete-btn" onClick={(e) => { e.stopPropagation(); deleteChat(chat.id) }}>
                <i data-lucide="trash-2" style={{width: 14, height: 14}}></i>
              </button>
            </div>
          ))}
          {chats.length === 0 && <p className="no-chats">Нет чатов</p>}
        </div>
        {chats.length > 0 && (
          <button className="clear-all-btn" onClick={clearAllChats}>
            <i data-lucide="trash" style={{width: 14, height: 14}}></i>
            Очистить всё
          </button>
        )}
      </aside>

      {/* Main Content */}
      <div className="main">
        <div className="topbar">
          <button className="toggle-sidebar-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <i data-lucide={sidebarOpen ? "panel-left-close" : "panel-left-open"} style={{width: 20, height: 20}}></i>
          </button>
          <span className="topbar-title">Zenith Sync</span>
          <div className="mode-selector">
            <button className={`mode-btn ${mode === 'normal' ? 'active' : ''}`} onClick={() => setMode('normal')} title="Обычный режим">
              <i data-lucide="message-circle" style={{width: 18, height: 18}}></i>
            </button>
            <button className={`mode-btn ${mode === 'thinking' ? 'active' : ''}`} onClick={() => setMode('thinking')} title="Режим размышления">
              <i data-lucide="brain" style={{width: 18, height: 18}}></i>
            </button>
            <button className={`mode-btn ${mode === 'search' ? 'active' : ''}`} onClick={() => setMode('search')} title="Режим поиска">
              <i data-lucide="search" style={{width: 18, height: 18}}></i>
            </button>
          </div>
        </div>

        <div className="chat-area" ref={chatRef}>
          {messages.length === 0 ? (
            <div className="welcome">
              <div className="welcome-icon">
                <i data-lucide="sparkles" style={{width: 32, height: 32}}></i>
              </div>
              <h2>Чем могу помочь?</h2>
              <p>Задайте любой вопрос — помогу с кодом, текстом, анализом и многим другим.</p>
              <div className="mode-info">
                <div className="mode-card"><i data-lucide="message-circle" style={{width: 20, height: 20}}></i><span>Обычный</span></div>
                <div className="mode-card"><i data-lucide="brain" style={{width: 20, height: 20}}></i><span>Thinking</span></div>
                <div className="mode-card"><i data-lucide="search" style={{width: 20, height: 20}}></i><span>Search</span></div>
              </div>
            </div>
          ) : (
            <div className="messages">
              {messages.map((msg, i) => (
                <div key={i} className={`message-wrapper ${msg.role}`}>
                  <div className={`message ${msg.role}`}>
                    {msg.mode && msg.mode !== 'normal' && msg.role === 'assistant' && (
                      <div className="message-mode">
                        <i data-lucide={msg.mode === 'thinking' ? 'brain' : 'search'} style={{width: 12, height: 12}}></i>
                        {msg.mode === 'thinking' ? 'Thinking' : 'Search'}
                      </div>
                    )}
                    <div className="message-text">
                      {msg.role === 'assistant' ? (
                        <MessageContent content={msg.content} onOpenCode={openCodePreview} onCopyCode={copyCode} />
                      ) : msg.content}
                    </div>
                  </div>
                  {msg.role === 'assistant' && (
                    <div className="message-actions">
                      <div className="message-actions-wrapper">
                        <button className="message-menu-btn" onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === i ? null : i) }}>
                          <i data-lucide="more-vertical" style={{width: 16, height: 16}}></i>
                        </button>
                        {openMenuId === i && (
                          <div className="message-menu" onClick={(e) => e.stopPropagation()}>
                            <button onClick={() => speakText(msg.content, i)}>
                              <i data-lucide={speakingId === i ? "volume-x" : "volume-2"} style={{width: 14, height: 14}}></i>
                              {speakingId === i ? 'Остановить' : 'Озвучить'}
                            </button>
                            <button onClick={() => copyText(msg.content)}>
                              <i data-lucide="copy" style={{width: 14, height: 14}}></i>
                              Копировать
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {isLoading && (
                <div className="typing">
                  {mode !== 'normal' && (
                    <div className="typing-mode">
                      <i data-lucide={mode === 'thinking' ? 'brain' : 'search'} style={{width: 14, height: 14}}></i>
                      {mode === 'thinking' ? 'Думаю...' : 'Ищу...'}
                    </div>
                  )}
                  <div className="typing-dots"><span /><span /><span /></div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="input-area">
          <div className="input-box">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isListening ? 'Говорите...' : mode === 'thinking' ? 'Задайте вопрос для анализа...' : mode === 'search' ? 'Что найти?' : 'Напишите сообщение...'}
              disabled={isLoading || isListening}
            />
            {input.trim() ? (
              <button className="send-btn" onClick={sendMessage} disabled={isLoading}>
                <i data-lucide="send" style={{width: 18, height: 18}}></i>
              </button>
            ) : (
              <button className={`mic-btn ${isListening ? 'listening' : ''}`} onClick={isListening ? stopListening : startListening} disabled={isLoading}>
                <i data-lucide={isListening ? "mic-off" : "mic"} style={{width: 18, height: 18}}></i>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Code Preview Panel */}
      {codePreview && (
        <div className="code-preview-panel">
          <div className="code-preview-header">
            <span className="code-preview-lang">{codePreview.language || 'code'}</span>
            <div className="code-preview-actions">
              <button onClick={() => copyCode(codePreview.code)} title="Копировать">
                <i data-lucide="copy" style={{width: 16, height: 16}}></i>
              </button>
              <button onClick={() => setCodePreview(null)} title="Закрыть">
                <i data-lucide="x" style={{width: 16, height: 16}}></i>
              </button>
            </div>
          </div>
          <div className="code-preview-content">
            <pre><code>{codePreview.code}</code></pre>
          </div>
        </div>
      )}
    </div>
  )
}
