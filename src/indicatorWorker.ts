import { INDICATOR_REGISTRY } from './indicatorsRegistry';
import { ComputeBrain } from './utils/ComputeBrain.ts';

self.onmessage = async (e) => {
  const { action, payload } = e.data;
  
  if (action === 'computeAll') {
    const { candles, indicators } = payload;
    const resultsMap = {};
    
    const computePromises = indicators.map(async (ind) => {
      if (!ind.visible) return;
      const reg = INDICATOR_REGISTRY[ind.type];
      if (!reg) return;
      
      try {
        // Fallback or explicit routing logic through ComputeBrain
        // ComputeBrain handles the WASM/GPU/CPU dispatch based on O(1) heuristic
        let result;
        if (['sma', 'rsi'].includes(ind.type.toLowerCase())) {
           result = await ComputeBrain.dispatch(ind.type.toUpperCase(), candles, ind.params);
        } else {
           // For indicators not yet in WGSL/WASM, default back to original ta-math CPU worker
           result = reg.compute(candles, ind.params);
        }
        resultsMap[ind.id] = result;
      } catch (err) {
        console.error(`[Worker] Error computing ${ind.id}:`, err);
      }
    });
    
    await Promise.all(computePromises);
    
    self.postMessage({ type: 'computeAllDone', resultsMap });
  }
};
