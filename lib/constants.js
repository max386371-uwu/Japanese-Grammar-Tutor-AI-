// Shared constants used across background, content, popup, and options.
// Loaded as a plain script (not a module) in the content script context,
// and imported as a module in background/options/popup.

const STORAGE_KEYS = {
  API_KEY: 'groqApiKey',
  MODEL: 'groqModel',
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
};

const DEFAULT_SETTINGS = {
  [STORAGE_KEYS.MODEL]: 'llama-3.3-70b-versatile',
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
  EXPLAIN_RESULT: 'EXPLAIN_RESULT',
  EXPLAIN_ERROR: 'EXPLAIN_ERROR',
  FOLLOW_UP_REQUEST: 'FOLLOW_UP_REQUEST',
  OPEN_PANEL_FOR_SELECTION: 'OPEN_PANEL_FOR_SELECTION',
  OPEN_PANEL_FOR_TEXT: 'OPEN_PANEL_FOR_TEXT',
};

// Category -> color-square mapping, applied client-side (not by the AI) so
// it's always visually consistent regardless of model output.
const GRAMMAR_CATEGORY_COLORS = {
  particle: '\u{1F7E6}', // 🟦
  auxverb: '\u{1F7EA}', // 🟪
  slang: '\u{1F7E8}', // 🟨
  voice: '\u{1F7E5}', // 🟥
  conjugation: '\u{1F7E9}', // 🟩
  other: '\u{26AA}', // ⚪
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
};
