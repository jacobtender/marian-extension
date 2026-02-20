import { addContributor, cleanText, collectObject, getCoverData, getFormattedText } from "../shared/utils.js";
import { Extractor } from "./AbstractExtractor.js"


class wattpadScraper extends Extractor {
  get _name() { return "Royal Road Extractor"; }

  needsReload = false;
  _sitePatterns = [
    /https:\/\/www\.wattpad\.com\/story\/+(\d+)/
  ];

  async getDetails() {
    return collectObject([
      {
        "Publisher": "Wattpad",
        "Reading Format": "Ebook",
        "Edition Format": "Web Novel",
      },

      getCover(),
      getTitle(),
      getDescription(),
      getMetadata(),
    ]);
  }
}

async function getCover() {
  // get currently selected cover
  let el = document.querySelector(`div[data-testid="cover"] img`);
  if (!el) return {};
  return getCoverData(el.src);
}

function getTitle() {
  let title = cleanText(document.querySelector(`div[data-testid="story-details-page"] .-ydhR div`)?.textContent ?? "");
  if (!title) return {};
  return { "Title": title }
}


function getDescription() {
  let description = document.querySelector(`div[data-testid="story-details-page"] .glL-c pre`);
  if (!description) return {};
  return { "Description": getFormattedText(description) }
}

function getMetadata() {
  const details = {};

  const contributors = details["Contributors"] ?? [];
  val = document.querySelector(`div[data-testid="story-details-page"] .af6dp a`)?.textContent;
  if (val) addContributor(contributors, val, "Author");
  details["Contributors"] = contributors;

  const completedTag = document.querySelector(`div[data-testid="story-details-page"] div[data-testid="completed-tag"]`);
  const matchCompletedDate = completedTag?.dataset?.tooltipHtml?.match(/strong>(.+?)<\/strong/)
  if (matchCompletedDate) details["Publication date"] = matchCompletedDate[1];
  if (completedTag.textContent) details["Status"] = cleanText(completedTag.textContent);

  // const tags = [...document.querySelectorAll(`div[data-testid="story-details-page"] div[data-testid="tag-carousel"] a`)].map(i => cleanText(i.textContent));
  // if (tags && tags.length > 0) details["Tags"] = tags;

  val = document.querySelector(`div[data-testid="story-details-page"] ul.n0iXe li:nth-of-type(3) [data-testid="tooltip"]`)?.dataset?.tip;
  if (val) details["Chapters"] = cleanText(val);

  return details;

}

export { wattpadScraper };
