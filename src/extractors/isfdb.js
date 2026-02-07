import { addContributor, cleanText, collectObject, fetchHTML, getCoverData, getFormattedText, logMarian, normalizeReadingFormat, remapKeys } from "../shared/utils.js";
import { Extractor } from "./AbstractExtractor.js"

const editionRegex = /https:\/\/(?:www\.)?isfdb\.org\/cgi-bin\/pl\.cgi\?(\d+)/;
const novelRegex = /https:\/\/(?:www\.)?isfdb\.org\/cgi-bin\/title\.cgi\?(\d+)/;

class isfdbScraper extends Extractor {
  get _name() { return "ISFDB Extractor"; }

  needsReload = false;

  _sitePatterns = [
    novelRegex,
    editionRegex,
  ];

  async getDetails() {
    const url = window.location.href;
    if (url.match(editionRegex)) return scrapeEdition();
    if (url.match(novelRegex)) return scrapeBook();

    throw new Error("Not implemented");
  }

  normalizeUrl(url) {
    if (!url.includes("?")) return super.normalizeUrl(url);

    let [domain, id] = url.split("?");
    id = id.match(/\d+/)[0];
    return `${domain}?${id}`;
  }
}


const remappings = remapKeys.bind(undefined, {
  "Series Number": "Series Place",
  "Date": "Publication date",
  "Synopsis": "Description",

  "Publication": "Title",
  "Format": "Edition Format",

  "Current Tags": undefined,
  "Webpages": undefined,
  "User Rating": undefined,
  "Price": undefined,
  "Catalog ID": undefined,

  // "Notes": undefined,
});

const novelTypes = {
  "FANZINE": "Fanzine",
  "ANTHOLOGY": "Anthology",
  "CHAPBOOK": "Chapbook",
  "COLLECTION": "Collection",
  "MAGAZINE": "Magazine",
  "NONFICTION": "Non-Fiction",
  "NOVEL": "Novel",
  "OMNIBUS": "Omnibus",

  "SHORTFICTION": "Short Fiction",
  "POEM": "Poem",
  "ESSAY": "Essay",
  "REVIEW": "Review",
  "INTERVIEW": "Interview",
  "SERIAL": "Serial",
  "COVERART": "Cover Art",
  "INTERIORART": "Interior Art",
}

function scrapeBook(doc = document) {
  const contentEl = doc.querySelector("#wrap div.ContentBox:has(.recordID)");
  if (contentEl == undefined) throw new Error("Failed to find book element");
  const clonedContent = contentEl.cloneNode(true);

  const recordEl = clonedContent.querySelector(".recordID");
  recordEl.remove();

  const notesEl = clonedContent.querySelector(".notes");
  if (notesEl) {
    notesEl.after(document.createElement("br"));
    notesEl.remove();
  }

  const content = clonedContent.innerHTML.split(/<br>/i);
  if (notesEl) content.push.apply(content, notesEl.innerHTML.split(/<br>/i));

  clonedContent.querySelectorAll("sup.mouseover").forEach(i => i.innerText = " ")

  let details = {};

  recordEl.querySelector("b")?.remove();
  details["Mappings"] = { "ISFDB Title": [cleanText(recordEl.textContent)] };

  const container = document.createElement("div");
  for (const con of content) {
    container.innerHTML = con;
    const labelEl = container.querySelector("b");
    if (labelEl == undefined) {
      console.log("label is not found", element);
      continue;
    }
    let label = cleanText(labelEl.textContent.replace(":", ""));
    labelEl.remove();
    let value = cleanText(container.textContent);

    if (label === "Date") {
      const valSplit = value.split("-");
      if (valSplit.length === 3) {
        value = new Date(valSplit[0], Math.max(0, valSplit[1] - 1), valSplit[2]);
      }
    }
    if (label === "Author" || label === "Editor") {
      value = addContributor(details["Contributors"] ?? [], value, label);
      label = "Contributors";
    }
    if (label === "Authors") {
      let contrbutors = details["Contributors"] ?? [];
      for (const author of container.querySelectorAll("a")) {
        value = addContributor(contrbutors, cleanText(author.textContent), "Author");
      }
      label = "Contributors";
    }
    if (label === "Synopsis") {
      value = getFormattedText(container);
    }

    details[label] = value;
  }

  details = remappings(details);

  return details;
}

async function scrapeEdition() {
  const contentEl = document.querySelector("#wrap div.ContentBox:has(.recordID)");
  if (contentEl == undefined) throw new Error("Failed to find edition element");
  const clonedContent = contentEl.cloneNode(true);

  const titlesBoxEl = document.querySelector("#wrap div.ContentBox:not(:has(.recordID))");
  if (titlesBoxEl == undefined) throw new Error("Failed to find book info element");

  const recordEl = clonedContent.querySelector(".recordID");
  recordEl.remove();

  let details = {};
  let mappings = {};

  recordEl.querySelector("b")?.remove();
  mappings["ISFDB Edition"] = [cleanText(recordEl.textContent)];

  clonedContent.querySelectorAll("sup.mouseover").forEach(i => i.innerText = " ")

  const coverData = getCoverData(clonedContent.querySelector("img.scan")?.src);

  const listElements = clonedContent.querySelectorAll(".pubheader>ul>li")
  for (const element of listElements) {
    const labelEl = element.querySelector("b");
    if (labelEl == undefined) {
      console.log("label is not found", element);
      continue;
    }
    let label = cleanText(labelEl.textContent.replace(":", ""));
    labelEl.remove();
    let value = cleanText(element.textContent);

    if (label === "Date") {
      const valSplit = value.split("-");
      if (valSplit.length === 3) {
        value = new Date(valSplit[0], Math.max(0, valSplit[1] - 1), valSplit[2]);
      }
    }
    if (label === "Type") {
      if (value in novelTypes) {
        value = novelTypes[value];
      }
    }
    if (label === "Author" || label === "Editor") {
      value = addContributor(details["contributors"] ?? [], value, label);
      label = "contributors";
    }
    if (label === "Authors") {
      let contrbutors = details["contributors"] ?? [];
      for (const author of container.querySelectorAll("a")) {
        value = addContributor(contrbutors, cleanText(author.textContent), "Author");
      }
      label = "contributors";
    }
    if (label === "ISBN") {
      const isbns = value.split(" ");
      while (isbns.length > 0) {
        let isbn = isbns.pop();
        if (!isbn) break;
        isbn = isbn.replace(/[\[\] ]/g, "");
        const length = isbn.replaceAll("-", "").length;
        if (length === 10) {
          details["ISBN-10"] = isbn;
        } else if (length === 13) {
          details["ISBN-13"] = isbn;
        } else {
          logMarian(`WARN: unknown isbn '${isbn}'`)
        }
      }
      continue;
    }
    if (label === "Notes") {
      value = getFormattedText(element);
    }
    if (label === "Pages") {
      // get page primary count
      const newValue = value.match(/(\d+(?!]))/g)?.map(Number)?.reduce((a, b) => a + b) ?? value;
      if (newValue != value) {
        details["Pages original"] = value;
        value = newValue;
      }
    }
    if (label === "External IDs") {
      element.querySelectorAll("li").forEach(extId => {
        const extNameEl = extId.querySelector("abbr");
        if (extNameEl == undefined) {
          console.log("abbrivation name not found", extId);
          return;
        }
        let extName = cleanText(extNameEl.textContent);
        extNameEl.remove();
        console.log(extId)
        let id = cleanText(extId.textContent.replace(":", ""));

        mappings[extName] = mappings[extName] || [];
        mappings[extName].push(id);

      });
      continue;
    }
    if (label === "Format") {
      if (value.startsWith("hc")) {
        value = "Hardcover";
      } else if (value.startsWith("tp")) {
        value = "Trade Paperback";
      } else if (value.startsWith("pb")) {
        value = "Paperback";
      } else if (value.startsWith("digest") && value.includes("magazine")) {
        value = "Magazine";
      }
    }

    details[label] = value;
  }

  details = remappings(details);

  details["Reading Format"] = normalizeReadingFormat(details["Edition Format"]);

  // get link for main title, either one that matches the book, or the first one
  const titlesLi = [...titlesBoxEl.querySelectorAll("li")];
  const titleLinks = titlesLi
    .map(i => [...i.querySelectorAll("a")])
    .flat()
    .filter(i => i.href.includes("title.cgi"));
  let titleLink = (titleLinks
    .filter(i => cleanText(i.textContent) === details["Title"])[0]
    ?? titleLinks[0]
  )?.href;
  // if there is more then one book then don't fetch details for only one
  if (details["Type"]?.toUpperCase() === "OMNIBUS") titleLink = undefined;

  const bookDetailsPromise = new Promise((resolve, reject) => {
    if (titleLink == undefined) {
      resolve({});
      return;
    }
    fetchHTML(titleLink)
      .then((doc) => {
        if (doc == undefined) {
          reject("No document");
          return;
        }

        resolve(scrapeBook(doc));
      })
      .catch(reject);
  });

  details = await collectObject([
    bookDetailsPromise,
    coverData,
    details,
  ]);

  details["Mappings"] = await collectObject([
    details["Mappings"],
    mappings,
  ]);

  if ("contributors" in details) {
    let contrbutors = details["Contributors"] ?? [];
    for (const { name, roles } of details["contributors"]) {
      addContributor(contrbutors, name, roles);
    }
    details["Contributors"] = contrbutors;
    delete details["contributors"];
  }

  return details;
}

export { isfdbScraper };
