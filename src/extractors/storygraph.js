import { Extractor } from './AbstractExtractor.js';
import { delay, getCoverData, addContributor, cleanText, normalizeReadingFormat, collectObject, REGEX_ABBREV_TIME_HOURS_MINUTES } from '../shared/utils.js';

class storygraphScraper extends Extractor {
    get _name() { return "StoryGraph Extractor"; }
    _sitePatterns = [
        /^https:\/\/app\.thestorygraph\.[a-z.]+\/books\/[0-9a-fA-F-]+$/,
    ];

    async getDetails() {
        const bookDetails = gatherBookDetails();

        // Book cover image
        const imgEl = document.querySelector('.book-cover img');
        const metaCover = document.querySelector('head meta[property="og:image"]');
        const coverData = getCoverData([imgEl?.src, metaCover?.content]);

        return collectObject([
            coverData,
            bookDetails
        ]);
    }
}

async function gatherBookDetails() {
    const bookDetails = {};

    // Source ID
    const sourceId = getStoryGraphBookIdFromUrl(window.location.href);
    if (sourceId) bookDetails["Mappings"] = { "Storygraph": [sourceId] };

    // Book title
    const h3 = document.querySelector('.book-title-author-and-series h3');
    const rawTitle = cleanText(h3?.childNodes[0]?.textContent);
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

    return bookDetails;
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

            addContributor(contributors, name, role);
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
                bookDetails['Reading Format'] = normalizeReadingFormat(value);
                if (bookDetails['Reading Format'] === 'Physical Book') {
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
        const timeMatch = value.match(REGEX_ABBREV_TIME_HOURS_MINUTES);
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
    bookDetails["Description"] = descriptionEl ? cleanText(descriptionEl.innerText) : null;
}

/**
 * Extracts the StoryGraph book ID from a StoryGraph book URL.
 */
function getStoryGraphBookIdFromUrl(url) {
    const regex = /thestorygraph\.com\/books\/([^/?]+)/i;
    const match = url.match(regex);
    return match ? match[1] : null;
}

export { storygraphScraper };
