import { addContributor, cleanText, collectObject, getCoverData, getFormattedText, logMarian, normalizeReadingFormat } from "../shared/utils.js";
import { Extractor } from "./AbstractExtractor.js"

const API_ROOT = "https://api.mangadex.org/";

class mangaDexScraper extends Extractor {
  get _name() { return "MangaDex Extractor"; }

  needsReload = false;
  _sitePatterns = [
    /https:\/\/mangadex\.org\/title\/(.*)\//
  ];

  async getDetails() {
    const idMatch = document.location.href.match(this._sitePatterns[0]);
    if (!idMatch) throw new Error("Could not get id");
    const id = idMatch[1];

    const url = new URL(`${API_ROOT}/manga/${id}`);
    url.searchParams.append("includes[]", "cover_art");
    url.searchParams.append("includes[]", "author");
    url.searchParams.append("includes[]", "artist");

    const resp = await fetch(url);
    const json = await resp.json();
    if (json.result !== "ok" || !json.data) {
      logMarian("error getting data", json);
      throw new Error("Error getting manga");
    }
    const data = json.data;
    const attr = data.attributes;

    const langName = new Intl.DisplayNames(['en'], { type: 'language' });
    const capitalize = (s) => s && s[0].toUpperCase() + s.slice(1);

    const details = {
      "Title": cleanText(attr.title.en || Object.values(attr.title)[0]),
      "Status": capitalize(attr.status),
      "Original Language": langName.of(attr.originalLanguage),
      "Content Rating": capitalize(attr.contentRating),
      "Demographic": capitalize(attr.publicationDemographic),
    };

    if (attr.description) {
      details["Description"] = cleanText(attr.description.en || Object.values(attr.description)[0]);
    }

    if (attr.year) {
      details["Publication date"] = attr.year.toString();
    }

    if (attr.altTitles) {
      details["Alt Titles"] = attr.altTitles.map(t => cleanText(Object.values(t)[0]));
    }

    if (attr.links) {
      const mappingSources = {
        "al": "Anilist",
        "ap": "AnimePlanet",
        "kt": "Kitsu",
        "mu": "MangaUpdates",
        "mal": "MyAnimeList"
      };
      const mappings = {};
      for (const [key, sourceName] of Object.entries(mappingSources)) {
        if (attr.links[key]) {
          mappings[sourceName] = [attr.links[key]];
        }
      }
      if (Object.keys(mappings).length > 0) details["Mappings"] = mappings;
    }

    const contributors = [];
    for (const rel of data.relationships) {
      if (rel.type === "author" && rel.attributes) addContributor(contributors, rel.attributes.name, "Author");
      if (rel.type === "artist" && rel.attributes) addContributor(contributors, rel.attributes.name, "Artist");
    }
    if (contributors.length > 0) details["Contributors"] = contributors;

    // if (attr.tags) {
    //   details["Tags"] = attr.tags.map(t => cleanText(t.attributes.name.en));
    // }

    let coverPromise = Promise.resolve({});
    const coverRel = data.relationships.find(r => r.type === "cover_art");
    if (coverRel && coverRel.attributes && coverRel.attributes.fileName) {
      coverPromise = getCoverData(`https://uploads.mangadex.org/covers/${id}/${coverRel.attributes.fileName}`);
    }

    return collectObject([details, coverPromise]);
  }
}

export { mangaDexScraper };

