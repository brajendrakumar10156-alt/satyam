/**
 * QuantaAI — Universal Coordinate Bridge
 * Unified (Time, Price) ↔ (Pixel X, Pixel Y) Mapping & Shared Memory Pipeline
 *
 * Provides identical coordinate resolution for Canvas 2D, WebGL, and WebGPU renderers
 */

export class UniversalCoordinateBridge {
  constructor() {
    this.candles = [];
    this.viewportWidth = 800;
    this.viewportHeight = 600;
    this.priceAxisWidth = 50;
    this.timeAxisHeight = 24;
    this.logicalRange = { from: 0, to: 100 };
    this.priceRange = { min: 0, max: 100 };
  }

  updateState({ candles, width, height, logicalRange, priceRange, priceAxisWidth = 50, timeAxisHeight = 24 }) {
    if (candles) this.candles = candles;
    if (width) this.viewportWidth = width;
    if (height) this.viewportHeight = height;
    if (logicalRange) this.logicalRange = logicalRange;
    if (priceRange) this.priceRange = priceRange;
    this.priceAxisWidth = priceAxisWidth;
    this.timeAxisHeight = timeAxisHeight;
  }

  timeToPixelX(time) {
    if (!this.candles || this.candles.length === 0) return 0;
    const chartW = this.viewportWidth - this.priceAxisWidth;
    const rangeLen = this.logicalRange.to - this.logicalRange.from;
    if (rangeLen <= 0) return 0;

    const idx = this.timeToIndex(time);
    return ((idx - this.logicalRange.from) / rangeLen) * chartW;
  }

  priceToPixelY(price) {
    const chartH = this.viewportHeight - this.timeAxisHeight;
    const range = this.priceRange.max - this.priceRange.min;
    if (range <= 0) return 0;

    return chartH - ((price - this.priceRange.min) / range) * chartH;
  }

  pixelXToTime(x) {
    if (!this.candles || this.candles.length === 0) return 0;
    const chartW = this.viewportWidth - this.priceAxisWidth;
    if (chartW <= 0) return 0;

    const rangeLen = this.logicalRange.to - this.logicalRange.from;
    const targetIdx = Math.round(this.logicalRange.from + (x / chartW) * rangeLen);
    const clampedIdx = Math.max(0, Math.min(this.candles.length - 1, targetIdx));
    return this.candles[clampedIdx]?.time || 0;
  }

  pixelYToPrice(y) {
    const chartH = this.viewportHeight - this.timeAxisHeight;
    const range = this.priceRange.max - this.priceRange.min;
    if (chartH <= 0 || range <= 0) return 0;

    return this.priceRange.max - (y / chartH) * range;
  }

  timeToIndex(time) {
    if (!this.candles || this.candles.length === 0) return 0;
    if (time <= this.candles[0].time) return 0;
    if (time >= this.candles[this.candles.length - 1].time) return this.candles.length - 1;

    let l = 0, r = this.candles.length - 1;
    while (l <= r) {
      const m = Math.floor((l + r) / 2);
      if (this.candles[m].time === time) return m;
      if (this.candles[m].time < time) l = m + 1;
      else r = m - 1;
    }
    return l;
  }

  /**
   * Batch convert time/price Float32Array to Pixel X/Y Float32Arrays for GPU shaders
   */
  batchToPixels(times, prices) {
    const count = Math.min(times.length, prices.length);
    const outX = new Float32Array(count);
    const outY = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      outX[i] = this.timeToPixelX(times[i]);
      outY[i] = this.priceToPixelY(prices[i]);
    }
    return { outX, outY };
  }
}

export const universalBridge = new UniversalCoordinateBridge();
export default universalBridge;
