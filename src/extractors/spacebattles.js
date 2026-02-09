import { addContributor, cleanText, collectObject, getFormattedText, remapKeys } from "../shared/utils.js";
import { Extractor } from "./AbstractExtractor.js"


class spacebattlesScraper extends Extractor {
  get _name() { return "Spacebattles Extractor"; }

  needsReload = false;
  _sitePatterns = [
    /https:\/\/forums\.spacebattles\.com\/+threads\/.*?\.(\d+)\/(?!page)/
  ];

  async getDetails() {
    return collectObject([
      {
        "Publisher": "Spacebattles",
        "Reading Format": "Ebook",
        "Edition Format": "Web Novel",
      },

      getTitle(),
      getDescription(),
      getMetadata(),
    ]);
  }
}

function getTitle() {
  const title = cleanText(document.querySelector(`.p-title`)?.textContent ?? "");
  if (!title) return {};
  return { "Title": title }
}

function getDescription() {
  let description = document.querySelector(`.threadmarkListingHeader-extraInfo article`);
  if (!description) return {};
  return { "Description": getFormattedText(description) }
}

function getMetadata() {
  let details = {};

  const contributors = details["Contributors"] ?? [];
  val = document.querySelector(`.p-description .username`)?.textContent;
  if (val) addContributor(contributors, val, "Author");
  details["Contributors"] = contributors;

  val = document.querySelector(`.tabPanes .collapseTrigger span`)?.textContent?.match(/(\d+) threadmark/)?.[1];
  if (val) details["Chapters"] = val;

  val = document.querySelectorAll(`.threadmarkListingHeader-stats dl`);
  if (val && val.length > 0) for (const header of val) {
    const titleEl = header.querySelector(`dt`);
    const valueEl = header.querySelector(`dd`);
    if (!titleEl || !valueEl) continue;
    let title = cleanText(titleEl.textContent);
    let value = cleanText(valueEl.textContent);

    if (title === "Created") {
      value = new Date(valueEl.querySelector(`time`)?.attributes["datetime"]?.value ?? value).toUTCString();
      title = "Publication date";
    }

    details[title] = value;
  }

  details = remapKeys({
    "Watchers": undefined,
    "Recent readers": undefined,
    "Threadmarks": undefined,
  }, details);


  // const tags = [...document.querySelectorAll(`.tagList dd a`)].map(i => cleanText(i.textContent));
  // if (tags && tags.length > 0) details["Tags"] = tags;

  return details;

}

export { spacebattlesScraper };

