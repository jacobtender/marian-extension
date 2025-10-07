import { showStatus } from "./ui.js";

function buildIssueUrl(tabUrl) {
  const domain = new URL(tabUrl).hostname.replace(/^www\./, '');
  const title = `Unsupported URL detected on ${domain}`;
  const body = [
    'This page is not currently supported by Marian:',
    '',
    tabUrl,
    '',
    '**Steps to reproduce:**',
    '1. Open the above URL with the extension installed',
    '2. Open the extension sidebar',
    '3. See that details are not loaded',
    '',
    '**Expected behavior:**',
    'Details should load for supported product pages.'
  ].join('\n');

  return 'https://github.com/jacobtender/marian-extension/issues/new'
    + `?title=${encodeURIComponent(title)}`
    + `&body=${encodeURIComponent(body)}`
    + `&labels=${encodeURIComponent('bug')}`;
}

// Polling function to try multiple times before giving up
export function tryGetDetails(retries = 8, delay = 300) {
  let didRefresh = false;

  return new Promise((resolve, reject) => {
    function attempt(remaining) {
      chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
        if (!tab?.id) {
          reject('No active tab found.');
          return;
        }

        if (tab.status !== 'complete') {
          console.log('Tab is still loading, delaying content-script ping...');
          setTimeout(() => attempt(remaining), delay);
          return;
        }

        chrome.tabs.sendMessage(tab.id, 'ping', (response) => {
          console.log('Ping response:', response, 'Remaining attempts:', remaining);
          if (chrome.runtime.lastError || response !== 'pong') {
            if (remaining > 0) {
              setTimeout(() => attempt(remaining - 1), delay);
            } else {
              if (!didRefresh) {
                didRefresh = true;
                // showStatus("Content script not ready, refreshing tab...");
                chrome.tabs.reload(tab.id, { bypassCache: true });
                showStatus("Tab reloaded, fetching details...");

                const onUpdated = (updatedTabId, info) => {
                  if (updatedTabId === tab.id && info.status === 'complete') {
                    chrome.tabs.onUpdated.removeListener(onUpdated);
                    console.log(retries, 'Tab reloaded, fetching details again...');
                    setTimeout(() => attempt(retries), 350);
                  }
                };
                chrome.tabs.onUpdated.addListener(onUpdated);
              } else {
                console.log('All attempts exhausted. Content script not responding.');
                const issueUrl = buildIssueUrl(tab?.url || '(unknown URL)');
                showStatus(`
                  This site is supported, but either this page isn't yet or you've encountered an error.<br/><br/>
                  Please <a href="${issueUrl}" target="_blank" rel="noopener noreferrer">report</a> the full URL of this page so we can add support!
                `);
                // reject('Unsupported URL or no content script after refresh.');
              }
            }
            return;
          }

          chrome.tabs.sendMessage(tab.id, 'getDetails', (details) => {
            if (chrome.runtime.lastError || !details) {
              reject('Failed to retrieve book details.');
              return;
            }
            resolve(details);
          });
        });
      });
    }
    attempt(retries);
  });
}
