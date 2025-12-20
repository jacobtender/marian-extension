// googlebooks.js
import { Extractor } from './AbstractExtractor.js';
import { logMarian, getCoverData, cleanText, normalizeReadingFormat, collectObject, queryDeep, queryAllDeep, getFormattedText, addContributor, clearDeepQueryCache } from '../shared/utils.js';

const KNOWN_HOSTS = ['g-expandable-content'];

class googleBooksScraper extends Extractor {
    get _name() { return "Google Books Extractor"; }
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

        const bookDetails = googlebooksClassic ?
            getClassicGoogleBooksDetails() :
            getGoogleBooksDetails();

        return collectObject([
            coverData,
            bookDetails,
            mappings,
        ]);
    }
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

    // Extract authors and convert to contributors format
    let contributors = [];

    const authors = getGoogleBookAuthors();
    authors.forEach(contributor => addContributor(contributors, contributor, "Author"));
    const illustrators = getGoogleBookIllustrators();
    illustrators.forEach(contributor => addContributor(contributors, contributor, "Illustrator"));

    bookDetails['Contributors'] = contributors;

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
    const pubSplit = bookInfo["Publisher"].textContent.split(",");
    // const pubYear = pubSplit[pubSplit.length - 1];
    // bookDetails["Publication date"] = new Date(+pubYear, 0).toISOString();
    bookDetails["Publisher"] = cleanText(pubSplit.slice(0, pubSplit.length - 1).join(","));
    delete bookInfo["Publisher"];

    const headerInfo = document.querySelectorAll("#bookinfo .bookinfo_sectionwrap div");
    const pubYearElement = Array.from(document.querySelectorAll("#bookinfo .bookinfo_sectionwrap div"))
        .filter(el => el.textContent.includes(bookDetails["Publisher"]))[0]
    if (pubYearElement) {
        bookDetails["Publication date"] = new Date(pubYearElement.children[1].textContent);
    }

    let contributors = [];
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
        const titleEl = queryDeep('div.zNLTKd[aria-level="1"][role="heading"]', KNOWN_HOSTS);
        return cleanText(titleEl?.textContent);
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
        const descriptionContainer = queryDeep("g-expandable-content[data-eb='0'] div.Y0Qrof", KNOWN_HOSTS);
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

/**
 * Extracts author names from the Google Books info panel.
 * @returns {string[]} Array of author names.
 */
function getGoogleBookAuthors() {
    try {
        const authorContainer = Array.from(queryAllDeep("div.zloOqf.PZPZlf", KNOWN_HOSTS))
            .find((div) => div.textContent.trim().toLowerCase().startsWith("author"));

        if (!authorContainer) {
            return [];
        }

        const anchorElements = authorContainer.querySelectorAll("a.fl");
        return Array.from(anchorElements).map((a) => a.textContent.trim());
    } catch (err) {
        console.error("Error while extracting book authors", err);
        return [];
    }
}

/**
 * Extracts illustrator names from the Google Books info panel.
 * @returns {string[]} Array of illustrator names.
 */
function getGoogleBookIllustrators() {
    try {
        const illustratorContainer = Array.from(queryAllDeep("div.zloOqf.PZPZlf", KNOWN_HOSTS))
            .find((div) => div.textContent.trim().toLowerCase().startsWith("illustrator"));

        if (!illustratorContainer) {
            return [];
        }

        console.log(illustratorContainer);
        const illustrators = illustratorContainer.children[1].textContent.split(",");
        return Array.from(illustrators).map((a) => cleanText(a));
    } catch (err) {
        console.error("Error while extracting book illustrators", err);
        return [];
    }
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
