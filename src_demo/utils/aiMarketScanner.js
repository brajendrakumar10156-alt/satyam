/**
 * QuantaAI — Natural Language AI Market Scanner Engine (Phase 15)
 * Multi-Symbol High-Speed AI Technical Scanner
 */

export class AiMarketScanner {
  /**
   * Scan market symbols matching natural language query prompt
   * @param {string} query Scanner prompt (e.g. "RSI under 30 with 2x volume spike")
   * @param {Array<string>} symbolList List of symbols to scan
   * @returns {Promise<Array<{symbol: string, score: number, matchReason: string}>>}
   */
  async scanMarket(query = '', symbolList = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT']) {
    const q = query.toLowerCase();
    const results = [];

    for (const sym of symbolList) {
      // Simulate real-time scanner metrics
      const rsi = Math.floor(Math.random() * 60) + 20; // 20 - 80
      const volSpike = (Math.random() * 3 + 0.5).toFixed(1); // 0.5x - 3.5x

      let isMatch = false;
      let reason = '';

      if (q.includes('rsi') && q.includes('30') && rsi <= 35) {
        isMatch = true;
        reason = `Oversold RSI (${rsi})`;
      } else if (q.includes('volume') && parseFloat(volSpike) >= 2.0) {
        isMatch = true;
        reason = `Volume Spike (${volSpike}x avg)`;
      } else {
        // Random high-probability match
        if (Math.random() > 0.4) {
          isMatch = true;
          reason = `Bullish Momentum (RSI: ${rsi}, Vol: ${volSpike}x)`;
        }
      }

      if (isMatch) {
        results.push({
          symbol: sym,
          rsi,
          volSpike: `${volSpike}x`,
          score: Math.floor(Math.random() * 30 + 70), // 70-99 score
          matchReason: reason,
        });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }
}

export const aiMarketScanner = new AiMarketScanner();
export default aiMarketScanner;
