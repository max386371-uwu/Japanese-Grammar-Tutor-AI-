// Panel controller: builds the panel DOM, owns open/close animation, and
// wires up the Grammar Found accordion + translation toggle + action bar.
// Rendering of individual sections is delegated to window.JGTComponents.
//
// Deliberately NOT using Shadow DOM — manifest-declared CSS (content.css)
// is the only way extension styles reliably bypass a page's CSP, and that
// privilege can't reach inside a Shadow Root. The panel renders directly
// into the page instead, with strong resets in content.css compensating
// for the lack of automatic style isolation.
//
// All visual customization (font, colors, width, opacity, radius, line
// spacing) is applied here as inline CSS custom properties on the panel
// element, sourced from the user's settings — there is no fixed
// light/dark preset anymore.

(function () {
  const {el} = window.JGTComponents;

  const DEFAULT_MAX_HEIGHT = 460; // fallback only, real value comes from visual.popupMaxHeight

  /** @type {?HTMLElement} root container attached to document.documentElement */
  let rootEl = null;
  /** @type {?HTMLElement} */
  let panelEl = null;
  /** @type {?(e: MouseEvent) => void} */
  let outsideClickHandler = null;

  /** @type {?number} accordion: index of the single open grammar point, or null */
  let openGrammarIndex = null;
  /** @type {Set<number>} used instead of openGrammarIndex when autoExpandGrammar is on */
  let multiExpandedSet = new Set();
  /** @type {boolean} */
  let translationExpanded = false;

  /** @type {object} last-opened visual settings + anchor, reused by follow-up requests */
  let lastState = {
    visual: null,
    autoExpandGrammar: false,
    autoShowTranslation: false,
    highlightGrammar: true,
    anchorRect: null,
  };

  /**
   * @returns {HTMLElement}
   */
  function ensureRoot() {
    if (rootEl) return rootEl;
    rootEl = document.createElement('div');
    rootEl.id = 'jgt-panel-root';
    document.documentElement.appendChild(rootEl);
    return rootEl;
  }

  /**
   * @param {?{top: number, left: number, bottom: number, right: number}} anchorRect
   * @param {number} panelWidth
   * @param {number} panelMaxHeight
   * @returns {{top: number, left: number}}
   */
  function computePosition(anchorRect, panelWidth, panelMaxHeight) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    if (!anchorRect) {
      return {top: 56, left: Math.max(12, vw - panelWidth - 20)};
    }

    let left = Math.min(anchorRect.left, vw - panelWidth - 12);
    left = Math.max(12, left);

    const estimatedHeight = Math.min(panelMaxHeight, 260);
    let top = anchorRect.bottom + 8;
    if (top + estimatedHeight > vh - 12) {
      const above = anchorRect.top - estimatedHeight - 8;
      top = above > 8 ? above : Math.max(12, vh - estimatedHeight - 12);
    }

    return {top, left};
  }

  /**
   * @param {HTMLElement} node
   * @param {object} visual
   */
  function applyVisualSettings(node, visual) {
    node.style.setProperty('--jgt-font-size', `${visual.fontSize}px`);
    node.style.setProperty('--jgt-font-family', visual.fontFamily);
    node.style.setProperty('--jgt-text', visual.textColor);
    node.style.setProperty('--jgt-accent', visual.accentColor);
    node.style.setProperty('--jgt-bg', visual.bgColor);
    node.style.setProperty('--jgt-radius', `${visual.borderRadius}px`);
    node.style.setProperty('--jgt-line-height', String(visual.lineSpacing));
    node.style.width = `${visual.popupWidth}px`;
    node.style.opacity = String(visual.popupOpacity);
  }

  /**
   * @param {{
   *   sentence: string,
   *   anchorRect?: ?object,
   *   visual: {fontSize:number, fontFamily:string, textColor:string, accentColor:string, bgColor:string, popupWidth:number, popupOpacity:number, borderRadius:number, lineSpacing:number},
   *   autoExpandGrammar?: boolean,
   *   autoShowTranslation?: boolean,
   * }} initial
   */
  function openLoading(initial) {
    lastState = {
      visual: initial.visual,
      autoExpandGrammar: Boolean(initial.autoExpandGrammar),
      autoShowTranslation: Boolean(initial.autoShowTranslation),
      highlightGrammar: initial.highlightGrammar !== false,
      anchorRect: initial.anchorRect || lastState.anchorRect,
    };
    openGrammarIndex = null;
    multiExpandedSet = new Set();
    translationExpanded = lastState.autoShowTranslation;

    const root = ensureRoot();
    closePanelImmediate();

    const maxHeight = initial.visual.popupMaxHeight || DEFAULT_MAX_HEIGHT;
    const pos = computePosition(lastState.anchorRect, initial.visual.popupWidth, maxHeight);

    panelEl = el('div', 'jgt-panel');
    panelEl.setAttribute('tabindex', '-1');
    applyVisualSettings(panelEl, initial.visual);
    Object.assign(panelEl.style, {
      top: `${pos.top}px`,
      left: `${pos.left}px`,
      maxHeight: `${maxHeight}px`,
    });

    const body = el('div', 'jgt-panel-body');
    body.append(el('div', 'jgt-sentence-jp', initial.sentence));
    body.append(el('div', 'jgt-status', 'Thinking\u2026'));

    panelEl.append(body);
    panelEl.append(buildResizeHandle());
    root.appendChild(panelEl);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => panelEl?.classList.add('jgt-panel-open'));
      repositionWithinViewport();
    });

    panelEl.focus();
    panelEl.addEventListener('keydown', onPanelKeydown);
    attachOutsideClickListener();
  }

  /**
   * Small draggable grip in the bottom-right corner so the panel's size
   * can be adjusted manually for the current session (independent of the
   * default width set in Options).
   * @returns {HTMLElement}
   */
  function buildResizeHandle() {
    const handle = el('div', 'jgt-resize-handle');
    handle.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!panelEl) return;
      const startX = e.clientX;
      const startY = e.clientY;
      const rect = panelEl.getBoundingClientRect();
      const startWidth = rect.width;
      const startHeight = rect.height;

      const onMove = (moveEvent) => {
        if (!panelEl) return;
        const newWidth = Math.max(260, startWidth + (moveEvent.clientX - startX));
        const newHeight = Math.max(140, startHeight + (moveEvent.clientY - startY));
        panelEl.style.width = `${newWidth}px`;
        panelEl.style.height = `${newHeight}px`;
        panelEl.style.maxHeight = `${newHeight}px`;
      };
      const onUp = () => {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
      };
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
    });
    return handle;
  }

  /**
   * Re-opens the loading state reusing the last visual settings/anchor —
   * used by follow-up action buttons so they don't need to re-derive
   * settings or positioning.
   * @param {string} sentence
   */
  function reopenLoading(sentence) {
    openLoading({
      sentence,
      visual: lastState.visual,
      autoExpandGrammar: lastState.autoExpandGrammar,
      autoShowTranslation: lastState.autoShowTranslation,
      anchorRect: lastState.anchorRect,
    });
  }

  /**
   * @param {KeyboardEvent} e
   */
  function onPanelKeydown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      closePanel();
    }
  }

  function attachOutsideClickListener() {
    detachOutsideClickListener();
    // Deferred so the same click that opened the panel (still bubbling to
    // document) doesn't immediately trigger this handler and close it.
    setTimeout(() => {
      outsideClickHandler = (e) => {
        if (panelEl && !panelEl.contains(e.target)) {
          closePanel();
        }
      };
      document.addEventListener('mousedown', outsideClickHandler, true);
    }, 0);
  }

  function detachOutsideClickListener() {
    if (outsideClickHandler) {
      document.removeEventListener('mousedown', outsideClickHandler, true);
      outsideClickHandler = null;
    }
  }

  /**
   * Keeps the panel fully inside the viewport with a small margin on every
   * side (floating, never touching the screen edge), re-measuring against
   * the panel's actual rendered height/width since content height changes
   * as sections expand/collapse.
   */
  function repositionWithinViewport() {
    if (!panelEl) return;
    const margin = 12;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const rect = panelEl.getBoundingClientRect();

    let top = rect.top;
    let left = rect.left;

    if (top + rect.height > vh - margin) top = Math.max(margin, vh - rect.height - margin);
    if (top < margin) top = margin;
    if (left + rect.width > vw - margin) left = Math.max(margin, vw - rect.width - margin);
    if (left < margin) left = margin;

    panelEl.style.top = `${top}px`;
    panelEl.style.left = `${left}px`;
  }

  /**
   * @param {string} message
   */
  function renderError(message) {
    if (!panelEl) return;
    const body = panelEl.querySelector('.jgt-panel-body');
    if (!body) return;
    window.JGTComponents.clearChildren(body);
    body.append(el('div', 'jgt-status jgt-status-error', message));
  }

  /**
   * @param {object} data Parsed AI response.
   * @param {{sentence: string}} meta
   */
  function renderResult(data, meta) {
    if (!panelEl) return;

    if (lastState.autoExpandGrammar) {
      const list = Array.isArray(data.grammarPoints) ? data.grammarPoints : [];
      multiExpandedSet = new Set(list.map((_, i) => i));
    }

    renderResultInPlace(data, meta);
  }

  /**
   * @param {object} data
   * @param {{sentence: string}} meta
   * @returns {DocumentFragment}
   */
  function buildBody(data, meta) {
    const frag = document.createDocumentFragment();
    const C = window.JGTComponents;

    frag.append(
      C.renderSentenceOverview(
        {sentence: meta.sentence, translation: data.translation, grammarPoints: data.grammarPoints},
        translationExpanded,
        lastState.highlightGrammar,
        () => {
          translationExpanded = !translationExpanded;
          renderResultInPlace(data, meta);
        },
      ),
    );

    frag.append(
      C.renderGrammarFoundSection(
        data.grammarPoints,
        openGrammarIndex,
        multiExpandedSet,
        lastState.autoExpandGrammar,
        data.sentenceBreakdown,
        (index) => {
          if (lastState.autoExpandGrammar) {
            if (multiExpandedSet.has(index)) multiExpandedSet.delete(index);
            else multiExpandedSet.add(index);
          } else {
            openGrammarIndex = openGrammarIndex === index ? null : index;
          }
          renderResultInPlace(data, meta);
        },
      ),
    );

    return frag;
  }

  /**
   * Re-renders the body in place, preserving whatever expand/translation
   * state currently is (used both for a fresh AI result and for toggle
   * clicks within an already-rendered result).
   * @param {object} data
   * @param {{sentence: string}} meta
   */
  function renderResultInPlace(data, meta) {
    if (!panelEl) return;
    stashData(data, meta.sentence);
    const body = panelEl.querySelector('.jgt-panel-body');
    if (!body) return;
    window.JGTComponents.clearChildren(body);
    body.append(buildBody(data, meta));
    requestAnimationFrame(repositionWithinViewport);
  }

  function closePanel() {
    if (!panelEl) return;
    detachOutsideClickListener();
    panelEl.classList.remove('jgt-panel-open');
    const node = panelEl;
    panelEl = null;
    setTimeout(() => node.remove(), 160);
  }

  function closePanelImmediate() {
    detachOutsideClickListener();
    if (panelEl) {
      panelEl.remove();
      panelEl = null;
    }
  }

  /**
   * Stashes the last raw data on the panel node (currently unused for
   * re-fetching, kept for potential future use e.g. re-opening after a
   * settings change without a new network request).
   * @param {object} data
   * @param {string} sentence
   */
  function stashData(data, sentence) {
    if (!panelEl) return;
    panelEl.dataset.__lastData = JSON.stringify(data);
    panelEl.dataset.__sentence = sentence;
  }

  window.JGTPanel = {
    openLoading,
    reopenLoading,
    renderResult,
    renderError,
    closePanel,
  };
})();
