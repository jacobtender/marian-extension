import {
  addContributor,
  collectObject,
  getCoverData,
  cleanText,
  normalizeReadingFormat,
  getFormattedText,
  clearDeepQueryCache
} from "../shared/utils.js";
import { Extractor } from "./AbstractExtractor.js";

class blackstoneLibaryScraper extends Extractor {
  get _name() {
    return "blackstonelibary.com Extractor";
  }
  needsReload = false;
  _sitePatterns = [/https:\/\/(?:www\.)?blackstonelibrary\.com\//];

  async getDetails() {
    let details = {};
    const coverData = getCoverData(document.querySelector("img.title-image").src);

    getProductDetails(details);

    return collectObject([details, coverData]);
  }

  // Editions of a book are given by the urlParam "sp"
  normalizeUrl(url, keepParams = ['sp']) {
    return super.normalizeUrl(url, keepParams);
  }
}

function getProductDetails(details) {
  let tableData = document.querySelectorAll("table.high-profile-details-wrap tr");

  if (tableData) {
    for (let data of tableData) {
      const textContent = data.querySelectorAll("td:not(.hidden)")
      if (textContent.length !== 0) {
        const key = textContent[0].textContent.trim();
        const value = textContent[1].textContent.trim();
        if (key.includes("Release")) {
          details["Publication date"] = setTimzoneOfDate(value);
        }
        else if (key.includes("Runtime")) {
          // Runtime is always given in the Format "HH.MM Hours"
          const runtimeValue = value.split(" ")[0];
          const time = runtimeValue.split(".");
          // Minutes are given in percentages of an hour (100 = 1 hour), so we need to convert it to the actual value
          const minutes = Math.floor(60 / 100 * parseInt(time[1]));

          const listeningLength = [];
          if (parseInt(time[0]) > 0) listeningLength.push(`${time[0]} hours`);
          if (minutes > 0) listeningLength.push(`${minutes} minutes`);

          details["Listening Length"] = listeningLength
        }
        else if (key.includes("ISBN")) {
          details["ISBN-13"] = value;
        }
        else if (key.includes("Publisher")) {
          details["Publisher"] = value;
        }
        else if (key.includes("Language")) {
          details["Language"] = value;
        }
      }
    }
  }

  details["Title"] = document.querySelector(".page-title h1").textContent.trim();
  details["Description"] = getDescription();
  details["Contributors"] = getContributors();
  getSeries(details);

  details["Reading Format"] = normalizeReadingFormat("audiobook");
  details["Edition Format"] = document.querySelector("span.product-group").textContent.trim();
  details["Edition Information"] = document.querySelector("p.abridgement").textContent.trim();


}

// checks if book is part of a series and adds it to the details
function getSeries(details) {
  const seriesContainer = document.querySelector(".lbd-first-tier-wrapper .bswrap > div > p:not(.abridgement,#creditline) > a");
  if (seriesContainer) {
    const textSplit = seriesContainer.textContent.split(":");
    if (textSplit.length > 1) {
      details["Series"] = textSplit[0].trim();
      details["Series Place"] = textSplit[1].replace("Book ", "").trim();
    }
  }
}

function getContributors() {
  const contributors = [];

  // get the order of contributor types
  const contributorSplit = document.querySelector("#creditline").innerHTML.toLowerCase().split("<br>");
  let contributorTypes = []
  for (let index = 0; index < contributorSplit.length; index++) {
    // Author is always the first contributor
    if (index === 0) {
      contributorTypes.push("Author");
      continue;
    }
    const element = contributorSplit[index];

    // matches anything that stand before the "by" word
    const siteTypeMatch = element.match(/^.*?(?=\sby\s)/)
    console.log(element, siteTypeMatch)
    const siteType = siteTypeMatch.length > 0 ? siteTypeMatch[0] : "";
    switch (siteType) {
      case "read":
        contributorTypes.push("Narrator");
        break;
      case "translated":
        contributorTypes.push("Translator");
        break;
      case "adapted":
        contributorTypes.push("Adapter");
        break;
      default: 
        contributorTypes.push("Other");
    }

  }

  const contributorList = document.querySelectorAll("#creditline > *");
  let brakeCount = 0;
  
  // Add Contributors from links the type is determined by the order of the contributor types
  for (let contributorElement of contributorList) {
    if (contributorElement.tagName === "BR") brakeCount++;
    else if (contributorElement.tagName === "A") {
      addContributor(contributors, contributorElement.textContent.trim(), contributorTypes[brakeCount]);
    }
  }

  return contributors;
}

function getDescription() {
  let description = "";
  const descriptionList = document.querySelectorAll("#summary .pad > p");

  // there are sites where the description is not i p tags but just in the .pad container
  if (descriptionList.length === 0) {
    const descriptionContainer = document.querySelector("#summary .pad");
    if (descriptionContainer) {
      description = getFormattedText(descriptionContainer).replace("Summary", "").trim();
    }
  }
  else {
    for (let descriptionElement of descriptionList) {
      description += descriptionElement.textContent.trim() + "\n\n";
    }
  }
  return description;
}

// set timzone to GMT+0000 to prevent the date from being changed
function setTimzoneOfDate(dateString) {
  return new Date(new Date(dateString).toString().split("GMT")[0] + "GMT+0000");
}

export { blackstoneLibaryScraper };