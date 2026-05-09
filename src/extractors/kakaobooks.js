import {
  addContributor,
  collectObject,
  getCoverData,
  cleanText,
  normalizeReadingFormat,
  clearDeepQueryCache
} from "../shared/utils.js";
import { Extractor } from "./AbstractExtractor.js";

class kakaobooksScraper extends Extractor {
  get _name() {
    return "kakaobooks.com Extractor";
  }
  needsReload = false;
  _sitePatterns = [/https:\/\/(?:www\.)?kakaobooks\.com\/producto\//];

  async getDetails() {
    let details = {
      "Publisher": "Kakao Books",
      "Language": "Spanish; Castilian"
    };
    const coverData = getCoverData(document.querySelector(".woocommerce-product-gallery__image:first-of-type img").src);

    getProductDetails(details);

    return collectObject([details, coverData]);
  }
}

function getProductDetails(details) {
  let jsonData = JSON.parse(document.querySelector("script[type='application/ld+json']").innerText)?.["@graph"];
  if (jsonData) {
    jsonData = jsonData[jsonData.length - 1];
    const descriptionArray = jsonData.description.split("\r\n");

    // sometimes the title has the type of book after the title
    const titleSplit = jsonData.name.split(" (")
    details["Title"] = titleSplit[0];

    if (titleSplit[titleSplit.length - 1].toLowerCase().includes("físico")) {
      details["Reading Format"] = normalizeReadingFormat("physical");
    }

    const contributors = [];
    // check description for information
    descriptionArray.forEach(dataString => {
      const splitString = dataString.split(":");
      if (dataString.includes("Autora") || dataString.includes("Autor")) {
        addContributor(contributors, splitString[1].trim(), "Author");
      }
      else if (dataString.includes("Páginas")) {
        details["Pages"] = splitString[1].trim();
      }
      else if (dataString.includes("Traducción")) {
        addContributor(contributors, splitString[1].trim(), "Translator");
      }
      else if (dataString.includes("ISBN")) {
        // somtimes there is a discription after the ISBN so we need to split it
        details["ISBN-13"] = splitString[1].trim().split(" ")[0];
      }
      else if (dataString.includes("Lanzamiento")) {
        details["Publication date"] = convertLocaleDateString(splitString[1].trim());
      }
      else if (dataString.includes("Cubierta")) {
        addContributor(contributors, splitString[1].trim(), "Cover Artist");
      }
    });
    details["Contributors"] = contributors;
    details["Description"] = cleanText(getDescription());

    const categorys = document.querySelectorAll("span.posted_in a");
    const tags = document.querySelectorAll("span.tagged_as a");
  }
}

// The description is in p tags after a hr tag
function getDescription() {
  const descriptionChilds = document.querySelectorAll(".woocommerce-product-details__short-description > *");
  let targetNodeFound = false;
  let returnString = ""
  if (!descriptionChilds) return "";
  
  for (let child of descriptionChilds) {
    if (targetNodeFound && child.tagName === "P") {
      returnString += child.textContent + "\n\n";
    }
    else if (child.tagName === "HR") {
      targetNodeFound = true;
    }
  }
  return returnString;
}

// replaces the spanish month names with english month names
function convertLocaleDateString(dateString) {
  const returnDate = new Date(dateString
    .replace("de enero de", "January")
    .replace("de febrero de", "February")
    .replace("de marzo de", "March")
    .replace("de abril de", "April")
    .replace("de mayo de", "May")
    .replace("de junio de", "June")
    .replace("de julio de", "July")
    .replace("de agosto de", "August")
    .replace("de septiembre de", "September")
    .replace("de octubre de", "October")
    .replace("de noviembre de", "November")
    .replace("de diciembre de", "December"));

  // set the timezone to GMT+0000 to prevent the date from being changed
  return new Date(returnDate.toString().split("GMT")[0] + "GMT+0000");
}

export { kakaobooksScraper };
