export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { type, text, qText, prompt } = req.body;
  if (!type || !text || !prompt) return res.status(400).json({ error: 'Missing fields' });

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
        max_tokens: 300,
        messages: [{
          role: "user",
          content: `Evaluate candidate response for behavioral signals.\nQ: "${qText}"\nA: "${text}"\n${prompt}\nJSON only: {"caught":true/false,"reasoning":"one sentence"}`
        }]
      })
    });

    const d = await r.json();
    const parsed = JSON.parse((d.content?.[0]?.text || "").replace(/```json|```/g, "").trim());
    return res.status(200).json(parsed);
  } catch (e) {
    return res.status(200).json({ caught: false, reasoning: "Evaluation unavailable" });
  }
}
