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
}

async function searchWeb(query: string): Promise<{ results: TavilyResult[], error?: string }> {
  if (!process.env.TAVILY_API_KEY) {
    return { results: [], error: 'Tavily API key not configured' }
  }
  
  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query,
        search_depth: 'basic',
        max_results: 5,
        include_answer: false,
      }),
    })
    
    if (!response.ok) {
      return { results: [], error: 'Search failed' }
    }
    
    const data: TavilyResponse = await response.json()
    return { results: data.results || [] }
  } catch {
    return { results: [], error: 'Search error' }
  }
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
    const { message, history, mode } = await request.json()

    if (!message) {
      return new Response(JSON.stringify({ error: 'Сообщение пустое' }), { status: 400 })
    }

    if (!process.env.GROQ_API_KEY) {
      return new Response(JSON.stringify({ error: 'API ключ не настроен' }), { status: 500 })
    }

    let systemPrompt = SYSTEM_PROMPT
    let userContent = message
    let searchResults: TavilyResult[] = []

    if (mode === 'thinking') {
      systemPrompt = THINKING_PROMPT
    } else if (mode === 'search') {
      systemPrompt = SEARCH_PROMPT
      
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
      model: 'llama-3.3-70b-versatile',
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
