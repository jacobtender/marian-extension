import { Extractor } from './AbstractExtractor.js';
import { logMarian, getCoverData, addContributor, cleanText, normalizeReadingFormat, collectObject, getFormattedText } from '../shared/utils.js';

class goodreadsScraper extends Extractor {
  get _name() { return "GoodReads Extractor"; }
  needsReload = false;
  _sitePatterns = [
    /https:\/\/www\.goodreads\.[a-z.]+\/(?:\w+\/)?book\/show\/\d+(-[a-zA-Z0-9-]+)?/,
  ];

  async getDetails() {
    const imgEl = document.querySelector('.BookCover__image img');
    const imgUrl = imgEl?.src;
    const coverData = imgUrl.includes("no-cover.png") ? null : getCoverData(imgUrl);

    const bookDetails = {};

    const sourceId = getGoodreadsBookIdFromUrl(window.location.href);
    if (!sourceId) throw new Error("Missing goodreads id");
    bookDetails["Mappings"] = { "Goodreads": [sourceId] };

    bookDetails["Title"] = cleanText(document.querySelector('[data-testid="bookTitle"]')?.innerText);

    const bookData = getBookDataObject();
    // logMarian("data: ", bookData);
    getBookDetails(bookData, bookDetails);

    const descriptionEl = document.querySelector('[data-testid="contentContainer"] .Formatted');
    bookDetails["Description"] = descriptionEl ? getFormattedText(descriptionEl) : null;

    bookDetails['Reading Format'] = normalizeReadingFormat(bookDetails["Edition Format"]);

    if (bookDetails["Edition Format"]?.toLowerCase() === "kindle edition") bookDetails["Edition Format"] = "Kindle";
    if (bookDetails["Edition Format"]?.toLowerCase() === "audible audio") bookDetails["Edition Format"] = "Audible";

    // logMarian("bookDetails", bookDetails);

    return collectObject([
      coverData,
      bookDetails,
    ]);
  }
}

/**
 * Extracts the Goodreads book ID from a Goodreads book URL.
 */
function getGoodreadsBookIdFromUrl(url) {
  const regex = /goodreads\.com\/(?:\w+\/)?book\/show\/(\d+)(?:[.\-/]|$)/i;
  const match = url.match(regex);
  return match ? match[1] : null;
}

function getBookDataObject() {
  const el = document.querySelector("script#__NEXT_DATA__");
  const json = JSON.parse(el.innerText);
  const apolloData = json?.props?.pageProps?.apolloState;
  if (!apolloData) throw new Error("Failed to fetch apollo data");
  return apolloData;
}

function getBookDetails(apolloData, bookDetails) {
  const rootQuery = apolloData["ROOT_QUERY"];
  if (rootQuery == undefined) throw new Error("root query is missing");

  const bookQueryKey = Object.keys(rootQuery).find(i => i.includes("getBookByLegacyId"));
  if (bookQueryKey == undefined) throw new Error("failed to find book id query");

  const bookDataKey = rootQuery[bookQueryKey]["__ref"];
  if (bookDataKey == undefined) throw new Error("failed to find book details id");

  const bookData = apolloData[bookDataKey];
  // logMarian("details", bookData);

  // book details
  const details = bookData?.details;
  if (details) {
    if ("asin" in details) bookDetails["ASIN"] = details.asin;
    if ("language" in details && details.language) bookDetails["Language"] = details.language.name;
    if ("isbn" in details && details.isbn) bookDetails["ISBN-10"] = details.isbn;
    if ("isbn13" in details && details.isbn13) bookDetails["ISBN-13"] = details.isbn13;
    if ("publicationTime" in details && details.publicationTime) bookDetails['Publication date'] = new Date(details.publicationTime);
    if ("publisher" in details) bookDetails['Publisher'] = details.publisher;
    if ("format" in details) bookDetails["Edition Format"] = details.format;
    if ("numPages" in details && details.numPages > 0) bookDetails["Pages"] = details.numPages;
  }

  // series
  const bookSeries = bookData["bookSeries"];
  if (bookSeries && bookSeries.length > 0) {
    const series = bookSeries[0];
    if ("userPosition" in series) bookDetails["Series Place"] = series.userPosition;
    const seriesRef = series.series?.__ref;
    if (seriesRef && seriesRef in apolloData) {
      const seriesData = apolloData[seriesRef];
      bookDetails['Series'] = seriesData?.title;
    }
  }

  // contributors
  let contributors = [];

  [bookData.primaryContributorEdge, ...bookData.secondaryContributorEdges].forEach(contributor => {
    try {
      const { name, role } = getContributor(apolloData, contributor);
      addContributor(contributors, cleanText(name), role);
    } catch (e) {
      console.error("Marian: Error fetching contributor", e, contributor);
    }
  });

  if (contributors.length) {
    bookDetails["Contributors"] = contributors;
  }
}

function getContributor(apolloData, contributorObject) {
  const role = contributorObject.role;
  const contributorRef = contributorObject.node?.__ref;
  if (!contributorRef) throw new Error("bad contributor");
  const contributor = apolloData[contributorRef];
  const name = contributor.name;

  return { name, role }
}

export { goodreadsScraper };
