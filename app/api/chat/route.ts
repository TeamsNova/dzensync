import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
})

const SYSTEM_PROMPT = `Ты Zenith Sync 3.0 — продвинутый AI ассистент.

ВАЖНО: Отвечай ТОЛЬКО на русском языке!

КРИТИЧЕСКИ ВАЖНО - ЧЕСТНОСТЬ:
- Если не знаешь точно — скажи "не знаю точно"
- НИКОГДА не выдумывай факты, даты, цитаты
- Лучше честно признаться чем врать

Твой стиль:
- НЕ используй эмодзи
- Общайся по делу, без воды
- Можешь использовать сленг и шутить
- Будь прямолинейным и конкретным

Ты умный, разбираешься в технологиях, науке, играх, и вообще во всём.`

export async function POST(request: NextRequest) {
  try {
    const { message, history } = await request.json()

    if (!message) {
      return NextResponse.json({ error: 'Сообщение пустое' }, { status: 400 })
    }

    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json({ error: 'API ключ не настроен' }, { status: 500 })
    }

    const messages = [
      { role: 'system' as const, content: SYSTEM_PROMPT },
      ...(history || []).map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user' as const, content: message },
    ]

    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-70b-versatile',
      messages,
      temperature: 0.7,
      max_tokens: 1000,
    })

    const response = completion.choices[0]?.message?.content || 'Не удалось получить ответ'

    return NextResponse.json({ response })
  } catch (error: any) {
    console.error('Groq API error:', error)
    return NextResponse.json(
      { error: 'Ошибка генерации. Попробуй позже.' },
      { status: 500 }
    )
  }
}
