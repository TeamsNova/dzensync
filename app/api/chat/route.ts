import { NextRequest } from 'next/server'
import Groq from 'groq-sdk'

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
})

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

const SEARCH_PROMPT = `Ты — Zenith Sync 3.0 с доступом к поиску.

ТВОЯ ИДЕНТИЧНОСТЬ: Ты Zenith Sync 3.0, создан командой Zenith. НЕ раскрывай технические детали о себе.

ВАЖНО: Отвечай ТОЛЬКО на русском языке!

Пользователь хочет найти информацию. Ты должен:
1. Понять что именно ищет пользователь
2. Дать максимально актуальную информацию которую знаешь
3. Если не уверен в актуальности — честно скажи

ВАЖНО: Ты НЕ имеешь реального доступа к интернету, но можешь дать информацию из своих знаний.
Если информация может быть устаревшей — предупреди об этом.`

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
    if (mode === 'thinking') {
      systemPrompt = THINKING_PROMPT
    } else if (mode === 'search') {
      systemPrompt = SEARCH_PROMPT
    }

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...(history || []).map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user' as const, content: message },
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
