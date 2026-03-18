import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://rzkpthrkcrlxuopnnfbv.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || ''
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Simple admin auth
  const auth = req.headers.authorization;
  if (auth !== `Bearer ${process.env.ADMIN_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { candidateName, candidateEmail, sentVia } = req.body;
  if (!candidateName) return res.status(400).json({ error: 'candidateName required' });

  const token = crypto.randomBytes(16).toString('hex');
  const baseUrl = process.env.BASE_URL || `https://${req.headers.host}`;

  const { data, error } = await supabase
    .from('tl_tokens')
    .insert({
      token,
      candidate_name: candidateName,
      candidate_email: candidateEmail || null,
      sent_via: sentVia || null,
      expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  const link = `${baseUrl}?t=${token}&n=${encodeURIComponent(candidateName.split(' ')[0])}`;

  return res.status(200).json({
    token,
    link,
    candidateName,
    expiresAt: data.expires_at
  });
}
