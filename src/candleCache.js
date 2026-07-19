/**
 * Candle Memory Cache (localStorage)
 * Persists recently-loaded candles per exchange/symbol/interval so switching
 * back to a pair doesn't require refetching its whole history.
 *
 * Extracted out of App.jsx so the caching concern lives in one small,
 * independently readable/testable module.
 */

const CANDLE_CACHE_PREFIX = 'satyam_ai_terminal_candle_cache:';
const CANDLE_CACHE_MAX = 10000;
const CANDLE_CACHE_MAX_ENTRIES = 15; // max number of exchange/symbol/interval caches kept at once

function candleCacheKey(exchange, symbol, interval) {
  return `${CANDLE_CACHE_PREFIX}${exchange}:${symbol}:${interval}`;
}

function listCandleCacheKeys() {
  const keys = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (key && key.startsWith(CANDLE_CACHE_PREFIX)) keys.push(key);
  }
  return keys;
}

// Evicts the oldest cached entries (by savedAt) until at most `keep` remain,
// so one symbol's cache can't crowd out every other symbol's cache forever.
function evictOldCandleCaches(keep = CANDLE_CACHE_MAX_ENTRIES) {
  const entries = listCandleCacheKeys().map((key) => {
    let savedAt = 0;
    try {
      savedAt = JSON.parse(localStorage.getItem(key) || '{}')?.savedAt || 0;
    } catch (e) {
      savedAt = 0;
    }
    return { key, savedAt };
  });
  if (entries.length <= keep) return;
  entries
    .sort((a, b) => a.savedAt - b.savedAt)
    .slice(0, entries.length - keep)
    .forEach(({ key }) => {
      try { localStorage.removeItem(key); } catch (e) { /* ignore */ }
    });
}

export function loadCandleCache(exchange, symbol, interval) {
  try {
    const raw = localStorage.getItem(candleCacheKey(exchange, symbol, interval));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.candles) ? parsed.candles : [];
  } catch (e) {
    return [];
  }
}

export function saveCandleCache(exchange, symbol, interval, candles) {
  const key = candleCacheKey(exchange, symbol, interval);
  const payload = JSON.stringify({ candles: candles.slice(-CANDLE_CACHE_MAX), savedAt: Date.now() });

  evictOldCandleCaches();

  try {
    localStorage.setItem(key, payload);
  } catch (e) {
    // Quota exceeded even after eviction — drop every other cached symbol and retry once.
    try {
      listCandleCacheKeys().forEach((k) => { if (k !== key) localStorage.removeItem(k); });
      localStorage.setItem(key, payload);
    } catch (e2) {
      // Still failing (e.g. this single payload is bigger than the whole quota) — give up quietly.
    }
  }
}
