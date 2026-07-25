// src_demo/utils/wasmCompute.ts

import init, { CPUMathEngine, UniversalTranslator } from '../core_math_rust/pkg/quantaai_math_engine.ts';

let isInitialized = false;
export let wasmUniversalTranslator: UniversalTranslator | null = null;

export async function initWASMCompute() {
  if (isInitialized) return true;
  await init(); // Fetches and instantiates the WASM module
  wasmUniversalTranslator = new UniversalTranslator();
  isInitialized = true;
  return true;
}

export async function executeWASMCompute(indicator, inputData, params = {}) {
  if (!isInitialized) {
    await initWASMCompute();
  }
  
  // inputData is assumed to be a Float32Array containing 'close' prices
  if (indicator === 'SMA') {
    return CPUMathEngine.calculate_sma(inputData, params.period || 14);
  } else if (indicator === 'EMA') {
    return CPUMathEngine.calculate_ema(inputData, params.period || 14);
  } else if (indicator === 'RSI') {
    return CPUMathEngine.calculate_rsi(inputData, params.period || 14);
  } else if (indicator === 'BB') {
    return CPUMathEngine.calculate_bb(inputData, params.period || 20, params.stdDev || 2.0);
  } else if (indicator === 'MACD') {
    return CPUMathEngine.calculate_macd(
      inputData, 
      params.fastPeriod || 12, 
      params.slowPeriod || 26, 
      params.signalPeriod || 9
    );
  } else {
    throw new Error(`WASM function calculate_${indicator.toLowerCase()} not found`);
  }
}
