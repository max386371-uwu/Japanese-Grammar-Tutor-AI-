import {requestChat, parseJsonReply} from '../lib/ai-client.js';
import {buildExplanationSystemPrompt, buildExplanationUserPrompt, buildFollowUpSystemPrompt} from '../lib/prompt-builder.js';
import {getSettings, setSettings} from '../lib/storage.js';
import '../lib/constants.js';

const {STORAGE_KEYS, DEFAULT_SETTINGS, MESSAGE_TYPES} = globalThis.JGT_CONSTANTS;

const CONTEXT_MENU_ID = 'jgt-explain-selection';

// Right-click menu entry, shown only when the user has text selected.
chrome.runtime.onInstalled.addListener(createContextMenu);
chrome.runtime.onStartup?.addListener(createContextMenu);

function createContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: CONTEXT_MENU_ID,
      title: '\u8aac Explain Japanese grammar',
      contexts: ['selection'],
    });
  });
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== CONTEXT_MENU_ID || !tab?.id) return;
  await relayOpenPanel(tab.id, info.selectionText || '');
});

// Relay the keyboard shortcut to the active tab's content script.
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'open-ai-panel') return;
  const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
  if (!tab?.id) {
    console.warn('[Japanese Grammar Tutor] Hotkey pressed but no active tab found.');
    return;
  }
  await relayOpenPanel(tab.id, '');
});

/**
 * @param {number} tabId
 * @param {string} fallbackText Selection text from the context menu event,
 *   used only if the content script's own selection tracking somehow
 *   missed it (e.g. selection made via keyboard, not mouse).
 */
async function relayOpenPanel(tabId, fallbackText) {
  try {
    await chrome.tabs.sendMessage(tabId, {
      type: MESSAGE_TYPES.OPEN_PANEL_FOR_SELECTION,
      fallbackText,
    });
  } catch (error) {
    // Most common cause: the content script isn't injected into this tab yet
    // (page was open before the extension loaded/reloaded, or it's a
    // restricted page like chrome:// or the Chrome Web Store).
    console.warn(
      '[Japanese Grammar Tutor] Could not reach the content script on this tab. ' +
        'Try refreshing the page and selecting text again.',
      error,
    );
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === MESSAGE_TYPES.EXPLAIN_REQUEST) {
    handleExplainRequest(message.payload)
      .then((result) => sendResponse({ok: true, result}))
      .catch((error) => sendResponse({ok: false, error: error.message}));
    return true; // keep the message channel open for the async response
  }
  if (message?.type === MESSAGE_TYPES.CHAT_FOLLOWUP_REQUEST) {
    handleChatFollowUp(message.payload)
      .then((reply) => sendResponse({ok: true, reply}))
      .catch((error) => sendResponse({ok: false, error: error.message}));
    return true;
  }
  return false;
});

/**
 * Reads the active provider + its API key/model, migrating from the
 * legacy Groq-only storage keys on first use so existing users don't need
 * to re-enter anything.
 * @returns {Promise<{provider: string, apiKey: string, model: string}>}
 */
async function resolveActiveProviderConfig() {
  const settings = await getSettings([
    STORAGE_KEYS.PROVIDER,
    STORAGE_KEYS.API_KEYS_BY_PROVIDER,
    STORAGE_KEYS.MODELS_BY_PROVIDER,
    STORAGE_KEYS.LEGACY_API_KEY,
    STORAGE_KEYS.LEGACY_MODEL,
  ]);

  const provider = settings[STORAGE_KEYS.PROVIDER] || DEFAULT_SETTINGS[STORAGE_KEYS.PROVIDER];
  let apiKeysByProvider = settings[STORAGE_KEYS.API_KEYS_BY_PROVIDER] || {};
  let modelsByProvider = settings[STORAGE_KEYS.MODELS_BY_PROVIDER] || DEFAULT_SETTINGS[STORAGE_KEYS.MODELS_BY_PROVIDER];

  // One-time migration: a pre-multi-provider install only ever had a Groq
  // key/model under the old flat keys. Fold them into the new per-provider
  // maps under 'groq' if that slot is still empty, and persist the
  // migration so it only runs once.
  const legacyApiKey = settings[STORAGE_KEYS.LEGACY_API_KEY];
  const legacyModel = settings[STORAGE_KEYS.LEGACY_MODEL];
  let migrated = false;
  if (legacyApiKey && !apiKeysByProvider.groq) {
    apiKeysByProvider = {...apiKeysByProvider, groq: legacyApiKey};
    migrated = true;
  }
  if (legacyModel && !modelsByProvider.groq) {
    modelsByProvider = {...modelsByProvider, groq: legacyModel};
    migrated = true;
  }
  if (migrated) {
    await setSettings({
      [STORAGE_KEYS.API_KEYS_BY_PROVIDER]: apiKeysByProvider,
      [STORAGE_KEYS.MODELS_BY_PROVIDER]: modelsByProvider,
    });
  }

  return {
    provider,
    apiKey: apiKeysByProvider[provider] || '',
    model: modelsByProvider[provider] || DEFAULT_SETTINGS[STORAGE_KEYS.MODELS_BY_PROVIDER][provider],
  };
}

/**
 * @param {{
 *   sentence: string,
 *   contextBefore?: string,
 *   contextAfter?: string,
 * }} payload
 * @returns {Promise<object>}
 */
async function handleExplainRequest(payload) {
  const {provider, apiKey, model} = await resolveActiveProviderConfig();

  const settings = await getSettings([
    STORAGE_KEYS.EXPLANATION_MODE,
    STORAGE_KEYS.EXPLAIN_PARTICLES,
    STORAGE_KEYS.EXPLAIN_CONJUGATIONS,
    STORAGE_KEYS.EXPLAIN_AUXVERBS,
    STORAGE_KEYS.EXPLAIN_SLANG,
  ]);

  const explanationMode = settings[STORAGE_KEYS.EXPLANATION_MODE] || DEFAULT_SETTINGS[STORAGE_KEYS.EXPLANATION_MODE];
  const categories = {
    particles: settings[STORAGE_KEYS.EXPLAIN_PARTICLES] ?? DEFAULT_SETTINGS[STORAGE_KEYS.EXPLAIN_PARTICLES],
    conjugations: settings[STORAGE_KEYS.EXPLAIN_CONJUGATIONS] ?? DEFAULT_SETTINGS[STORAGE_KEYS.EXPLAIN_CONJUGATIONS],
    auxVerbs: settings[STORAGE_KEYS.EXPLAIN_AUXVERBS] ?? DEFAULT_SETTINGS[STORAGE_KEYS.EXPLAIN_AUXVERBS],
    slang: settings[STORAGE_KEYS.EXPLAIN_SLANG] ?? DEFAULT_SETTINGS[STORAGE_KEYS.EXPLAIN_SLANG],
  };

  const systemPrompt = buildExplanationSystemPrompt({explanationMode, categories});
  const userPrompt = buildExplanationUserPrompt({
    sentence: payload.sentence,
    contextBefore: payload.contextBefore,
    contextAfter: payload.contextAfter,
  });

  const rawText = await requestChat({
    provider,
    apiKey,
    model,
    systemPrompt,
    messages: [{role: 'user', content: userPrompt}],
    jsonMode: true,
  });

  return parseJsonReply(rawText);
}

/**
 * @param {{
 *   sentence: string,
 *   grammarPointName: string,
 *   grammarPointSummary: string,
 *   history: Array<{role: 'user'|'assistant', text: string}>,
 *   question: string
 * }} payload
 * @returns {Promise<string>}
 */
async function handleChatFollowUp(payload) {
  const {provider, apiKey, model} = await resolveActiveProviderConfig();

  const systemPrompt = buildFollowUpSystemPrompt({
    sentence: payload.sentence,
    grammarPointName: payload.grammarPointName,
    grammarPointSummary: payload.grammarPointSummary,
  });

  const messages = [
    ...(Array.isArray(payload.history) ? payload.history : []).map((h) => ({role: h.role, content: h.text})),
    {role: 'user', content: payload.question},
  ];

  return requestChat({provider, apiKey, model, systemPrompt, messages, jsonMode: false});
}
