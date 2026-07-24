# Japanese-Grammar-Tutor-AI
An AI-powered chromium extension that helps learners understand Japanese grammar directly from selected text.
Select Japanese text on most webpages, click the floating **AI** button (or chosen hotkey), and receive a structured explanation including grammar, vocabulary, particles, conjugations, and translation.

# Images

<img width="350" height="350" alt="brave_MxOwfSlQ0p" src="https://github.com/user-attachments/assets/2e27f50e-6fc1-4414-b628-0e538639fd4f" />

<img width="350" height="350" alt="image" src="https://github.com/user-attachments/assets/98d7521d-d99b-45d2-852a-755947a01ed5" />

<img width="350" height="350" alt="image" src="https://github.com/user-attachments/assets/00d10b43-8816-43a7-a357-e5bed6ed6e25" />

<img width="350" height="350" alt="brave_aAnrmd3BGi" src="https://github.com/user-attachments/assets/9d1fd91e-6a5b-4dc6-9f37-5d318baa77cd" />




# Features

- 📖 Floating AI button for selected Japanese text
- 🤖 AI-powered grammar explanations using Groq
- 📝 Sentence breakdowns
- 📚 Vocabulary definitions
- 🔤 Verb and adjective conjugation analysis
- 🟦 Particle explanations
- ⚙️ Customizable settings (theme, font size, explanation level)
- ⌨️ Keyboard shortcut support

- ## Requirements

- Chromium-based browser (Chrome, Brave, Edge)
- Groq API key
  

## Note on AI Provider Limits

This extension uses your own AI provider API key, which you configure in the extension's Settings. Your API key is stored locally and is never included in this repository.

Most AI providers (such as OpenAI, Anthropic, Google Gemini, OpenRouter, Groq, and others) enforce rate limits (for example, requests or tokens per minute). If you request many grammar explanations in a short period, you may temporarily reach your provider's limit and receive a rate limit error (such as HTTP 429).

If this happens, simply wait a short time and try again, or review your AI provider's usage limits and plan. These limits are set by your chosen AI provider and are not imposed by this extension.

## Installation 

1. Get a free Groq API key at https://console.groq.com/keys
2. `chrome://extensions` (or `brave://extensions` etc) → enable **Developer mode**
3. **Load unpacked** → select this folder
4. Click the extension icon → **Settings** → paste your API key → it autosaves
5. Go to any page with Japanese text, select a sentence, click the small
   blue "AI" button (or hot-key) that appears above your selection


## File structure

```
manifest.json
background/background.js      — only place the Groq API key is used
content/content.js            — selection detection, trigger button, messaging
content/content.css           — panel + trigger button styles (dark/light, animation)
panel/panel.js                — panel shell, Show More toggles, action bar
panel/components.js           — per-section DOM builders
popup/popup.html|js|css       — toolbar popup for manual sentence entry
options/options.html|js|css   — API key, theme, font size, explanation mode
lib/ai-client.js              — Groq fetch + JSON parsing
lib/prompt-builder.js         — builds the structured prompt/schema
lib/storage.js                — chrome.storage.local wrapper
lib/constants.js              — shared keys/regex/message types
icons/                        — placeholder icons
```
Note: Just added follow up questions with the Ai, for diving deeper into the grammar, and made a few small changes like being able to choose more AIs then just Groq. And being able to bookmar grammar.
      
