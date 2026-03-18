import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://rzkpthrkcrlxuopnnfbv.supabase.co'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6a3B0aHJrY3JseHVvcG5uZmJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1ODM4NzMsImV4cCI6MjA4OTE1OTg3M30.OnJ7O02C-DaE06agS5B-ZarHrtASsaSN0o0Ct7s2XL0'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

export async function validateToken(token) {
  if (!token) return { valid: false, reason: 'no-token' }
  const { data, error } = await supabase.from('tl_tokens').select('*').eq('token', token).single()
  if (error || !data) return { valid: false, reason: 'invalid' }
  if (data.status === 'completed') return { valid: false, reason: 'completed' }
  if (data.status === 'active') return { valid: false, reason: 'completed' }
  if (data.status === 'expired' || new Date(data.expires_at) < new Date()) return { valid: false, reason: 'expired' }
  await supabase.from('tl_tokens').update({ status: 'active' }).eq('id', data.id)
  return { valid: true, data }
}

export async function saveLogEntry(sid, e) {
  return supabase.from('tl_log').insert({ session_id: sid, question_id: e.qid, question_text: e.q, answer: e.a, is_custom: e.custom, timing_ms: e.timing })
}

export async function saveTrapResult(sid, t) {
  return supabase.from('tl_traps').upsert({ session_id: sid, trap_type: t.trap, caught: t.caught, category: t.cat, ai_reasoning: t.aiReason || null, ai_evaluated: t.aiEval || false }, { onConflict: 'session_id,trap_type', ignoreDuplicates: false })
}

export async function createSession(sid, tid, name) {
  return supabase.from('tl_sessions').insert({ session_id: sid, token_id: tid, candidate_name: name })
}

export async function completeSession(sid, stats, ai) {
  const h = (s) => {
    if (!s) return 'unknown'; const l = s.toLowerCase()
    if (l.includes('strong no hire') || l.includes('strong no-hire')) return 'no-hire'
    if (l.includes('no-hire') || l.includes('no hire') || l.includes('not hire') || l.includes('pass')) return 'no-hire'
    if (l.includes('strong hire')) return 'strong-hire'
    if (l.includes('hire')) return 'hire'
    return 'uncertain'
  }
  const { data } = await supabase.from('tl_sessions').update({ completed_at: new Date().toISOString(), total_time_ms: stats.totalTime, stats, ai_summary: ai, hire_lean: h(ai) }).eq('session_id', sid).select()
  if (data?.[0]?.token_id) await supabase.from('tl_tokens').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', data[0].token_id)
  try { await fetch('/api/notify-completion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: sid }) }) } catch (e) {}
  return data
}
