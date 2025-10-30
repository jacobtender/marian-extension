import { logMarian, delay, getCoverData } from '../shared/utils.js';

async function getGoodreadsDetails() {
    logMarian('Extracting GoodReads details');
    const bookDetails = {};

    const sourceId = getGoodreadsBookIdFromUrl(window.location.href);
    if (sourceId) bookDetails["Source ID"] = sourceId;

    const imgEl = document.querySelector('.BookCover__image img');
    const coverData = getCoverData(imgEl?.src);
    bookDetails["Title"] = document.querySelector('[data-testid="bookTitle"]')?.innerText.trim();

    const contributorsButton = document.querySelector('.ContributorLinksList button[aria-label="Show all contributors"]');
    if (contributorsButton) {
        contributorsButton.click();
        await delay(1500); // wait for contributors to load
    }

    const detailsButton = document.querySelector('.BookDetails button[aria-label="Book details and editions"]');
    if (detailsButton) {
        detailsButton.click();
        await delay(1500); // wait for contributors to load
    }

  getContributors(bookDetails);
  extractEditionDetails(bookDetails);
  extractSeriesInfo(bookDetails);

    // Extract edition format and pages
    const editionFormatEl = document.querySelector('[data-testid="pagesFormat"]')?.innerText.trim();
    if (editionFormatEl) {
        const pagesMatch = editionFormatEl.match(/^(\d+)\s+pages,\s*(.+)$/);
        if (pagesMatch) {
            bookDetails["Pages"] = parseInt(pagesMatch[1], 10);
            bookDetails["Edition Format"] = pagesMatch[2];
        } else {
            bookDetails["Edition Format"] = editionFormatEl;
        }
    }
    const descriptionEl = document.querySelector('[data-testid="contentContainer"] .Formatted');
    bookDetails["Description"] = descriptionEl ? descriptionEl.innerText.trim() : null;

    if (bookDetails["Edition Format"]?.includes("Kindle")) {
        bookDetails['Reading Format'] = 'Ebook'; 
    } else if (bookDetails["Edition Format"].includes("Audible") || bookDetails["Edition Format"].includes("Audiobook")) {
        bookDetails['Reading Format'] = 'Audiobook';
    } else {
        bookDetails['Reading Format'] = 'Physical Book';
    }

    // logMarian("bookDetails", bookDetails);

    return {
    ...(await coverData),
    ...bookDetails,
  };
}

function getHighResImageUrl(src) {
//   return src.replace(/\/compressed\.photo\./, '/');
    return src
}

function getContributors(bookDetails) {
  // Collect contributors as { name, roles: [] }
  const contributors = [];

  document.querySelectorAll('.ContributorLinksList [data-testid="name"]').forEach(nameEl => {
    const roleEl = nameEl.parentElement.querySelector('[data-testid="role"]');
    const name = nameEl.innerText.trim();
    let roles = roleEl?.innerText || "Author";
    // Remove parentheses from roles
    roles = roles.replace(/[()]/g, '');

    // Split roles by comma if multiple roles are present
    const rolesArr = roles.split(',').map(roleRaw => roleRaw.trim() || "Author");

    if (!name) return;

    // Check if this name already exists in contributors
    let contributor = contributors.find(c => c.name === name);
    if (contributor) {
      // Add any new roles not already present
      rolesArr.forEach(role => {
        if (!contributor.roles.includes(role)) {
          contributor.roles.push(role);
        }
      });
    } else {
      contributors.push({ name, roles: rolesArr });
    }
  });

  if (contributors.length) {
    bookDetails["Contributors"] = contributors;
  }
}

function extractEditionDetails(bookDetails) {
  const editionRoot = document.querySelector('.EditionDetails dl');
  if (!editionRoot) return;

  editionRoot.querySelectorAll('.DescListItem').forEach(item => {
    const label = item.querySelector('dt')?.innerText.trim();
    const content = item.querySelector('[data-testid="contentContainer"]')?.innerText.trim();
    // logMarian(`Found label: "${label}", content: "${content}"`);

    if (!label || !content) return;

    if (label === 'Published') {
      const [datePart, publisherPart] = content.split(' by ');
      bookDetails['Publication date'] = datePart?.trim();
      bookDetails['Publisher'] = publisherPart?.trim();
    }

    if (label === 'ISBN') {
        const isbn13Match = content.match(/\b\d{13}\b/);
        const isbn10Match = content.match(/ISBN10:\s*([\dX]{10})/i);

        if (isbn13Match) bookDetails['ISBN-13'] = isbn13Match[0];
        if (isbn10Match) bookDetails['ISBN-10'] = isbn10Match[1];
    }

    if (label === 'ASIN') {
      bookDetails['ASIN'] = content;
    }

    if (label === 'Language') {
      bookDetails['Language'] = content;
    }
  });
}

function extractSeriesInfo(bookDetails) {
  const workDetails = document.querySelector('.WorkDetails');
  if (!workDetails) return;

  workDetails.querySelectorAll('.DescListItem').forEach(item => {
    const label = item.querySelector('dt')?.innerText.trim();
    if (label !== 'Series') return;

    const contentEl = item.querySelector('[data-testid="contentContainer"]');
    if (!contentEl) return;

    const seriesLink = contentEl.querySelector('a');
    const fullText = contentEl.innerText.trim();

    const seriesName = seriesLink?.innerText.trim() || '';
    const seriesPlaceMatch = fullText.match(/\(#(\d+)\)/);

    if (seriesName) {
      bookDetails['Series'] = seriesName;
    }

    if (seriesPlaceMatch) {
      bookDetails['Series Place'] = seriesPlaceMatch[1];
    }
  });
}

/**
 * Extracts the Goodreads book ID from a Goodreads book URL.
 */
function getGoodreadsBookIdFromUrl(url) {
  const regex = /goodreads\.com\/(?:\w+\/)?book\/show\/(\d+)(?:[.\-/]|$)/i;
  const match = url.match(regex);
  return match ? match[1] : null;
}



export { getGoodreadsDetails };
