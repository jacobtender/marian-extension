// shared/allowed-patterns.js
const ALLOWED_PATTERNS = [
  /https:\/\/www\.amazon\.[a-z.]+\/(?:gp\/product|dp|[^/]+\/dp)\/[A-Z0-9]{10}/,
  /https:\/\/www\.amazon\.[a-z.]+\/[^/]+\/dp\/[A-Z0-9]{10}/,
  /https:\/\/www\.amazon\.[a-z.]+\/-\/[a-z]+\/[^/]+\/dp\/[A-Z0-9]{10}/, // for paths with language segments
  /https:\/\/www\.goodreads\.[a-z.]+\/book\/show\/\d+(-[a-zA-Z0-9-]+)?/,
  /^https:\/\/app\.thestorygraph\.[a-z.]+\/books\/[0-9a-fA-F-]+$/,
  /^https?:\/\/(www\.)?google\.[a-z.]+\/books/,
  /^https?:\/\/(www\.)?kobo\.[a-z]{2,10}\/[a-z]{2,5}\/[a-z]{2,5}\/[a-z]{1,5}book\/[0-9a-z\-]+/
];

export function isAllowedUrl(url) {
  // console.log(`Checking if URL is allowed: ${url}`);
  // console.log(ALLOWED_PATTERNS.some(pattern => pattern.test(url)))
  return ALLOWED_PATTERNS.some(pattern => pattern.test(url));
}
