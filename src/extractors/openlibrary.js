import { Extractor } from "./AbstractExtractor.js"
import { addContributor, collectObject, getCoverData, normalizeDescription, normalizeReadingFormat, remapKeys, addMapping as addMappingFunc } from "../shared/utils.js";

// references:
//  https://openlibrary.org/dev/docs/api/books
//  https://docs.openlibrary.org/4_Librarians/Guide-to-Identifiers.html

// only have the id part in the mappings
const idOnly = false;

const OLIDRegex = /https?:\/\/(?:www\.)?openlibrary\.org(\/(?:books|works)\/OL\d+\w)/;

class openlibraryScraper extends Extractor {
  get _name() { return "Open Library Extractor"; }
  needsReload = false;

  _sitePatterns = [
    OLIDRegex,
  ];

  async getDetails() {
    const idMatch = document.location.href.match(OLIDRegex);
    if (idMatch == undefined) throw new Error("Invalid id");
    const id = idMatch[1];

    return getDetails(id);
  }
}

const mappingDict = {
  "goodreads": "Goodreads",
  "google": "Google Books",
  "project_gutenberg": "Project Gutenberg",
  "librarything": "LibraryThing",

  "paperback": "Paperback",
  "hardcover": "Hardcover",
}
function remappings(text) {
  if (text in mappingDict) return mappingDict[text];
  return text;
}

async function getDetails(idUrl) {
  const data = await fetchJson(idUrl);
  const isEdition = getFirstKey(data["type"])?.includes("edition");

  const detailsList = [];
  const mappings = {};

  if (isEdition) {
    addMapping(mappings, "Open Liberary Edition", data["key"]);

    const work = getFirstKey(data["works"]);
    if (work) {
      detailsList.push(getDetails(work));
    }
  } else {
    addMapping(mappings, "Open Liberary Work", data["key"]);
  }
  if ("covers" in data) {
    const covers = data["covers"].filter((i) => i > 0);
    if (covers.length > 0) {
      const coverId = covers[0];
      detailsList.push(getCoverData(`https://covers.openlibrary.org/b/id/${coverId}-L.jpg`));
    }
  }

  const details = {};
  detailsList.push(details);

  if ("physical_format" in data) {
    details["Edition Format"] = remappings(data["physical_format"]);
    details["Reading Format"] = normalizeReadingFormat(data["physical_format"]);
  }
  if ("number_of_pages" in data) {
    details["Pages"] = data["number_of_pages"];
  }
  if ("pagination" in data) {
    details["Pagination"] = data["pagination"];
  }
  if ("title" in data) {
    details["Title"] = data["title"];
  }
  if ("description" in data) {
    const description = normalizeDescription(data["description"]);
    if (description) {
      details["Description"] = description;
    }
  }
  if ("identifiers" in data) {
    Object.entries(data["identifiers"]).forEach(([k, v]) => {
      k = remappings(k);
      if (k === "amazon") {
        detailsList.push({ "ASIN": v[0] });
        return;
      }
      v.forEach(i => addMapping(mappings, k, i));
    });
  }
  if ("oclc_numbers" in data) {
    const number = data["oclc_numbers"][0];
    if (number) addMapping(mappings, "OCLC/WorldCat", number)
  }
  if ("lccn" in data) {
    const number = data["lccn"][0];
    if (number) addMapping(mappings, "LCCN", number);
  }

  if ("publish_places" in data) {
    const location = data["publish_places"][0];
    if (location) {
      details["Country"] = location;
    }
  }

  if ("isbn_13" in data) {
    const isbn = data["isbn_13"][0];
    if (isbn) {
      details["ISBN-13"] = isbn;
    }
  }
  if ("isbn_10" in data) {
    const isbn = data["isbn_10"][0];
    if (isbn) {
      details["ISBN-10"] = isbn;
    }
  }

  if ("edition_name" in data) {
    details["Edition Information"] = data["edition_name"];
  }
  if ("publish_date" in data) {
    details["Publication date"] = parseDateLocal(data["publish_date"]);
  }
  if ("publishers" in data) {
    details["Publisher"] = data["publishers"][0];
  }

  if ("languages" in data) {
    detailsList.push((async () => {
      const languageId = getFirstKey(data["languages"]);
      const langData = await fetchJson(languageId);
      const name = langData["name"];
      if (name) {
        return { "Language": name };
      }
      return {};
    })());
  }

  if ("translated_from" in data) {
    detailsList.push((async () => {
      const languageId = getFirstKey(data["translated_from"]);
      const langData = await fetchJson(languageId);
      const name = langData["name"];
      if (name) {
        return { "Original Language": name };
      }
      return {};
    })());
  }

  if ("authors" in data) {
    detailsList.push((async () => {
      const contributors = [];

      for (const author of data["authors"]) {
        let role = "Author"
        let authorKey = author.key;
        if (authorKey == undefined) {
          if (!("type" in author)) continue;
          const typeKey = author.type.key;
          if (typeKey && typeKey !== "/type/author_role") {
            // TODO: get role name from endpoint
            role = typeKey.split("/").splice(-1)[0] || typeKey;
          }
          authorKey = author?.author?.key;
        }

        if (authorKey == undefined) continue;

        const authorData = await fetchJson(authorKey);
        const name = authorData["name"];
        if (name) {
          addContributor(contributors, name, role);
        }
      }
      return contributors.length > 0 ? { "contributors": contributors } : {};
    })());
  }

  const result = await collectObject(detailsList);

  const contributors = result["contributors"] ?? [];
  if (result["Contributors"]) result["Contributors"].forEach(({ name, roles }) => {
    addContributor(contributors, name, roles);
  });
  delete result["contributors"];
  result["Contributors"] = contributors;

  if (result["Mappings"]) Object.entries(result["Mappings"]).forEach(([k, v]) => {
    v.forEach(i => {
      addMapping(mappings, k, i);
    })
  });
  result["Mappings"] = mappings;
  return result;
}

function addMapping(mappings, name, idUrl) {
  return addMappingFunc(mappings, name, idOnly ? idUrl.match(/OL\d+\w/)[0] : idUrl);
}

function getFirstKey(obj) {
  if (Array.isArray(obj)) {
    obj = obj[0];
    if (obj == undefined) return;
  }
  return obj?.key;
}

function parseDateLocal(dateStr) {
  if (dateStr.match(/^[a-z]+ \d+$/i)) {
    dateStr = `1 ${dateStr}`;
  }

  if (!dateStr.match(/^\d+(?:-\d+)?(?:-\d+)?$/)) {
    return new Date(dateStr);
  }

  const [year, month, day] = dateStr.split('-').map(Number);

  return new Date(
    year,
    (month - 1) || 0,
    day || 1
  );
}

/**
 * fetch JSON endpoint for OpenLibrary api
 * @param {string} idUrl - the id / path for the endpoint
 */
async function fetchJson(idUrl) {
  if (!idUrl.startsWith("/")) idUrl = `/${idUrl}`;
  try {
    const response = await fetch(`https://openlibrary.org${idUrl}.json`);
    if (!response.ok) {
      throw new Error(`API error! status: ${response.status}`);
    }
    const json = await response.json();

    return json;
  } catch (error) {
    console.error('Error fetching data:', error);
  }
}

export { openlibraryScraper };
