// Content script: runs on every page. Detects a Japanese text selection,
// shows a small floating trigger button near it, and on click (or hotkey)
// opens the panel (panel.js) and requests an explanation from the
// background script. Never touches the API key directly.

(function () {
  const {JAPANESE_TEXT_REGEX, MESSAGE_TYPES, STORAGE_KEYS, DEFAULT_SETTINGS} = window.JGT_CONSTANTS;

  /** @type {?HTMLElement} */
  let triggerButton = null;
  /** @type {{sentence: string, contextBefore: string, contextAfter: string}|null} */
  let lastSelectionContext = null;
  /** @type {?{top: number, left: number, bottom: number, right: number}} */
  let lastSelectionRect = null;
  /** @type {boolean} whether the floating 説 button should appear on selection — cached locally so every selectionchange doesn't need an async storage read */
  let featuresEnabled = DEFAULT_SETTINGS[STORAGE_KEYS.FEATURES_ENABLED];

  initFeaturesEnabledCache();

  function initFeaturesEnabledCache() {
    try {
      if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return;
      chrome.storage.local.get([STORAGE_KEYS.FEATURES_ENABLED], (result) => {
        if (chrome.runtime.lastError) return;
        if (typeof result[STORAGE_KEYS.FEATURES_ENABLED] === 'boolean') {
          featuresEnabled = result[STORAGE_KEYS.FEATURES_ENABLED];
        }
      });
      chrome.storage.onChanged?.addListener((changes, areaName) => {
        if (areaName !== 'local') return;
        const change = changes[STORAGE_KEYS.FEATURES_ENABLED];
        if (change && typeof change.newValue === 'boolean') {
          featuresEnabled = change.newValue;
          if (!featuresEnabled) removeTriggerButton();
        }
      });
    } catch {
      // Storage unavailable on this page — keep the default.
    }
  }

  document.addEventListener('selectionchange', onSelectionChange);
  chrome.runtime.onMessage.addListener(onRuntimeMessage);

  function onSelectionChange() {
    if (!featuresEnabled) {
      removeTriggerButton();
      return;
    }

    const selection = window.getSelection();
    const text = selection ? selection.toString().trim() : '';

    if (!text || !JAPANESE_TEXT_REGEX.test(text)) {
      removeTriggerButton();
      return;
    }

    lastSelectionContext = buildContextFromSelection(selection, text);
    showTriggerButton(selection);
  }

  /**
   * @param {Selection} selection
   * @param {string} text
   * @returns {{sentence: string, contextBefore: string, contextAfter: string}}
   */
  function buildContextFromSelection(selection, text) {
    let contextBefore = '';
    let contextAfter = '';
    try {
      const range = selection.getRangeAt(0);
      const container = range.startContainer.parentElement || range.startContainer;
      const fullText = (container?.textContent || '').trim();
      const idx = fullText.indexOf(text);
      if (idx >= 0) {
        contextBefore = fullText.slice(Math.max(0, idx - 80), idx);
        contextAfter = fullText.slice(idx + text.length, idx + text.length + 80);
      }
    } catch {
      // Selection spanning multiple nodes or an unusual DOM shape — fall
      // back to no surrounding context rather than failing the request.
    }
    return {sentence: text, contextBefore, contextAfter};
  }

  /**
   * @param {Selection} selection
   */
  function showTriggerButton(selection) {
    removeTriggerButton();
    if (!selection.rangeCount) return;

    const rect = selection.getRangeAt(0).getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;
    lastSelectionRect = {top: rect.top, left: rect.left, bottom: rect.bottom, right: rect.right};

    triggerButton = document.createElement('button');
    triggerButton.id = 'jgt-trigger-button';
    triggerButton.type = 'button';
    triggerButton.textContent = '\u8aac'; // 説
    triggerButton.title = 'Explain grammar (Alt+G / Cmd+Shift+A on Mac)';
    Object.assign(triggerButton.style, {
      position: 'fixed',
      top: `${Math.max(4, rect.top - 32)}px`,
      left: `${Math.min(window.innerWidth - 32, Math.max(4, rect.left))}px`,
      zIndex: 2147483647,
    });
    // Keep the text selection alive through the click (default mousedown
    // behavior on most pages would collapse it).
    triggerButton.addEventListener('mousedown', (e) => e.preventDefault());
    triggerButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openPanelForCurrentSelection();
    });
    document.documentElement.appendChild(triggerButton);
  }

  function removeTriggerButton() {
    triggerButton?.remove();
    triggerButton = null;
  }

  /**
   * @param {{type: string}} message
   */
  function onRuntimeMessage(message) {
    if (message?.type === MESSAGE_TYPES.OPEN_PANEL_FOR_SELECTION) {
      if (!lastSelectionContext && message.fallbackText) {
        const text = message.fallbackText.trim();
        if (text && JAPANESE_TEXT_REGEX.test(text)) {
          lastSelectionContext = {sentence: text, contextBefore: '', contextAfter: ''};
        }
      }
      openPanelForCurrentSelection();
    } else if (message?.type === MESSAGE_TYPES.OPEN_PANEL_FOR_TEXT && message.text) {
      lastSelectionContext = {sentence: message.text.trim(), contextBefore: '', contextAfter: ''};
      openPanelForCurrentSelection();
    }
  }

  async function openPanelForCurrentSelection() {
    try {
      if (!lastSelectionContext) {
        const selection = window.getSelection();
        const text = selection ? selection.toString().trim() : '';
        if (text && JAPANESE_TEXT_REGEX.test(text)) {
          lastSelectionContext = buildContextFromSelection(selection, text);
        }
      }
      if (!lastSelectionContext) {
        console.warn('[Japanese Grammar Tutor] No Japanese text selected/provided — nothing to explain.');
        return;
      }

      removeTriggerButton();
      const settings = await getUiSettings();

      if (!window.JGTPanel || !window.JGTComponents) {
        console.error(
          '[Japanese Grammar Tutor] Panel scripts did not load correctly on this page ' +
            '(window.JGTPanel / window.JGTComponents missing). This can happen on pages ' +
            'with strict content security policies. Try a different page and reload the extension.',
        );
        return;
      }

      window.JGTPanel.openLoading({
        sentence: lastSelectionContext.sentence,
        visual: settings.visual,
        autoExpandGrammar: settings.autoExpandGrammar,
        autoShowTranslation: settings.autoShowTranslation,
        highlightGrammar: settings.highlightGrammar,
        anchorRect: lastSelectionRect,
      });

      await runExplainRequest(lastSelectionContext);
    } catch (error) {
      console.error('[Japanese Grammar Tutor] Failed to open the AI panel:', error);
      window.JGTPanel?.renderError?.(`Unexpected error: ${error.message}`);
    }
  }

  /**
   * @returns {Promise<{visual: object, autoExpandGrammar: boolean, autoShowTranslation: boolean}>}
   */
  function getUiSettings() {
    const visualKeys = [
      STORAGE_KEYS.FONT_SIZE,
      STORAGE_KEYS.FONT_FAMILY,
      STORAGE_KEYS.TEXT_COLOR,
      STORAGE_KEYS.ACCENT_COLOR,
      STORAGE_KEYS.BG_COLOR,
      STORAGE_KEYS.POPUP_WIDTH,
      STORAGE_KEYS.POPUP_MAX_HEIGHT,
      STORAGE_KEYS.POPUP_OPACITY,
      STORAGE_KEYS.BORDER_RADIUS,
      STORAGE_KEYS.LINE_SPACING,
    ];
    const behaviorKeys = [
      STORAGE_KEYS.AUTO_EXPAND_GRAMMAR,
      STORAGE_KEYS.AUTO_SHOW_TRANSLATION,
      STORAGE_KEYS.HIGHLIGHT_GRAMMAR,
    ];

    const fallback = buildFallbackUiSettings();

    return new Promise((resolve) => {
      try {
        if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
          console.warn('[Japanese Grammar Tutor] chrome.storage unavailable on this page, using defaults.');
          resolve(fallback);
          return;
        }
        chrome.storage.local.get([...visualKeys, ...behaviorKeys], (result) => {
          if (chrome.runtime.lastError) {
            console.warn('[Japanese Grammar Tutor] storage.get error, using defaults:', chrome.runtime.lastError.message);
            resolve(fallback);
            return;
          }
          resolve({
            visual: {
              fontSize: result[STORAGE_KEYS.FONT_SIZE] ?? fallback.visual.fontSize,
              fontFamily: result[STORAGE_KEYS.FONT_FAMILY] ?? fallback.visual.fontFamily,
              textColor: result[STORAGE_KEYS.TEXT_COLOR] ?? fallback.visual.textColor,
              accentColor: result[STORAGE_KEYS.ACCENT_COLOR] ?? fallback.visual.accentColor,
              bgColor: result[STORAGE_KEYS.BG_COLOR] ?? fallback.visual.bgColor,
              popupWidth: result[STORAGE_KEYS.POPUP_WIDTH] ?? fallback.visual.popupWidth,
              popupMaxHeight: result[STORAGE_KEYS.POPUP_MAX_HEIGHT] ?? fallback.visual.popupMaxHeight,
              popupOpacity: result[STORAGE_KEYS.POPUP_OPACITY] ?? fallback.visual.popupOpacity,
              borderRadius: result[STORAGE_KEYS.BORDER_RADIUS] ?? fallback.visual.borderRadius,
              lineSpacing: result[STORAGE_KEYS.LINE_SPACING] ?? fallback.visual.lineSpacing,
            },
            autoExpandGrammar: result[STORAGE_KEYS.AUTO_EXPAND_GRAMMAR] ?? fallback.autoExpandGrammar,
            autoShowTranslation: result[STORAGE_KEYS.AUTO_SHOW_TRANSLATION] ?? fallback.autoShowTranslation,
            highlightGrammar: result[STORAGE_KEYS.HIGHLIGHT_GRAMMAR] ?? fallback.highlightGrammar,
          });
        });
      } catch (error) {
        console.warn('[Japanese Grammar Tutor] storage access threw, using defaults:', error);
        resolve(fallback);
      }
    });
  }

  /**
   * @returns {{visual: object, autoExpandGrammar: boolean, autoShowTranslation: boolean}}
   */
  function buildFallbackUiSettings() {
    return {
      visual: {
        fontSize: DEFAULT_SETTINGS[STORAGE_KEYS.FONT_SIZE],
        fontFamily: DEFAULT_SETTINGS[STORAGE_KEYS.FONT_FAMILY],
        textColor: DEFAULT_SETTINGS[STORAGE_KEYS.TEXT_COLOR],
        accentColor: DEFAULT_SETTINGS[STORAGE_KEYS.ACCENT_COLOR],
        bgColor: DEFAULT_SETTINGS[STORAGE_KEYS.BG_COLOR],
        popupWidth: DEFAULT_SETTINGS[STORAGE_KEYS.POPUP_WIDTH],
        popupMaxHeight: DEFAULT_SETTINGS[STORAGE_KEYS.POPUP_MAX_HEIGHT],
        popupOpacity: DEFAULT_SETTINGS[STORAGE_KEYS.POPUP_OPACITY],
        borderRadius: DEFAULT_SETTINGS[STORAGE_KEYS.BORDER_RADIUS],
        lineSpacing: DEFAULT_SETTINGS[STORAGE_KEYS.LINE_SPACING],
      },
      autoExpandGrammar: DEFAULT_SETTINGS[STORAGE_KEYS.AUTO_EXPAND_GRAMMAR],
      autoShowTranslation: DEFAULT_SETTINGS[STORAGE_KEYS.AUTO_SHOW_TRANSLATION],
      highlightGrammar: DEFAULT_SETTINGS[STORAGE_KEYS.HIGHLIGHT_GRAMMAR],
    };
  }

  /**
   * @param {{sentence: string, contextBefore: string, contextAfter: string}} context
   * @param {{instructionOverride?: string, responseLanguage?: string}} [overrides]
   */
  async function runExplainRequest(context, overrides = {}) {
    chrome.runtime.sendMessage(
      {
        type: MESSAGE_TYPES.EXPLAIN_REQUEST,
        payload: {
          sentence: context.sentence,
          contextBefore: context.contextBefore,
          contextAfter: context.contextAfter,
          ...overrides,
        },
      },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error('[Japanese Grammar Tutor] sendMessage failed:', chrome.runtime.lastError.message);
          window.JGTPanel.renderError(
            `Could not reach the background script (${chrome.runtime.lastError.message}). ` +
              'Try reloading the extension and refreshing this page.',
          );
          return;
        }
        if (!response) {
          console.error('[Japanese Grammar Tutor] Empty response from background script.');
          window.JGTPanel.renderError('No response from the extension background script.');
          return;
        }
        if (!response.ok) {
          console.error('[Japanese Grammar Tutor] Explain request failed:', response.error);
          window.JGTPanel.renderError(response.error || 'Something went wrong.');
          return;
        }
        window.JGTPanel.renderResult(response.result, {sentence: context.sentence});
      },
    );
  }
})();
