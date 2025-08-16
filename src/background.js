import { isAllowedUrl } from "./shared/allowed-patterns";

function updateIcon(tabId, isAllowed) {
  console.log(tabId, isAllowed);
  chrome.action.setIcon({
    tabId,
    path: isAllowed
      ? { 128: "icons/icon.png" }
      : { 128: "icons/icon-disabled.png" }
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

function openSidebar(tab) {
  if (typeof chrome.sidePanel !== "undefined" && chrome.sidePanel.open) {
    // Chrome Side Panel API
    chrome.sidePanel.open({ windowId: tab.windowId });
  } else if (chrome.sidebarAction && chrome.sidebarAction.open) {
    // Firefox Sidebar API
    chrome.sidebarAction.open();
  } else {
    console.warn("No native sidebar API available.");
  }
}

function sendWhenReady(msg, retries = 10, delay = 150) {
  function attempt(remaining) {
    chrome.runtime.sendMessage({ type: "ping" }, (response) => {
      if (response === "pong") {
        chrome.runtime.sendMessage(msg);
      } else if (remaining > 0) {
        setTimeout(() => attempt(remaining - 1), delay);
      }
    });
  }
  attempt(retries);
}

function showUnsupportedNotification(tab) {
  try {
    chrome.notifications.create(
      // use a unique id so repeated clicks update the same notification
      "marian-unsupported",
      {
        type: "basic",
        iconUrl: "icons/icon-shush.png",
        title: "Shhhh...",
        message: "You cannot do that here!"
      },
      (id) => {
        setTimeout(() => chrome.notifications.clear(id || "marian-unsupported"), 3000);
      }
    );
  } catch (e) {
    console.warn("Notification failed:", e);
  }
}

chrome.action.onClicked.addListener((tab) => {
  if (!tab?.url) return;

  if (!isAllowedUrl(tab.url)) {
    showUnsupportedNotification(tab);
    return;
  }

  openSidebar(tab);
  setTimeout(() => {
    sendWhenReady({ type: "REFRESH_SIDEBAR", url: tab.url });
  }, 300); // give the sidebar a moment to load
});
