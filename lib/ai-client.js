// Groq API client. This module is imported ONLY by background.js.
// It never runs in the content script or popup context, so the API key
// it reads from storage is never exposed to arbitrary webpages.

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

/**
 * @param {{apiKey: string, model: string, prompt: string}} params
 * @returns {Promise<object>} Parsed JSON explanation object.
 */
export async function requestExplanation({apiKey, model, prompt}) {
  if (!apiKey) {
    throw new Error('No Groq API key set. Add one in the extension options.');
  }

  const response = await fetch(GROQ_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      max_tokens: 2000,
      messages: [
        {
          role: 'system',
          content:
            'You are a precise Japanese language tutor. You always respond with ' +
            'ONLY a single valid JSON object matching the exact schema given in the ' +
            'user message. No markdown code fences, no preamble, no trailing text.',
        },
        {role: 'user', content: prompt},
      ],
      response_format: {type: 'json_object'},
    }),
  });

  if (!response.ok) {
    const bodyText = await response.text().catch(() => '');
    throw new Error(`Groq API error ${response.status}: ${bodyText.slice(0, 300)}`);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== 'string') {
    throw new Error('Unexpected Groq response shape');
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error('AI response was not valid JSON');
  }
}
