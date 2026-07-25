// src_demo/utils/ComputeBrain.ts

import { executeWGSLCompute } from './gpuCompute.ts';
import { executeWASMCompute } from './wasmCompute.ts';
import { executeCPUCompute } from './cpuCompute.ts';

/**
 * 🧠 Smart Heterogeneous Compute Brain
 * Dynamically routes mathematical tasks across CPU, GPU, WASM, and NPU
 * based on $O(1)$ permutation heuristics (Overhead vs Execution Time).
 */

class ComputeBrainEngine {
  constructor() {
    this.nodes = {
      CPU: {
        name: 'CPU (JS Worker)',
        isBusy: false,
        queueLength: 0,
        execute: executeCPUCompute,
        speedFactor: 0.0005, // e.g., 0.5ms per 1000 items
        overhead: 0.1 // minimal overhead
      },
      GPU: {
        name: 'WebGPU (WGSL)',
        isBusy: false,
        queueLength: 0,
        execute: executeWGSLCompute,
        speedFactor: 0.00001, // e.g., 0.01ms per 1000 items (extremely fast for huge data)
        overhead: 2.0 // memory mapping & transfer overhead
      },
      WASM: {
        name: 'WASM (Binary)',
        isBusy: false,
        queueLength: 0,
        execute: executeWASMCompute,
        speedFactor: 0.0001, // e.g., 0.1ms per 1000 items
        overhead: 0.5
      },
      NPU: {
        name: 'NPU (WebNN)',
        isBusy: false,
        queueLength: 0,
        // Mock execution for NPU
        execute: async (ind, data, period) => {
          return await executeCPUCompute(ind, data, period);
        },
        speedFactor: 0.000005,
        overhead: 3.0
      }
    };
  }

  /**
   * Phase 1 & 2: Pre-distribution & Dynamic Shift (Work Stealing)
   * The Heuristic Engine evaluates: Wait Time + Overhead + Execution Time
   */
  _getFastestNode(dataSize, indicatorType) {
    let bestNode = null;
    let minTotalTime = Infinity;

    for (const [key, node] of Object.entries(this.nodes)) {
      // 1. Calculate execution time based on size
      const executionTime = dataSize * node.speedFactor;
      
      // 2. Queue wait time (if node is busy with N items)
      // We estimate wait time based on average task time in queue. 
      // For simplicity in O(1), we assume each queued item takes 1ms average.
      const waitTime = node.queueLength * 1.5; 
      
      // 3. Permutation formula
      const estimatedTotalTime = waitTime + node.overhead + executionTime;

      if (estimatedTotalTime < minTotalTime) {
        minTotalTime = estimatedTotalTime;
        bestNode = key;
      }
    }

    return bestNode;
  }

  /**
   * Dispatch a single calculation.
   * Extracts 'close' prices from candle objects internally to pass Float32Arrays to nodes.
   */
  async dispatch(indicatorType, candles, params = {}) {
    const dataSize = candles.length;
    
    // Choose fastest node $O(1)$
    const targetNodeKey = this._getFastestNode(dataSize, indicatorType);
    const node = this.nodes[targetNodeKey];
    
    // Console log to prove dynamic routing (Verification Plan)
    console.log(`[ComputeBrain] Routing ${indicatorType} (${dataSize} items) -> ${node.name}`);
    
    node.queueLength++;
    node.isBusy = true;

    try {
      // Prepare raw float array
      const rawData = new Float32Array(dataSize);
      for (let i = 0; i < dataSize; i++) {
        rawData[i] = candles[i].close;
      }

      const period = params.period || 14;
      
      // Execute on target hardware node
      const startTime = performance.now();
      const resultFloatArray = await node.execute(indicatorType, rawData, period);
      const endTime = performance.now();
      
      console.log(`[ComputeBrain] ${node.name} completed ${indicatorType} in ${(endTime - startTime).toFixed(2)}ms`);
      
      // Convert Float32Array back to array of objects for App.tsx backward compatibility
      const formattedResult = [];
      const offset = (indicatorType === 'SMA' || indicatorType === 'RSI') ? period - 1 : 0;
      for (let i = offset; i < dataSize; i++) {
        formattedResult.push({ time: candles[i].time, value: resultFloatArray[i] });
      }
      return formattedResult;

    } catch (err) {
      console.error(`[ComputeBrain] Node ${node.name} failed:`, err);
      // Fallback logic could be placed here
      throw err;
    } finally {
      node.queueLength--;
      if (node.queueLength === 0) {
        node.isBusy = false;
      }
    }
  }

  /**
   * Dispatch a batch of indicators (Phase 1 Pre-Distribution)
   */
  async dispatchBatch(indicators, candles) {
    // Array of promises
    const promises = indicators.map(ind => this.dispatch(ind.type.toUpperCase(), candles, ind.params));
    // They will automatically load balance themselves!
    return await Promise.all(promises);
  }
}

export const ComputeBrain = new ComputeBrainEngine();
