import { Extractor } from "./AbstractExtractor.js";
import { addContributor, cleanText, collectObject, getCoverData, getFormattedText, normalizeReadingFormat, remapKeys } from "../shared/utils.js";

const nameRemap = remapKeys.bind(undefined, {
  "Shipping Weight": undefined,
  "Reading Level": undefined,
  "Dimensions": undefined,
  "Page Count": "Pages",
  "Publish Date": "Publication date",
});

class booksAMillionScraper extends Extractor {
  get _name() { return "Books A Million Extractor"; }

  needsReload = false;
  _sitePatterns = [
    /https:\/\/(?:www\.)?booksamillion\.com\/p\/+.*?(\d+)/
  ];

  async getDetails() {
    let details = {};

    details["Title"] = cleanText(document.querySelector("#pdpTitleText").textContent ?? "");
    const contributors = [];
    document.querySelectorAll("#pdpAuthor a").forEach((author) => {
      addContributor(contributors, cleanText(author.textContent ?? ""), "Author");
    });
    details["Contributors"] = contributors;
    details["Description"] = getFormattedText(document.querySelector("#full_anno"));

    details["Edition Format"] = cleanText(document.querySelector(`#pdpPrice .details-format`)?.textContent ?? "");
    details["Reading Format"] = normalizeReadingFormat(details["Edition Format"]);

    for (const detail of document.querySelectorAll(`#pdpDetails ul>li`)) {
      let [title, value] = detail.textContent.split(":").map(cleanText);
      if (!title || !value) continue;

      details[title] = value
    }

    if (details["ISBN-10"].length === 13 && details["ISBN-10"] === details["ISBN-13"])
      delete details["ISBN-10"];


    details = nameRemap(details);

    const available = cleanText(document.querySelector(`.productAvailableText`)?.textContent ?? "");
    const availableMatch = !available ? undefined : available
      .match(/Preorder.*?(\w+ \d+, \d{4})/);
    if (availableMatch) {
      details["Publication date"] = availableMatch[1];
    }

    return collectObject([
      getCoverData(document.querySelector(`#pdpImg>a>img`)?.src),
      details,
    ]);
  }
}

export { booksAMillionScraper };

