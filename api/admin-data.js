import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://rzkpthrkcrlxuopnnfbv.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || ''
);

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const auth = req.headers.authorization;
  if (auth !== `Bearer ${process.env.ADMIN_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { data: sessions } = await supabase
    .from('tl_sessions')
    .select('*')
    .order('started_at', { ascending: false });

  const { data: tokens } = await supabase
    .from('tl_tokens')
    .select('*')
    .order('created_at', { ascending: false });

  // Get traps for each session
  const sessionIds = (sessions || []).map(s => s.session_id);
  const { data: traps } = await supabase
    .from('tl_traps')
    .select('*')
    .in('session_id', sessionIds.length ? sessionIds : ['none']);

  // Get full log for detail view if requested
  const detail = req.query?.session;
  let logEntries = null;
  if (detail) {
    const { data } = await supabase
      .from('tl_log')
      .select('*')
      .eq('session_id', detail)
      .order('created_at', { ascending: true });
    logEntries = data;
  }

  return res.status(200).json({
    sessions: sessions || [],
    tokens: tokens || [],
    traps: traps || [],
    logEntries
  });
}
