import { normalizeUrl } from "../extractors";

let __lastFetchedNorm = '';

export function setLastFetchedUrl(url) {
  __lastFetchedNorm = normalizeUrl(url);
}

export function getLastFetchedUrl() {
  return __lastFetchedNorm;
}

let sidebarWindowId = null;

export function rememberWindowId(windowInfo) {
  if (windowInfo && typeof windowInfo.id === "number") {
    sidebarWindowId = windowInfo.id;
  }
}

export function notifyBackground(type, params = {}) {
  if (type === "SIDEBAR_UNLOADED" && typeof sidebarWindowId === "number") {
    chrome.runtime.sendMessage({ type, windowId: sidebarWindowId }, () => {
      void chrome.runtime.lastError;
    });
    return;
  }

  chrome.windows.getCurrent((windowInfo) => {
    rememberWindowId(windowInfo);
    const windowId = typeof sidebarWindowId === "number" ? sidebarWindowId : windowInfo?.id;
    chrome.runtime.sendMessage({ type, windowId, ...params }, () => {
      // ignore missing listeners; background may be sleeping in some contexts
      void chrome.runtime.lastError;
    });
  });
}

export function isForThisSidebar(messageWindowId) {
  if (typeof messageWindowId !== "number") return true;
  if (typeof sidebarWindowId !== "number") return false;
  return messageWindowId === sidebarWindowId;
}


export function buildIssueUrl(tabUrl) {
  let domain = '(unknown domain)';
  try { domain = new URL(tabUrl).hostname.replace(/^www\./, ''); } catch { }
  const title = `Unsupported URL detected on ${domain}`;
  const body = [
    'This page is not currently supported by the Marian extension:',
    '', tabUrl, '',
    '**Steps to reproduce:**',
    '1. Open the above URL with the extension installed',
    '2. Open the extension sidebar',
    '3. See that details are not loaded',
    '', '**Expected behavior:**',
    'Details should load for supported product pages.'
  ].join('\n');
  const labels = 'bug';
  return 'https://github.com/jacobtender/marian-extension/issues/new'
    + `?title=${encodeURIComponent(title)}`
    + `&body=${encodeURIComponent(body)}`
    + `&labels=${encodeURIComponent(labels)}`;
}

/**
 * Gets the current active tab
 * 
 * @returns {Promise<chrome.tabs.Tab | undefined>} A promise that resolves to the active tab object, or undefined if no active tab is found.
 */
export async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}
