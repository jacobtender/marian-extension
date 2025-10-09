import { logMarian, delay, getCoverData } from '../shared/utils.js';

async function getStoryGraphDetails() {
    logMarian('Extracting The StoryGraph details');
    const bookDetails = {};

    // Book cover image
    const imgEl = document.querySelector('.book-cover img');
    const metaCover = document.querySelector('head meta[property="og:image"]');
    const coverData = getCoverData([imgEl?.src, metaCover?.content]);

    // Source ID
    const sourceId = getStoryGraphBookIdFromUrl(window.location.href);
    if (sourceId) bookDetails["Source ID"] = sourceId;

    // Book title
    const h3 = document.querySelector('.book-title-author-and-series h3');
    const rawTitle = h3?.childNodes[0]?.textContent.trim();
    bookDetails["Title"] = rawTitle || null;

    // Series and series place
    const seriesEl = document.querySelectorAll('.book-title-author-and-series h3 a');
    if (seriesEl.length >= 2) {
        const seriesTitle = seriesEl[0]?.textContent.trim();
        const seriesPlaceMatch = seriesEl[1]?.textContent.match(/#(\d+)/);

        if (seriesTitle) bookDetails["Series"] = seriesTitle;
        if (seriesPlaceMatch) bookDetails["Series Place"] = seriesPlaceMatch[1];
    }

    // Author
    extractContributors(bookDetails);
    extractEditionInfo(bookDetails);
    await extractEditionDescription(bookDetails);

    // logMarian("bookDetails", bookDetails);

    return {
        ...(await coverData),
        ...bookDetails
    };
}

function extractContributors(bookDetails) {
    const contributors = [];

    const h3 = document.querySelector('.book-title-author-and-series h3');
    if (!h3) return;

    const contributorParagraph = h3.querySelector('p:nth-of-type(2)');
    if (contributorParagraph) {
        contributorParagraph.querySelectorAll('a').forEach(a => {
            const name = a.textContent.trim();
            if (!name) return;

            // Check the next sibling for role (e.g. (Narrator))
            const nextText = a.nextSibling?.textContent?.trim();
            const roleMatch = nextText?.match(/\(([^)]+)\)/);
            const role = roleMatch ? roleMatch[1] : "Author";

            // See if this contributor already exists
            let contributor = contributors.find(c => c.name === name);
            if (contributor) {
                // Add role if not already present
                if (!contributor.roles.includes(role)) {
                    contributor.roles.push(role);
                }
            } else {
                contributors.push({ name, roles: [role] });
            }
        });
    }

    if (contributors.length) {
        bookDetails["Contributors"] = contributors;
    }
}

function extractEditionInfo(bookDetails) {
    // Show the edition info section
    const editionInfo = document.querySelector('.edition-info');
    if (editionInfo) {
        editionInfo.style.display = 'block';
    }

    const editionEl = document.querySelector('.edition-info');
    if (!editionEl) return;

    editionEl.querySelectorAll('p').forEach(p => {
    const label = p.querySelector('span.font-semibold')?.innerText.trim().replace(':', '');
    const value = p.childNodes[1]?.textContent.trim();

    if (!label || !value) return;

    switch (label) {
        case 'ISBN/UID':
            bookDetails['ISBN-13'] = value;
            break;
        case 'Format':
            if (value.toLowerCase() === 'audio') {
                bookDetails['Reading Format'] = 'Audiobook';
            } else if (value.toLowerCase() === 'digital') {
                bookDetails['Reading Format'] = 'Ebook';
            } else {
                bookDetails['Reading Format'] = 'Physical Book';
                bookDetails['Edition Format'] = value;
            }
            break;
        case 'Language':
            bookDetails['Language'] = value;
            break;
        case 'Publisher':
            bookDetails['Publisher'] = value;
            break;
        case 'Edition Pub Date':
            bookDetails['Publication date'] = value;
            break;
    }
    });

    const durationEl = document.querySelector('p.text-sm.font-light');
    if (document.querySelector('p.text-sm.font-light')) {
        const value = durationEl.innerText.trim();
        const timeMatch = value.match(/(\d+)\s*hours?\s*(?:,|and)?\s*(\d+)?\s*minutes?/i);
        const pagesMatch = value.match(/(\d+)\s*pages?/i);

        if (timeMatch) {
            const arr = [];
            if (timeMatch[1]) arr.push(`${timeMatch[1]} hours`);
            if (timeMatch[2]) arr.push(`${timeMatch[2]} minutes`);
            bookDetails['Listening Length'] = arr;
        }
        if (pagesMatch) {
            bookDetails['Pages'] = parseInt(pagesMatch[1], 10);
        }
    }
}

async function extractEditionDescription(bookDetails) {
    const readMoreBtn = document.querySelector('.read-more-btn');
    if (readMoreBtn) {
        readMoreBtn.click();
        await delay(500); // wait for full description to load
    }

    const descriptionEl = document.querySelector('.blurb-pane .trix-content');
    bookDetails["Description"] = descriptionEl ? descriptionEl.innerText.trim() : null;
}

/**
 * Extracts the StoryGraph book ID from a StoryGraph book URL.
 */
function getStoryGraphBookIdFromUrl(url) {
  const regex = /thestorygraph\.com\/books\/([^/?]+)/i;
  const match = url.match(regex);
  return match ? match[1] : null;
}

export { getStoryGraphDetails };
