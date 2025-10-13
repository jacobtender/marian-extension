import { logMarian, getFormattedText, delay } from '../shared/utils.js';

async function getOverdriveDetails() {
  const id = document.querySelector(".cover img")?.dataset?.id;
  if (id == undefined) throw "Id not found";
  return getDetailsFromOverdriveId(id);
}

async function getLibbyDetails() {
  // await for data to load so we can rip it
  await delay(300);
  // normal libby app
  let id = document.querySelector(".view-train-car:not([aria-hidden='true']) .cover-box img")?.dataset?.coverId;

  // share page
  if (id == undefined) {
    const shareScript = document.querySelector("script");
    if (shareScript != undefined) {
      const idMatch = shareScript.textContent.match(/'\/availability\/'\+library\+'(\d+)'\+location\.search/);
      if (idMatch != undefined) {
        id = idMatch[1];
      }
    }
  }

  if (id == undefined) throw "Id not found";
  return getDetailsFromOverdriveId(id);
}

async function getTeachingBooksDetails() {
  const idMatch = document.querySelector("a.book")?.href?.match(/overdrive.com\/media\/(\d+)\//);
  if (idMatch == undefined || idMatch.length < 2) throw "Id not found";
  return getDetailsFromOverdriveId(idMatch[1]);
}

const apiUrl = "https://thunder.api.overdrive.com/v2/media/bulk";

async function getDetailsFromOverdriveId(id) {
  // retrieve data
  const url = new URL(apiUrl);
  url.searchParams.set('titleIds', id);
  url.searchParams.set('x-client-id', "marian"); // dewey

  const req = await fetch(url);
  if (!req.ok) {
    throw "Failed to retrive data from api";  // failed to retrieve data
  }
  let data = await req.json();
  if (data.length < 1) {
    throw "Data not found"
  }
  data = data[0];

  // logMarian("book data", data);

  let details = {};

  // TODO: make sure JSON conforms to expectations

  // Get relevant details
  // source id
  details["Source ID"] = data.id;

  // cover
  const cover = Object.values(data.covers)
    .reduce((cover, { width, height, href }) => cover.res > (width * height) ? cover : { res: width * height, href }); // get cover with highest resolution
  details["img"] = cover.href;
  details["imgScore"] = cover.res; // save on calling getImageScore because we already have the resolution

  // contributors
  const contributors = Object.values(data.creators.reduce((acc, { id, name, role }) => {
    if (!acc[id]) {
      acc[id] = { name, roles: [] };
    }
    acc[id].roles.push(role);
    return acc;
  }, {}));
  details["Contributors"] = contributors;

  // description
  let description = data.fullDescription || data.description;
  description = description.replace(/<br\/?>/g, "<br/><br/>") // double space paragraphs
  const descriptionEl = document.createElement('div');
  descriptionEl.innerHTML = description;
  details["Description"] = getFormattedText(descriptionEl);

  // title
  let title = data.title;
  if (data.subtitle) {
    title = title + ": " + data.subtitle
  }
  details["Title"] = title;

  // format
  details["Edition Format"] = data.type?.name; // eBook most of the time
  details["Edition Information"] = data.edition;

  // publisher
  details["Publisher"] = data.publisher?.name;
  details["Publisher Account"] = data.publisherAccount?.name; // ??

  details["Imprint"] = data.imprint?.name;

  // date
  details["Publication date"] = data.publishDate ?? data.estimatedReleaseDate;

  // language
  if (data.languages.length > 1) {
    details["Languages"] = data.languages.map(language => language.name).join(", ");
  }
  details["Language"] = data.languages[0].name;


  // series
  if (data.detailedSeries) {
    details["Series"] = data.detailedSeries.seriesName;
    details["Series Place"] = data.detailedSeries.readingOrder;
  }

  // Format data
  let formats = [];
  if (data.formats != undefined && data.formats.length > 0) {
    switch (data.type?.id) {
      case "ebook":
        formats = collapseEbookFormats(data.formats)
        break;
      case "audiobook":
        formats = collapseAudiobookFormats(data.formats)
        break;
      default:
        logMarian(`No format parser for ${data.type?.id} type`)
    }
  }

  // logMarian("Formats", formats);
  const format = formats.length > 0 ? formats[0] : {};

  // TODO: add support for showing multiple books / formats in marian

  details = { ...details, ...format };

  // cleanup undefined or null keys
  Object.entries(details).forEach(([key, value]) => {
    if (value == undefined) {
      delete details[key];
    }
  });

  // logMarian("book details", details);

  return details;
}

function collapseEbookFormats(formats) {
  const formatList = [];
  for (let format of formats) {
    let formatInfo = {};
    let formatId = -1;

    // match by date
    let match = formatList.findIndex((el) => el.saleDate == format.onSaleDateUtc);
    if (match != -1 && formatId == -1) {
      formatId = match;
      formatInfo = formatList[formatId];
    }
    // match by isbn
    match = formatList.findIndex((el) => el["ISBN-13"] == format.isbn || el["ISBN-10"] == format.isbn);
    if (match != -1 && formatId == -1) {
      formatId = match;
      formatInfo = formatList[formatId];
    }

    // treat it as a new entry if not matched
    if (formatId == -1) {
      formatId = formatList.length;
      formatList.push(formatInfo);
    }

    // --

    if (formatInfo.saleDate == undefined) {
      formatInfo.saleDate = format.onSaleDateUtc;
    }

    if (format.isbn?.length == 13) {
      formatInfo["ISBN-13"] = format.isbn;
    } else if (format.isbn?.length == 10) {
      formatInfo["ISBN-10"] = format.isbn;
    }

    // if kindle ebook
    if (format.fulfillmentType == "kindle") { // canalso be bifocal, epub or kobo
      formatInfo["Edition Format"] = "Kindle"; // force it to be a kindle edition to conform with hardcover eBooks

      // fetch ASIN
      const asin = format.identifiers.find(({ type }) => type == "ASIN")?.value;
      if (asin != undefined) {
        formatInfo["ASIN"] = asin;
      }
    }

    if (formatInfo["Edition Format"] == undefined) {
      formatInfo["Edition Format"] = format.name;
    }
  }

  formatList.forEach((value) => {
    delete value["saleDate"]; // not needed
  });

  return formatList
}
function collapseAudiobookFormats(formats) {
  const formatList = [];
  for (let format of formats) {
    let formatInfo = {};
    let formatId = -1;

    // match by date
    let match = formatList.findIndex((el) => el.saleDate == format.onSaleDateUtc);
    if (match != -1 && formatId == -1) {
      formatId = match;
      formatInfo = formatList[formatId];
    }
    // match by duration
    match = formatList.findIndex((el) => el.duration == format.duration);
    if (match != -1 && formatId == -1) {
      formatId = match;
      formatInfo = formatList[formatId];
    }
    // match by isbn
    match = formatList.findIndex((el) => el["ISBN-13"] == format.isbn || el["ISBN-10"] == format.isbn);
    if (match != -1 && formatId == -1) {
      formatId = match;
      formatInfo = formatList[formatId];
    }

    // treat it as a new entry if not matched
    if (formatId == -1) {
      formatId = formatList.length;
      formatList.push(formatInfo);
    }

    // --

    if (formatInfo.saleDate == undefined) {
      formatInfo.saleDate = format.onSaleDateUtc;
    }

    // NOTE: note sure about this, audiobooks don't typically have ISBNs
    if (format.isbn?.length == 13) {
      formatInfo["ISBN-13"] = format.isbn;
    } else if (format.isbn?.length == 10) {
      formatInfo["ISBN-10"] = format.isbn;
    }

    if (formatInfo["Edition Format"] == undefined) {
      formatInfo["Edition Format"] = format.name;
    }

    if (formatInfo["Listening Length"] == undefined) {
      const duration = format.duration.split(":").map((val) => parseInt(val));
      if (duration.length == 3) {
        const [hours, minutes, seconds] = duration;
        formatInfo["Listening Length"] = [hours + " Hours", minutes + " Minutes", seconds + " Seconds"];
      } else if (duration.length == 2) {
        const [hours, minutes] = duration;
        formatInfo["Listening Length"] = [hours + " Hours", minutes + " Minutes"];
      } else {
        logMarian(`WARN: unknown duration ${format.duration}`)
      }
    }
  }

  formatList.forEach((value) => {
    delete value["saleDate"]; // not needed
  });

  return formatList
}

export { getOverdriveDetails, getLibbyDetails, getTeachingBooksDetails };
