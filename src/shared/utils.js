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

  return result
    .replace(/[ \t]+/g, ' ')    // Multiple spaces/tabs to single space
    .replace(/\n /g, '\n')      // Remove spaces after newlines
    .replace(/ \n/g, '\n')      // Remove spaces before newlines
    .replace(/\n{3,}/g, '\n\n') // Max 2 consecutive newlines
    .trim();
}

export function sendMessage(message) {
  return new Promise(async (resolve) => {
    await runtime.sendMessage(message, resolve);
  });
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

export { StorageBackedSet } from "./StorageSet";
