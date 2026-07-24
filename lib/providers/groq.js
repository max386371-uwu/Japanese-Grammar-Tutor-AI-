// Groq provider adapter. Implements the common interface every provider
// module exposes: async sendChat({apiKey, model, systemPrompt, messages,
// jsonMode}) => string (the assistant's raw reply text).
//
// `messages` is an array of {role: 'user'|'assistant', content: string},
// oldest first. `systemPrompt` is passed separately since not every
// provider's API takes it inline with the messages array.

const ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

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
    throw new Error(`Groq API error ${response.status}: ${bodyText.slice(0, 300)}`);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== 'string') throw new Error('Unexpected Groq response shape');
  return text;
}
