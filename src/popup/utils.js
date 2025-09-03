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