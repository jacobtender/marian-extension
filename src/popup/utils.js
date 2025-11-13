import SettingsManager from "./settings";

export function normalizeUrl(u) {
  try { const x = new URL(u); return `${x.origin}${x.pathname}`; }
  catch { return u || ''; }
}

let __lastFetchedNorm = '';

export function setLastFetchedUrl(url) {
  __lastFetchedNorm = normalizeUrl(url);
}

export function getLastFetchedUrl() {
  return __lastFetchedNorm;
}

export function buildIssueUrl(tabUrl) {
  let domain = '(unknown domain)';
  try { domain = new URL(tabUrl).hostname.replace(/^www\./, ''); } catch {}
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

          label.appendChild(checkbox);
          label.appendChild(document.createTextNode(' ' + info.label));
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
