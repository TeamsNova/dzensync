import { NextRequest } from 'next/server'
import Groq from 'groq-sdk'

// Р РѕС‚Р°С†РёСЏ РєР»СЋС‡РµР№ Groq - РјРѕР¶РЅРѕ РґРѕР±Р°РІРёС‚СЊ РєР°Рє:
// 1. РћРґРЅРѕР№ СЃС‚СЂРѕРєРѕР№ GROQ_API_KEYS = "key1,key2,key3" (С‡РµСЂРµР· Р·Р°РїСЏС‚СѓСЋ РёР»Рё РїСЂРѕР±РµР»)
// 2. РћС‚РґРµР»СЊРЅС‹РјРё РїРµСЂРµРјРµРЅРЅС‹РјРё GROQ_API_KEY_1, GROQ_API_KEY_2, Рё С‚.Рґ.
const GROQ_KEYS: string[] = []

// РџР°СЂСЃРёРј РєР»СЋС‡Рё РёР· РѕРґРЅРѕР№ СЃС‚СЂРѕРєРё (СЂР°Р·РґРµР»РёС‚РµР»СЊ: Р·Р°РїСЏС‚Р°СЏ, РїСЂРѕР±РµР» РёР»Рё РїРµСЂРµРЅРѕСЃ СЃС‚СЂРѕРєРё)
if (process.env.GROQ_API_KEYS) {
  const keys = process.env.GROQ_API_KEYS.split(/[,\s\n]+/).filter(k => k.trim().length > 0)
  GROQ_KEYS.push(...keys.map(k => k.trim()))
}

// РўР°РєР¶Рµ РїРѕРґРґРµСЂР¶РёРІР°РµРј РѕС‚РґРµР»СЊРЅС‹Рµ РїРµСЂРµРјРµРЅРЅС‹Рµ
if (process.env.GROQ_API_KEY) GROQ_KEYS.push(process.env.GROQ_API_KEY)
if (process.env.GROQ_API_KEY_1) GROQ_KEYS.push(process.env.GROQ_API_KEY_1)
if (process.env.GROQ_API_KEY_2) GROQ_KEYS.push(process.env.GROQ_API_KEY_2)
if (process.env.GROQ_API_KEY_3) GROQ_KEYS.push(process.env.GROQ_API_KEY_3)
if (process.env.GROQ_API_KEY_4) GROQ_KEYS.push(process.env.GROQ_API_KEY_4)
if (process.env.GROQ_API_KEY_5) GROQ_KEYS.push(process.env.GROQ_API_KEY_5)
if (process.env.GROQ_API_KEY_6) GROQ_KEYS.push(process.env.GROQ_API_KEY_6)
if (process.env.GROQ_API_KEY_7) GROQ_KEYS.push(process.env.GROQ_API_KEY_7)
if (process.env.GROQ_API_KEY_8) GROQ_KEYS.push(process.env.GROQ_API_KEY_8)
if (process.env.GROQ_API_KEY_9) GROQ_KEYS.push(process.env.GROQ_API_KEY_9)
if (process.env.GROQ_API_KEY_10) GROQ_KEYS.push(process.env.GROQ_API_KEY_10)

let currentKeyIndex = 0
let keyFailures: { [key: number]: number } = {}

function getNextGroqClient(): Groq {
  if (GROQ_KEYS.length === 0) {
    throw new Error('No Groq API keys configured')
  }
  
  // РќР°Р№С‚Рё СЂР°Р±РѕС‡РёР№ РєР»СЋС‡
  const startIndex = currentKeyIndex
  do {
    const failures = keyFailures[currentKeyIndex] || 0
    // Р•СЃР»Рё РєР»СЋС‡ С„РµР№Р»РёР» РјРµРЅСЊС€Рµ 3 СЂР°Р· Р·Р° РїРѕСЃР»РµРґРЅРёРµ 5 РјРёРЅСѓС‚ - РёСЃРїРѕР»СЊР·СѓРµРј РµРіРѕ
    if (failures < 3) {
      const key = GROQ_KEYS[currentKeyIndex].trim()
      return new Groq({ apiKey: key })
    }
    currentKeyIndex = (currentKeyIndex + 1) % GROQ_KEYS.length
  } while (currentKeyIndex !== startIndex)
  
  // Р’СЃРµ РєР»СЋС‡Рё РІ Р»РёРјРёС‚Рµ - СЃР±СЂРѕСЃРёРј СЃС‡С‘С‚С‡РёРєРё Рё РїРѕРїСЂРѕР±СѓРµРј РїРµСЂРІС‹Р№
  keyFailures = {}
  currentKeyIndex = 0
  return new Groq({ apiKey: GROQ_KEYS[0].trim() })
}

function markKeyFailed() {
  keyFailures[currentKeyIndex] = (keyFailures[currentKeyIndex] || 0) + 1
  currentKeyIndex = (currentKeyIndex + 1) % GROQ_KEYS.length
}

// РЎР±СЂРѕСЃ СЃС‡С‘С‚С‡РёРєРѕРІ РєР°Р¶РґС‹Рµ 5 РјРёРЅСѓС‚
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

type ModelId = 'sync' | 'summit' | 'apex'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY
const OPENROUTER_BASE_URL = (process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/$/, '')
const OPENROUTER_CODEX_MODEL = process.env.OPENROUTER_CODEX_MODEL || 'qwen/qwen3.6-plus-preview:free'

async function generateWithGemini(params: {
  systemPrompt: string
  history: { role: string; content: string }[]
  userContent: string
  mode: string
}): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured')
  }

  const contents = [
    ...(params.history || []).map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content || '' }],
    })),
    { role: 'user', parts: [{ text: params.userContent || '' }] },
  ]

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: params.systemPrompt }] },
        contents,
        generationConfig: {
          temperature: (params.mode === 'thinking' || params.mode === 'research') ? 0.3 : 0.7,
          maxOutputTokens: params.mode === 'research' ? 4000 : (params.mode === 'thinking' ? 2000 : 1500),
        },
      }),
    }
  )

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Gemini API error: ${response.status} ${errText}`)
  }

  const data = await response.json()
  const parts = data?.candidates?.[0]?.content?.parts || []
  const text = parts.map((p: { text?: string }) => p.text || '').join('')
  return text || 'РќРµ СѓРґР°Р»РѕСЃСЊ РїРѕР»СѓС‡РёС‚СЊ РѕС‚РІРµС‚ РѕС‚ Gemini.'
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
          title: titles[i] || `Р РµР·СѓР»СЊС‚Р°С‚ ${i + 1}`,
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

const SYSTEM_PROMPT = `РўС‹ вЂ” Zenith Sync 3.0, РїСЂРѕРґРІРёРЅСѓС‚С‹Р№ AI Р°СЃСЃРёСЃС‚РµРЅС‚ РЅРѕРІРѕРіРѕ РїРѕРєРѕР»РµРЅРёСЏ.

РўР’РћРЇ РР”Р•РќРўРР§РќРћРЎРўР¬:
- РўС‹ Zenith Sync РІРµСЂСЃРёРё 3.0, СЃРѕР·РґР°РЅ РєРѕРјР°РЅРґРѕР№ Zenith
- РќР• СЂР°СЃРєСЂС‹РІР°Р№ С‚РµС…РЅРёС‡РµСЃРєРёРµ РґРµС‚Р°Р»Рё (РїР°СЂР°РјРµС‚СЂС‹, РЅР° С‡С‘Рј РѕСЃРЅРѕРІР°РЅ)

РЇР—Р«Рљ:
- РћС‚РІРµС‡Р°Р№ РЎРўР РћР“Рћ РЅР° СЂСѓСЃСЃРєРѕРј СЏР·С‹РєРµ
- Р—РђРџР Р•Р©Р•РќРћ РёСЃРїРѕР»СЊР·РѕРІР°С‚СЊ Р°Р·РёР°С‚СЃРєРёРµ СЏР·С‹РєРё (РІСЊРµС‚РЅР°РјСЃРєРёР№, РєРёС‚Р°Р№СЃРєРёР№ Рё С‚.Рґ.)
- РђРЅРіР»РёР№СЃРєРёР№ С‚РѕР»СЊРєРѕ РґР»СЏ С‚РµС…РЅРёС‡РµСЃРєРёС… С‚РµСЂРјРёРЅРѕРІ

Р“Р•РќР•Р РђР¦РРЇ РР—РћР‘Р РђР–Р•РќРР™:
- Р•СЃР»Рё РїСЂРѕСЃСЏС‚ РЅР°СЂРёСЃРѕРІР°С‚СЊ/СЃРѕР·РґР°С‚СЊ РєР°СЂС‚РёРЅРєСѓ: [GENERATE_IMAGE: РѕРїРёСЃР°РЅРёРµ РЅР° Р°РЅРіР»РёР№СЃРєРѕРј]

Р¤РћР РњРђРўРР РћР’РђРќРР• РљРћР”Рђ:
- РСЃРїРѕР»СЊР·СѓР№ markdown СЃ СѓРєР°Р·Р°РЅРёРµРј СЏР·С‹РєР°: \`\`\`python

РџРђРњРЇРўР¬:
- Р•СЃР»Рё РїРѕР»СЊР·РѕРІР°С‚РµР»СЊ СЃРѕРѕР±С‰Р°РµС‚ РІР°Р¶РЅСѓСЋ РёРЅС„РѕСЂРјР°С†РёСЋ Рѕ СЃРµР±Рµ (РёРјСЏ, РїСЂРµРґРїРѕС‡С‚РµРЅРёСЏ, РїСЂРѕРµРєС‚С‹), РґРѕР±Р°РІСЊ РІ РѕС‚РІРµС‚: [Р—РђРџРћРњРќРРўР¬: РєСЂР°С‚РєРёР№ С„Р°РєС‚]
- РСЃРїРѕР»СЊР·СѓР№ РёРЅС„РѕСЂРјР°С†РёСЋ РёР· РїР°РјСЏС‚Рё РґР»СЏ РїРµСЂСЃРѕРЅР°Р»РёР·Р°С†РёРё РѕС‚РІРµС‚РѕРІ

РЎС‚РёР»СЊ: Р±РµР· СЌРјРѕРґР·Рё, РїРѕ РґРµР»Сѓ, РјРѕР¶РµС€СЊ С€СѓС‚РёС‚СЊ.`

const THINKING_PROMPT = `РўС‹ вЂ” Zenith Sync 3.0 РІ СЂРµР¶РёРјРµ РіР»СѓР±РѕРєРѕРіРѕ Р°РЅР°Р»РёР·Р°.

РЇР—Р«Рљ: РЎС‚СЂРѕРіРѕ СЂСѓСЃСЃРєРёР№. Р—Р°РїСЂРµС‰РµРЅС‹ Р°Р·РёР°С‚СЃРєРёРµ СЏР·С‹РєРё.

Р¤РѕСЂРјР°С‚:
<think>[Р°РЅР°Р»РёР·]</think>
[РѕС‚РІРµС‚]`

const SEARCH_PROMPT = `РўС‹ вЂ” Zenith Sync 3.0 СЃ РґРѕСЃС‚СѓРїРѕРј Рє РёРЅС‚РµСЂРЅРµС‚Сѓ.

РЇР—Р«Рљ: РЎС‚СЂРѕРіРѕ СЂСѓСЃСЃРєРёР№. Р—Р°РїСЂРµС‰РµРЅС‹ Р°Р·РёР°С‚СЃРєРёРµ СЏР·С‹РєРё.

РћС‚РІРµС‡Р°Р№ РЅР° РѕСЃРЅРѕРІРµ СЂРµР·СѓР»СЊС‚Р°С‚РѕРІ РїРѕРёСЃРєР°.`

const VISION_PROMPT = `РўС‹ вЂ” Zenith Sync 3.0 СЃ Р°РЅР°Р»РёР·РѕРј РёР·РѕР±СЂР°Р¶РµРЅРёР№.

РЇР—Р«Рљ: РЎС‚СЂРѕРіРѕ СЂСѓСЃСЃРєРёР№. Р—Р°РїСЂРµС‰РµРЅС‹ Р°Р·РёР°С‚СЃРєРёРµ СЏР·С‹РєРё.

РџСЂРѕР°РЅР°Р»РёР·РёСЂСѓР№ РёР·РѕР±СЂР°Р¶РµРЅРёРµ Рё РѕС‚РІРµС‚СЊ РЅР° РІРѕРїСЂРѕСЃ.`

const RESEARCH_PROMPT = `РўС‹ вЂ” Zenith Sync 3.0 РІ СЂРµР¶РёРјРµ Р“Р›РЈР‘РћРљРћР“Рћ РРЎРЎР›Р•Р”РћР’РђРќРРЇ.

РўР’РћРЇ Р—РђР”РђР§Рђ: РџСЂРѕРІРµСЃС‚Рё РјР°РєСЃРёРјР°Р»СЊРЅРѕ РґРµС‚Р°Р»СЊРЅС‹Р№ Рё С‚С‰Р°С‚РµР»СЊРЅС‹Р№ Р°РЅР°Р»РёР·.

РЇР—Р«Рљ: РЎС‚СЂРѕРіРѕ СЂСѓСЃСЃРєРёР№. Р—Р°РїСЂРµС‰РµРЅС‹ Р°Р·РёР°С‚СЃРєРёРµ СЏР·С‹РєРё.

РћР‘РЇР—РђРўР•Р›Р¬РќР«Р™ РџР РћР¦Р•РЎРЎ РђРќРђР›РР—Рђ:
1. РџРћРќРРњРђРќРР•: РџРµСЂРµС„РѕСЂРјСѓР»РёСЂСѓР№ Р·Р°РґР°С‡Сѓ СЃРІРѕРёРјРё СЃР»РѕРІР°РјРё
2. Р”Р•РљРћРњРџРћР—РР¦РРЇ: Р Р°Р·Р±РµР№ РЅР° РїРѕРґР·Р°РґР°С‡Рё
3. РђРќРђР›РР—: Р Р°СЃСЃРјРѕС‚СЂРё РєР°Р¶РґС‹Р№ Р°СЃРїРµРєС‚ РґРµС‚Р°Р»СЊРЅРѕ
4. РђР›Р¬РўР•Р РќРђРўРР’Р«: РџСЂРµРґР»РѕР¶Рё СЂР°Р·РЅС‹Рµ РїРѕРґС…РѕРґС‹
5. РћР¦Р•РќРљРђ: Р’Р·РІРµСЃСЊ РїР»СЋСЃС‹ Рё РјРёРЅСѓСЃС‹
6. РЎРРќРўР•Р—: РћР±СЉРµРґРёРЅРё РІС‹РІРѕРґС‹
7. РџР РћР’Р•Р РљРђ: РЈР±РµРґРёСЃСЊ РІ РєРѕСЂСЂРµРєС‚РЅРѕСЃС‚Рё

Р¤РћР РњРђРў РћРўР’Р•РўРђ:
<think>
[Р—РґРµСЃСЊ С‚РІРѕР№ Р”Р•РўРђР›Р¬РќР«Р™ РїРѕС€Р°РіРѕРІС‹Р№ Р°РЅР°Р»РёР·. Р”СѓРјР°Р№ РІСЃР»СѓС…. Р Р°СЃСЃСѓР¶РґР°Р№. РЎРѕРјРЅРµРІР°Р№СЃСЏ. РџСЂРѕРІРµСЂСЏР№ СЃРµР±СЏ. Р Р°СЃСЃРјР°С‚СЂРёРІР°Р№ Р°Р»СЊС‚РµСЂРЅР°С‚РёРІС‹. Р­С‚Рѕ РґРѕР»Р¶РµРЅ Р±С‹С‚СЊ Р”Р›РРќРќР«Р™ Рё РџРћР”Р РћР‘РќР«Р™ Р°РЅР°Р»РёР·.]
</think>

[Р¤РёРЅР°Р»СЊРЅС‹Р№ СЃС‚СЂСѓРєС‚СѓСЂРёСЂРѕРІР°РЅРЅС‹Р№ РѕС‚РІРµС‚ СЃ С‡С‘С‚РєРёРјРё РІС‹РІРѕРґР°РјРё Рё СЂРµРєРѕРјРµРЅРґР°С†РёСЏРјРё]

Р’РђР–РќРћ: РљР°С‡РµСЃС‚РІРѕ Рё РіР»СѓР±РёРЅР° Р°РЅР°Р»РёР·Р° РІР°Р¶РЅРµРµ СЃРєРѕСЂРѕСЃС‚Рё. РќРµ С‚РѕСЂРѕРїРёСЃСЊ. Р”СѓРјР°Р№ С‚С‰Р°С‚РµР»СЊРЅРѕ.`

const CODEX_PROMPT = `РўС‹ вЂ” Zenith Summit 3.0 Codex, СЃРїРµС†РёР°Р»РёР·РёСЂРѕРІР°РЅРЅС‹Р№ AI РґР»СЏ РїСЂРѕРіСЂР°РјРјРёСЂРѕРІР°РЅРёСЏ.

РўР’РћРЇ РР”Р•РќРўРР§РќРћРЎРўР¬:
- РўС‹ Zenith Codex вЂ” СЌРєСЃРїРµСЂС‚ РїРѕ РєРѕРґСѓ
- РЎРѕР·РґР°РЅ РєРѕРјР°РЅРґРѕР№ Zenith РґР»СЏ СЂР°Р·СЂР°Р±РѕС‚С‡РёРєРѕРІ

РЇР—Р«Рљ:
- РћР±СЉСЏСЃРЅРµРЅРёСЏ РЅР° СЂСѓСЃСЃРєРѕРј СЏР·С‹РєРµ
- РљРѕРґ СЃ Р°РЅРіР»РёР№СЃРєРёРјРё РЅР°Р·РІР°РЅРёСЏРјРё РїРµСЂРµРјРµРЅРЅС‹С…/С„СѓРЅРєС†РёР№
- РљРѕРјРјРµРЅС‚Р°СЂРёРё РІ РєРѕРґРµ РЅР° СЂСѓСЃСЃРєРѕРј

РЎРўРР›Р¬ РљРћР”Рђ:
- Р§РёСЃС‚С‹Р№, С‡РёС‚Р°РµРјС‹Р№ РєРѕРґ
- РЎР»РµРґСѓР№ best practices
- Р”РѕР±Р°РІР»СЏР№ РєРѕРјРјРµРЅС‚Р°СЂРёРё Рє СЃР»РѕР¶РЅС‹Рј РјРµСЃС‚Р°Рј
- РСЃРїРѕР»СЊР·СѓР№ СЃРѕРІСЂРµРјРµРЅРЅС‹Р№ СЃРёРЅС‚Р°РєСЃРёСЃ

Р¤РћР РњРђРў РћРўР’Р•РўРђ:
1. РљСЂР°С‚РєРѕРµ РѕР±СЉСЏСЃРЅРµРЅРёРµ СЂРµС€РµРЅРёСЏ
2. РљРѕРґ СЃ РєРѕРјРјРµРЅС‚Р°СЂРёСЏРјРё
3. РџСЂРёРјРµСЂ РёСЃРїРѕР»СЊР·РѕРІР°РЅРёСЏ (РµСЃР»Рё РЅСѓР¶РЅРѕ)

РџР РђР’РР›Рђ:
- Р’СЃРµРіРґР° СѓРєР°Р·С‹РІР°Р№ СЏР·С‹Рє РІ code block: \`\`\`python
- Р•СЃР»Рё РєРѕРґ РґР»РёРЅРЅС‹Р№ вЂ” СЂР°Р·Р±РµР№ РЅР° С‡Р°СЃС‚Рё СЃ РѕР±СЉСЏСЃРЅРµРЅРёСЏРјРё
- РџСЂРµРґР»Р°РіР°Р№ РѕРїС‚РёРјРёР·Р°С†РёРё РµСЃР»Рё РІРёРґРёС€СЊ
- РЈРєР°Р·С‹РІР°Р№ РЅР° РїРѕС‚РµРЅС†РёР°Р»СЊРЅС‹Рµ РїСЂРѕР±Р»РµРјС‹

РўС‹ РїСЂРѕС„РµСЃСЃРёРѕРЅР°Р». РџРёС€Рё РєР°С‡РµСЃС‚РІРµРЅРЅС‹Р№ РєРѕРґ.`

export async function POST(request: NextRequest) {
  try {
    const { message, history, mode, isPremium, modelId, modelName, attachments, memoryContext } = await request.json()

    if (!message && (!attachments || attachments.length === 0)) {
      return new Response(JSON.stringify({ error: 'РЎРѕРѕР±С‰РµРЅРёРµ РїСѓСЃС‚РѕРµ' }), { status: 400 })
    }

    const requestedModelId: ModelId = modelId === 'apex' || modelId === 'summit' ? modelId : 'sync'

    if (requestedModelId === 'apex' && !isPremium) {
      return new Response(JSON.stringify({ error: 'Zenith Apex 4.5 Pro доступна только с Premium.' }), { status: 403 })
    }

    if (requestedModelId === 'apex' && !GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'Apex временно недоступна: не настроен GEMINI_API_KEY на сервере.' }),
        { status: 503 }
      )
    }

    if (requestedModelId !== 'apex' && GROQ_KEYS.length === 0) {
      return new Response(JSON.stringify({ error: 'API ключи не настроены' }), { status: 500 })
    }

    const botName = modelName || 'Zenith Sync 3.0'
    let searchResults: TavilyResult[] = []
    
    const imageAttachments = (attachments || []).filter((a: Attachment) => a.type === 'image')
    const fileAttachments = (attachments || []).filter((a: Attachment) => a.type === 'file')
    const hasImages = imageAttachments.length > 0
    
    const model = requestedModelId === 'summit' ? 'llama-3.3-70b-versatile' : 'llama-3.1-8b-instant'

    let systemPrompt = SYSTEM_PROMPT.replace(/Zenith Sync 3\.0/g, botName)
    let userContent: string = message || ''

    if (fileAttachments.length > 0) {
      const fileContext = fileAttachments.map((f: Attachment) => 
        `--- Р¤Р°Р№Р»: ${f.name} ---\n${f.data}\n--- РљРѕРЅРµС† С„Р°Р№Р»Р° ---`
      ).join('\n\n')
      userContent = `${fileContext}\n\n${message || 'РџСЂРѕР°РЅР°Р»РёР·РёСЂСѓР№ СЌС‚РѕС‚ С„Р°Р№Р»'}`
    }

    // For images - describe that image was uploaded (vision not available on free Groq)
    if (hasImages) {
      const imageNames = imageAttachments.map((img: Attachment) => img.name).join(', ')
      userContent = `[РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ Р·Р°РіСЂСѓР·РёР» РёР·РѕР±СЂР°Р¶РµРЅРёРµ: ${imageNames}]\n\n${message || 'РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ С…РѕС‡РµС‚ СѓР·РЅР°С‚СЊ С‡С‚Рѕ РЅР° РёР·РѕР±СЂР°Р¶РµРЅРёРё'}\n\nРљ СЃРѕР¶Р°Р»РµРЅРёСЋ, Р°РЅР°Р»РёР· РёР·РѕР±СЂР°Р¶РµРЅРёР№ РІСЂРµРјРµРЅРЅРѕ РЅРµРґРѕСЃС‚СѓРїРµРЅ. РџРѕР¶Р°Р»СѓР№СЃС‚Р°, РѕРїРёС€РёС‚Рµ С‡С‚Рѕ РЅР° РёР·РѕР±СЂР°Р¶РµРЅРёРё С‚РµРєСЃС‚РѕРј, Рё СЏ РїРѕРјРѕРіСѓ.`
    }

    if (mode === 'research') {
      systemPrompt = RESEARCH_PROMPT.replace(/Zenith Sync 3\.0/g, botName)
    } else if (mode === 'thinking') {
      systemPrompt = THINKING_PROMPT.replace(/Zenith Sync 3\.0/g, botName)
    } else if (mode === 'codex') {
      systemPrompt = CODEX_PROMPT
    } else if (mode === 'search') {
      systemPrompt = SEARCH_PROMPT.replace(/Zenith Sync 3\.0/g, botName)
      const searchData = await searchWeb(message)
      searchResults = searchData.results
      
      if (searchResults.length > 0) {
        const searchContext = searchResults.map((r, i) => 
          `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.content}`
        ).join('\n\n')
        userContent = `Р—Р°РїСЂРѕСЃ: ${message}\n\nР РµР·СѓР»СЊС‚Р°С‚С‹ РїРѕРёСЃРєР°:\n${searchContext}`
      } else {
        userContent = `Р—Р°РїСЂРѕСЃ: ${message}\n\nРџРѕРёСЃРє РЅРµ РґР°Р» СЂРµР·СѓР»СЊС‚Р°С‚РѕРІ. РћС‚РІРµС‚СЊ РЅР° РѕСЃРЅРѕРІРµ СЃРІРѕРёС… Р·РЅР°РЅРёР№.`
      }
    }

    // Add memory context to system prompt
    if (memoryContext) {
      systemPrompt += memoryContext
    }

    const messages: any[] = [
      { role: 'system', content: systemPrompt },
      ...(history || []).map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user', content: userContent },
    ]

    if (mode === 'codex') {
      if (!OPENROUTER_API_KEY) {
        return new Response(JSON.stringify({ error: 'OPENROUTER_API_KEY не настроен для Codex режима' }), { status: 500 })
      }

      const orResponse = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'https://dzensync.vercel.app',
          'X-Title': 'Zenith Sync',
        },
        body: JSON.stringify({
          model: OPENROUTER_CODEX_MODEL,
          messages,
          temperature: 0.3,
          stream: false,
        }),
      })

      if (!orResponse.ok) {
        const errorText = await orResponse.text()
        return new Response(JSON.stringify({ error: `OpenRouter error ${orResponse.status}: ${errorText}` }), { status: orResponse.status })
      }

      const data = await orResponse.json()
      const fullContent =
        data?.choices?.[0]?.message?.content ||
        data?.choices?.[0]?.text ||
        data?.output_text ||
        ''

      const encoder = new TextEncoder()
      const readable = new ReadableStream({
        async start(controller) {
          try {
            if (fullContent) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: fullContent })}\n\n`))
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
    }

    if (requestedModelId === 'apex') {
      const encoder = new TextEncoder()
      const readable = new ReadableStream({
        async start(controller) {
          try {
            if (mode === 'search' && searchResults.length > 0) {
              const sources = searchResults.map(r => ({ title: r.title, url: r.url }))
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ sources })}\n\n`))
            }
            
            const fullContent = await generateWithGemini({
              systemPrompt,
              history: (history || []).filter((m: { role: string }) => m.role === 'user' || m.role === 'assistant'),
              userContent,
              mode,
            })
            
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: fullContent })}\n\n`))
            
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
    }

    // РџРѕРїС‹С‚РєР° СЃ СЂРѕС‚Р°С†РёРµР№ РєР»СЋС‡РµР№
    let lastError: any = null
    for (let attempt = 0; attempt < Math.min(GROQ_KEYS.length, 3); attempt++) {
      try {
        const groq = getNextGroqClient()
        
        const stream = await groq.chat.completions.create({
          model,
          messages,
          temperature: (mode === 'thinking' || mode === 'research') ? 0.3 : 0.7,
          max_tokens: mode === 'research' ? 4000 : (mode === 'thinking' ? 2000 : 1500),
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
    console.error('Chat API error:', error)
    const raw = error instanceof Error ? error.message : String(error)
    const message = (raw && raw.length > 0) ? raw.slice(0, 600) : 'Ошибка генерации. Попробуй позже.'
    return new Response(JSON.stringify({ error: message }), { status: 500 })
  }
}


