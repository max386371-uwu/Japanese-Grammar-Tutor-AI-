# Japanese Grammar Tutor (AI) — Chrome/Brave Extension

Select Japanese text on any webpage, press the floating "AI" button (or
`Ctrl+Shift+A`), and get a structured grammar/vocabulary/particle
breakdown from Groq.

## Install (unpacked, for development)

1. Get a Groq API key at https://console.groq.com/keys
2. `chrome://extensions` (or `brave://extensions`) → enable **Developer mode**
3. **Load unpacked** → select this folder
4. Click the extension icon → **Settings** → paste your API key → it autosaves
5. Go to any page with Japanese text, select a sentence, click the small
   purple "AI" button that appears above your selection

## What's fully working

- Manifest V3 structure, background service worker, content script, popup, options page
- Japanese text detection on selection + floating trigger button
- Sentence + surrounding-context extraction from the DOM
- Groq API call (background script only — the content script/popup never see the API key)
- Structured JSON response rendered into: sentence/furigana/translation,
  quick explanation, grammar cards (with JLPT level badges), vocabulary
  cards, particle cards, nuance section, more-examples section
- Progressive disclosure ("Show More Grammar" / "Show More Vocabulary" /
  "Show More Nuance" / "Show More Examples") without re-querying the API
- Dark/light theme, font size, explanation-level (beginner/intermediate/advanced) settings
- Keyboard shortcut via `chrome://extensions/shortcuts` (user-remappable)
- Action buttons: Copy explanation, Simplify, Explain like beginner, Explain in Japanese (these three re-query Groq with a modified instruction)

## What's stubbed / needs follow-up work

- **Furigana**: the AI is asked to produce bracketed readings itself
  (`食(た)べる`) rather than using a proper furigana-generation library —
  it's usually accurate but isn't guaranteed correct for rare readings.
  A more robust version would run text through a morphological analyzer
  (e.g. kuromoji.js) before calling the AI.
- **"Save to Anki"** currently copies a tab-separated line to your
  clipboard instead of talking to AnkiConnect directly. Real
  AnkiConnect integration (like Yomitan's) would need a small
  `fetch('http://127.0.0.1:8765', ...)` call from the background script
  and deck/model configuration in the options page — that's a natural
  next addition, not wired up yet.
- **Icons** are simple generated placeholders — swap `icons/icon16.png`,
  `icon48.png`, `icon128.png` for real artwork before publishing.
- **"Ask follow-up question"** (free-form chat) from the spec isn't
  implemented yet — only the three preset re-explain buttons are. Adding
  a text input + conversation history to the panel would cover it.
- Not tested against Chrome Web Store review requirements (privacy
  policy, permission justifications) — only structured for local/unpacked use so far.

## File structure

```
manifest.json
background/background.js      — only place the Groq API key is used
content/content.js            — selection detection, trigger button, messaging
content/content.css           — panel + trigger button styles (dark/light, animation)
panel/panel.js                — panel shell, Show More toggles, action bar
panel/components.js           — per-section DOM builders
popup/popup.html|js|css       — toolbar popup for manual sentence entry
options/options.html|js|css  — API key, theme, font size, explanation mode
lib/ai-client.js              — Groq fetch + JSON parsing
lib/prompt-builder.js         — builds the structured prompt/schema
lib/storage.js                — chrome.storage.local wrapper
lib/constants.js              — shared keys/regex/message types
icons/                        — placeholder icons
```
