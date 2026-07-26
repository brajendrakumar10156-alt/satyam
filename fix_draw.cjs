const fs = require('fs');
let content = fs.readFileSync('src/WebContainer.tsx', 'utf8');

const getPixelReplacement = 
  const getPixel = useCallback((time, price) => {
    const vr = nativeVisibleRange || viewportSnapshotRef.current?.visibleRange;
    if (vr && vr.startIndex !== undefined) {
      // Native engine logic
      const candleIdx = allCandles.findIndex(c => c.time === time);
      if (candleIdx === -1) return null;
      
      const { startIndex, endIndex, minPrice, maxPrice, width, height } = vr;
      const visiblePoints = endIndex - startIndex;
      const priceSpread = maxPrice - minPrice;
      
      if (visiblePoints <= 0 || priceSpread <= 0) return null;
      
      const x = ((candleIdx - startIndex) / visiblePoints) * width;
      const y = height - (((price - minPrice) / priceSpread) * height);
      return { x, y };
    }
    
    if ((renderEngine === 'webgl' || renderEngine === 'webgpu') && webGLEngineRef.current) {
      return webGLEngineRef.current.getPixel(time, price);
    }
    if (!chartInstance.current || !candleSeries.current) return null;
    const x = chartInstance.current.timeScale().timeToCoordinate(time);
    const y = candleSeries.current.priceToCoordinate(price);
    return { x, y };
  }, [renderEngine, nativeVisibleRange, allCandles]);
;

const coordReplacement = 
  const coordinateToTimePrice = useCallback((x, y) => {
    const vr = nativeVisibleRange || viewportSnapshotRef.current?.visibleRange;
    if (vr && vr.startIndex !== undefined) {
      const { startIndex, endIndex, minPrice, maxPrice, width, height } = vr;
      const visiblePoints = endIndex - startIndex;
      const priceSpread = maxPrice - minPrice;
      
      if (width === 0 || height === 0) return null;
      
      const candleIdx = Math.round(startIndex + (x / width) * visiblePoints);
      const targetCandle = allCandles[Math.max(0, Math.min(allCandles.length - 1, candleIdx))];
      
      const price = minPrice + ((height - y) / height) * priceSpread;
      
      return { time: targetCandle?.time || 0, price };
    }
    
    if ((renderEngine === 'webgl' || renderEngine === 'webgpu') && webGLEngineRef.current) {
      return webGLEngineRef.current.coordinateToTimePrice(x, y);
    }
    if (!chartInstance.current || !candleSeries.current || !chartRef.current) return null;
    
    const w = chartRef.current.clientWidth;
    const h = chartRef.current.clientHeight;
    const clampedX = Math.max(0, Math.min(w - 55, x));
    const clampedY = Math.max(0, Math.min(h - 26, y));

    const time = chartInstance.current.timeScale().coordinateToTime(clampedX);
    const price = candleSeries.current.coordinateToPrice(clampedY);
    
    return { time, price };
  }, [renderEngine, nativeVisibleRange, allCandles]);
;

const lines = content.split('\n');
let newLines = [];
let skipGetPixel = false;
let skipCoord = false;
let braceCount = 0;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('const getPixel = useCallback((time, price) => {')) {
    skipGetPixel = true;
    braceCount = 0;
    newLines.push(getPixelReplacement.trim());
  }
  
  if (lines[i].includes('const coordinateToTimePrice = useCallback((x, y) => {')) {
    skipCoord = true;
    braceCount = 0;
    newLines.push(coordReplacement.trim());
  }

  if (skipGetPixel) {
    braceCount += (lines[i].match(/\{/g) || []).length;
    braceCount -= (lines[i].match(/\}/g) || []).length;
    if (braceCount === 0 && lines[i].includes('}, [renderEngine]);')) skipGetPixel = false;
    continue;
  }
  
  if (skipCoord) {
    braceCount += (lines[i].match(/\{/g) || []).length;
    braceCount -= (lines[i].match(/\}/g) || []).length;
    if (braceCount === 0 && lines[i].includes('}, [renderEngine]);')) skipCoord = false;
    continue;
  }
  
  newLines.push(lines[i]);
}

fs.writeFileSync('src/WebContainer.tsx', newLines.join('\n'), 'utf8');
console.log("Updated getPixel and coordinateToTimePrice");
