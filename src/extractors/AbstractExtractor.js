// Cross-browser compatibility
const storageAPI = (typeof browser !== 'undefined' ? browser : chrome)?.storage;

/**
 * Abstract Scraper class
 *
 * @class Extractor
 */
class Extractor {
  /** the name of the extractor */
  get _name() { return "<Abstract Extractor>" }
  /** the list of regexes that the extractor supports and will work on
   * @type{RegExp[]}*/
  _sitePatterns = [];
  /** sets if the extractor requires a page reload before scraping */
  needsReload = true;
  _state = {};

  get _storage_name() { return `scraper.${this._name}`; }

  constructor() {
    if (this.constructor == Extractor) {
      throw new Error("Abstract classes can't be instantiated.");
    }

    this._init();
  }

  _storageInitialized = false;
  async _init() {
    if (this._storageInitialized) return;

    const Self = this;
    storageAPI?.onChanged?.addListener((changes, areaName) => {
      const name = Self._storage_name;
      if (areaName === "local" && name in changes) {
        Self._state = changes[name].newValue;
        Self._handleStateUpdate(Self._state);
      }
    });

    // get data
    const name = this._storage_name;
    const data = await storageAPI?.local?.get(name);
    if (data == undefined || !(name in data)) return;
    this._state = data[name];
    this._handleStateUpdate(this._state);

    this._storageInitialized = true;
  }


  /**
   * Check if the provided url is supported for scraping
   *
   * @param {string} url
   * @returns {boolean} if the provided url is supported
   */
  isSupported(url) {
    return this._sitePatterns.some(pattern => pattern.test(url));
  }

  /**
   * Extract info from the current page, return a object with the details
   *
   * @returns {Promise<Record<string, any>>}
   * @abstract
   */
  async getDetails() {
    throw new Error("Method 'getDetails()' must be implemented.");
  }

  toString() {
    return this._name;
  }

  /**
   * implement this to get updates to the state, gets called on extractor creation
   *
   * @param {any} state - the updated state
   * @abstract
   */
  _handleStateUpdate(state) { }

  /**
   * implement this to get updates to the state, gets called on extractor creation
   *
   * @param {any} state - the updated state
   * @abstract
   */
  async _saveState(state) {
    if (state == undefined) {
      state = this._state;
    }
    let obj = {};
    obj[this._storage_name] = state;
    await storageAPI?.local?.set(obj);
  }

  // NOTE: maybe add extraction functions into methods on the class
}

export { Extractor };
