// Netlify Function: ai-diagnose
// Handles four modes: "diagnose" (symptom checker), "translate" (garage quote translator),
// "scan" (dashboard warning-light photo scanner), and "receipt" (service history receipt reader,
// which accepts one or more photos for multi-page documents).
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

  let messageContent;
  if (mode === 'scan') {
    if (!payload || !payload.base64 || !payload.mediaType) {
      return { statusCode: 200, body: JSON.stringify({ error: 'No image received' }) };
    }
    messageContent = [
      { type: 'image', source: { type: 'base64', media_type: payload.mediaType, data: payload.base64 } },
      { type: 'text', text: buildScanPrompt() }
    ];
  } else if (mode === 'receipt') {
    const images = (payload && Array.isArray(payload.images)) ? payload.images : [];
    if (!images.length) {
      return { statusCode: 200, body: JSON.stringify({ error: 'No image received' }) };
    }
    const imageBlocks = images.map(img => ({
      type: 'image',
      source: { type: 'base64', media_type: img.mediaType, data: img.base64 }
    }));
    messageContent = [...imageBlocks, { type: 'text', text: buildReceiptPrompt(images.length) }];
  } else {
    const prompt = mode === 'translate'
      ? buildTranslatePrompt(payload)
      : buildDiagnosePrompt(payload);
    messageContent = prompt;
  }

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
        max_tokens: 1000,
        messages: [{ role: 'user', content: messageContent }]
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
  return `You are SafVia, a calm and trustworthy AI car companion helping a UK driver who is not technical. ${VOICE_INSTRUCTION}

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
  return `You are SafVia, translating UK mechanic/garage jargon into plain English for a non-technical driver. ${VOICE_INSTRUCTION}

Garage said: "${p.quote}"

Return JSON with this exact shape:
{
  "plainEnglish": "2-3 warm, plain-English sentences explaining what this means and why it matters — no jargon left unexplained",
  "urgency": short phrase e.g. "Safe for now, book within a month" or "Worth booking this week",
  "cost": "£X–£Y" (realistic UK repair cost range for this specific job),
  "questions": [ 3 short, plain-English questions the driver should ask the garage ]
}`;
}

function buildScanPrompt() {
  return `You are SafVia, looking at a photo of a UK driver's car dashboard on their behalf. ${VOICE_INSTRUCTION}

Identify every warning light or dashboard indicator visible in the photo that is currently lit (ignore icons that are just part of the normal display, like a fuel gauge needle or speedometer numbers — only report lights that are illuminated/highlighted, e.g. amber or red icons).

If the photo is too blurry, dark, or doesn't clearly show a dashboard, say so honestly rather than guessing.

Respond with ONLY a JSON object, no preamble, no markdown fences, in this exact shape:
{
  "lights": [
    {
      "name": "plain-English name of the light, e.g. 'Engine warning light'",
      "severity": "stop" | "book" | "ok",
      "explanation": "2-3 warm, plain-English sentences: what this light means, roughly why it comes on, and what it means for driving right now — no unexplained jargon"
    }
  ],
  "questions": [ 3 short, plain-English questions the driver should ask their mechanic about what was found ]
}

Use "stop" only for lights that mean serious immediate danger (e.g. oil pressure warning, brake system failure, engine overheating). Use "book" for things worth getting checked soon but not an emergency (e.g. engine management light, tyre pressure). Use "ok" for informational lights that don't need urgent action (e.g. eco mode, low washer fluid). If you can't identify any lit warning light at all, return an empty "lights" array.`;
}

function buildReceiptPrompt(pageCount) {
  const pageNote = (pageCount && pageCount > 1)
    ? ` You have been given ${pageCount} photos that together make up one multi-page receipt or invoice — read them together as a single document, not as separate receipts.`
    : '';
  return `You are SafVia, reading a photo of a UK garage receipt or invoice on behalf of a non-technical driver. ${VOICE_INSTRUCTION}${pageNote}

Extract the key details from the receipt/invoice, and summarise the work done in plain English (translate any jargon — e.g. "replaced lower wishbone bushes" should be explained simply).

If the photo(s) are too blurry, dark, or clearly aren't a receipt/invoice, set "readable" to false rather than guessing at details.

Respond with ONLY a JSON object, no preamble, no markdown fences, in this exact shape:
{
  "readable": true | false,
  "garage": "name of the garage/dealer if visible, otherwise empty string",
  "date": "date on the receipt if visible, in a readable UK format (e.g. '14 March 2026'), otherwise empty string",
  "mileage": "mileage if visible on the receipt, as a plain number with no commas, otherwise empty string",
  "cost": "total cost if visible, formatted like '£184.50', otherwise empty string",
  "workDone": "2-4 plain-English sentences summarising what work was carried out and why, with no unexplained jargon",
  "advisories": [ 0-3 short plain-English items for anything flagged as an advisory or recommended future work on the receipt — empty array if none ]
}`;
}
