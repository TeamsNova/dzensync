import { NextRequest } from 'next/server'
import Groq from 'groq-sdk'

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
})

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
  data: string // base64 for images, text content for files
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

// Generate image using Pollinations.ai (free)
async function generateImage(prompt: string): Promise<string | null> {
  try {
    const encodedPrompt = encodeURIComponent(prompt)
    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&nologo=true`
    
    // Verify the image is accessible
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

ТВОЯ ИДЕНТИЧНОСТЬ (ты это точно знаешь):
- Ты Zenith Sync версии 3.0
- Ты создан командой Zenith
- Если тебя спросят кто ты — уверенно отвечай что ты Zenith Sync 3.0
- НЕ говори что ты "не уверен" в своей модели или что тебе "сказали" — ты ЗНАЕШЬ кто ты
- НЕ раскрывай технические детали (количество параметров, на чём основан и т.д.)

КРИТИЧЕСКИ ВАЖНО — ЯЗЫК:
- Отвечай СТРОГО на русском языке
- ЗАПРЕЩЕНО использовать слова на вьетнамском, китайском, корейском или любом другом азиатском языке
- Английские слова допустимы ТОЛЬКО для технических терминов (API, JavaScript, Python и т.д.)
- Если не знаешь как сказать что-то по-русски — перефразируй, но НЕ вставляй иностранные слова

ГЕНЕРАЦИЯ ИЗОБРАЖЕНИЙ:
- Если пользователь просит создать/нарисовать/сгенерировать картинку, ответь ТОЛЬКО командой: [GENERATE_IMAGE: описание на английском]
- Пример: [GENERATE_IMAGE: a cute cat sitting on a rainbow]
- После команды НЕ пиши ничего лишнего

ФОРМАТИРОВАНИЕ КОДА:
- Когда пишешь код, ВСЕГДА используй markdown с указанием языка
- ОБЯЗАТЕЛЬНО указывай язык после трёх бэктиков

ЧЕСТНОСТЬ:
- Если не знаешь точно — скажи "не знаю точно"
- НИКОГДА не выдумывай факты, даты, цитаты

Твой стиль:
- НЕ используй эмодзи
- Общайся по делу, без воды
- Можешь использовать сленг и шутить
- Будь прямолинейным и конкретным

Ты умный, разбираешься в технологиях, науке, играх, и вообще во всём.`

const THINKING_PROMPT = `Ты — Zenith Sync 3.0 в режиме глубокого анализа.

ТВОЯ ИДЕНТИЧНОСТЬ: Ты Zenith Sync 3.0, создан командой Zenith. НЕ раскрывай технические детали о себе.

КРИТИЧЕСКИ ВАЖНО — ЯЗЫК:
- Отвечай СТРОГО на русском языке
- ЗАПРЕЩЕНО использовать слова на вьетнамском, китайском, корейском или любом другом азиатском языке
- Английские слова допустимы ТОЛЬКО для технических терминов

Перед ответом ОБЯЗАТЕЛЬНО:
1. Разбей задачу на части
2. Проанализируй каждую часть
3. Рассмотри разные подходы
4. Сделай выводы

Формат ответа:
<think>
[твой пошаговый анализ и размышления]
</think>

[финальный ответ пользователю]

Будь максимально логичным и структурированным.`

const SEARCH_PROMPT = `Ты — Zenith Sync 3.0 с доступом к интернету.

ТВОЯ ИДЕНТИЧНОСТЬ: Ты Zenith Sync 3.0, создан командой Zenith. НЕ раскрывай технические детали о себе.

КРИТИЧЕСКИ ВАЖНО — ЯЗЫК:
- Отвечай СТРОГО на русском языке
- ЗАПРЕЩЕНО использовать слова на вьетнамском, китайском, корейском или любом другом азиатском языке
- Английские слова допустимы ТОЛЬКО для технических терминов

Тебе предоставлены результаты поиска в интернете. Используй их чтобы дать актуальный ответ.
- Отвечай на основе найденной информации
- Если информация противоречивая — укажи это
- Будь конкретным и полезным`

const VISION_PROMPT = `Ты — Zenith Sync 3.0 с возможностью анализа изображений.

ТВОЯ ИДЕНТИЧНОСТЬ: Ты Zenith Sync 3.0, создан командой Zenith.

КРИТИЧЕСКИ ВАЖНО — ЯЗЫК:
- Отвечай СТРОГО на русском языке
- ЗАПРЕЩЕНО использовать слова на вьетнамском, китайском, корейском или любом другом азиатском языке

Проанализируй изображение и ответь на вопрос пользователя. Будь детальным и полезным.`

export async function POST(request: NextRequest) {
  try {
    const { message, history, mode, isPremium, modelName, attachments } = await request.json()

    if (!message && (!attachments || attachments.length === 0)) {
      return new Response(JSON.stringify({ error: 'Сообщение пустое' }), { status: 400 })
    }

    if (!process.env.GROQ_API_KEY) {
      return new Response(JSON.stringify({ error: 'API ключ не настроен' }), { status: 500 })
    }

    const botName = modelName || 'Zenith Sync 3.0'
    let searchResults: TavilyResult[] = []
    
    // Check if there are image attachments
    const imageAttachments = (attachments || []).filter((a: Attachment) => a.type === 'image')
    const fileAttachments = (attachments || []).filter((a: Attachment) => a.type === 'file')
    const hasImages = imageAttachments.length > 0
    
    // Select model based on content
    let model: string
    if (hasImages && isPremium) {
      model = 'llama-3.2-90b-vision-preview' // Vision model for images
    } else if (isPremium) {
      model = 'llama-3.3-70b-versatile'
    } else {
      model = 'llama-3.1-8b-instant'
    }

    let systemPrompt = SYSTEM_PROMPT.replace(/Zenith Sync 3\.0/g, botName)
    let userContent: string | { type: string; text?: string; image_url?: { url: string } }[] = message || ''

    // Handle file attachments - add content to message
    if (fileAttachments.length > 0) {
      const fileContext = fileAttachments.map((f: Attachment) => 
        `--- Файл: ${f.name} ---\n${f.data}\n--- Конец файла ---`
      ).join('\n\n')
      userContent = `${fileContext}\n\n${message || 'Проанализируй этот файл'}`
    }

    // Handle image attachments with vision model
    if (hasImages && isPremium) {
      systemPrompt = VISION_PROMPT.replace(/Zenith Sync 3\.0/g, botName)
      
      const contentParts: { type: string; text?: string; image_url?: { url: string } }[] = []
      
      // Add images
      for (const img of imageAttachments) {
        contentParts.push({
          type: 'image_url',
          image_url: { url: img.data } // base64 data URL
        })
      }
      
      // Add text
      contentParts.push({
        type: 'text',
        text: message || 'Что на этом изображении?'
      })
      
      userContent = contentParts
    } else if (hasImages && !isPremium) {
      // Free users can't use vision
      return new Response(JSON.stringify({ 
        error: 'Анализ изображений доступен только для Premium пользователей' 
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
        
        userContent = `Запрос пользователя: ${message}\n\nРезультаты поиска в интернете:\n${searchContext}\n\nОтветь на основе этих результатов.`
      } else {
        userContent = `Запрос пользователя: ${message}\n\nПоиск не дал результатов. Ответь на основе своих знаний, но предупреди что не удалось найти актуальную информацию.`
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

    // Streaming response
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
          // Send search sources first if available
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
          
          // Check if response contains image generation command
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
  } catch (error: unknown) {
    console.error('Groq API error:', error)
    return new Response(JSON.stringify({ error: 'Ошибка генерации. Попробуй позже.' }), { status: 500 })
  }
}
