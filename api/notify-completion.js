import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://rzkpthrkcrlxuopnnfbv.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || ''
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { sessionId } = req.body;
  if (!sessionId) return res.status(400).json({ error: 'Missing sessionId' });

  try {
    // Get session data
    const { data: session } = await supabase
      .from('tl_sessions')
      .select('*')
      .eq('session_id', sessionId)
      .single();

    if (!session) return res.status(404).json({ error: 'Session not found' });

    // Get trap results
    const { data: traps } = await supabase
      .from('tl_traps')
      .select('*')
      .eq('session_id', sessionId);

    const caught = traps?.filter(t => t.caught).length || 0;
    const total = traps?.length || 0;

    // Send email notification
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      const resend = new Resend(resendKey);
      await resend.emails.send({
        from: 'P3 Conversation <notifications@wearep3.com>',
        to: process.env.NOTIFY_EMAIL || 'harvey@wearep3.com',
        subject: `✦ ${session.candidate_name} completed The Conversation`,
        html: `
          <div style="font-family:-apple-system,sans-serif;max-width:560px;padding:32px;">
            <h2 style="color:#1A1A18;font-weight:500;">${session.candidate_name} just finished.</h2>
            <div style="background:#F4F3EF;padding:20px;border-radius:8px;margin:20px 0;">
              <p style="margin:0 0 8px;color:#8A8A84;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Trap Score</p>
              <p style="margin:0;font-size:24px;font-weight:600;color:#1A1A18;">${caught} / ${total}</p>
            </div>
            <div style="background:#F4F3EF;padding:20px;border-radius:8px;margin:20px 0;">
              <p style="margin:0 0 8px;color:#8A8A84;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Hire Lean</p>
              <p style="margin:0;font-size:18px;font-weight:500;color:#1A1A18;">${session.hire_lean || 'Pending'}</p>
            </div>
            ${session.ai_summary ? `
            <div style="margin:20px 0;">
              <p style="margin:0 0 8px;color:#8A8A84;font-size:12px;text-transform:uppercase;letter-spacing:1px;">AI Assessment</p>
              <p style="margin:0;font-size:14px;line-height:1.7;color:#3D3D3A;">${session.ai_summary}</p>
            </div>` : ''}
            <div style="margin:24px 0;">
              <p style="margin:0;font-size:12px;color:#8A8A84;">
                Duration: ${session.total_time_ms ? Math.round(session.total_time_ms / 60000) + ' min' : 'N/A'} ·
                Typed: ${session.stats?.typed || 0} ·
                Clicked: ${session.stats?.clicked || 0} ·
                Passed: ${session.stats?.passed || 0}
              </p>
            </div>
            <a href="${process.env.ADMIN_URL || 'https://p3-conversation.vercel.app'}/admin" style="display:inline-block;background:#B8944F;color:#fff;padding:12px 28px;text-decoration:none;border-radius:4px;font-size:13px;letter-spacing:1px;">VIEW FULL RESULTS →</a>
          </div>
        `
      });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('Notification error:', e);
    return res.status(200).json({ ok: false, error: e.message });
  }
}
