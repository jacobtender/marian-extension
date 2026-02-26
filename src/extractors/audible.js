import { cleanText, fetchBackground, getFormattedText, logMarian } from '../shared/utils.js';
import { Extractor } from './AbstractExtractor.js';

class audibleScraper extends Extractor {
    get _name() { return "Audible Extractor"; }
    needsReload = false;
    _sitePatterns = [
        /^https?:\/\/(www\.)?audible\.[a-z.]+\/pd\/(?:[^/]+\/)*[A-Z0-9]{10}(?:\?.*)?$/,
    ];

    async getDetails() {
        return getAudibleDetails();
    }
}

async function getAudibleDetails() {
    const details = {};

    try {
        const asin = extractAsinFromUrl(window.location.href);

        if (!asin) {
            logMarian('Audible extraction failed: No ASIN found in URL');
            return details;
        }

        details.ASIN = asin;

        try {
            const audibleData = await fetchAudibleApiDetails(asin);
            if (audibleData && Object.keys(audibleData).length > 0) {
                Object.assign(details, audibleData);
                logMarian('Audible API extraction complete', audibleData);
            }
        } catch (err) {
            logMarian('API extraction failed', err);
            if (err.message?.startsWith('MISSING_PERMISSION:')) throw err;
        }

        // overwrite with better data when available
        try {
            const audnexusData = await fetchAudnexusApiDetails(asin);
            if (audnexusData && Object.keys(audnexusData).length > 0) {
                Object.assign(details, audnexusData);
                logMarian('Audnexus extraction complete', audnexusData);
            }
        } catch (err) {
            logMarian('Audnexus extraction failed', err);
            if (err.message?.startsWith('MISSING_PERMISSION:')) throw err;
        }

        if (!details['Reading Format']) details['Reading Format'] = 'Audiobook';
        if (!details['Edition Format'] && details['Reading Format']) {
            details['Edition Format'] = "Audible";
        }

        delete details.Edition;
        delete details.Version;

        logMarian('Audible extraction complete', details);
        return details;
    } catch (e) {
        logMarian('Audible extraction failed', { error: String(e) });
        return details;
    }
}

/**
 * get a region for Audnexus API, defaulting to us 
 *
 * @param {string} tld
 */
export function getRegion(tld) {
    let region = 'us';
    if (false);
    else if (tld.endsWith('.ca')) region = 'ca';
    else if (tld.endsWith('.co.uk')) region = 'uk';
    else if (tld.endsWith('.com.au')) region = 'au';
    else if (tld.endsWith('.fr')) region = 'fr';
    else if (tld.endsWith('.de')) region = 'de';
    else if (tld.endsWith('.it')) region = 'it';
    else if (tld.endsWith('.es')) region = 'es';
    else if (tld.endsWith('.in')) region = 'in';
    else if (tld.endsWith('.co.jp')) region = 'jp';
    else if (tld.endsWith('.com.mx')) region = 'mx';

    return region;
}

/**
 * @param {string} asin - audible ASIN
 * @param {string} [region=null] API region to search in
 */
export async function fetchAudnexusApiDetails(asin, region = null) {
    const details = {};
    if (region == null) {
        if (!window.location.host.includes('audible.')) throw new Error("Must provide region");
        const tld = window.location.host.split("audible").pop()
        region = getRegion(tld);
    }

    const resHtml = await fetchBackground(`https://api.audnex.us/books/${asin}?region=${region}`);
    if (!resHtml) return details;
    const data = JSON.parse(resHtml);

    if (data.title) details.Title = data.title + (data.subtitle ? `: ${data.subtitle}` : '');
    if (data.summary) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = data.summary;
        details.Description = getFormattedText(tempDiv);
    }
    if (data.image) details.img = data.image;
    if (data.publisherName) details.Publisher = cleanText(data.publisherName);
    if (data.releaseDate) details['Publication date'] = new Date(data.releaseDate).toISOString().split('T')[0];
    if (data.language) details.Language = data.language;
    if (data.isbn) details['ISBN-13'] = data.isbn;

    const contributors = [];
    if (data.authors) {
        for (const a of data.authors) {
            contributors.push({ name: cleanText(a.name), roles: ['Author'] });
        }
    }
    if (data.narrators) {
        for (const n of data.narrators) {
            contributors.push({ name: cleanText(n.name), roles: ['Narrator'] });
        }
    }
    if (contributors.length) details.Contributors = contributors;

    if (data.seriesPrimary) {
        if (data.seriesPrimary.name) details.Series = cleanText(data.seriesPrimary.name);
        if (data.seriesPrimary.position) details['Series Place'] = data.seriesPrimary.position;
    }

    const lengthMin = data.runtimeLengthMin || 0;
    if (lengthMin) {
        const hours = Math.floor(lengthMin / 60);
        const mins = lengthMin % 60;
        const lengthArr = [];
        if (hours > 0) lengthArr.push(`${hours} hours`);
        if (mins > 0) lengthArr.push(`${mins} minutes`);
        details['Listening Length'] = lengthArr;
    }

    if (data.formatType) {
        if (data.formatType.toLowerCase() === 'unabridged') {
            details['Edition Information'] = 'Unabridged';
        } else if (data.formatType.toLowerCase() === 'abridged') {
            details['Edition Information'] = 'Abridged';
        }
    }
    details['Edition Format'] = 'Audible';

    // if (data.genres) {
    //     details.Categories = data.genres.map(g => cleanText(g.name));
    // }
    //
    // if (data.rating && parseFloat(data.rating) !== 0) {
    //     details['Average Rating'] = parseFloat(data.rating);
    // }

    return details;
}

/**
 * @param {string} asin - audible ASIN;
 * @param {string} [tld=null] top level domain to use for API
 */
export async function fetchAudibleApiDetails(asin, tld = null) {
    const details = {};
    let resHtml;

    if (tld == null) {
        if (!window.location.host.includes('audible.')) throw new Error("Must provide tld");
        tld = ".com";
        tld = window.location.host.split("audible").pop();
    }

    if (!tld.startsWith(".")) tld = `.${tld}`;
    const apiHost = `api.audible${tld}`;

    try {
        resHtml = await fetchBackground(`https://${apiHost}/1.0/catalog/products/${asin}?response_groups=category_ladders,contributors,media,product_attrs,product_desc,product_details,product_extended_attrs,rating,series&image_sizes=512,1024`);
    } catch (e) {
        if (e.message?.startsWith('MISSING_PERMISSION:')) throw e;
        return details;
    }
    if (!resHtml) return details;
    const json = JSON.parse(resHtml);
    const data = json.product;
    if (!data) return details;

    if (data.title) details.Title = data.title + (data.subtitle ? `: ${data.subtitle}` : '');
    if (data.publisher_summary) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = data.publisher_summary;
        details.Description = getFormattedText(tempDiv);
    }

    if (data.product_images && data.product_images['1024']) {
        details.img = data.product_images['1024'];
    }

    if (data.publisher_name) details.Publisher = cleanText(data.publisher_name);
    if (data.release_date) details['Publication date'] = data.release_date;
    if (data.language) details.Language = data.language;
    if (data.isbn) details['ISBN-13'] = data.isbn;

    const contributors = [];
    if (data.authors) {
        for (const a of data.authors) {
            contributors.push({ name: cleanText(a.name), roles: ['Author'] });
        }
    }
    if (data.narrators) {
        for (const n of data.narrators) {
            contributors.push({ name: cleanText(n.name), roles: ['Narrator'] });
        }
    }
    if (contributors.length) details.Contributors = contributors;

    if (data.series && data.series.length > 0) {
        const primary = data.series[0];
        if (primary.title) details.Series = cleanText(primary.title);
        if (primary.sequence) details['Series Place'] = primary.sequence;
    }

    const lengthMin = data.runtime_length_min || 0;
    if (lengthMin) {
        const hours = Math.floor(lengthMin / 60);
        const mins = lengthMin % 60;
        const lengthArr = [];
        if (hours > 0) lengthArr.push(`${hours} hours`);
        if (mins > 0) lengthArr.push(`${mins} minutes`);
        details['Listening Length'] = lengthArr;
    }

    if (data.format_type) {
        if (data.format_type.toLowerCase() === 'unabridged') {
            details['Edition Information'] = 'Unabridged';
        } else if (data.format_type.toLowerCase() === 'abridged') {
            details['Edition Information'] = 'Abridged';
        }
    }
    details['Edition Format'] = 'Audible';

    if (data.category_ladders) {
        const categories = new Set();
        for (const ladder of data.category_ladders) {
            if (ladder.ladder) {
                for (const item of ladder.ladder) {
                    if (item.name) categories.add(cleanText(item.name));
                }
            }
        }
        // if (categories.size > 0) {
        //     details.Categories = Array.from(categories);
        // }
    }

    // if (data.rating) {
    //     const rating = data.rating.overall_distribution?.display_average_rating;
    //     if (rating) details['Average Rating'] = parseFloat(rating);
    //
    //     const count = data.rating.overall_distribution?.num_ratings;
    //     if (count) details['Ratings Count'] = count;
    // }

    return details;
}

/**
 * Parse an ASIN identifier from Audible URLs.
 *
 * @param {string | null | undefined} url URL that may contain an ASIN.
 * @returns {string | null} Parsed ASIN in uppercase, or null if none found.
 */
function extractAsinFromUrl(url) {
    if (!url) return null;
    const match = url.match(/\/(?:pd|p)\/[^/]+\/([A-Z0-9]{10})(?:[/?]|$)/i) || url.match(/asin=([A-Z0-9]{10})/i);
    return match ? match[1].toUpperCase() : null;
}

export { audibleScraper };
