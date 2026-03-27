import { getHardcoverEditTarget } from "../shared/hardcover";

function normalizeSpace(value) {
  return (value || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function getControlLabelText(control) {
  const fragments = new Set();
  const directLabel = control.closest("label");
  if (directLabel) fragments.add(directLabel.textContent || "");

  const id = control.id;
  if (id) {
    document.querySelectorAll(`label[for="${CSS.escape(id)}"]`).forEach((label) => {
      fragments.add(label.textContent || "");
    });
  }

  const labelledBy = control.getAttribute("aria-labelledby");
  if (labelledBy) {
    labelledBy.split(/\s+/).forEach((labelId) => {
      const label = document.getElementById(labelId);
      if (label) fragments.add(label.textContent || "");
    });
  }

  return normalizeSpace(Array.from(fragments).join(" "));
}

function getControlSearchText(control) {
  const parts = [
    getControlLabelText(control),
    control.getAttribute("aria-label") || "",
    control.getAttribute("placeholder") || "",
    control.getAttribute("name") || "",
    control.id || ""
  ];

  return normalizeSpace(parts.join(" "));
}

function matchesControl(control, keywords, exclusions = []) {
  const searchText = getControlSearchText(control);
  if (!searchText) return false;
  return keywords.some((keyword) => searchText.includes(keyword))
    && exclusions.every((keyword) => !searchText.includes(keyword));
}

function setControlValue(control, value) {
  const nextValue = String(value ?? "");
  const prototype = control instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");

  if (descriptor?.set) {
    descriptor.set.call(control, nextValue);
  } else {
    control.value = nextValue;
  }

  control.dispatchEvent(new Event("input", { bubbles: true }));
  control.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

function setSelectValue(control, desiredValue) {
  const normalizedDesired = normalizeSpace(desiredValue);
  const matchingOption = Array.from(control.options).find((option) => {
    const optionValue = normalizeSpace(option.value);
    const optionText = normalizeSpace(option.textContent || "");
    return optionValue === normalizedDesired || optionText === normalizedDesired;
  });

  if (!matchingOption) return false;

  control.value = matchingOption.value;
  control.dispatchEvent(new Event("input", { bubbles: true }));
  control.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

function findAvailableControl(field, usedControls) {
  const controls = Array.from(document.querySelectorAll("input, textarea, select"))
    .filter((control) => !control.disabled && control.type !== "hidden");

  return controls.find((control) => {
    if (usedControls.has(control)) return false;

    if (field.elementTypes && !field.elementTypes.includes(control.tagName.toLowerCase())) {
      return false;
    }

    if (field.inputTypes && control.tagName.toLowerCase() === "input") {
      const type = (control.getAttribute("type") || "text").toLowerCase();
      if (!field.inputTypes.includes(type)) return false;
    }

    return matchesControl(control, field.keywords, field.exclusions);
  }) || null;
}

function fillField(field, details, report, usedControls) {
  const value = typeof field.value === "function" ? field.value(details) : details[field.value];
  if (value == null || value === "") return;

  const control = findAvailableControl(field, usedControls);
  if (!control) {
    report.missing.push(field.label);
    return;
  }

  const tagName = control.tagName.toLowerCase();
  const success = tagName === "select"
    ? setSelectValue(control, value)
    : setControlValue(control, value);

  if (success) {
    usedControls.add(control);
    report.filled.push(field.label);
  } else {
    report.missing.push(field.label);
  }
}

function getContributorsByRole(details, role) {
  return (details.Contributors || [])
    .filter((contributor) => contributor.roles?.includes(role))
    .map((contributor) => contributor.name)
    .join(", ");
}

function getBookFields() {
  return [
    { label: "Title", value: "Title", keywords: ["title"] },
    { label: "Description", value: "Description", keywords: ["description", "blurb"], elementTypes: ["textarea"] },
    { label: "Series", value: "Series", keywords: ["series"], exclusions: ["position", "number"] },
    { label: "Series Place", value: "Series Place", keywords: ["series position", "series number", "position in series", "volume number"] },
    { label: "Authors", value: (details) => getContributorsByRole(details, "Author"), keywords: ["author", "authors", "writer"] }
  ];
}

function getEditionFields() {
  return [
    { label: "ISBN-13", value: "ISBN-13", keywords: ["isbn 13", "isbn-13", "ean", "isbn"] },
    { label: "ISBN-10", value: "ISBN-10", keywords: ["isbn 10", "isbn-10"] },
    { label: "ASIN", value: "ASIN", keywords: ["asin"] },
    { label: "Publisher", value: "Publisher", keywords: ["publisher", "imprint"] },
    { label: "Publication date", value: "Publication date", keywords: ["publication date", "published"], inputTypes: ["text", "date"] },
    { label: "Pages", value: "Pages", keywords: ["pages", "page count"], inputTypes: ["text", "number"] },
    { label: "Edition Format", value: "Edition Format", keywords: ["edition format", "format", "binding"] },
    { label: "Edition Information", value: "Edition Information", keywords: ["edition information", "edition note", "edition details"] },
    { label: "Language", value: "Language", keywords: ["language"] },
    { label: "Country", value: "Country", keywords: ["country"] }
  ];
}

/**
 * @param {Record<string, any>} details
 * @returns {{target: "book" | "edition", filled: string[], missing: string[]}}
 */
export function fillHardcoverForm(details) {
  const target = getHardcoverEditTarget(window.location.href);
  if (!target) {
    throw new Error("This is not a supported Hardcover edit page.");
  }

  const report = { target, filled: [], missing: [] };
  const fields = target === "book" ? getBookFields() : getEditionFields();
  const usedControls = new Set();

  fields.forEach((field) => fillField(field, details, report, usedControls));

  if (report.filled.length === 0) {
    throw new Error(`No matching ${target} form fields were found on this page.`);
  }

  return report;
}
