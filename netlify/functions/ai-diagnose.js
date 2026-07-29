// Netlify Function: ai-diagnose
// Handles two modes: "diagnose" (symptom checker) and "translate" (garage quote translator)
// Requires an ANTHROPIC_API_KEY environment variable set in Netlify site settings.

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-6';

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 200, body: JSON.stringify({ error: 'AI backend not configured yet' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body' }) };
  }

  const { mode, payload } = body;

  const prompt = mode === 'translate'
    ? buildTranslatePrompt(payload)
    : buildDiagnosePrompt(payload);

  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 800,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await res.json();
    const textBlock = (data.content || []).find(b => b.type === 'text');
    if (!textBlock) throw new Error('No response from model');

    const cleaned = textBlock.text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    return { statusCode: 200, body: JSON.stringify(parsed) };
  } catch (err) {
    return { statusCode: 200, body: JSON.stringify({ error: 'AI request failed: ' + err.message }) };
  }
};

const VOICE_INSTRUCTION = `Voice: calm, warm, and completely non-technical — imagine explaining this to a favourite aunt who has never opened a bonnet. Never use unexplained jargon (never say just "alternator" or "solenoid" on its own — say what the part does in everyday terms first, e.g. "the part that keeps your battery topped up while you drive"). Never be condescending. Be direct and reassuring, not alarmist.`;

function buildDiagnosePrompt(p) {
  return `You are DriveIQ, a calm and trustworthy AI car companion helping a UK driver who is not technical. ${VOICE_INSTRUCTION}

Based on these details, respond with ONLY a JSON object, no preamble, no markdown fences:

Description: ${p.description}
Did it click when starting: ${p.click || 'not specified'}
Warning lights: ${p.lights || 'not specified'}
Smoke or smell: ${p.smoke || 'not specified'}
Power/movement: ${p.power || 'not specified'}
What happened before: ${p.before || 'not specified'}

Return JSON with this exact shape:
{
  "safeToDrive": "yes" | "no" | "emergency",
  "likelihood": [ { "fault": string (plain English, no jargon), "confidence": 0-100 } ] (2-4 items, most likely first),
  "cost": "£X–£Y" (realistic UK repair cost range),
  "repairTime": short string,
  "questions": [ 3 short, plain-English questions the driver should ask their mechanic ]
}`;
}

function buildTranslatePrompt(p) {
  return `You are DriveIQ, translating UK mechanic/garage jargon into plain English for a non-technical driver. ${VOICE_INSTRUCTION}

Garage said: "${p.quote}"

Return JSON with this exact shape:
{
  "plainEnglish": "2-3 warm, plain-English sentences explaining what this means and why it matters — no jargon left unexplained",
  "urgency": short phrase e.g. "Safe for now, book within a month" or "Worth booking this week",
  "cost": "£X–£Y" (realistic UK repair cost range for this specific job),
  "questions": [ 3 short, plain-English questions the driver should ask the garage ]
}`;
}
