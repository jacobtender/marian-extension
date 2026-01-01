import SettingsManager from "./settings";
import { normalizeUrl } from "../extractors";

let __lastFetchedNorm = '';

export function setLastFetchedUrl(url) {
  __lastFetchedNorm = normalizeUrl(url);
}

export function getLastFetchedUrl() {
  return __lastFetchedNorm;
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
