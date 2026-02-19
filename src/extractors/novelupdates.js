import { addContributor, cleanText, collectObject, getCoverData, getFormattedText, normalizeReadingFormat } from "../shared/utils.js";
import { Extractor } from "./AbstractExtractor.js"

class novelUpdatesScraper extends Extractor {
  get _name() { return "Novel Updates Extractor"; }

  needsReload = false;
  _sitePatterns = [
    /https:\/\/www\.novelupdates\.com\/series\/(.*)\//
  ];

  async getDetails() {
    return collectObject([
      getCover(),
      getTitle(),
      getDescription(),
      getMetadata(),
      getAltTitles(),
    ]);
  }
}

async function getCover() {
  const el = document.querySelector(`.seriesimg img, .serieseditimg img`);
  if (!el) return {};
  return getCoverData(el.src);
}

function getTitle() {
  const title = document.querySelector(`.seriestitlenu`)?.textContent;
  if (!title) return {};
  return { "Title": cleanText(title) }
}

function getDescription() {
  const description = document.querySelector(`#editdescription`);
  if (!description) return {};
  return { "Description": getFormattedText(description) }
}

function getAltTitles() {
  const el = document.querySelector(`#editassociated`);
  if (!el) return {};
  const titles = getFormattedText(el).split("\n").map(cleanText);
  return { "Alt Titles": titles }
}

function getMetadata() {
  const infoBar = document.querySelector(`.one-third`);
  if (!infoBar) return {};

  const details = {};

  let val = document.querySelector(`#showtype a`)?.textContent;
  if (val) {
    details["Edition Format"] = cleanText(val);
    details["Reading Format"] = normalizeReadingFormat(details["Edition Format"]);
  }


  // val = [...document.querySelectorAll(`#seriesgenre a`)].map(i => cleanText(i.textContent));
  // if (val && val.length > 0) details["Genres"] = val;
  //
  // val = [...document.querySelectorAll(`#showtags a`)].map(i => cleanText(i.textContent));
  // if (val && val.length > 0) details["Tags"] = val;

  val = document.querySelector(`#showlang`)?.textContent;
  if (val) details["Language"] = cleanText(val);

  val = [...document.querySelectorAll(`#showauthors a`)].map(i => cleanText(i.textContent));
  if (val && val.length > 0) {
    const contributors = [];
    for (const author of val) addContributor(contributors, author, "Author");
    details["Contributors"] = contributors;
  }

  val = [...document.querySelectorAll(`#showartists a`)].map(i => cleanText(i.textContent));
  if (val && val.length > 0) {
    const contributors = details["Contributors"] ?? [];
    for (const artist of val) addContributor(contributors, artist, "Artist");
    details["Contributors"] = contributors;
  }

  val = document.querySelector(`#edityear`)?.textContent;
  if (val) details["Publication date"] = cleanText(val);

  val = [...document.querySelectorAll(`#showopublisher a`)].map(i => cleanText(i.textContent));
  if (val && val.length > 0) {
    details["Original Publisher"] = val;
    details["Publisher"] = val[0];
  }

  val = [...document.querySelectorAll(`#showepublisher a`)].map(i => cleanText(i.textContent));
  if (val && val.length > 0) details["English Publisher"] = val;

  return details;
}

export { novelUpdatesScraper };

