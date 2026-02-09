import { addMapping, cleanText, collectObject, getCoverData, getFormattedText, normalizeReadingFormat } from "../shared/utils.js";
import { Extractor } from "./AbstractExtractor.js"

class animePlanetScraper extends Extractor {
  get _name() { return "Anime-Planet Extractor"; }

  needsReload = false;
  _sitePatterns = [
    /https:\/\/www\.anime-planet\.com\/(?:manga)\/(.+)/
  ];

  async getDetails() {
    return collectObject([
      getCover(),
      getTitle(),
      getDescription(),
      getAltTitles(),
      getMetadata(),
      getMappings(),
    ]);
  }
}

function getMappings() {
  const match = document.location.href.match(/\/manga\/([^/]+)/);
  if (!match) return {};
  return { "Mappings": { "AnimePlanet": [match[1]] } };
}

async function getCover() {
  const el = document.querySelector(`.entrySynopsis .mainEntry img`);
  if (!el) return {};
  return getCoverData(el.src);
}

function getTitle() {
  const title = document.querySelector(`h1[itemprop="name"]`)?.textContent;
  if (!title) return {};
  return { "Title": cleanText(title) }
}

function getAltTitles() {
  let titles = cleanText(document.querySelector(`h2.aka`)?.textContent ?? "");
  if (!titles) return {};
  const colen = titles.indexOf(":");
  if (colen === -1) return {};
  titles = titles.substring(colen + 1,);
  titles = titles.split(",").map(cleanText)
  return { "Alt Titles": titles }
}

function getDescription() {
  const description = document.querySelector(`.synopsisManga`);
  if (!description) return {};
  return { "Description": getFormattedText(description) }
}


function getMetadata() {
  const details = {};

  // const tags = [...document.querySelectorAll(`.entrySynopsis .tags li`)].map(i => cleanText(i.textContent));
  // if (tags.length > 0) details["Tags"] = tags;


  const data = document.querySelectorAll(`section.entryBar>div`);
  if (data && data.length === 5) {
    const chapCount = data[0];
    const publisher = data[1];
    const dateRange = data[2];

    const chapMatch = [...chapCount.textContent.matchAll(/vol: (?<volumes>\d+)|ch: (?<chapcount>\d+)(?<ongoing>\+)?/mig)];
    for (const match of chapMatch) {
      if (match.groups.ongoing) details["Status"] = "Ongoing";
      if (match.groups.volumes) details["Volumes"] = match.groups.volumes;
      if (match.groups.chapcount) details["Chapters"] = match.groups.chapcount;
    }

    details["Publisher"] = cleanText(publisher.textContent);

    let date = dateRange.textContent.split("-").map(cleanText)[0];
    if (/\d+/.test(date)) date = new Date(date, 0)
    details["Publication date"] = date;
  }

  if (details["Edition Format"]) details["Reading Format"] = normalizeReadingFormat(details["Edition Format"])

  return details;
}

export { animePlanetScraper };

