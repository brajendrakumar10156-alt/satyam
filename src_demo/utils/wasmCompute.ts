// src_demo/utils/wasmCompute.ts

import init, { CPUMathEngine } from '../core_math_rust/pkg/quantaai_math_engine.ts';

let isInitialized = false;

export async function initWASMCompute() {
  if (isInitialized) return true;
  await init(); // Fetches and instantiates the WASM module
  isInitialized = true;
  return true;
}

export async function executeWASMCompute(indicator, inputData, period) {
  if (!isInitialized) {
    await initWASMCompute();
  }
  
  // inputData is assumed to be a Float32Array containing 'close' prices
  if (indicator === 'SMA') {
    return CPUMathEngine.calculate_sma(inputData, period);
  } else if (indicator === 'EMA') {
    return CPUMathEngine.calculate_ema(inputData, period);
  } else {
    // If we haven't implemented RSI in WASM yet, fallback to a JS error or fake it
    throw new Error(`WASM function calculate_${indicator.toLowerCase()} not found`);
  }
}
