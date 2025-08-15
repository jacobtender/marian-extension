import { getAmazonDetails } from './extractors/amazon.js';
import { getGoodreadsDetails } from './extractors/goodreads.js';
import { getStoryGraphDetails } from './extractors/storygraph.js';
import { getGoogleBooksDetails } from './extractors/googlebooks.js';
import { getKoboDetails } from './extractors/kobo.js';
import { logMarian } from './shared/utils.js';


async function getDetails() {
  const url = window.location.href;
  logMarian(`Current URL: ${url}`);
  if (url.includes('amazon')) return await getAmazonDetails();
  if (url.includes('goodreads')) return await getGoodreadsDetails();
  if (url.includes('thestorygraph')) return await getStoryGraphDetails();
  if (url.includes('isbnsearch.org')) return getIsbnSearchDetails();
  if (url.includes('google')) return await getGoogleBooksDetails();
  if (url.includes('kobo')) return await getKoboDetails();
  return {};
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg === 'ping') {
    sendResponse('pong');
  }

  if (msg === 'getDetails') {
    const send = async () => {
      const details = await getDetails();
      sendResponse(details);
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', send);
    } else {
      send();
    }

    // Important: keep the message channel open for async response
    return true;
  }
});

console.log('[👩🏻‍🏫 Marian] content.js loaded');