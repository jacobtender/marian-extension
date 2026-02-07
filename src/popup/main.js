import { isAllowedUrl } from "../extractors";
import { tryGetDetails } from "./messaging.js";
import {
  showStatus, showDetails, renderDetails, initSidebarLogger,
  addRefreshButton, updateRefreshButtonForUrl
} from "./ui.js";
import { setLastFetchedUrl, getCurrentTab, notifyBackground, rememberWindowId, isForThisSidebar } from "./utils.js";

const DEBUG = false;

document.addEventListener("DOMContentLoaded", () => {
  notifyBackground("SIDEBAR_READY");
  window.addEventListener("pagehide", () => notifyBackground("SIDEBAR_UNLOADED"));

  chrome.windows.getCurrent(rememberWindowId);

  if (DEBUG) initSidebarLogger(); // DEBUG: Initialize sidebar logger

  getCurrentTab().then((tab) => {
    const url = tab?.url || "";

    showStatus("DOM Loaded, fetching details...");

    addRefreshButton();
    updateRefreshButtonForUrl(url);

    if (!isAllowedUrl(url)) {
      showStatus("This extension only works on supported product pages.");
      return;
    }
  });
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "SIDEBAR_PING") {
    if (isForThisSidebar(msg.windowId)) {
      sendResponse("pong");
    }
    return;
  }

  if (msg.type === "REFRESH_SIDEBAR" && isForThisSidebar(msg.windowId) && msg.url && isAllowedUrl(msg.url)) {
    (async () => {
      showStatus("Loading details...");
      let tab = await getCurrentTab();
      try {
        const details = await tryGetDetails(tab);
        showDetails();
        const detailsEl = document.getElementById('details');
        if (detailsEl) detailsEl.innerHTML = "";
        await renderDetails(details);

        setLastFetchedUrl(tab?.url || "");
        getCurrentTab().then((activeTab) => {
          updateRefreshButtonForUrl(activeTab?.url || "");
        });

      } catch (err) {
        console.log("err", err);
        showStatus(err);
        notifyBackground("REFRESH_ICON", { tab });
      };
    })();
  }

  if (msg.type === "TAB_URL_CHANGED" && isForThisSidebar(msg.windowId)) {
    updateRefreshButtonForUrl(msg.url);
  }
});
