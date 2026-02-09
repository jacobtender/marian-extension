import { addContributor, addMapping, cleanText, collectObject, getCoverData, getFormattedText, normalizeReadingFormat, remapKeys } from "../shared/utils.js";
import { Extractor } from "./AbstractExtractor.js"

class myAnimeListScraper extends Extractor {
  get _name() { return "MyAnimeList Extractor"; }

  needsReload = false;
  _sitePatterns = [
    /https:\/\/myanimelist\.net\/+(?:manga)\/+(\d+)/
  ];

  async getDetails() {
    const details = await collectObject([
      getCover(),
      getTitle(),
      getDescription(),
      getMetadata(),
      getMappings(),
    ]);

    if (details["Alt Titles"] && details["Title"]) {
      const altTitles = new Set(details["Alt Titles"]);
      altTitles.delete(details["Title"]);
      details["Alt Titles"] = [...altTitles];
    }

    return details;
  }
}

async function getCover() {
  const el = document.querySelector(`.borderClass img`);
  if (!el) return {};
  return getCoverData(el.src);
}

function getMappings() {
  const match = document.location.href.match(/\/manga\/(\d+)/);
  if (!match) return {};
  return { "Mappings": { "MyAnimeList": [match[1]] } };
}

function getTitle() {
  const titleEl = document.querySelector(`.h1-title .title-english`) ?? document.querySelector(".h1-title");
  const title = titleEl?.textContent;
  if (!title) return {};
  return { "Title": cleanText(title) }
}

function getDescription() {
  const description = document.querySelector(`[itemprop="description"]`);
  if (!description) return {};
  return { "Description": getFormattedText(description) }
}

function getMetadata() {
  const items = document.querySelectorAll(`.leftside h2, .leftside div.spaceit_pad`);
  if (!items.length) return {};

  let details = {};

  let heading;
  for (const item of items) {
    if (item.nodeName === "H2") {
      heading = cleanText(item.textContent);
      continue;
    }

    const itemClone = item.cloneNode(true);
    const itemTitleEl = itemClone.querySelector(`span.dark_text`);
    itemTitleEl.remove()

    const title = cleanText(itemTitleEl.textContent.replaceAll(":", ""));
    let value = cleanText(itemClone.textContent);

    if (heading === "Alternative Titles") {
      const titles = details["Alt Titles"] ?? [];
      titles.push(value);
      details["Alt Titles"] = titles;
    }

    if (heading === "Information") {
      if (value === "Unknown") continue;
      if (title === "Serialization" && value === "None") continue;

      if (title === "Published" && /\d+ to/.test(value)) {
        value = cleanText(value.split("to")[0]);
      }

      if (["Genres", "Themes", "Demographics",
        "Genre", "Theme", "Demographic"].includes(title)) {
        value = [...item.querySelectorAll(`a`)].map(i => cleanText(i.textContent));
      }


      if (title === "Authors") {
        let currContributor;
        const contributors = details["Contributors"] ?? [];
        for (const node of itemClone.childNodes) {
          const nodeType = node.nodeName;
          const nodeContent = cleanText(node.textContent);
          if (!nodeContent) continue;

          // no author section was set
          if (nodeType === "A" && currContributor) {
            addContributor(contributors, currContributor, "Author");
            currContributor = undefined;
          }

          if (nodeType === "A") {
            currContributor = formatAuthorName(nodeContent);
            continue;
          }

          // node text content
          let roles = nodeContent.replace(/(^\(|\),?$)/mg, "").split("&").map(cleanText);
          roles = roles.map(i => i === "Story" ? "Author" : i); // replace story with author
          addContributor(contributors, currContributor, roles);
          currContributor = undefined
        }
        if (currContributor) {
          addContributor(contributors, currContributor, "Author")
        }

        value = contributors;
      }

      details[title] = value;
    }
  }

  if (document.querySelector(`.h1-title .title-english`)) {
    const titleElClone = document.querySelector(`.h1-title`)?.cloneNode(true);
    titleElClone?.querySelector(`.title-english`)?.remove();
    if (titleElClone) {
      const altTitles = details["Alt Titles"] ?? [];
      altTitles.push(cleanText(titleElClone.textContent));
      details["Alt Titles"] = altTitles;
    }
  }

  details = remapKeys({
    "Published": "Publication date",
    "Type": "Edition Format",
    "Authors": "Contributors",
    // "Genres": "Genre",
    // "Themes": "Theme",
    // "Demographics": "Demographic",

    "Genres": undefined,
    "Genre": undefined,
    "Theme": undefined,
    "Themes": undefined,
    "Demographic": undefined,
    "Demographics": undefined,
  }, details);

  if (details["Edition Format"]) details["Reading Format"] = normalizeReadingFormat(details["Edition Format"])

  return details;
}

function formatAuthorName(name) {
  if (!name.includes(',')) {
    return name;
  }

  const parts = name.split(',').map(cleanText);
  const lastName = parts[0];
  const firstAndMiddle = parts[1];
  return `${firstAndMiddle} ${lastName}`;
}

export { myAnimeListScraper };

