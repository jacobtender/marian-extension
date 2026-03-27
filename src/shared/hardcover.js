const HARDCOVER_BOOK_EDIT_PATTERN = /^https:\/\/hardcover\.app\/books\/\d+\/edit(?:[?#].*)?$/;
const HARDCOVER_EDITION_EDIT_PATTERN = /^https:\/\/hardcover\.app\/editions\/\d+\/edit(?:[?#].*)?$/;
const HARDCOVER_NEW_MANUAL_EDITION_PATTERN = /^https:\/\/hardcover\.app\/books\/[^/?#]+\/editions\/new\/manual(?:[?#].*)?$/;
const HARDCOVER_NEW_MANUAL_ROOT_PATTERN = /^https:\/\/hardcover\.app\/books\/new_manual(?:[?#].*)?$/;

/**
 * @param {string} url
 * @returns {"book" | "edition" | null}
 */
export function getHardcoverEditTarget(url) {
  if (HARDCOVER_BOOK_EDIT_PATTERN.test(url)) return "book";
  if (HARDCOVER_EDITION_EDIT_PATTERN.test(url)) return "edition";
  if (HARDCOVER_NEW_MANUAL_EDITION_PATTERN.test(url)) return "edition";
  if (HARDCOVER_NEW_MANUAL_ROOT_PATTERN.test(url)) return "edition";
  return null;
}

/**
 * @param {string} url
 * @returns {boolean}
 */
export function isHardcoverEditUrl(url) {
  return getHardcoverEditTarget(url) !== null;
}
