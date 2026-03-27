import { getHardcoverEditTarget } from "../shared/hardcover";

const DEBUG_FIELDS = false;
const DEBUG_PUBLISHER = true;
const DEBUG_COVER = true;

function normalizeSpace(value) {
  return (value || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function debugField(fieldLabel, message, extra) {
  if (
    !DEBUG_FIELDS
    && !(DEBUG_PUBLISHER && fieldLabel === "Publisher")
    && !(DEBUG_COVER && fieldLabel === "Cover")
  ) return;
  if (extra === undefined) {
    console.log(`[Marian fill][${fieldLabel}] ${message}`);
    return;
  }
  console.log(`[Marian fill][${fieldLabel}] ${message}`, extra);
}

function setNativeInputValue(control, nextValue) {
  const prototype = control instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");

  if (descriptor?.set) {
    descriptor.set.call(control, nextValue);
  } else {
    control.value = nextValue;
  }
}

async function fetchImageAsUploadFile(url) {
  debugField("Cover", "fetching image", { url });
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch cover image: ${response.status}`);
  }

  const blob = await response.blob();
  const type = blob.type.toLowerCase();
  debugField("Cover", "fetched image", { type, size: blob.size });

  if (type === "image/jpeg" || type === "image/jpg" || type === "image/png") {
    const extension = type.includes("png") ? "png" : "jpg";
    return new File([blob], `cover.${extension}`, { type });
  }

  if (typeof createImageBitmap !== "function") {
    throw new Error(`Unsupported cover format: ${type || "unknown"}`);
  }

  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Failed to prepare cover conversion canvas.");
  }

  context.drawImage(bitmap, 0, 0);

  const convertedBlob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!convertedBlob) {
    throw new Error("Failed to convert cover image.");
  }

  return new File([convertedBlob], "cover.png", { type: "image/png" });
}

async function fillCover(details, field) {
  const coverUrl = details.img;
  if (!coverUrl) return false;

  const section = findSectionByLabelText(field.sectionLabel);
  debugField("Cover", "resolved section", { found: !!section, coverUrl });
  if (!section) return false;

  const pickerButton = section.querySelector('button[aria-haspopup="listbox"]');
  debugField("Cover", "picker button", { found: !!pickerButton });
  if (pickerButton && isInteractableElement(pickerButton)) {
    triggerPointerClick(pickerButton);
    await wait(150);
  }

  const uploadOption = Array.from(document.querySelectorAll('[role="option"]')).find((option) =>
    normalizeSpace(option.textContent || "").includes("upload a new cover")
  );
  debugField("Cover", "upload option", { found: !!uploadOption });
  if (uploadOption) {
    triggerPointerClick(uploadOption);
    await wait(150);
  }

  await waitFor(() => !!document.querySelector(field.selector), 1500, 75);
  const fileInput = document.querySelector(field.selector);
  debugField("Cover", "file input", { found: !!fileInput, id: fileInput?.id || null });
  if (!fileInput) return false;

  const file = await fetchImageAsUploadFile(coverUrl);
  const transfer = new DataTransfer();
  transfer.items.add(file);
  fileInput.files = transfer.files;
  debugField("Cover", "assigned file", {
    fileName: file.name,
    fileType: file.type,
    fileSize: file.size,
    fileCount: fileInput.files?.length || 0
  });
  fileInput.dispatchEvent(new Event("input", { bubbles: true }));
  fileInput.dispatchEvent(new Event("change", { bubbles: true }));
  await wait(200);
  debugField("Cover", "post change", { fileCount: fileInput.files?.length || 0 });
  return true;
}

function wait(ms = 75) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function triggerPointerClick(element) {
  const eventInit = { bubbles: true, cancelable: true, view: window };
  element.dispatchEvent(new MouseEvent("pointerdown", eventInit));
  element.dispatchEvent(new MouseEvent("mousedown", eventInit));
  element.dispatchEvent(new MouseEvent("pointerup", eventInit));
  element.dispatchEvent(new MouseEvent("mouseup", eventInit));
  element.click();
}

function triggerKeyboardEvent(element, key) {
  const eventInit = { key, bubbles: true, cancelable: true };
  element.dispatchEvent(new KeyboardEvent("keydown", eventInit));
  element.dispatchEvent(new KeyboardEvent("keyup", eventInit));
}

async function typeIntoControl(control, value, delayMs = 35) {
  control.focus();
  setNativeInputValue(control, "");
  control.dispatchEvent(new InputEvent("input", {
    bubbles: true,
    inputType: "deleteContentBackward",
    data: null
  }));
  control.dispatchEvent(new Event("change", { bubbles: true }));
  await wait(delayMs);

  let currentValue = "";
  for (const char of String(value ?? "")) {
    currentValue += char;
    control.dispatchEvent(new KeyboardEvent("keydown", { key: char, bubbles: true, cancelable: true }));
    control.dispatchEvent(new KeyboardEvent("keypress", { key: char, bubbles: true, cancelable: true }));
    control.dispatchEvent(new InputEvent("beforeinput", {
      bubbles: true,
      cancelable: true,
      inputType: "insertText",
      data: char
    }));
    setNativeInputValue(control, currentValue);
    control.dispatchEvent(new InputEvent("input", {
      bubbles: true,
      inputType: "insertText",
      data: char
    }));
    control.dispatchEvent(new KeyboardEvent("keyup", { key: char, bubbles: true, cancelable: true }));
    await wait(delayMs);
  }

  control.dispatchEvent(new Event("change", { bubbles: true }));
}

function getOptionPrimaryText(option) {
  const candidates = [
    option.querySelector('.font-semibold .ais-Highlight'),
    option.querySelector('.font-semibold'),
    option.querySelector('.ais-Highlight'),
    option.querySelector('span'),
    option
  ].filter(Boolean);

  for (const candidate of candidates) {
    const text = normalizeSpace(candidate.textContent || "");
    if (!text) continue;

    const cleaned = text
      .replace(/\b\d[\d,]*\s+editions?\b/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (cleaned) return cleaned;
  }

  return "";
}

function getOptionPrimaryDisplayText(option) {
  const candidates = [
    option.querySelector('.font-semibold .ais-Highlight'),
    option.querySelector('.font-semibold'),
    option.querySelector('.ais-Highlight'),
    option.querySelector('span'),
    option
  ].filter(Boolean);

  for (const candidate of candidates) {
    const text = (candidate.textContent || "")
      .replace(/\b\d[\d,]*\s+editions?\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();

    if (text) return text;
  }

  return "";
}

function formatDateForInput(value) {
  if (!value) return "";

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    const [, month, day, year] = match;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  return raw;
}

function getNormalizedControlValue(control) {
  if (control.getAttribute("type") === "date") {
    return formatDateForInput(control.value);
  }

  return String(control.value ?? "").trim();
}

function findSectionByLabelText(labelText) {
  const normalizedLabel = normalizeSpace(labelText);
  const labels = Array.from(document.querySelectorAll("label"));
  const match = labels.find((label) => normalizeSpace(label.textContent || "") === normalizedLabel);
  if (!match) return null;

  let current = match.parentElement;
  while (current) {
    if (
      current.classList?.contains("border-t")
      || current.classList?.contains("md:border")
    ) {
      return current;
    }
    current = current.parentElement;
  }

  return match.parentElement || null;
}

function findButtonByText(root, buttonText) {
  const normalizedText = normalizeSpace(buttonText);
  return Array.from(root.querySelectorAll("button")).find((button) =>
    normalizeSpace(button.textContent || "") === normalizedText
  ) || null;
}

function isInteractableElement(element) {
  if (!element) return false;
  if (element.disabled) return false;
  if (element.type === "hidden") return false;

  const style = window.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden" || style.pointerEvents === "none") {
    return false;
  }

  if (element.getAttribute("aria-hidden") === "true") return false;
  if (element.closest("[aria-hidden='true'], [inert]")) return false;

  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function waitFor(predicate, timeoutMs = 1500, intervalMs = 50) {
  return new Promise((resolve) => {
    const start = Date.now();

    function check() {
      if (predicate()) {
        resolve(true);
        return;
      }

      if (Date.now() - start >= timeoutMs) {
        resolve(false);
        return;
      }

      setTimeout(check, intervalMs);
    }

    check();
  });
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
  const nextValue = control.getAttribute("type") === "date"
    ? formatDateForInput(value)
    : String(value ?? "");
  control.focus();
  setNativeInputValue(control, nextValue);

  control.dispatchEvent(new InputEvent("beforeinput", {
    bubbles: true,
    cancelable: true,
    inputType: "insertText",
    data: nextValue
  }));
  control.dispatchEvent(new Event("input", { bubbles: true }));
  control.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

async function setControlValueWithRetry(control, value, attempts = 3, fieldLabel = "Control") {
  const expectedValue = control.getAttribute("type") === "date"
    ? formatDateForInput(value)
    : String(value ?? "").trim();

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    debugField(fieldLabel, `write attempt ${attempt + 1}`, {
      expectedValue,
      beforeValue: control.value,
      type: control.getAttribute("type")
    });
    setControlValue(control, value);
    if (control.getAttribute("type") === "number") {
      triggerKeyboardEvent(control, "Enter");
      await wait(20);
      triggerKeyboardEvent(control, "Tab");
      control.blur();
    } else {
      control.dispatchEvent(new Event("blur", { bubbles: true }));
    }
    await wait(60);

    debugField(fieldLabel, `after attempt ${attempt + 1}`, {
      actualValue: control.value,
      normalizedValue: getNormalizedControlValue(control)
    });

    if (getNormalizedControlValue(control) === expectedValue) {
      return true;
    }
  }

  return getNormalizedControlValue(control) === expectedValue;
}

async function setComboboxValue(control, value, field) {
  const nextValue = String(value ?? "");
  debugField(field?.label || "Combobox", "start", {
    value: nextValue,
    controlId: control.id,
    expanded: control.getAttribute("aria-expanded")
  });
  if (document.activeElement instanceof HTMLElement && document.activeElement !== control) {
    document.activeElement.blur();
    await wait(50);
  }
  triggerPointerClick(control);
  control.focus();
  triggerKeyboardEvent(control, "ArrowDown");
  await wait(100);
  await typeIntoControl(control, nextValue, 40);
  await wait(250);

  await waitFor(() => {
    const listboxId = control.getAttribute("aria-controls");
    if (listboxId && document.getElementById(listboxId)) return true;

    return Array.from(document.querySelectorAll('[role="listbox"]')).some((el) =>
      el.id?.startsWith("headlessui-combobox-options-")
      || el.getAttribute("aria-labelledby") === control.id
    );
  }, 2000, 75);

  const listboxId = control.getAttribute("aria-controls");
  const listbox = (listboxId ? document.getElementById(listboxId) : null)
    || Array.from(document.querySelectorAll('[role="listbox"]')).find((el) =>
      el.id?.startsWith("headlessui-combobox-options-")
      || el.getAttribute("aria-labelledby") === control.id
    )
    || null;

  debugField(field?.label || "Combobox", "after typing", {
    expanded: control.getAttribute("aria-expanded"),
    listboxId,
    foundListbox: !!listbox,
    currentValue: control.value
  });

  if (!listbox) return false;

  const normalizedDesired = normalizeSpace(nextValue);
  await waitFor(() => {
    const options = Array.from(listbox.querySelectorAll('[role="option"]'));
    return options.some((option) => {
      const optionText = getOptionPrimaryText(option);
      return optionText === normalizedDesired || optionText.startsWith(normalizedDesired);
    });
  }, 2500, 100);

  const options = Array.from(listbox.querySelectorAll('[role="option"]'));
  const exactDisplayMatch = options.find((option) => getOptionPrimaryDisplayText(option) === nextValue.trim());
  const exactMatch = exactDisplayMatch || options.find((option) => getOptionPrimaryText(option) === normalizedDesired);
  const prefixMatch = options.find((option) => getOptionPrimaryText(option).startsWith(normalizedDesired));
  const match = exactMatch || prefixMatch;

  debugField(field?.label || "Combobox", "options found", {
    count: options.length,
    firstFive: options.slice(0, 5).map((option) => getOptionPrimaryText(option)),
    exactMatch: exactMatch ? getOptionPrimaryText(exactMatch) : null,
    prefixMatch: prefixMatch ? getOptionPrimaryText(prefixMatch) : null
  });

  if (!match) return false;

  control.focus();
  if (field?.comboboxStrategy === "publisher-exact-click" && exactDisplayMatch) {
    triggerPointerClick(exactDisplayMatch);
    await wait(150);
  } else if (field?.comboboxStrategy === "first-option-enter") {
    triggerKeyboardEvent(control, "ArrowDown");
    await wait(30);
    debugField(field?.label || "Combobox", "after ArrowDown", {
      activeDescendant: control.getAttribute("aria-activedescendant"),
      expanded: control.getAttribute("aria-expanded")
    });
  } else if (field?.comboboxStrategy === "matched-option-enter") {
    const optionIndex = Math.max(0, options.indexOf(match));
    for (let i = 0; i <= optionIndex; i += 1) {
      triggerKeyboardEvent(control, "ArrowDown");
      await wait(30);
    }
  } else {
    const optionIndex = Math.max(0, options.indexOf(match));
    for (let i = 0; i <= optionIndex; i += 1) {
      triggerKeyboardEvent(control, "ArrowDown");
      await wait(20);
    }
  }
  triggerKeyboardEvent(control, "Enter");
  debugField(field?.label || "Combobox", "after Enter", {
    activeDescendant: control.getAttribute("aria-activedescendant"),
    expanded: control.getAttribute("aria-expanded")
  });

  if (!field?.sectionLabel) return true;

  const committed = await waitFor(() => {
    const refreshedSection = findSectionByLabelText(field.sectionLabel);
    if (!refreshedSection) return false;
    if (typeof field?.commitCheck === "function") {
      return field.commitCheck(refreshedSection, normalizedDesired);
    }
    const sectionText = normalizeSpace(refreshedSection.textContent || "");
    const hasNoInput = !refreshedSection.querySelector('input[role="combobox"]');
    const hasChangeButton = !!findButtonByText(refreshedSection, "Change");
    return hasNoInput && hasChangeButton && sectionText.includes(normalizedDesired);
  });
  debugField(field?.label || "Combobox", "commit result", { committed });

  // Clean up any lingering open combobox/focus state before the next field runs.
  if (committed) {
    triggerKeyboardEvent(control, "Escape");
    control.blur();
    await wait(75);
  }
  return committed;
}

function matchesReadingFormatOption(optionText, desiredValue) {
  const option = normalizeSpace(optionText);
  const desired = normalizeSpace(desiredValue);

  if (option === desired || option.includes(desired) || desired.includes(option)) {
    return true;
  }

  if (desired === "ebook") {
    return ["ebook", "e-book", "digital", "digital book", "kindle"].some((term) => option.includes(term));
  }

  if (desired === "audiobook") {
    return ["audio", "audiobook", "audible"].some((term) => option.includes(term));
  }

  if (desired === "physical book") {
    return ["physical", "print", "paperback", "hardcover", "book"].some((term) => option.includes(term));
  }

  return false;
}

async function setListboxValue(control, desiredValue) {
  const normalizedDesired = normalizeSpace(desiredValue);
  triggerPointerClick(control);
  await wait();

  const listboxId = control.getAttribute("aria-controls");
  const listbox = (listboxId ? document.getElementById(listboxId) : null)
    || Array.from(document.querySelectorAll('[role="listbox"]')).find((el) => el.getAttribute("aria-labelledby") === control.id)
    || null;
  const options = Array.from((listbox || document).querySelectorAll('[role="option"]'));
  const match = options.find((option) => matchesReadingFormatOption(option.textContent || "", normalizedDesired));
  if (!match) return false;

  triggerPointerClick(match);
  await wait();
  return true;
}

async function setSearchableListboxValue(control, desiredValue) {
  const normalizedDesired = normalizeSpace(desiredValue);
  triggerPointerClick(control);
  await wait(100);

  const listboxId = control.getAttribute("aria-controls");
  const listbox = (listboxId ? document.getElementById(listboxId) : null)
    || Array.from(document.querySelectorAll('[role="listbox"]')).find((el) => el.getAttribute("aria-labelledby") === control.id)
    || null;
  if (!listbox) return false;

  const searchInput = listbox.querySelector('input[type="text"]');
  if (searchInput) {
    await setControlValue(searchInput, desiredValue);
    await wait(150);
  }

  const options = Array.from(listbox.querySelectorAll('[role="option"]'));
  const exactMatch = options.find((option) => getOptionPrimaryText(option) === normalizedDesired);
  const prefixMatch = options.find((option) => getOptionPrimaryText(option).startsWith(normalizedDesired));
  const containsMatch = options.find((option) => getOptionPrimaryText(option).includes(normalizedDesired));
  const match = exactMatch || prefixMatch || containsMatch;
  if (!match) return false;

  triggerPointerClick(match);
  await wait();
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

async function setButtonListboxValue(control, desiredValue) {
  const normalizedDesired = normalizeSpace(desiredValue);
  triggerPointerClick(control);
  await wait(100);

  const listboxId = control.getAttribute("aria-controls");
  const listbox = (listboxId ? document.getElementById(listboxId) : null)
    || Array.from(document.querySelectorAll('[role="listbox"]')).find((el) => el.getAttribute("aria-labelledby") === control.id)
    || null;
  if (!listbox) return false;

  const options = Array.from(listbox.querySelectorAll('[role="option"]'));
  const match = options.find((option) => normalizeSpace(option.textContent || "") === normalizedDesired);
  if (!match) return false;

  triggerPointerClick(match);
  await wait(100);
  return true;
}

async function findAvailableControl(field, usedControls) {
  if (field.sectionLabel && field.selector) {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
      await wait(25);
    }

    let section = findSectionByLabelText(field.sectionLabel);
    let control = section?.querySelector(field.selector) || null;
    if (field.activateButtonText && section) {
      if (field.forceActivateFirst) {
        const button = findButtonByText(section, field.activateButtonText);
        if (button && isInteractableElement(button)) {
          button.click();
          await wait(150);
          section = findSectionByLabelText(field.sectionLabel);
          control = section?.querySelector(field.selector) || null;
        }
      }

      const needsActivation = !control || !isInteractableElement(control);
      if (needsActivation) {
        const button = findButtonByText(section, field.activateButtonText);
        if (button && isInteractableElement(button)) {
          button.click();
          await wait(150);
          section = findSectionByLabelText(field.sectionLabel);
          control = section?.querySelector(field.selector) || document.querySelector(field.selector);
        }
      }
    }
    if (!control || !isInteractableElement(control)) {
      await waitFor(() => {
        const refreshedSection = findSectionByLabelText(field.sectionLabel);
        const refreshedControl = refreshedSection?.querySelector(field.selector);
        return isInteractableElement(refreshedControl);
      }, 1500, 75);
      section = findSectionByLabelText(field.sectionLabel);
      control = section?.querySelector(field.selector) || null;
    }
    if (!control && section && field.activateButtonText) {
      const button = findButtonByText(section, field.activateButtonText);
      if (button && isInteractableElement(button)) {
        button.click();
        await wait();
        section = findSectionByLabelText(field.sectionLabel);
        control = section?.querySelector(field.selector) || document.querySelector(field.selector);
      }
    }
    if (!control || usedControls.has(control) || !isInteractableElement(control)) {
      return null;
    }
    return control;
  }

  if (field.selector) {
    const control = document.querySelector(field.selector);
    if (!control || usedControls.has(control) || !isInteractableElement(control)) {
      return null;
    }
    return control;
  }

  const controls = Array.from(document.querySelectorAll("input, textarea, select"))
    .filter((control) => isInteractableElement(control));

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

async function fillField(field, details, report, usedControls) {
  if (typeof field.customHandler === "function") {
    const success = await field.customHandler(details, field, usedControls);
    if (success) {
      report.filled.push(field.label);
    } else {
      report.missing.push(field.label);
    }
    return;
  }

  let value = typeof field.value === "function" ? field.value(details) : details[field.value];
  if (value == null || value === "") return;

  const values = field.multiple
    ? (Array.isArray(value) ? value : [value]).filter((item) => item != null && item !== "")
    : [value];

  let successCount = 0;

  for (let index = 0; index < values.length; index += 1) {
    const currentValue = values[index];
    if (field.multiple && index > 0 && field.sectionLabel && field.activateButtonText) {
      const section = findSectionByLabelText(field.sectionLabel);
      const button = section ? findButtonByText(section, field.activateButtonText) : null;
      if (button) {
        button.click();
        await wait(100);
      }
    }

    const control = await findAvailableControl(field, usedControls);
    debugField(field.label, "resolved control", control ? {
      tag: control.tagName,
      type: control.getAttribute("type"),
      id: control.id,
      role: control.getAttribute("role"),
      widget: field.widget || null,
      value: currentValue
    } : { found: false, value: currentValue });
    if (!control) {
      continue;
    }

    const tagName = control.tagName.toLowerCase();
    const success = tagName === "select"
      ? setSelectValue(control, currentValue)
      : field.widget === "searchableListbox"
        ? await setSearchableListboxValue(control, currentValue)
      : field.widget === "listbox"
        ? await setListboxValue(control, currentValue)
      : control.getAttribute("role") === "combobox"
        ? await setComboboxValue(control, currentValue, field)
        : await setControlValueWithRetry(control, currentValue, 3, field.label);

    if (success) {
      debugField(field.label, "success", {
        finalValue: control.value,
        controlType: control.getAttribute("type"),
        widget: field.widget || null,
        value: currentValue
      });
      if (!field.multiple) {
        usedControls.add(control);
      }
      successCount += 1;
    } else {
      debugField(field.label, "failed", {
        finalValue: control.value,
        controlType: control.getAttribute("type"),
        widget: field.widget || null,
        value: currentValue
      });
    }
  }

  if (successCount > 0) {
    report.filled.push(field.label);
  } else {
    report.missing.push(field.label);
  }
}

function getContributors(details) {
  return (details.Contributors || [])
    .filter((contributor) => contributor?.name)
    .map((contributor) => ({
      name: contributor.name,
      role: contributor.roles?.[0] || "Author"
    }));
}

async function fillContributors(details, field) {
  const contributors = getContributors(details);
  if (contributors.length === 0) return false;

  let successCount = 0;

  for (let index = 0; index < contributors.length; index += 1) {
    const contributor = contributors[index];
    const section = findSectionByLabelText(field.sectionLabel);
    if (!section) continue;

    if (index > 0) {
      const addButton = findButtonByText(section, field.activateButtonText);
      if (addButton) {
        addButton.click();
        await wait(125);
      }
    }

    const control = await findAvailableControl(field, new Set());
    if (!control) continue;

    const contributorField = {
      ...field,
      commitCheck: (refreshedSection, desired) => normalizeSpace(refreshedSection.textContent || "").includes(desired)
    };

    const added = await setComboboxValue(control, contributor.name, contributorField);
    if (!added) continue;

    const desiredRole = contributor.role || "Author";
    if (normalizeSpace(desiredRole) !== "author") {
      const refreshedSection = findSectionByLabelText(field.sectionLabel);
      const roleButtons = Array.from(refreshedSection?.querySelectorAll('button[aria-haspopup="listbox"]') || []);
      const roleButton = roleButtons[roleButtons.length - 1] || null;
      if (roleButton) {
        const roleSet = await setButtonListboxValue(roleButton, desiredRole);
        if (!roleSet) continue;
      }
    }

    successCount += 1;
  }

  return successCount > 0;
}

function getBookFields() {
  return [
    { label: "Title", value: "Title", selector: "#field-title", keywords: ["title"] },
    { label: "Description", value: "Description", keywords: ["description", "blurb"], elementTypes: ["textarea"] },
    { label: "Series", value: "Series", keywords: ["series"], exclusions: ["position", "number"] },
    { label: "Series Place", value: "Series Place", keywords: ["series position", "series number", "position in series", "volume number"] },
    {
      label: "Contributors",
      sectionLabel: "Authors & Contributions",
      activateButtonText: "Add more?",
      selector: 'input[role="combobox"][placeholder="Search for an author..."]',
      comboboxStrategy: "matched-option-enter",
      customHandler: fillContributors,
      keywords: ["author", "authors", "writer"]
    }
  ];
}

function getEditionFields() {
  return [
    { label: "Title", value: "Title", selector: "#field-title", keywords: ["title"] },
    { label: "ISBN-10", value: "ISBN-10", selector: "#field-isbn-10", keywords: ["isbn 10", "isbn-10"] },
    { label: "ISBN-13", value: "ISBN-13", selector: "#field-isbn-13", keywords: ["isbn 13", "isbn-13", "ean", "isbn"] },
    { label: "ASIN", value: "ASIN", selector: "#field-asin", keywords: ["asin"] },
    {
      label: "Publisher",
      value: "Publisher",
      sectionLabel: "Publisher",
      activateButtonText: "Set Publisher",
      forceActivateFirst: true,
      selector: 'input[role="combobox"][placeholder="Search for a publisher..."]',
      comboboxStrategy: "publisher-exact-click",
      commitCheck: (section, desired) => {
        const sectionText = normalizeSpace(section.textContent || "");
        const hasNoInput = !section.querySelector('input[role="combobox"]');
        const hasChangeButton = !!findButtonByText(section, "Change");
        return hasNoInput && hasChangeButton && sectionText.includes(desired);
      },
      keywords: ["publisher", "imprint"]
    },
    {
      label: "Cover",
      sectionLabel: "Cover",
      selector: '#file-upload',
      customHandler: fillCover,
      keywords: ["cover", "image"]
    },
    {
      label: "Contributors",
      sectionLabel: "Authors & Contributions",
      activateButtonText: "Add more?",
      selector: 'input[role="combobox"][placeholder="Search for an author..."]',
      comboboxStrategy: "matched-option-enter",
      customHandler: fillContributors,
      keywords: ["author", "authors", "writer"]
    },
    { label: "Reading Format", value: "Reading Format", sectionLabel: "Reading Format", selector: 'button[aria-haspopup="listbox"]', widget: "listbox", keywords: ["reading format"] },
    {
      label: "Pages",
      value: "Pages",
      sectionLabel: "Page Count",
      selector: 'input[type="number"]',
      keywords: ["pages", "page count"],
      inputTypes: ["text", "number"]
    },
    {
      label: "Listening Length Seconds",
      value: "Listening Length Seconds",
      sectionLabel: "Audiobook Duration",
      selector: '#field-audio-length-total-seconds',
      keywords: ["listening length", "duration", "seconds"],
      inputTypes: ["text", "number"]
    },
    { label: "Publication date", value: "Publication date", sectionLabel: "Release Date", selector: "input[type=\"date\"]", keywords: ["publication date", "published", "release date"], inputTypes: ["text", "date"] },
    { label: "Edition Format", value: "Edition Format", selector: "#field-edition-format", keywords: ["edition format", "format", "binding"] },
    { label: "Edition Information", value: "Edition Information", selector: "#field-edition-information", keywords: ["edition information", "edition note", "edition details"] },
    {
      label: "Language",
      value: "Language",
      sectionLabel: "Primary Language",
      selector: 'button[aria-haspopup="listbox"]',
      widget: "searchableListbox",
      keywords: ["language"]
    },
    {
      label: "Country",
      value: "Country",
      sectionLabel: "Country",
      selector: 'button[aria-haspopup="listbox"]',
      widget: "searchableListbox",
      keywords: ["country"]
    }
  ];
}

/**
 * @param {Record<string, any>} details
 * @returns {{target: "book" | "edition", filled: string[], missing: string[]}}
 */
export async function fillHardcoverForm(details) {
  const target = getHardcoverEditTarget(window.location.href);
  if (!target) {
    throw new Error("This is not a supported Hardcover edit page.");
  }

  const report = { target, filled: [], missing: [] };
  const fields = target === "book" ? getBookFields() : getEditionFields();
  const usedControls = new Set();

  for (const field of fields) {
    await fillField(field, details, report, usedControls);
  }

  if (report.filled.length === 0) {
    throw new Error(`No matching ${target} form fields were found on this page.`);
  }

  return report;
}
