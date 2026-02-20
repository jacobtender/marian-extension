import { addContributor, cleanText, collectObject, getCoverData, getFormattedText, remapKeys } from "../shared/utils.js";
import { Extractor } from "./AbstractExtractor.js"


class royalRoadScraper extends Extractor {
  get _name() { return "Royal Road Extractor"; }

  needsReload = false;
  _sitePatterns = [
    /https:\/\/www\.royalroad\.com\/fiction\/(\d+)/
  ];

  async getDetails() {
    return collectObject([
      {
        "Publisher": "Royal Road",
        "Reading Format": "Ebook",
        "Edition Format": "Web Novel",
      },

      getCover(),
      getTitle(),
      getDescription(),
      getMetadata(),
      getChapterInfo(),
      getStats(),
    ]);
  }
}

async function getCover() {
  // get currently selected cover
  let el = document.querySelector(`.portlet-body .slick-list .selected img`);
  if (!el) {
    // use main cover if not found
    el = document.querySelector(`.cover-art-container img`);
    if (!el) return {};
  }
  if (el.src.endsWith("nocover-new-min.png")) return {};
  return getCoverData(el.src);
}

function getTitle() {
  let title = cleanText(document.querySelector(`.fic-header h1`)?.textContent ?? "");
  if (!title) return {};
  const selected = document.querySelector(`.portlet-body .slick-list .selected`);
  if (selected?.hasAttribute("aria-labelledby")) {
    const subtitle = cleanText(selected.querySelector(`h6`)?.textContent ?? "")
    title = `${title}: ${subtitle}`;
  }

  return { "Title": title }
}

function getStats() {
  const partialBook = document.querySelector(`.portlet-body .slick-list .selected`)?.hasAttribute("aria-labelledby") === true;

  const statList = document.querySelector(`.fiction-stats .stats-content div:nth-child(2) ul`);
  if (!statList) return {};

  let details = {};

  for (let i = 0; i < statList.children.length; i += 2) {
    const titleEl = statList.children[i];
    const valueEl = statList.children[i + 1];
    if (!titleEl || !valueEl) continue;
    let title = cleanText(titleEl.textContent.replace(":", ""));
    let value = cleanText(valueEl.textContent);
    if (!title || !value) continue;

    if (title === "Pages") {
      const wordCount = titleEl.querySelector(`i`)?.dataset?.content?.match(/calculated from ([0-9,]+) words/);
      if (wordCount) {
        details["Word Count"] = wordCount[1];
      }
    }

    details[title] = value;
  }

  details = remapKeys({
    "Total Views": undefined,
    "Average Views": undefined,
    "Followers": undefined,
    "Favorites": undefined,
    "Ratings": undefined,
  }, details);

  if (partialBook) {
    delete details["Word Count"];
    delete details["Pages"];
  };

  return details;
}

function getDescription() {
  let description = document.querySelector(`.description .hidden-content`);
  if (!description) return {};
  return { "Description": getFormattedText(description) }
}

function getMetadata() {
  const details = {};

  const contributors = details["Contributors"] ?? [];
  val = document.querySelector(`.fic-title h4 span:not(.collaborator-group) a`)?.textContent;
  if (val) addContributor(contributors, val, "Author");

  [...document.querySelectorAll(`.fic-title h4 span.collaborator-group`)].forEach(i => {
    let label = cleanText(i.textContent.split(":")[0] ?? "Collaborator");
    if (label === "Editors") label = "Editor";

    for (const name of i.querySelectorAll(`a`))
      addContributor(contributors, cleanText(name.textContent), label);
  });

  details["Contributors"] = contributors;

  const tagSection = document.querySelector(`.fiction-info div:has(>.tags)`);
  const infoTags = tagSection.querySelectorAll("span:not(.tags)");
  if (infoTags?.length === 2) {
    const [contentType, status] = infoTags;
    if (contentType) details["Type"] = cleanText(contentType.textContent);
    if (status) details["Status"] = cleanText(status.textContent);
  }

  val = [...document.querySelectorAll(`.fiction-info .font-red-sunglo:has(strong) ul li`)].map(i => cleanText(i.textContent));
  if (val && val.length > 0) details["Content Warnings"] = val;

  const tags = [...tagSection.querySelectorAll(`.tags a`)].map(i => cleanText(i.textContent));
  if (tags && tags.length > 0) details["Tags"] = tags;

  return details;

}

async function getChapterInfo() {
  const selected = document.querySelector(`.portlet-body .slick-list .selected`);
  const label = +selected.attributes["aria-labelledby"]?.textContent?.match(/volume-(\d+)-label/)?.[1];

  const infoScript = [...document.querySelectorAll(`body script`)].find(i => i.innerHTML.includes("window.chapters"));
  if (!infoScript) return {};
  const info = infoScript.innerHTML
    .split("\n")
    .map(i => i.trim())
    .filter(i => i.includes('='))
    .reduce((acc, i) => {
      const [k, v] = i.replace('window.', '').split(' = ');
      acc[k] = JSON.parse(v.replace(';', ''));
      return acc;
    }, {});
  if (!info) return {};
  // console.log(info);

  let chapters = info.chapters?.filter(i => i.isUnlocked && i.visible);
  if (label) chapters = chapters?.filter(i => i.volumeId === label);
  // console.log(chapters);

  const oldest = new Date(Math.min(...chapters.map(i => new Date(i.date))));

  return {
    "Chapters": chapters.length,
    "Publication date": oldest,
  }
}

export { royalRoadScraper };

