// Auto-generated file. Do not edit manually.
import { amazonScraper } from "./amazon";
import { audibleScraper } from "./audible";
import { barnesAndNobleScraper } from "./barnesnoble";
import { dnbdeScraper } from "./dnbde";
import { goodreadsScraper } from "./goodreads";
import { googleBooksScraper } from "./googlebooks";
import { isbnSearchScraper } from "./isbnsearch";
import { isbndbScraper } from "./isbndb";
import { isbndeScraper } from "./isbnde";
import { koboScraper } from "./kobo";
import { libbyScraper, overdriveScraper, teachingbooksScraper } from "./overdrive";
import { librofmScraper } from "./librofm";
import { romanceIoScraper } from "./romanceio";
import { storygraphScraper } from "./storygraph";

/** @import { Extractor } from "./AbstractExtractor";
 * @type{Extractor[]} */
const extractors = [
  new amazonScraper(),
  new audibleScraper(),
  new barnesAndNobleScraper(),
  new dnbdeScraper(),
  new goodreadsScraper(),
  new googleBooksScraper(),
  new isbnSearchScraper(),
  new isbndbScraper(),
  new isbndeScraper(),
  new koboScraper(),
  new libbyScraper(),
  new librofmScraper(),
  new overdriveScraper(),
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

export { extractors, getExtractor, isAllowedUrl };
