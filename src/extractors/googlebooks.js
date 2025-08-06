// googlebooks.js

const includedLabels = [
    'Contributors',
    'Publisher',
    'Publication date',
    'Language',
    'Print length',
    'ISBN-10',
    'ISBN-13',
    'ASIN',
    'Series',
    'Series Place',
    'Pages',
    'Edition Format'
];

async function getGoogleBooksDetails() {
    console.log('[👩🏻‍🏫 Marian] Extracting Google Books details');
    const bookDetails = {};

    // Extract cover image using volume ID
    const volumeId = getGoogleBooksIdFromUrl(window.location.href);
    bookDetails["img"] = getGoogleBooksCoverUrl(volumeId);

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
    const readingFormat = getGoogleBookReadingFormat();
    if (readingFormat) {
        bookDetails['Reading Format'] = readingFormat;
        // Set edition format based on reading format
        if (readingFormat === 'E-Book') {
            bookDetails['Edition Format'] = 'Digital';
        } else if (readingFormat === 'Audiobook') {
            bookDetails['Edition Format'] = 'Audiobook';
        } else {
            bookDetails['Edition Format'] = 'Print';
        }
    }

    // Extract authors and convert to contributors format
    const authors = getGoogleBookAuthors();
    if (authors.length > 0) {
        bookDetails['Contributors'] = authors.map(name => ({
            name: name,
            roles: ['Author']
        }));
    }

    console.log("Google Books extraction complete:", bookDetails);

    return {
        ...bookDetails,
    };
}

/**
 * Extracts the book title from the Google Books page.
 * @returns {string} Title text or empty string if not found.
 */
function getGoogleBookTitle() {
    try {
        const titleEl = document.querySelector('div.zNLTKd[aria-level="1"][role="heading"]');
        if (titleEl) {
            return titleEl.textContent.trim();
        }
        return "";
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
    const containers = document.querySelectorAll("div.zloOqf.PZPZlf");

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
        const allDetailBlocks = Array.from(document.querySelectorAll("div.zloOqf.PZPZlf"));

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
        const allDetailBlocks = Array.from(document.querySelectorAll("div.zloOqf.PZPZlf"));

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
        const labelNodes = Array.from(document.querySelectorAll("div.zloOqf.PZPZlf"));

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
        const labelNodes = Array.from(document.querySelectorAll("div.zloOqf.PZPZlf"));

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
        const descriptionContainer = document.querySelector("div.Y0Qrof");
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
 * Normalizes raw format string to one of: Audiobook, E-Book, or Physical Book.
 * @param {string} rawFormat
 * @returns {string}
 */
function normalizeReadingFormat(rawFormat) {
    const format = rawFormat.toLowerCase();

    if (format.includes("audio")) return "Audiobook";
    if (format.includes("ebook") || format.includes("e-book") || format.includes("digital")) {
        return "Ebook";  // Match your extension's format
    }
    if (format.includes("physical") || format.includes("hardcover") || 
        format.includes("paperback") || format.includes("book")) {
        return "Physical Book";
    }

    return "Physical Book"; // Fallback
}

/**
 * Extracts and normalizes reading format from the details section.
 * @returns {string}
 */
function getGoogleBookReadingFormat() {
    try {
        const formatContainer = [...document.querySelectorAll("div.zloOqf.PZPZlf")]
            .find((div) => div.querySelector("span.w8qArf")?.textContent.includes("Format"));

        if (!formatContainer) {
            return "";
        }

        const formatValueEl = formatContainer.querySelector("span.LrzXr.kno-fv.wHYlTd.z8gr9e");
        if (!formatValueEl) {
            return "";
        }

        const rawFormat = formatValueEl.textContent.trim();
        return normalizeReadingFormat(rawFormat);
    } catch (error) {
        console.error("Error extracting reading format:", error);
        return "";
    }
}

/**
 * Extracts author names from the Google Books info panel.
 * @returns {string[]} Array of author names.
 */
function getGoogleBookAuthors() {
    try {
        const authorContainer = Array.from(document.querySelectorAll("div.zloOqf.PZPZlf"))
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
 * Extracts the Google Books volume ID from a given URL.
 * @param {string} url - The current page URL.
 * @returns {string|null} - The extracted volume ID or null if not found.
 */
function getGoogleBooksIdFromUrl(url) {
    const patterns = [
        /books\/edition\/(?:[^/]+\/)?([A-Za-z0-9_-]{10,})/, // e.g., books/edition/_/PYsFzwEACAAJ
        /books\?id=([A-Za-z0-9_-]{10,})/, // e.g., books?id=PYsFzwEACAAJ
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

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export { getGoogleBooksDetails };