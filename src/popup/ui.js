import { tryGetDetails } from "./messaging.js";
import { isAllowedUrl, normalizeUrl } from "../extractors";
import { setLastFetchedUrl, getLastFetchedUrl, getCurrentTab, SetupSettings, getLocalDateFormat, orderedKeys, normalizeDetails, notifyBackground } from "./utils.js";

const settingsManager = SetupSettings(document.querySelector("#settings"), {
  hyphenateIsbn: {
    type: "selection", label: "Hyphenate ISBNs", options: {
      yes: "Yes",
      no: "No (Hardcover)",
      none: "Leave Alone",
    }, default: "none"
  },
  dateFormat: {
    type: "selection", label: "Format date", default: "local", options: {
      local: `Local format (${getLocalDateFormat()})`,
      ymd: "yyyy-mm-dd",
      dmy: "dd/mm/yyyy",
      mdy: "mm/dd/yyyy",
    }
  },
  filterNonHardcover: { type: "toggle", label: "Filter out non-Hardcover fields", default: false },
  keepFields: { type: "toggle", label: "Always display non-present Hardcover fields", default: false },
});

// DOM refs (looked up when functions are called)
function statusBox() { return document.getElementById('status'); }
function detailsBox() { return document.getElementById('details'); }

function copyToClipboard(text, labelEl) {
  navigator.clipboard.writeText(text).then(() => {
    const existing = labelEl.querySelector('.feedback');
    if (existing) existing.remove();
    const feedback = document.createElement('span');
    feedback.className = 'feedback';
    feedback.textContent = 'Copied!';
    labelEl.appendChild(feedback);
    setTimeout(() => feedback.remove(), 2000);
  });
}

function downloadImage(url, bookId) {
  const safeId = String(bookId || '').replace(/[^a-z0-9]/gi, '');
  const filename = `${safeId}_cover.jpg`;

  chrome.downloads.download({
    url: url,
    filename: filename,
    saveAs: false,
    conflictAction: 'uniquify'
  }, (downloadId) => {
    if (chrome.runtime.lastError) {
      console.error('Image download failed:', chrome.runtime.lastError);
      showStatus(`Download failed: ${chrome.runtime.lastError.message}`);
    } else {
      console.log('Image download started, ID:', downloadId);
    }
  });
}


function createSpan(parent, text, className, copyValue) {
  const span = document.createElement('span');
  span.className = className;
  span.textContent = text;
  span.title = 'Click to copy';
  span.style.cursor = 'pointer';

  span.addEventListener('click', () => copyToClipboard(copyValue || text, parent));

  parent.appendChild(span);
}

function renderRow(container, key, value) {
  const div = document.createElement('div');
  div.className = 'row';

  const addText = (text) => div.appendChild(document.createTextNode(text));
  const addSpan = (text, className, copyValue) => createSpan(div, text, className, copyValue);

  // Label
  const label = document.createElement('span');
  label.className = 'label';
  label.textContent = (key === 'title') ? 'Title:' : `${key}:`;
  div.appendChild(label);
  addText(' ');

  // Data
  const isContributors = key === 'Contributors' && Array.isArray(value) && value[0]?.roles;
  const isMappings = key === "Mappings" && value && typeof value === 'object';

  if (isContributors) {
    value.forEach((contributor, i) => {
      addSpan(contributor.name, 'value contributor-name');

      if (contributor.roles?.length) {
        addText(' (');
        contributor.roles.forEach((role, rI) => {
          addSpan(role, 'value contributor-role');
          if (rI !== contributor.roles.length - 1) addText(', ');
        });
        addText(')');
      }

      if (i !== value.length - 1) addText(', ');
    });
  } else if (isMappings) {
    const flatList = [];
    Object.entries(value).forEach(([source, ids]) => {
      if (Array.isArray(ids)) {
        ids.forEach(id => flatList.push({ id, source }));
      } else {
        flatList.push({ id, source });
      }
    });

    flatList.sort((a, b) => a.source.localeCompare(b.source) || a.id.localeCompare(b.id));

    flatList.forEach((item, i) => {
      addSpan(item.id, 'value mapping-id');
      addText(" (");
      addSpan(item.source, 'value mapping-name');
      addText(")");
      if (i !== flatList.length - 1) addText(', ');
    });
  } else if (Array.isArray(value)) {
    // Check for Standard Arrays
    value.forEach((item, i) => {
      let copyVal = item;

      // Special handling for Listening Length (copy digits only)
      if (key === 'Listening Length') {
        const match = item.match(/\d+/);
        if (match) copyVal = match[0];
      }

      addSpan(item, 'value', copyVal);

      if (i !== value.length - 1) {
        const separator = (key === 'Author' || key === 'Narrator') ? ', ' : ' ';
        addText(separator);
      }
    });
  } else {
    const className = (key === 'Description') ? 'value description' : 'value';
    addSpan(value, className);
  }

  container.appendChild(div);
}

export async function renderDetails(details) {
  // get settings
  const settings = await settingsManager.get();

  renderDetailsWithSettings(details, settings);

  const container = detailsBox();
  if (!container) return;

  // Create a unique marker element to track if this render is still active
  const markerId = `details-marker-${Date.now()}-${Math.random()}`;
  const marker = document.createElement('span');
  marker.id = markerId;
  marker.style.display = 'none';
  container.appendChild(marker);

  const unsub = settingsManager.subscribe((changes) => {
    // Check if marker still exists (component still mounted)
    if (!document.getElementById(markerId)) {
      unsub();
      return;
    }

    // update settings
    Object.entries(changes).forEach(([setting, { newValue }]) => settings[setting] = newValue);

    renderDetailsWithSettings(details, settings);
    container.appendChild(marker);
  });
}

function renderDetailsWithSettings(details, settings = {}) {
  details = normalizeDetails(details, settings, false);
  console.log('[Extension] Rendering details:', details);
  console.log('[Extension] Rendering settings:', settings);

  const container = detailsBox();
  if (!container) return;
  container.innerHTML = ""; // safety clear 

  const isEmpty = Object.keys(details).length === 0;
  if (isEmpty) return;

  const sideBySideWrapper = document.createElement('div');
  sideBySideWrapper.style.display = 'flex';
  sideBySideWrapper.style.alignItems = 'flex-start';
  sideBySideWrapper.style.gap = '1rem';

  const img = document.createElement('img');
  img.alt = 'Cover Image';
  img.style.maxWidth = '100px';
  img.style.minHeight = '100px';
  img.loading = 'lazy'; // lazy load for performance

  if (details.img) {
    img.src = details.img;
    img.title = 'Click to download';
    img.style.cursor = 'pointer';
    img.addEventListener('click', () => {
      const fallbackId =
        details['ISBN-13'] ||
        details['ISBN-10'] ||
        details['ASIN'] ||
        Object.values(details['Mappings'] || {})[0] ||
        details['Title'] ||
        Date.now();
      downloadImage(details.img, fallbackId);
    });
  } else {
    img.src = "icons/third-party/hardcover.svg";
    img.style.cursor = "auto";
    img.style.userSelect = "none";
    img.draggable = false;
  }

  const imgWrapper = document.createElement('div');
  imgWrapper.style.display = 'flex';
  imgWrapper.style.flexDirection = 'column';
  imgWrapper.style.alignItems = 'center';
  imgWrapper.style.position = 'relative';
  imgWrapper.style.maxWidth = '100px';

  imgWrapper.appendChild(img);

  if (details.imgScore && typeof details.imgScore === 'number') {
    const label = document.createElement('span');
    label.className = 'img-score-label';
    label.textContent = details.imgScore.toLocaleString();

    if (details.imgScore < 33000) {
      label.style.background = '#c0392b';
      label.title = 'Low resolution (ex: 133 x 200)';
      label.textContent = 'Poor';
    } else if (details.imgScore < 100000) {
      label.style.background = '#f39c12';
      label.title = 'Medium resolution (ex: 200 x 300)';
      label.textContent = 'Medium';
    } else {
      label.style.background = '#27ae60';
      label.title = 'High resolution (ex: 300 x 450)';
      label.textContent = 'High';
    }

    imgWrapper.appendChild(label);
  }

  sideBySideWrapper.appendChild(imgWrapper);

  const textWrapper = document.createElement('div');
  textWrapper.style.flex = '1';

  if (details.Title) {
    const titleDiv = document.createElement('div');
    titleDiv.className = 'row';

    const titleLabel = document.createElement('span');
    titleLabel.className = 'label';
    titleLabel.textContent = 'Title:';

    titleDiv.appendChild(document.createTextNode(' '));
    createSpan(titleDiv, details.Title, "value title");

    textWrapper.appendChild(titleDiv);
  }

  if (details.Description) {
    const descDiv = document.createElement('div');
    descDiv.className = 'row';

    const descLabel = document.createElement('span');
    descLabel.className = 'label';
    descLabel.textContent = 'Description:';

    descDiv.appendChild(document.createTextNode(' '));
    createSpan(descDiv, details.Description, "value description");

    textWrapper.appendChild(descDiv);
  }

  sideBySideWrapper.appendChild(textWrapper);
  container.appendChild(sideBySideWrapper);

  if (details.Series || details['Series Place']) {
    const metaTop = document.createElement('div');
    metaTop.style.margin = '8px 0 0 0';
    if (details.Series) renderRow(metaTop, 'Series', details.Series);
    if (details['Series Place']) renderRow(metaTop, 'Series Place', details['Series Place']);
    container.appendChild(metaTop);
  }

  const hr = document.createElement('hr');
  container.appendChild(hr);

  const rendered = new Set(['Series', 'Series Place']);
  orderedKeys.forEach(key => {
    if (key in details) {
      renderRow(container, key, details[key]);
      rendered.add(key);
    }

    // show warnings
    if (["ISBN-10", "ISBN-13"].includes(key)) {
      const valid = details[`${key}-valid`];
      if (!valid && valid != undefined) {
        const div = document.createElement('div');
        div.className = 'row warning';
        div.appendChild(document.createTextNode(
          "WARNING: The ISBN above is invalid!"
        ));
        container.appendChild(div);
      }
    }
    if ("ISBN-13" === key) {
      if ("ISBN-mismatch" in details && details["ISBN-mismatch"]) {
        const div = document.createElement('div');
        div.className = 'row warning';
        div.appendChild(document.createTextNode(
          "WARNING: The ISBN-10 and ISBN-13 do not belong to the same book"
        ));
        container.appendChild(div);
      }
    }
  });

  const filteredKeys = ['img', 'imgScore', 'Title', 'Description', "ISBN-10-valid", "ISBN-13-valid", "ISBN-mismatch"];
  Object.entries(details).forEach(([key, value]) => {
    if (filteredKeys.includes(key) || rendered.has(key)) return;
    renderRow(container, key, value);
  });
}

export function showStatus(message, options = {}) {
  const statusEl = statusBox();
  const detailsEl = detailsBox();
  if (!statusEl || !detailsEl) return;
  statusEl.style.display = 'block';
  statusEl.innerHTML = message;
  detailsEl.style.display = 'none';
}

export function showDetails() {
  const detailsEl = detailsBox();
  const statusEl = statusBox();
  if (!detailsEl) return;
  detailsEl.style.display = 'block';
  if (statusEl) statusEl.style.display = 'none';
}

// DEBUG: Sidebar logger: mirrors console.* into a sidebar status area
export function initSidebarLogger() {
  let host = document.getElementById('sidebar-status');
  if (!host) {
    host = document.createElement('div');
    host.id = 'sidebar-status';
    host.style.cssText = 'font:12px/1.4 system-ui, -apple-system, Segoe UI, Roboto, sans-serif; padding:8px 12px; margin-bottom: 2rem; max-height:160px; overflow:auto;';
    const container = detailsBox() || document.body;
    container.parentNode.insertBefore(host, container);
  }

  const append = (level, parts) => {
    const line = document.createElement('div');
    line.style.margin = '2px 0';
    if (level === 'warn') line.style.color = '#9a6b00';
    if (level === 'error') line.style.color = '#b00020';
    if (level === 'debug') line.style.opacity = '0.8';
    const ts = new Date().toLocaleTimeString();
    const text = parts.map(p => { try { return typeof p === 'string' ? p : JSON.stringify(p); } catch { return String(p); } }).join(' ');
    line.textContent = `[${ts}] ${level.toUpperCase()}: ${text}`;
    host.appendChild(line);
    host.scrollTop = host.scrollHeight;
  };

  ['log', 'warn', 'error', 'debug'].forEach(fn => {
    const original = console[fn].bind(console);
    console[fn] = (...args) => { append(fn, args); original(...args); };
  });

  console.debug('Sidebar logger initialized');
}

export function addRefreshButton() {
  const container = document.getElementById('content') || document.body;

  if (document.getElementById('refresh-button')) return;

  const btn = document.createElement('button');
  btn.id = 'refresh-button';
  btn.textContent = 'Refresh details from current tab';
  btn.style.display = 'none';

  btn.addEventListener('click', async () => {
    if (btn.disabled) return; // bail if not allowed
    showStatus("Refreshing...");

    const tab = await getCurrentTab();
    await getDetailsForTab(tab);
  });

  container.prepend(btn);
}

async function getDetailsForTab(tab) {
  try {
    const details = await tryGetDetails(tab)
    showDetails();
    await renderDetails(details);

    // 👇 After refreshing, set last fetched & disable if same tab
    setLastFetchedUrl(tab?.url || "");
    getCurrentTab().then((activeTab) => {
      updateRefreshButtonForUrl(activeTab?.url || "");
    });
  } catch (err) {
    console.error("fetch details fail", err);
    showStatus("An issue occurred when fetching data");
    notifyBackground("REFRESH_ICON", { tab });
  }
}

export function updateRefreshButtonForUrl(url) {
  const btn = document.getElementById('refresh-button');
  const statusEl = statusBox();
  if (!btn) return;

  const allowed = isAllowedUrl(url);
  const norm = normalizeUrl(url);
  const alreadyFetched = norm === getLastFetchedUrl();
  const enabled = allowed && !alreadyFetched;

  // always visible
  btn.style.display = 'flex';

  // set functional disabled state
  btn.disabled = !enabled;

  // reset classes
  btn.classList.remove('refresh-enabled', 'refresh-disabled', 'refresh-unsupported');

  if (!allowed) {
    btn.classList.add('refresh-unsupported');
    btn.textContent = 'This page is not supported';
  } else if (alreadyFetched) {
    btn.classList.add('refresh-disabled');
    btn.textContent = 'You have these details checked out';
  } else {
    btn.classList.add('refresh-enabled');
    btn.textContent = 'Check out details from current tab';
  }

  if (statusEl && allowed) statusEl.style.display = 'none';
}

export function checkActiveTabAndUpdateButton() {
  getCurrentTab().then((tab) => {
    updateRefreshButtonForUrl(tab?.url || "");
  });
}

// Listener for request permissions button
document.addEventListener("click", function(event) {
  const btn = event.target.closest("button");
  if (!btn) return;

  if (btn.id === "permGrant" && btn.dataset.origin && btn.dataset.tabId) {
    const origin = btn.dataset.origin;
    const tabId = Number(btn.dataset.tabId);
    if (Number.isNaN(tabId) || btn.dataset.tabId.trim() === "") return // invalid id

    chrome.permissions.request({ origins: [origin] }, (granted) => {
      if (!granted) {
        showStatus("Permissions denied. Cannot proceed.");
        return;
      }

      // Retry immediately
      showStatus("Permissions granted. Reloading...");
      chrome.tabs.get(tabId, async (tab) => {
        await getDetailsForTab(tab);
      });
    });
  }
});
