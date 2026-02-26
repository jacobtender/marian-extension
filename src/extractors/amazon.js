import { addContributor, cleanText, collectObject, fetchBackground, getCoverData, getFormattedText, logMarian, normalizeReadingFormat } from '../shared/utils.js';
import { Extractor } from "./AbstractExtractor.js"
import { getRegion, fetchAudnexusApiDetails, fetchAudibleApiDetails } from './audible.js';

const bookSeriesRegex = /^Book (\d+) of \d+$/i;

const includedLabels = new Set([
  'Contributors',
  'Publisher',
  'Publication date',
  'Program Type',
  'Language',
  'Print length',
  'Listening Length',
  'ISBN-10',
  'ISBN-13',
  'ASIN',
  'Series',
  'Series Place'
]);

class amazonScraper extends Extractor {
  get _name() { return "Amazon Extractor"; }
  needsReload = false;
  _sitePatterns = [
    /https:\/\/www\.amazon\..*?\/(?:dp|gp\/product)\/.*?(B[\dA-Z]{9}|\d{9}(?:X|\d))/,
    /https:\/\/www\.amazon\.[a-z.]+\/(?:gp\/product|dp|[^/]+\/dp)\/[A-Z0-9]{10}/,
    /https:\/\/www\.amazon\.[a-z.]+\/[^/]+\/dp\/[A-Z0-9]{10}/,
    /https:\/\/www\.amazon\.[a-z.]+\/-\/[a-z]+\/[^/]+\/dp\/[A-Z0-9]{10}/, // for paths with language segments
  ];

  async getDetails() {
    const coverData = getCover();
    const bookDetails = getDetailBullets();
    const audibleDetails = getAudibleDetails();
    const contributors = extractAmazonContributors();

    bookDetails["Edition Format"] = getSelectedFormat() || '';
    bookDetails["Title"] = cleanText(document.querySelector('#productTitle')?.innerText);
    bookDetails["Description"] = getBookDescription() || '';
    bookDetails["Contributors"] = contributors;

    // TODO: get the goodreads id for the novel

    bookDetails['Reading Format'] = normalizeReadingFormat(bookDetails["Edition Format"]);
    if (bookDetails['Reading Format'] === 'Ebook') {
      // Normalize `Kindle Edition` to to `Kindle` like it is on amazon.com 
      bookDetails["Edition Format"] = "Kindle";
    }

    // combined publisher date
    const pubDate = bookDetails["Publisher"]?.match(/^(?<pub>[^(;]+?)(?:; (?<edition>[\w ]+))? \((?<date>\d{1,2} \w+ \d{4})\)$/);
    if (pubDate != null) {
      bookDetails["Publisher"] = cleanText(pubDate.groups["pub"]);
      bookDetails["Publication date"] = pubDate.groups["date"];
      if (pubDate.groups["edition"]) {
        bookDetails["Edition Information"] = cleanText(pubDate.groups["edition"]);
      }
    }

    // Fill in Edition Info from Version or Edition
    const version = bookDetails['Version'] || audibleDetails['Version'];
    const edition = bookDetails["Edition"];
    if (!!version && !!edition) { // if both edition and version are present mix them
      bookDetails["Edition Information"] = `${edition}; ${version}`;
    } else { // otherwise pick one or leave it undefined if neither exist
      bookDetails["Edition Information"] = edition || version;
    }

    // If the isbn10 is the isbn13 and is in the ASIN
    const isbn10 = bookDetails["ISBN-10"]?.replace("-", "");
    const isbn13 = bookDetails["ISBN-13"]?.replace("-", "");
    const asin = bookDetails["ASIN"] ?? audibleDetails["ASIN"];
    if (
      isbn10 != null &&
      isbn13 != null &&
      asin != null &&
      asin.length === 10 &&
      isbn10.length === 13 &&
      isbn10 === isbn13 &&
      !/[a-z]/i.test(asin)
    ) {
      bookDetails["ISBN-10"] = asin;
    }

    const audibleAsin = getAudibleAsin();
    let apiPromise = {};
    if (audibleAsin && audibleAsin !== asin) {
      delete bookDetails["ASIN"];
      bookDetails["Amazon ASIN"] = asin;
      audibleDetails["ASIN"] = audibleAsin;
      apiPromise = fetchApiDetails(audibleAsin, audibleDetails);
    }

    const mergedDetails = await collectObject([
      bookDetails,
      audibleDetails,
      apiPromise, // overwriting contributor scraped data from amazon
      coverData,
    ]);

    delete mergedDetails.Edition;
    delete mergedDetails.Version;
    delete mergedDetails._detectedRegion;

    // logMarian("details", mergedDetails);

    return mergedDetails;
  }
}

async function fetchApiDetails(asin, audibleDetails) {
  if (!asin || audibleDetails['Reading Format'] !== 'Audiobook') {
    return {};
  }

  let tld = audibleDetails['_detectedRegion'] || document.location.host.split("amazon").pop();
  const region = getRegion(tld);

  return await collectObject([
    fetchAudibleApiDetails(asin, tld),
    fetchAudnexusApiDetails(asin, region),
  ])
}

async function getCover() {
  const imgEl = document.querySelector("#landingImage, #imgTagWrapperId img"); // same element
  const imgEl2 = document.querySelector("#imgBlkFront");
  const imgEl3 = document.querySelector("#ebooksImgBlkFront");
  const imgAudible = document.querySelector('#audibleProductImage img');

  const covers = new Set();

  [imgEl, imgEl2, imgEl3, imgAudible].forEach(img => {
    if (!img) return;
    if (img) covers.add(img.src);

    const dataset = img.dataset;
    if (dataset) {
      if (dataset.oldHires) covers.add(dataset.oldHires);
      // add highest res dynamic
      try {
        const dynamicImage = JSON.parse(dataset.aDynamicImage);
        const largest = Object.entries(dynamicImage).reduce((acc, [url, [height, width]]) => {
          const currentScore = width * height;
          return currentScore > acc.score ? { url, score: currentScore } : acc;
        }, { url: null, score: 0 }).url;
        if (largest) covers.add(largest);
      } catch (err) {
        logMarian('Error parsing dynamic image data:', err);
      }
    }
  });

  // get original image
  [...covers]
    .filter(i => i)
    .forEach((url) => { covers.add(getHighResImageUrl(url)); });

  const coverList = Array.from(covers)
    .filter((x) => !x.includes("01RmK+J4pJL.gif")); // filter out no image image
  // console.log(coverList)

  const coverRes = await getCoverData(coverList);
  if (coverRes.imgScore === 0) return {}
  return coverRes;
}

function getHighResImageUrl(src) {
  return src.replace(/\._[^.]+(?=\.)/, '');
}

function getDetailBullets() {
  const bullets = document.querySelectorAll('#detailBullets_feature_div li');
  const details = {};

  bullets.forEach(li => {
    // Identify the edition labels, skip if not found
    const labelSpan = li.querySelector('span.a-text-bold');
    if (!labelSpan) return;

    // Clean up label text
    let label = cleanText(labelSpan.textContent.replace(':', ''));

    // Fetch and clean the value of the detail
    const valueSpan = labelSpan.nextElementSibling;
    let value = cleanText(valueSpan?.textContent);

    // Handle book series special case
    const match = bookSeriesRegex.exec(label) || bookSeriesRegex.exec(value);
    if (match) {
      details['Series'] = value;
      details['Series Place'] = match[1];
      return;
    }

    if ((label === 'Edition' || label === 'Version') && value) {
      details[label] = value;
      if (label === 'Edition' && !details['Edition Format']) {
        details['Edition Format'] = value;
      }
      return;
    }

    // Print debug info for labels not included
    // skip if not included in the list
    if (!includedLabels.has(label)) {
      // logMarian(`Label not currently included: "${label}"`);
      return;
    }

    // Final check that both label and value are present
    if (!label || !value) return;

    // Rename "Print length" to "Pages" and extract number only
    if (label === 'Print length') {
      label = 'Pages';
      const pageMatch = value.match(/\d+/);
      value = pageMatch ? pageMatch[0] : value;
    }

    details[label] = value;
  });


  // Double check book series
  const series = document.querySelector("div[data-feature-name='seriesBulletWidget'] a")
  if (!details["Series"] && series != undefined) {
    const match = cleanText(series.textContent).match(/Book (\d+) of \d+: (.+)/i);
    if (match) {
      details['Series'] = match[2];
      details['Series Place'] = match[1];
    }
  }

  return details;
}

function getAudibleDetails() {
  const table = document.querySelector('#audibleProductDetails table');
  if (!table) return {};

  const details = {};
  const rows = table.querySelectorAll('tr');

  rows.forEach(row => {
    const label = cleanText(row.querySelector('th span')?.textContent);
    const value = cleanText(row.querySelector('td')?.innerText);
    const match = bookSeriesRegex.exec(label) || bookSeriesRegex.exec(value);

    // Handle book series special case
    if (match) {
      details['Series'] = value;
      details['Series Place'] = match[1];
      return;
    }

    if ((label === 'Edition' || label === 'Version') && value) {
      details[label] = value;
      if (label === 'Edition' && !details['Edition Format']) {
        details['Edition Format'] = value;
      }
      return;
    }

    // Match any Audible.<TLD> Release Date
    const regionMatch = label?.match(/^Audible\.([a-z.]+) Release Date$/i);
    if (regionMatch) {
      details['Publication date'] = value;
      details['_detectedRegion'] = regionMatch[1].toLowerCase();
    } else if (label === 'Program Type') {
      details['Reading Format'] = value;
      details['Edition Format'] = "Audible";
    } else if (label === 'Listening Length') {
      const timeMatch = value.match(/(\d+)\s*hours?\s*(?:and)?\s*(\d+)?\s*minutes?/i);
      if (timeMatch) {
        const arr = [];
        if (timeMatch[1]) arr.push(`${timeMatch[1]} hours`);
        if (timeMatch[2]) arr.push(`${timeMatch[2]} minutes`);
        details['Listening Length'] = arr;
      } else {
        details['Listening Length'] = value;
      }
    } else if (label && value && includedLabels.has(label)) {
      details[label] = value;
    }
  });

  return details;
}

function getBookDescription() {
  const container = document.querySelector('#bookDescription_feature_div .a-expander-content');
  if (!container) return '';

  return getFormattedText(container);
}

function getAudibleAsin() {
  // 1. Check hidden input
  const hiddenInput = document.querySelector('input[name="audibleASIN"]');
  if (hiddenInput?.value) return hiddenInput.value;
  // 2. Check Sample Player JSON
  const samplePlayer = document.querySelector('[data-play-audiosample-cloud-player]');
  if (samplePlayer) {
    try {
      const config = JSON.parse(samplePlayer.dataset.playAudiosampleCloudPlayer);
      const urlParams = new URLSearchParams(config.cloudPlayerUrl.split('?')[1]);
      const asin = urlParams.get('asin');
      if (asin) return asin;
    } catch { }
  }
  // 3. Check Swatches
  const audioSwatch = Array.from(document.querySelectorAll('#tmmSwatches .swatchElement'))
    .find(el => el.textContent.toLowerCase().includes('audiobook') || el.textContent.toLowerCase().includes('audible'));

  return audioSwatch?.dataset.asin || audioSwatch?.dataset.defaultasin || null;
}

function getSelectedFormat() {
  const selected = document.querySelector('#tmmSwatches .swatchElement.selected .slot-title span[aria-label]');
  if (selected) {
    return cleanText(selected.getAttribute('aria-label')?.replace(' Format:', ''));
  }
  return null;
}

function extractAmazonContributors() {
  const contributors = [];

  const authorSpans = document.querySelectorAll('#bylineInfo .author');
  authorSpans.forEach(span => {
    const name = cleanText(span.querySelector('a')?.innerText);
    const roleText = cleanText(span.querySelector('.contribution span')?.innerText);
    let roles = [];

    if (roleText) {
      // e.g., "(Author)", "(Illustrator)", "(Author, Narrator)"
      const roleMatch = roleText.match(/\(([^)]+)\)/);
      if (roleMatch) {
        // Split by comma and trim each role
        roles = roleMatch[1].split(',').map(cleanText);
      }
    } else {
      roles.push("Contributor"); // fallback if role is missing
    }

    // Ignore if any role is Publisher
    if (roles.includes("Publisher")) return;

    if (name) addContributor(contributors, name, roles);
  });

  return contributors;
}

export { amazonScraper };
