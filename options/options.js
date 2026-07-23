import '../lib/constants.js';
import {getSettings, setSettings} from '../lib/storage.js';

const {STORAGE_KEYS, DEFAULT_SETTINGS} = globalThis.JGT_CONSTANTS;

const fields = {
  apiKey: document.getElementById('jgto-api-key'),
  model: document.getElementById('jgto-model'),
  mode: document.getElementById('jgto-mode'),

  fontSize: document.getElementById('jgto-font-size'),
  lineSpacing: document.getElementById('jgto-line-spacing'),
  popupWidth: document.getElementById('jgto-popup-width'),
  popupMaxHeight: document.getElementById('jgto-popup-max-height'),
  borderRadius: document.getElementById('jgto-border-radius'),
  popupOpacity: document.getElementById('jgto-popup-opacity'),
  textColor: document.getElementById('jgto-text-color'),
  accentColor: document.getElementById('jgto-accent-color'),
  bgColor: document.getElementById('jgto-bg-color'),
  fontFamily: document.getElementById('jgto-font-family'),

  explainParticles: document.getElementById('jgto-explain-particles'),
  explainConjugations: document.getElementById('jgto-explain-conjugations'),
  explainAuxVerbs: document.getElementById('jgto-explain-auxverbs'),
  explainSlang: document.getElementById('jgto-explain-slang'),
  highlightGrammar: document.getElementById('jgto-highlight-grammar'),
  autoExpand: document.getElementById('jgto-auto-expand'),
  autoTranslation: document.getElementById('jgto-auto-translation'),

  featuresEnabled: document.getElementById('jgto-features-enabled'),
};

const saveStatus = document.getElementById('jgto-save-status');
document.getElementById('jgto-open-shortcuts').addEventListener('click', () => {
  chrome.tabs.create({url: 'chrome://extensions/shortcuts'});
});

async function load() {
  const stored = await getSettings(Object.values(STORAGE_KEYS));

  fields.apiKey.value = stored[STORAGE_KEYS.API_KEY] || '';
  fields.model.value = stored[STORAGE_KEYS.MODEL] || DEFAULT_SETTINGS[STORAGE_KEYS.MODEL];
  fields.mode.value = stored[STORAGE_KEYS.EXPLANATION_MODE] || DEFAULT_SETTINGS[STORAGE_KEYS.EXPLANATION_MODE];

  fields.fontSize.value = stored[STORAGE_KEYS.FONT_SIZE] ?? DEFAULT_SETTINGS[STORAGE_KEYS.FONT_SIZE];
  fields.lineSpacing.value = stored[STORAGE_KEYS.LINE_SPACING] ?? DEFAULT_SETTINGS[STORAGE_KEYS.LINE_SPACING];
  fields.popupWidth.value = stored[STORAGE_KEYS.POPUP_WIDTH] ?? DEFAULT_SETTINGS[STORAGE_KEYS.POPUP_WIDTH];
  fields.popupMaxHeight.value = stored[STORAGE_KEYS.POPUP_MAX_HEIGHT] ?? DEFAULT_SETTINGS[STORAGE_KEYS.POPUP_MAX_HEIGHT];
  fields.borderRadius.value = stored[STORAGE_KEYS.BORDER_RADIUS] ?? DEFAULT_SETTINGS[STORAGE_KEYS.BORDER_RADIUS];
  fields.popupOpacity.value = stored[STORAGE_KEYS.POPUP_OPACITY] ?? DEFAULT_SETTINGS[STORAGE_KEYS.POPUP_OPACITY];
  fields.textColor.value = stored[STORAGE_KEYS.TEXT_COLOR] ?? DEFAULT_SETTINGS[STORAGE_KEYS.TEXT_COLOR];
  fields.accentColor.value = stored[STORAGE_KEYS.ACCENT_COLOR] ?? DEFAULT_SETTINGS[STORAGE_KEYS.ACCENT_COLOR];
  fields.bgColor.value = stored[STORAGE_KEYS.BG_COLOR] ?? DEFAULT_SETTINGS[STORAGE_KEYS.BG_COLOR];
  fields.fontFamily.value = stored[STORAGE_KEYS.FONT_FAMILY] ?? DEFAULT_SETTINGS[STORAGE_KEYS.FONT_FAMILY];

  fields.explainParticles.checked = stored[STORAGE_KEYS.EXPLAIN_PARTICLES] ?? DEFAULT_SETTINGS[STORAGE_KEYS.EXPLAIN_PARTICLES];
  fields.explainConjugations.checked = stored[STORAGE_KEYS.EXPLAIN_CONJUGATIONS] ?? DEFAULT_SETTINGS[STORAGE_KEYS.EXPLAIN_CONJUGATIONS];
  fields.explainAuxVerbs.checked = stored[STORAGE_KEYS.EXPLAIN_AUXVERBS] ?? DEFAULT_SETTINGS[STORAGE_KEYS.EXPLAIN_AUXVERBS];
  fields.explainSlang.checked = stored[STORAGE_KEYS.EXPLAIN_SLANG] ?? DEFAULT_SETTINGS[STORAGE_KEYS.EXPLAIN_SLANG];
  fields.highlightGrammar.checked = stored[STORAGE_KEYS.HIGHLIGHT_GRAMMAR] ?? DEFAULT_SETTINGS[STORAGE_KEYS.HIGHLIGHT_GRAMMAR];
  fields.autoExpand.checked = stored[STORAGE_KEYS.AUTO_EXPAND_GRAMMAR] ?? DEFAULT_SETTINGS[STORAGE_KEYS.AUTO_EXPAND_GRAMMAR];
  fields.autoTranslation.checked = stored[STORAGE_KEYS.AUTO_SHOW_TRANSLATION] ?? DEFAULT_SETTINGS[STORAGE_KEYS.AUTO_SHOW_TRANSLATION];

  fields.featuresEnabled.checked = stored[STORAGE_KEYS.FEATURES_ENABLED] ?? DEFAULT_SETTINGS[STORAGE_KEYS.FEATURES_ENABLED];
}

let saveTimeout = null;
function scheduleSave() {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(save, 250);
}

async function save() {
  await setSettings({
    [STORAGE_KEYS.API_KEY]: fields.apiKey.value.trim(),
    [STORAGE_KEYS.MODEL]: fields.model.value,
    [STORAGE_KEYS.EXPLANATION_MODE]: fields.mode.value,

    [STORAGE_KEYS.FONT_SIZE]: Number(fields.fontSize.value) || DEFAULT_SETTINGS[STORAGE_KEYS.FONT_SIZE],
    [STORAGE_KEYS.LINE_SPACING]: Number(fields.lineSpacing.value) || DEFAULT_SETTINGS[STORAGE_KEYS.LINE_SPACING],
    [STORAGE_KEYS.POPUP_WIDTH]: Number(fields.popupWidth.value) || DEFAULT_SETTINGS[STORAGE_KEYS.POPUP_WIDTH],
    [STORAGE_KEYS.POPUP_MAX_HEIGHT]: Number(fields.popupMaxHeight.value) || DEFAULT_SETTINGS[STORAGE_KEYS.POPUP_MAX_HEIGHT],
    [STORAGE_KEYS.BORDER_RADIUS]: Number(fields.borderRadius.value) || 0,
    [STORAGE_KEYS.POPUP_OPACITY]: Number(fields.popupOpacity.value) || DEFAULT_SETTINGS[STORAGE_KEYS.POPUP_OPACITY],
    [STORAGE_KEYS.TEXT_COLOR]: fields.textColor.value,
    [STORAGE_KEYS.ACCENT_COLOR]: fields.accentColor.value,
    [STORAGE_KEYS.BG_COLOR]: fields.bgColor.value,
    [STORAGE_KEYS.FONT_FAMILY]: fields.fontFamily.value.trim() || DEFAULT_SETTINGS[STORAGE_KEYS.FONT_FAMILY],

    [STORAGE_KEYS.EXPLAIN_PARTICLES]: fields.explainParticles.checked,
    [STORAGE_KEYS.EXPLAIN_CONJUGATIONS]: fields.explainConjugations.checked,
    [STORAGE_KEYS.EXPLAIN_AUXVERBS]: fields.explainAuxVerbs.checked,
    [STORAGE_KEYS.EXPLAIN_SLANG]: fields.explainSlang.checked,
    [STORAGE_KEYS.HIGHLIGHT_GRAMMAR]: fields.highlightGrammar.checked,
    [STORAGE_KEYS.AUTO_EXPAND_GRAMMAR]: fields.autoExpand.checked,
    [STORAGE_KEYS.AUTO_SHOW_TRANSLATION]: fields.autoTranslation.checked,

    [STORAGE_KEYS.FEATURES_ENABLED]: fields.featuresEnabled.checked,
  });
  saveStatus.textContent = 'Saved';
  setTimeout(() => {
    if (saveStatus.textContent === 'Saved') saveStatus.textContent = '';
  }, 1200);
}

for (const field of Object.values(fields)) {
  field.addEventListener('change', scheduleSave);
  field.addEventListener('input', scheduleSave);
}

// Backup — export/import all settings as a JSON file.
document.getElementById('jgto-export').addEventListener('click', async () => {
  const stored = await getSettings(Object.values(STORAGE_KEYS));
  const blob = new Blob([JSON.stringify(stored, null, 2)], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'japanese-grammar-tutor-settings.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

const importFileInput = document.getElementById('jgto-import-file');
document.getElementById('jgto-import').addEventListener('click', () => {
  importFileInput.click();
});

importFileInput.addEventListener('change', async () => {
  const file = importFileInput.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    // Only accept known keys, so an unrelated/malformed JSON file can't
    // pollute storage with arbitrary keys.
    const validKeys = new Set(Object.values(STORAGE_KEYS));
    const toSave = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (validKeys.has(key)) toSave[key] = value;
    }
    await setSettings(toSave);
    await load();
    saveStatus.textContent = 'Settings imported';
    setTimeout(() => {
      if (saveStatus.textContent === 'Settings imported') saveStatus.textContent = '';
    }, 1500);
  } catch (error) {
    saveStatus.textContent = `Import failed: ${error.message}`;
  } finally {
    importFileInput.value = '';
  }
});

load();
