import { NextRequest, NextResponse } from 'next/server'

// Используем бесплатный TTS API от StreamElements
export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json()

    if (!text) {
      return NextResponse.json({ error: 'Текст пустой' }, { status: 400 })
    }

    // StreamElements TTS API (бесплатный)
    const voice = 'Maxim' // Русский мужской голос
    const encodedText = encodeURIComponent(text.slice(0, 500)) // Лимит 500 символов
    const url = `https://api.streamelements.com/kappa/v2/speech?voice=${voice}&text=${encodedText}`

    const response = await fetch(url)
    
    if (!response.ok) {
      throw new Error('TTS API error')
    }

    const audioBuffer = await response.arrayBuffer()
    
    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
      },
    })
  } catch (error) {
    console.error('TTS error:', error)
    return NextResponse.json(
      { error: 'Ошибка озвучки' },
      { status: 500 }
    )
  }
}
