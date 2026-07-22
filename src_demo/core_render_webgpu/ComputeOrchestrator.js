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
import { webnnEngine } from './WebNNEngine.js';
import { smartDataSplicer } from '../utils/smartDataSplicer.js';

export class ComputeOrchestrator {
  constructor() {
    this.useWebGPU = false;
    this.useWasm = false;
    this.useNPU = false;
    this.initialized = false;
    
    // Performance heuristics
    this.workStealingTimeoutMs = 15; // If hardware takes >15ms, steal work and give to next hardware
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

    // 2. NPU (WebNN) Initialization
    try {
      this.useNPU = await webnnEngine.init();
    } catch (e) {
      this.useNPU = false;
    }

    // 3. Rust WASM Initialization
    try {
      await wasmMath.init();
      this.useWasm = wasmMath.ready;
    } catch (e) {
      console.warn('[ComputeOrchestrator] WASM unavailable, disabling WASM compute:', e);
      this.useWasm = false;
    }

    this.initialized = true;
    console.log(`[ComputeOrchestrator] Hardware Dispatch Matrix Active: WebGPU=${this.useWebGPU}, NPU=${this.useNPU}, RustWASM=${this.useWasm}`);
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
   * DYNAMIC WORK-STEALING SCHEDULER
   * Triggers primary hardware. If it hangs or takes too long, it triggers fallback hardware simultaneously.
   * Whichever Promise resolves first wins.
   */
  async _raceHardware(taskName, prices, period, gpuFunc, wasmFunc, jsFunc, multiplier = null) {
    if (!this.initialized) await this.init();
    
    const length = prices.length;
    let floatArray = null;

    // We keep track of promises
    const promises = [];

    // 1. WebGPU Task
    if (this.isWebGPUActiveAndReady() && gpuFunc && length >= 5000) {
      floatArray = new Float32Array(prices);
      const gpuPromise = (async () => {
        try {
          const res = await gpuFunc.call(webgpuComputeDriver, floatArray, period);
          return { source: 'GPU', data: Array.from(res) };
        } catch(e) { throw e; }
      })();
      promises.push(gpuPromise);
    }

    // 2. WebNN (NPU) Task
    if (this.useNPU) {
      if (!floatArray) floatArray = new Float32Array(prices);
      const npuPromise = (async () => {
        try {
          const res = await webnnEngine.compute(floatArray, period);
          return { source: 'NPU', data: Array.from(res) };
        } catch(e) { throw e; }
      })();
      promises.push(npuPromise);
    }

    // 3. Work-Stealing Fallback Mechanism (WASM CPU)
    // If GPU/NPU don't finish within X ms, we unleash CPU WASM to race them!
    const wasmFallbackPromise = new Promise((resolve) => {
      setTimeout(() => {
        if (this.useWasm) {
           console.log(`[Scheduler] ${taskName} is taking >${this.workStealingTimeoutMs}ms. Work-stealing to CPU WASM!`);
           try {
             let res;
             if (multiplier !== null) {
               res = wasmFunc.call(wasmMath, prices, period, multiplier);
             } else {
               res = wasmFunc.call(wasmMath, prices, period);
             }
             resolve({ source: 'CPU_WASM', data: res });
           } catch(e) {}
        }
      }, this.workStealingTimeoutMs);
    });
    
    if (promises.length > 0) {
      promises.push(wasmFallbackPromise);
      try {
        const winner = await Promise.race(promises);
        console.log(`[Scheduler] ${taskName} executed by ${winner.source}`);
        return winner.data;
      } catch (e) {
        console.warn(`[Scheduler] Hardware race failed for ${taskName}, using synchronous JS fallback`);
      }
    } else {
      // Direct WASM route if no GPU/NPU
      if (this.useWasm) {
         try {
           let res;
           if (multiplier !== null) res = wasmFunc.call(wasmMath, prices, period, multiplier);
           else res = wasmFunc.call(wasmMath, prices, period);
           return res;
         } catch(e) {}
      }
    }

    // Final Fallback
    console.log(`[Scheduler] ${taskName} falling back to Vanilla JS`);
    if (multiplier !== null) return jsFunc.call(this, prices, period, multiplier);
    return jsFunc.call(this, prices, period);
  }

  async calculateSMA(prices, period) {
    return this._raceHardware('SMA', prices, period, 
      webgpuComputeDriver.computeSMA, 
      wasmMath.sma, 
      this._jsSMA
    );
  }

  async calculateRSI(prices, period = 14) {
    // GPU RSI not fully mapped in driver yet, passing null
    return this._raceHardware('RSI', prices, period, 
      null, 
      wasmMath.rsi, 
      this._jsRSI
    );
  }

  async calculateEMA(prices, period) {
    return this._raceHardware('EMA', prices, period, 
      null, 
      wasmMath.ema, 
      this._jsEMA
    );
  }

  async calculateBollingerBands(prices, period = 20, multiplier = 2.0) {
    return this._raceHardware('Bollinger', prices, period, 
      null, 
      wasmMath.bollingerBands, 
      this._jsBollinger,
      multiplier
    );
  }

  /**
   * Run dynamic WGSL code directly on WebGPU
   */
  async executeDynamicWGSL(wgslCode, bufferCount, prices) {
    if (!this.initialized) await this.init();
    
    // Route to WebGPU ONLY if active and ready
    if (this.isWebGPUActiveAndReady()) {
      try {
        const floatArray = prices instanceof Float32Array ? prices : new Float32Array(prices);
        const result = await webgpuComputeDriver.executeDynamicWGSL(wgslCode, bufferCount, floatArray);
        return result; // Float32Array of signals
      } catch (err) {
        console.warn('[Orchestrator] WebGPU Dynamic WGSL execution failed:', err);
      }
    }
    
    // Fallback: If WebGPU fails, we would fall back to JS simulation
    // (JS fallback will be handled by the caller pineJitCompiler by using AST)
    return null;
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
