// Provider-agnostic AI dispatcher. This module is imported ONLY by
// background.js. It never runs in the content script or popup context, so
// API keys read from storage are never exposed to arbitrary webpages.
//
// To add a new provider: write lib/providers/<id>.js exporting sendChat()
// with the same signature as the others, add it to the PROVIDERS map
// below, add an entry to PROVIDERS_META in lib/constants.js, and add its
// API host to manifest host_permissions. Nothing else needs to change.

import * as groq from './providers/groq.js';
import * as openai from './providers/openai.js';
import * as anthropic from './providers/anthropic.js';
import * as gemini from './providers/gemini.js';
import * as openrouter from './providers/openrouter.js';

const PROVIDERS = {groq, openai, anthropic, gemini, openrouter};

/**
 * @param {{
 *   provider: string,
 *   apiKey: string,
 *   model: string,
 *   systemPrompt: string,
 *   messages: Array<{role: 'user'|'assistant', content: string}>,
 *   jsonMode?: boolean
 * }} params
 * @returns {Promise<string>} the assistant's raw reply text
 */
export async function requestChat({provider, apiKey, model, systemPrompt, messages, jsonMode}) {
  const impl = PROVIDERS[provider];
  if (!impl) {
    throw new Error(`Unknown AI provider "${provider}". Pick one in the extension options.`);
  }
  if (!apiKey) {
    throw new Error(`No API key set for this provider. Add one in the extension options.`);
  }
  return impl.sendChat({apiKey, model, systemPrompt, messages, jsonMode});
}

/**
 * Parses a JSON object out of a raw model reply, tolerating the common
 * case where a model wraps it in a markdown code fence despite being told
 * not to.
 * @param {string} text
 * @returns {object}
 */
export function parseJsonReply(text) {
  let candidate = text.trim();
  const fenced = candidate.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fenced) candidate = fenced[1];
  try {
    return JSON.parse(candidate);
  } catch {
    throw new Error('AI response was not valid JSON');
  }
}
