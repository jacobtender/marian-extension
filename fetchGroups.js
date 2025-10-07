const xml2js = require("xml2js");
const fs = require("fs/promises");

const parseString = (str) => new Promise((resolve, reject) => xml2js.parseString(str, (err, result) => err != null ? reject(err) : resolve(result)));

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
    throw "Couldn't make url";
  }

  const { filename, value } = json.result;
  return `${domain}/download_range/${value}/${filename}`;
}

const filepath = ""; // "./RangeMessage.xml";

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
  .then(groups => groups.map(group => ({ [group["Prefix"][0]]: group["Agency"][0] }))) // get a list of maps of prefix to group name
  .then(groups => groups.reduce((acc, obj) => ({ ...acc, ...obj }), {})) // flatten it
  .then(list => JSON.stringify(list, undefined, 2))
  .then(str => fs.writeFile("./src/shared/groups.json", str))
  .catch(console.error);

