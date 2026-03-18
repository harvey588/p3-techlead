export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { candidateName, traps, responses, stats } = req.body;

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [{
          role: "user",
          content: `Analyze Technical Lead candidate session. 250-word executive summary: 1) Character 2) Strengths 3) Concerns 4) Traps 5) Hire lean.\nCandidate: ${candidateName}\nTRAPS:\n${traps}\nRESPONSES:\n${responses}\nSTATS: Typed ${stats.typed}, Clicked ${stats.clicked}, Passed ${stats.passed}, Avg ${stats.avgTime}s\nPlain text.`
        }]
      })
    });

    const d = await r.json();
    return res.status(200).json({ summary: d.content?.[0]?.text || "" });
  } catch (e) {
    return res.status(200).json({ summary: "Summary generation failed." });
  }
}
