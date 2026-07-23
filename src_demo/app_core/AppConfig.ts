/** Backtest / AI server — must run: npm run backend (port 8000) */
export const API_BASE = import.meta.env.VITE_BACKEND_URL ?? `http://${window.location.hostname}:8000`;
export const CANDLE_BATCH_SIZE = 1000;
export const INITIAL_HISTORY_BATCHES = 3;  // load 3k candles on startup for speed
export const MAX_CANDLES_IN_MEMORY = 100000; // allow more in memory
export const SIX_YEARS_SECONDS = 6 * 365 * 24 * 60 * 60;

// Known interval -> seconds. Anything not listed here is parsed on the fly
// (e.g. "45m", "3h", "9d") so users can type a fully custom timeframe.
export const INTERVAL_SECONDS_MAP: Record<string, number> = {
  '1m': 60, '3m': 180, '5m': 300, '15m': 900, '30m': 1800,
  '1h': 3600, '2h': 7200, '4h': 14400, '6h': 21600, '8h': 28800, '12h': 43200,
  '1d': 86400, '3d': 259200, '1w': 604800, '1M': 2592000,
};
export const CUSTOM_TIMEFRAME_REGEX = /^(\d{1,4})(m|h|d|w|M)$/;

export function intervalToSeconds(interval: string): number {
  if (INTERVAL_SECONDS_MAP[interval]) return INTERVAL_SECONDS_MAP[interval];
  const match = String(interval || '').match(CUSTOM_TIMEFRAME_REGEX);
  if (!match) return 60;
  const amount = Number(match[1]);
  const unit = match[2];
  const unitSeconds = unit === 'm' ? 60 : unit === 'h' ? 3600 : unit === 'd' ? 86400 : unit === 'w' ? 604800 : 2592000;
  return amount * unitSeconds;
}

// How many candles we need in memory to cover 6 years at this interval
export function getHistoryCandleCap(interval: string): number {
  const secs = intervalToSeconds(interval);
  const neededForSixYears = Math.ceil(SIX_YEARS_SECONDS / secs);
  return Math.max(2000, Math.min(neededForSixYears, MAX_CANDLES_IN_MEMORY));
}

export const QUOTE_ASSETS = [
  'USDT', 'USDC', 'BUSD', 'FDUSD', 'TUSD', 'DAI', 'BTC', 'ETH', 'BNB', 'EUR', 'TRY',
  'BRL', 'AUD', 'GBP', 'RUB', 'UAH', 'IDR', 'ZAR', 'NGN', 'PLN', 'RON', 'ARS', 'JPY',
  'MXN', 'CZK', 'CAD', 'VAI', 'USDP', 'UST', 'BKRW', 'BVND', 'TRX', 'XRP', 'DOGE',
].sort((a, b) => b.length - a.length);

export function parseSymbolParts(symbol: string) {
  const upper = String(symbol || '').toUpperCase();
  for (const quote of QUOTE_ASSETS) {
    if (upper.endsWith(quote) && upper.length > quote.length) {
      return { base: upper.slice(0, -quote.length), quote };
    }
  }
  return { base: upper, quote: '' };
}

export function getBaseAsset(symbol: string) {
  return parseSymbolParts(symbol).base;
}

export function getQuoteAsset(symbol: string) {
  return parseSymbolParts(symbol).quote;
}

export function getFngColor(val: number) {
  if (val >= 76) return '#00c853'; // Extreme Greed
  if (val >= 55) return '#089981'; // Greed
  if (val >= 45) return '#ffb300'; // Neutral
  if (val >= 25) return '#ff9800'; // Fear
  return '#f23645'; // Extreme Fear
}

export function formatUSD(val: number) {
  if (val === undefined || val === null || isNaN(val)) return 'N/A';
  if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
  if (val >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
  return `$${val.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export function formatShortNumber(val: number) {
  if (val === undefined || val === null || isNaN(val)) return 'N/A';
  if (val >= 1e9) return `${(val / 1e9).toFixed(2)}B`;
  if (val >= 1e6) return `${(val / 1e6).toFixed(2)}M`;
  if (val >= 1e3) return `${(val / 1e3).toFixed(1)}K`;
  return val.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

export const COINGECKO_ID_MAP: Record<string, string> = {
  'BTC': 'bitcoin',
  'ETH': 'ethereum',
  'SOL': 'solana',
  'BNB': 'binancecoin',
  'XRP': 'ripple',
  'ADA': 'cardano',
  'DOGE': 'dogecoin',
  'SHIB': 'shiba-inu',
  'DOT': 'polkadot',
  'LTC': 'litecoin',
  'LINK': 'chainlink',
  'AVAX': 'avalanche-2',
  'UNI': 'uniswap',
  'TRX': 'tron',
  'XLM': 'stellar',
  'ICP': 'internet-computer',
  'ETC': 'ethereum-classic',
  'BCH': 'bitcoin-cash',
  'FIL': 'filecoin',
  'XMR': 'monero',
  'ATOM': 'cosmos',
  'APT': 'aptos',
  'NEAR': 'near',
  'OP': 'optimism',
  'ARB': 'arbitrum',
  'TIA': 'celestia',
  'IMX': 'immutable-x',
  'LDO': 'lido-finance',
  'MNT': 'mantle',
  'INJ': 'injective-protocol',
  'SUI': 'sui',
  'RUNE': 'thorchain',
  'MKR': 'maker',
  'GRT': 'the-graph',
  'AAVE': 'aave',
  'FET': 'fetch-ai',
  'FLOW': 'flow',
  'EGLD': 'elrond-erd-2',
  'SAND': 'the-sandbox',
  'MANA': 'decentraland',
  'THETA': 'theta-token',
  'ALGO': 'algorand',
  'VET': 'vechain',
  'QNT': 'quant-network',
  'AXS': 'axie-infinity',
  'FTM': 'fantom',
  'HBAR': 'hedera-hashgraph',
  'XTZ': 'tezos',
  'EOS': 'eos',
  'NEO': 'neo',
  'WAVES': 'waves',
};

export function getCoinGeckoId(symbol: string) {
  const base = getBaseAsset(symbol).toUpperCase();
  return COINGECKO_ID_MAP[base] || base.toLowerCase();
}

export function coinIconUrl(symbol: string, tier = 0) {
  const base = getBaseAsset(symbol).toLowerCase();
  const tiers = [
    `https://assets.coincap.io/assets/icons/${base}@2x.png`,
    `https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/${base}.png`,
    `https://cryptoicons.org/api/icon/${base}/200`,
    `https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/32/color/${base}.png`,
  ];
  return tiers[tier] || 'https://cryptologos.cc/logos/bnb-bnb-logo.png';
}

export function handleCoinIconError(e: any, coin: string) {
  const currentTier = parseInt(e.target.getAttribute('data-tier') || '0');
  if (currentTier < 3) {
    const nextTier = currentTier + 1;
    e.target.setAttribute('data-tier', nextTier.toString());
    e.target.src = coinIconUrl(coin, nextTier);
  } else {
    e.target.onerror = null;
    e.target.src = 'https://cryptologos.cc/logos/bnb-bnb-logo.png';
  }
}
