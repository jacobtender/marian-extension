import { logMarian, getFormattedText, getCoverData } from '../shared/utils.js';

const remapings = {
  "ISBN": "ISBN-10",
  "ISBN13": "ISBN-13",
  "Binding": "Edition Format",
  "Edition": "Edition Information",
  "Full Title": "Title",
}
const remappingKeys = Object.keys(remapings);

async function getIsbnDbDetails() {
  logMarian('Extracting isbndb.com details');

  const container = document.querySelector(".book-table table");
  if (!container) return null;

  const coverData = getCover(container);

  const bookDetails = extractTable(container)

  // logMarian("bookDetails", bookDetails);

  return (await Promise.all([
    coverData,
  ])).reduce((acc, currentVal) => ({ ...acc, ...currentVal }), bookDetails);
}

async function getCover() {
  /**@type{string|null}*/
  const coverUrl = document.querySelector(".artwork object")?.data || null;

  return getCoverData(coverUrl);
}

function extractTable(/**@type{HTMLTableElement}*/container) {
  const table = {};
  const rows = container.querySelectorAll("tr");
  for (let i = 0; i < rows.length; i++) {
    const el = rows[i];
    if (el.childNodes.length === 0) {
      continue;
    }

    const th = el.querySelector("th");
    const td = el.querySelector("td");
    if (td.classList.contains("blurred")) {
      // blurred row, skip
      continue;
    }

    if (td == null || th == null) {
      logMarian('invalid row', el.textContent);
      continue;
    }

    const key = th.textContent?.replace(":", "")?.trim()
    let value = td.textContent?.trim();

    // rest of table
    if (!key) {
      logMarian("empty key", el.textContent);
      continue;
    }

    // exceptions
    if (key === "Authors") {
      const contributors = [];
      td.childNodes.forEach((node) => {
        if (node.nodeName === "BR") return;
        const author = node.textContent?.trim();
        if (!author) return;
        contributors.push({ name: node.textContent, roles: ["Author"] })
      })
      table["Contributors"] = contributors;
      continue;
    }
    if (key === "Publish Date" && value != undefined) {
      try {
        value = new Date(value);
      } catch { }
      table["Publication date"] = value;
      continue;
    }
    if (key === "Pages" && value != undefined) {
      table["Pages"] = value.split(" ")[0].trim(); // remove pages text
      continue;
    }
    if (key === "Synopsis") {
      text = getFormattedText(td)
      table["Description"] = text;
      continue;
    }
    if (key === "Subjects") continue; // skip these

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

export { getIsbnDbDetails };
