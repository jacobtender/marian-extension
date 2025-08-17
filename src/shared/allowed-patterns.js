// shared/allowed-patterns.js
import allowedUrls from "./allowed-urls.json";

let allowedPatterns = [];

function compilePatterns() {
  if (allowedPatterns.length == allowedUrls.length) {
    return
  }
  allowedPatterns = allowedUrls.map(url => {
    // convert url glob to JS regex
    const pattern = url
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // escape special characters
      .replace(/\*/g, '[^/]*'); // replace asterisk

    return new RegExp('^' + pattern);
  });
}

compilePatterns();

export function isAllowedUrl(url) {
  // console.log(`Checking if URL is allowed: ${url}`);
  // console.log(ALLOWED_PATTERNS.some(pattern => pattern.test(url)))
  return allowedPatterns.some(pattern => pattern.test(url));
}
