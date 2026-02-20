import { addContributor, cleanText, collectObject, fetchHTML, getFormattedText, remapKeys } from "../shared/utils.js";
import { Extractor } from "./AbstractExtractor.js"


class archiveOfOurOwnScraper extends Extractor {
  get _name() { return "Archive of Our Own Extractor"; }

  needsReload = false;
  _sitePatterns = [
    /https:\/\/archiveofourown\.org\/+works\/+(\d+)/
  ];

  async getDetails() {
    return collectObject([
      {
        "Publisher": "Archive of Our Own",
        "Reading Format": "Ebook",
        "Edition Format": "Web Novel",
      },

      getMetadata(),
      getDescription(),
    ]);
  }
}

async function getDescription() {
  const baseUrl = document.location.href.match(/https:\/\/archiveofourown\.org\/+works\/+\d+/)[0]
  const doc = await fetchHTML(`${baseUrl}?view_full_work=true`);
  if (!doc) return {};
  const summery = doc.querySelector(`#workskin .summary blockquote`);
  return { "Description": getFormattedText(summery) };
}

function getMetadata() {
  let details = {};

  const contributors = details["Contributors"] ?? [];
  val = document.querySelector(`#workskin a[rel="author"]`)?.textContent;
  if (val) addContributor(contributors, val, "Author");
  details["Contributors"] = contributors;

  val = document.querySelector(`#workskin>.preface .title`)?.textContent;
  if (val) details["Title"] = val;

  const metaInfo = document.querySelector(`.work div.wrapper>dl`);
  if (metaInfo) {
    for (let i = 0; i < metaInfo.children.length; i += 2) {
      const titleEl = metaInfo.children[i];
      const valueEl = metaInfo.children[i + 1];
      if (!titleEl || !valueEl) continue;

      let title = cleanText(titleEl?.textContent?.replace(":", "") ?? "")
      let value = cleanText(valueEl?.textContent ?? "")

      if (title === "Archive Warning" && value === "Creator Chose Not To Use Archive Warnings") continue;

      if (valueEl.querySelector(`ul`)) {
        value = [...valueEl.querySelectorAll(`li`)].map(i => cleanText(i.textContent));
      }

      if (title === "Stats") {
        const statInfo = valueEl.querySelector(`dl.stats`);
        if (!statInfo) continue;

        for (let j = 0; j < metaInfo.children.length; j += 2) {
          const statTitleEl = statInfo.children[j];
          const statValueEl = statInfo.children[j + 1];
          if (!statTitleEl || !statValueEl) continue;

          title = cleanText(statTitleEl?.textContent?.replace(":", "") ?? "")
          value = cleanText(statValueEl?.textContent ?? "")

          if (title === "Chapters") {
            if (value.indexOf("?") === -1) details["Status"] = "Completed";
            else details["Status"] = "Incomplete";

            value = value.split("/")[0]
          }

          details[title] = value;
        }

        continue;
      }

      details[title] = value;
    }
  }

  details = remapKeys({
    "Characters": undefined,
    "Additional Tags": undefined,
    "Fandoms": undefined,
    "Fandom": undefined,
    "Categories": undefined,
    "Relationships": undefined,
    "Category": undefined,
    "Series": undefined,

    "Hits": undefined,
    "Bookmarks": undefined,
    "Kudos": undefined,
    "Comments": undefined,
    "Updated": undefined,

    "Published": "Publication date",
    "Archive Warnings": "Content Warnings"
  }, details);

  return details;

}

export { archiveOfOurOwnScraper };

