import '../lib/constants.js';

const {STORAGE_KEYS} = globalThis.JGT_CONSTANTS;

const searchInput = document.getElementById('jgtb-search');
const listEl = document.getElementById('jgtb-list');
const emptyEl = document.getElementById('jgtb-empty');

/** @type {Array<object>} */
let bookmarks = [];
/** @type {Set<string>} ids currently expanded to show detail */
const expandedIds = new Set();

async function load() {
  const result = await new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEYS.BOOKMARKS], resolve);
  });
  bookmarks = Array.isArray(result[STORAGE_KEYS.BOOKMARKS]) ? result[STORAGE_KEYS.BOOKMARKS] : [];
  bookmarks.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
  render();
}

async function persist() {
  await new Promise((resolve) => {
    chrome.storage.local.set({[STORAGE_KEYS.BOOKMARKS]: bookmarks}, resolve);
  });
}

function render() {
  const query = searchInput.value.trim().toLowerCase();
  const filtered = query
    ? bookmarks.filter(
        (b) =>
          (b.sentence || '').toLowerCase().includes(query) ||
          (b.translation || '').toLowerCase().includes(query),
      )
    : bookmarks;

  listEl.innerHTML = '';
  emptyEl.hidden = bookmarks.length > 0;

  if (bookmarks.length > 0 && filtered.length === 0) {
    const noResults = document.createElement('div');
    noResults.className = 'jgtb-empty';
    noResults.textContent = 'No saved explanations match your search.';
    listEl.append(noResults);
    return;
  }

  for (const bookmark of filtered) {
    listEl.append(buildItem(bookmark));
  }
}

/**
 * @param {object} bookmark
 * @returns {HTMLElement}
 */
function buildItem(bookmark) {
  const item = document.createElement('div');
  item.className = 'jgtb-item';

  const header = document.createElement('div');
  header.className = 'jgtb-item-header';

  const sentence = document.createElement('div');
  sentence.className = 'jgtb-item-sentence';
  sentence.textContent = bookmark.sentence || '';
  header.append(sentence);

  const date = document.createElement('div');
  date.className = 'jgtb-item-date';
  date.textContent = bookmark.savedAt ? new Date(bookmark.savedAt).toLocaleDateString() : '';
  header.append(date);

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'jgtb-item-delete';
  deleteBtn.type = 'button';
  deleteBtn.textContent = '\u00d7';
  deleteBtn.title = 'Remove bookmark';
  deleteBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    bookmarks = bookmarks.filter((b) => b.id !== bookmark.id);
    await persist();
    render();
  });
  header.append(deleteBtn);

  header.addEventListener('click', () => {
    if (expandedIds.has(bookmark.id)) expandedIds.delete(bookmark.id);
    else expandedIds.add(bookmark.id);
    render();
  });

  item.append(header);

  if (expandedIds.has(bookmark.id)) {
    item.append(buildDetail(bookmark));
  }

  return item;
}

/**
 * @param {object} bookmark
 * @returns {HTMLElement}
 */
function buildDetail(bookmark) {
  const detail = document.createElement('div');
  detail.className = 'jgtb-item-detail';

  if (bookmark.translation) {
    const translation = document.createElement('div');
    translation.className = 'jgtb-translation';
    translation.textContent = bookmark.translation;
    detail.append(translation);
  }

  const grammarPoints = Array.isArray(bookmark.grammarPoints) ? bookmark.grammarPoints : [];
  if (grammarPoints.length > 0) {
    const list = document.createElement('div');
    list.className = 'jgtb-grammar-list';
    for (const point of grammarPoints) {
      const entry = document.createElement('div');
      entry.className = 'jgtb-grammar-entry';
      const name = document.createElement('div');
      name.className = 'jgtb-grammar-name';
      name.textContent = point.displayName || '';
      entry.append(name);
      if (point.meaning) {
        const meaning = document.createElement('div');
        meaning.textContent = point.meaning;
        entry.append(meaning);
      }
      list.append(entry);
    }
    detail.append(list);
  }

  return detail;
}

searchInput.addEventListener('input', render);

load();
