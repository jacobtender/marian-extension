import { addContributor, cleanText, collectObject, getCoverData, getFormattedText } from "../shared/utils.js";
import { Extractor } from "./AbstractExtractor.js"

const titleSeriesRegex = /^(?<title>.+?)(?: \((?<series>.+) #(?<position>[0-9]+\.*[0-9]*)\))?$/m;

class romanceIoScraper extends Extractor {
  get _name() { return "Romance.io Extractor"; }
  needsReload = false;

  _sitePatterns = [
    /https:\/\/www\.romance\.io\/books\/(.+)/,
  ];

  async getDetails() {
    let details = {};

    // cover
    const covers = [...document.querySelectorAll(".book-cover-container img")].map(i => i.src);
    const coverData = getCoverData(covers);

    const bookInfo = document.querySelector(".book-info");

    // description
    const descriptionEl = bookInfo.querySelector("#book-description .is-clearfix div");
    const clonedDescriptionEl = descriptionEl.cloneNode(true);

    const coverEl = clonedDescriptionEl.querySelector(".book-cover-container");
    if (coverEl) coverEl.remove();
    const ratingEl = clonedDescriptionEl.querySelector(".desc-steam-rating");
    if (ratingEl) ratingEl.remove();
    details["Description"] = getFormattedText(clonedDescriptionEl);

    // Author
    const authorName = cleanText(bookInfo.querySelector(".author").textContent);
    details["Contributors"] = addContributor([], authorName, "Author");

    // title / series
    const match = bookInfo.querySelector("h1").textContent.trim().match(titleSeriesRegex);
    if (match && match.groups) {
      details["Title"] = match.groups.title;
      details["Series"] = match.groups.series;
      details["Series Place"] = match.groups.position;
    }

    // published / pages
    const pubDetails = bookInfo.querySelector(".book-stats-scnd").textContent.split("·").map(i => i.trim());
    pubDetails.forEach(i => {
      if (i.toLowerCase().includes("pages")) {
        details["Pages"] = cleanText(i.toLowerCase().trim("pages"));
      }
      if (i.toLowerCase().includes("published")) {
        details["Publication date"] = new Date(i.toLowerCase().trim("published:"));
      }
    });

    // asin / isbn10
    const amazonId = [...document.querySelectorAll(".buy-buttons a")]
      .filter(i => i.textContent.toLowerCase().includes("amazon"))
      .map(i => (i.href.match(/amazon.+\/dp\/([^?]+)/) ?? [])[1])[0]
    if (amazonId) {
      details["ASIN"] = amazonId;
      if (amazonId.match(/\d{9}(?:X|\d)/)) {
        details["ISBN-10"] = amazonId;
      }
    }

    return collectObject([
      details,
      coverData,
    ]);
  }
}

export { romanceIoScraper };
