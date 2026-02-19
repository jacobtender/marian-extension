import { addContributor, cleanText, collectObject, getCoverData, getFormattedText, logMarian, normalizeReadingFormat } from "../shared/utils.js";
import { Extractor } from "./AbstractExtractor.js"

const API_ENDPOINT = "https://graphql.anilist.co";

class anilistScraper extends Extractor {
  get _name() { return "Anilist Extractor"; }

  needsReload = false;
  _sitePatterns = [
    /https:\/\/anilist\.co\/manga\/(\d+)\/?/
  ];

  async getDetails() {
    const idMatch = document.location.href.match(this._sitePatterns[0]);
    if (!idMatch) throw new Error("Could not get id");
    const id = idMatch[1];

    const query = `
    query ($id: Int) {
      Media (id: $id, type: MANGA) {
        id
        title {
          romaji
          english
          native
        }
        description
        coverImage {
          extraLarge
          large
        }
        status
        format
        startDate {
          year
        }
        synonyms
        staff {
          edges {
            role
            node {
              name {
                full
              }
            }
          }
        }
        externalLinks {
            site
            url
        }
      }
    }
    `;

    const variables = {
      id: parseInt(id)
    };

    const resp = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables
      })
    });

    const json = await resp.json();
    if (!json.data || !json.data.Media) {
      logMarian("error getting data", json);
      throw new Error("Error getting manga");
    }

    const media = json.data.Media;
    const details = {};

    // Title
    details["Title"] = cleanText(media.title.english || media.title.romaji || media.title.native);

    // Alt Titles
    const altTitles = [];
    if (media.title.romaji && media.title.romaji !== details["Title"]) altTitles.push(media.title.romaji);
    if (media.title.native && media.title.native !== details["Title"]) altTitles.push(media.title.native);
    if (media.synonyms) altTitles.push(...media.synonyms);
    if (altTitles.length > 0) details["Alt Titles"] = altTitles.map(cleanText);

    // Description
    if (media.description) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(media.description, 'text/html');
      details["Description"] = getFormattedText(doc.body);
    }

    // Status
    if (media.status) {
      details["Status"] = this.capitalize(media.status.replace(/_/g, ' ').toLowerCase());
    }

    // Publication Date
    if (media.startDate && media.startDate.year) {
      details["Publication date"] = media.startDate.year.toString();
    }

    // Format
    if (media.format) {
      details["Edition Format"] = this.capitalize(media.format.replace(/_/g, ' ').toLowerCase());
      details["Reading Format"] = normalizeReadingFormat(details["Edition Format"]);
    }

    // Contributors
    if (media.staff && media.staff.edges) {
      const contributors = [];
      for (const edge of media.staff.edges) {
        const name = edge.node.name.full;
        const role = edge.role;
        let finalRole = role;
        const lowerRole = role.toLowerCase();
        if (lowerRole.includes("story") && lowerRole.includes("art")) {
          addContributor(contributors, name, ["Author", "Artist"]);
          continue;
        }
        if (lowerRole.includes("story")) finalRole = "Author";
        if (lowerRole.includes("art")) finalRole = "Artist";
        addContributor(contributors, name, finalRole);
      }
      if (contributors.length > 0) details["Contributors"] = contributors;
    }

    // Mappings
    details["Mappings"] = { "Anilist": [id] };

    // Cover
    let coverPromise = Promise.resolve({});
    if (media.coverImage) {
      const coverUrl = media.coverImage.extraLarge || media.coverImage.large;
      if (coverUrl) coverPromise = getCoverData(coverUrl);
    }

    return collectObject([details, coverPromise]);
  }

  capitalize(s) {
    return s && s[0].toUpperCase() + s.slice(1);
  }
}

export { anilistScraper };
