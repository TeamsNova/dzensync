import { NextRequest } from 'next/server'
import Groq from 'groq-sdk'

// Ротация ключей Groq - добавляй ключи как GROQ_API_KEY_1, GROQ_API_KEY_2, и т.д.
const GROQ_KEYS: string[] = []

// Собираем все ключи из переменных окружения
if (process.env.GROQ_API_KEY) GROQ_KEYS.push(process.env.GROQ_API_KEY)
if (process.env.GROQ_API_KEY_1) GROQ_KEYS.push(process.env.GROQ_API_KEY_1)
if (process.env.GROQ_API_KEY_2) GROQ_KEYS.push(process.env.GROQ_API_KEY_2)
if (process.env.GROQ_API_KEY_3) GROQ_KEYS.push(process.env.GROQ_API_KEY_3)
if (process.env.GROQ_API_KEY_4) GROQ_KEYS.push(process.env.GROQ_API_KEY_4)
if (process.env.GROQ_API_KEY_5) GROQ_KEYS.push(process.env.GROQ_API_KEY_5)

let currentKeyIndex = 0
let keyFailures: { [key: number]: number } = {}

function getNextGroqClient(): Groq {
  if (GROQ_KEYS.length === 0) {
    throw new Error('No Groq API keys configured')
  }
  
  // Найти рабочий ключ
  const startIndex = currentKeyIndex
  do {
    const failures = keyFailures[currentKeyIndex] || 0
    // Если ключ фейлил меньше 3 раз за последние 5 минут - используем его
    if (failures < 3) {
      const key = GROQ_KEYS[currentKeyIndex].trim()
      return new Groq({ apiKey: key })
    }
    currentKeyIndex = (currentKeyIndex + 1) % GROQ_KEYS.length
  } while (currentKeyIndex !== startIndex)
  
  // Все ключи в лимите - сбросим счётчики и попробуем первый
  keyFailures = {}
  currentKeyIndex = 0
  return new Groq({ apiKey: GROQ_KEYS[0].trim() })
}

function markKeyFailed() {
  keyFailures[currentKeyIndex] = (keyFailures[currentKeyIndex] || 0) + 1
  currentKeyIndex = (currentKeyIndex + 1) % GROQ_KEYS.length
}

// Сброс счётчиков каждые 5 минут
setInterval(() => {
  keyFailures = {}
}, 5 * 60 * 1000)

interface TavilyResult {
  title: string
  url: string
  content: string
}

interface TavilyResponse {
  results: TavilyResult[]
  answer?: string
}

interface Attachment {
  type: 'image' | 'file'
  name: string
  data: string
  mimeType?: string
}

async function searchDuckDuckGo(query: string): Promise<TavilyResult[]> {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    })
    
    if (!response.ok) return []
    
    const html = await response.text()
    const results: TavilyResult[] = []
    
    const snippetRegex = /class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g
    const urlRegex = /class="result__url"[^>]*>([\s\S]*?)<\/a>/g
    const titleRegex = /class="result__a"[^>]*>([\s\S]*?)<\/a>/g
    
    const snippets: string[] = []
    const urls: string[] = []
    const titles: string[] = []
    
    let match
    while ((match = snippetRegex.exec(html)) !== null) {
      snippets.push(match[1].replace(/<[^>]+>/g, '').trim())
    }
    while ((match = urlRegex.exec(html)) !== null) {
      urls.push(match[1].replace(/<[^>]+>/g, '').trim())
    }
    while ((match = titleRegex.exec(html)) !== null) {
      titles.push(match[1].replace(/<[^>]+>/g, '').trim())
    }
    
    for (let i = 0; i < Math.min(snippets.length, 5); i++) {
      if (snippets[i] && snippets[i].length > 20) {
        results.push({
          title: titles[i] || `Результат ${i + 1}`,
          url: urls[i]?.startsWith('http') ? urls[i] : `https://${urls[i]}`,
          content: snippets[i]
        })
      }
    }
    
    return results
  } catch {
    return []
  }
}

async function searchWeb(query: string): Promise<{ results: TavilyResult[], error?: string }> {
  if (process.env.TAVILY_API_KEY) {
    try {
      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: process.env.TAVILY_API_KEY,
          query,
          search_depth: 'advanced',
          max_results: 8,
          include_answer: true,
          include_raw_content: false,
        }),
      })
      
      if (response.ok) {
        const data: TavilyResponse = await response.json()
        if (data.results && data.results.length > 0) {
          return { results: data.results }
        }
      }
    } catch {
      // Fall through to DuckDuckGo
    }
  }
  
  const ddgResults = await searchDuckDuckGo(query)
  if (ddgResults.length > 0) {
    return { results: ddgResults }
  }
  
  return { results: [], error: 'Search failed' }
}

async function generateImage(prompt: string): Promise<string | null> {
  try {
    const encodedPrompt = encodeURIComponent(prompt)
    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&nologo=true`
    const response = await fetch(imageUrl, { method: 'HEAD' })
    if (response.ok) {
      return imageUrl
    }
    return null
  } catch {
    return null
  }
}

const SYSTEM_PROMPT = `Ты — Zenith Sync 3.0, продвинутый AI ассистент нового поколения.

ТВОЯ ИДЕНТИЧНОСТЬ:
- Ты Zenith Sync версии 3.0, создан командой Zenith
- НЕ раскрывай технические детали (параметры, на чём основан)

ЯЗЫК:
- Отвечай СТРОГО на русском языке
- ЗАПРЕЩЕНО использовать азиатские языки (вьетнамский, китайский и т.д.)
- Английский только для технических терминов

ГЕНЕРАЦИЯ ИЗОБРАЖЕНИЙ:
- Если просят нарисовать/создать картинку: [GENERATE_IMAGE: описание на английском]

ФОРМАТИРОВАНИЕ КОДА:
- Используй markdown с указанием языка: \`\`\`python

Стиль: без эмодзи, по делу, можешь шутить.`

const THINKING_PROMPT = `Ты — Zenith Sync 3.0 в режиме глубокого анализа.

ЯЗЫК: Строго русский. Запрещены азиатские языки.

Формат:
<think>[анализ]</think>
[ответ]`

const SEARCH_PROMPT = `Ты — Zenith Sync 3.0 с доступом к интернету.

ЯЗЫК: Строго русский. Запрещены азиатские языки.

Отвечай на основе результатов поиска.`

const VISION_PROMPT = `Ты — Zenith Sync 3.0 с анализом изображений.

ЯЗЫК: Строго русский. Запрещены азиатские языки.

Проанализируй изображение и ответь на вопрос.`

export async function POST(request: NextRequest) {
  try {
    const { message, history, mode, isPremium, modelName, attachments } = await request.json()

    if (!message && (!attachments || attachments.length === 0)) {
      return new Response(JSON.stringify({ error: 'Сообщение пустое' }), { status: 400 })
    }

    if (GROQ_KEYS.length === 0) {
      return new Response(JSON.stringify({ error: 'API ключи не настроены' }), { status: 500 })
    }

    const botName = modelName || 'Zenith Sync 3.0'
    let searchResults: TavilyResult[] = []
    
    const imageAttachments = (attachments || []).filter((a: Attachment) => a.type === 'image')
    const fileAttachments = (attachments || []).filter((a: Attachment) => a.type === 'file')
    const hasImages = imageAttachments.length > 0
    
    let model: string
    if (hasImages && isPremium) {
      model = 'llama-3.2-90b-vision-preview'
    } else if (isPremium) {
      model = 'llama-3.3-70b-versatile'
    } else {
      model = 'llama-3.1-8b-instant'
    }

    let systemPrompt = SYSTEM_PROMPT.replace(/Zenith Sync 3\.0/g, botName)
    let userContent: string | { type: string; text?: string; image_url?: { url: string } }[] = message || ''

    if (fileAttachments.length > 0) {
      const fileContext = fileAttachments.map((f: Attachment) => 
        `--- Файл: ${f.name} ---\n${f.data}\n--- Конец файла ---`
      ).join('\n\n')
      userContent = `${fileContext}\n\n${message || 'Проанализируй этот файл'}`
    }

    if (hasImages && isPremium) {
      systemPrompt = VISION_PROMPT.replace(/Zenith Sync 3\.0/g, botName)
      const contentParts: { type: string; text?: string; image_url?: { url: string } }[] = []
      for (const img of imageAttachments) {
        contentParts.push({ type: 'image_url', image_url: { url: img.data } })
      }
      contentParts.push({ type: 'text', text: message || 'Что на этом изображении?' })
      userContent = contentParts
    } else if (hasImages && !isPremium) {
      return new Response(JSON.stringify({ 
        error: 'Анализ изображений доступен только для Premium' 
      }), { status: 403 })
    }

    if (mode === 'thinking') {
      systemPrompt = THINKING_PROMPT.replace(/Zenith Sync 3\.0/g, botName)
    } else if (mode === 'search') {
      systemPrompt = SEARCH_PROMPT.replace(/Zenith Sync 3\.0/g, botName)
      const searchData = await searchWeb(message)
      searchResults = searchData.results
      
      if (searchResults.length > 0) {
        const searchContext = searchResults.map((r, i) => 
          `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.content}`
        ).join('\n\n')
        userContent = `Запрос: ${message}\n\nРезультаты поиска:\n${searchContext}`
      } else {
        userContent = `Запрос: ${message}\n\nПоиск не дал результатов. Ответь на основе своих знаний.`
      }
    }

    const messages: any[] = [
      { role: 'system', content: systemPrompt },
      ...(history || []).map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user', content: userContent },
    ]

    // Попытка с ротацией ключей
    let lastError: any = null
    for (let attempt = 0; attempt < Math.min(GROQ_KEYS.length, 3); attempt++) {
      try {
        const groq = getNextGroqClient()
        
        const stream = await groq.chat.completions.create({
          model,
          messages,
          temperature: mode === 'thinking' ? 0.3 : 0.7,
          max_tokens: mode === 'thinking' ? 2000 : 1500,
          stream: true,
        })

        const encoder = new TextEncoder()
        const readable = new ReadableStream({
          async start(controller) {
            try {
              if (mode === 'search' && searchResults.length > 0) {
                const sources = searchResults.map(r => ({ title: r.title, url: r.url }))
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ sources })}\n\n`))
              }
              
              let fullContent = ''
              
              for await (const chunk of stream) {
                const content = chunk.choices[0]?.delta?.content || ''
                if (content) {
                  fullContent += content
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`))
                }
              }
              
              const imageMatch = fullContent.match(/\[GENERATE_IMAGE:\s*(.+?)\]/)
              if (imageMatch) {
                const imagePrompt = imageMatch[1].trim()
                const imageUrl = await generateImage(imagePrompt)
                if (imageUrl) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ generatedImage: imageUrl })}\n\n`))
                }
              }
              
              controller.enqueue(encoder.encode('data: [DONE]\n\n'))
              controller.close()
            } catch (error) {
              controller.error(error)
            }
          },
        })

        return new Response(readable, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        })
      } catch (error: any) {
        lastError = error
        if (error?.status === 429 || error?.message?.includes('rate limit')) {
          markKeyFailed()
          continue
        }
        throw error
      }
    }

    throw lastError || new Error('All API keys exhausted')
  } catch (error: unknown) {
    console.error('Groq API error:', error)
    return new Response(JSON.stringify({ error: 'Ошибка генерации. Попробуй позже.' }), { status: 500 })
  }
}
