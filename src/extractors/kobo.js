import { Extractor } from "./AbstractExtractor.js";
import { addContributor, getCoverData, logMarian, cleanText, normalizeReadingFormat, collectObject } from "../shared/utils.js";

class koboScraper extends Extractor {
    get _name() { return "Kobo Extractor"; }
    needsReload = false;
    _sitePatterns = [
        /^https?:\/\/(www\.)?kobo\.[a-z]{2,10}\/[a-z]{2,5}\/[a-z]{2,5}\/[a-z]{1,5}book\/[0-9a-z\-]+/,
    ];

    async getDetails() {
        const bookDetails = {};

        // image and imageScore
        const imggrab = document.querySelector('.item-image .image-actions img.cover-image');
        const coverData = getCoverData(imggrab?.src); //, getHighResImageUrl(imggrab?.src)]) -- this function is not doing anything -- skipping

        // Source ID
        // const sourceId = getKoboIdFromUrl(window.location.href);
        // if (sourceId) bookDetails["Mappings"] = { "Kobo": [sourceId] };

        // Title
        getKoboBookTitle(bookDetails);

        // Series name and number
        getKoboSeries(bookDetails);

        // Contributors
        extractKoboContributors(bookDetails);

        //get format and length
        getKoboFormatInfo(bookDetails, window.location.href)

        // get extra block of info - isbn, language, etc.
        extraKoboInfo(bookDetails);

        // Description
        extractKoboDescription(bookDetails);

        // logMarian("Kobo extraction complete:", bookDetails);
        return collectObject([
            coverData,
            bookDetails
        ]);
    }
}

// seems like a thing we do
function getHighResImageUrl(src) {
    //   return src.replace(/\/compressed\.photo\./, '/');
    return src
}

function getKoboIdFromUrl(url) {
    const regex = /book\/([^/?]+)/i;
    const match = url.match(regex);
    return match ? match[1] : null;
}

function extractKoboContributors(bookDetails) {
    const contributors = [];

    const authorray = document.querySelectorAll('.about .authors .visible-contributors a');
    if (authorray) {
        for (let c = 0; c < authorray.length; c++) {
            let authorName = authorray[c].textContent;
            addContributor(contributors, authorName, "Author");
        }
    }
    const narratoray = document.querySelectorAll('.about .narrators .visible-contributors a');
    if (narratoray) {
        for (let c = 0; c < narratoray.length; c++) {
            let narName = narratoray[c].textContent;
            addContributor(contributors, narName, "Narrator");
        }
    }
    if (contributors.length) {
        bookDetails["Contributors"] = contributors;
    }
}

function getKoboSeries(bookDetails) {
    if (document.querySelector('.product-sequence-field a')) {
        let seriesInfoName = document.querySelector('.product-sequence-field a');
        let name = seriesInfoName.textContent.trim();
        bookDetails['Series'] = name;
        let seriesPlace = document.querySelector('.sequenced-name-prefix');
        if (seriesPlace.textContent.match(/\d+/) > 0) {
            let seriesNum = seriesPlace.textContent.trim();
            let number = seriesNum.match(/\d+/);
            bookDetails['Series Place'] = number[0];
        }
    }
}

function getKoboBookTitle(bookDetails) {
    const title = cleanText(document.querySelector('.title-widget h1')?.textContent);
    const subtitle = cleanText(document.querySelector('.title-widget p')?.textContent);
    if (title) bookDetails["Title"] = subtitle ? `${title}: ${subtitle}` : title;
}

function getKoboFormatInfo(bookDetails, url) {
    const formax = /audiobook/i;
    if (url.match(formax)) {
        bookDetails['Reading Format'] = 'Audiobook';
        let audio = document.querySelectorAll(".metadata-field.metadata-time .metadata");
        let audioLength = Math.abs(audio[0].textContent);
        let hours = Math.floor(audioLength);
        let mins = Math.round(((audioLength - hours) * 60));
        if (audioLength < 1) {
            bookDetails['Listening Length'] = [mins + " minutes"];
        } else {
            bookDetails['Listening Length'] = [hours + " hours ", mins + " minutes"];
        }
    } else {
        bookDetails['Reading Format'] = 'Ebook';
        let pageCount = document.querySelector('.stat-desc strong');
        if (pageCount) {
            bookDetails['Pages'] = pageCount.textContent;
        }
    }

    // Normalize reading format just in case
    bookDetails['Reading Format'] = normalizeReadingFormat(bookDetails['Reading Format']);
    // TODO: see if edition format can be extracted (see download options)
}

function joinContent(elements) {
    return Array.from(elements).map(item => cleanText(item.textContent)).join("\n");
}

function extractKoboDescription(bookDetails) {
    const descriptionEl = document.querySelectorAll('#synopsis div[data-full-synopsis] p');
    const fallbackDescriptionEl = document.querySelectorAll('.synopsis-description p');
    let description = null;
    if (descriptionEl) {
        description = joinContent(descriptionEl);
    } else if (fallbackDescriptionEl) {
        description = joinContent(fallbackDescriptionEl);
    }
    bookDetails["Description"] = description;
}


function extraKoboInfo(bookDetails) {
    const extraMetadata = document.querySelectorAll(".bookitem-secondary-metadata ul li");
    const extrainfo = [];
    for (let lindex = 0; lindex < extraMetadata.length; lindex++) {
        let mytext = extraMetadata[lindex].textContent;
        if (lindex == 0) {
            extrainfo['Publisher'] = mytext.trim;
        } else {
            let [a, b] = mytext.split(':');
            extrainfo[a.trim()] = b.trim();
        }
    }
    for (let label in extrainfo) {
        if (!label) break;
        switch (label) {
            case 'Release Date':
                bookDetails['Publication date'] = extrainfo[label];
                break;
            case 'Imprint':
                // if the imprint and publisher are the same, use the publisher; otherwise use the imprint
                // left in case we need to revisit to include both
                if (extrainfo['Publisher'] == extrainfo[label]) {
                    bookDetails['Publisher'] = extrainfo['Publisher'];
                } else {
                    bookDetails['Publisher'] = extrainfo[label];
                }
                break;
            case 'Book ID':
                if (extrainfo[label].length == 13) {
                    bookDetails['ISBN-13'] = extrainfo[label];
                }
                else if (extrainfo[label].length == 10) {
                    bookDetails['ISBN-10'] = extrainfo[label];
                }
                break;
            case 'Language':
                bookDetails['Language'] = extrainfo[label];
                break;
        }
    }
}

export { koboScraper };
