export const QUOTE_ASSETS = [
  'USDT', 'USDC', 'BUSD', 'FDUSD', 'TUSD', 'DAI', 'BTC', 'ETH', 'BNB', 'EUR', 'TRY',
  'BRL', 'AUD', 'GBP', 'RUB', 'UAH', 'IDR', 'ZAR', 'NGN', 'PLN', 'RON', 'ARS', 'JPY',
  'MXN', 'CZK', 'CAD', 'VAI', 'USDP', 'UST', 'BKRW', 'BVND', 'TRX', 'XRP', 'DOGE',
].sort((a, b) => b.length - a.length);

export function parseSymbolParts(symbol) {
  const upper = String(symbol || '').toUpperCase();
  for (const quote of QUOTE_ASSETS) {
    if (upper.endsWith(quote) && upper.length > quote.length) {
      return { base: upper.slice(0, -quote.length), quote };
    }
  }
  return { base: upper, quote: '' };
}

export function getBaseAsset(symbol) {
  return parseSymbolParts(symbol).base;
}

export function getQuoteAsset(symbol) {
  return parseSymbolParts(symbol).quote;
}

export function coinIconUrl(symbol) {
  return `https://assets.coincap.io/assets/icons/${getBaseAsset(symbol).toLowerCase()}@2x.png`;
}

export function mergeCandles(...groups) {
  const byTime = new Map();
  groups
    .flat()
    .forEach((c) => {
      if (c && Number.isFinite(c.time)) byTime.set(c.time, c);
    });
  return Array.from(byTime.values()).sort((a, b) => a.time - b.time);
}

// ─── Helper for eraser hit testing ───
export function distanceToLineSegment(px, py, x1, y1, x2, y2) {
  const A = px - x1,
    B = py - y1,
    C = x2 - x1,
    D = y2 - y1;
  const dot = A * C + B * D;
  const len_sq = C * C + D * D;
  let param = -1;
  if (len_sq !== 0) param = dot / len_sq;
  let xx, yy;
  if (param < 0) {
    xx = x1;
    yy = y1;
  } else if (param > 1) {
    xx = x2;
    yy = y2;
  } else {
    xx = x1 + param * C;
    yy = y1 + param * D;
  }
  const dx = px - xx,
    dy = py - yy;
  return Math.sqrt(dx * dx + dy * dy);
}

