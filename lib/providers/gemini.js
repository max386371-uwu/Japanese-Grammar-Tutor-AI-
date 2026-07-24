// Google Gemini provider adapter — same common interface as every other
// provider module (see groq.js for the interface doc comment).
//
// Gemini uses 'model' instead of 'assistant' as the role name, takes the
// system prompt as a separate systemInstruction field, and puts the API
// key in the URL as a query param rather than an Authorization header.

const ENDPOINT_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * @param {{apiKey: string, model: string, systemPrompt: string, messages: Array<{role: string, content: string}>, jsonMode?: boolean}} params
 * @returns {Promise<string>}
 */
export async function sendChat({apiKey, model, systemPrompt, messages, jsonMode}) {
  const url = `${ENDPOINT_BASE}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const contents = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{text: m.content}],
  }));

  const body = {
    systemInstruction: {parts: [{text: systemPrompt}]},
    contents,
    generationConfig: {temperature: 0.3, maxOutputTokens: 2000},
  };
  if (jsonMode) body.generationConfig.responseMimeType = 'application/json';

  const response = await fetch(url, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const bodyText = await response.text().catch(() => '');
    throw new Error(`Gemini API error ${response.status}: ${bodyText.slice(0, 300)}`);
  }

  const data = await response.json();
  const parts = data?.candidates?.[0]?.content?.parts;
  const text = Array.isArray(parts) ? parts.map((p) => p.text || '').join('') : undefined;
  if (typeof text !== 'string' || text.length === 0) throw new Error('Unexpected Gemini response shape');
  return text;
}
