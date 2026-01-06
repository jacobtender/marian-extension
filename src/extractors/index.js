// Auto-generated file. Do not edit manually.
import { Extractor } from "./AbstractExtractor";

import { amazonScraper } from "./amazon";
import { audibleScraper } from "./audible";
import { barnesAndNobleScraper } from "./barnesnoble";
import { bookshopScraper } from "./bookshopOrg";
import { dnbdeScraper } from "./dnbde";
import { goodreadsScraper } from "./goodreads";
import { googleBooksScraper } from "./googlebooks";
import { indieBookstoreScraper } from "./indiebookstore";
import { isbnSearchScraper } from "./isbnsearch";
import { isbndbScraper } from "./isbndb";
import { isbndeScraper } from "./isbnde";
import { isfdbScraper } from "./isfdb";
import { koboScraper } from "./kobo";
import { libbyScraper, overdriveScraper, teachingbooksScraper } from "./overdrive";
import { librofmScraper } from "./librofm";
import { openlibraryScraper } from "./openlibrary";
import { penguinRandomHouseScraper } from "./penguinrandomhouse";
import { romanceIoScraper } from "./romanceio";
import { storygraphScraper } from "./storygraph";

/** @type{Extractor[]} */
const extractors = [
  new amazonScraper(),
  new audibleScraper(),
  new barnesAndNobleScraper(),
  new bookshopScraper(),
  new dnbdeScraper(),
  new goodreadsScraper(),
  new googleBooksScraper(),
  new indieBookstoreScraper(),
  new isbnSearchScraper(),
  new isbndbScraper(),
  new isbndeScraper(),
  new isfdbScraper(),
  new koboScraper(),
  new libbyScraper(),
  new librofmScraper(),
  new openlibraryScraper(),
  new overdriveScraper(),
  new penguinRandomHouseScraper(),
  new romanceIoScraper(),
  new storygraphScraper(),
  new teachingbooksScraper(),
];

/** @param {string} url */
function getExtractor(url) {
  return extractors.find((ex) => ex.isSupported(url));
}

/** @param {string} url */
function isAllowedUrl(url) {
  return getExtractor(url) != undefined;
}

/** @param {string} url */
function normalizeUrl(url) {
  const extractor = getExtractor(url);
  if (extractor) return extractor.normalizeUrl(url);
  return Extractor.prototype.normalizeUrl.call(null, url);
}

export { extractors, getExtractor, isAllowedUrl, normalizeUrl };
