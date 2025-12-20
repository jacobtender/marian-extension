# Creating an extractor

A basic extractor consists of a class that extends the `Extractor` class and implements
the `_name` and `getDetails` functions as well as filling in a list of supported URLs,
as regexes, in the `_sitePatterns` list.

You can define more than one extractor in a file, the extractors have to be exported,
they will then be picked up by the build system when you run `npm run build` and
the [index.js](./index.js) will be updated with all the extractors.

## Example

This is the minimal extractor

```javascript
import { Extractor } from "./AbstractExtractor.js"

// Name of extractor, has to be unique
class extractorNameScraper extends Extractor {
  // Common name of extractor, used for logs and for persistent storage
  get _name() { return "extractor name"; }

  // List of regexes for supported pages
  _sitePatterns = [
    /https?:\/\/(?:www\.)?example\.com\/book\/(.+)/
  ];

  async getDetails() {
    // Extraction function, implement logic here
    // runs on webpage that the info is to be extracted from
    return {};
  }

  // optional -- everything below this point does not have to be present in an extractor

  // Boolean for whether to reload the page before scraping
  needsReload = true;

  // if you need to implement custom logic for if the page is supported,
  // beyond just checking against the regexes, you can implement this function
  isSupported(url) {
    return super.isSupported(url);
  }

  // if your extractor needs to save some persistent data.
  // you can use the `this._saveState` function to save the state
  // the `_handleStateUpdate` function you will get updates when the state is changed
  _handleStateUpdate(state) {
  }
}

export { extractorNameScraper };
```

## Creating a regex

A good resource for creating a regex for the `_sitePatterns` is the site
[regex101.com](https://regex101.com/).
You can put in a few URLs that you want to have matched in the big text box,
it will then guide you on what is correct
or incorrect syntax as well as highlight what matched.

## Details

The `getDetails` function operates on the currently open page and returns an object with the fields listed below,
if you don't have some of them they can be left out and they will be omitted from display (or a fallback will be used).

You can fill in extra custom fields if you have more data you want to show, and it will also be displayed for the user.

|         Name          | Type                              | Description |
|:---------------------:|:----------------------------------|-------------|
|        `Title`        | String                            | The title of the book |
|     `Description`     | String                            | The description of the book |
|       `Series`        | String                            | The name of the series a book is a part of |
|    `Series Place`     | String\|Number                    | The location/number of a book in a series |
|         `img`         | Url\|String                       | A URL to the image resource, in most cases you will not need to fill in this field and you can instead use the [`getCoverData`](#getcoverdata) function |
|      `imgScore`       | Number                            | The score of the image, same as above in most cases you will use the [`getCoverData`](#getcoverdata) function.<br>but if you need to fill it manually you can use the [`getImageScore`](#getimagescore) function to calculate it from a URL |
|       `ISBN-10`       | String                            | The ISBN-10 of a book |
|       `ISBN-13`       | String                            | The ISBN-13 of a book |
|        `ASIN`         | String                            | The ASIN id of a book |
|      `Mappings`       | {[sourceName: String]: String[]}  | An object containing the names of the sources pointing to a list of ID's, can be used to show the books ID if there is a unique one for the website (e.g. goodreads) |
|    `Contributors`     | {name: String, roles: String[]}[] | A list of objects containing who contributed to the creation of a book (author, narrator, editor, etc.).<br> in most cases you can use the [`addContributor`](#addcontributor) function to create the object and fill in the list |
|      `Publisher`      | String                            | The name of the publisher |
|   `Reading Format`    | String                            | The format of the media, `Physical book`, `Ebook`, `Audiobook`. in most cases you can call the [`normalizeReadingFormat`](#normalizereadingformat) function on the `Edition Format` to fill this in |
|  `Listening Length`   | String[]                          | For audiobooks, in the format of ["xxx hours", "xxx minutes"] |
|        `Pages`        | String\|Number                    | The number of pages a book has |
|   `Edition Format`    | String                            | The edition format of the edition (Kindle, Paperback, Hardcover, Audible, E-pub, etc.) |
| `Edition Information` | String                            | Extra information about the edition (Reprint, Large Text, 2nd Edition, Unabridged, etc.) |
|  `Publication date`   | String\|Date                      | The date that this edition was published |
|      `Language`       | String                            | The language that the edition is written in |
|       `Country`       | String                            | The country that the edition was published in |

## Optional Overrides

The `Extractor` base class provides some default behavior that you can override if needed.

### needsReload

The `needsReload` property defaults to `true`. Set this to `false`
if the extractor does not require the page to be reloaded before extraction
(e.g., if it can reliably work with the current DOM state regardless of how the user arrived there).

### isSupported(url)

The default `isSupported` implementation checks the URL against the `_sitePatterns` regexes.
You can override this function to provide custom logic for determining if a URL is supported.

But it is best to fallback to calling `super.isSupported` if your custom logic does not handle some cases.

### Persistent state

These methods are used for persistent state management.
`_saveState(state)` saves the current state to browser storage,
and `_handleStateUpdate(state)` is called when the state is updated
(either from storage initialization or changes).

## Best practices

When writing an extractor it is best to have as few delays as possible,
and when they are required, try to put it in a promise and extract something else at the same time.
To that effect the [`collectObject`](#collectobject) is very useful
as it allows you to await multiple promises of objects and join them into a single object.

## Utility functions

There are some util functions that you can use to make it easier to implement an extractor

You can find them in [utils.js](../shared/utils.js).

### collectObject

Takes in a list of objects, promises of objects or null/undefined.
it will await all promises at the same time and then merge them into a single object,
if a key is present in more than one object it will be overwritten, by order of the list.

### getCoverData

Takes in a URL, or a list of URLs and returns an
object with `img` and `imgScore` of the URL with the best score.

### addContributor

Takes in a list and an author name as well as a role (or list of roles).
If a name is already present then the role will be appended to it.

Example:
```javascript
let contributors = [];
addContributor(contributors, "A", "Author");
addContributor(contributors, "B", ["Editor", "Illustrator"]);
addContributor(contributors, "A", "Narrator");
```

### normalizeReadingFormat

Takes in a string and returns one of `Audiobook`, `Ebook`, `Physical Book`

### logMarian

Does a `console.log` but prepends `[👩🏻‍🏫 Marian]` to the start,
if more than one argument was passed then it will log it in a `console.group`

### delay

Takes a duration in milliseconds and returns a promise

### cleanText

Takes in a string and cleans it up

* normalizes unicode to be NFKC
* remove unicode control characters
* replace invisible characters and bidi characters with space(s)
* remove leading commas
* replace repeating whitespace to be at most 1 space
* trims spaces from beginning and end

### withTimeout

Takes in a promise, a timeout duration and a default object.
If the promise does not resolve within the timeout duration
it will fallback to using the default object. Returns a promise

### getFormattedText

Takes in a HTMLElement, extracts the text content of an element
that has a lot of paragraphs and specified newlines.

Useful for extracting descriptions.

### remapKeys

Takes in an object with string to string mappings as well as an object to act on.
It will return a new object that replaces the keys of the provided object with the new values

### getImageScore

Given a url it will return a promise to a calculated score based on the dimensions of the image. 

### clearDeepQueryCache

Clears the internal cache used by [`queryDeep`](#querydeep) and [`queryAllDeep`](#queryalldeep).
It is recommended to call this at the beginning of `getDetails` to ensure you don't get cached results from a previous run or page state.

### queryAllDeep

Performs a deep DOM query that traverses into the shadow roots of the provided host selectors.
This is useful for sites that heavily rely on Web Components and Shadow DOM (like Audible).

Takes in a `selector` string and an optional `hostSelectors` array of strings.
It searches for the `selector` in the main document, and recursively inside the shadow roots of any elements matching `hostSelectors`.
Returns an array of unique matching Elements.

Example:
```javascript
// Search for .price inside the document and inside <product-card> shadow roots
const prices = queryAllDeep('.price', ['product-card']);
```

### queryDeep

Same as [`queryAllDeep`](#queryalldeep) but returns only the first matching element,
or `null` if none found.

Example:
```javascript
const title = queryDeep('h1', ['product-header']);
```

### runtime

Exports the `browser.runtime` (Firefox) or `chrome.runtime` (Chrome) API,
providing a cross-browser way to access runtime methods.

