import { addContributor, cleanText, collectObject, getCoverData, getFormattedText, normalizeReadingFormat } from "../shared/utils.js";
import { Extractor } from "./AbstractExtractor.js"

class bookshopScraper extends Extractor {
  get _name() { return "bookstore.org Extractor"; }

  needsReload = false;

  _sitePatterns = [
    /https:\/\/bookshop\.org\/p\/books\/(.+)/,
  ];

  async getDetails() {
    let details = {};

    const ldInfoJsonEl = document.querySelector("script[type='application/ld+json']");
    const ldInfo = JSON.parse(ldInfoJsonEl.textContent);
    console.log("info", ldInfo);

    // cover
    const coverData = getCoverData(ldInfo["image"].filter(i => !i.includes("?v=enc-v1")));

    // isbn
    if (ldInfo["isbn"].length === 13) {
      details["ISBN-13"] = ldInfo["isbn"];
    } else {
      if (ldInfo["isbn"].length === 10) {
        details["ISBN-10"] = ldInfo["isbn"];
      }
    }

    // description
    const description = document.createElement("div");
    description.innerHTML = ldInfo["description"];
    details["Description"] = getFormattedText(description);

    // date
    // details["Publication date"] = ldInfo["datePublished"];
    details["Publication date"] = document.querySelector("meta[name='book:release_date']").content;

    // title
    details["Title"] = ldInfo["name"];
    const subtitle = document.querySelector("meta[name='description']").content;
    if (subtitle) {
      details["Title"] = `${details["Title"]}: ${subtitle}`;
    }

    // format
    details["Edition Format"] = ldInfo["bookFormat"];
    details["Reading Format"] = normalizeReadingFormat(ldInfo["bookFormat"]);

    // length
    if ("numberOfPages" in ldInfo && ldInfo["numberOfPages"] > 0) {
      details["Pages"] = ldInfo["numberOfPages"];
    }

    // author(s)
    let contributors = [];
    for (const author of ldInfo["author"]) {
      if (author && author.name) {
        addContributor(contributors, author.name, "Author");
      }
    }
    details["Contributors"] = contributors;

    // publisher
    details["Publisher"] = ldInfo["publisher"]?.name;

    // language (and potentially other fields)
    const table = document.querySelector("details table");
    for (const row of table.querySelectorAll("tr")) {
      const [key, val] = row.children;
      const keyname = cleanText(key.textContent);
      const value = cleanText(val.textContent);
      if (keyname === "Language") {
        details["Language"] = value;
        continue;
      }
      if (keyname === "Dimensions") {
        if (value === "N/A") continue;
        value.split("|").forEach(component => {
          if (component.includes(" g")) {
            details["Weight"] = component.trim();
            return;
          }
          if (component.includes("mm")) {
            details["Dimensions"] = component.trim();
            return;
          }
        });
        continue;
      }
    }

    return collectObject([
      details,
      coverData
    ]);
  }
}

export { bookshopScraper };
