/** Multi-exchange market data (Binance + OKX, KuCoin, Bybit, Kraken, Gate.io, MEXC) */

const FETCH_TIMEOUT = 8000;
const API_BASE = import.meta.env.VITE_BACKEND_URL ?? '/api';

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
  } catch (_) {}

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
  const baseUrl = isPerp ? 'https://fapi.binance.com/fapi/v1/klines' : 'https://api.binance.com/api/v3/klines';
  const url = new URL(baseUrl);
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
  let url = `https://www.okx.com/api/v5/market/candles?instId=${instId}&bar=${bar}&limit=${Math.min(limit, 300)}`;
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
  const url = `https://api.kucoin.com/api/v1/market/candles?symbol=${sym}&type=${type}&endAt=${endAt}`;
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
  let url = `https://api.bybit.com/v5/market/kline?category=${category}&symbol=${apiSymbol}&interval=${intv}&limit=${Math.min(limit, 1000)}`;
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
  
  const fetchBackend = async () => {
    let url = `${API_BASE}/candles/${exchangeId}/${sym}/${interval}?limit=${limit}`;
    if (before) {
      url += `&before=${before}`;
    }
    const response = await fetch(url);
    if (!response.ok) throw new Error('Backend failed');
    const data = await response.json();
    if (data && data.candles && Array.isArray(data.candles) && data.candles.length > 0) {
      // Save to IndexedDB (Tier 1 Cache)
      await saveLocalCandles(exchangeId, sym, interval, data.candles).catch(console.warn);
      return data.candles;
    }
    throw new Error('Invalid backend candles data');
  };

  const fetchProxy = async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
    try {
      switch (exchangeId) {
        case 'okx': return await fetchOkxCandles(sym, interval, limit, before, controller.signal);
        case 'kucoin': return await fetchKucoinCandles(sym, interval, limit, before, controller.signal);
        case 'bybit': return await fetchBybitCandles(sym, interval, limit, before, controller.signal);
        case 'kraken': return await fetchKrakenCandles(sym, interval, limit, before, controller.signal);
        case 'gate': return await fetchGateCandles(sym, interval, limit, before, controller.signal);
        case 'mexc': return await fetchMexcCandles(sym, interval, limit, before, controller.signal);
        default: return await fetchBinanceCandles(sym, interval, limit, before, controller.signal);
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
    // 1. Try Backend (SQLite Tier 2) first, which is fast and self-healing
    return await fetchBackend();
  } catch (backendErr) {
    console.warn("Backend failed, trying IndexedDB...", backendErr);
    try {
      // 2. Try IndexedDB (Offline fallback)
      return await fetchIndexedDB();
    } catch (idbErr) {
      console.warn("IndexedDB empty, trying public Proxy...", idbErr);
      // 3. Fallback to public CORS proxy
      const proxyData = await fetchProxy();
      await saveLocalCandles(exchangeId, sym, interval, proxyData).catch(console.warn);
      return proxyData;
    }
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
  let ws = null;
  let disposed = false;

  const connect = () => {
    if (disposed) return;

    try {
      let sendSubscribe = null;

      if (exchangeId === 'binance') {
        ws = new WebSocket(`wss://stream.binance.com:9443/ws/${sym}@kline_${interval}`);
      } else if (exchangeId === 'okx') {
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

      // Single onopen handler: send the exchange's subscribe frame (if any) AND report status.
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
    } catch (_) {
      onStatus?.('Polling');
    }
  };

  connect();

  return () => {
    disposed = true;
    if (ws) {
      ws.onopen = null;
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    }
  };
}
