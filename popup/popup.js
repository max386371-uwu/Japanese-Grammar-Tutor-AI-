// Kept as a plain classic script (popup.html loads it without
// type="module"), so the message type is duplicated here rather than
// imported — must stay in sync with lib/constants.js's MESSAGE_TYPES.OPEN_PANEL_FOR_TEXT.
const OPEN_PANEL_FOR_TEXT = 'OPEN_PANEL_FOR_TEXT';

const input = document.getElementById('jgtp-input');
const button = document.getElementById('jgtp-explain');
const status = document.getElementById('jgtp-status');
const optionsLink = document.getElementById('jgtp-options-link');

optionsLink.addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

button.addEventListener('click', async () => {
  const text = input.value.trim();
  if (!text) {
    status.textContent = 'Type a sentence first.';
    return;
  }

  const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
  if (!tab?.id) {
    status.textContent = 'No active tab found.';
    return;
  }

  try {
    await chrome.tabs.sendMessage(tab.id, {type: OPEN_PANEL_FOR_TEXT, text});
    status.textContent = 'Opened on the page.';
    window.close();
  } catch {
    status.textContent = 'Could not reach this page (try a normal webpage, not a browser settings page).';
  }
});
