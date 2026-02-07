import { isAllowedUrl } from "./extractors";
import { getCurrentTab } from "./popup/utils";
import { runtime, StorageBackedSet } from "./shared/utils"

const activeSidebarWindows = new StorageBackedSet("active_sidebar_windows");

chrome.runtime.onInstalled.addListener(async () => {
  await activeSidebarWindows.clear();
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
  }
});

chrome.runtime.onStartup.addListener(async () => {
  await activeSidebarWindows.clear();
});

function updateIcon(tabId, isAllowed) {
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

const IGNORED_RUNTIME_ERRORS = new Set([
  "Could not establish connection. Receiving end does not exist.",
  "The message port closed before a response was received."
]);

function safeRuntimeSend(message) {
  const maybePromise = chrome.runtime.sendMessage(message, () => {
    const error = chrome.runtime.lastError;
    if (error && !IGNORED_RUNTIME_ERRORS.has(error.message)) {
      console.warn("Runtime message failed:", error);
    }
  });

  // MV3 promises if no callback listener exists; catch to avoid unhandled rejections.
  if (maybePromise && typeof maybePromise.then === "function") {
    maybePromise.catch((error) => {
      if (!error || IGNORED_RUNTIME_ERRORS.has(error.message)) return;
      console.warn("Runtime message failed:", error);
    });
  }
}

function sendWhenReady(msg, retries = 10, delay = 150) {
  function attempt(remaining) {
    if (msg?.windowId && !hasActiveSidebar(msg.windowId)) {
      if (remaining > 0) {
        setTimeout(() => attempt(remaining - 1), delay);
      }
      return;
    }

    chrome.runtime.sendMessage({ type: "SIDEBAR_PING", windowId: msg?.windowId }, (response) => {
      const error = chrome.runtime.lastError;
      if (error || response !== "pong") {
        if (remaining > 0) {
          setTimeout(() => attempt(remaining - 1), delay);
        }
        return;
      }

      safeRuntimeSend(msg);
    });
  }
  attempt(retries);
}

function hasActiveSidebar(windowId) {
  return typeof windowId === "number" && activeSidebarWindows.hasSync(windowId);
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

const windowReady = {};

chrome.action.onClicked.addListener((tab) => {
  if (!tab?.url) return;

  if (!isAllowedUrl(tab.url)) {
    updateIcon(tab.id, false);
    showUnsupportedNotification(tab);
    return;
  }

  openSidebar(tab);

  // wait for pane before requesting a refresh
  new Promise((ready) => {
    if (activeSidebarWindows.has(tab.windowId)) {
      // exit early if already open
      ready();
      return;
    }

    windowReady[tab.windowId] = ready;
  }).then(() => {
    sendWhenReady({ type: "REFRESH_SIDEBAR", url: tab.url, windowId: tab.windowId });
  })
});

// when tab URL changes in the current active tab
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.active && changeInfo.url && hasActiveSidebar(tab.windowId)) {
    safeRuntimeSend({ type: "TAB_URL_CHANGED", url: changeInfo.url, windowId: tab.windowId });
  }
});

// when the active tab changes
chrome.tabs.onActivated.addListener(() => {
  getCurrentTab().then((tab) => {
    if (!tab || !hasActiveSidebar(tab.windowId)) return;
    safeRuntimeSend({ type: "TAB_URL_CHANGED", url: tab.url || "", windowId: tab.windowId });
  });
});

// Listen for messages from the content script.
runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request == undefined) return false;

  if (request.type === "REFRESH_ICON" && request.tab != undefined) {
    const tabId = request.tab.id;
    const url = request.tab.url;
    if (typeof tabId === "number") {
      updateIcon(tabId, isAllowedUrl(url));
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: "Invalid tab ID" });
    }
    return true;
  }
  if (request?.type === "SIDEBAR_READY") {
    if (request.windowId in windowReady) {
      windowReady[request.windowId]();
      delete windowReady[request.windowId];
    }

    (async () => {
      if (typeof request.windowId === "number") {
        await activeSidebarWindows.add(request.windowId);
      }
      if (typeof sendResponse === "function") sendResponse(true);
    })();
    return true;
  }

  if (request?.type === "SIDEBAR_UNLOADED") {
    (async () => {
      if (typeof request.windowId === "number") {
        await activeSidebarWindows.delete(request.windowId);
      }
      if (typeof sendResponse === "function") sendResponse(true);
    })();
    return true;
  }

  if (request.action === 'fetchDepositData') {
    handleFetchRequest(request.url).then(sendResponse);
    return true;
  }
  return false;
});

chrome.windows.onRemoved.addListener(async (windowId) => {
  await activeSidebarWindows.delete(windowId);
});

async function handleFetchRequest(url) {
  // console.log("got request", url);
  try {
    const response = await fetch(url);
    // console.log("fetched", response);

    if (!response.ok) {
      return {
        status: 'error',
        message: `HTTP error! status: ${response.status}`
      };
    }

    const text = await response.text();
    // console.log("got text", text);

    return {
      status: 'success',
      data: text
    };
  } catch (error) {
    return {
      status: 'error',
      message: `Failed to fetch data: ${error.message}`
    };
  }
}
