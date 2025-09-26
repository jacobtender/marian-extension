import { isAllowedUrl } from "../shared/allowed-patterns.js";
import { tryGetDetails } from "./messaging.js";
import { showStatus, showDetails, renderDetails, initSidebarLogger, 
  addRefreshButton, updateRefreshButtonForUrl } from "./ui.js";
import { setLastFetchedUrl } from "./utils.js";

const DEBUG = false;
let sidebarWindowId = null;

function rememberWindowId(windowInfo) {
  if (windowInfo && typeof windowInfo.id === "number") {
    sidebarWindowId = windowInfo.id;
  }
}

function notifyBackground(type) {
  if (type === "SIDEBAR_UNLOADED" && typeof sidebarWindowId === "number") {
    chrome.runtime.sendMessage({ type, windowId: sidebarWindowId }, () => {
      void chrome.runtime.lastError;
    });
    return;
  }

  chrome.windows.getCurrent((windowInfo) => {
    rememberWindowId(windowInfo);
    const windowId = typeof sidebarWindowId === "number" ? sidebarWindowId : windowInfo?.id;
    chrome.runtime.sendMessage({ type, windowId }, () => {
      // ignore missing listeners; background may be sleeping in some contexts
      void chrome.runtime.lastError;
    });
  });
}

function isForThisSidebar(messageWindowId) {
  if (typeof messageWindowId !== "number") return true;
  if (typeof sidebarWindowId !== "number") return false;
  return messageWindowId === sidebarWindowId;
}

document.addEventListener("DOMContentLoaded", () => {
  notifyBackground("SIDEBAR_READY");
  window.addEventListener("unload", () => notifyBackground("SIDEBAR_UNLOADED"));

  chrome.windows.getCurrent(rememberWindowId);

  if (DEBUG) initSidebarLogger(); // DEBUG: Initialize sidebar logger

  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    const url = tab?.url || "";

    updateRefreshButtonForUrl(url);

    if (!isAllowedUrl(url)) {
      showStatus("This extension only works on supported product pages.");
      return;
    }

    showStatus("DOM Loaded, fetching details...");
    tryGetDetails()
      .then(details => {
        showDetails();
        const detailsEl = document.getElementById('details');
        if (detailsEl) detailsEl.innerHTML = "";
        renderDetails(details);

        addRefreshButton(() => {
          showStatus("Refreshing...");
          tryGetDetails()
            .then(details => {
              showDetails();
              renderDetails(details);
            })
            .catch(err => showStatus(err));
        });

        chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
          const currentUrl = tab?.url || '';
          setLastFetchedUrl(currentUrl);
          updateRefreshButtonForUrl(currentUrl);
        });
      })
      .catch(err => {
        showStatus(err);
      });
  });
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg === "ping" || msg?.type === "ping") {
    sendResponse("pong");
    return;
  }

  if (msg?.type === "SIDEBAR_PING") {
    if (isForThisSidebar(msg.windowId)) {
      sendResponse("pong");
    }
    return;
  }

  if (msg.type === "REFRESH_SIDEBAR" && isForThisSidebar(msg.windowId) && msg.url && isAllowedUrl(msg.url)) {
    showStatus("Loading details...");
    tryGetDetails()
      .then(details => {
        showDetails();
        // clear previous content (matches your original)
        const detailsEl = document.getElementById('details');
        if (detailsEl) detailsEl.innerHTML = "";
        renderDetails(details);

        chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
          const currentUrl = tab?.url || '';
          setLastFetchedUrl(currentUrl);
          updateRefreshButtonForUrl(currentUrl);
        });
      })
      .catch(err => {
        showStatus(err);
      });
  }

  if (msg.type === "TAB_URL_CHANGED" && isForThisSidebar(msg.windowId)) {
    updateRefreshButtonForUrl(msg.url);
  }
});
