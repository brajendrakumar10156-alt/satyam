// src_demo/utils/ComputeBrain.ts

import { WebGPUComputeDriver } from '../core_math_webgpu/WebGPUComputeDriver';
import { WebGLComputeDriver } from '../core_math_webgl/WebGLComputeDriver';
import { executeCPUCompute } from './cpuCompute';
import { webNNComputeDriver } from '../core_math_webnn/webnn_compute';

// @ts-ignore
import initWasm, { alloc_buffer, compute_sma, compute_ema, compute_rsi, compute_macd, compute_bollinger } from '../core_math_rust/pkg/core_math_rust.js';

/**
 * ?? Smart Heterogeneous Compute Brain (Zero-Copy Enabled)
 * Dynamically routes mathematical tasks across CPU, GPU, WASM, and NPU
 * based on (1)$ permutation heuristics (Overhead vs Execution Time).
 */

class ComputeBrainEngine {
  nodes: any;
  gpuDriver: WebGPUComputeDriver;
  glDriver: WebGLComputeDriver;
  sharedBuffer: SharedArrayBuffer | null;
  sharedFloatArray: Float32Array | null;
  wasmPtr: number;
  wasmOutPtr: number;
  wasmBufferSize: number;
  wasmModule: any;
  wasmInitPromise: Promise<any>;

  constructor() {
    this.gpuDriver = new WebGPUComputeDriver();
    this.glDriver = new WebGLComputeDriver();
    this.sharedBuffer = null;
    this.sharedFloatArray = null;
    this.wasmPtr = 0;
    this.wasmOutPtr = 0;
    this.wasmBufferSize = 0;
    this.wasmModule = null;
    this.wasmInitPromise = initWasm().then(m => { this.wasmModule = m; return m; });

    // We will initialize GPU lazily
    this.nodes = {
      CPU: {
        name: 'CPU (JS Worker)',
        isBusy: false,
        queueLength: 0,
        execute: executeCPUCompute,
        speedFactor: 0.0005, 
        overhead: 0.1 
      },
      GPU: {
        name: 'WebGPU (WGSL)',
        isBusy: false,
        queueLength: 0,
        execute: async (ind: string, data: Float32Array, period: number) => {
          if (!this.gpuDriver.device) {
             await this.gpuDriver.init();
          }
          return await this.gpuDriver.calculate(ind, data, period);
        },
        speedFactor: 0.00001, 
        overhead: 2.0 
      },
      WebGL: {
        name: 'WebGL (GLSL)',
        isBusy: false,
        queueLength: 0,
        execute: async (ind: string, data: Float32Array, period: number) => {
          if (!this.glDriver.gl) {
             await this.glDriver.init();
          }
          return await this.glDriver.calculate(ind, data, period);
        },
        speedFactor: 0.00005,
        overhead: 3.0
      },
      WASM: {
        name: 'WASM (Rust Binary)',
        isBusy: false,
        queueLength: 0,
        execute: async (ind: string, data: Float32Array, period: number, std_dev: number = 2.0) => {
          await this.wasmInitPromise;
          
          const size = data.length;
          // Determine output size (MACD and BB output 3 lines)
          const isTripleLine = ind === 'MACD' || ind === 'BOLLINGER';
          const requiredOutSize = isTripleLine ? size * 3 : size;

          if (this.wasmPtr === 0 || this.wasmBufferSize !== size) {
             this.wasmPtr = alloc_buffer(size);
             this.wasmOutPtr = alloc_buffer(size * 3); // Allocate max needed for triple line outputs
             this.wasmBufferSize = size;
          }
          
          const memoryView = new Float32Array(this.wasmModule.memory.buffer);
          const f32Offset = this.wasmPtr / 4;
          memoryView.set(data, f32Offset);
          
          if (ind === 'SMA') {
              compute_sma(this.wasmPtr, this.wasmOutPtr, size, period);
          } else if (ind === 'EMA') {
              compute_ema(this.wasmPtr, this.wasmOutPtr, size, period);
          } else if (ind === 'RSI') {
              compute_rsi(this.wasmPtr, this.wasmOutPtr, size, period);
          } else if (ind === 'MACD') {
              // Defaults: fast=12, slow=26, signal=9
              compute_macd(this.wasmPtr, this.wasmOutPtr, size, 12, 26, 9);
          } else if (ind === 'BOLLINGER') {
              compute_bollinger(this.wasmPtr, this.wasmOutPtr, size, period, std_dev);
          } else {
              return await executeCPUCompute(ind, data, period);
          }
          
          const outView = new Float32Array(this.wasmModule.memory.buffer);
          const outF32Offset = this.wasmOutPtr / 4;
          
          return outView.slice(outF32Offset, outF32Offset + requiredOutSize);
        },
        speedFactor: 0.0001, 
        overhead: 0.5
      },
      NPU: {
        name: 'WebNN (NPU)',
        isBusy: false,
        queueLength: 0,
        execute: async (ind: string, data: Float32Array, period: number) => {
           const result = await webNNComputeDriver.calculate(ind, data, period);
           if (!result) {
              console.warn(`[ComputeBrain] NPU execution failed/unsupported. Falling back to CPU.`);
              return await executeCPUCompute(ind, data, period);
           }
           return result;
        },
        speedFactor: 0.000005,
        overhead: 1.0
      }
    };
  }

  _getFastestNode(dataSize: number, indicatorType: string) {
    let bestNode = null;
    let minTotalTime = Infinity;

    for (const [key, node] of Object.entries(this.nodes)) {
      const executionTime = dataSize * (node as any).speedFactor;
      const waitTime = (node as any).queueLength * 1.5; 
      const estimatedTotalTime = waitTime + (node as any).overhead + executionTime;

      if (estimatedTotalTime < minTotalTime) {
        minTotalTime = estimatedTotalTime;
        bestNode = key;
      }
    }
    return bestNode;
  }

  // Pre-allocate or reuse Zero-Copy Shared Memory
  _getSharedMemory(size: number) {
     const bytesNeeded = size * 4;
     if (!this.sharedBuffer || this.sharedBuffer.byteLength < bytesNeeded) {
        // Allocate new if too small
        this.sharedBuffer = new SharedArrayBuffer(bytesNeeded);
        this.sharedFloatArray = new Float32Array(this.sharedBuffer);
     }
     return this.sharedFloatArray;
  }

  async dispatch(indicatorType: string, candles: any[], params: any = {}) {
    const dataSize = candles.length;
    const targetNodeKey = this._getFastestNode(dataSize, indicatorType);
    const node = this.nodes[targetNodeKey as string];
    
    console.log(`[ComputeBrain] Routing ${indicatorType} (${dataSize} items) -> ${node.name}`);
    
    node.queueLength++;
    node.isBusy = true;

    try {
      // ZERO-COPY Pipeline Step 1: Write directly to SharedArrayBuffer
      const sharedMem = this._getSharedMemory(dataSize)!;
      for (let i = 0; i < dataSize; i++) {
        sharedMem[i] = candles[i].close;
      }
      
      // We pass a view of exact size
      const dataView = new Float32Array(this.sharedBuffer!, 0, dataSize);
      const period = params.period || 14;
      
      // Execute on target hardware node (receives Shared Memory View)
      const startTime = performance.now();
      const resultFloatArray = await node.execute(indicatorType, dataView, period);
      const endTime = performance.now();
      
      console.log(`[ComputeBrain] ${node.name} completed ${indicatorType} in ${(endTime - startTime).toFixed(2)}ms`);
      
      const formattedResult = [];
      const offset = (indicatorType === 'SMA' || indicatorType === 'RSI') ? period - 1 : 0;
      for (let i = offset; i < dataSize; i++) {
        formattedResult.push({ time: candles[i].time, value: resultFloatArray[i] });
      }
      return formattedResult;

    } catch (err) {
      console.error(`[ComputeBrain] Node ${node.name} failed:`, err);
      throw err;
    } finally {
      node.queueLength--;
      if (node.queueLength === 0) {
        node.isBusy = false;
      }
    }
  }

  async dispatchBatch(indicators: any[], candles: any[]) {
    const promises = indicators.map(ind => this.dispatch(ind.type.toUpperCase(), candles, ind.params));
    return await Promise.all(promises);
  }
}

export const ComputeBrain = new ComputeBrainEngine();
