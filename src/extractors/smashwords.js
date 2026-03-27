import {
  addContributor,
  cleanText,
  collectObject,
  getCoverData,
  getFormattedText,
} from "../shared/utils.js";
import { Extractor } from "./AbstractExtractor.js";

const REGEX_NUMBER = /\d+/;

class smashwordsScraper extends Extractor {
  get _name() {
    return "Smashwords Extractor";
  }

  _sitePatterns = [/https?:\/\/(?:www\.)?smashwords\.com\/books\/(.+)/];

  async getDetails() {
    let details = {};
    const coverData = getCoverData(document.querySelector(".cover-medium").src);

    getProductDetails(details);

    return collectObject([details, coverData]);
  }

  needsReload = true;
}

function getProductDetails(details) {
  details["Title"] = cleanText(document.querySelector("h1").textContent);
  details["Contributors"] = getContributors();
  details["Reading Format"] = "Ebook";

  //   No IDs or other unique identifiers for "Show Long Description" button
  for (const btn of document.querySelectorAll(".btn-link")) {
    if (btn.textContent.includes("Show Long Description")) {
      btn.click();
    }
  }

  //   In case there's no long description use short description
  if (document.querySelector(".collapse.show div")) {
    details["Description"] = getFormattedText(
      document.querySelector(".collapse.show div"),
    );
  } else {
    details["Description"] = getFormattedText(
      document.querySelector(".col-sm-9 .my-3 div"),
    );
  }

  const rawDetails = document.querySelectorAll("table tbody tr");

  for (let i = 0; i < rawDetails.length; i++) {
    console.log(
      `case ${i}: ${rawDetails[i].childNodes[0].childNodes[0].textContent}`,
    );
    switch (rawDetails[i].childNodes[0].childNodes[0].textContent) {
      case "ISBN-13":
        details["ISBN-13"] = rawDetails[i].childNodes[1].textContent;
        break;
      case "Language":
        details["Language"] = rawDetails[i].childNodes[1].textContent;
        break;
      case "Published On" || "Originally Published On":
        details["Publication date"] = rawDetails[i].childNodes[1].textContent;
        break;
      case "Publisher":
        details["Publisher"] = rawDetails[i].childNodes[1].textContent;
        break;
      case "Series":
        details["Series"] =
          rawDetails[i].childNodes[1].childNodes[0].childNodes[0].textContent;
        details["Series Place"] = REGEX_NUMBER.exec(
          rawDetails[i].childNodes[1].childNodes[0].childNodes[1].textContent,
        );
        break;
    }
  }
}

function getContributors() {
  const contributors = [];

  for (const a of document.querySelectorAll("a[itemprop='author']")) {
    addContributor(contributors, a.textContent, "Author");
  }

  return contributors;
}

export { smashwordsScraper };
