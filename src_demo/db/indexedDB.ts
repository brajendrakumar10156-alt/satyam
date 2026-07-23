// src/db/indexedDB.ts

const DB_NAME = 'TradingAppDB';
const DB_VERSION = 1;
const STORE_NAME = 'market_data_cache';

let dbPromise = null;

export function initIndexedDB() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          // Store key format: "BINANCE_BTCUSDT_15m"
          db.createObjectStore(STORE_NAME);
        }
      };

      request.onsuccess = (event) => {
        resolve(event.target.result);
      };

      request.onerror = (event) => {
        console.error("IndexedDB error:", event.target.errorCode);
        reject(event.target.errorCode);
      };
    });
  }
  return dbPromise;
}

export async function getLocalCandles(exchange, symbol, timeframe) {
  const db = await initIndexedDB();
  const key = `${exchange.toUpperCase()}_${symbol.toUpperCase()}_${timeframe}`;
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(key);

    request.onsuccess = (event) => {
      resolve(event.target.result || []); // Return cached array or empty
    };

    request.onerror = (event) => {
      reject(event.target.errorCode);
    };
  });
}

export async function saveLocalCandles(exchange, symbol, timeframe, newCandles) {
  const db = await initIndexedDB();
  const key = `${exchange.toUpperCase()}_${symbol.toUpperCase()}_${timeframe}`;
  
  // 1. Get existing data
  const existing = await getLocalCandles(exchange, symbol, timeframe);
  
  // 2. Merge and sort by time, avoid duplicates
  const map = new Map();
  for (const c of existing) map.set(c.time, c);
  for (const c of newCandles) map.set(c.time, c);
  
  const merged = Array.from(map.values()).sort((a, b) => a.time - b.time);

  // 3. Save back to IndexedDB
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(merged, key);

    request.onsuccess = () => {
      resolve(merged);
    };

    request.onerror = (event) => {
      reject(event.target.errorCode);
    };
  });
}
