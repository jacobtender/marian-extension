import { addContributor, addMapping, cleanText, collectObject, getCoverData, getFormattedText, normalizeReadingFormat } from "../shared/utils.js";
import { Extractor } from "./AbstractExtractor.js"

class mangaUpdatesScraper extends Extractor {
  get _name() { return "MangaUpdates Extractor"; }

  needsReload = false;
  _sitePatterns = [
    /https:\/\/www\.mangaupdates\.com\/series\/(.*)\//
  ];

  async getDetails() {
    return collectObject([
      getCover(),
      getTitle(),
      getDescription(),
      getMetadata(),
      getAltTitles(),
      getMappings(),
    ]);
  }
}

function getMappings() {
  const match = document.location.href.match(/\/series\/([a-z0-9]+)/);
  if (!match) return {};
  return { "Mappings": { "MangaUpdates": [match[1]] } };
}

async function getCover() {
  const el = document.querySelector(`div[data-cy="info-box-image"] img`);
  if (!el) return {};
  return getCoverData(el.src);
}

function getTitle() {
  const title = document.querySelector(`.releasestitle.tabletitle`)?.textContent;
  if (!title) return {};
  return { "Title": cleanText(title) }
}

function getDescription() {
  const description = document.querySelector(`div[data-cy="info-box-description"]`);
  if (!description) return {};
  return { "Description": getFormattedText(description) }
}

function getAltTitles() {
  const el = document.querySelector(`div[data-cy="info-box-associated"]`);
  if (!el) return {};
  const titles = getFormattedText(el).split("\n").map(cleanText);
  return { "Alt Titles": titles }
}

function getMetadata() {
  const details = {};

  let val = document.querySelector(`div[data-cy="info-box-type"]`)?.textContent;
  if (val) {
    details["Edition Format"] = cleanText(val);
    details["Reading Format"] = normalizeReadingFormat(details["Edition Format"]);
  }


  // val = [...document.querySelectorAll(`div[data-cy="info-box-genres"] span>a`)].map(i => cleanText(i.textContent));
  // if (val && val.length > 0) details["Genres"] = val;
  //
  // val = [...document.querySelectorAll(`div[data-cy="info-box-categories"] ul a`)].map(i => cleanText(i.textContent));
  // if (val && val.length > 0) details["Tags"] = val;

  val = [...document.querySelectorAll(`div[data-cy="info-box-authors"] a`)].map(i => cleanText(i.textContent));
  if (val && val.length > 0) {
    const contributors = [];
    for (const author of val) addContributor(contributors, author, "Author");
    details["Contributors"] = contributors;
  }

  val = [...document.querySelectorAll(`div[data-cy="info-box-artists"] a`)].map(i => cleanText(i.textContent));
  if (val && val.length > 0) {
    const contributors = details["Contributors"] ?? [];
    for (const artist of val) addContributor(contributors, artist, "Artist");
    details["Contributors"] = contributors;
  }

  val = document.querySelector(`div[data-cy="info-box-year"]`)?.textContent;
  if (val) details["Publication date"] = cleanText(val);

  val = [...document.querySelectorAll(`div[data-cy="info-box-original_publisher"] a`)].map(i => cleanText(i.textContent));
  if (val && val.length > 0) {
    details["Original Publishers"] = val;
    details["Publisher"] = val[0];
  }

  val = [...document.querySelectorAll(`div[data-cy="info-box-english_publisher"] a`)].map(i => cleanText(i.textContent));
  if (val && val.length > 0) details["English Publishers"] = val;

  val = [...document.querySelectorAll(`div[data-cy="info-box-publications"] div`)].map(i => cleanText(i.textContent));
  if (val && val.length > 0) details["Serialized"] = val;


  return details;
}

export { mangaUpdatesScraper };

