import { Extractor } from "./AbstractExtractor.js"
import {
  addContributor,
  addMapping,
  cleanText,
  collectObject,
  fetchHTML,
  getCoverData,
  getFormattedText,
  normalizeReadingFormat,
  remapKeys,
} from '../shared/utils.js';

const seriesRE = /Book (?<position>\d+) of (?<total>\d+): (?<series>.+)/;

class abeBooksScraper extends Extractor {
  get _name() { return "AbeBooks extractor"; }

  needsReload = false;
  _sitePatterns = [
    /https:\/\/www\.(abebooks\.(?:com|it|fr|de|co\.uk)|(?:iberlibro|zvab)\.com)\/+products\/+isbn\/+(\d{10}|\d{13})(?!\d)/,
    /https:\/\/www\.(abebooks\.(?:com|it|fr|de|co\.uk)|(?:iberlibro|zvab)\.com)\/+servlet\/+BookDetailsPL\?.*bi=(\d+)/,
    /https:\/\/www\.(abebooks\.(?:com|it|fr|de|co\.uk)|(?:iberlibro|zvab)\.com)\/+.*?\/+(\d{4,})\/+bd/,
    /https:\/\/www\.(abebooks\.(?:com|it|fr|de|co\.uk)|(?:iberlibro|zvab)\.com)\/+(\d{10}|\d{13})(?!\d)/,
  ];

  async getDetails() {
    return collectObject([
      getSeries(),
      getMetadata(),
      getCover(),
      getDescription(),
    ]);
  }
}

const remapings = {
  "Rating": undefined,
  "Editor": undefined,
  "Seller catalogs": undefined,
  "Condition": undefined,
  "Dust Jacket Condition": undefined,
  "Edition number": undefined,
  "Weight": undefined,

  "ISBN 10": "ISBN-10",
  "ISBN 13": "ISBN-13",
  "Binding": "Edition Format",
  "Number of pages": "Pages",
  "Edition": "Edition Information",
  "Publication Date": "Publication date",

  "Numero di pagine": "Pages",
  "Redattore": undefined, // editor 
  "Persona responsabile": undefined,
  "Rilegatura": "Edition Format",
  "Lingua": "Language",
  "Data di pubblicazione": "Publication date",
  "Editore": "Publisher",
  "Contatto del produttore": undefined,

  "Personne responsable": undefined,
  "Coordonnées du fabricant": undefined,
  // "Éditeur": undefined, // editor
  "Nombre de pages": "Pages",
  "Reliure": "Edition Format",
  "Langue": "Language",
  "Date d'édition": "Publication date",
  // "Éditeur": "Publisher", // publisher

  "Verlag": "Publisher",
  "Erscheinungsdatum": "Publication date",
  "Sprache": "Language",
  "Einband": "Edition Format",
  "Anzahl der Seiten": "Pages",
  "Herausgeber": undefined, // editor
  "Kontakt zum Hersteller": undefined,
  "Verantwortliche Person": undefined,

  "Persona responsable": undefined,
  "Contacto del fabricante": undefined,
  "Número de páginas": "Pages",
  "Encuadernación": "Edition Format",
  "Idioma": "Language",
  "Año de publicación": "Publication date",
  "Editorial": "Publisher"
}
const nameRemap = remapKeys.bind(undefined, remapings);

async function getDescription() {
  const doc = await fetchHTML(document.location.href);

  const synopsis = doc.querySelector(`.synopsis-body`);
  if (synopsis == undefined) return {};

  return { "Description": getFormattedText(synopsis) };
}

function getMetadata() {
  let details = {};

  // author
  let author = document.querySelector(`#book-author, #main-feature h2`)?.textContent;
  if (author) {
    const name = normalizeAuthorName(cleanText(author));
    details["Contributors"] = addContributor([], name, "Author");
  }

  // details
  let metadata = document.querySelector(`dl.listing-metadata`);
  if (metadata == undefined) metadata = { children: [] };
  // should alternate dt and dd
  for (let i = 0; i < metadata.children.length; i += 2) {
    const titleElm = metadata.children[i];
    const descriptionElm = metadata.children[i + 1];
    if (titleElm == undefined || descriptionElm == undefined) break;

    let title = cleanText(titleElm.textContent);
    let value = cleanText(descriptionElm.textContent);

    if (title.toLowerCase() == "editor") {
      title = "Contributors";
      value = addContributor(details["Contributors"] ?? [], value, "Editor");
    }

    if (title in details) {
      title = title + "-2";
    }

    details[title] = value;
  }

  details = nameRemap(details);
  details["Reading Format"] = normalizeReadingFormat(details["Edition Format"]);

  if ("Publication date" in details && details["Publication date"].match(/^\d+$/)) {
    details["Publication date"] = new Date(details["Publication date"], 0);
  }


  // title
  if (details["Title"] == undefined) {
    const titleBreadcumb = [...document.querySelectorAll(`#pageHeader #breadcrumb-trail li`)]
      .filter(x => x.querySelector(`meta[content="Title"]`) != undefined)[0];
    if (titleBreadcumb) {
      details["Title"] = cleanText(titleBreadcumb.textContent);
    }
  }

  // related ids
  new Set([...document.querySelectorAll(".rating a")]
    .map((x) => x.href)
    .filter(x => x != undefined)
  )
    .forEach(ratingUrl => {
      const match = ratingUrl.match(/https:\/\/www\.goodreads\..*\/(\d+)/);
      if (match) {
        details["Mappings"] = addMapping(details["Mappings"] ?? {}, "Goodreads", match[1]);
      }
    });

  return details;
}

async function getCover() {
  return getCoverData([
    document.querySelector(`#feature-image img`)?.src,
    document.querySelector(`img#isbn-image`)?.src,
    document.querySelector(`img#img001`)?.src,
    document.querySelector(`#viewLarger a`)?.href,
  ]);
}

function getSeries() {
  const series = document.querySelector(`a[data-test-id="book-series"], a[data-test-id="book-series-header"]`);
  if (series == undefined) return {};
  const name = cleanText(series.textContent ?? "");
  const match = name.match(seriesRE);
  if (match == undefined) return {};

  return { "Series": match.groups.series, "Series Place": match.groups.position };
}

function normalizeAuthorName(name) {
  const commaIdx = name.indexOf(",");
  if (commaIdx == -1) return name;
  return `${name.slice(commaIdx + 1,)} ${name.slice(0, commaIdx)}`;
}

export { abeBooksScraper };
