// Auto-generated file. Do not edit manually.
import { Extractor } from "./AbstractExtractor";

import { abeBooksScraper } from "./abebooks";
import { amazonScraper } from "./amazon";
import { anilistScraper } from "./anilist";
import { animePlanetScraper } from "./animeplanet";
import { archiveOfOurOwnScraper } from "./ao3";
import { audibleScraper } from "./audible";
import { barnesAndNobleScraper } from "./barnesnoble";
import { booksAMillionScraper } from "./booksamillion";
import { bookshopScraper } from "./bookshopOrg";
import { dnbdeScraper } from "./dnbde";
import { fanFictionNetScraper } from "./fanfictionnet";
import { goodreadsScraper } from "./goodreads";
import { googleBooksScraper } from "./googlebooks";
import { indieBookstoreScraper } from "./indiebookstore";
import { inventaireScraper } from "./inventaire";
import { isbnSearchScraper } from "./isbnsearch";
import { isbndbScraper } from "./isbndb";
import { isbndeScraper } from "./isbnde";
import { isfdbScraper } from "./isfdb";
import { kitsuScraper } from "./kitsu";
import { koboScraper } from "./kobo";
import { libbyScraper, overdriveScraper, teachingbooksScraper } from "./overdrive";
import { libraryThingScraper } from "./librarything";
import { librofmScraper } from "./librofm";
import { mangaDexScraper } from "./mangadex";
import { mangaUpdatesScraper } from "./mangaupdates";
import { myAnimeListScraper } from "./myanimelist";
import { novelUpdatesScraper } from "./novelupdates";
import { openlibraryScraper } from "./openlibrary";
import { penguinRandomHouseScraper } from "./penguinrandomhouse";
import { romanceIoScraper } from "./romanceio";
import { royalRoadScraper } from "./royalroad";
import { scribbleHubScraper } from "./scribblehub";
import { spacebattlesScraper } from "./spacebattles";
import { storygraphScraper } from "./storygraph";
import { torPublishingScraper } from "./torpub";
import { wattpadScraper } from "./wattpad";
import { worldCatScraper } from "./worldcat";

/** @type{Extractor[]} */
const extractors = [
  new abeBooksScraper(),
  new amazonScraper(),
  new anilistScraper(),
  new animePlanetScraper(),
  new archiveOfOurOwnScraper(),
  new audibleScraper(),
  new barnesAndNobleScraper(),
  new booksAMillionScraper(),
  new bookshopScraper(),
  new dnbdeScraper(),
  new fanFictionNetScraper(),
  new goodreadsScraper(),
  new googleBooksScraper(),
  new indieBookstoreScraper(),
  new inventaireScraper(),
  new isbnSearchScraper(),
  new isbndbScraper(),
  new isbndeScraper(),
  new isfdbScraper(),
  new kitsuScraper(),
  new koboScraper(),
  new libbyScraper(),
  new libraryThingScraper(),
  new librofmScraper(),
  new mangaDexScraper(),
  new mangaUpdatesScraper(),
  new myAnimeListScraper(),
  new novelUpdatesScraper(),
  new openlibraryScraper(),
  new overdriveScraper(),
  new penguinRandomHouseScraper(),
  new romanceIoScraper(),
  new royalRoadScraper(),
  new scribbleHubScraper(),
  new spacebattlesScraper(),
  new storygraphScraper(),
  new teachingbooksScraper(),
  new torPublishingScraper(),
  new wattpadScraper(),
  new worldCatScraper(),
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
