export const DRAWING_DB_NAME = 'TradingAppDrawingsDB';
export const DRAWING_DB_VERSION = 1;
export const DRAWING_STORE_NAME = 'drawings_cache';

let dbPromise = null;

export function initDrawingDB() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DRAWING_DB_NAME, DRAWING_DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(DRAWING_STORE_NAME)) {
          // Key will be exchange_symbol_timeframe
          db.createObjectStore(DRAWING_STORE_NAME);
        }
      };

      request.onsuccess = (event) => resolve(event.target.result);
      request.onerror = (event) => {
        console.error("IndexedDB Drawing error:", event.target.errorCode);
        reject(event.target.errorCode);
      };
    });
  }
  return dbPromise;
}

export function getDrawingStorageKey(exchange, symbol, timeframe) {
  if (!exchange || !symbol || !timeframe) return null;
  return `${exchange.toUpperCase()}_${symbol.toUpperCase()}_${timeframe}`;
}

export async function loadDrawingsFromDB(exchange, symbol, timeframe) {
  const key = getDrawingStorageKey(exchange, symbol, timeframe);
  if (!key) return [];

  const db = await initDrawingDB();
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction([DRAWING_STORE_NAME], 'readonly');
      const store = transaction.objectStore(DRAWING_STORE_NAME);
      const request = store.get(key);

      request.onsuccess = (event) => {
        resolve(event.target.result || []);
      };

      request.onerror = (event) => reject(event.target.errorCode);
    } catch (e) {
      console.warn("Could not load drawings", e);
      resolve([]);
    }
  });
}

export async function saveDrawingsToDB(exchange, symbol, timeframe, drawings) {
  const key = getDrawingStorageKey(exchange, symbol, timeframe);
  if (!key) return;

  const db = await initDrawingDB();
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction([DRAWING_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(DRAWING_STORE_NAME);
      const request = store.put(drawings || [], key);

      request.onsuccess = () => resolve(true);
      request.onerror = (event) => reject(event.target.errorCode);
    } catch (e) {
      console.warn("Could not save drawings", e);
      resolve(false);
    }
  });
}
