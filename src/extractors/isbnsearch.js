import { Extractor } from './AbstractExtractor.js';
import { addContributor, getCoverData, logMarian, remapKeys, cleanText, normalizeReadingFormat, collectObject } from '../shared/utils.js';

class isbnSearchScraper extends Extractor {
  get _name() { return "ISBN Search Extractor"; }
  _sitePatterns = [
    /^https?:\/\/isbnsearch\.(?:org|com)\/isbn\/((?:\d{3})?\d{9}(?:X|\d))\b/,
  ];

  async getDetails() {
    const imgEl = document.querySelector('.image img');
    const coverData = getCoverData(imgEl?.src);

    const details = extractTable()
    const bookDetails = nameRemap(details);

    getContributers(bookDetails);

    // Treat as local time when parsing
    bookDetails['Publication date'] = bookDetails['Publication date'] + "T00:00:00";

    bookDetails['Reading Format'] = normalizeReadingFormat(bookDetails["Edition Format"]);

    // logMarian("bookDetails", bookDetails);

    return collectObject([
      coverData,
      bookDetails,
    ]);
  }
}

const remapings = {
  'Edition': 'Edition Information',
  'Binding': 'Edition Format',
  'Published': 'Publication date'
}
const nameRemap = remapKeys.bind(undefined, remapings);

function getContributers(bookDetails) {
  const contributors = [];

  if ('Author' in bookDetails) {
    addContributor(contributors, bookDetails['Author'], "Author");
    delete bookDetails['Author']
  }
  if ("Authors" in bookDetails) {
    bookDetails['Authors']
      .split(';')
      .forEach(author => addContributor(contributors, author.trim(), "Author"));
    delete bookDetails['Authors']
  }

  if (contributors.length) {
    bookDetails['Contributors'] = contributors;
  }
}

function extractTable() {
  const container = document.querySelector('.bookinfo');
  const Title = cleanText(container.querySelector('h1').textContent);

  const table = {};
  container.querySelectorAll('p').forEach((el) => {
    let children = el.childNodes;
    if (children.length === 3 && children[1].textContent === ' ') {
      children = [children[0], children[2]];
    } else if (el.textContent.includes("Sell this book")) {
      return;
    }

    if (children.length !== 2 || children[0].nodeName !== 'STRONG') {
      logMarian('invalid row', el.textContent);
      return;
    }

    let key = cleanText(children[0].textContent);
    const value = cleanText(children[1].textContent);


    if (!key) {
      logMarian("empty key", el.textContent);
      return;
    } else if (!key.endsWith(':')) {
      logMarian("bad key", key);
      return;
    }

    key = key.substring(0, key.length - 1).trim();
    table[key] = value
  });

  return {
    Title,
    ...table
  }
}

export { isbnSearchScraper };
