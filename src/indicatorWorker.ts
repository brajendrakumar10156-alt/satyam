import { INDICATOR_REGISTRY } from './indicatorsRegistry';

self.onmessage = (e) => {
  const { action, payload } = e.data;
  
  if (action === 'computeAll') {
    const { candles, indicators } = payload;
    const resultsMap = {};
    
    indicators.forEach(ind => {
      if (!ind.visible) return;
      const reg = INDICATOR_REGISTRY[ind.type];
      if (!reg) return;
      try {
        resultsMap[ind.id] = reg.compute(candles, ind.params);
      } catch (err) {
        console.error(`[Worker] Error computing ${ind.id}:`, err);
      }
    });
    
    self.postMessage({ type: 'computeAllDone', resultsMap });
  }
};
