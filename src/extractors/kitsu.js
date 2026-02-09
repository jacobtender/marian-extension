import { cleanText, collectObject, delay, getCoverData, getFormattedText, normalizeReadingFormat, remapKeys } from "../shared/utils.js";
import { Extractor } from "./AbstractExtractor.js"

class kitsuScraper extends Extractor {
  get _name() { return "Kitsu Extractor"; }

  needsReload = false;
  _sitePatterns = [
    /https:\/\/kitsu\.app\/(?:manga)\/(.+)/
  ];

  async getDetails() {
    return collectObject([
      getCover(),
      getDescription(),
      getMetadata(),
      getMappings(),
      // getTags(),
    ]);
  }
}

async function getCover() {
  const el = document.querySelector(`.media-sidebar--sticky img`);
  if (!el) return {};
  return getCoverData(el.src);
}

function getMappings() {
  const el = document.querySelector(`.media-sidebar--sticky img`);
  if (!el) return {};
  const match = el.src.match(/\/(\d+)\//);
  if (!match) return {};
  return { "Mappings": { "Kitsu": [match[1]] } };
}

function getTitle() {
  const title = document.querySelector(`.media--title h3`)?.textContent;
  if (!title) return {};
  return { "Title": cleanText(title) }
}

async function getDescription() {
  const description = document.querySelector(`.media-description`);
  if (!description) return {};
  const readMore = description.querySelector(`a[href="#"]`);
  if (readMore?.textContent?.toLowerCase()?.includes("read more")) {
    readMore.click();
    await delay(50);
  }

  const descriptionClone = description.cloneNode(true);
  descriptionClone.querySelector(`a[href="#"]`)?.remove()

  return { "Description": getFormattedText(descriptionClone) }
}

function getTags() {
  const tags = [...document.querySelectorAll(`.media--tags li`)].map(i => cleanText(i.textContent));
  if (tags.length === 0) return {};
  return { "Tags": tags };
}

async function getMetadata() {
  const info = document.querySelector(`.media-summary .media--information`);
  if (!info) return;

  const moreInfo = info.querySelector(`a.more-link`);
  if (moreInfo?.textContent?.toLowerCase()?.includes("more")) {
    moreInfo.click();
    await delay(50);
  }

  let details = {};

  let title;
  const titles = new Set();
  let gatherTitles = true;

  const listEls = [...info.querySelectorAll(`li`)];
  for (const el of listEls) {
    const labelEl = el.querySelector(`strong`);
    const valueEl = el.querySelector(`span`);
    if (!labelEl || !valueEl) continue;
    const label = cleanText(labelEl.textContent);
    if (label === "Type" || label === "Status") gatherTitles = false;

    let value = cleanText(valueEl.textContent);

    // title part ends with synonyms
    if (label === "Synonyms") {
      gatherTitles = false;
      value = value.split(",").map(i => titles.add(i));
      continue;
    }

    if (gatherTitles) {
      titles.add(value);
      if (label.includes("English")) title = value;
      continue;
    }

    if (label === "Published" && value.includes("to")) value = value.split("to")[0];

    details[label] = value;
  }

  titles.delete(title);
  details["Alt Titles"] = [...titles];
  details["Title"] = title ?? details["Alt Titles"][0];

  details = remapKeys({
    "Published": "Publication date",
    "Type": "Edition Format",
  }, details);

  if (details["Edition Format"]) details["Reading Format"] = normalizeReadingFormat(details["Edition Format"])

  return details;
}

export { kitsuScraper };

