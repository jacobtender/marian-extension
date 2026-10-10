import groups from "./groups.json";

/**
 * Compare list with dashes removed from ISBN prefix keys for character-by-character verification
 *
 * @type{undefined|[string, string][]}
 */
let compareList;      // tuple compare representation

/**
 * Search list float representations (e.g., "978-1" → 978.1) for comparison
 *
 * @type{undefined|[number, [number, number]][][]}
 */
let searchList;       // search representation

/**
 * rangeSearchList is float representations (e.g., "0001" → 0.0001) for range comparison
 *
 * @type{undefined|[number, [number, number]][][]}
 */
let rangeSearchList;

/**
 *@param {{[prefix: string]: [string, [string, string][]]}} groups
 */
function updateUtilityLists(groups) {
  const entries = Object.entries((groups))

  compareList = entries.map(([key, [name]]) => [key.replace("-", ""), name]);
  searchList = entries.map(([key]) => parseFloat(key.replace("-", ".")));
  rangeSearchList = entries.map(([_, [_1, ranges]]) => ranges.map(item =>
    [item[0].length, [parseFloat(`0.${item[0]}`), parseFloat(`0.${item[1]}`)]]
  ));
}

// Initialize the groups data into three parallel lists for efficient ISBN range lookups
updateUtilityLists(groups);

const UPDATE_URL =
  "https://raw.githubusercontent.com/jacobtender/marian-extension/refs/heads/main/src/shared/groups.json";

const UPDATE_RATE_DAYS = 2;

updateLists();

/**
 * Update the data once every 2 weeks
 *
 */
export async function updateLists() {
  const api = typeof browser !== 'undefined' ? browser : chrome;
  const storage = api.storage.local;
  const updateRateMs = UPDATE_RATE_DAYS * 24 * 60 * 60 * 1000;

  const lastUpdate = new Date(await storage.get("groups-lastupdate") ?? 0);

  const now = new Date();
  if ((now.getTime() - lastUpdate.getTime()) > updateRateMs) {
    const data = await storage.get("groups-data");
    if (!isValidStructure(data)) return;

    console.log("Updating lists from stored list");
    updateUtilityLists(data);
    return;
  };

  console.log("Fetching from new data");

  const response = await fetch(UPDATE_URL);
  const data = await response.json();

  await storage.set({ "groups-lastupdate": now.getTime() });

  if (!isValidStructure(data)) {
    console.log("Invalid object recived", data);
    return;
  }

  await storage.set({ "groups-data": data });

  console.log("Got data, updating lists");
  updateUtilityLists(data);
}

function isValidStructure(obj) {
  // 1. Check if it's a non-null object
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
    return false;
  }

  // 2. Iterate through every key (the "prefix")
  return Object.values(obj).every(entry => {
    // Check if the entry is an array with exactly 2 elements: [string, [string, string][]]
    if (!Array.isArray(entry) || entry.length !== 2) return false;

    const [label, pairs] = entry;

    // 3. Validate the first element is a string
    if (typeof label !== 'string') return false;

    // 4. Validate the second element is an array of pairs
    if (!Array.isArray(pairs)) return false;

    return pairs.every(pair =>
      Array.isArray(pair) &&
      pair.length === 2 &&
      typeof pair[0] === 'string' &&
      typeof pair[1] === 'string'
    );
  });
}

/** 
  * Searches a structured ISBN group registry to determine the publishing group/country for a given ISBN.
  * Uses a linear search algorithm on ISBN prefixes to efficiently locate the correct group.
  * Supports both ISBN-13 and ISBN-10 formats; ISBN-10 values are automatically converted to ISBN-13.
  * 
  * Algorithm:
  * 1. Normalizes input and converts ISBN-10 to ISBN-13 if needed
  * 2. Performs linear search on float-encoded ISBN prefixes to find the candidate group
  * 3. Validates the match by comparing character-by-character with the stored prefix
  *
  * @param {string} isbn ISBN-13 (with or without dashes) or ISBN-10 (with or without dashes)
  * @returns {string|undefined} The group name (e.g., "United States", "United Kingdom") or undefined if no match
  * @throws {Error} If ISBN is not exactly 10 or 13 digits
  */
export function searchIsbn(isbn) {
  const item = getPrefix(isbn);
  if (item === undefined) return undefined;
  return item.name;
}

/** 
  * Adds hyphens to an ISBN in the correct locations.
  * Returns original string if no match found.
  *
  * @param {string} isbn ISBN-13 or ISBN-10
  * @returns {string} hyphenated or original ISBN
  */
export function hyphenate(isbn) {
  const item = getPrefix(isbn);
  if (item === undefined) return isbn;
  isbn = isbn.replaceAll("-", ""); // remove dashes

  const parts = [];
  // prefix
  if (!item.is10) {
    parts.push(item.prefix.slice(0, 3));
  }
  // group
  parts.push(item.prefix.slice(3))

  // get the rest of the ISBN without the prefix, if it was a ISBN-10 then ignore the 3-digit prefix
  const rest = isbn.slice(item.prefix.length - (item.is10 ? 3 : 0));
  const searchRepr = parseFloat("0." + rest);

  const searchRanges = rangeSearchList[item.idx];
  let idx = 0;
  for (; idx < searchRanges.length; idx++) {
    const range = searchRanges[idx][1];
    if (searchRepr >= range[0] && searchRepr <= range[1]) {
      break;
    }
  }

  if (idx === searchRanges.length) {
    // reached end without match, publisher boundary unknown, treat as mixed
    parts.push(rest.slice(0, rest.length - 1));
  } else {
    const length = searchRanges[idx][0];
    // publisher
    parts.push(rest.slice(0, length));
    // title
    parts.push(rest.slice(length, rest.length - 1));
  }

  // check digit
  parts.push(rest.slice(rest.length - 1));
  return parts.join("-");
}

/**
  * Identifies the group prefix and metadata for a given ISBN.
  *
  * @param {string} isbn
  * @returns {{prefix:string, name: string, is10: boolean, idx: number}|undefined}
  */
function getPrefix(isbn) {
  if (compareList === undefined || searchList === undefined || rangeSearchList === undefined) throw Error("Lists not initialized");

  // Normalize input: remove all dashes to get clean digit string
  isbn = isbn.replaceAll("-", ""); // remove dashes
  if (isbn.length !== 13 && isbn.length !== 10) {
    throw new Error("Unsupported isbn");
  }

  // Convert ISBN-10 to pseudo ISBN-13 by prepending the standard prefix
  let is10 = false;
  if (isbn.length === 10) {
    is10 = true;
    isbn = "978" + isbn;
  }
  // All subsequent logic operates on ISBN-13 format

  // Search: find the first group whose prefix is greater than the input ISBN,
  // then step back one index to get the group that contains this ISBN's range
  const searchRepr = parseFloat(isbn.substring(0, 3) + "." + isbn.substring(3));
  let idx = 0;
  for (; idx < compareList.length; idx++) {
    if (searchRepr < searchList[idx]) {
      break;
    }
  }
  idx--;

  if (idx === -1) {
    return undefined;
  }

  // Verify the match is valid: ensure the ISBN actually starts with the matched prefix.
  // Groups have variable-length prefixes, so we validate character-by-character.
  const item = compareList[idx];
  for (let i = 0; i < item[0].length; i++) {
    if (item[0][i] !== isbn[i]) {
      // Mismatch found: the ISBN falls between group ranges, no valid group exists
      return undefined;
    }
  }
  // Return the group info associated with the matched prefix
  return { name: item[1], prefix: item[0], is10, idx };
}
