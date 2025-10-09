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
