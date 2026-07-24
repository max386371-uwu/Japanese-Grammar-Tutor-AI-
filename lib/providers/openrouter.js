// OpenRouter provider adapter — same common interface as every other
// provider module (see groq.js for the interface doc comment). OpenRouter
// exposes an OpenAI-compatible chat completions API in front of many
// underlying models.

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * @param {{apiKey: string, model: string, systemPrompt: string, messages: Array<{role: string, content: string}>, jsonMode?: boolean}} params
 * @returns {Promise<string>}
 */
export async function sendChat({apiKey, model, systemPrompt, messages, jsonMode}) {
  const body = {
    model,
    temperature: 0.3,
    max_tokens: 2000,
    messages: [{role: 'system', content: systemPrompt}, ...messages],
  };
  // Not every underlying OpenRouter model supports json_object mode —
  // request it opportunistically; the strong prompt instruction is the
  // real guarantee (see prompt-builder.js).
  if (jsonMode) body.response_format = {type: 'json_object'};

  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const bodyText = await response.text().catch(() => '');
    throw new Error(`OpenRouter API error ${response.status}: ${bodyText.slice(0, 300)}`);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== 'string') throw new Error('Unexpected OpenRouter response shape');
  return text;
}
