// src_demo/utils/wasmCompute.js

/**
 * WebAssembly Compute Node.
 * Intended for C++/Rust/AssemblyScript compiled binaries.
 * Best for recursive/sequential algorithms that are hard to parallelize on GPU.
 */

// This is a stub for the WebAssembly runtime.
// In a full production environment, this would load a .wasm file, instantiate the memory, and map JS arrays to WASM linear memory.

let wasmInstance = null;

export async function initWASMCompute() {
  // Simulate WASM loading overhead
  if (wasmInstance) return true;
  await new Promise(resolve => setTimeout(resolve, 10)); // fake network load
  wasmInstance = {
    // Simulated exported WASM function
    calculateSMA: (data, period) => {
      const out = new Float32Array(data.length);
      for (let i = period - 1; i < data.length; i++) {
        let sum = 0;
        for (let j = 0; j < period; j++) {
          sum += data[i - j];
        }
        out[i] = sum / period;
      }
      return out;
    },
    calculateRSI: (data, period) => {
      const out = new Float32Array(data.length);
      for (let i = period; i < data.length; i++) {
        let gainSum = 0;
        let lossSum = 0;
        for (let j = 0; j < period; j++) {
          const diff = data[i - j] - data[i - j - 1];
          if (diff > 0) gainSum += diff;
          else lossSum -= diff;
        }
        const avgGain = gainSum / period;
        const avgLoss = lossSum / period;
        if (avgLoss === 0) out[i] = 100;
        else {
          const rs = avgGain / avgLoss;
          out[i] = 100 - (100 / (1 + rs));
        }
      }
      return out;
    }
  };
  return true;
}

export async function executeWASMCompute(indicator, inputData, period) {
  if (!wasmInstance) {
    await initWASMCompute();
  }
  
  // Simulate passing arrays to WASM memory space (which costs a tiny bit of time)
  // And executing the native binary
  
  const fnName = `calculate${indicator}`;
  if (!wasmInstance[fnName]) {
    throw new Error(`WASM function ${fnName} not found`);
  }
  
  // Fake execution time for WASM binary (which is extremely fast)
  // In real life this would be a synchronous call into the WASM instance
  return wasmInstance[fnName](inputData, period);
}
