import { addContributor, cleanText, collectObject, getCoverData, getFormattedText } from "../shared/utils.js";
import { Extractor } from "./AbstractExtractor.js"


class fanFictionNetScraper extends Extractor {
  get _name() { return "FanFiction Extractor"; }

  needsReload = false;
  _sitePatterns = [
    /https:\/\/www\.fanfiction\.net\/+s\/+(\d+)/
  ];

  async getDetails() {
    return collectObject([
      {
        "Publisher": "FanFiction.net",
        "Reading Format": "Ebook",
        "Edition Format": "Web Novel",
      },

      getCover(),
      getDetails(),
    ]);
  }
}

async function getCover() {
  const coverEl = document.querySelector(`#profile_top img`);
  if (!coverEl) return {};
  return getCoverData(coverEl.src);
}

function getDetails() {
  const detailsEl = document.querySelector(`#profile_top`);
  if (!detailsEl) return {};

  const details = {};

  const contributors = details["Contributors"] ?? [];
  val = [...document.querySelectorAll(`#profile_top a`)].filter(i => i.href?.includes("/u/"))[0]?.textContent;
  if (val) addContributor(contributors, cleanText(val), "Author");
  details["Contributors"] = contributors;

  val = document.querySelector(`#profile_top b`)?.textContent;
  if (val) details["Title"] = cleanText(val);

  val = document.querySelector(`#profile_top div.xcontrast_txt`);
  if (val) details["Description"] = getFormattedText(val);

  const infoSection = document.querySelector(`#profile_top span.xgray`).textContent.split("-").map(cleanText);
  for (const info of infoSection) {
    if (info.indexOf(":") === -1) continue;
    let [title, value] = info.split(":", 2).map(cleanText);

    if (title === "Published" || title === "Updated") continue;

    if (title === "Reviews") continue;
    if (title === "Favs") continue;
    if (title === "id") continue;
    if (title === "Follows") continue;
    if (title === "Rated") continue;

    details[title] = value;
  }

  details["Language"] = infoSection[1]; // should be constant ?

  val = document.querySelector(`#profile_top span.xgray span[data-xutime]:nth-of-type(2)`)?.attributes?.["data-xutime"]?.value;
  if (val) details["Publication date"] = val * 1000;

  return details;
}

export { fanFictionNetScraper };

