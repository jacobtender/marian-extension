import {
  addContributor,
  collectObject,
  getCoverData,
  getFormattedText,
  normalizeReadingFormat,
  REGEX_TIME_HOURS_MINUTES
} from "../shared/utils.js";
import { Extractor } from "./AbstractExtractor.js";

const REGEX_SERIES_PLACE = /\d+(?=\s+of)/;


class penguinRandomHouseScraper extends Extractor {
  get _name() {
    return "penguinrandomhouse.com Extractor";
  }
  // Reloading resets reading format selection
  needsReload = false;
  _sitePatterns = [/https:\/\/(?:www\.)?penguinrandomhouse\.com\/books\/(\d+)/];

  async getDetails() {
    let details = {};
    const coverData = getCoverData(document.querySelector("#coverFormat").src);

    getProductDetails(details);

    return collectObject([details, coverData]);
  }
}

function getProductDetails(details) {
  details["Title"] = document.querySelector("h1").textContent.trim();
  details["Contributors"] = getContributors();
  details["Description"] = getFormattedText(
    document.querySelector("#book-description-copy")
  );

  const activeDropdownElement = document.querySelector(
    ".panel-heading.selected button"
  );
  const mobileReadingFormat = document.querySelector(".frmt-text");

  // Check if elements are visible, as they're still in the HTML
  if (
    activeDropdownElement?.offsetParent !== null &&
    activeDropdownElement?.innerText
  ) {
    // Some pages use one type of dash and some use the other type
    details["Reading Format"] = normalizeReadingFormat(
      activeDropdownElement.innerText
        .replace(/\n/, "")
        .replace("–", "")
        .replace("-", "")
    );
  } else if (mobileReadingFormat.offsetParent !== null) {
    details["Reading Format"] = normalizeReadingFormat(
      mobileReadingFormat.innerText
    );
  }

  if (document.querySelector(".series span a")?.innerText) {
    details["Series"] = document.querySelector(".series span a").innerText;
    details["Series Place"] = REGEX_SERIES_PLACE.exec(
      document.querySelector(".series span").textContent
    );
  }

  const rawDetails = document.querySelector(
    "#drawer-product-details .drawer-copy-text"
  ).children;

  for (let i = 0; i < rawDetails.length; i++) {
    switch (rawDetails[i].childNodes[0].textContent) {
      case "ISBN":
        details["ISBN-13"] = rawDetails[i].childNodes[1].textContent;
        break;
      case "Published on":
        details["Publication date"] = rawDetails[i].childNodes[1].textContent;
        break;
      case "Published by":
        details["Publisher"] = rawDetails[i].childNodes[1].textContent;
        break;
      case "Pages":
        details["Pages"] = rawDetails[i].childNodes[1].textContent;
        break;
      case "Length":
        const timeMatch = rawDetails[i].childNodes[1].textContent.match(
          REGEX_TIME_HOURS_MINUTES
        );

        const listeningLength = [];

        if (timeMatch[1]) listeningLength.push(`${timeMatch[1]} hours`);
        if (timeMatch[2]) listeningLength.push(`${timeMatch[2]} minutes`);

        details["Listening Length"] = listeningLength;
        break;
    }
  }
}

function getContributors() {
  const rawContributors = document.querySelectorAll(".show .contributor");
  const contributors = [];

  for (let i = 0; i < rawContributors.length; i++) {
    // The labels for authors are inconsistent across categories, however they're always first
    if (i == 0) {
      for (let j = 0; j < rawContributors[i].children.length; j++) {
        addContributor(
          contributors,
          rawContributors[i].children[j].textContent,
          "Author"
        );
      }
    } else {
      switch (
        rawContributors[i].firstChild.textContent
          .split(" ")
          .slice(0, 2)
          .join(" ")
      ) {
        case "Read by":
          for (let j = 0; j < rawContributors[i].children.length; j++) {
            addContributor(
              contributors,
              rawContributors[i].children[j].textContent,
              "Narrator"
            );
          }
          break;
        case "Illustrated by" || "Artwork by":
          for (let j = 0; j < rawContributors[i].children.length; j++) {
            addContributor(
              contributors,
              rawContributors[i].children[j].textContent,
              "Illustrator"
            );
          }
          break;
        case "Translated by":
          for (let j = 0; j < rawContributors[i].children.length; j++) {
            addContributor(
              contributors,
              rawContributors[i].children[j].textContent,
              "Translator"
            );
          }
          break;
        case "Cover Design":
          for (let j = 0; j < rawContributors[i].children.length; j++) {
            addContributor(
              contributors,
              rawContributors[i].children[j].textContent,
              "Cover Artist"
            );
          }
          break;
        default:
          for (let j = 0; j < rawContributors[i].children.length; j++) {
            addContributor(
              contributors,
              rawContributors[i].children[j].textContent
            );
          }
      }
    }
  }

  return contributors;
}

export { penguinRandomHouseScraper };
