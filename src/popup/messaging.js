import { getExtractor } from "../extractors/index.js";
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

/**
  * Polling function to try multiple times before giving up
  *
  * @param {chrome.tabs.Tab} tab 
  * @param {number} [retries=8] number of time to retry
  * @param {number} [delay=300] delay in ms
  * @returns {Promise<{tab: any, details: Record<string,any>}>}
  */
export async function tryGetDetails(tab, retries = 8, delay = 300) {
  let hasReloaded = false;
  let hasInjected = false;

  return new Promise((resolve, reject) => {
    if (!tab?.id) {
      reject('No active tab found.');
      return;
    }

    async function attempt(remaining) {
      try {
        tab = await waitForTabToComplete(tab.id);
      } catch (e) {
        reject(e);
        return;
      }

      const pingResp = await chrome.tabs.sendMessage(tab.id, 'ping_content').catch(() => undefined);
      console.log('Ping response:', pingResp, 'Remaining attempts:', remaining);
      const pingFail = chrome.runtime.lastError || pingResp !== 'pong';

      if (pingFail) {
        if (chrome.runtime.lastError) {
          console.error('Content script not ready:', chrome.runtime.lastError.message);
        }

        const extractor = getExtractor(tab?.url || "");
        const wantsReload = extractor != undefined && extractor.needsReload;

        if (wantsReload && !hasReloaded) {
          hasReloaded = true;
          chrome.tabs.reload(tab.id, { bypassCache: false });
          showStatus("Tab reloaded, fetching details...");

          const onUpdated = (updatedTabId, info) => {
            if (updatedTabId === tab.id && info.status === 'complete') {
              chrome.tabs.onUpdated.removeListener(onUpdated);
              console.log(retries, 'Tab reloaded, fetching details again...');
              setTimeout(() => attempt(retries), 50);
            }
          };
          chrome.tabs.onUpdated.addListener(onUpdated);
          return;
        }

        if (!hasInjected) {
          try {
            console.log("injecting new script");
            hasInjected = true;
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['content.js']
            });
          } catch (e) {
            const error = chrome.runtime.lastError || e;
            const errorMessage = error.message ?? error.toString();

            console.error("error injecting script", error);
            if (errorMessage.includes("Missing host permission")) {
              console.log("Missing permission error detected. Checking permissions...");
              hasInjected = false;

              try {
                const hasPerms = await new Promise(r => chrome.permissions.contains({ origins: [tab.url] }, r));
                console.log(`Permissions for ${tab.url}: ${hasPerms}`);

                if (!hasPerms) {
                  // Create a button for obtaining permission, the code has to run in ui, will restart the call afterwards
                  const url = new URL(tab.url);
                  const origin = `${url.protocol}//${url.host}/*`;
                  showStatus(`Permissions lost after reload.<br/>
<button 
  id="permGrant" 
  data-origin=${origin}
  data-tab-id=${tab.id}
>Grant Permissions</button>`);

                  return;
                }
              } catch (err) {
                console.error("Error checking permissions/tab:", err);
              }

              // If we think we have permissions (or check failed), retry with backoff
              if (remaining > 0) {
                setTimeout(() => attempt(remaining - 1), 1000);
              }
              return;
            }
            showStatus("Cannot access this page.");
            return;
          }

          // Wait a tiny bit for the script to initialize listeners, then retry
          setTimeout(() => {
            console.log(retries, 'Script injected, retrying...');
            attempt(retries);
          }, 50);
          return;
        }

        if (remaining > 0) {
          setTimeout(() => attempt(remaining - 1), delay);
          return;
        }

        console.log('All attempts exhausted. Content script not responding.');
        const issueUrl = buildIssueUrl(tab?.url || '(unknown URL)');
        reject(`
This site is supported, but either this page isn't yet or you've encountered an error.<br/><br/>
Please <a href="${issueUrl}" target="_blank" rel="noopener noreferrer">report</a> the full URL of this page so we can add support!
`);
        return;
      }

      chrome.tabs.sendMessage(tab.id, 'getDetails', (details) => {
        if (chrome.runtime.lastError || !details) {
          reject('Failed to retrieve book details.');
          return;
        }
        resolve(details);
      });
    }
    attempt(retries);
  });
}

/**
 * Waits for a specific tab to reach the 'complete' status.
 *
 * This function first checks the current status of the tab. If it is already
 * complete, it resolves immediately. Otherwise, it sets up a one-time listener
 * on `chrome.tabs.onUpdated` to resolve when the status changes to 'complete'.
 *
 * @param {number} tabId - The unique ID of the tab to wait for.
 * @returns {Promise<chrome.tabs.Tab>} A promise that resolves with the fully loaded Tab object.
 */
function waitForTabToComplete(tabId) {
  return new Promise((resolve, reject) => {
    function listener(updatedTabId, changeInfo, updatedTab) {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve(updatedTab);
      }
    };

    chrome.tabs.onUpdated.addListener(listener);

    chrome.tabs.get(tabId, (tab) => {
      // could have issues if tab is closed, so reject
      if (chrome.runtime.lastError) {
        chrome.tabs.onUpdated.removeListener(listener);
        reject(chrome.runtime.lastError);
        return;
      }

      if (tab.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve(tab);
      }
    });
  });
}
