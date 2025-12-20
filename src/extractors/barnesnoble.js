import { Extractor } from "./AbstractExtractor.js"
import { logMarian, getFormattedText, getCoverData, addContributor, normalizeReadingFormat, collectObject } from '../shared/utils.js';


const REGEX_SERIES_PLACE = /#(\d+)/;
const REGEX_BRACKET_CONTENT = /\([^()]*\)/;

class barnesAndNobleScraper extends Extractor {
  get _name() { return "Barnes & Noble Extractor"; }
  needsReload = false;
  _sitePatterns = [
    /https:\/\/(?:www\.)?barnesandnoble\.com\/.+\/(\d+)/
  ];

  async getDetails() {
    logMarian('Extracting Barnes & Noble details');
    const bookDetails = getProductDetails();

    bookDetails['Edition Format'] = getSelectedFormat();
    bookDetails['Reading Format'] = normalizeReadingFormat(bookDetails["Edition Format"]);
    bookDetails['Title'] = document.querySelector('h1').textContent.trim();
    bookDetails['Contributors'] = getContributors();

    return collectObject([
      getCover(),
      getBookDescription(),
      getAudioBookTimes(),
      bookDetails,
    ]);
  }
}

async function getCover() {
  const imgEl = document.querySelector('#pdpMainImage');
  return getCoverData(imgEl.src);
}

function getContributors() {
  const rawContributors = document.querySelector('#key-contributors');
  // No need to press "View More" if there's lots of narrators, as the names are still in the HTML
  const rawNarrators = document.querySelector('#key-contributors p');
  const contributors = [];

  for (let i = 0; i < rawContributors?.children.length; i++) {
    if (rawContributors.children[i].nodeName == 'A') {
      const contributorName = rawContributors.children[i].text
        .replace(REGEX_BRACKET_CONTENT, '')
        .trim();

      const rawContributorRole = REGEX_BRACKET_CONTENT.exec(
        rawContributors.children[i].text
      );

      let contributorRole;

      if (rawContributorRole) {
        contributorRole = rawContributorRole[0]
          .replace('(', '')
          .replace(')', '');
      }

      switch (contributorRole) {
        case 'Read by':
          contributorRole = 'Narrator'
          break;
        case 'Artist':
          contributorRole = 'Illustrator'
          break;
        case undefined:
          contributorRole = 'Author'
          break;
      }
      addContributor(contributors, contributorName, contributorRole);
    }
  }

  if (rawNarrators) {
    for (let i = 0; i < rawNarrators?.children.length; i++) {
      if (rawNarrators.children[i].nodeName == 'A') {
        addContributor(contributors, rawNarrators.children[i].text, 'Narrator');
      }
    }
  }

  return contributors;
}

function getProductDetails() {
  const details = {};

  const detailsTable = document.querySelector('#ProductDetailsTab table tbody');
  if (detailsTable) {
    for (let i = 0; i < detailsTable.rows.length; i++) {
      switch (detailsTable.rows[i].children[0].innerText) {
        case 'ISBN-13:':
          details['ISBN-13'] = detailsTable.rows[i].children[1].innerText;
          break;
        case 'ISBN-10:':
          details['ISBN-10'] = detailsTable.rows[i].children[1].innerText;
          break;
        case 'Publisher:':
          details['Publisher'] = detailsTable.rows[i].children[1].innerText;
          break;
        case 'Publication date:':
          details['Publication date'] =
            detailsTable.rows[i].children[1].innerText;
          break;
        case 'Series:':
          const seriesPlace = REGEX_SERIES_PLACE.exec(
            detailsTable.rows[i].children[1].innerText
          );

          if (seriesPlace) {
            details['Series Place'] = seriesPlace[1] || null;
          }

          const series = detailsTable.rows[i].children[1].children[0].text;

          details['Series'] = series;

          break;
        case 'Pages:':
          details['Pages'] = detailsTable.rows[i].children[1].innerText;
          break;
        case 'Edition description:':
          details['Edition Information'] =
            detailsTable.rows[i].children[1].innerText;
          break;
        case 'Language:':
          details['Language'] = detailsTable.rows[i].children[1].innerText;
          break;
      }
    }
  }

  return details;
}

async function getBookDescription() {
  const description = {};

  const descriptionElement = document.querySelector("[itemprop='description']");
  description['Description'] = getFormattedText(descriptionElement);

  return description;
}

function getSelectedFormat() {
  const edition = document.querySelector(
    '.otherAvailFormats .selected-format-chiclet p span'
  )?.innerText;

  return edition;
}

function getAudioBookTimes() {
  // Same class name for abridged / adapted and unabridged audiobooks
  const rawAudiobookTime =
    document.querySelector('.unabridged-time')?.textContent;
  const audiobook = {};

  if (rawAudiobookTime) {
    let [abridgedness, time] = rawAudiobookTime.split('—').map(a => a.trim());
    time = time.split(',');

    audiobook['Edition Information'] = abridgedness;
    audiobook['Listening Length'] = time;
  }

  return audiobook;
}

export { barnesAndNobleScraper };
