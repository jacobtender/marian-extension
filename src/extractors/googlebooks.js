// googlebooks.js

import { addContributor, cleanText, clearDeepQueryCache, collectObject, getCoverData, getFormattedText, logMarian, normalizeReadingFormat, queryAllDeep, queryDeep } from '../shared/utils.js';
import { Extractor } from './AbstractExtractor.js';

const KNOWN_HOSTS = ['g-expandable-content'];

class googleBooksScraper extends Extractor {
    get _name() { return "Google Books Extractor"; }
    needsReload = false;
    _sitePatterns = [
        /^https?:\/\/(www\.)?google\.[a-z.]+\/books/,
        /^https?:\/\/books.google\.[a-z.]+\/books(?:\/[^?]*)?/,
    ];

    async getDetails() {
        // Store the source ID
        const sourceId = getGoogleBooksIdFromUrl(window.location.href);
        const googlebooksClassic = window.location.href.includes("books.google");

        const mappings = sourceId ? { "Mappings": { "Google Books": [sourceId] } } : null;

        // Extract cover image using volume ID
        const coverData = getCoverData(getGoogleBooksCoverUrl(sourceId));

        let bookDetails = {};
        if (sourceId) {
            bookDetails = await fetchGoogleBooksApiDetails(sourceId);
        }

        if (Object.keys(bookDetails).length === 0) {
            logMarian("Google Books API fallback: extracting from DOM.");
            bookDetails = googlebooksClassic ?
                getClassicGoogleBooksDetails() :
                getGoogleBooksDetails();
        }

        return collectObject([
            coverData,
            bookDetails,
            mappings,
        ]);
    }
}

async function fetchGoogleBooksApiDetails(volumeId) {
    try {
        const response = await fetch(`https://www.googleapis.com/books/v1/volumes/${volumeId}`);
        if (!response.ok) {
            logMarian(`API responded with status ${response.status}`);
            return {};
        }
        const data = await response.json();
        return parseGoogleBooksApiData(data);
    } catch (error) {
        logMarian("Error fetching from Google Books API:", error);
        return {};
    }
}

function parseGoogleBooksApiData(data) {
    const bookDetails = {};
    const volumeInfo = data.volumeInfo || {};
    const saleInfo = data.saleInfo || {};

    // Title & Subtitle
    let title = volumeInfo.title || "";
    if (title && volumeInfo.subtitle) {
        title = `${title}: ${volumeInfo.subtitle}`;
    }
    if (title) bookDetails["Title"] = cleanText(title);

    // Description
    if (volumeInfo.description) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = volumeInfo.description;
        bookDetails["Description"] = getFormattedText(tempDiv);
    }

    // Identifiers (ISBNs)
    if (volumeInfo.industryIdentifiers) {
        for (const idObj of volumeInfo.industryIdentifiers) {
            if (idObj.type === "ISBN_10") {
                bookDetails["ISBN-10"] = idObj.identifier;
            } else if (idObj.type === "ISBN_13") {
                bookDetails["ISBN-13"] = idObj.identifier;
            }
        }
    }

    // Publication Date
    if (volumeInfo.publishedDate) {
        bookDetails["Publication date"] = volumeInfo.publishedDate;
    }

    // Publisher
    if (volumeInfo.publisher) {
        bookDetails["Publisher"] = cleanText(volumeInfo.publisher);
    }

    // Language
    if (volumeInfo.language) {
        bookDetails["Language"] = volumeInfo.language;
    }

    // Pages
    if (volumeInfo.pageCount) {
        bookDetails["Pages"] = volumeInfo.pageCount;
    }

    // Format
    if (saleInfo.isEbook) {
        bookDetails["Reading Format"] = "Ebook";
        bookDetails["Edition Format"] = "Digital";
    } else if (volumeInfo.printType === "BOOK") {
        bookDetails["Reading Format"] = "Physical Book";
        bookDetails["Edition Format"] = "Print";
    } else if (volumeInfo.printType === "MAGAZINE") {
        bookDetails["Reading Format"] = "Physical Book";
        bookDetails["Edition Format"] = "Magazine";
    }

    // Contributors
    const contributors = [];
    if (volumeInfo.authors) {
        for (const author of volumeInfo.authors) {
            addContributor(contributors, cleanText(author), "Author");
        }
    }
    if (contributors.length > 0) {
        bookDetails["Contributors"] = contributors;
    }

    // Extra API Fields
    if (volumeInfo.categories && volumeInfo.categories.length > 0) {
        bookDetails["Categories"] = volumeInfo.categories;
    }
    if (volumeInfo.mainCategory) {
        bookDetails["Main Category"] = volumeInfo.mainCategory;
    }
    if (volumeInfo.averageRating) {
        bookDetails["Average Rating"] = volumeInfo.averageRating;
    }
    if (volumeInfo.ratingsCount) {
        bookDetails["Ratings Count"] = volumeInfo.ratingsCount;
    }
    if (volumeInfo.maturityRating && volumeInfo.maturityRating !== "NOT_MATURE") {
        bookDetails["Maturity Rating"] = volumeInfo.maturityRating;
    }

    logMarian("Google Books API extraction complete:", bookDetails);
    return bookDetails;
}

function getGoogleBooksDetails() {
    const bookDetails = {};
    clearDeepQueryCache();

    // Extract title
    bookDetails["Title"] = getGoogleBookTitle();

    // Extract ISBNs
    const { isbn10, isbn13 } = extractIsbns();
    if (isbn10) bookDetails['ISBN-10'] = isbn10;
    if (isbn13) bookDetails['ISBN-13'] = isbn13;

    // Extract publication date
    const releaseDate = getGoogleBookReleaseDate();
    if (releaseDate) bookDetails['Publication date'] = releaseDate;

    // Extract publisher
    const publisher = getGoogleBookPublisher();
    if (publisher) bookDetails['Publisher'] = publisher;

    // Extract language
    const language = getGoogleBookLanguage();
    if (language) bookDetails['Language'] = language;

    // Extract page count
    const pageCount = getGoogleBookPageCount();
    if (pageCount) bookDetails['Pages'] = pageCount;

    // Extract description
    const description = getGoogleBookDescription();
    if (description) bookDetails['Description'] = description;

    // Extract reading format
    const formats = getGoogleBookReadingFormat();
    if (formats) {
        const [readingFormat, editionFormat] = formats;
        bookDetails['Reading Format'] = readingFormat;
        bookDetails['Edition Format'] = editionFormat;
    }

    bookDetails['Contributors'] = getContributors();

    logMarian("Google Books extraction complete:", bookDetails);

    return bookDetails;
}

function getClassicGoogleBooksDetails() {
    const bookDetails = {};

    bookDetails["Description"] = getFormattedText(document.querySelector("#bookinfo #synopsis #synopsistext"));

    const bookInfo = Array.from(document.querySelectorAll("#metadata_content table tr"))
        .reduce((acc, cur) => {
            if (cur.children.length !== 2) logMarian(`WARN: ${cur} might be invalid`);
            const label = cur.children[0].textContent.trim();
            if (label) acc[label] = cur.children[1];
            return acc;
        }, {});
    // logMarian("bookInfo", bookInfo);

    const titleSeries = bookInfo["Title"].querySelector("a");
    if (titleSeries) {
        const match = titleSeries.textContent.match(/^Volume (\d+) of (.+)$/);
        if (match) {
            bookDetails["Series"] = match[2];
            bookDetails["Series Place"] = match[1];
        }
    }
    // bookDetails["Title"] = cleanText(bookInfo["Title"].textContent);
    delete bookInfo["Title"];
    bookDetails["Title"] = cleanText(document.querySelector("#bookinfo .booktitle").textContent);

    if ("Edition" in bookInfo) {
        bookDetails["Edition Information"] = cleanText(bookInfo["Edition"].textContent);
        delete bookInfo["Edition"];
    }

    if ("Length" in bookInfo && bookInfo["Length"].textContent.includes("pages")) {
        bookDetails["Pages"] = cleanText(bookInfo["Length"].textContent.split("pages")[0])
        delete bookInfo["Length"];
    }

    if ("ISBN" in bookInfo) {
        bookInfo["ISBN"].textContent.split(",").forEach(isbn_dirty => {
            const isbn = cleanText(isbn_dirty);
            if (isbn.length === 10) bookDetails["ISBN-10"] = isbn;
            if (isbn.length === 13) bookDetails["ISBN-13"] = isbn;
        });
        delete bookInfo["ISBN"];
    }

    // assuming that its always in the format of "Publisher name, publication year"
    const pubSplit = bookInfo["Publisher"]?.textContent?.split(",");
    if (pubSplit) {
        bookDetails["Publisher"] = cleanText(pubSplit.slice(0, pubSplit.length - 1).join(","));
        delete bookInfo["Publisher"];
    }

    const headerInfo = document.querySelectorAll("#bookinfo .bookinfo_sectionwrap div");
    const pubYearElement = Array.from(document.querySelectorAll("#bookinfo .bookinfo_sectionwrap div"))
        .filter(el => el.textContent.includes(bookDetails["Publisher"]))[0]
    if (pubYearElement) {
        bookDetails["Publication date"] = new Date(pubYearElement.children[1].textContent);
    }

    const contributors = [];
    if ("Author" in bookInfo) {
        addContributor(contributors, cleanText(bookInfo["Author"].textContent), "Author");
        delete bookInfo["Author"];
    }
    if ("Authors" in bookInfo) {
        Array.from(bookInfo["Authors"].children).map(author =>
            addContributor(contributors, cleanText(author.textContent), "Author")
        );
        delete bookInfo["Authors"];
    }
    if ("Illustrated by" in bookInfo) {
        addContributor(contributors, cleanText(bookInfo["Illustrated by"].textContent), "Illustrator");
        delete bookInfo["Author"];
    }
    bookDetails["Contributors"] = contributors;

    // unneeded fields
    delete bookInfo["Export Citation"];
    delete bookInfo["Subjects"];

    return {
        ...bookDetails,
        // dump the rest in case it will be useful
        ...Object.keys(bookInfo).reduce((acc, cur) => { acc[cur] = cleanText(bookInfo[cur].textContent); return acc; }, {}),
    };
}

/**
 * Extracts the book title from the Google Books page.
 * @returns {string} Title text or empty string if not found.
 */
function getGoogleBookTitle() {
    try {
        const titleEl = queryDeep('div.zNLTKd[aria-level="1"][role="heading"], div.qVk57b[aria-level="1"][role="heading"]', KNOWN_HOSTS);
        let title = cleanText(titleEl?.textContent ?? "");
        const subtitleEl = queryDeep('div.cFGBCb div.wwNwqf', KNOWN_HOSTS);
        if (subtitleEl) title = `${title}: ${cleanText(subtitleEl.textContent ?? "")}`
        return title;

    } catch (error) {
        console.error("Error extracting Google Book title:", error);
        return "";
    }
}

/**
 * Extracts ISBN-10 and ISBN-13 from the details panel.
 * @returns {{ isbn10: string|null, isbn13: string|null }}
 */
function extractIsbns() {
    const containers = queryAllDeep("div.zloOqf.PZPZlf", KNOWN_HOSTS);

    for (const container of containers) {
        const label = container.querySelector(".w8qArf");
        if (label?.textContent?.toLowerCase().startsWith("isbn")) {
            const valueEl = container.querySelector(".LrzXr");
            const isbnText = valueEl?.textContent?.trim();
            if (isbnText) {
                const parts = isbnText.split(",").map((s) => s.trim());
                let isbn10 = null;
                let isbn13 = null;

                for (const part of parts) {
                    if (part.length === 13) isbn13 = part;
                    else if (part.length === 10) isbn10 = part;
                }

                return { isbn10, isbn13 };
            }
        }
    }

    return { isbn10: null, isbn13: null };
}

/**
 * Extracts the published date from the page.
 * @returns {string}
 */
function getGoogleBookReleaseDate() {
    try {
        const allDetailBlocks = Array.from(queryAllDeep("div.zloOqf.PZPZlf", KNOWN_HOSTS));

        for (const block of allDetailBlocks) {
            const labelSpan = block.querySelector("span.w8qArf");
            if (labelSpan && labelSpan.textContent.trim().startsWith("Published")) {
                const valueSpan = block.querySelector("span.LrzXr.kno-fv.wHYlTd.z8gr9e");
                if (valueSpan) {
                    return valueSpan.textContent.trim();
                }
            }
        }

        return "";
    } catch (error) {
        console.error("Error extracting published date:", error);
        return "";
    }
}

/**
 * Extracts the publisher name from the details section.
 * @returns {string}
 */
function getGoogleBookPublisher() {
    try {
        const allDetailBlocks = Array.from(queryAllDeep("div.zloOqf.PZPZlf", KNOWN_HOSTS));

        for (const block of allDetailBlocks) {
            const labelSpan = block.querySelector("span.w8qArf");
            if (labelSpan && labelSpan.textContent.trim().startsWith("Publisher")) {
                const valueSpan = block.querySelector("span.LrzXr.kno-fv.wHYlTd.z8gr9e");
                if (valueSpan) {
                    const anchor = valueSpan.querySelector("a.fl");
                    return (anchor?.textContent || valueSpan.textContent).trim();
                }
            }
        }

        return "";
    } catch (error) {
        console.error("Error extracting publisher:", error);
        return "";
    }
}

/**
 * Extracts the release language from the info panel.
 * @returns {string|null}
 */
function getGoogleBookLanguage() {
    try {
        const labelNodes = Array.from(queryAllDeep("div.zloOqf.PZPZlf", KNOWN_HOSTS));

        for (const node of labelNodes) {
            const label = node.querySelector("span.w8qArf")?.textContent?.trim();
            if (label?.startsWith("Language")) {
                const value = node.querySelector("span.LrzXr, span.LrzXr a")?.textContent?.trim();
                return value || null;
            }
        }

        return null;
    } catch (err) {
        console.error("Failed to extract language", err);
        return null;
    }
}

/**
 * Extracts and parses page count as a number.
 * @returns {number|null}
 */
function getGoogleBookPageCount() {
    try {
        const labelNodes = Array.from(queryAllDeep("div.zloOqf.PZPZlf", KNOWN_HOSTS));

        for (const node of labelNodes) {
            const label = node.querySelector("span.w8qArf")?.textContent?.trim();
            if (label?.startsWith("Page count")) {
                const valueText = node.querySelector("span.LrzXr")?.textContent?.trim();
                const pageCount = valueText ? parseInt(valueText.replace(/[^\d]/g, ""), 10) : null;

                if (!isNaN(pageCount)) {
                    return pageCount;
                }
                return null;
            }
        }

        return null;
    } catch (err) {
        console.error("Failed to extract page count", err);
        return null;
    }
}

/**
 * Extracts the full description text.
 * @returns {string}
 */
function getGoogleBookDescription() {
    try {
        // NOTE: this seems very fragile, if the class name changes then this breaks 
        const descriptionContainer = queryDeep(`.T4Ew8c [jsname="AKKCW"] [data-eb="0"]`, KNOWN_HOSTS);
        if (!descriptionContainer) {
            return "";
        }

        // Simple text extraction - you can enhance this if needed
        return descriptionContainer.textContent?.trim() || "";
    } catch (err) {
        console.error("Error while extracting book description", err);
        return "";
    }
}

/**
 * Extracts and normalizes reading format from the details section.
 * @returns {[string, string]?}
 */
function getGoogleBookReadingFormat() {
    try {
        const formatContainer = [...queryAllDeep("div.zloOqf.PZPZlf", KNOWN_HOSTS)]
            .find((div) => div.querySelector("span.w8qArf")?.textContent.includes("Format"));

        if (!formatContainer) {
            return undefined;
        }

        const formatValueEl = formatContainer.querySelector("span.LrzXr.kno-fv.wHYlTd.z8gr9e");
        if (!formatValueEl) {
            return undefined;
        }

        const rawFormat = formatValueEl.textContent.trim();
        const rawLower = rawFormat.toLocaleLowerCase();

        // Set edition format based on reading format
        let edition = "";
        if (rawLower.includes('e-book') || rawLower.includes("ebook")) {
            edition = 'Digital';
        } else if (rawLower.includes('audiobook')) {
            edition = 'Audiobook';
        } else {
            edition = rawFormat || "Print";
            // edition = 'Print';
        }

        return [normalizeReadingFormat(rawFormat), edition];

    } catch (error) {
        console.error("Error extracting reading format:", error);
        return undefined;
    }
}

function getContributors() {
    const contribContainer = queryAllDeep(`div[role="presentation"] .PZPZlf .zh0Yff`, KNOWN_HOSTS);

    const roles = ["Author", "Illustrator", "Translator", "Editor", "Contributor"]
    const roleLowers = roles.map(i => i.toLowerCase());

    const contribParts = contribContainer.map(div => {
        const contentLower = cleanText(div.textContent).toLowerCase();
        const idx = roleLowers.map(i => contentLower.startsWith(i)).indexOf(true);
        if (idx === -1) return null;
        return /** @type {[string, Element]} */ ([roles[idx], div]);
    }).filter(i => i != null);

    // Extract authors and convert to contributors format
    const contributors = [];

    for (const contribRow of contribParts) {
        const [role, div] = contribRow;
        /** @type {string[]} */
        let row;
        if (role === "Author") {
            row = [...div.querySelectorAll("a.fl")].map((i) => cleanText(i.textContent));
        } else {
            row = div.children[1].textContent.split(",")
        }
        row.map(i => addContributor(contributors, i, role));
    }

    return contributors;
}

/**
 * Extracts the Google Books volume ID from a given URL.
 * @param {string} url - The current page URL.
 * @returns {string|null} - The extracted volume ID or null if not found.
 */
function getGoogleBooksIdFromUrl(url) {
    const patterns = [
        /books\/edition\/(?:[^/]+\/)?([A-Za-z0-9_-]{10,})/, // e.g., books/edition/_/PYsFzwEACAAJ
        /books(?:\/[^?]*)?\?id=([A-Za-z0-9_-]{10,})/, // e.g., books?id=PYsFzwEACAAJ or books/about/bookname.html?id=PYsFzwEACAAJ
        /\/volume\/([A-Za-z0-9_-]{10,})/, // e.g., volume/PYsFzwEACAAJ
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }

    return null;
}

/**
 * Constructs a Google Books cover image URL with maximum resolution.
 * @param {string} volumeId - The Google Books volume ID.
 * @returns {string} - The full URL to the highest-resolution cover image.
 */
function getGoogleBooksCoverUrl(volumeId) {
    if (!volumeId) return null;

    const baseUrl = `https://books.google.com/books/publisher/content/images/frontcover/${volumeId}`;
    const params = new URLSearchParams({
        fife: "w1600-h2400", // High-resolution
    });

    return `${baseUrl}?${params.toString()}`;
}

export { googleBooksScraper };
