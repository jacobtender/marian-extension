// Cross-browser compatibility
const storageAPI = typeof browser !== 'undefined' ? browser : chrome;

/**
 * A settings manager for Chrome/Firefox extensions with subscription support.
 * Handles persistent storage, caching, and cross-context synchronization.
 * 
 * @class SettingsManager
 * @example
 * const settings = new SettingsManager({
 *   theme: 'light',
 *   notifications: true,
 *   apiKey: ''
 * });
 * 
 * // Set a setting
 * await settings.set('theme', 'dark');
 * 
 * // Subscribe to changes
 * const unsubscribe = settings.subscribe((changes) => {
 *   console.log('Settings changed:', changes);
 * });
 */
class SettingsManager {
  /**
   * Creates a new SettingsManager instance.
   * 
   * @param {Object} defaults - Default values for all settings
   * @example
   * const settings = new SettingsManager({
   *   theme: 'light',
   *   autoSave: true,
   *   maxItems: 10
   * });
   */
  constructor(defaults = {}) {
    /**
     * Default values for settings
     * @private
     * @type {Object}
     */
    this.defaults = defaults;

    /**
     * Set of listener callbacks
     * @private
     * @type {Set<Function>}
     */
    this.listeners = new Set();

    /**
     * Cached settings for performance
     * @private
     * @type {Object|null}
     */
    this.cache = null;

    // Listen for storage changes from other contexts (popup, background, etc.)
    storageAPI?.storage?.onChanged?.addListener((changes, areaName) => {
      if (areaName === 'sync') {
        this.handleStorageChange(changes);
      }
    });
  }

  /**
   * Gets a setting value or all settings if no key is provided.
   * Returns the default value if the setting hasn't been set yet.
   * 
   * @param {string|null} [key=null] - The setting key to retrieve, or null for all settings
   * @returns {Promise<*>} The setting value, or an object of all settings
   * @example
   * // Get a single setting
   * const theme = await settings.get('theme');
   * 
   * // Get all settings
   * const allSettings = await settings.get();
   */
  async get(key = null) {
    // Load cache if not already loaded
    if (this.cache === null) {
      await this.loadCache();
    }

    if (key === null) {
      return { ...this.cache };
    }

    return this.cache[key] ?? this.defaults[key];
  }

  /**
   * Sets one or multiple settings and notifies subscribers.
   * 
   * @param {string|Object} keyOrObject - Setting key (string) or object with multiple key-value pairs
   * @param {*} [value] - Setting value (only used if first param is a string)
   * @returns {Promise<void>}
   * @example
   * // Set a single setting
   * await settings.set('theme', 'dark');
   * 
   * // Set multiple settings
   * await settings.set({
   *   theme: 'dark',
   *   notifications: false
   * });
   */
  async set(keyOrObject, value = undefined) {
    const updates = typeof keyOrObject === 'string'
      ? { [keyOrObject]: value }
      : keyOrObject;

    await storageAPI.storage.sync.set(updates);

    // Update cache
    if (this.cache === null) {
      await this.loadCache();
    } else {
      Object.assign(this.cache, updates);
    }

    // Notify local listeners
    this.notifyListeners(updates);
  }

  /**
   * Subscribes to all setting changes across all contexts.
   * 
   * @param {Function} callback - Called when any setting changes
   * @param {Object} callback.changes - Object mapping keys to {newValue, oldValue}
   * @returns {Function} Unsubscribe function
   * @example
   * const unsubscribe = settings.subscribe((changes) => {
   *   console.log('Changed:', changes);
   *   // changes = { theme: { newValue: 'dark', oldValue: 'light' } }
   * });
   * 
   * // Later: stop listening
   * unsubscribe();
   */
  subscribe(callback) {
    this.listeners.add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Subscribes to changes for a specific setting key.
   * 
   * @param {string} key - The setting key to watch
   * @param {Function} callback - Called when this specific setting changes
   * @param {*} callback.newValue - The new value of the setting
   * @param {*} callback.oldValue - The previous value of the setting
   * @returns {Function} Unsubscribe function
   * @example
   * const unsubscribe = settings.subscribeToKey('theme', (newValue, oldValue) => {
   *   console.log(`Theme changed from ${oldValue} to ${newValue}`);
   * });
   * 
   * // Later: stop listening
   * unsubscribe();
   */
  subscribeToKey(key, callback) {
    const wrappedCallback = (changes) => {
      if (key in changes) {
        callback(changes[key].newValue, changes[key].oldValue);
      }
    };

    this.listeners.add(wrappedCallback);

    return () => {
      this.listeners.delete(wrappedCallback);
    };
  }

  /**
   * Resets all settings to their default values and notifies subscribers.
   * 
   * @returns {Promise<void>}
   * @example
   * await settings.reset();
   */
  async reset() {
    await storageAPI.storage.sync.clear();
    this.cache = { ...this.defaults };
    this.notifyListeners(this.defaults);
  }

  /**
   * Loads settings from storage into cache.
   * Merges stored values with defaults.
   * 
   * @private
   * @returns {Promise<void>}
   */
  async loadCache() {
    const stored = await storageAPI.storage.sync.get(null);
    this.cache = { ...this.defaults, ...stored };
  }

  /**
   * Handles storage changes from other extension contexts.
   * Updates cache and notifies listeners.
   * 
   * @private
   * @param {Object} changes - Chrome storage changes object
   */
  handleStorageChange(changes) {
    const updates = {};

    for (const [key, { newValue }] of Object.entries(changes)) {
      updates[key] = newValue;
      if (this.cache !== null) {
        this.cache[key] = newValue;
      }
    }

    this.notifyListeners(updates);
  }

  /**
   * Notifies all registered listeners of setting changes.
   * 
   * @private
   * @param {Object} changes - Object with changed keys and their new values
   */
  notifyListeners(changes) {
    const changeObj = {};

    for (const [key, newValue] of Object.entries(changes)) {
      changeObj[key] = {
        newValue,
        oldValue: this.cache?.[key]
      };
    }

    this.listeners.forEach(callback => {
      try {
        callback(changeObj);
      } catch (error) {
        console.error('Error in settings listener:', error);
      }
    });
  }
}
export default SettingsManager;
