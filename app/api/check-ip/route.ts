import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY
  
  if (!url || !key) {
    throw new Error('Supabase not configured')
  }
  
  return createClient(url, key)
}

function getClientIP(request: NextRequest): string {
  // Vercel/Cloudflare headers
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  
  const realIP = request.headers.get('x-real-ip')
  if (realIP) {
    return realIP
  }
  
  const cfIP = request.headers.get('cf-connecting-ip')
  if (cfIP) {
    return cfIP
  }
  
  return '0.0.0.0'
}

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseClient()
    const ip = getClientIP(request)
    
    // Проверяем, зарегистрирован ли уже этот IP
    const { data: existing } = await supabase
      .from('ip_registrations')
      .select('id')
      .eq('ip_address', ip)
      .single()
    
    return new Response(JSON.stringify({ 
      ip,
      registered: !!existing 
    }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('IP check error:', error)
    return new Response(JSON.stringify({ error: 'Ошибка проверки' }), { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseClient()
    const { userId } = await request.json()
    const ip = getClientIP(request)
    
    if (!userId) {
      return new Response(JSON.stringify({ error: 'userId required' }), { status: 400 })
    }
    
    // Проверяем, не занят ли IP
    const { data: existing } = await supabase
      .from('ip_registrations')
      .select('id')
      .eq('ip_address', ip)
      .single()
    
    if (existing) {
      return new Response(JSON.stringify({ 
        error: 'С этого IP уже зарегистрирован аккаунт',
        blocked: true 
      }), { status: 403 })
    }
    
    // Регистрируем IP
    const { error: insertError } = await supabase
      .from('ip_registrations')
      .insert({ ip_address: ip, user_id: userId })
    
    if (insertError) {
      console.error('IP registration error:', insertError)
      // Если ошибка уникальности - значит кто-то успел раньше
      if (insertError.code === '23505') {
        return new Response(JSON.stringify({ 
          error: 'С этого IP уже зарегистрирован аккаунт',
          blocked: true 
        }), { status: 403 })
      }
    }
    
    // Обновляем профиль
    await supabase
      .from('profiles')
      .update({ registered_ip: ip, last_ip: ip })
      .eq('id', userId)
    
    return new Response(JSON.stringify({ success: true, ip }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('IP registration error:', error)
    return new Response(JSON.stringify({ error: 'Ошибка регистрации' }), { status: 500 })
  }
}
