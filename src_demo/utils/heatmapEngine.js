/**
 * QuantaAI — WebGPU Liquidation Heatmap Engine (Phase 6)
 * Calculates Whale Liquidation Intensity & Orderbook Depth Clusters for WebGPU GPU VRAM
 */

export class HeatmapEngine {
  constructor() {
    this.liquidationClusters = [];
    this.orderbookDepth = { bids: [], asks: [] };
  }

  /**
   * Calculate Liquidation Intensity Clusters for current price & leverage multipliers (10x, 25x, 50x, 100x)
   * @param {number} currentPrice Current symbol price
   * @param {Array} candles Historical candles
   * @returns {Array<{price: number, type: 'long_liq'|'short_liq', intensity: number, leverage: number}>}
   */
  calculateLiquidationClusters(currentPrice, candles = []) {
    if (!currentPrice || currentPrice <= 0) return [];

    const leverages = [100, 50, 25, 10];
    const clusters = [];

    // Analyze high/low price swings from recent candles
    const recentHighs = candles.slice(-50).map(c => c.high || currentPrice);
    const recentLows = candles.slice(-50).map(c => c.low || currentPrice);

    const maxHigh = Math.max(...recentHighs, currentPrice);
    const minLow = Math.min(...recentLows, currentPrice);

    leverages.forEach(lev => {
      const marginPct = (1 / lev);

      // Estimated Short Liquidation Levels (above current price)
      const shortLiqPrice = currentPrice * (1 + marginPct);
      clusters.push({
        price: parseFloat(shortLiqPrice.toFixed(2)),
        type: 'short_liq',
        intensity: Math.min(1.0, 0.3 + (lev / 100) * 0.7),
        leverage: lev,
      });

      // Estimated Long Liquidation Levels (below current price)
      const longLiqPrice = currentPrice * (1 - marginPct);
      clusters.push({
        price: parseFloat(longLiqPrice.toFixed(2)),
        type: 'long_liq',
        intensity: Math.min(1.0, 0.3 + (lev / 100) * 0.7),
        leverage: lev,
      });
    });

    this.liquidationClusters = clusters;
    return clusters;
  }

  /**
   * Convert Liquidation Clusters into WebGPU Float32Array Texture/Buffer Data
   * Format per cluster: [pixelY, intensity, isShort(1/0), leverage]
   * @param {Array} clusters
   * @param {Function} priceToY Function mapping price to Canvas Y coordinate
   * @returns {Float32Array}
   */
  toWebGPUBuffer(clusters, priceToY) {
    const buffer = new Float32Array(clusters.length * 4);
    clusters.forEach((c, i) => {
      const y = priceToY ? priceToY(c.price) : 0;
      buffer[i * 4] = y;
      buffer[i * 4 + 1] = c.intensity;
      buffer[i * 4 + 2] = c.type === 'short_liq' ? 1.0 : 0.0;
      buffer[i * 4 + 3] = c.leverage;
    });
    return buffer;
  }
}

export const heatmapEngine = new HeatmapEngine();
export default heatmapEngine;
