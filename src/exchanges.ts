// @ts-nocheck
/** Multi-exchange market data (Binance + OKX, KuCoin, Bybit, Kraken, Gate.io, MEXC) */

const FETCH_TIMEOUT = 8000;
const API_BASE = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:8000';

import { getLocalCandles, saveLocalCandles } from './db/indexedDB';

const QUOTES_FOR_PARSE = [
  'USDT', 'USDC', 'BUSD', 'FDUSD', 'TUSD', 'DAI', 'BTC', 'ETH', 'BNB', 'EUR', 'USD',
  'TRY', 'BRL', 'AUD', 'GBP', 'RUB', 'JPY',
].sort((a, b) => b.length - a.length);

export const EXCHANGE_LIST = [
  { id: 'binance', name: 'Binance', short: 'BN' },
  { id: 'okx', name: 'OKX', short: 'OKX' },
  { id: 'kucoin', name: 'KuCoin', short: 'KC' },
  { id: 'bybit', name: 'Bybit', short: 'BY' },
  { id: 'kraken', name: 'Kraken', short: 'KR' },
  { id: 'gate', name: 'Gate.io', short: 'GT' },
  { id: 'mexc', name: 'MEXC', short: 'MX' },
];

const FALLBACK_SYMBOLS = {
  binance: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'LINKUSDT', 'TRXUSDT', 'DOTUSDT', 'MATICUSDT', 'LTCUSDT', 'ATOMUSDT', 'UNIUSDT', 'SHIBUSDT', 'OPUSDT', 'ARBUSDT', 'NEARUSDT', 'INJUSDT', 'AAVEUSDT', 'SUIUSDT', 'PEPEUSDT', 'RUNEUSDT', 'ALGOUSDT', 'FILUSDT', 'APTUSDT', 'SEIUSDT', 'TAOUSDT'],
  okx: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'DOGEUSDT', 'ADAUSDT', 'LINKUSDT', 'TRXUSDT', 'DOTUSDT', 'MATICUSDT'],
  kucoin: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'DOGEUSDT', 'ADAUSDT', 'LINKUSDT', 'TRXUSDT', 'DOTUSDT'],
  bybit: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'DOGEUSDT', 'ADAUSDT', 'LINKUSDT', 'TRXUSDT', 'DOTUSDT'],
  kraken: ['BTCUSD', 'ETHUSD', 'SOLUSD', 'XRPUSD', 'DOGEUSD', 'ADAUSD', 'LINKUSD'],
  gate: ['BTC_USDT', 'ETH_USDT', 'SOL_USDT', 'XRP_USDT', 'DOGE_USDT', 'ADA_USDT', 'LINK_USDT'],
  mexc: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'DOGEUSDT', 'ADAUSDT', 'LINKUSDT'],
};

function getFallbackSymbols(exchangeId) {
  return FALLBACK_SYMBOLS[exchangeId] || FALLBACK_SYMBOLS.binance;
}

export function getExchangeMeta(id) {
  return EXCHANGE_LIST.find((e) => e.id === id) || EXCHANGE_LIST[0];
}

export function isPerpetualSymbol(symbol) {
  if (!symbol) return false;
  const s = String(symbol).toUpperCase();
  return s.endsWith('PERP') || s.endsWith('SWAP') || s.endsWith('.P') || s.includes('PERPETUAL') || s.endsWith('-SWAP');
}

export function cleanFuturesSymbol(symbol) {
  if (!symbol) return '';
  return String(symbol).toUpperCase()
    .replace('.P', '')
    .replace('-PERP', '')
    .replace('_PERP', '')
    .replace('PERPETUAL', '')
    .replace('-SWAP', '')
    .replace('_SWAP', '');
}

export function parseUnifiedSymbol(symbol) {
  const upper = String(symbol || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  for (const quote of QUOTES_FOR_PARSE) {
    if (upper.endsWith(quote) && upper.length > quote.length) {
      return { base: upper.slice(0, -quote.length), quote, unified: upper };
    }
  }
  return { base: upper, quote: '', unified: upper };
}

function toOkxInstId(unified) {
  const isPerp = isPerpetualSymbol(unified);
  const cleaned = cleanFuturesSymbol(unified);
  const { base, quote } = parseUnifiedSymbol(cleaned);
  return isPerp ? `${base}-${quote}-SWAP` : `${base}-${quote}`;
}

function toKucoinSymbol(unified) {
  const cleaned = cleanFuturesSymbol(unified);
  const { base, quote } = parseUnifiedSymbol(cleaned);
  return `${base}-${quote}`;
}

function toGatePair(unified) {
  const cleaned = cleanFuturesSymbol(unified);
  const { base, quote } = parseUnifiedSymbol(cleaned);
  return `${base}_${quote}`;
}

const INTERVAL = {
  binance: { '1m': '1m', '5m': '5m', '1h': '1h', '1d': '1d', '1w': '1w' },
  okx: { '1m': '1m', '5m': '5m', '1h': '1H', '1d': '1D', '1w': '1W' },
  kucoin: { '1m': '1min', '5m': '5min', '1h': '1hour', '1d': '1day', '1w': '1week' },
  bybit: { '1m': '1', '5m': '5', '1h': '60', '1d': 'D', '1w': 'W' },
  kraken: { '1m': 1, '5m': 5, '1h': 60, '1d': 1440, '1w': 10080 },
  gate: { '1m': '1m', '5m': '5m', '1h': '1h', '1d': '1d', '1w': '7d' },
  mexc: { '1m': '1m', '5m': '5m', '1h': '60m', '1d': '1d', '1w': '1W' },
};

function mapInterval(exchangeId, interval) {
  return INTERVAL[exchangeId]?.[interval] ?? interval;
}

export async function fetchJson(url, signal) {
  // Try direct fetch first (if CORS is open or allowed)
  try {
    const res = await fetch(url, { signal });
    if (res.ok) {
      return await res.json();
    }
  } catch (_) { }

  // Try proxies list
  const proxies = [
    (target) => `https://corsproxy.io/?url=${encodeURIComponent(target)}`,
    (target) => `https://api.allorigins.win/raw?url=${encodeURIComponent(target)}`
  ];

  for (const getProxyUrl of proxies) {
    try {
      const res = await fetch(getProxyUrl(url), { signal });
      if (res.ok) {
        // allorigins wraps response in { contents: "..." } if not raw, but we fetch raw.
        // Let's parse it safely
        const text = await res.text();
        try {
          return JSON.parse(text);
        } catch (_) {
          // If it is wrapped (for some reason)
          const obj = JSON.parse(text);
          if (obj && obj.contents) {
            return typeof obj.contents === 'string' ? JSON.parse(obj.contents) : obj.contents;
          }
        }
      }
    } catch (e) {
      console.warn(`Proxy fetch failed for ${url} using proxy.`, e);
    }
  }

  throw new Error(`Failed to fetch JSON from ${url}`);
}

function normalizeCandleRow(timeSec, open, high, low, close, volume = 0) {
  return {
    time: Math.floor(timeSec),
    open: parseFloat(open),
    high: parseFloat(high),
    low: parseFloat(low),
    close: parseFloat(close),
    volume: parseFloat(volume) || 0,
  };
}

// ─── Symbol lists ───

async function fetchBinanceSymbols(signal) {
  const data = await fetchJson('https://api.binance.com/api/v3/exchangeInfo', signal);
  return (data.symbols || [])
    .filter((s) => s.status === 'TRADING' && s.isSpotTradingAllowed !== false)
    .map((s) => s.symbol)
    .sort();
}

async function fetchOkxSymbols(signal) {
  const data = await fetchJson('https://www.okx.com/api/v5/public/instruments?instType=SPOT', signal);
  return (data.data || [])
    .filter((s) => s.state === 'live')
    .map((s) => String(s.instId || '').replace(/-/g, ''))
    .filter(Boolean)
    .sort();
}

async function fetchKucoinSymbols(signal) {
  const data = await fetchJson('https://api.kucoin.com/api/v1/symbols', signal);
  return (data.data || [])
    .filter((s) => s.enableTrading)
    .map((s) => String(s.symbol || '').replace(/-/g, ''))
    .filter(Boolean)
    .sort();
}

async function fetchBybitSymbols(signal) {
  const data = await fetchJson('https://api.bybit.com/v5/market/instruments-info?category=spot', signal);
  return (data.result?.list || [])
    .filter((s) => s.status === 'Trading')
    .map((s) => s.symbol)
    .sort();
}

async function fetchKrakenSymbols(signal) {
  const data = await fetchJson('https://api.kraken.com/0/public/AssetPairs', signal);
  return Object.values(data.result || {})
    .filter((p) => p.status === 'online' && (String(p.quote || '').includes('USDT') || String(p.quote || '').includes('USD')))
    .map((p) => (p.altname || p.wsname || '').replace('/', '').toUpperCase())
    .filter((s) => s.length >= 6)
    .sort();
}

async function fetchGateSymbols(signal) {
  const data = await fetchJson('https://api.gateio.ws/api/v4/spot/currency_pairs', signal);
  return (data || [])
    .filter((s) => s.trade_status === 'tradable')
    .map((s) => String(s.id || '').replace('_', ''))
    .filter(Boolean)
    .sort();
}

async function fetchMexcSymbols(signal) {
  const data = await fetchJson('https://api.mexc.com/api/v3/exchangeInfo', signal);
  return (data.symbols || [])
    .filter((s) => s.status === 'ENABLED' || s.status === '1' || s.status === 'TRADING')
    .map((s) => s.symbol)
    .sort();
}

export async function fetchExchangeSymbols(exchangeId) {
  const cacheKey = `satyam_ai_terminal_symbols_cache_${exchangeId}`;
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const { symbols, timestamp } = JSON.parse(cached);
      const cacheDuration = 12 * 60 * 60 * 1000; // Cache for 12 hours
      if (Date.now() - timestamp < cacheDuration && Array.isArray(symbols) && symbols.length > 35) {
        return symbols;
      }
    }
  } catch (cacheErr) {
    console.warn("Failed to read symbols cache:", cacheErr);
  }

  const fetchBackendSymbols = async () => {
    const response = await fetch(`${API_BASE}/symbols/${exchangeId}`);
    if (!response.ok) throw new Error('Backend failed');
    const result = await response.json();
    if (Array.isArray(result) && result.length > 0) return result;
    throw new Error('Invalid backend symbols data');
  };

  const fetchProxySymbols = async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    try {
      switch (exchangeId) {
        case 'okx': return await fetchOkxSymbols(controller.signal);
        case 'kucoin': return await fetchKucoinSymbols(controller.signal);
        case 'bybit': return await fetchBybitSymbols(controller.signal);
        case 'kraken': return await fetchKrakenSymbols(controller.signal);
        case 'gate': return await fetchGateSymbols(controller.signal);
        case 'mexc': return await fetchMexcSymbols(controller.signal);
        default: return await fetchBinanceSymbols(controller.signal);
      }
    } finally {
      clearTimeout(timeout);
    }
  };

  let resultSymbols;
  try {
    // Race them: whichever returns valid symbols first wins!
    resultSymbols = await Promise.any([fetchBackendSymbols(), fetchProxySymbols()]);
  } catch (err) {
    resultSymbols = getFallbackSymbols(exchangeId);
  }

  if (Array.isArray(resultSymbols) && resultSymbols.length > 0) {
    try {
      localStorage.setItem(cacheKey, JSON.stringify({
        symbols: resultSymbols,
        timestamp: Date.now()
      }));
    } catch (saveErr) {
      console.warn("Failed to write symbols cache:", saveErr);
    }
    return resultSymbols;
  }
  return getFallbackSymbols(exchangeId);
}

// ─── Candles ───

async function fetchBinanceCandles(symbol, interval, limit, before, signal) {
  const isPerp = isPerpetualSymbol(symbol);
  const apiSymbol = cleanFuturesSymbol(symbol);

  // 1. Primary: Attempt to fetch from Local Rust Collector Engine (Port 8080) via Vite proxy
  try {
    const localUrl = new URL('/rust-api/v1/binary/history', window.location.origin);
    localUrl.searchParams.set('symbol', apiSymbol);
    localUrl.searchParams.set('limit', String(limit));
    if (before) localUrl.searchParams.set('endTime', String(before));

    const res = await fetch(localUrl.toString(), { signal });
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.candles) && data.candles.length > 0) {
        let hasGap = false;
        for (let i = 1; i < data.candles.length; i++) {
          if (data.candles[i].time - data.candles[i - 1].time > 90) { hasGap = true; break; }
        }
        if (hasGap) fetch(`/rust-api/report_corruption?symbol=${apiSymbol}`).catch(() => {});
        return data.candles.map((c) => normalizeCandleRow(c.time, c.open, c.high, c.low, c.close, 0));
      } else {
        fetch(`/rust-api/report_corruption?symbol=${apiSymbol}`).catch(() => {});
      }
    }
  } catch (_localErr) {
    // Rust collector offline — falling back to Binance via Vite CORS proxy
  }

  // 2. Fallback: Binance via Vite proxy (CORS bypass — works in India)
  const proxyBase = isPerp ? '/proxy-binance-futures/fapi/v1/klines' : '/proxy-binance/api/v3/klines';
  const url = new URL(proxyBase, window.location.origin);
  url.searchParams.set('symbol', apiSymbol);
  url.searchParams.set('interval', mapInterval('binance', interval));
  url.searchParams.set('limit', String(limit));
  if (before) url.searchParams.set('endTime', String(before * 1000 - 1));
  const raw = await fetchJson(url.toString(), signal);
  if (!Array.isArray(raw)) throw new Error(raw?.msg || 'Binance error');
  return raw.map((k) => normalizeCandleRow(k[0] / 1000, k[1], k[2], k[3], k[4], k[5]));
}

async function fetchOkxCandles(symbol, interval, limit, before, signal) {
  const instId = toOkxInstId(symbol);
  const bar = mapInterval('okx', interval);
  let url = `/proxy-okx/api/v5/market/candles?instId=${instId}&bar=${bar}&limit=${Math.min(limit, 300)}`;
  if (before) url += `&after=${before * 1000}`;
  const data = await fetchJson(url, signal);
  if (data.code !== '0') throw new Error(data.msg || 'OKX error');
  return (data.data || [])
    .map((k) => normalizeCandleRow(k[0] / 1000, k[1], k[2], k[3], k[4], k[5]))
    .reverse();
}

async function fetchKucoinCandles(symbol, interval, limit, before, signal) {
  const sym = toKucoinSymbol(symbol);
  const type = mapInterval('kucoin', interval);
  const endAt = before ? before * 1000 : Date.now();
  const url = `/proxy-kucoin/api/v1/market/candles?symbol=${sym}&type=${type}&endAt=${endAt}`;
  const data = await fetchJson(url, signal);
  if (data.code !== '200000') throw new Error(data.msg || 'KuCoin error');
  return (data.data || [])
    .map((k) => normalizeCandleRow(k[0], k[1], k[3], k[4], k[2], k[5]))
    .reverse();
}

async function fetchBybitCandles(symbol, interval, limit, before, signal) {
  const isPerp = isPerpetualSymbol(symbol);
  const apiSymbol = cleanFuturesSymbol(symbol);
  const category = isPerp ? 'linear' : 'spot';
  const intv = mapInterval('bybit', interval);
  let url = `/proxy-bybit/v5/market/kline?category=${category}&symbol=${apiSymbol}&interval=${intv}&limit=${Math.min(limit, 1000)}`;
  if (before) url += `&end=${before * 1000}`;
  const data = await fetchJson(url, signal);
  if (data.retCode !== 0) throw new Error(data.retMsg || 'Bybit error');
  return (data.result?.list || [])
    .map((k) => normalizeCandleRow(k[0] / 1000, k[1], k[2], k[3], k[4], k[5]))
    .reverse();
}

async function fetchKrakenCandles(symbol, interval, limit, before, signal) {
  const pair = symbol;
  const intv = mapInterval('kraken', interval);
  let url = `https://api.kraken.com/0/public/OHLC?pair=${pair}&interval=${intv}`;
  if (before) url += `&since=${before}`;
  const data = await fetchJson(url, signal);
  if (data.error?.length) throw new Error(data.error[0]);
  const key = Object.keys(data.result || {}).find((k) => k !== 'last');
  const rows = key ? data.result[key] : [];
  return rows
    .slice(-limit)
    .map((k) => normalizeCandleRow(k[0], k[1], k[2], k[3], k[4], k[6]));
}

async function fetchGateCandles(symbol, interval, limit, before, signal) {
  const pair = toGatePair(symbol);
  const intv = mapInterval('gate', interval);
  let url = `https://api.gateio.ws/api/v4/spot/candlesticks?currency_pair=${pair}&interval=${intv}&limit=${Math.min(limit, 1000)}`;
  if (before) url += `&to=${before}`;
  const raw = await fetchJson(url, signal);
  if (!Array.isArray(raw)) throw new Error('Gate error');
  return raw
    .map((k) => normalizeCandleRow(k[0], k[5], k[3], k[4], k[2], k[1]))
    .sort((a, b) => a.time - b.time);
}

async function fetchMexcCandles(symbol, interval, limit, before, signal) {
  const url = new URL('https://api.mexc.com/api/v3/klines');
  url.searchParams.set('symbol', symbol);
  url.searchParams.set('interval', mapInterval('mexc', interval));
  url.searchParams.set('limit', String(limit));
  if (before) url.searchParams.set('endTime', String(before * 1000 - 1));
  const raw = await fetchJson(url.toString(), signal);
  if (!Array.isArray(raw)) throw new Error('MEXC error');
  return raw.map((k) => normalizeCandleRow(k[0] / 1000, k[1], k[2], k[3], k[4], k[5]));
}

export async function fetchExchangeCandles(exchangeId, symbol, interval, limit = 1000, before = null) {
  const sym = String(symbol).toUpperCase();

  const fetchRustCollector = async () => {
    // Use Vite proxy path — avoids CORS and works on any port
    let url = `/rust-api/history?symbol=${sym}&limit=${limit}&interval=${interval}`;
    if (before) url += `&endTime=${before}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Rust collector failed');
    const data = await response.json();
    if (data && data.status === 'success' && Array.isArray(data.candles) && data.candles.length > 0) {
      return data.candles.map((c) => normalizeCandleRow(c.time, c.open, c.high, c.low, c.close, 0));
    }
    throw new Error('No candles in Rust collector');
  };

  const fetchProxy = async (overrideLimit = limit) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
    try {
      switch (exchangeId) {
        case 'okx': return await fetchOkxCandles(sym, interval, overrideLimit, before, controller.signal);
        case 'kucoin': return await fetchKucoinCandles(sym, interval, overrideLimit, before, controller.signal);
        case 'bybit': return await fetchBybitCandles(sym, interval, overrideLimit, before, controller.signal);
        case 'kraken': return await fetchKrakenCandles(sym, interval, overrideLimit, before, controller.signal);
        case 'gate': return await fetchGateCandles(sym, interval, overrideLimit, before, controller.signal);
        case 'mexc': return await fetchMexcCandles(sym, interval, overrideLimit, before, controller.signal);
        default: return await fetchBinanceCandles(sym, interval, overrideLimit, before, controller.signal);
      }
    } finally {
      clearTimeout(timeout);
    }
  };

  const fetchIndexedDB = async () => {
    const cached = await getLocalCandles(exchangeId, sym, interval);
    if (cached && cached.length > 0) {
      console.log(`Loaded ${cached.length} candles from IndexedDB (Offline mode)`);
      return cached;
    }
    throw new Error("No cached data in IndexedDB");
  };

  try {
    // 3-WAY FUSION STEP 1: Get Master History from Rust
    let rustData = [];
    try {
      rustData = await fetchRustCollector();
    } catch (e) {
      console.warn("Rust Collector offline or no data. Falling back to API.", e);
    }

    if (rustData.length > 0) {
      const lastCandle = rustData[rustData.length - 1];
      const lastTimeMs = lastCandle.time * 1000;
      
      let intervalMs = 60000;
      if (interval.endsWith('m')) intervalMs = parseInt(interval) * 60000;
      else if (interval.endsWith('h')) intervalMs = parseInt(interval) * 3600000;
      else if (interval.endsWith('d')) intervalMs = parseInt(interval) * 86400000;
      
      const missingTime = Date.now() - lastTimeMs;
      const missingCandlesCount = Math.floor(missingTime / intervalMs);
      
      if (missingCandlesCount > 1 && !before) {
        console.log(`[3-Way Fusion] Gap detected: ${missingCandlesCount} candles. Fetching API Fallback...`);
        try {
          const missingData = await fetchProxy(Math.min(missingCandlesCount + 5, 1000));
          const newData = missingData.filter(c => c.time > lastCandle.time);
          if (newData.length > 0) {
             rustData = [...rustData, ...newData];
             saveLocalCandles(exchangeId, sym, interval, rustData).catch(console.warn);
          }
        } catch (apiErr) {
          console.warn("[3-Way Fusion] API Fallback failed, returning Rust data as is.", apiErr);
        }
      }
      return rustData;
    }

    // 3-WAY FUSION STEP 2: Rust data empty, doing FULL API Fetch
    console.log("[3-Way Fusion] Rust data empty, doing full API fetch...");
    const directData = await fetchProxy();
    saveLocalCandles(exchangeId, sym, interval, directData).catch(console.warn);
    return directData;

  } catch (err) {
    // 3-WAY FUSION STEP 3: Emergency Offline Fallback
    console.error("[3-Way Fusion] Online fetch failed, falling back to IndexedDB", err);
    return await fetchIndexedDB();
  }
}

// ─── Live kline WebSocket ───

function parseWsKline(exchangeId, data) {
  switch (exchangeId) {
    case 'binance': {
      const k = data.k;
      if (!k) return null;
      return {
        time: Math.floor(k.t / 1000),
        open: parseFloat(k.o),
        high: parseFloat(k.h),
        low: parseFloat(k.l),
        close: parseFloat(k.c),
        volume: parseFloat(k.v),
      };
    }
    case 'okx': {
      const row = data.data?.[0];
      if (!row) return null;
      return normalizeCandleRow(row[0] / 1000, row[1], row[2], row[3], row[4], row[5]);
    }
    case 'bybit': {
      const rows = data.data;
      if (!rows?.length) return null;
      const k = rows[0];
      return normalizeCandleRow(k.start / 1000, k.open, k.high, k.low, k.close, k.volume);
    }
    case 'kucoin': {
      const k = data.data?.candles;
      if (!k) return null;
      return normalizeCandleRow(k[0], k[1], k[3], k[4], k[2], k[5]);
    }
    case 'mexc': {
      const k = data.k || data.d?.k;
      if (!k) return null;
      return {
        time: Math.floor((k.t || k.T) / 1000),
        open: parseFloat(k.o),
        high: parseFloat(k.h),
        low: parseFloat(k.l),
        close: parseFloat(k.c),
        volume: parseFloat(k.v || k.q),
      };
    }
    default:
      return null;
  }
}

// Opens a live kline/candle websocket for the given exchange+symbol+interval.
// onCandle(candle) fires on every update; onStatus(text) reports connection state.
// Returns an unsubscribe function that closes the socket and stops reconnect attempts.
export function subscribeExchangeKline(exchangeId, symbol, interval, onCandle, onStatus) {
  const sym = String(symbol).toLowerCase();
  const unified = String(symbol).toUpperCase();
  let sockets = [];
  let disposed = false;
  let lastProcessedTickMs = 0; // For deduplication in the race condition

  const connect = () => {
    if (disposed) return;

    try {
      if (exchangeId === 'binance') {
        // MULTI-STREAM EDGE ENGINE: The Latency Race
        const binanceUrl = `wss://stream.binance.com:9443/ws/${sym}@kline_${interval}`;
        const rustUrl = import.meta.env.VITE_RUST_SERVER_URL?.replace('http', 'ws') || 'ws://localhost:8080';

        const wsBinance = new WebSocket(binanceUrl);
        const wsRust = new WebSocket(`${rustUrl}/api/ws/live`);
        sockets.push(wsBinance, wsRust);

        wsBinance.onopen = () => { if (!disposed) onStatus?.('Connected (Direct)'); };
        wsRust.onopen = () => { if (!disposed) onStatus?.('Connected (Rust Proxy)'); };

        const handleBinanceRace = (candle, sourceTimestamp) => {
          if (disposed) return;
          // Deduplicate based on time. We accept the first one that arrives for a given tick!
          // We use current Date.now() to throttle slightly if they arrive in the same exact ms, 
          // or we can just pass them both and let lightweight charts handle it (it overrides same-time candles).
          // But to be clean, we let them both pass. The UI will just paint the fastest one instantly.
          onCandle(candle);
        };

        wsBinance.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            const candle = parseWsKline('binance', data);
            if (candle) handleBinanceRace(candle, Date.now());
          } catch (_) { }
        };

        wsRust.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.symbol === unified) {
              const c = data.candle;
              const candle = {
                time: Math.floor(c.time),
                open: c.open,
                high: c.high,
                low: c.low,
                close: c.close,
                volume: 0 // Rust doesn't parse volume yet, but that's fine for price tick
              };
              handleBinanceRace(candle, Date.now());
            }
          } catch (_) { }
        };

        wsBinance.onerror = () => { if (!disposed) onStatus?.('Reconnecting (Direct)'); };
        wsRust.onerror = () => { /* Rust fallback silent error */ };

      } else {
        // Standard single socket logic for other exchanges
        let ws = null;
        let sendSubscribe = null;

        if (exchangeId === 'okx') {
          ws = new WebSocket('wss://ws.okx.com:8443/ws/v5');
          sendSubscribe = () => {
            ws.send(JSON.stringify({
              op: 'subscribe',
              args: [{ channel: 'candle' + mapInterval('okx', interval), instId: toOkxInstId(unified) }],
            }));
          };
        } else if (exchangeId === 'bybit') {
          ws = new WebSocket('wss://stream.bybit.com/v5/public/spot');
          sendSubscribe = () => {
            ws.send(JSON.stringify({
              op: 'subscribe',
              args: [`kline.${mapInterval('bybit', interval)}.${unified}`],
            }));
          };
        } else if (exchangeId === 'mexc') {
          ws = new WebSocket(`wss://wbs.mexc.com/ws`);
          sendSubscribe = () => {
            ws.send(JSON.stringify({
              method: 'SUBSCRIPTION',
              params: [`spot@public.kline.v3.api@${unified}@${mapInterval('mexc', interval)}`],
            }));
          };
        } else {
          onStatus?.('Polling');
          return;
        }

        sockets.push(ws);

        ws.onopen = () => {
          if (disposed) return;
          sendSubscribe?.();
          onStatus?.('Connected');
        };

        ws.onmessage = (event) => {
          if (disposed) return;
          try {
            const data = JSON.parse(event.data);
            const candle = parseWsKline(exchangeId, data);
            if (candle) onCandle(candle);
          } catch (_) { /* ignore */ }
        };

        ws.onerror = () => { if (!disposed) onStatus?.('Reconnecting'); };
      }
    } catch (_) {
      onStatus?.('Polling');
    }
  };

  connect();

  return () => {
    disposed = true;
    for (const ws of sockets) {
      if (ws) {
        ws.onopen = null;
        ws.onmessage = null;
        ws.onerror = null;
        ws.onclose = null;
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close();
        }
      }
    }
  };
}
