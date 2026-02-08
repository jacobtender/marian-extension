import xml2js from "xml2js";
import fs from "fs/promises";

const parseString = (str) => new Promise((resolve, reject) =>
  xml2js.parseString(str, (err, result) => err != null ? reject(err) : resolve(result))
);

// Get the Range Message xml file from https://www.isbn-international.org/range_file_generation
async function getFileUrl() {
  const domain = 'https://www.isbn-international.org';

  const resp = await fetch(`${domain}/bl_proxy/GetRangeInformations`, {
    method: 'POST',
    body: new URLSearchParams({
      format: 1,
      language: 'en',
      translatedTexts: 'Printed;Last Change'
    })
  });
  const json = await resp.json();
  if (json["status"] !== "success") {
    console.error("Error generating url", json["messages"]);
    throw new Error("Couldn't make url");
  }

  const { filename, value } = json.result;
  return `${domain}/download_range/${value}/${filename}`;
}

/** @param {{[prefix:string]: {name:string, ranges: [string,string][]}}} object */
function stringify(object) {
  let output = "{\n";
  const entries = Object.entries(object);
  entries.forEach(([key, value], i) => {
    output += `  "${key}": ["${value.name}", [`;
    value.ranges.forEach((range, j) => {
      output += `["${range[0]}", "${range[1]}"]`
      if (j !== value.ranges.length - 1) {
        output += ", ";
      }
    });
    output += "]]";
    if (i !== entries.length - 1) {
      output += ",";
    }
    output += "\n";

  });
  output += "}";
  return output;
}

// ----

const filepath =
  null;
//  "./RangeMessage.xml";

let start;
if (filepath) {
  start = fs.readFile(filepath, "utf8");
} else {
  start = getFileUrl()
    .then(fetch)
    .then(resp => resp.text())
    .catch(console.error)
}

start
  .then(parseString)
  .then(json => json["ISBNRangeMessage"]["RegistrationGroups"][0]["Group"]) // get groups
  .then(groups => groups.map(group => ({
    [group["Prefix"][0]]: {
      name: group["Agency"][0], ranges: group["Rules"][0]["Rule"].map(rule => {
        const length = parseInt(rule["Length"][0]);
        if (length === 0) return [];
        return rule["Range"][0].split("-").map(i => i.substring(0, length))
      }).filter(rule => rule.length != 0)
    }
  }))) // get a list of maps of prefix to group name
  .then(groups => groups.reduce((acc, obj) => ({ ...acc, ...obj }), {})) // flatten it
  .then(stringify)
  .then(str => fs.writeFile("./src/shared/groups.json", str))
  .catch(console.error);

