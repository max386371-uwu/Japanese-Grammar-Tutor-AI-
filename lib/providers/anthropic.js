// Anthropic provider adapter — same common interface as every other
// provider module (see groq.js for the interface doc comment).
//
// The Messages API takes the system prompt as a top-level field, not as a
// message in the array, and requires the
// anthropic-dangerous-direct-browser-access header to allow a direct
// browser-origin fetch (otherwise Anthropic's CORS policy blocks it).

const ENDPOINT = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

/**
 * @param {{apiKey: string, model: string, systemPrompt: string, messages: Array<{role: string, content: string}>}} params
 * @returns {Promise<string>}
 */
export async function sendChat({apiKey, model, systemPrompt, messages}) {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: 2000,
      system: systemPrompt,
      messages: messages.map((m) => ({role: m.role, content: m.content})),
    }),
  });

  if (!response.ok) {
    const bodyText = await response.text().catch(() => '');
    throw new Error(`Anthropic API error ${response.status}: ${bodyText.slice(0, 300)}`);
  }

  const data = await response.json();
  const text = Array.isArray(data?.content)
    ? data.content.map((block) => block.text || '').join('')
    : undefined;
  if (typeof text !== 'string' || text.length === 0) throw new Error('Unexpected Anthropic response shape');
  return text;
}
