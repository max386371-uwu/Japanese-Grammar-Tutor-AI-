// OpenAI provider adapter — same common interface as every other provider
// module (see groq.js for the interface doc comment).

const ENDPOINT = 'https://api.openai.com/v1/chat/completions';

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
    throw new Error(`OpenAI API error ${response.status}: ${bodyText.slice(0, 300)}`);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== 'string') throw new Error('Unexpected OpenAI response shape');
  return text;
}
