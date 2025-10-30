// shared/allowed-patterns.js
const ALLOWED_PATTERNS = [
  /https:\/\/www\.amazon\..*?\/(?:dp|gp\/product)\/.*?(B[\dA-Z]{9}|\d{9}(?:X|\d))/,
  /https:\/\/www\.amazon\.[a-z.]+\/(?:gp\/product|dp|[^/]+\/dp)\/[A-Z0-9]{10}/,
  /https:\/\/www\.amazon\.[a-z.]+\/[^/]+\/dp\/[A-Z0-9]{10}/,
  /https:\/\/www\.amazon\.[a-z.]+\/-\/[a-z]+\/[^/]+\/dp\/[A-Z0-9]{10}/, // for paths with language segments
  /https:\/\/www\.goodreads\.[a-z.]+\/(?:\w+\/)?book\/show\/\d+(-[a-zA-Z0-9-]+)?/,
  /^https:\/\/app\.thestorygraph\.[a-z.]+\/books\/[0-9a-fA-F-]+$/,
  /^https?:\/\/(www\.)?google\.[a-z.]+\/books/,
  /^https?:\/\/(www\.)?kobo\.[a-z]{2,10}\/[a-z]{2,5}\/[a-z]{2,5}\/[a-z]{1,5}book\/[0-9a-z\-]+/,
  /^https?:\/\/(www\.)?libro\.fm\/audiobooks\/\d+(-[a-zA-Z0-9-]+)?/,
  /^https?:\/\/(www\.)?audible\.[a-z.]+\/pd\/(?:[^/]+\/)*[A-Z0-9]{10}(?:\?.*)?$/,
  /^https?:\/\/isbnsearch\.(?:org|com)\/isbn\/((?:\d{3})?\d{9}(?:X|\d))\b/,
  /https:\/\/(?:www\.)?isbn\.de\/(buch|ebook|hoerbuch)\/((?:\d{3})?\d{9}(?:X|\d))\b/,
  /https:\/\/portal\.dnb\.de\/opac.*(simpleSearch|showFullRecord)/,
  /https:\/\/(?:www\.)?isbndb\.com\/book\/((?:\d{3})?\d{9}(?:X|x|\d))\b/,
  /https:\/\/(?:www\.)?overdrive\.com\/media\/(\d+)\/.+/,
  /https:\/\/share\.libbyapp\.com\/title\/(\d+)/,
  /https:\/\/libbyapp\.com\/.+\/(\d+)/,
  /https:\/\/school\.teachingbooks\.net\/.+?tid=(\d+)/,
];

export function isAllowedUrl(url) {
  // console.log(`Checking if URL is allowed: ${url}`);
  // console.log(ALLOWED_PATTERNS.some(pattern => pattern.test(url)))
  return ALLOWED_PATTERNS.some(pattern => pattern.test(url));
}
