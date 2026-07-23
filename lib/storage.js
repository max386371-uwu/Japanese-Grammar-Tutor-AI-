// Thin wrapper around chrome.storage.local so callers don't repeat the
// promise/callback boilerplate. Settings only — never used for per-request
// sentence data (that stays in-memory, message-passed, and discarded).

/**
 * @param {string[]} keys
 * @returns {Promise<object>}
 */
export function getSettings(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, (result) => resolve(result));
  });
}

/**
 * @param {object} values
 * @returns {Promise<void>}
 */
export function setSettings(values) {
  return new Promise((resolve) => {
    chrome.storage.local.set(values, () => resolve());
  });
}
