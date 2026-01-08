import groups from "./groups.json";

const entries = Object.entries(/**@type{{[prefix: string]: [string, [string, string][]]}}*/(groups))
/**@type{[string, string][]}*/
const compareList = entries.map(([key, [name]]) => [key.replace("-", ""), name]); // tuple compare representation
const searchList = entries.map(([key]) => parseFloat(key.replace("-", ".")));            // search representation
/**@type{[number, [number, number]][][]}*/
const rangeSearchList = entries.map(([_, [_1, ranges]]) => ranges.map(item =>
  [item[0].length, [parseFloat("0." + item[0]), parseFloat("0." + item[1])]]
));

/** 
  * searches the groupname for an isbn, works with both isbn 13 and 10 
  * returns undefined if no match found
  *
  * @param {string} isbn ISBN-13 or ISBN-10
  * @returns {string|undefined} group name
  */
export function searchIsbn(isbn) {
  const item = getPrefix(isbn);
  if (item == undefined) return undefined;
  return item.name;
}

/** 
  * adds hyphens to an isbn in the correct locations
  * returns original string if no match found
  *
  * @param {string} isbn ISBN-13 or ISBN-10
  * @returns {string} hyphenated or original isbn
  */
export function hyphenate(isbn) {
  const item = getPrefix(isbn);
  if (item == undefined) return isbn;
  isbn = isbn.replaceAll("-", ""); // remove dashes

  let parts = [];
  // prefix
  if (!item.is10) {
    parts.push(item.prefix.slice(0, 3));
  }
  // group
  parts.push(item.prefix.slice(3))

  // get the rest of the isbn without the prefix, if it was a isbn10 then ignore the 3 long prefix
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
  * @param {string} isbn
  * @returns {{prefix:string, name: string, is10: bool, idx: number}|undefined}
  */
function getPrefix(isbn) {
  isbn = isbn.replaceAll("-", ""); // remove dashes
  if (isbn.length !== 13 && isbn.length !== 10) {
    throw new Error("Unsupported isbn");
  }
  let is10 = false;
  if (isbn.length === 10) {
    is10 = true;
    isbn = "978" + isbn;
  }
  // only isbn 13 from here

  // find the index of the first float bigger then it
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

  // make sure the right isbn was matched
  const item = compareList[idx];
  for (let i = 0; i < item[0].length; i++) {
    if (item[0][i] !== isbn[i]) {
      // mismatch found
      return undefined;
    }
  }
  return { name: item[1], prefix: item[0], is10, idx };
}
