import { getExtractor } from './extractors';
import { logMarian } from './shared/utils.js';

async function getDetails() {
  const url = window.location.href;
  logMarian(`Current URL: ${url}`);
  const extractor = getExtractor(url);
  if (extractor == undefined) return {};

  logMarian(`Getting details from ${extractor}`)
  return await extractor.getDetails()
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg === 'ping_content') {
    sendResponse('pong');
    return false;
  }

  if (msg === 'getDetails') {
    const send = async () => {
      try {
        const details = await getDetails();
        sendResponse(details);
      } catch (e) {
        logMarian("Error getting info", e);
        sendResponse({ __marian_error: e.message || String(e) });
      }
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', send, { once: true });
    } else {
      send();
    }

    // Important: keep the message channel open for async response
    return true;
  }
});

console.log('[👩🏻‍🏫 Marian] content.js loaded');
