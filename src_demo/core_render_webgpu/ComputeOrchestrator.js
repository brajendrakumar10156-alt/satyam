/**
 * QuantaAI — ComputeOrchestrator.js
 * Hardware-Aware Math Dispatcher & System Hardware Profiler
 *
 * SAFETY GUARANTEE:
 *   - Verifies WebGPU initialization before calling any WGSL compute shaders
 *   - If WebGPU fails or is unsupported, DOES NOT retry WebGPU
 *   - Instantly falls back to Rust WASM SIMD or JS Driver
 */

import { wasmMath } from '../core_math_rust/wasm_loader.js';
import { webgpuComputeDriver } from './webgpu_compute_driver.js';
import { smartDataSplicer } from '../utils/smartDataSplicer.js';

export class ComputeOrchestrator {
  constructor() {
    this.useWebGPU = false;
    this.useWasm = false;
    this.initialized = false;
  }

  async init() {
    console.log('[ComputeOrchestrator] Initializing Hardware Profiler...');

    // 1. WebGPU Safety Verification
    try {
      if (navigator.gpu) {
        this.useWebGPU = await webgpuComputeDriver.init();
      } else {
        this.useWebGPU = false;
      }
    } catch (e) {
      console.warn('[ComputeOrchestrator] WebGPU unavailable, disabling GPU compute:', e);
      this.useWebGPU = false;
    }

    // 2. Rust WASM Initialization
    try {
      await wasmMath.init();
      this.useWasm = wasmMath.ready;
    } catch (e) {
      console.warn('[ComputeOrchestrator] WASM unavailable, disabling WASM compute:', e);
      this.useWasm = false;
    }

    this.initialized = true;
    console.log(`[ComputeOrchestrator] Hardware Dispatch Matrix Active: WebGPU=${this.useWebGPU}, RustWASM=${this.useWasm}`);
  }

  /**
   * Auto-detect the best default rendering engine for the user's browser/hardware
   * @returns {Promise<'webgpu' | 'webgl' | 'canvas2d'>}
   */
  async detectOptimalHardware() {
    if (!this.initialized) await this.init();

    if (this.useWebGPU) {
      return 'webgpu';
    }

    // Test WebGL support
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (gl) return 'webgl';
    } catch (e) {
      // Fallback
    }

    return 'canvas2d';
  }

  isWebGPUActiveAndReady() {
    return this.useWebGPU && webgpuComputeDriver.supported;
  }

  /**
   * Intelligently calculate SMA with failsafe fallback
   */
  async calculateSMA(prices, period) {
    if (!this.initialized) await this.init();
    const dataLength = prices.length;

    // Route to WebGPU ONLY if active and ready
    if (this.isWebGPUActiveAndReady() && dataLength >= 5000) {
      try {
        const floatArray = new Float32Array(prices);
        const result = await webgpuComputeDriver.computeSMA(floatArray, period);
        return Array.from(result);
      } catch (err) {
        console.warn('[Orchestrator] WebGPU SMA failed, falling back to Rust WASM:', err);
      }
    }

    // Route to Rust WASM Engine
    if (this.useWasm) {
      try {
        return wasmMath.sma(prices, period);
      } catch (err) {
        console.warn('[Orchestrator] Rust WASM SMA failed, falling back to JS:', err);
      }
    }

    // Default JS Fallback
    return this._jsSMA(prices, period);
  }

  async calculateRSI(prices, period = 14) {
    if (!this.initialized) await this.init();
    if (this.useWasm) {
      try {
        return wasmMath.rsi(prices, period);
      } catch (e) {}
    }
    return this._jsRSI(prices, period);
  }

  async calculateEMA(prices, period) {
    if (!this.initialized) await this.init();
    if (this.useWasm) {
      try {
        return wasmMath.ema(prices, period);
      } catch (e) {}
    }
    return this._jsEMA(prices, period);
  }

  async calculateBollingerBands(prices, period = 20, multiplier = 2.0) {
    if (!this.initialized) await this.init();
    if (this.useWasm) {
      try {
        return wasmMath.bollingerBands(prices, period, multiplier);
      } catch (e) {}
    }
    return this._jsBollinger(prices, period, multiplier);
  }

  // ─── JS Fallbacks ───
  _jsSMA(prices, period) {
    if (prices.length < period) return [];
    const res = [];
    let sum = 0;
    for (let i = 0; i < period; i++) sum += prices[i];
    res.push(sum / period);
    for (let i = period; i < prices.length; i++) {
      sum += prices[i] - prices[i - period];
      res.push(sum / period);
    }
    return res;
  }

  _jsEMA(prices, period) {
    if (prices.length < period) return [];
    const k = 2 / (period + 1);
    let sum = 0;
    for (let i = 0; i < period; i++) sum += prices[i];
    let prev = sum / period;
    const res = [prev];
    for (let i = period; i < prices.length; i++) {
      prev = prices[i] * k + prev * (1 - k);
      res.push(prev);
    }
    return res;
  }

  _jsRSI(prices, period = 14) {
    if (prices.length <= period) return [];
    let gains = 0, losses = 0;
    for (let i = 1; i <= period; i++) {
      const diff = prices[i] - prices[i - 1];
      if (diff > 0) gains += diff;
      else losses -= diff;
    }
    let avgGain = gains / period;
    let avgLoss = losses / period;
    const res = [100 - (100 / (1 + (avgLoss === 0 ? 100 : avgGain / avgLoss)))];

    for (let i = period + 1; i < prices.length; i++) {
      const diff = prices[i] - prices[i - 1];
      const gain = diff > 0 ? diff : 0;
      const loss = diff < 0 ? -diff : 0;
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
      res.push(100 - (100 / (1 + (avgLoss === 0 ? 100 : avgGain / avgLoss))));
    }
    return res;
  }

  _jsBollinger(prices, period = 20, multiplier = 2.0) {
    if (prices.length < period) return [];
    const res = [];
    for (let i = period - 1; i < prices.length; i++) {
      const slice = prices.slice(i + 1 - period, i + 1);
      const mean = slice.reduce((a, b) => a + b, 0) / period;
      const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / period;
      const std = Math.sqrt(variance);
      res.push({ upper: mean + multiplier * std, middle: mean, lower: mean - multiplier * std });
    }
    return res;
  }
}

export const orchestrator = new ComputeOrchestrator();
export default orchestrator;
