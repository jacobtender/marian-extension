/**
 * A Set implementation backed by chrome.storage.
 */
export class StorageBackedSet {
  /**
   * @param {string} storageKey - The key to use in storage
   * @param {'session'|'local'|'sync'} area - The storage area to use (default: 'session')
   */
  constructor(storageKey, area = 'session') {
    this.key = storageKey;
    this.areaName = area;
    this.isReady = false; // Flag to check if initial load is done

    // Detect environment: Firefox uses 'browser', Chrome uses 'chrome'.
    const api = typeof browser !== 'undefined' ? browser : chrome;
    this.storage = api.storage[this.areaName];

    // Local in-memory cache
    this._cache = new Set();

    // Track initialization so we don't read before data is loaded
    this._readyPromise = this._initialLoad();

    // Listen for changes from other windows/contexts to keep cache in sync
    api.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === this.areaName && changes[this.key]) {
        this._updateCache(changes[this.key].newValue);
      }
    });
  }

  /**
   * Initial fetch from storage to populate the cache.
   */
  async _initialLoad() {
    try {
      const result = await this.storage.get([this.key]);
      const rawArray = result[this.key] || [];
      this._cache = new Set(rawArray);
    } catch (err) {
      console.error(`Error loading set from ${this.areaName}:`, err);
    } finally {
      this.isReady = true;
    }
  }

  /**
   * Update local cache from a raw array (helper for listener).
   */
  _updateCache(rawArray) {
    // Handle case where key was removed (undefined)
    const safeArray = rawArray || [];
    this._cache = new Set(safeArray);
    // If we received an update, we are technically ready/synced
    this.isReady = true;
  }

  /**
   * Persist the current cache to storage.
   */
  async _persist() {
    const array = Array.from(this._cache);
    await this.storage.set({ [this.key]: array });
  }

  // --- ASYNC API (Safe for startup) ---

  async add(value) {
    await this._readyPromise;
    if (!this._cache.has(value)) {
      this._cache.add(value);
      await this._persist();
    }
  }

  async delete(value) {
    await this._readyPromise;
    if (this._cache.has(value)) {
      this._cache.delete(value);
      await this._persist();
    }
  }

  async has(value) {
    await this._readyPromise;
    return this._cache.has(value);
  }

  async size() {
    await this._readyPromise;
    return this._cache.size;
  }

  async getAll() {
    await this._readyPromise;
    return Array.from(this._cache);
  }

  async clear() {
    await this._readyPromise;
    this._cache.clear();
    await this.storage.remove(this.key);
  }

  // --- SYNCHRONOUS API (Fast, but check .isReady first) ---

  hasSync(value) {
    if (!this.isReady) console.warn('StorageBackedSet: hasSync called before initial load completed.');
    return this._cache.has(value);
  }

  sizeSync() {
    if (!this.isReady) console.warn('StorageBackedSet: sizeSync called before initial load completed.');
    return this._cache.size;
  }

  getAllSync() {
    if (!this.isReady) console.warn('StorageBackedSet: getAllSync called before initial load completed.');
    return Array.from(this._cache);
  }
}

