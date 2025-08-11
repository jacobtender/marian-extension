import { isAllowedUrl } from "./shared/allowed-patterns";

function updateIcon(tabId, isAllowed) {
  // console.log(`Updating icon for tab ${tabId}: ${isAllowed ? 'allowed' : 'not allowed'}`);
  chrome.action.setIcon({
    tabId,
    path: isAllowed
      ? {
        128: "icons/icon.png"
      }
      : {
        128: "icons/icon-disabled.png",
      }
  });
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!tab.url) return;
  updateIcon(tabId, isAllowedUrl(tab.url));
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
  chrome.tabs.get(tabId, (tab) => {
    if (!tab?.url) return;
    updateIcon(tabId, isAllowedUrl(tab.url));
  });
});

// Toggle the injected sidebar (works in Chrome + Firefox)
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab?.id) return;
  console.log(`Toggling sidebar for tab ${tab.id}`);
  try {
    await chrome.tabs.sendMessage(tab.id, { type: "MARIAN_TOGGLE_SIDEBAR" });
  } catch (e) {
    // If content scripts aren't ready yet, retry shortly
    setTimeout(() => {
      chrome.tabs.sendMessage(tab.id, { type: "MARIAN_TOGGLE_SIDEBAR" }).catch(() => {});
    }, 250);
  }
});