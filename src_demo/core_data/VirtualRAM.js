/**
 * QuantaAI — Client-Side "Virtual RAM" & Wear-Leveling Manager
 * Implements IndexedDB binary streaming to handle 10+ years of tick data without crashing RAM.
 */

export class VirtualRAM {
  constructor(dbName = 'QuantaVirtualRAM', storeName = 'PriceChunks') {
    this.dbName = dbName;
    this.storeName = storeName;
    this.db = null;
    
    // LRU Cache (Wear Leveling)
    this.cacheLimit = 5; // Max 5 chunks in RAM before dumping to disk
    this.ramCache = new Map();
    this.chunkSize = 100000; // 100k candles per binary chunk
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };

      request.onsuccess = (e) => {
        this.db = e.target.result;
        console.log('[VirtualRAM] Connected to High-Speed IndexedDB Paging System ✓');
        resolve();
      };

      request.onerror = (e) => {
        console.error('[VirtualRAM] Initialization failed:', e);
        reject(e);
      };
    });
  }

  /**
   * Intelligently writes to Virtual RAM using Wear Leveling rules.
   * Only flushes to disk when RAM Cache is full.
   * @param {number} chunkId The ID of the chunk
   * @param {Float32Array} floatArray The binary data
   */
  async writeChunk(chunkId, floatArray) {
    if (!this.db) await this.init();

    // Store in hot RAM cache
    this.ramCache.set(chunkId, floatArray);

    // Wear Leveling: Only flush to SSD if RAM cache exceeds limit
    if (this.ramCache.size > this.cacheLimit) {
      const oldestKey = this.ramCache.keys().next().value;
      const dataToFlush = this.ramCache.get(oldestKey);
      await this._flushToDisk(oldestKey, dataToFlush);
      this.ramCache.delete(oldestKey);
    }
  }

  async _flushToDisk(chunkId, floatArray) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const request = store.put(floatArray.buffer, chunkId); // Save raw ArrayBuffer
      
      request.onsuccess = () => resolve();
      request.onerror = (e) => reject(e);
    });
  }

  /**
   * Retrieves a chunk either from Hot RAM or Cold Disk.
   * @param {number} chunkId 
   * @returns {Promise<Float32Array>}
   */
  async readChunk(chunkId) {
    if (!this.db) await this.init();

    // Check hot cache first
    if (this.ramCache.has(chunkId)) {
      return this.ramCache.get(chunkId);
    }

    // Disk read
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const request = store.get(chunkId);

      request.onsuccess = (e) => {
        const buffer = e.target.result;
        if (buffer) {
          resolve(new Float32Array(buffer));
        } else {
          resolve(null);
        }
      };
      request.onerror = (e) => reject(e);
    });
  }

  async clearDisk() {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.storeName, 'readwrite');
      const request = tx.objectStore(this.storeName).clear();
      request.onsuccess = () => {
        this.ramCache.clear();
        resolve();
      }
      request.onerror = (e) => reject(e);
    });
  }
}

export const virtualRAM = new VirtualRAM();
