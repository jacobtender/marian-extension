import { addContributor, cleanText, collectObject, fetchHTML, getCoverData, getFormattedText, remapKeys } from "../shared/utils.js";
import { Extractor } from "./AbstractExtractor.js"

const SCRIBBLE_ID = /https:\/\/www\.scribblehub\.com\/series\/(\d+)\//;

class scribbleHubScraper extends Extractor {
  get _name() { return "Scribble Hub Extractor"; }

  needsReload = false;
  _sitePatterns = [
    SCRIBBLE_ID,
  ];

  async getDetails() {
    return collectObject([
      {
        "Publisher": "Scribble Hub",
        "Reading Format": "Ebook",
        "Edition Format": "Web Novel",
      },

      getCover(),
      getTitle(),
      getDescription(),
      getMetadata(),
      getPublicationDate(),
      getStats(),
    ]);
  }
}

async function getCover() {
  const el = document.querySelector(`.novel-cover img`);
  if (!el) return {};
  if (el.src.endsWith("noimagefound.jpg")) return {};
  return getCoverData(el.src);
}

function getTitle() {
  const title = document.querySelector(`.fic_title`)?.textContent;
  if (!title) return {};
  return { "Title": cleanText(title) }
}

async function getStats() {
  let doc = document;
  const onStats = /\/\d+\/.+\/stats\//.test(document.location.href);
  if (!onStats) {
    const id = document.location.href.match(SCRIBBLE_ID);
    if (!id) return {};
    doc = await fetchHTML(`https://www.scribblehub.com/series/${id[1]}/stats/`);
    if (!doc) return {};
  }

  let details = {};

  doc.querySelectorAll(`.wi_novel_details table tr`).forEach(row => {
    const key = cleanText(row.querySelector("th")?.textContent?.replace(":", "") ?? "");
    const value = cleanText(row.querySelector("td")?.textContent ?? "");
    details[key] = value;
  });

  details = remapKeys({
    "Total Views (Chapters)": undefined,
    "Total Views (All)": undefined,
    "Average Views": undefined,
  }, details);
  return details;
}


async function getDescription() {
  let description = document.querySelector(`.wi_fic_desc`);
  if (!description) {
    const id = document.location.href.match(SCRIBBLE_ID);
    if (!id) return {};

    const doc = await fetchHTML(`https://www.scribblehub.com/series/${id[1]}/ /`);
    description = doc?.querySelector(`.wi_fic_desc`);
    console.log("dsc", description, doc)
    if (!description) return {};
  }
  return { "Description": getFormattedText(description) }
}

function getMetadata() {
  const details = {};

  // NOTE: needs to be on main page
  // val = [...document.querySelectorAll(`.wi_fic_genre span[property="genre"]`)].map(i => cleanText(i.textContent));
  // if (val && val.length > 0) details["Genres"] = val;
  //
  // val = [...document.querySelectorAll(`.wi_fic_showtags .stag`)].map(i => cleanText(i.textContent));
  // if (val && val.length > 0) details["Tags"] = val;

  val = document.querySelector(`.wi-fic_r-content .author [property="author"]`)?.textContent;
  if (val) details["Contributors"] = addContributor([], val, "Author");

  val = document.querySelector(`.wi-fic_r-content .copyright li:has(.fa-question)`).textContent;
  if (val) details["Status"] = cleanText(val.split("-")[0]);

  val = document.querySelector(`.fic_stats span.st_item:nth-child(3)`);
  if (val) {
    const cloned = val.cloneNode(true);
    const unit = cloned.querySelector(`.mb_stat`);
    unit.remove();
    details["Chapters"] = cleanText(cloned.textContent);
  }

  return details;

}

async function getPublicationDate() {
  const id = document.location.href.match(SCRIBBLE_ID);
  if (!id) return {};
  return { "Publication date": await getOldestChapter(id[1]) }
}

async function getOldestChapter(id) {
  const params = new URLSearchParams({
    action: "wi_getreleases_pagination",
    pagenum: -1,
    mypostid: id,
  });
  const doc = await fetchHTML("https://www.scribblehub.com/wp-admin/admin-ajax.php", {
    "headers": {
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
    },
    "body": params.toString(),
    "method": "POST",
  });
  const dates = [...doc.querySelectorAll(`.wi_fic_table ol li>span.fic_date_pub`)].map(i => i.title);
  const dateObj = dates.map(parseDate);
  const oldestDate = new Date(Math.min(...dateObj));

  return oldestDate;
}
function parseDate(dateStr) {
  const splitIdx = dateStr.indexOf(' ');
  if (!dateStr.includes('ago') || splitIdx === -1) {
    return new Date(dateStr);
  }


  const amount = +dateStr.slice(0, splitIdx);
  const unit = dateStr.toLowerCase(splitIdx);

  const date = new Date();

  if (unit.startsWith('min')) {
    date.setMinutes(date.getMinutes() - amount);
  } else if (unit.startsWith('hour')) {
    date.setHours(date.getHours() - amount);
  } else if (unit.startsWith('day')) {
    date.setDate(date.getDate() - amount);
  }

  return date;
};

export { scribbleHubScraper };

