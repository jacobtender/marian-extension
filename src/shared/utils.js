// Check if the 'browser' namespace is available (Firefox) and use it,
// otherwise fall back to the 'chrome' namespace (Chrome).
export const runtime = typeof browser !== 'undefined' ? browser.runtime : chrome.runtime;

/**
  * @param {string} url URL of image to check  
  * @returns {Promise<number>} The score of the image
  */
export async function getImageScore(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img.naturalWidth * img.naturalHeight);
    img.onerror = () => resolve(0); // fallback score if image fails to load
    img.src = url;
  });
}

export function logMarian(message, object = null) {
  if (!object) {
    console.log(`[👩🏻‍🏫 Marian] ${message}`);
  } else {
    console.group(`[👩🏻‍🏫 Marian] ${message}`);
    console.log(object);
    console.groupEnd();
  }
}

/**
 * Returns a promise waiting a timeout in milliseconds
 *
 * @param {number} ms - time to wait in milliseconds
 * @returns {Promise<None>}
 */
export function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Race a promise against a timeout, resolving with a fallback value if the timeout finishes first.
 *
 * @template T
 * @param {Promise<T>} promise Promise to await.
 * @param {number} ms Timeout length in milliseconds.
 * @param {T} fallback Value to resolve with if the timeout elapses first.
 * @returns {Promise<T>} Promise that settles with either the original result or the fallback.
 */
export function withTimeout(promise, ms, fallback) {
  let timer;
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise(resolve => {
      timer = setTimeout(() => resolve(fallback), ms);
    })
  ]);
}

/**
 * Extract text from HTML element while preserving paragraph breaks
 *
 * @param {HTMLElement} element HTML element to extract text from
 * @returns {string} Formatted text with preserved paragraph breaks
 */
export function getFormattedText(element) {
  if (!element) return "";
  let result = '';

  function processNode(/**@type {HTMLElement}*/node) {
    if (node.nodeType === Node.TEXT_NODE) {
      // Add text content, normalizing whitespace
      result += node.textContent.replace(/\s+/g, ' ');
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const tagName = node.tagName.toLowerCase();

      // Process child nodes first
      for (const child of node.childNodes) {
        processNode(child);
      }

      // Add appropriate line breaks after processing content
      if (tagName === 'p') {
        result += '\n\n'; // Double newline after paragraphs
      } else if (tagName === 'br') {
        result += '\n';   // Single newline for <br>
      } else if (['div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li'].includes(tagName)) {
        result += '\n';   // Single newline for other block elements
      }
    }
  }

  processNode(element);

  result = result
    .replace(/[ \t]+/g, ' ')    // Multiple spaces/tabs to single space
    .replace(/\n /g, '\n')      // Remove spaces after newlines
    .replace(/ \n/g, '\n')      // Remove spaces before newlines
    .replace(/\n{3,}/g, '\n\n') // Max 2 consecutive newlines
    .trim();

  return result;
  // return cleanText(result);
}

const deepQueryCache = new Map();

/**
 * Clear cached deep query results, typically once per extraction run.
 */
export function clearDeepQueryCache() {
  deepQueryCache.clear();
}

/**
 * Perform a deep DOM query that includes shadow roots under the provided hosts.
 *
 * @param {string} selector CSS selector to match.
 * @param {string[]} [hostSelectors=[]] CSS selectors whose shadow roots should be traversed.
 * @returns {Element[]} Unique matching elements discovered across light and shadow DOM.
 */
export function queryAllDeep(selector, hostSelectors = []) {
  const cacheKey = `${selector}::${hostSelectors.join(',')}`;
  if (deepQueryCache.has(cacheKey)) {
    return deepQueryCache.get(cacheKey);
  }

  const results = new Set();

  document.querySelectorAll(selector).forEach(el => results.add(el));

  const stack = [];

  if (hostSelectors.length) {
    document.querySelectorAll(hostSelectors.join(',')).forEach(host => {
      stack.push(host);
      if (host.shadowRoot) stack.push(host.shadowRoot);
    });
  }

  const visited = new Set();

  while (stack.length) {
    const root = stack.pop();
    if (!root || visited.has(root)) continue;
    visited.add(root);

    if (typeof root.querySelectorAll !== 'function') continue;

    root.querySelectorAll(selector).forEach(el => results.add(el));

    root.querySelectorAll('*').forEach(node => {
      if (node.shadowRoot) stack.push(node.shadowRoot);
    });
  }

  const arr = Array.from(results);
  deepQueryCache.set(cacheKey, arr);
  return arr;
}

/**
 * Variant of queryAllDeep that returns only the first match.
 *
 * @param {string} selector CSS selector to match.
 * @param {string[]} [hostSelectors=[]] CSS selectors whose shadow roots should be traversed.
 * @returns {Element | null} First matching element, or null when none found.
 */
export function queryDeep(selector, hostSelectors = []) {
  const matches = queryAllDeep(selector, hostSelectors);
  return matches[0] || null;
}

/**
  * takes a cover URL, or a list of covers and returns the details of the one with the best score
  *
  * @typedef {{img: string, imgScore: number}} CoverObject image URL and image score
  * @param {string | string[] | undefined} covers the cover URL, or a list of cover URLs
  * @return {Promise<CoverObject>} the image URL and score of the best cover
  */
export async function getCoverData(covers) {
  if (covers && covers.length === 0) {
    covers = undefined;
  }

  if (!Array.isArray(covers)) {
    // single URL was passed
    const coverUrl = covers;
    return {
      img: coverUrl,
      imgScore: coverUrl ? await getImageScore(coverUrl) : 0
    }
  }

  // an array of images was passed in
  const coversSettled = await Promise.allSettled(covers.map(getCoverData));
  const coversObj = coversSettled
    .filter(({ status }) => status === "fulfilled")
    .map((res) => /**@type{CoverObject}*/(res.value));

  // get the best one
  const highestScoreCover = coversObj.reduce((highest, current) =>
    current.imgScore > highest.imgScore ? current : highest
  );

  // logMarian("covers", { covers, coversObj, highestScoreCover });

  return highestScoreCover;
}

/**
 * Returns a new object with keys renamed according to the mapping.
 * Keys not in the mapping are preserved as-is.
 *
 * setting the target name of the key to undefined will delete it from the new object
 *
 * @param {Record<string, string|undefined>} mapping - Map of old keys to new keys
 * @param {Record<string,any>} object - Source object
 * @returns {Record<string, any>} New object with mapped keys
 */
export function remapKeys(mapping, object) {
  const newObj = {};

  for (const key of Object.keys(object)) {
    // If the key exists in mapping, use the new name, otherwise keep original
    const finalKey = Object.hasOwn(mapping, key) ? mapping[key] : key;
    if (finalKey == undefined) continue;
    newObj[finalKey] = object[key];
  }

  return newObj;
}

/**
 * Normalizes Description fields from various formats into a plain string.
 * @param {object} description
 * @returns {string} Normalized description text
 */
export function normalizeDescription(description) {
  if (typeof description === "string") return description;
  if (Array.isArray(description)) return normalizeDescription(description[0]);
  if (description && typeof description === "object") {
    if (typeof description.value === "string") return description.value;
    if (typeof description.text === "string") return description.text;
  }
  return "";
}

/**
 * @typedef {{name: string, roles: string[]}} contributor
 */

/**
 * adds a contributor with one or more roles to the contributor list
 *
 * @param {contributor[]} contributors - list of contributors
 * @param {string} name - name of the contributor 
 * @param {string | string[]} roles - a role or list of roles to add to a contributor
 * @returns {contributor[]}
 */
export function addContributor(contributors, name, roles) {
  if (!Array.isArray(roles)) {
    roles = [roles];
  }

  const contributor = contributors.findIndex((contributor) => contributor.name === name);
  if (contributor == -1) {
    contributors.push({ name, roles: roles });
    return contributors;
  }

  for (const role of roles) {
    if (contributors[contributor].roles.includes(role)) continue;
    contributors[contributor].roles.push(role);
  }

  return contributors;
}

/**
 * @typedef {{[name: string]: string[]}} mappings
 */

/**
 * adds a mapping with one or more IDs 
 *
 * @param {mappings} mappings
 * @param {string} name
 * @param {string | string[]}
 *
 * @returns {mappings}
 */
export function addMapping(mappings, name, ids) {
  if (!Array.isArray(ids)) {
    ids = [ids];
  }

  let map = mappings[name] ?? [];
  for (const id of ids) {
    if (!map.includes(id)) map.push(id);
  }
  mappings[name] = map;
  return mappings;
}


/**
 * Normalize arbitrary text by stripping invisible characters and squeezing whitespace.
 *
 * @param {string | null | undefined} text Raw text content to sanitize.
 * @returns {string} Sanitized text with normalized spacing.
 */
export function cleanText(text) {
  if (!text) return '';
  return text
    .normalize('NFKC')                                        // Normalize Unicode to one style
    .replace(/\p{Cf}/gu, '')                                  // Remove Unicode control chars
    .replace(/[\u200E\u200F\u202A-\u202E\u00A0\uFEFF‎‏]/g, ' ') // Normalize invisible formatting chars (NBSP, BOM, Bidi marks) to spaces (should not be needed but keeping for consistency)
    .replace(/^\s*,+\s*/, '')                                 // Remove artifact leading commas/spaces (e.g. ", value")
    .replace(/\s+/g, ' ')                                     // Collapse all recurring whitespace (tabs, newlines) into a single space
    .trim();
}

/**
 * Normalizes raw format string to one of: Audiobook, Ebook, or Physical Book.
 * @param {string} rawFormat
 * @returns {string} 'Audiobook' | 'Ebook' | 'Physical Book'
 */
export function normalizeReadingFormat(rawFormat) {
  if (!rawFormat) return 'Physical Book';
  const format = rawFormat.toLowerCase();

  if (
    format.includes("audio") ||
    format.includes("audible") ||
    format.includes("narrat") ||
    format.includes("mp3") ||
    format.includes("cd")
  ) return "Audiobook";

  if (
    format.includes("ebook") ||
    format.includes("e-book") ||
    format.includes("digital") ||
    format.includes("kindle")
  ) {
    return "Ebook";
  }

  if (
    format.includes("physical") ||
    format.includes("hardcover") ||
    format.includes("paperback") ||
    format.includes("book")
  ) {
    return "Physical Book";
  }

  return "Physical Book"; // Fallback
}

export const REGEX_TIME_HOURS_MINUTES = /(\d+)\s*Hours?\s*(?:,|and)?\s*(\d+)?\s*Minutes?/i;
export const REGEX_ABBREV_TIME_HOURS_MINUTES = /(\d+)\s*h\s*(\d+)\s*m/i;

/**
 * collect a list of objects or promises of objects into a single new object
 * overrides keys based on order of objects in list
 *
 * @typedef {Record<string,any>} obj a object
 * @param {Array<Promise<obj>|obj>|obj|Promise<obj>} items item or items
 *
 * @returns {Promise<obj>}
 */
export async function collectObject(items) {
  if (!Array.isArray(items)) return await items;

  const objList = await Promise.all(items);

  let obj = {};
  for (let i = 0; i < objList.length; i += 1) {
    const elm = objList[i];
    if (elm == undefined) {
      logMarian(`WARN: element number ${i} is ${elm}`)
      continue;
    }
    Object.entries(elm)
      .forEach(([k, v]) => obj[k] = v);
  }

  return obj;
}

/**
  * preforms a http request and returns a dom
  *
  * @param {string} url 
  * @returns {Promise<DOMParser|undefined>}
  */
export async function fetchHTML(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const html = await response.text();

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    return doc;
  } catch (error) {
    console.error('Error fetching HTML:', error);
  }
}

export { StorageBackedSet } from "./StorageSet.js";
