/**
 * QuantaAI — Triangular & Statistical Arbitrage Matrix Engine (Phase 7)
 * High-Frequency Cross-Exchange Arbitrage & Triangular Spread Scanner
 */

export class ArbitrageMatrixEngine {
  constructor() {
    this.exchangePrices = new Map(); // exchange:symbol -> price
    this.opportunities = [];
  }

  /**
   * Update real-time price tick from exchange
   * @param {string} exchange 'binance' | 'bybit' | 'okx'
   * @param {string} symbol 'BTCUSDT', 'ETHUSDT', etc.
   * @param {number} bid Live bid price
   * @param {number} ask Live ask price
   */
  updatePrice(exchange, symbol, bid, ask) {
    const key = `${exchange.toLowerCase()}:${symbol.toUpperCase()}`;
    this.exchangePrices.set(key, { bid, ask, time: Date.now() });
  }

  /**
   * Scan Cross-Exchange Arbitrage Spreads
   * @param {string} symbol Target symbol (e.g. 'BTCUSDT')
   * @returns {Array<{buyExchange: string, sellExchange: string, spreadPct: number, netProfitPct: number}>}
   */
  scanCrossExchangeArbitrage(symbol = 'BTCUSDT') {
    const sym = symbol.toUpperCase();
    const exchanges = ['binance', 'bybit', 'okx'];
    const results = [];

    const feeRate = 0.001; // 0.1% trading fee per leg (0.2% roundtrip)

    for (let i = 0; i < exchanges.length; i++) {
      for (let j = 0; j < exchanges.length; j++) {
        if (i === j) continue;

        const exA = exchanges[i];
        const exB = exchanges[j];

        const pA = this.exchangePrices.get(`${exA}:${sym}`);
        const pB = this.exchangePrices.get(`${exB}:${sym}`);

        if (pA && pB && pA.ask > 0 && pB.bid > 0) {
          // Buy on Exchange A (ask), Sell on Exchange B (bid)
          const buyPrice = pA.ask;
          const sellPrice = pB.bid;
          const grossSpreadPct = ((sellPrice - buyPrice) / buyPrice) * 100;
          const netProfitPct = grossSpreadPct - (feeRate * 2 * 100);

          if (grossSpreadPct > 0.05) {
            results.push({
              symbol: sym,
              buyExchange: exA.toUpperCase(),
              sellExchange: exB.toUpperCase(),
              buyPrice,
              sellPrice,
              grossSpreadPct: parseFloat(grossSpreadPct.toFixed(3)),
              netProfitPct: parseFloat(netProfitPct.toFixed(3)),
              isProfitable: netProfitPct > 0,
              timestamp: Date.now(),
            });
          }
        }
      }
    }

    this.opportunities = results;
    return results;
  }

  /**
   * Scan Triangular Arbitrage (A -> B -> C -> A)
   * Example: USDT -> BTC -> ETH -> USDT
   * @returns {Array}
   */
  scanTriangularArbitrage() {
    const btcUsdt = this.exchangePrices.get('binance:BTCUSDT')?.ask || 65000;
    const ethUsdt = this.exchangePrices.get('binance:ETHUSDT')?.bid || 3500;
    const ethBtc = this.exchangePrices.get('binance:ETHBTC')?.bid || (3500 / 65000);

    if (!btcUsdt || !ethUsdt || !ethBtc) return [];

    // Path: 100 USDT -> BTC -> ETH -> USDT
    const btcAmount = 100 / btcUsdt;
    const ethAmount = btcAmount / ethBtc;
    const finalUsdt = ethAmount * ethUsdt;

    const grossProfitPct = ((finalUsdt - 100) / 100) * 100;
    const netProfitPct = grossProfitPct - (0.00075 * 3 * 100); // 3-leg BNB fee deduction

    return [{
      path: 'USDT ➔ BTC ➔ ETH ➔ USDT',
      initialCapital: 100,
      finalCapital: parseFloat(finalUsdt.toFixed(3)),
      netProfitPct: parseFloat(netProfitPct.toFixed(3)),
      isProfitable: netProfitPct > 0,
    }];
  }
}

export const arbitrageMatrixEngine = new ArbitrageMatrixEngine();
export default arbitrageMatrixEngine;
