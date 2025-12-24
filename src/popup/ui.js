import { tryGetDetails } from "./messaging.js";
import { isAllowedUrl } from "../extractors";
import { normalizeUrl, setLastFetchedUrl, getLastFetchedUrl, getCurrentTab, SetupSettings, getISBN10CheckDigit, getISBN13CheckDigit } from "./utils.js";

const settingsManager = SetupSettings(document.querySelector("#settings"), {
  hyphenateIsbn: {
    type: "selection", label: "Hyphenate ISBNs", options: {
      // yes: "Yes",
      no: "No (Hardcover)", none: "Leave Alone"
    }, default: "none"
  },
  dateFormat: { type: "selection", label: "Format date", default: "local", options: { local: `Local format (${getLocalDateFormat()})`, ymd: "yyyy-mm-dd", dmy: "dd/mm/yyyy", mdy: "mm/dd/yyyy" } },
  filterNonHardcover: { type: "toggle", label: "Filter out non hardcover fields", default: false },
  keepFields: { type: "toggle", label: "Always display non present hardcover fields", default: false },
});

const orderedKeys = [
  'ISBN-10',
  'ISBN-13',
  'ASIN',
  'Mappings',
  'Contributors',
  'Publisher',
  'Reading Format',
  'Listening Length',
  'Listening Length Seconds',
  'Pages',
  'Edition Format',
  'Edition Information',
  'Publication date',
  'Language',
  'Country'
];
const hardcoverKeys = [ // for filtering
  "Title",
  "Description",
  "Series",
  "Series Place",
  "img",
  "imgScore",
  ...orderedKeys,
]

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


function formatDate(dateStr, format = "local") {
  const date = new Date(dateStr);

  if (isNaN(date)) {
    return dateStr;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  switch (format) {
    case 'ymd':
      return `${year}-${month}-${day}`;
    case 'dmy':
      return `${day}/${month}/${year}`;
    case 'mdy':
      return `${month}/${day}/${year}`;
    case 'local': // fall through
    default:
      // navigator.language should always be set, but adding a fallback just in case
      return new Intl.DateTimeFormat(navigator.language || "en-US").format(date);
  }
}

function getLocalDateFormat() {
  const date = new Date(2025, 3, 8); // 2025-04-08
  const formatted = new Intl.DateTimeFormat(navigator.language || "en-US").format(date);

  // Replace the actual values with format placeholders
  let pattern = formatted
    .replace('2025', 'yyyy')
    .replace('25', 'yy')
    .replace('04', 'mm')
    .replace('4', 'm')
    .replace('08', 'dd')
    .replace('8', 'd');

  return pattern;
}

function downloadImage(url, bookId) {
  fetch(url)
    .then(res => res.blob())
    .then(blob => {
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      const safeId = String(bookId || '').replace(/[^a-z0-9]/gi, '');
      a.download = `${safeId}_cover.jpg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    })
    .catch(err => console.error('Image download failed:', err));
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

function normalizeDetails(details, settings, inplace = true) {
  if (!inplace) {
    details = { ...details }; // shallow clone
  }

  // normalize

  // Validate the ISBNs validity
  if (details["ISBN-10"]) {
    const isbn = details["ISBN-10"];
    const checksum = getISBN10CheckDigit(isbn);
    details["ISBN-10-valid"] = checksum == isbn[isbn.length - 1]
  }
  if (details["ISBN-13"]) {
    const isbn = details["ISBN-13"];
    const checksum = getISBN13CheckDigit(isbn);
    details["ISBN-13-valid"] = checksum == isbn[isbn.length - 1]
  }

  // Regenerate missing ISBN using other one
  if (!details["ISBN-13"] && !!details["ISBN-10"] && details["ISBN-10-valid"]) {
    // make isbn13 from isbn10
    let isbn = details["ISBN-10"].replaceAll("-", "");
    if (isbn.length == 10) {
      isbn = "978" + isbn; // add prefix
      const checksum = getISBN13CheckDigit(isbn);
      if (checksum != null) {
        isbn = isbn.slice(0, isbn.length - 1); // remove original check digit
        isbn = isbn + checksum; // add new check digit
        details["ISBN-13"] = isbn;
      }
    }
  }
  if (!!details["ISBN-13"] && !details["ISBN-10"] && details["ISBN-13"].startsWith("978") && details["ISBN-13-valid"]) {
    // make isbn10 from isbn13
    let isbn = details["ISBN-13"].replaceAll("-", "");
    if (isbn.length == 13) {
      isbn = isbn.slice(3); // remove prefix
      const checksum = getISBN10CheckDigit(isbn);
      if (checksum != null) {
        isbn = isbn.slice(0, isbn.length - 1); // remove original check digit
        isbn = isbn + checksum; // add new check digit
        details["ISBN-10"] = isbn;
      }
    }
  }

  // Insert country (or language) from ISBN if not present
  // See pr #70

  // Add listening length in seconds
  if (details["Listening Length"] && details["Listening Length"].length >= 1) {
    if (!Array.isArray(details["Listening Length"])) {
      details["Listening Length"] = [details["Listening Length"]];
    }

    let valid = true;
    let lengthSeconds = 0;
    details["Listening Length"].forEach((item) => {
      if (!valid) return; // don't bother going over the rest
      const timeLower = item.toLowerCase();
      const timeAmount = parseInt(item); // ignores text after number

      if (timeLower.includes("hours")) {
        lengthSeconds += timeAmount * 60 * 60;
      } else if (timeLower.includes("minutes")) {
        lengthSeconds += timeAmount * 60;
      } else if (timeLower.includes("seconds")) {
        lengthSeconds += timeAmount;
      } else {
        valid = false; // encountered unknown unit
        return;
      }
    });

    if (valid) {
      details["Listening Length Seconds"] = lengthSeconds;
    }
  }


  // apply settings

  // format date
  if (details["Publication date"]) {
    details["Publication date"] = formatDate(details["Publication date"], settings.dateFormat);
  }

  // Correct hyphenation on ISBNs according to settings
  if (settings.hyphenateIsbn === "no") {
    if (details["ISBN-10"]) details["ISBN-10"] = details["ISBN-10"].replaceAll("-", "");
    if (details["ISBN-13"]) details["ISBN-13"] = details["ISBN-13"].replaceAll("-", "");
  } else if (settings.hyphenateIsbn === "yes") {
    throw "Not implemented";
  }

  // filter out non hardcover
  if (settings.filterNonHardcover) {
    Object.keys(details).forEach((key) => {
      if (!hardcoverKeys.includes(key)) {
        delete details[key];
      }
    });
  }

  // add or remove fields even if they are not set
  if (!settings.keepFields) {
    Object.keys(details).forEach((key) => {
      // ignore non hardcover fields
      if (!hardcoverKeys.includes(key)) return;

      if (details[key] == undefined) {
        delete details[key];
      }
    });
  } else {
    // fill in non present fields
    hardcoverKeys.forEach((key) => {
      if (details["Reading Format"] != "Audiobook") {
        // book don't add audiobook fields
        if (key === "Listening Length") return;
        if (key === "Listening Length Seconds") return;
      } else {
        // audiobook, don't add book fields 
        if (key === "Pages") return;
      }

      details[key] ??= null;
    });
  }

  return details;
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
  img.style.userSelect = "none";
  img.draggable = false;

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
  });

  const filteredKeys = ['img', 'imgScore', 'Title', 'Description', "ISBN-10-valid", "ISBN-13-valid"];
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
      showStatus(err);
      notifyBackground("REFRESH_ICON", { tab });
    }
  });

  container.prepend(btn);
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
