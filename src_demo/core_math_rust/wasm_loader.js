/**
 * QuantaAI — WASM Math Engine Loader
 * Phase 2 — JavaScript Bridge (thin layer only)
 *
 * HOW IT WORKS:
 *   1. Loads the compiled Rust WASM module
 *   2. Exposes clean async API to ComputeOrchestrator
 *   3. All heavy math runs in Rust — this file only bridges
 *
 * USAGE:
 *   import { WasmMathEngine } from './wasm_loader.js';
 *   const engine = new WasmMathEngine();
 *   await engine.init();
 *   const emaResult = engine.ema(prices, 14);
 */

export class WasmMathEngine {
  constructor() {
    this._wasm = null;
    this.ready = false;
  }

  /**
   * Initialize — loads compiled WASM from pkg/ directory
   * Run: wasm-pack build --target web --release
   * to generate the pkg/ folder first
   */
  async init() {
    try {
      // Dynamic import of the wasm-pack generated module
      const wasmModule = await import('../core_math_rust/pkg/quantaai_math_engine.js');
      await wasmModule.default(); // Initialize WASM
      this._wasm = wasmModule;
      this.ready = true;
      console.log(`[QuantaAI] ${this._wasm.engine_version()} — WASM Ready ✓`);
    } catch (err) {
      console.warn('[QuantaAI] WASM not built yet. Run: wasm-pack build --target web --release');
      console.warn('[QuantaAI] Falling back to JS indicators until WASM is built.');
      this.ready = false;
    }
  }

  _check() {
    if (!this.ready) throw new Error('WasmMathEngine not initialized. Call await init() first.');
  }

  // ─── TREND ───────────────────────────────────────

  /** Simple Moving Average */
  sma(prices, period) {
    this._check();
    return Array.from(this._wasm.sma(new Float32Array(prices), period));
  }

  /** Exponential Moving Average */
  ema(prices, period) {
    this._check();
    return Array.from(this._wasm.ema(new Float32Array(prices), period));
  }

  /** Weighted Moving Average */
  wma(prices, period) {
    this._check();
    return Array.from(this._wasm.wma(new Float32Array(prices), period));
  }

  /** Hull Moving Average */
  hma(prices, period) {
    this._check();
    return Array.from(this._wasm.hma(new Float32Array(prices), period));
  }

  /** Double EMA */
  dema(prices, period) {
    this._check();
    return Array.from(this._wasm.dema(new Float32Array(prices), period));
  }

  /** Triple EMA */
  tema(prices, period) {
    this._check();
    return Array.from(this._wasm.tema(new Float32Array(prices), period));
  }

  // ─── MOMENTUM ────────────────────────────────────

  /** RSI — Relative Strength Index */
  rsi(prices, period = 14) {
    this._check();
    return Array.from(this._wasm.rsi(new Float32Array(prices), period));
  }

  /**
   * MACD
   * @returns [{macd, signal, histogram}] array
   */
  macd(prices, fast = 12, slow = 26, signal = 9) {
    this._check();
    const flat = Array.from(this._wasm.macd(new Float32Array(prices), fast, slow, signal));
    const result = [];
    for (let i = 0; i < flat.length; i += 3) {
      result.push({ macd: flat[i], signal: flat[i+1], histogram: flat[i+2] });
    }
    return result;
  }

  /**
   * Stochastic Oscillator
   * @returns [{k, d}] array
   */
  stochastic(highs, lows, closes, kPeriod = 14, dPeriod = 3) {
    this._check();
    const flat = Array.from(this._wasm.stochastic(
      new Float32Array(highs),
      new Float32Array(lows),
      new Float32Array(closes),
      kPeriod, dPeriod
    ));
    const result = [];
    for (let i = 0; i < flat.length; i += 2) {
      result.push({ k: flat[i], d: flat[i+1] });
    }
    return result;
  }

  /** Williams %R */
  williamsR(highs, lows, closes, period = 14) {
    this._check();
    return Array.from(this._wasm.williams_r(
      new Float32Array(highs),
      new Float32Array(lows),
      new Float32Array(closes),
      period
    ));
  }

  /** Rate of Change */
  roc(prices, period) {
    this._check();
    return Array.from(this._wasm.roc(new Float32Array(prices), period));
  }

  // ─── VOLATILITY ──────────────────────────────────

  /** Average True Range */
  atr(highs, lows, closes, period = 14) {
    this._check();
    return Array.from(this._wasm.atr(
      new Float32Array(highs),
      new Float32Array(lows),
      new Float32Array(closes),
      period
    ));
  }

  /**
   * Bollinger Bands
   * @returns [{upper, middle, lower}] array
   */
  bollingerBands(prices, period = 20, multiplier = 2.0) {
    this._check();
    const flat = Array.from(this._wasm.bollinger_bands(
      new Float32Array(prices), period, multiplier
    ));
    const result = [];
    for (let i = 0; i < flat.length; i += 3) {
      result.push({ upper: flat[i], middle: flat[i+1], lower: flat[i+2] });
    }
    return result;
  }

  /**
   * Keltner Channel
   * @returns [{upper, middle, lower}] array
   */
  keltnerChannel(highs, lows, closes, emaPeriod = 20, atrPeriod = 10, multiplier = 2.0) {
    this._check();
    const flat = Array.from(this._wasm.keltner_channel(
      new Float32Array(highs),
      new Float32Array(lows),
      new Float32Array(closes),
      emaPeriod, atrPeriod, multiplier
    ));
    const result = [];
    for (let i = 0; i < flat.length; i += 3) {
      result.push({ upper: flat[i], middle: flat[i+1], lower: flat[i+2] });
    }
    return result;
  }

  // ─── VOLUME ──────────────────────────────────────

  /** On Balance Volume */
  obv(closes, volumes) {
    this._check();
    return Array.from(this._wasm.obv(
      new Float32Array(closes), new Float32Array(volumes)
    ));
  }

  /** VWAP */
  vwap(highs, lows, closes, volumes) {
    this._check();
    return Array.from(this._wasm.vwap(
      new Float32Array(highs),
      new Float32Array(lows),
      new Float32Array(closes),
      new Float32Array(volumes)
    ));
  }

  /** Money Flow Index */
  mfi(highs, lows, closes, volumes, period = 14) {
    this._check();
    return Array.from(this._wasm.mfi(
      new Float32Array(highs),
      new Float32Array(lows),
      new Float32Array(closes),
      new Float32Array(volumes),
      period
    ));
  }

  /** Chaikin Money Flow */
  cmf(highs, lows, closes, volumes, period = 20) {
    this._check();
    return Array.from(this._wasm.cmf(
      new Float32Array(highs),
      new Float32Array(lows),
      new Float32Array(closes),
      new Float32Array(volumes),
      period
    ));
  }

  // ─── TREND STRENGTH ──────────────────────────────

  /**
   * ADX + DI lines
   * @returns [{adx, plusDI, minusDI}] array
   */
  adx(highs, lows, closes, period = 14) {
    this._check();
    const flat = Array.from(this._wasm.adx(
      new Float32Array(highs),
      new Float32Array(lows),
      new Float32Array(closes),
      period
    ));
    const result = [];
    for (let i = 0; i < flat.length; i += 3) {
      result.push({ adx: flat[i], plusDI: flat[i+1], minusDI: flat[i+2] });
    }
    return result;
  }

  /** CCI — Commodity Channel Index */
  cci(highs, lows, closes, period = 20) {
    this._check();
    return Array.from(this._wasm.cci(
      new Float32Array(highs),
      new Float32Array(lows),
      new Float32Array(closes),
      period
    ));
  }

  /**
   * SuperTrend
   * @returns [{value, direction}] array — direction: 1=bull, -1=bear
   */
  supertrend(highs, lows, closes, period = 10, multiplier = 3.0) {
    this._check();
    const flat = Array.from(this._wasm.supertrend(
      new Float32Array(highs),
      new Float32Array(lows),
      new Float32Array(closes),
      period, multiplier
    ));
    const result = [];
    for (let i = 0; i < flat.length; i += 2) {
      result.push({ value: flat[i], direction: flat[i+1] });
    }
    return result;
  }

  /**
   * Parabolic SAR
   * @returns [{sar, direction}] — direction: 1=bull, -1=bear
   */
  parabolicSAR(highs, lows, step = 0.02, maxStep = 0.2) {
    this._check();
    const flat = Array.from(this._wasm.parabolic_sar(
      new Float32Array(highs),
      new Float32Array(lows),
      step, maxStep
    ));
    const result = [];
    for (let i = 0; i < flat.length; i += 2) {
      result.push({ sar: flat[i], direction: flat[i+1] });
    }
    return result;
  }

  /**
   * Aroon
   * @returns [{aroonUp, aroonDown}] array
   */
  aroon(highs, lows, period = 25) {
    this._check();
    const flat = Array.from(this._wasm.aroon(
      new Float32Array(highs),
      new Float32Array(lows),
      period
    ));
    const result = [];
    for (let i = 0; i < flat.length; i += 2) {
      result.push({ aroonUp: flat[i], aroonDown: flat[i+1] });
    }
    return result;
  }

  // ─── UTILITY ─────────────────────────────────────

  /** Extract close prices from flat OHLCV array */
  extractCloses(ohlcv) {
    this._check();
    return Array.from(this._wasm.extract_closes(new Float32Array(ohlcv)));
  }

  extractHighs(ohlcv) {
    this._check();
    return Array.from(this._wasm.extract_highs(new Float32Array(ohlcv)));
  }

  extractLows(ohlcv) {
    this._check();
    return Array.from(this._wasm.extract_lows(new Float32Array(ohlcv)));
  }

  extractVolumes(ohlcv) {
    this._check();
    return Array.from(this._wasm.extract_volumes(new Float32Array(ohlcv)));
  }

  version() {
    this._check();
    return this._wasm.engine_version();
  }
}

// Singleton export
export const wasmMath = new WasmMathEngine();
