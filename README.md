<img src="src/icons/icon-full.png" alt="Marian the Librarian icon" width="160" />

## Marian the Librarian
[![Latest Release](https://img.shields.io/github/v/release/jacobtender/marian-extension?color=16a34a&label=Latest%20Release)](https://github.com/jacobtender/marian-extension/releases/latest)
[![Install in Chrome](https://img.shields.io/badge/Chrome%20Web%20Store-Install-blue?logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/marian-the-librarian/gpnkkkbefalodcjhgafioibknoingann)
[![Install in Firefox](https://img.shields.io/badge/Firefox%20Add--ons-Install-orange?logo=firefox&logoColor=white)](https://addons.mozilla.org/firefox/addon/marian-the-librarian/)
[![Contributors](https://img.shields.io/github/contributors/jacobtender/marian-extension?color=8b5cf6&logo=github)](https://github.com/jacobtender/marian-extension/graphs/contributors)

Marian the Librarian helps [Hardcover.app](https://hardcover.app/join?referrer_id=8753) contributors and other online book data enthusiasts view and capture book metadata from popular retail and catalog sites. With a single click, the sidebar pulls down titles, contributors, identifiers, descriptions, cover art, and more so you can manage clean data without endlessly scrolling, copying, and pasting.

### Supported Sites
Book pages on these sites are currently supported by Marian. To request support for another site, [create an issue](https://github.com/jacobtender/marian-extension/issues/new?template=site-support-request.md) or submit a pull request.

<details open>
<summary>List of supported sites</summary>

#### Retailers

- AbeBooks (ZVAB, IberLibro)
- Amazon
- Audible
- Barnes & Noble
- Books-A-Million
- Bookshop.org
- IndieBookstores.ca
- Libro.fm
- Rakuten Kobo

#### Online Trackers & Social

- Anilist
- Anime-Planet
- Goodreads
- Kitsu
- LibraryThing
- MangaDex
- MangaUpdates
- MyAnimeList
- Novel Updates
- Romance.io
- The StoryGraph

#### Libraries & Borrowing

- German National Library
- Libby
- OverDrive
- WorldCat

#### Reference & Metadata

- ISBN Search
- ISBN.de
- ISBNdb
- The Internet Speculative Fiction Database (ISFDB)
- TeachingBooks
- inventaire

#### Publishers

- Penguin Random House
- Tor Publishing Group

#### Digital Archives & Search Engines

- Classic Google Books
- Google Books
- Open Library

#### Self Publishing

- Archive of Our Own (AO3)
- FanFiction.net
- Royal Road
- Scribble Hub
- Spacebattles
- Wattpad

</details>

## Creating an extractor

Creating an extractor requires adding any URL's the extractor has to support to the 
[manifest.base.json](./src/manifest.base.json) file, and then create an extractor that goes into the [extractors](./src/extractors/) folder.

Refer to the [extractors README](./src/extractors/README.md) 
for more info on what a extractor consists of and requires

## Building from Source

This project supports building browser extension packages for both **Chrome (Manifest V3)** and **Firefox (Manifest V2)**.

### Prerequisites

* [Node.js](https://nodejs.org/) (LTS recommended)
* npm (comes with Node.js)

To verify installation:

```bash
node -v
npm -v
```

---

### Install Dependencies

From the root directory:

```bash
npm install
```

*Note: If there are no dependencies listed in `package.json`, this step is optional.*

---

### Build the Extension

To build the extension for both browsers:

```bash
npm install
npm run build
```

This script:

* Copies all files from `app/` into the `distro/` directory
* Applies the correct manifest version for each browser:

  * Chrome → `distro/chrome/manifest.json` (uses `manifest.base.json` and `manifest.chrome.json`)
  * Firefox → `distro/firefox/manifest.json` (uses `manifest.base.json` and `manifest.firefox.json`)

---

### Load the Extension

#### Option 1: From Source

> ⚠️ Extensions loaded this way are not auto-updated. You will need to repeat the steps for future versions.
>
> ⚠️ **Disclaimer:** Unpacked Chrome extensions loaded via "Developer Mode" will remain active across browser restarts, but Chrome may display a warning banner each time. These extensions are intended for development and testing purposes only.  
>
> In Firefox, temporary add-ons loaded through `about:debugging` will be deactivated when the browser is closed. To persist an extension in Firefox, it must be signed and installed as a `.xpi` file which is not yet available.
>

**Chrome**:

1. Navigate to `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `distro/chrome/` folder

**Firefox**:

1. Navigate to `about:debugging`
2. Click **This Firefox**
3. Click **Load Temporary Add-on**
4. Select the `distro/firefox/manifest.json` file

---

#### Option 2: From Prebuilt ZIP (Recommended for Testing)

You can also download prebuilt versions from the [latest GitHub Release](https://github.com/jacobtender/marian-extension/releases/latest). Look for files named:

* `<repo>-chrome.<version>.zip`
* `<repo>-firefox.<version>.zip`

**Steps**:

1. Download and extract the `.zip` file for your browser.
2. Follow the same steps as **Option 1**, but select the extracted folder instead of `distro/`.

#### Option 3: From GitHub Actions (Latest Development Builds)

To test the absolute latest changes before they are released:

1. Go to the [Actions tab](https://github.com/jacobtender/marian-extension/actions) in the repository.
2. Click on the latest workflow run (usually named "Build and Release").
3. Scroll down to the **Artifacts** section.
4. Download the artifact starting with `marian-extension-chrome.(VERSION)` or `marian-extension-firefox.(VERSION)`.
5. To use either: 
 - Extract the zip file to a folder and follow **Option 1**, selecting the extracted folder.
 - Use directly
   - **On Chrome:** Enable Developer mode and drag the zip file onto the window (if you just enabled it refresh first)
   - **On Firefox:** Go to Debugging Add-ons ([about:debugging#/runtime/this-firefox](about:debugging#/runtime/this-firefox)) and click Load Temporary Add-on and select the zip file

### Updating the groups json file

In the event where a new group is registered, the [groups.json](./src/shared/groups.json) file can be updating by running

```bash
npm run update-groups
```
