// Shared constants used across background, content, popup, and options.
// Loaded as a plain script (not a module) in the content script context,
// and imported as a module in background/options/popup.

const STORAGE_KEYS = {
  // Legacy (pre-multi-provider) keys — kept so existing users aren't reset.
  // Migrated on first read into API_KEYS_BY_PROVIDER/MODELS_BY_PROVIDER
  // under the 'groq' provider if those don't have a groq entry yet.
  LEGACY_API_KEY: 'groqApiKey',
  LEGACY_MODEL: 'groqModel',

  PROVIDER: 'aiProvider',
  API_KEYS_BY_PROVIDER: 'apiKeysByProvider', // {[providerId]: string}
  MODELS_BY_PROVIDER: 'modelsByProvider', // {[providerId]: string}

  EXPLANATION_MODE: 'explanationMode', // 'beginner' | 'intermediate' | 'advanced'
  FEATURES_ENABLED: 'featuresEnabled',

  // Visual customization — applied as inline CSS custom properties on the
  // panel at open time, so there is no fixed light/dark preset anymore.
  FONT_SIZE: 'fontSizePx', // number, px
  FONT_FAMILY: 'fontFamily', // CSS font-family string
  TEXT_COLOR: 'textColor', // hex
  ACCENT_COLOR: 'accentColor', // hex
  BG_COLOR: 'bgColor', // hex
  POPUP_WIDTH: 'popupWidthPx', // number, px
  POPUP_MAX_HEIGHT: 'popupMaxHeightPx', // number, px
  POPUP_OPACITY: 'popupOpacity', // 0-1
  BORDER_RADIUS: 'borderRadiusPx', // number, px
  LINE_SPACING: 'lineSpacing', // number, e.g. 1.6

  // Grammar detection toggles — which categories the AI should surface.
  EXPLAIN_PARTICLES: 'explainParticles',
  EXPLAIN_CONJUGATIONS: 'explainConjugations',
  EXPLAIN_AUXVERBS: 'explainAuxVerbs',
  EXPLAIN_SLANG: 'explainSlang',
  AUTO_EXPAND_GRAMMAR: 'autoExpandGrammar',
  AUTO_SHOW_TRANSLATION: 'autoShowTranslation',
  HIGHLIGHT_GRAMMAR: 'highlightGrammarInSentence',

  BOOKMARKS: 'jgtBookmarks', // array of saved explanation records
};

// Provider registry — the single place that knows about each AI provider.
// Adding a new provider means: (1) add a lib/providers/<id>.js implementing
// sendChat(), (2) add one entry here, (3) add its API host to manifest
// host_permissions. Nothing else in the extension needs to change — the
// options page builds its provider/model UI from this list, and
// background.js dispatches by provider id.
const PROVIDERS_META = [
  {
    id: 'groq',
    label: 'Groq',
    keyPlaceholder: 'gsk_...',
    keyHelpUrl: 'https://console.groq.com/keys',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'],
  },
  {
    id: 'openai',
    label: 'OpenAI',
    keyPlaceholder: 'sk-...',
    keyHelpUrl: 'https://platform.openai.com/api-keys',
    models: ['gpt-4o-mini', 'gpt-4o'],
  },
  {
    id: 'anthropic',
    label: 'Anthropic (Claude)',
    keyPlaceholder: 'sk-ant-...',
    keyHelpUrl: 'https://console.anthropic.com/settings/keys',
    models: ['claude-3-5-haiku-20241022', 'claude-3-5-sonnet-20241022'],
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    keyPlaceholder: 'AIza...',
    keyHelpUrl: 'https://aistudio.google.com/apikey',
    models: ['gemini-1.5-flash', 'gemini-1.5-pro'],
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    keyPlaceholder: 'sk-or-...',
    keyHelpUrl: 'https://openrouter.ai/keys',
    models: ['openai/gpt-4o-mini', 'anthropic/claude-3.5-haiku', 'google/gemini-flash-1.5'],
  },
];

const DEFAULT_SETTINGS = {
  [STORAGE_KEYS.PROVIDER]: 'groq',
  [STORAGE_KEYS.API_KEYS_BY_PROVIDER]: {},
  [STORAGE_KEYS.MODELS_BY_PROVIDER]: Object.fromEntries(PROVIDERS_META.map((p) => [p.id, p.models[0]])),

  [STORAGE_KEYS.EXPLANATION_MODE]: 'beginner',
  [STORAGE_KEYS.FEATURES_ENABLED]: true,

  [STORAGE_KEYS.FONT_SIZE]: 15,
  [STORAGE_KEYS.FONT_FAMILY]:
    "-apple-system, BlinkMacSystemFont, 'Hiragino Kaku Gothic ProN', 'Hiragino Sans', 'Yu Gothic', 'Segoe UI', Roboto, sans-serif",
  [STORAGE_KEYS.TEXT_COLOR]: '#e9e9f0',
  [STORAGE_KEYS.ACCENT_COLOR]: '#5b9bd5',
  [STORAGE_KEYS.BG_COLOR]: '#1a1a20',
  [STORAGE_KEYS.POPUP_WIDTH]: 380,
  [STORAGE_KEYS.POPUP_MAX_HEIGHT]: 460,
  [STORAGE_KEYS.POPUP_OPACITY]: 1,
  [STORAGE_KEYS.BORDER_RADIUS]: 10,
  [STORAGE_KEYS.LINE_SPACING]: 1.6,

  [STORAGE_KEYS.EXPLAIN_PARTICLES]: true,
  [STORAGE_KEYS.EXPLAIN_CONJUGATIONS]: true,
  [STORAGE_KEYS.EXPLAIN_AUXVERBS]: true,
  [STORAGE_KEYS.EXPLAIN_SLANG]: true,
  [STORAGE_KEYS.AUTO_EXPAND_GRAMMAR]: false,
  [STORAGE_KEYS.AUTO_SHOW_TRANSLATION]: false,
  [STORAGE_KEYS.HIGHLIGHT_GRAMMAR]: true,
};

// Rough range covering hiragana, katakana, kanji, and Japanese punctuation.
const JAPANESE_TEXT_REGEX = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uff66-\uff9f]/;

const MESSAGE_TYPES = {
  EXPLAIN_REQUEST: 'EXPLAIN_REQUEST',
  CHAT_FOLLOWUP_REQUEST: 'CHAT_FOLLOWUP_REQUEST',
  OPEN_PANEL_FOR_SELECTION: 'OPEN_PANEL_FOR_SELECTION',
  OPEN_PANEL_FOR_TEXT: 'OPEN_PANEL_FOR_TEXT',
};

// Category -> color-square mapping (currently unused by the compact list
// rendering, kept for the in-sentence highlight color lookup below).
const GRAMMAR_CATEGORY_COLORS = {
  particle: '\u{1F7E6}',
  auxverb: '\u{1F7EA}',
  slang: '\u{1F7E8}',
  voice: '\u{1F7E5}',
  conjugation: '\u{1F7E9}',
  other: '\u{26AA}',
};

// Same categories, as actual text colors used to highlight each grammar
// point's occurrence directly inside the displayed sentence.
const GRAMMAR_CATEGORY_HIGHLIGHT_COLORS = {
  particle: '#6fa8dc',
  auxverb: '#c090e6',
  slang: '#e0c85b',
  voice: '#e0736a',
  conjugation: '#6bc98a',
  other: '#a3a1b3',
};

// This file is loaded two different ways:
//  - as a plain classic script in the content script (manifest content_scripts
//    array does not support ES modules reliably across browsers), so it must
//    NOT use `export`.
//  - imported via `import './constants.js'` from background/options/popup,
//    which run as ES modules — importing a non-module script still executes
//    it in the same global scope, so the globalThis assignment below is
//    visible there too.
// Read it everywhere as `globalThis.JGT_CONSTANTS`.
globalThis.JGT_CONSTANTS = {
  STORAGE_KEYS,
  DEFAULT_SETTINGS,
  JAPANESE_TEXT_REGEX,
  MESSAGE_TYPES,
  GRAMMAR_CATEGORY_COLORS,
  GRAMMAR_CATEGORY_HIGHLIGHT_COLORS,
  PROVIDERS_META,
};
