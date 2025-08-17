import { isAllowedUrl } from "../shared/allowed-patterns.js";
import { tryGetDetails } from "./messaging.js";
import { showStatus, showDetails, renderDetails, initSidebarLogger, 
  addRefreshButton, updateRefreshButtonForUrl } from "./ui.js";
import { setLastFetchedUrl } from "./utils.js";

const DEBUG = false;

document.addEventListener("DOMContentLoaded", () => {
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

// Keep your sidebar listener behavior exactly the same
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "ping") {
    sendResponse("pong");
    return;
  }

  if (msg.type === "REFRESH_SIDEBAR" && msg.url && isAllowedUrl(msg.url)) {
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

  if (msg.type === "TAB_URL_CHANGED") {
    updateRefreshButtonForUrl(msg.url);
  }
});
