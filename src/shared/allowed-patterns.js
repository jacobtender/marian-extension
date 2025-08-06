// shared/allowed-patterns.js
const ALLOWED_PATTERNS = [
  /https:\/\/www\.amazon\.com\/gp\/product\/[A-Z0-9]{10}/,
  /https:\/\/www\.amazon\.com\/[^/]+\/dp\/[A-Z0-9]{10}/,
  /https:\/\/www\.goodreads\.com\/book\/show\/\d+(-[a-zA-Z0-9-]+)?/,
  /^https:\/\/app\.thestorygraph\.com\/books\/[0-9a-fA-F-]+$/,
  /^https?:\/\/(www\.)?google\.[a-z.]+\/books/
];

function isAllowedUrl(url) {
  // console.log(`Checking if URL is allowed: ${url}`);
  // console.log(ALLOWED_PATTERNS.some(pattern => pattern.test(url)))
  return ALLOWED_PATTERNS.some(pattern => pattern.test(url));
}
