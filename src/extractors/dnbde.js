import { getImageScore, logMarian, sendMessage, getFormattedText } from '../shared/utils.js';

const remapings = {
  'Ausgabe': 'Edition Information',
  'Verlag': "Publisher",
  "Titel": "Title",

  "Herausgeber": "Editor",
  "Verfasser": "Author",
  "Mitwirkender": "Contributor",
}
const remappingKeys = Object.keys(remapings);

async function getDnbDeDetails() {
  logMarian('Extracting isbn.de details');

  const container = document.querySelector("#fullRecordTable");
  if (!container) return null;

  const coverData = getCover(container);

  const bookDetails = extractTable(container)
  const bookDescription = getDescription(bookDetails);

  // logMarian("bookDetails", bookDetails);

  return (await Promise.all([
    coverData,
    bookDescription,
  ])).reduce((acc, currentVal) => ({ ...acc, ...currentVal }), bookDetails);
}

async function getCover(container) {
  /**@type{string|null}*/
  const coverUrl = container.querySelector("img[title='Cover']")?.src || null;
  const largeUrl = coverUrl?.replace("size=", "sz="); // get large cover

  // check large cover first
  if (largeUrl) {
    const largeScore = await getImageScore(largeUrl);
    if (largeScore !== 0) {
      return {
        img: largeUrl,
        imgScore: largeScore
      }
    }
  }

  // fallback to small
  return {
    img: coverUrl,
    imgScore: coverUrl ? await getImageScore(coverUrl) : 0
  }
}

function extractTable(/**@type{HTMLTableElement}*/container) {
  const table = {};
  const rows = container.querySelectorAll("tr");
  for (let i = 1; i < rows.length; i++) {
    const el = rows[i];
    const children = el.querySelectorAll("td");
    if (children.length === 0) {
      continue;
    }

    if (children.length !== 2) {
      logMarian('invalid row', el.textContent);
      continue;
    }

    const key = children[0].textContent?.trim();
    let value = children[1].textContent?.trim();
    // exceptions
    if (key.includes("Datensatz")) { // db link
      // https://d-nb.info/XXXXXXXXXXX
      table["Source ID"] = value.split("https://d-nb.info/")[1] || value;
      continue
    }
    if (key === "EAN" && !table["ISBN-13"]) {
      table["ISBN-13"] = value;
      // leave it in as an extra field in case its different from isbn, true for older books
      // continue;
    }
    if (key === "Andere Ausgabe(n)") continue; // not this novel
    if (key === "Umfang/Format") {
      const [pages, size] = value.split(";").map(item => item.trim());
      table["Pages"] = pages.split(" ")[0].trim();
      continue;
    }
    if (key === "ISBN/Einband/Preis") {
      const isbn10 = children[1].childNodes[2]?.textContent?.trim();
      if (!!isbn10 && isbn10.replaceAll("-", "").length === 10) {
        table["ISBN-10"] = isbn10;
      }

      const isbn13AndPrice = children[1].childNodes[0]?.textContent?.trim();
      const isbn13 = isbn13AndPrice?.split(" ")[0]?.trim();
      if (!!isbn13 && isbn13.replaceAll("-", "").length === 13) {
        table["ISBN-13"] = isbn13;
      }
      continue;
    }
    if (key === "Person(en)") {
      const contributors = [];
      children[1].childNodes.forEach(el => {
        if (el.nodeName === "BR") return;
        const authorTextRaw = el.textContent?.trim();
        if (authorTextRaw) contributors.push(extactAuthor(authorTextRaw))
      })
      table["Contributors"] = contributors;
      continue;
    }
    if (key === "Sprache(n)") {
      if (!value.includes(",")) {
        table["Language"] = value;
        continue;
      }
      // leave the original for if there is an `Originalsprache(n)`
      table["Language"] = value.split(",")[0].trim();;
    }
    if (key === "Zeitliche Einordnung") {
      table["Publication date"] = parseDate(value) || value;
      continue;
    }
    if (key === "Weiterführende Informationen" && value === "Inhaltstext") {  // description
      const descriptionLink = children[1].querySelector("a")?.href || null;
      if (!!descriptionLink) {
        table["descriptionLink"] = descriptionLink;
        continue;
      }
    }
    if (key === "Beziehungen") continue;

    // rest of table
    if (!key) {
      logMarian("empty key", el.textContent);
      continue;
    }

    table[key] = value
  }


  for (let [key, value] of Object.entries(table)) {
    if (remappingKeys.includes(key)) {
      delete table[key];
      key = remapings[key];
    }
    table[key] = value;
  }

  return table;
}

/**
  * extracts an author in format `last name, first name (role)` and returns a contributor object
  *
  * @param {string} author 
  * @returns {{name: string, roles: Array<string>}}
  */
function extactAuthor(author) {
  const match = author.match(/^(?<lastname>[^,]+), (?<firstname>.+?)(?: \((?<role>[^)]+)\))?$/);
  if (match == null) {
    return { name: author, roles: ["Other"] }
  }

  const name = match.groups["firstname"] + " " + match.groups["lastname"];
  let role = match.groups["role"] ?? "Author";

  // translate some roles
  if (remappingKeys.includes(role)) {
    role = remapings[role];
  }

  return { name, roles: [role] }
}

async function getDescription(bookDetails) {
  if (!("descriptionLink" in bookDetails)) {
    return;
  }
  const link = bookDetails["descriptionLink"];
  delete bookDetails["descriptionLink"];

  const url = new URL(link);
  url.protocol = "https:"; // have to be done
  const res = await sendMessage({
    action: 'fetchDepositData',
    url: url.toString()
  });
  if (!res || res.status !== 'success') {
    logMarian('Error from background script:', res && res.message);
    return {}
  }

  const text = extractTextFromHTML(res.data);
  return { "Description": text }
}

function extractTextFromHTML(htmlString) {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = htmlString;

  return getFormattedText(tempDiv);
}

/**
  * @param {string} dateString
  * @returns {string} returns a parsed / normalized date
  */
function parseDate(dateString) {
  if (dateString.includes(":")) {
    // remove `Erscheinungsdatum` and `Erscheinungstermin`
    dateString = dateString.split(":")[1].trim();
  }

  // check if its in the MM/YYYY format
  if (/^(0?[1-9]|1[0-2])\/([0-9]{4})$/.test(dateString)) {
    const [month, year] = dateString.split("/")
    return new Date(year, month - 1).toISOString();
  }

  // check if its just a year
  if (/^([0-9]{4})$/.test(dateString)) {
    return new Date(dateString, 0).toISOString();
  }

  try {
    // try parsing as is
    return new Date(dateString).toISOString();
  } catch {
    // give parsing one more shot, prepend a one
    try {
      return new Date("1 " + dateString).toISOString();
    } catch { }

    // parsing failed, return date as it is
    return dateString;
  }
}

export { getDnbDeDetails };
