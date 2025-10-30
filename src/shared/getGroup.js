import groups from "./groups.json"

let compareList = Object.entries(groups)
const searchList = compareList.map(item => parseFloat(item[0].replace("-", "."))); // search representation
compareList = compareList.map(item => [item[0].replace("-", ""), item[1]]); // tuple compare representation

/** 
  * searches the groupname for an isbn, works with both isbn 13 and 10 
  * returns undefined if no match found
  *
  * @param {string} isbn ISBN-13 or ISBN-10
  * @returns {string|undefined} group name
  */
export function searchIsbn(isbn) {
  isbn = isbn.replaceAll("-", ""); // remove dashes
  if (isbn.length !== 13 && isbn.length !== 10) {
    throw "Unsupported isbn";
  }
  if (isbn.length === 10) {
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
  return item[1];
}
