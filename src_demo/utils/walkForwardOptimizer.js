/**
 * QuantaAI — Walk-Forward Strategy Optimizer Engine (Phase 12)
 * Sliding Window In-Sample / Out-of-Sample Parameter Optimizer
 */

import { pineJitCompiler } from './pineJitCompiler.js';

export class WalkForwardOptimizer {
  /**
   * Run Walk-Forward Optimization across sliding windows
   * @param {string} strategyCode Pine Script strategy
   * @param {Array} candles Full historical candle array
   * @param {number} windows Number of sliding windows (default: 5)
   */
  async optimizeStrategy(strategyCode, candles = [], windows = 5) {
    if (!candles || candles.length < 500) {
      return { status: 'INSUFFICIENT_DATA', windows: [] };
    }

    const windowSize = Math.floor(candles.length / windows);
    const results = [];

    for (let w = 0; w < windows; w++) {
      const inSampleCandles = candles.slice(w * windowSize, (w + 1) * windowSize);
      const outSampleCandles = candles.slice((w + 1) * windowSize, (w + 2) * windowSize);

      if (inSampleCandles.length < 50 || outSampleCandles.length < 50) break;

      const closesIn = inSampleCandles.map(c => c.close);
      const inSampleRes = await pineJitCompiler.compileAndRun(strategyCode, closesIn, inSampleCandles);

      const closesOut = outSampleCandles.map(c => c.close);
      const outSampleRes = await pineJitCompiler.compileAndRun(strategyCode, closesOut, outSampleCandles);

      results.push({
        windowIndex: w + 1,
        inSampleMetrics: inSampleRes.metrics,
        outSampleMetrics: outSampleRes.metrics,
        efficiencyPct: inSampleRes.metrics.netPnlPct !== 0
          ? parseFloat(((outSampleRes.metrics.netPnlPct / inSampleRes.metrics.netPnlPct) * 100).toFixed(1))
          : 100,
      });
    }

    return {
      status: 'SUCCESS',
      totalWindows: results.length,
      windows: results,
    };
  }
}

export const walkForwardOptimizer = new WalkForwardOptimizer();
export default walkForwardOptimizer;
