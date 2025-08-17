import { getImageScore, logMarian, delay } from "../shared/utils.js";

async function getLibroDetails() {
	logMarian("Extracting Libro details");
	const bookDetails = {};

	const imggrab = document.querySelector('.audiobook-cover .book-cover-wrap img.book-cover');
	bookDetails["img"] = imggrab?.src;
	bookDetails["imgScore"] = imggrab?.src ? await getImageScore(imggrab.src) : 0;

	// Title
	getLibroBookTitle(bookDetails);

	// Series name and number
	getLibroSeries(bookDetails);

	// Contributors
	extractLibroContributors(bookDetails);

	//get format and length
	getLibroFormatInfo(bookDetails, window.location.href)

	// get extra block of info - isbn, language, etc.
	extraLibroInfo(bookDetails);

	// Description
	extractLibroDescription(bookDetails);

	logMarian("Libro extraction complete:", bookDetails);
	return {
		...bookDetails,
	};

}

function extractLibroContributors(bookDetails) {
	const contributions = {}

	const section = extractSection('audiobook details')
	const authors = section.querySelectorAll('span[itemprop="author"] a')
	authors.forEach(author => {
		const name = author.textContent.trim()
		if (!(name in contributions)) {
			contributions[name] = []
		}
		contributions[name].push("Author")
	})

	const narrators = section.querySelectorAll('a[href$="searchby=narrators"]')
	narrators.forEach(narrator => {
		const name = narrator.textContent.trim()
		if (!(name in contributions)) {
			contributions[name] = []
		}
		contributions[name].push("Narrator")
	})

	let contributors = []
	for (let [name, roles] of Object.entries(contributions)) {
		contributors.push({ name, roles })
	}
	if (contributors.length) {
		bookDetails["Contributors"] = contributors;
	}
}

function getLibroSeries(bookDetails) {
	const seriesName = document.querySelector('.audiobook-title__series a');
	if (seriesName) {
		let name = seriesName.textContent.trim();
		bookDetails['Series'] = name;
		let seriesPlace = extractTextNode(document.querySelector('.audiobook-title__series'));
		let number = seriesPlace.match(/\d+/);
		if (number) {
			bookDetails['Series Place'] = number[0];
		}
	}
}

function getLibroBookTitle(bookDetails) {
	const h1 = document.querySelector('h1.audiobook-title');
	const rawTitle = h1?.childNodes[0]?.textContent.trim();
	rawTitle ? bookDetails["Title"] = rawTitle : null;
}

function joinContent(elements) {
	return Array.from(elements)
		// libro.fm uses <br> tags instead of <p> tags for paragraphs, so have to use innerText
		.map(item => item.innerText.trim())
		// split by newlines so that everything isn't on one line
		.flatMap(item => item.split('\n'))
		// strip out empty lines (there are some random empty <p> tags)
		.filter(item => item.length > 0)
		.join("\n");
}

function extractTextNode(element) {
	return Array.from(element?.childNodes || [])
		.filter(n => n.nodeType == Node.TEXT_NODE)
		.map(n => n.textContent.trim())
		.join("\n")
		.trim();
}

function extractSection(title) {
	const sections = document.querySelectorAll('section')
	return Array.from(sections)
		.find(section => section.querySelector('h2')?.textContent.trim().toLowerCase() == title)
}

function getLibroFormatInfo(bookDetails) {
	bookDetails['Reading Format'] = 'Audiobook';
	const informationSections = document.querySelectorAll(".audiobook-information .audiobook-information__section");

	const audioLength = extractTextNode(
		Array.from(informationSections)
			.find(section => section.querySelector("strong")?.textContent.trim().toLowerCase() == 'length')
	);

	// split the length by number boundary
	const lengthParts = audioLength.split(/ (?=\d+)/);

	bookDetails['Listening Length'] = lengthParts;

}

function extractLibroDescription(bookDetails) {
	const summaryEl = extractSection('summary');
	// if there is a tab for more information about the authors, it's a different element
	const summaryTabEl = document.querySelector('#panel_summary')
	const element = summaryEl || summaryTabEl;
	if (element) {
		const summary = joinContent(element.querySelectorAll('p'))
		bookDetails["Description"] = summary;
	}
}


function extraLibroInfo(bookDetails) {
	const section = extractSection('audiobook details')
	const publisher = section.querySelector('span[itemprop="publisher"]')
	if (publisher) {
		bookDetails['Publisher'] = publisher.textContent.trim();
	}
	const releaseDate = section.querySelector('span[itemprop="datePublished"]')
	if (releaseDate) {
		bookDetails['Publication date'] = releaseDate.textContent.trim();
	}
	const language = section.querySelector('span[itemprop="inLanguage"]')
	if (language) {
		bookDetails['Language'] = language.textContent.trim();
	}
	const isbn = section.querySelector('span[itemprop="isbn"]')
	if (isbn) {
		const isbnText = isbn.textContent.trim()
		if (isbnText.length == 13) {
			bookDetails['ISBN-13'] = isbnText;
		} else if (isbn.length == 10) {
			bookDetails['ISBN-10'] = isbnText;
		}
	}

	// no nice itemprop attribute for edition type :(
	const cells = section.querySelectorAll('.cell')
	// try to find the relevant cell with the 'Edition' header
	const editionCell = Array.from(cells)
		.find(cell => cell.querySelector('strong')?.textContent.trim().toLowerCase() == 'edition');
	if (editionCell) {
		let editionFormat = editionCell.querySelector('span')?.textContent.trim()
		bookDetails['Edition Format'] = editionFormat;
	}
}

export { getLibroDetails };
