// Section-rendering helpers for the AI panel. Attached to a shared
// namespace (window.JGTComponents) rather than using ES module export,
// since this file is loaded as a classic content script alongside
// panel.js and content.js in the page's isolated world.

(function () {
  const {GRAMMAR_CATEGORY_HIGHLIGHT_COLORS} = window.JGT_CONSTANTS;

  /**
   * Removes all children without touching innerHTML. Some sites (YouTube
   * among them) enforce a Trusted Types CSP that throws on any innerHTML
   * assignment, even to clear a node — this works everywhere.
   * @param {HTMLElement} node
   */
  function clearChildren(node) {
    while (node.firstChild) {
      node.removeChild(node.firstChild);
    }
  }

  /**
   * @param {string} tag
   * @param {string} className
   * @param {string} [text]
   * @returns {HTMLElement}
   */
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (typeof text === 'string') node.textContent = text;
    return node;
  }

  /**
   * @param {string} category
   * @returns {string}
   */
  function highlightColorFor(category) {
    return GRAMMAR_CATEGORY_HIGHLIGHT_COLORS[category] || GRAMMAR_CATEGORY_HIGHLIGHT_COLORS.other;
  }

  /**
   * Builds the sentence as DOM nodes, coloring each grammar point's first
   * occurrence in its category color so the grammar being discussed is
   * visible directly in context, not just in the list below. Matches are
   * kept non-overlapping — if two grammar points' text would overlap,
   * whichever was found first (in grammarPoints order) wins.
   * @param {string} sentence
   * @param {Array<{displayName: string, category: string}>} grammarPoints
   * @returns {DocumentFragment}
   */
  function buildHighlightedSentence(sentence, grammarPoints) {
    const frag = document.createDocumentFragment();
    if (!sentence) return frag;

    const list = Array.isArray(grammarPoints) ? grammarPoints : [];
    /** @type {Array<{start: number, end: number, category: string}>} */
    const ranges = [];

    for (const point of list) {
      const name = point.displayName;
      if (!name) continue;
      const idx = sentence.indexOf(name);
      if (idx === -1) continue;
      const start = idx;
      const end = idx + name.length;
      const overlaps = ranges.some((r) => start < r.end && end > r.start);
      if (!overlaps) ranges.push({start, end, category: point.category});
    }

    ranges.sort((a, b) => a.start - b.start);

    let cursor = 0;
    for (const range of ranges) {
      if (range.start > cursor) {
        frag.append(document.createTextNode(sentence.slice(cursor, range.start)));
      }
      const span = el('span', 'jgt-grammar-highlight', sentence.slice(range.start, range.end));
      span.style.color = highlightColorFor(range.category);
      frag.append(span);
      cursor = range.end;
    }
    if (cursor < sentence.length) {
      frag.append(document.createTextNode(sentence.slice(cursor)));
    }

    return frag;
  }

  /**
   * Sentence + "Show Translation" toggle. Translation is hidden by default
   * unless expanded is true. Grammar points found in the sentence are
   * highlighted inline in their category color, unless highlighting is
   * disabled in settings.
   * @param {{sentence: string, translation: string, grammarPoints: Array<object>}} data
   * @param {boolean} translationExpanded
   * @param {boolean} highlightEnabled
   * @param {() => void} onToggleTranslation
   * @returns {HTMLElement}
   */
  function renderSentenceOverview(data, translationExpanded, highlightEnabled, onToggleTranslation) {
    const wrap = el('div', 'jgt-sentence-section');
    const sentenceNode = el('div', 'jgt-sentence-jp');
    if (highlightEnabled) {
      sentenceNode.append(buildHighlightedSentence(data.sentence || '', data.grammarPoints));
    } else {
      sentenceNode.textContent = data.sentence || '';
    }
    wrap.append(sentenceNode);

    const toggle = el('button', 'jgt-translation-toggle', translationExpanded ? '\u25bc Hide Translation' : '\u25bc Show Translation');
    toggle.type = 'button';
    toggle.addEventListener('click', onToggleTranslation);
    wrap.append(toggle);

    if (translationExpanded) {
      const transBlock = el('div', 'jgt-translation-block');
      transBlock.append(el('div', 'jgt-translation-label', 'Translation'));
      transBlock.append(el('div', 'jgt-translation-text', data.translation || ''));
      wrap.append(transBlock);
    }

    return wrap;
  }

  /**
   * The compact "Grammar Found" list — one row per grammar point, showing
   * only the color square + arrow + name until clicked.
   * @param {Array<object>} grammarPoints
   * @param {?number} openIndex Index of the currently expanded point (accordion mode), or null.
   * @param {Set<number>} multiExpandedSet Used instead of openIndex when auto-expand is on.
   * @param {boolean} autoExpandMode
   * @param {string[]} sentenceBreakdown shared full-sentence breakdown, rendered inside every expanded card
   * @param {(index: number) => void} onToggle
   * @returns {HTMLElement}
   */
  function renderGrammarFoundSection(grammarPoints, openIndex, multiExpandedSet, autoExpandMode, sentenceBreakdown, onToggle) {
    const wrap = el('div', 'jgt-section jgt-grammar-section');
    wrap.append(el('div', 'jgt-section-heading', 'Grammar Found'));

    const list = Array.isArray(grammarPoints) ? grammarPoints : [];
    if (list.length === 0) {
      wrap.append(el('div', 'jgt-status', 'No notable grammar detected with the current settings.'));
      return wrap;
    }

    for (let i = 0; i < list.length; i++) {
      const point = list[i];
      const isOpen = autoExpandMode ? multiExpandedSet.has(i) : openIndex === i;

      const row = el('button', 'jgt-grammar-row');
      row.type = 'button';
      row.append(el('span', 'jgt-grammar-arrow', isOpen ? '\u25bc' : '\u25b6'));
      row.append(el('span', 'jgt-grammar-name', point.displayName || ''));
      row.addEventListener('click', () => onToggle(i));
      wrap.append(row);

      if (isOpen) {
        wrap.append(renderGrammarDetail(point, sentenceBreakdown));
      }
    }

    return wrap;
  }

  /**
   * @param {object} point
   * @param {Array<{fragment: string, meaning: string}>} sentenceBreakdown
   * @returns {HTMLElement}
   */
  function renderGrammarDetail(point, sentenceBreakdown) {
    const detail = el('div', 'jgt-grammar-detail');

    if (point.meaning) {
      detail.append(fieldBlock('Meaning', point.meaning));
    }
    if (point.formation) {
      detail.append(fieldBlock('How it\u2019s formed', point.formation));
    }
    if (point.nuance) {
      detail.append(fieldBlock('Nuance', point.nuance));
    }
    if (point.example) {
      detail.append(fieldBlock('Example', point.example));
    }
    if (Array.isArray(sentenceBreakdown) && sentenceBreakdown.length > 0) {
      const breakdownBlock = el('div', 'jgt-field-block');
      breakdownBlock.append(el('div', 'jgt-field-label', 'Breakdown of the selected sentence'));
      const list = el('div', 'jgt-breakdown-list');
      for (const chunk of sentenceBreakdown) {
        const row = el('div', 'jgt-breakdown-row');
        row.append(el('span', 'jgt-breakdown-fragment', chunk.fragment || ''));
        row.append(el('span', 'jgt-breakdown-meaning', chunk.meaning || ''));
        list.append(row);
      }
      breakdownBlock.append(list);
      detail.append(breakdownBlock);
    }
    if (Array.isArray(point.similarGrammar) && point.similarGrammar.length > 0) {
      detail.append(renderSimilarGrammar(point.similarGrammar));
    }

    return detail;
  }

  /**
   * @param {string} label
   * @param {string} value
   * @returns {HTMLElement}
   */
  function fieldBlock(label, value) {
    const block = el('div', 'jgt-field-block');
    block.append(el('div', 'jgt-field-label', label));
    block.append(el('div', 'jgt-field-value', value));
    return block;
  }

  /**
   * Collapsed-by-default "Similar grammar" list, each entry independently
   * expandable to show its comparison note.
   * @param {Array<{name: string, note: string}>} similarGrammar
   * @returns {HTMLElement}
   */
  function renderSimilarGrammar(similarGrammar) {
    const wrap = el('div', 'jgt-similar-section');
    wrap.append(el('div', 'jgt-field-label', 'Similar grammar'));
    for (const item of similarGrammar) {
      const row = el('div', 'jgt-similar-item');
      const toggle = el('button', 'jgt-similar-toggle', `\u25b6 ${item.name || ''}`);
      toggle.type = 'button';
      const note = el('div', 'jgt-similar-note', item.note || '');
      note.hidden = true;
      toggle.addEventListener('click', () => {
        const isOpen = !note.hidden;
        note.hidden = isOpen;
        toggle.textContent = `${isOpen ? '\u25b6' : '\u25bc'} ${item.name || ''}`;
      });
      row.append(toggle, note);
      wrap.append(row);
    }
    return wrap;
  }

  window.JGTComponents = {
    el,
    clearChildren,
    renderSentenceOverview,
    renderGrammarFoundSection,
  };
})();
