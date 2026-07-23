import {requestExplanation} from '../lib/ai-client.js';
import {buildExplanationPrompt} from '../lib/prompt-builder.js';
import {getSettings} from '../lib/storage.js';
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
  return false;
});

/**
 * @param {{
 *   sentence: string,
 *   contextBefore?: string,
 *   contextAfter?: string,
 *   instructionOverride?: string,
 *   responseLanguage?: string
 * }} payload
 * @returns {Promise<object>}
 */
async function handleExplainRequest(payload) {
  const settings = await getSettings([
    STORAGE_KEYS.API_KEY,
    STORAGE_KEYS.MODEL,
    STORAGE_KEYS.EXPLANATION_MODE,
    STORAGE_KEYS.EXPLAIN_PARTICLES,
    STORAGE_KEYS.EXPLAIN_CONJUGATIONS,
    STORAGE_KEYS.EXPLAIN_AUXVERBS,
    STORAGE_KEYS.EXPLAIN_SLANG,
  ]);

  const apiKey = settings[STORAGE_KEYS.API_KEY];
  const model = settings[STORAGE_KEYS.MODEL] || DEFAULT_SETTINGS[STORAGE_KEYS.MODEL];
  const explanationMode = settings[STORAGE_KEYS.EXPLANATION_MODE] || DEFAULT_SETTINGS[STORAGE_KEYS.EXPLANATION_MODE];

  const categories = {
    particles: settings[STORAGE_KEYS.EXPLAIN_PARTICLES] ?? DEFAULT_SETTINGS[STORAGE_KEYS.EXPLAIN_PARTICLES],
    conjugations: settings[STORAGE_KEYS.EXPLAIN_CONJUGATIONS] ?? DEFAULT_SETTINGS[STORAGE_KEYS.EXPLAIN_CONJUGATIONS],
    auxVerbs: settings[STORAGE_KEYS.EXPLAIN_AUXVERBS] ?? DEFAULT_SETTINGS[STORAGE_KEYS.EXPLAIN_AUXVERBS],
    slang: settings[STORAGE_KEYS.EXPLAIN_SLANG] ?? DEFAULT_SETTINGS[STORAGE_KEYS.EXPLAIN_SLANG],
  };

  const prompt = buildExplanationPrompt({
    sentence: payload.sentence,
    contextBefore: payload.contextBefore,
    contextAfter: payload.contextAfter,
    explanationMode,
    responseLanguage: payload.responseLanguage,
    instructionOverride: payload.instructionOverride,
    categories,
  });

  return requestExplanation({apiKey, model, prompt});
}
