'use client'

import { useState, useRef, useEffect, useMemo, memo } from 'react'
import ReactMarkdown from 'react-markdown'
import { supabase } from '../lib/supabase'

interface User {
  email?: string
  id: string
}

interface Profile {
  is_premium: boolean
  premium_until: string | null
  messages_today: number
  last_message_date: string
  research_today: number
}

interface Message {
  role: 'user' | 'assistant' | 'error'
  content: string
  mode?: 'normal' | 'thinking' | 'search' | 'research' | 'codex'
  sources?: { title: string; url: string }[]
  attachments?: Attachment[]
  generatedImage?: string
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

interface Attachment {
  type: 'image' | 'file'
  name: string
  data: string
  mimeType?: string
  preview?: string
}

type Mode = 'normal' | 'thinking' | 'search' | 'research' | 'codex'

export default function Home() {
  const [user, setUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [authSuccess, setAuthSuccess] = useState('')
  const [authSubmitting, setAuthSubmitting] = useState(false)
  
  // Premium & Limits
  const [profile, setProfile] = useState<Profile | null>(null)
  const [limitModalOpen, setLimitModalOpen] = useState(false)
  const [premiumModalOpen, setPremiumModalOpen] = useState(false)
  const FREE_LIMIT = 20
  const RESEARCH_LIMIT = 5
  
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
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [selectedModel, setSelectedModel] = useState<'free' | 'pro'>('free')
  const [modelMenuOpen, setModelMenuOpen] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [toast, setToast] = useState<string | null>(null)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const chatRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load saved theme from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('zenith-theme')
    if (savedTheme === 'dark' || savedTheme === 'light') {
      setTheme(savedTheme)
      document.documentElement.setAttribute('data-theme', savedTheme)
    }
  }, [])

  // Toggle theme
  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
    localStorage.setItem('zenith-theme', newTheme)
    document.documentElement.setAttribute('data-theme', newTheme)
  }

  // Load saved model from localStorage
  useEffect(() => {
    const savedModel = localStorage.getItem('zenith-model')
    if (savedModel === 'pro' || savedModel === 'free') {
      setSelectedModel(savedModel)
    }
  }, [])

  // Save model to localStorage when changed
  const changeModel = (model: 'free' | 'pro') => {
    setSelectedModel(model)
    localStorage.setItem('zenith-model', model)
    setModelMenuOpen(false)
  }
  const recognitionRef = useRef<any>(null)

  // Auth check
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }: { data: { session: any } }) => {
      setUser(session?.user ?? null)
      setAuthLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      setUser(session?.user ?? null)
    })

    // Check URL params for auth messages
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const error = params.get('error')
      const errorDesc = params.get('error_description')
      
      if (error) {
        if (errorDesc?.includes('expired')) {
          setAuthError('Ссылка истекла. Запросите новую.')
        } else {
          setAuthError(errorDesc || 'Ошибка авторизации')
        }
        // Clean URL
        window.history.replaceState({}, '', window.location.pathname)
      }
      
      // Check for successful confirmation
      const hash = window.location.hash
      if (hash.includes('access_token')) {
        setAuthSuccess('Email подтверждён! Вы вошли в систему.')
        window.history.replaceState({}, '', window.location.pathname)
      }
    }

    return () => subscription.unsubscribe()
  }, [])

  // Load profile when user logs in
  useEffect(() => {
    if (user) {
      loadProfile()
    } else {
      setProfile(null)
    }
  }, [user])

  const loadProfile = async () => {
    if (!user) return
    
    const { data, error } = await supabase
      .from('profiles')
      .select('is_premium, premium_until, messages_today, last_message_date, research_today')
      .eq('id', user.id)
      .single()
    
    if (error) {
      console.error('Error loading profile:', error)
      // Create profile if doesn't exist
      const today = new Date().toISOString().split('T')[0]
      const { data: newProfile } = await supabase
        .from('profiles')
        .insert({ id: user.id, is_premium: false, premium_until: null, messages_today: 0, research_today: 0, last_message_date: today })
        .select()
        .single()
      if (newProfile) setProfile({ ...newProfile, research_today: 0 })
    } else {
      // Check if premium expired
      let isPremiumActive = data.is_premium
      if (data.premium_until) {
        const premiumEnd = new Date(data.premium_until)
        if (premiumEnd < new Date()) {
          // Premium expired - disable it
          isPremiumActive = false
          await supabase
            .from('profiles')
            .update({ is_premium: false, premium_until: null })
            .eq('id', user.id)
        }
      }
      
      // Check if new day - reset counter
      const today = new Date().toISOString().split('T')[0]
      if (data.last_message_date !== today) {
        const { data: updated } = await supabase
          .from('profiles')
          .update({ messages_today: 0, research_today: 0, last_message_date: today })
          .eq('id', user.id)
          .select()
          .single()
        setProfile(updated ? { ...updated, is_premium: isPremiumActive, research_today: 0 } : { ...data, messages_today: 0, research_today: 0, last_message_date: today, is_premium: isPremiumActive })
      } else {
        setProfile({ ...data, is_premium: isPremiumActive, research_today: data.research_today || 0 })
      }
    }
  }

  const incrementMessageCount = async (isResearch: boolean = false) => {
    if (!user || !profile) return
    
    const today = new Date().toISOString().split('T')[0]
    const newCount = profile.messages_today + 1
    const newResearchCount = isResearch ? (profile.research_today || 0) + 1 : (profile.research_today || 0)
    
    await supabase
      .from('profiles')
      .update({ messages_today: newCount, research_today: newResearchCount, last_message_date: today })
      .eq('id', user.id)
    
    setProfile({ ...profile, messages_today: newCount, research_today: newResearchCount, last_message_date: today })
  }

  const canSendMessage = () => {
    if (!profile) return false
    if (profile.is_premium) return true
    return profile.messages_today < FREE_LIMIT
  }

  const canUseResearch = () => {
    if (!profile) return false
    if (profile.is_premium) return true
    return (profile.research_today || 0) < RESEARCH_LIMIT
  }

  const researchLeft = () => {
    if (!profile) return 0
    if (profile.is_premium) return Infinity
    return Math.max(0, RESEARCH_LIMIT - (profile.research_today || 0))
  }

  const messagesLeft = () => {
    if (!profile) return 0
    if (profile.is_premium) return Infinity
    return Math.max(0, FREE_LIMIT - profile.messages_today)
  }

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
  }, [chats, currentChatId, sidebarOpen, mode, openMenuId, codePreview, input, attachments])

  useEffect(() => {
    const handleClick = () => setOpenMenuId(null)
    if (openMenuId !== null) {
      document.addEventListener('click', handleClick)
      return () => document.removeEventListener('click', handleClick)
    }
  }, [openMenuId])

  const currentChat = chats.find(c => c.id === currentChatId)
  const messages = currentChat?.messages || []

  // Auth functions
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthError('')
    setAuthSubmitting(true)

    try {
      if (authMode === 'register') {
        // Проверяем IP перед регистрацией
        const ipCheck = await fetch('/api/check-ip')
        const ipData = await ipCheck.json()
        
        if (ipData.registered) {
          throw new Error('С вашего IP уже зарегистрирован аккаунт. Один аккаунт на устройство.')
        }
        
        const { data, error } = await supabase.auth.signUp({
          email: authEmail,
          password: authPassword,
        })
        if (error) throw error
        
        // Регистрируем IP для нового пользователя
        if (data.user) {
          await fetch('/api/check-ip', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: data.user.id })
          })
        }
        
        setAuthError('Проверьте почту для подтверждения!')
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: authEmail,
          password: authPassword,
        })
        if (error) throw error
      }
    } catch (err: any) {
      setAuthError(err.message || 'Ошибка авторизации')
    } finally {
      setAuthSubmitting(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setChats([])
    setCurrentChatId(null)
    localStorage.removeItem('zenith-chats')
  }

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
    setToast('Скопировано!')
    setTimeout(() => setToast(null), 2000)
  }

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code)
    setToast('Скопировано!')
    setTimeout(() => setToast(null), 2000)
  }

  const openCodePreview = (code: string, language: string) => {
    setCodePreview({ code, language })
  }

  const [streamingContent, setStreamingContent] = useState('')
  const [streamingSources, setStreamingSources] = useState<{ title: string; url: string }[]>([])
  const [streamingImage, setStreamingImage] = useState<string | null>(null)

  // File handling functions
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    for (const file of Array.from(files)) {
      if (file.type.startsWith('image/')) {
        // Handle image
        const reader = new FileReader()
        reader.onload = () => {
          const base64 = reader.result as string
          setAttachments(prev => [...prev, {
            type: 'image',
            name: file.name,
            data: base64,
            mimeType: file.type,
            preview: base64
          }])
        }
        reader.readAsDataURL(file)
      } else if (
        file.type.startsWith('text/') ||
        file.name.endsWith('.json') ||
        file.name.endsWith('.js') ||
        file.name.endsWith('.ts') ||
        file.name.endsWith('.tsx') ||
        file.name.endsWith('.jsx') ||
        file.name.endsWith('.py') ||
        file.name.endsWith('.html') ||
        file.name.endsWith('.css') ||
        file.name.endsWith('.md') ||
        file.name.endsWith('.xml') ||
        file.name.endsWith('.yaml') ||
        file.name.endsWith('.yml') ||
        file.name.endsWith('.sql') ||
        file.name.endsWith('.sh') ||
        file.name.endsWith('.env') ||
        file.name.endsWith('.txt')
      ) {
        // Handle text file
        const reader = new FileReader()
        reader.onload = () => {
          const text = reader.result as string
          setAttachments(prev => [...prev, {
            type: 'file',
            name: file.name,
            data: text.slice(0, 50000), // Limit to 50k chars
            mimeType: file.type
          }])
        }
        reader.readAsText(file)
      } else {
        alert(`Файл ${file.name} не поддерживается. Поддерживаются: изображения, текстовые файлы, код.`)
      }
    }
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index))
  }

  const sendMessage = async () => {
    if ((!input.trim() && attachments.length === 0) || isLoading) return
    
    // Check message limit
    if (!canSendMessage()) {
      setLimitModalOpen(true)
      return
    }
    
    // Check research limit for free users
    if (mode === 'research' && !canUseResearch()) {
      setLimitModalOpen(true)
      return
    }
    
    const userMessage = input.trim()
    const currentAttachments = [...attachments]
    setInput('')
    setAttachments([])

    let chatId = currentChatId
    if (!chatId) {
      const newChat: Chat = {
        id: Date.now().toString(),
        title: userMessage.slice(0, 30) + (userMessage.length > 30 ? '...' : '') || 'Файл',
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
          messages: [...chat.messages, { 
            role: 'user' as const, 
            content: userMessage, 
            mode,
            attachments: currentAttachments.length > 0 ? currentAttachments : undefined
          }],
          title: isFirst ? (userMessage.slice(0, 30) + (userMessage.length > 30 ? '...' : '') || 'Файл') : chat.title
        }
      }
      return chat
    }))

    setIsLoading(true)
    setStreamingContent('')
    setStreamingSources([])
    setStreamingImage(null)

    try {
      const chatMessages = chats.find(c => c.id === chatId)?.messages || []
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: userMessage,
          history: [...chatMessages, { role: 'user', content: userMessage }].filter(m => m.role !== 'error').slice(-10),
          mode,
          isPremium: profile?.is_premium && selectedModel === 'pro',
          modelName: selectedModel === 'pro' ? 'Zenith Summit 3.5 Pro' : 'Zenith Sync 3.0',
          attachments: currentAttachments
        }),
      })

      if (!response.ok) {
        throw new Error('API error')
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let fullContent = ''
      let displayedIndex = 0
      let sources: { title: string; url: string }[] = []
      let generatedImage: string | null = null
      let isDisplaying = false

      // Smooth streaming - show 1-2 chars every 25ms for realistic typing
      const smoothDisplay = async () => {
        if (isDisplaying) return
        isDisplaying = true
        
        while (displayedIndex < fullContent.length) {
          // Add 1-2 characters at a time
          const charsToAdd = Math.min(2, fullContent.length - displayedIndex)
          displayedIndex += charsToAdd
          setStreamingContent(fullContent.slice(0, displayedIndex))
          await new Promise(r => setTimeout(r, 25)) // 25ms per update = ~80 chars/sec
        }
        
        isDisplaying = false
      }

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value)
          const lines = chunk.split('\n')

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6)
              if (data === '[DONE]') continue
              try {
                const parsed = JSON.parse(data)
                if (parsed.sources) {
                  sources = parsed.sources
                  setStreamingSources(sources)
                }
                if (parsed.content) {
                  fullContent += parsed.content
                  // Start smooth display
                  smoothDisplay()
                }
                if (parsed.generatedImage) {
                  generatedImage = parsed.generatedImage
                  setStreamingImage(generatedImage)
                }
              } catch {}
            }
          }
        }
      }

      // Wait for smooth display to finish showing all content
      while (displayedIndex < fullContent.length) {
        await new Promise(resolve => setTimeout(resolve, 30))
        displayedIndex += 2
        setStreamingContent(fullContent.slice(0, Math.min(displayedIndex, fullContent.length)))
      }

      // Clear streaming BEFORE adding to messages to prevent duplication
      setStreamingContent('')
      setStreamingSources([])
      setStreamingImage(null)

      // Clean up the content - remove image generation command
      let cleanContent = fullContent.replace(/\[GENERATE_IMAGE:\s*.+?\]/g, '').trim()
      if (generatedImage && !cleanContent) {
        cleanContent = 'Вот сгенерированное изображение:'
      }

      setChats(prev => prev.map(chat => {
        if (chat.id === chatId) {
          return {
            ...chat,
            messages: [...chat.messages, { 
              role: 'assistant' as const, 
              content: cleanContent || 'Не удалось получить ответ',
              mode,
              sources: sources.length > 0 ? sources : undefined,
              generatedImage: generatedImage || undefined
            }]
          }
        }
        return chat
      }))
      
      // Increment message count after successful response
      await incrementMessageCount(mode === 'research')
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

  // Streaming content with thinking and artifact support
  // Track artifact state to prevent flickering - stable artifact that doesn't re-render
  const [streamingArtifact, setStreamingArtifact] = useState<{
    visible: boolean
    language: string
    fileName: string
    isComplete: boolean
  } | null>(null)
  const artifactCodeRef = useRef<string>('')
  const beforeCodeRef = useRef<string>('')
  const afterCodeRef = useRef<string>('')

  // Detect code block start and show artifact once
  useEffect(() => {
    if (!streamingContent) return
    
    const codeMatch = streamingContent.match(/```(\w*)\n?([\s\S]*?)($|```)/)
    
    if (codeMatch && !streamingArtifact?.visible) {
      const language = codeMatch[1] || ''
      const fileName = language ? `code.${language === 'javascript' ? 'js' : language === 'typescript' ? 'ts' : language === 'python' ? 'py' : language}` : 'code.txt'
      const beforeCode = streamingContent.slice(0, streamingContent.indexOf('```')).trim()
      beforeCodeRef.current = beforeCode
      
      setStreamingArtifact({
        visible: true,
        language,
        fileName,
        isComplete: false
      })
    }
    
    if (codeMatch) {
      artifactCodeRef.current = codeMatch[2] || ''
      
      // Check if code block is complete
      const isComplete = streamingContent.includes('```', streamingContent.indexOf('```') + 3)
      if (isComplete) {
        afterCodeRef.current = streamingContent.slice(streamingContent.lastIndexOf('```') + 3).trim()
        if (streamingArtifact && !streamingArtifact.isComplete) {
          setStreamingArtifact(prev => prev ? { ...prev, isComplete: true } : null)
        }
      }
    }
  }, [streamingContent, streamingArtifact?.visible, streamingArtifact?.isComplete])

  // Reset artifact state when streaming ends
  useEffect(() => {
    if (!isLoading) {
      setStreamingArtifact(null)
      artifactCodeRef.current = ''
      beforeCodeRef.current = ''
      afterCodeRef.current = ''
    }
  }, [isLoading])

  // Memoized artifact - only re-renders when isComplete changes
  const memoizedArtifact = useMemo(() => {
    if (!streamingArtifact?.visible) return null
    
    return (
      <div 
        className="artifact-card artifact-streaming" 
        onClick={() => openCodePreview(artifactCodeRef.current, streamingArtifact.language)}
      >
        <div className="artifact-phone">
          <div className="artifact-phone-screen">
            <div className="artifact-phone-dots">
              <span></span><span></span><span></span>
            </div>
            <div className="artifact-phone-code">
              <div className="artifact-code-line">// {streamingArtifact.fileName}</div>
              <div className="artifact-code-line">// Генерация...</div>
            </div>
          </div>
        </div>
        <div className="artifact-info">
          <div className="artifact-title">{streamingArtifact.fileName}</div>
          <div className="artifact-subtitle">
            {streamingArtifact.isComplete ? 'Нажмите чтобы открыть' : 'Генерация...'}
          </div>
        </div>
        {!streamingArtifact.isComplete && (
          <div className="artifact-loading">
            <span></span><span></span><span></span>
          </div>
        )}
        {streamingArtifact.isComplete && (
          <div className="artifact-arrow">
            <i data-lucide="chevron-right" style={{width: 20, height: 20}}></i>
          </div>
        )}
      </div>
    )
  }, [streamingArtifact?.visible, streamingArtifact?.isComplete, streamingArtifact?.fileName, streamingArtifact?.language])

  const StreamingContent = ({ content, isThinking }: { content: string; isThinking: boolean }) => {
    // If artifact is showing, only render text before/after code (artifact rendered separately)
    if (streamingArtifact?.visible) {
      return (
        <>
          {beforeCodeRef.current && (
            <div className="streaming-markdown">
              <ReactMarkdown>{beforeCodeRef.current}</ReactMarkdown>
            </div>
          )}
          {memoizedArtifact}
          {streamingArtifact.isComplete && afterCodeRef.current && (
            <div className="streaming-markdown">
              <ReactMarkdown>{afterCodeRef.current}</ReactMarkdown>
            </div>
          )}
          <span className="cursor" />
        </>
      )
    }
    
    if (!isThinking) {
      return (
        <div className="streaming-markdown">
          <ReactMarkdown>{content}</ReactMarkdown>
          <span className="cursor" />
        </div>
      )
    }

    // Parse <think>...</think> tags
    const thinkMatch = content.match(/<think>([\s\S]*?)(<\/think>|$)/)
    const afterThink = content.includes('</think>') ? content.split('</think>')[1] : ''

    if (thinkMatch) {
      const thinkContent = thinkMatch[1]
      return (
        <>
          <div className="thinking-block">
            <div className="thinking-header">
              <i data-lucide="brain" style={{width: 14, height: 14}}></i>
              Размышление
            </div>
            <div className="thinking-content">{thinkContent}<span className="cursor" /></div>
          </div>
          {afterThink && (
            <div className="final-answer">
              {afterThink}<span className="cursor" />
            </div>
          )}
        </>
      )
    }

    return <span className="streaming-text">{content}<span className="cursor" /></span>
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

  // Message content with custom code parsing and thinking support
  const MessageContent = ({ content, onOpenCode, onCopyCode }: { content: string; onOpenCode: (code: string, lang: string) => void; onCopyCode: (code: string) => void }) => {
    // Check for thinking tags first (support both closed and unclosed tags)
    const thinkMatch = content.match(/<think>([\s\S]*?)(<\/think>|$)/)
    if (thinkMatch) {
      const thinkContent = thinkMatch[1]
      const hasClosingTag = content.includes('</think>')
      const afterThink = hasClosingTag ? content.split('</think>')[1]?.trim() || '' : ''
      
      return (
        <>
          <div className="thinking-block">
            <div className="thinking-header">
              <i data-lucide="brain" style={{width: 14, height: 14}}></i>
              Размышление
            </div>
            <div className="thinking-content">{thinkContent}</div>
          </div>
          {afterThink && <MessageContentInner content={afterThink} onOpenCode={onOpenCode} onCopyCode={onCopyCode} />}
        </>
      )
    }
    
    return <MessageContentInner content={content} onOpenCode={onOpenCode} onCopyCode={onCopyCode} />
  }

  // Inner message content for code parsing
  const MessageContentInner = ({ content, onOpenCode, onCopyCode }: { content: string; onOpenCode: (code: string, lang: string) => void; onCopyCode: (code: string) => void }) => {
    // Try multiple regex patterns to catch code blocks
    const patterns = [
      /```(\w*)\n([\s\S]*?)```/g,           // Standard: ```python\ncode```
      /```(\w*)\s+([\s\S]*?)```/g,          // With space: ```python code```
      /`{3}(\w*)\s*([\s\S]*?)`{3}/g,        // Generic backticks
    ]
    
    let parts: { type: 'text' | 'code'; content: string; language?: string }[] = []
    let foundMatch = false
    
    for (const regex of patterns) {
      if (foundMatch) break
      
      const tempParts: typeof parts = []
      let lastIndex = 0
      let match
      regex.lastIndex = 0 // Reset regex
      
      while ((match = regex.exec(content)) !== null) {
        foundMatch = true
        if (match.index > lastIndex) {
          tempParts.push({ type: 'text', content: content.slice(lastIndex, match.index) })
        }
        tempParts.push({ type: 'code', content: match[2].trim(), language: match[1] || '' })
        lastIndex = match.index + match[0].length
      }
      
      if (foundMatch) {
        if (lastIndex < content.length) {
          tempParts.push({ type: 'text', content: content.slice(lastIndex) })
        }
        parts = tempParts
      }
    }

    // If still no code blocks found, check for code-like content
    if (!foundMatch) {
      // Look for lines that look like code
      const lines = content.split('\n')
      const codeIndicators = ['def ', 'function ', 'class ', 'import ', 'from ', 'const ', 'let ', 'var ', 'if ', 'for ', 'while ', 'return ', 'print(', 'console.']
      const hasCodeLines = lines.some(line => codeIndicators.some(ind => line.trim().startsWith(ind)))
      
      if (hasCodeLines && lines.length > 3) {
        // Find where code starts and ends
        let codeStart = -1
        let codeEnd = -1
        
        for (let i = 0; i < lines.length; i++) {
          const isCodeLine = codeIndicators.some(ind => lines[i].trim().startsWith(ind)) || 
                            /^\s{2,}/.test(lines[i]) || // Indented line
                            /^[\s]*[{}()\[\];]/.test(lines[i]) // Brackets
          if (isCodeLine && codeStart === -1) codeStart = i
          if (isCodeLine) codeEnd = i
        }
        
        if (codeStart !== -1) {
          const beforeCode = lines.slice(0, codeStart).join('\n').trim()
          const codeContent = lines.slice(codeStart, codeEnd + 1).join('\n')
          const afterCode = lines.slice(codeEnd + 1).join('\n').trim()
          
          if (beforeCode) parts.push({ type: 'text', content: beforeCode })
          parts.push({ type: 'code', content: codeContent, language: '' })
          if (afterCode) parts.push({ type: 'text', content: afterCode })
          foundMatch = true
        }
      }
    }

    // Final fallback - just render as markdown
    if (!foundMatch || parts.length === 0) {
      return (
        <ReactMarkdown
          components={{
            code({ children }) { return <code className="inline-code">{children}</code> },
            pre({ children }) { return <pre className="code-pre">{children}</pre> },
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
          {content}
        </ReactMarkdown>
      )
    }

    return (
      <>
        {parts.map((part, idx) => {
          if (part.type === 'code') {
            const codeLines = part.content.split('\n').slice(0, 8)
            const fileName = part.language ? `code.${part.language === 'javascript' ? 'js' : part.language === 'typescript' ? 'ts' : part.language === 'python' ? 'py' : part.language}` : 'code.txt'
            return (
              <div key={idx} className="artifact-card" onClick={() => onOpenCode(part.content, part.language || '')}>
                <div className="artifact-phone">
                  <div className="artifact-phone-screen">
                    <div className="artifact-phone-dots">
                      <span></span><span></span><span></span>
                    </div>
                    <div className="artifact-phone-code">
                      {codeLines.map((line, lineIdx) => (
                        <div key={lineIdx} className="artifact-code-line">{line || ' '}</div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="artifact-info">
                  <div className="artifact-title">{fileName}</div>
                  <div className="artifact-subtitle">Нажмите чтобы открыть</div>
                </div>
                <div className="artifact-arrow">
                  <i data-lucide="chevron-right" style={{width: 20, height: 20}}></i>
                </div>
              </div>
            )
          }
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
      {/* Auth Screen */}
      {authLoading ? (
        <div className="auth-loading">
          <div className="typing-dots"><span /><span /><span /></div>
        </div>
      ) : !user ? (
        <div className="auth-screen">
          {/* Left Side - Branding */}
          <div className="auth-left">
            <div className="auth-left-content">
              <div className="auth-logo">
                <div className="auth-logo-icon">
                  <i data-lucide="sparkles" style={{width: 24, height: 24, color: '#fff'}}></i>
                </div>
                <span className="auth-logo-text">Zenith Sync</span>
              </div>
              <h1>Welcome back</h1>
              <p>Войдите чтобы продолжить общение с AI-ассистентом нового поколения. Быстрые ответы, поиск в интернете и глубокий анализ.</p>
            </div>
            <div className="auth-footer">
              <i data-lucide="shield-check" style={{width: 14, height: 14}}></i>
              Secure login — 2FA supported
            </div>
          </div>
          
          {/* Right Side - Form */}
          <div className="auth-right">
            <div className="auth-box">
              <div className="auth-header">
                <h2>{authMode === 'login' ? 'Sign in' : 'Create account'}</h2>
                <p>{authMode === 'login' ? 'Use your email and password' : 'Fill in your details to get started'}</p>
              </div>
              <form onSubmit={handleAuth} className="auth-form">
                <div className="auth-field">
                  <label>Email</label>
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="auth-field">
                  <label>Password</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
                {authError && <div className="auth-error">{authError}</div>}
                {authSuccess && <div className="auth-success">{authSuccess}</div>}
                <button type="submit" disabled={authSubmitting} className="auth-submit">
                  {authSubmitting ? 'Loading...' : authMode === 'login' ? 'Sign in' : 'Create account'}
                </button>
              </form>
              <div className="auth-switch">
                {authMode === 'login' ? (
                  <p>No account? <button onClick={() => { setAuthMode('register'); setAuthError(''); setAuthSuccess(''); }}>Create one</button></p>
                ) : (
                  <p>Already have an account? <button onClick={() => { setAuthMode('login'); setAuthError(''); setAuthSuccess(''); }}>Sign in</button></p>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
      <>
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
          
          {/* Model Selector */}
          <div className="model-selector-wrapper">
            <button className="model-selector-btn" onClick={() => setModelMenuOpen(!modelMenuOpen)}>
              <span className="model-name">
                {selectedModel === 'pro' ? 'Zenith Summit 3.5 Pro' : 'Zenith Sync 3.0'}
              </span>
              <i data-lucide="chevron-down" style={{width: 16, height: 16}}></i>
            </button>
            {modelMenuOpen && (
              <>
                <div className="model-menu-overlay" onClick={() => setModelMenuOpen(false)} />
                <div className="model-menu">
                  <button 
                    className={`model-option ${selectedModel === 'free' ? 'active' : ''}`}
                    onClick={() => { changeModel('free'); }}
                  >
                    <div className="model-option-info">
                      <span className="model-option-name">Zenith Sync 3.0</span>
                      <span className="model-option-desc">Быстрая модель для повседневных задач</span>
                    </div>
                    {selectedModel === 'free' && <i data-lucide="check" style={{width: 16, height: 16}}></i>}
                  </button>
                  <button 
                    className={`model-option pro ${selectedModel === 'pro' ? 'active' : ''} ${!profile?.is_premium ? 'locked' : ''}`}
                    onClick={() => { 
                      if (profile?.is_premium) {
                        changeModel('pro');
                      } else {
                        setModelMenuOpen(false);
                        setPremiumModalOpen(true);
                      }
                    }}
                  >
                    <div className="model-option-info">
                      <div className="model-option-name-row">
                        <span className="model-option-name">Zenith Summit 3.5 Pro</span>
                        {!profile?.is_premium && <i data-lucide="lock" style={{width: 12, height: 12}}></i>}
                      </div>
                      <span className="model-option-desc">Продвинутая модель для сложных задач</span>
                    </div>
                    {selectedModel === 'pro' && profile?.is_premium && <i data-lucide="check" style={{width: 16, height: 16}}></i>}
                  </button>
                </div>
              </>
            )}
          </div>

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
            <button className={`mode-btn research ${mode === 'research' ? 'active' : ''}`} onClick={() => setMode('research')} title={`Глубокое исследование${!profile?.is_premium ? ` (${researchLeft()}/${RESEARCH_LIMIT})` : ''}`}>
              <i data-lucide="microscope" style={{width: 18, height: 18}}></i>
            </button>
            <button className={`mode-btn codex ${mode === 'codex' ? 'active' : ''}`} onClick={() => setMode('codex')} title="Режим кодинга">
              <i data-lucide="code-2" style={{width: 18, height: 18}}></i>
            </button>
          </div>
          <button className="theme-toggle" onClick={toggleTheme} title={theme === 'light' ? 'Тёмная тема' : 'Светлая тема'}>
            <i data-lucide={theme === 'light' ? 'moon' : 'sun'} style={{width: 20, height: 20}}></i>
          </button>
          <button className="settings-btn" onClick={() => setSettingsOpen(true)} title="Настройки">
            <i data-lucide="settings" style={{width: 20, height: 20}}></i>
          </button>
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
                <div className="mode-card research"><i data-lucide="microscope" style={{width: 20, height: 20}}></i><span>Research</span></div>
                <div className="mode-card codex"><i data-lucide="code-2" style={{width: 20, height: 20}}></i><span>Codex</span></div>
              </div>
            </div>
          ) : (
            <div className="messages">
              {messages.map((msg, i) => (
                <div key={i} className={`message-wrapper ${msg.role}`}>
                  <div className={`message ${msg.role}`}>
                    {msg.mode && msg.mode !== 'normal' && msg.role === 'assistant' && (
                      <div className={`message-mode ${msg.mode === 'research' ? 'research' : ''} ${msg.mode === 'codex' ? 'codex' : ''}`}>
                        <i data-lucide={msg.mode === 'thinking' ? 'brain' : msg.mode === 'research' ? 'microscope' : msg.mode === 'codex' ? 'code-2' : 'search'} style={{width: 12, height: 12}}></i>
                        {msg.mode === 'thinking' ? 'Thinking' : msg.mode === 'research' ? 'Deep Research' : msg.mode === 'codex' ? 'Codex' : 'Search'}
                      </div>
                    )}
                    {/* User attachments */}
                    {msg.role === 'user' && msg.attachments && msg.attachments.length > 0 && (
                      <div className="message-attachments">
                        {msg.attachments.map((att, idx) => (
                          att.type === 'image' && att.preview ? (
                            <img key={idx} src={att.preview} alt={att.name} className="message-attachment-image" />
                          ) : (
                            <div key={idx} className="message-attachment-file">
                              <i data-lucide="file-text" style={{width: 16, height: 16}}></i>
                              <span>{att.name}</span>
                            </div>
                          )
                        ))}
                      </div>
                    )}
                    <div className="message-text">
                      {msg.role === 'assistant' ? (
                        <>
                          <MessageContent content={msg.content} onOpenCode={openCodePreview} onCopyCode={copyCode} />
                          {/* Generated image */}
                          {msg.generatedImage && (
                            <div className="generated-image">
                              <img src={msg.generatedImage} alt="Сгенерированное изображение" />
                              <a href={msg.generatedImage} target="_blank" rel="noopener noreferrer" className="image-download">
                                <i data-lucide="download" style={{width: 14, height: 14}}></i>
                                Открыть
                              </a>
                            </div>
                          )}
                          {msg.sources && msg.sources.length > 0 && (
                            <div className="search-sources">
                              <div className="sources-header">
                                <i data-lucide="globe" style={{width: 14, height: 14}}></i>
                                Источники
                              </div>
                              <div className="sources-list">
                                {msg.sources.map((source, idx) => (
                                  <a key={idx} href={source.url} target="_blank" rel="noopener noreferrer" className="source-item">
                                    <i data-lucide="external-link" style={{width: 12, height: 12}}></i>
                                    <span>{source.title}</span>
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
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
              {isLoading && streamingContent && (
                <div className="message-wrapper assistant">
                  <div className="message assistant streaming">
                    {mode === 'thinking' && (
                      <div className="message-mode">
                        <i data-lucide="brain" style={{width: 12, height: 12}}></i>
                        Thinking
                      </div>
                    )}
                    {mode === 'search' && (
                      <div className="message-mode">
                        <i data-lucide="search" style={{width: 12, height: 12}}></i>
                        Search
                      </div>
                    )}
                    {mode === 'research' && (
                      <div className="message-mode research">
                        <i data-lucide="microscope" style={{width: 12, height: 12}}></i>
                        Deep Research
                      </div>
                    )}
                    <div className="message-text">
                      <StreamingContent content={streamingContent} isThinking={mode === 'thinking' || mode === 'research'} />
                      {streamingSources.length > 0 && (
                        <div className="search-sources">
                          <div className="sources-header">
                            <i data-lucide="globe" style={{width: 14, height: 14}}></i>
                            Источники
                          </div>
                          <div className="sources-list">
                            {streamingSources.map((source, idx) => (
                              <a key={idx} href={source.url} target="_blank" rel="noopener noreferrer" className="source-item">
                                <i data-lucide="external-link" style={{width: 12, height: 12}}></i>
                                <span>{source.title}</span>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
              {isLoading && !streamingContent && (
                <div className="typing">
                  {mode !== 'normal' && (
                    <div className={`typing-mode ${mode === 'research' ? 'research' : ''}`}>
                      <i data-lucide={mode === 'thinking' ? 'brain' : mode === 'research' ? 'microscope' : 'search'} style={{width: 14, height: 14}}></i>
                      {mode === 'thinking' ? 'Думаю...' : mode === 'research' ? 'Исследую...' : 'Ищу...'}
                    </div>
                  )}
                  <div className="typing-dots"><span /><span /><span /></div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="input-area">
          {/* Attachments preview */}
          {attachments.length > 0 && (
            <div className="attachments-preview">
              {attachments.map((att, idx) => (
                <div key={idx} className="attachment-item">
                  {att.type === 'image' && att.preview ? (
                    <img src={att.preview} alt={att.name} className="attachment-image" />
                  ) : (
                    <div className="attachment-file">
                      <i data-lucide="file-text" style={{width: 20, height: 20}}></i>
                      <span>{att.name}</span>
                    </div>
                  )}
                  <button className="attachment-remove" onClick={() => removeAttachment(idx)}>
                    <i data-lucide="x" style={{width: 14, height: 14}}></i>
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="input-box">
            <input type="file" ref={fileInputRef} onChange={handleFileSelect} multiple accept="image/*,.txt,.json,.js,.ts,.tsx,.jsx,.py,.html,.css,.md,.xml,.yaml,.yml,.sql,.sh,.env" style={{display: 'none'}} />
            <button className="attach-btn" onClick={() => fileInputRef.current?.click()} disabled={isLoading} title="Прикрепить файл">
              <i data-lucide="paperclip" style={{width: 18, height: 18}}></i>
            </button>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isListening ? 'Говорите...' : attachments.length > 0 ? 'Добавьте комментарий...' : mode === 'thinking' ? 'Задайте вопрос для анализа...' : mode === 'search' ? 'Что найти?' : 'Напишите сообщение...'}
              disabled={isLoading || isListening}
            />
            {(input.trim() || attachments.length > 0) ? (
              <button key="send" className="send-btn" onClick={sendMessage} disabled={isLoading}>
                <i data-lucide="send" style={{width: 18, height: 18}}></i>
              </button>
            ) : (
              <button key="mic" className={`mic-btn ${isListening ? 'listening' : ''}`} onClick={isListening ? stopListening : startListening} disabled={isLoading}>
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
            <div className="code-preview-title">
              <div className="code-preview-icon">
                <i data-lucide="code-2" style={{width: 18, height: 18}}></i>
              </div>
              <span className="code-preview-lang">{codePreview.language || 'code'}</span>
            </div>
            <div className="code-preview-actions">
              <button onClick={() => copyCode(codePreview.code)}>
                <i data-lucide="copy" style={{width: 14, height: 14}}></i>
                Копировать
              </button>
              <button onClick={() => setCodePreview(null)}>
                <i data-lucide="x" style={{width: 14, height: 14}}></i>
                Закрыть
              </button>
            </div>
          </div>
          <div className="code-preview-content">
            <pre><code>{codePreview.code}</code></pre>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {settingsOpen && (
        <>
          <div className="settings-overlay" onClick={() => setSettingsOpen(false)} />
          <div className="settings-modal">
            <div className="settings-header">
              <h3>Настройки</h3>
              <button className="settings-close" onClick={() => setSettingsOpen(false)}>
                <i data-lucide="x" style={{width: 20, height: 20}}></i>
              </button>
            </div>
            <div className="settings-content">
              <div className="settings-section">
                <h4>Аккаунт</h4>
                <p className="settings-info">{user?.email}</p>
                {profile?.is_premium ? (
                  <div className="premium-badge">
                    <i data-lucide="crown" style={{width: 16, height: 16}}></i>
                    Premium
                    {profile.premium_until && (
                      <span className="premium-until">
                        до {new Date(profile.premium_until).toLocaleDateString('ru-RU')}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="free-info">
                    <span>Осталось сообщений: {messagesLeft()}/{FREE_LIMIT}</span>
                    <button className="upgrade-btn" onClick={() => { setSettingsOpen(false); setPremiumModalOpen(true); }}>
                      <i data-lucide="crown" style={{width: 14, height: 14}}></i>
                      Получить Premium
                    </button>
                  </div>
                )}
                <button className="settings-action" onClick={handleLogout} style={{marginTop: 12}}>
                  <i data-lucide="log-out" style={{width: 16, height: 16}}></i>
                  Выйти
                </button>
              </div>
              <div className="settings-section">
                <h4>Память</h4>
                <p className="settings-info">
                  Чатов: {chats.length} | Сообщений: {chats.reduce((acc, c) => acc + c.messages.length, 0)}
                </p>
                <button className="settings-action danger" onClick={() => { clearAllChats(); setSettingsOpen(false); }}>
                  <i data-lucide="trash-2" style={{width: 16, height: 16}}></i>
                  Очистить все чаты
                </button>
              </div>
              <div className="settings-section">
                <h4>О приложении</h4>
                <p className="settings-info">Zenith Sync 3.0</p>
                <p className="settings-info muted">Создано командой Zenith</p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Limit Reached Modal */}
      {limitModalOpen && (
        <>
          <div className="settings-overlay" onClick={() => setLimitModalOpen(false)} />
          <div className="settings-modal limit-modal">
            <div className="settings-header">
              <h3>Лимит исчерпан</h3>
              <button className="settings-close" onClick={() => setLimitModalOpen(false)}>
                <i data-lucide="x" style={{width: 20, height: 20}}></i>
              </button>
            </div>
            <div className="settings-content">
              <div className="limit-icon">
                <i data-lucide="alert-circle" style={{width: 48, height: 48}}></i>
              </div>
              <p className="limit-text">Вы использовали все {FREE_LIMIT} бесплатных сообщений на сегодня.</p>
              <p className="limit-subtext">Лимит обновится завтра или получите Premium для безлимитного доступа.</p>
              <button className="premium-btn" onClick={() => { setLimitModalOpen(false); setPremiumModalOpen(true); }}>
                <i data-lucide="crown" style={{width: 18, height: 18}}></i>
                Получить Premium
              </button>
            </div>
          </div>
        </>
      )}

      {/* Premium Modal */}
      {premiumModalOpen && (
        <>
          <div className="settings-overlay" onClick={() => setPremiumModalOpen(false)} />
          <div className="premium-modal-new">
            <button className="premium-close" onClick={() => setPremiumModalOpen(false)}>
              <i data-lucide="x" style={{width: 20, height: 20}}></i>
            </button>
            
            <div className="premium-header">
              <div className="premium-badge">
                <i data-lucide="sparkles" style={{width: 16, height: 16}}></i>
                PREMIUM
              </div>
              <h2>Zenith Premium</h2>
              <p>Разблокируйте полный потенциал AI</p>
            </div>

            <div className="premium-price-card">
              <div className="premium-price-tag">
                <span className="premium-currency">₽</span>
                <span className="premium-amount">500</span>
                <span className="premium-period">навсегда</span>
              </div>
              <div className="premium-save">Одноразовый платёж</div>
            </div>

            <div className="premium-features-list">
              <div className="premium-feature-item">
                <div className="premium-feature-icon">
                  <i data-lucide="infinity" style={{width: 20, height: 20}}></i>
                </div>
                <div className="premium-feature-text">
                  <span className="premium-feature-title">Безлимитные сообщения</span>
                  <span className="premium-feature-desc">Никаких ограничений на количество</span>
                </div>
              </div>
              <div className="premium-feature-item">
                <div className="premium-feature-icon">
                  <i data-lucide="zap" style={{width: 20, height: 20}}></i>
                </div>
                <div className="premium-feature-text">
                  <span className="premium-feature-title">Summit 3.5 Pro модель</span>
                  <span className="premium-feature-desc">Доступ к самой мощной модели</span>
                </div>
              </div>
              <div className="premium-feature-item">
                <div className="premium-feature-icon">
                  <i data-lucide="microscope" style={{width: 20, height: 20}}></i>
                </div>
                <div className="premium-feature-text">
                  <span className="premium-feature-title">Безлимитный Research</span>
                  <span className="premium-feature-desc">Глубокий анализ без ограничений</span>
                </div>
              </div>
              <div className="premium-feature-item">
                <div className="premium-feature-icon">
                  <i data-lucide="headphones" style={{width: 20, height: 20}}></i>
                </div>
                <div className="premium-feature-text">
                  <span className="premium-feature-title">Приоритетная поддержка</span>
                  <span className="premium-feature-desc">Быстрые ответы на ваши вопросы</span>
                </div>
              </div>
            </div>

            <a href="https://t.me/dllsecurity" target="_blank" rel="noopener noreferrer" className="premium-buy-btn">
              <i data-lucide="send" style={{width: 20, height: 20}}></i>
              Написать в Telegram
            </a>
            <p className="premium-contact">@dllsecurity — оплата и активация</p>
          </div>
        </>
      )}

      {/* Toast notification */}
      {toast && (
        <div className="toast">
          <i data-lucide="check-circle" style={{width: 18, height: 18}}></i>
          {toast}
        </div>
      )}
        </>
      )}
    </div>
  )
}
