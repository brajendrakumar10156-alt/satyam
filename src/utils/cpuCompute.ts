// src_demo/utils/cpuCompute.ts

/**
 * CPU Compute Node.
 * Uses optimized V8 JavaScript.
 * Ideally wrapped in a Web Worker to avoid main-thread locking for huge calculations, 
 * but for this prototype, we simulate the async Worker wrapper.
 */

export async function executeCPUCompute(indicator, inputData, period) {
  return new Promise((resolve) => {
    // We use setTimeout to break out of the synchronous render cycle,
    // simulating a message passing to a Web Worker.
    setTimeout(() => {
      // ta-math usually takes the raw candle objects, but for our compute brain
      // we are passing Float32Arrays. We need to adapt it slightly for testing here.
      
      let out = new Float32Array(inputData.length);
      
      if (indicator === 'SMA') {
        for (let i = period - 1; i < inputData.length; i++) {
          let sum = 0;
          for (let j = 0; j < period; j++) {
            sum += inputData[i - j];
          }
          out[i] = sum / period;
        }
      } 
      else if (indicator === 'RSI') {
        for (let i = period; i < inputData.length; i++) {
          let gainSum = 0;
          let lossSum = 0;
          for (let j = 0; j < period; j++) {
            const diff = inputData[i - j] - inputData[i - j - 1];
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
      }
      
      resolve(out);
    }, 0);
  });
}
