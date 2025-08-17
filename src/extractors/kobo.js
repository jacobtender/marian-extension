import { getImageScore, logMarian, delay } from "../shared/utils.js";

async function getKoboDetails() {
    logMarian("Extracting Kobo details");
    const bookDetails = {};

    // image and imageScore
    const imggrab = document.querySelector('.item-image .image-actions img.cover-image');
    bookDetails["img"] = imggrab.src ? getHighResImageUrl(imggrab.src) : null;
    bookDetails["imgScore"] = imggrab?.src ? await getImageScore(imggrab.src) : 0;

    // Source ID
    // const sourceId = getKoboIdFromUrl(window.location.href);
    // if (sourceId) bookDetails["Source ID"] = sourceId;

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

    logMarian("Kobo extraction complete:", bookDetails);
    return {
        ...bookDetails,
    };

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
    // TODO this is so ugly. save me ferris beuller, you're my only hope
    const contributor = [];
    const authorole = [];
    const narrole = [];
    const finallist = [];
    const authorray = document.querySelectorAll('.about .authors .visible-contributors a');
    if (authorray) {
        for (let c = 0; c < authorray.length; c++) {
            let authorline = authorray[c].textContent;
            authorole[authorline] = true;
            contributor[authorline] = true;
        }
    }
    const narratoray = document.querySelectorAll('.about .narrators .visible-contributors a');
    if (narratoray) {
        for (let c = 0; c < narratoray.length; c++) {
            let narline = narratoray[c].textContent;
            contributor[narline] = true;
            narrole[narline] = true;
        }
    }
    for (let name in contributor) {
        let roles = [];
        if (narrole[name]) {
            roles.push('Narrator');
        }
        if (authorole[name]) {
            roles.push('Author');
        }
        finallist.push({ name, roles: [roles] });
    }
    if (finallist.length) {
        bookDetails["Contributors"] = finallist;
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
    const h1 = document.querySelector('.title-widget h1');
    const rawTitle = h1?.childNodes[0]?.textContent.trim();
    rawTitle ? bookDetails["Title"] = rawTitle : null;
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
            bookDetails['Listening Length'] = mins + " minutes";
        } else {
            bookDetails['Listening Length'] = hours + " hours " + mins + " minutes";
        }
    } else {
        bookDetails['Reading Format'] = 'Ebook';
        let pageCount = document.querySelector('.stat-desc strong');
        if (pageCount) {
            bookDetails['Pages'] = pageCount.textContent;
        }
    }

}

function extractKoboDescription(bookDetails) {
    const descriptionEl = document.querySelector('.synopsis-description p');
    bookDetails["Description"] = descriptionEl ? descriptionEl.textContent.trim() : null;
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

export { getKoboDetails };