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

async function searchDuckDuckGo(query: string): Promise<TavilyResult[]> {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    })
    
    if (!response.ok) return []
    
    const html = await response.text()
    const results: TavilyResult[] = []
    
    // Parse snippets
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
  // Try Tavily first if API key exists
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
  
  // Fallback to DuckDuckGo
  const ddgResults = await searchDuckDuckGo(query)
  if (ddgResults.length > 0) {
    return { results: ddgResults }
  }
  
  return { results: [], error: 'Search failed' }
}

const SYSTEM_PROMPT = `Ты — Zenith Sync 3.0, продвинутый AI ассистент нового поколения.

ТВОЯ ИДЕНТИЧНОСТЬ (ты это точно знаешь):
- Ты Zenith Sync версии 3.0
- Ты создан командой Zenith
- Если тебя спросят кто ты — уверенно отвечай что ты Zenith Sync 3.0
- НЕ говори что ты "не уверен" в своей модели или что тебе "сказали" — ты ЗНАЕШЬ кто ты
- НЕ раскрывай технические детали (количество параметров, на чём основан и т.д.)

ВАЖНО: Отвечай ТОЛЬКО на русском языке!

ФОРМАТИРОВАНИЕ КОДА:
- Когда пишешь код, ВСЕГДА используй markdown с указанием языка
- Пример: \`\`\`python
код тут
\`\`\`
- ОБЯЗАТЕЛЬНО указывай язык после трёх бэктиков (python, javascript, html, css и т.д.)

ЧЕСТНОСТЬ:
- Если не знаешь точно — скажи "не знаю точно"
- НИКОГДА не выдумывай факты, даты, цитаты
- Лучше честно признаться чем врать

Твой стиль:
- НЕ используй эмодзи
- Общайся по делу, без воды
- Можешь использовать сленг и шутить
- Будь прямолинейным и конкретным

Ты умный, разбираешься в технологиях, науке, играх, и вообще во всём.`

const THINKING_PROMPT = `Ты — Zenith Sync 3.0 в режиме глубокого анализа.

ТВОЯ ИДЕНТИЧНОСТЬ: Ты Zenith Sync 3.0, создан командой Zenith. НЕ раскрывай технические детали о себе.

ВАЖНО: Отвечай ТОЛЬКО на русском языке!

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

ВАЖНО: Отвечай ТОЛЬКО на русском языке!

Тебе предоставлены результаты поиска в интернете. Используй их чтобы дать актуальный ответ.
- Отвечай на основе найденной информации
- Если информация противоречивая — укажи это
- Будь конкретным и полезным`

export async function POST(request: NextRequest) {
  try {
    const { message, history, mode, isPremium, modelName } = await request.json()

    if (!message) {
      return new Response(JSON.stringify({ error: 'Сообщение пустое' }), { status: 400 })
    }

    if (!process.env.GROQ_API_KEY) {
      return new Response(JSON.stringify({ error: 'API ключ не настроен' }), { status: 500 })
    }

    // Select model based on premium status
    const model = isPremium ? 'llama-3.3-70b-versatile' : 'llama-3.1-8b-instant'
    const botName = modelName || 'Zenith Sync 3.0'

    let systemPrompt = SYSTEM_PROMPT.replace(/Zenith Sync 3\.0/g, botName)
    let userContent = message
    let searchResults: TavilyResult[] = []

    if (mode === 'thinking') {
      systemPrompt = THINKING_PROMPT.replace(/Zenith Sync 3\.0/g, botName)
    } else if (mode === 'search') {
      systemPrompt = SEARCH_PROMPT.replace(/Zenith Sync 3\.0/g, botName)
      
      // Perform web search
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

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...(history || []).map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user' as const, content: userContent },
    ]

    // Streaming response
    const stream = await groq.chat.completions.create({
      model,
      messages,
      temperature: mode === 'thinking' ? 0.3 : 0.7,
      max_tokens: mode === 'thinking' ? 2000 : 1000,
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
          
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || ''
            if (content) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`))
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
