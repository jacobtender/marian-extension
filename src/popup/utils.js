import SettingsManager from "./settings";
import { hyphenate, searchIsbn } from "../shared/getGroup.js";
import { normalizeUrl } from "../extractors";

let __lastFetchedNorm = '';

export function setLastFetchedUrl(url) {
  __lastFetchedNorm = normalizeUrl(url);
}

export function getLastFetchedUrl() {
  return __lastFetchedNorm;
}

/**
 * Order of sections to show in UI
 */
export const orderedKeys = [
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
/**
 * Keys for all the elements that are used by hardcover
 */
export const hardcoverKeys = [ // for filtering
  "Title",
  "Description",
  "Series",
  "Series Place",
  "img",
  "imgScore",
  ...orderedKeys,
]

/**
 * Takes in a details object and settings to apply to it
 * Applies normalization to the object
 *
 * @param {Record<string,any>} details 
 * @param {any} settings 
 * @param {boolean} [inplace=true] edit the object in place or return a copy
 *
 * @returns {Record<string, any>}
 */
export function normalizeDetails(details, settings, inplace = true) {
  if (!inplace) {
    details = { ...details }; // shallow clone
  }

  // normalize

  // check for SBN
  if (details["ISBN-10"] && details["ISBN-10"].replaceAll("-", "").length === 9) {
    const isbn = `0${details["ISBN-10"]}`;
    if (validateIsbn10(isbn)) {
      details["ISBN-10"] = isbn;
    }
  }

  // Validate the ISBNs validity
  if (details["ISBN-10"]) {
    details["ISBN-10-valid"] = validateIsbn10(details["ISBN-10"]);
  }
  if (details["ISBN-13"]) {
    details["ISBN-13-valid"] = validateIsbn13(details["ISBN-13"]);
  }

  // check if the isbn is only missing the prefix
  if (details["ISBN-10"] && !details["ISBN-10-valid"]) {
    const isbn13 = details["ISBN-13"]?.replaceAll("-", "") ?? "";
    for (const prefix of ["978", "979"]) {
      const isbn = `${prefix}${details["ISBN-10"]}`.replaceAll("-", "");
      if (isbn === isbn13 || validateIsbn13(isbn)) {
        delete details["ISBN-10"];
        delete details["ISBN-10-valid"];
        details["ISBN-13"] = isbn;
        details["ISBN-13-valid"] = validateIsbn13(isbn);
        break;
      }
    };
  }

  if (details["ISBN-13"] && !details["ISBN-13-valid"]) {
    for (const prefix of ["978", "979"]) {
      const isbn = `${prefix}${details["ISBN-13"]}`.replaceAll("-", "");
      if (validateIsbn13(isbn)) {
        details["ISBN-13"] = isbn;
        details["ISBN-13-valid"] = validateIsbn13(isbn);
        break;
      }
    };
  }

  // Regenerate missing ISBN using other one
  if (!details["ISBN-13"] && !!details["ISBN-10"] && details["ISBN-10-valid"]) {
    const isbn = getISBN13From10(details["ISBN-10"]);
    if (isbn) {
      details["ISBN-13"] = isbn;
      details["ISBN-13-valid"] = validateIsbn13(details["ISBN-13"]);
    }
  }
  if (!!details["ISBN-13"] && !details["ISBN-10"] && details["ISBN-13"].startsWith("978") && details["ISBN-13-valid"]) {
    const isbn = getISBN10From13(details["ISBN-13"]);
    if (isbn) {
      details["ISBN-10"] = isbn;
      details["ISBN-10-valid"] = validateIsbn10(details["ISBN-10"]);
    }
  }

  // validate that it is the same isbn
  if (details["ISBN-13"] && details["ISBN-10"] && details["ISBN-10-valid"] && details["ISBN-13-valid"]) {
    const isbn10 = details["ISBN-10"].replaceAll("-", "");
    const isbn13 = details["ISBN-13"].replaceAll("-", "");
    if (isbn10.length === 10 && isbn13.length === 13) {
      const isbn = getISBN13From10(isbn10);
      if (isbn) {
        details["ISBN-mismatch"] = isbn !== isbn13;
      }
    }
  }

  // Set ASIN for physical books
  if (details["Reading Format"] === "Physical Book" && !details["ASIN"] && !!details["ISBN-10"] && details["ISBN-10-valid"]) {
    // for physical books the ASIN is the isbn-10
    details["ASIN"] = details["ISBN-10"];
  }

  // Insert country (or language) from ISBN if not present
  const isbn = details["ISBN-13"] || details["ISBN-10"];
  if (isbn != undefined) {
    try {
      const groupName = searchIsbn(isbn);
      if (groupName != undefined) {
        if (groupName.toLowerCase().endsWith("language")) {
          const language = groupName.split("language")[0].trim();
          details["Language"] = details["Language"] || language
        } else {
          details["Country"] = details["Country"] || groupName
        }
      }
    } catch { }
  }

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

  // remove edition from end of Edition name (Kindle Edition -> Kindle, Audible Edition -> Audible)
  if (details["Edition Format"] && details["Edition Format"].toLowerCase().endsWith("edition")) {
    const edition = details["Edition Format"];
    details["Edition Format"] = edition.slice(0, edition.length - "edition".length).trim();
  }

  // Remove independently published publisher
  if (details["Publisher"] && details["Publisher"].toLowerCase() === "independently published") {
    delete details["Publisher"];
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
    try {
      details["ISBN-10"] = hyphenate(details["ISBN-10"]);
    } catch { }
    try {
      details["ISBN-13"] = hyphenate(details["ISBN-13"]);
    } catch { }
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

/**
 * Formats a string as a date given a specified format 
 *
 * @param {Date|string|number} dateStr 
 * @param {"local"|"ymd"|"dmy"|"mdy"} [format="local"] 
 *
 * @returns {string}
 */
export function formatDate(dateStr, format = "local") {
  const date = new Date(dateStr);

  if (Number.isNaN(date.getTime())) {
    return dateStr;
  }

  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');

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
      // format in UTC timezone to prevent local timezone offset from shifting the date
      return new Intl.DateTimeFormat(navigator.language || "en-US", {
        timeZone: 'UTC'
      }).format(date);
  }
}

/**
 * Get the local format of dates on the system, for example
 * m/d/yyyy
 */
export function getLocalDateFormat() {
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
  * @typedef {Object} ToggleSetting
  * @property {"toggle"} type
  * @property {string} label
  * @property {boolean} default
  *
  * @typedef {Object} SelectionSetting
  * @property {"selection"} type
  * @property {string} label
  * @property {Record<string, string>} options Map of option values to display labels
  * @property {string} default Must be one of the keys in options
  *
  * @typedef {ToggleSetting | SelectionSetting} SettingOption
  */

/** @param {SelectionSetting} setting */
function validateSelectionSetting(setting) {
  if (setting.type === 'selection' && !(setting.default in setting.options)) {
    throw new Error(
      `Default value "${setting.default}" is not a valid option. ` +
      `Valid options are: ${Object.keys(setting.options).join(', ')}`
    );
  }
}

/**
  * Takes in an object with the settings and returns a settings object 
  *
  * @param {HTMLElement} settingsContainer the HTML element to insert the options into 
  * @param {Record<string, SettingOption>} settingOptions 
  * @returns {SettingsManager}
  */
export function SetupSettings(settingsContainer, settingOptions) {
  // validate options and create defaults options
  const options = {};
  Object.entries(settingOptions).forEach(([setting, settingInfo]) => {
    switch (settingInfo.type) {
      case "toggle":
        break;
      case "selection":
        validateSelectionSetting(settingInfo);
        break;
      default:
        throw `Unhandled setting type "${settingInfo.type}"`;
    }
    options[setting] = settingInfo.default;
  });

  const settingsObj = new SettingsManager(options);

  // fill in settings container
  settingsObj.get().then((settings) => {
    Object.entries(settings).forEach(([setting, value]) => {
      const info = settingOptions[setting];

      const settingItem = document.createElement('div');
      settingItem.className = 'setting-item';

      const label = document.createElement('label');
      settingItem.appendChild(label);

      switch (info.type) {
        case "toggle":
          // Create checkbox with label
          label.className = 'checkbox-label';

          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.checked = value;
          checkbox.addEventListener('change', (e) => {
            settingsObj.set(setting, e.target.checked);
          });

          const textSpan = document.createElement('span');
          textSpan.textContent = info.label;

          label.appendChild(textSpan);
          label.appendChild(checkbox);
          break;

        case "selection":
          // Create select dropdown with label
          label.className = 'setting-label';
          label.textContent = info.label;

          const select = document.createElement('select');
          Object.entries(info.options).forEach(([optionValue, optionLabel]) => {
            const option = document.createElement('option');
            option.value = optionValue;
            option.textContent = optionLabel;
            option.selected = optionValue === value;
            select.appendChild(option);
          });

          select.addEventListener('change', (e) => {
            settingsObj.set(setting, e.target.value);
          });

          settingItem.appendChild(select);
          break;
      }

      settingsContainer.appendChild(settingItem);
    });
  });

  return settingsObj;
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

/**
 * Calculates and returns the check digit for an isbn10
 * Returns the check digit or undefined if the isbn is invalid
 *
 * @param {String} isbn - a 9 or 10 digit long isbn, if 10 long the present check digit is ignored 
 * @returns {String|null}
 */
export function getISBN10CheckDigit(isbn) {
  isbn = isbn.replaceAll("-", "");

  // remove original check digit
  if (isbn.length === 10) isbn = isbn.slice(0, isbn.length - 1);

  if (isbn.length !== 9) return null;
  if (/[^0-9]/.exec(isbn) != null) return null; // check for non digits

  const checksum = [...isbn].reduce((acc, d, i) => acc + d * (i + 1), 0) % 11;
  return checksum === 10 ? "X" : checksum.toString();
}

/**
 * Calculates and returns the check digit for an isbn13
 * Returns the check digit or undefined if the isbn is invalid
 *
 * @param {String} isbn - a 12 or 13 digit long isbn, if 13 long the present check digit is ignored 
 * @returns {String|null}
 */
export function getISBN13CheckDigit(isbn) {
  isbn = isbn.replaceAll("-", "");

  // remove original check digit
  if (isbn.length === 13) isbn = isbn.slice(0, isbn.length - 1);

  if (isbn.length !== 12) return null;
  if (/[^0-9]/.exec(isbn) != null) return null; // check for non digits

  const checksum = (10 - ([...isbn].reduce((acc, d, i) => acc + d * (i % 2 ? 3 : 1), 0) % 10)) % 10;
  return checksum.toString();
}

/**
 * Calculate the isbn 13 from an isbn 10
 * Returns null if an issue happened (provided isbn is of wrong length)
 *
 * @param {string} isbn
 * @returns {string|null}
 */
export function getISBN13From10(isbn) {
  isbn = isbn.replaceAll("-", "");
  if (isbn.length !== 10) {
    return null;
  }

  isbn = "978" + isbn; // add prefix
  const checksum = getISBN13CheckDigit(isbn);
  if (checksum == null) {
    return null;
  }

  isbn = isbn.slice(0, isbn.length - 1); // remove original check digit
  isbn = isbn + checksum; // add new check digit
  return isbn;
}

/**
 * Calculate the isbn 10 from an isbn 13
 * Returns null if an issue happened (provided isbn is of wrong length, or wrong prefix)
 *
 * @param {string} isbn
 * @returns {string|null}
 */
export function getISBN10From13(isbn) {
  isbn = isbn.replaceAll("-", "");
  if (isbn.length !== 13 || !isbn.startsWith("978")) {
    return null;
  }

  isbn = isbn.slice(3); // remove prefix
  const checksum = getISBN10CheckDigit(isbn);
  if (checksum === null) {
    return null;
  }

  isbn = isbn.slice(0, isbn.length - 1); // remove original check digit
  isbn = isbn + checksum; // add new check digit
  return isbn;
}

function validateIsbn10(isbn) {
  const checksum = getISBN10CheckDigit(isbn);
  return checksum === isbn[isbn.length - 1];
}
function validateIsbn13(isbn) {
  const checksum = getISBN13CheckDigit(isbn);
  return checksum === isbn[isbn.length - 1];
}
