export function renderVolumeProfile(graphics, options, getPixel) {
  const { visibleRange, allCandles, darkMode, width } = options;
  if (!visibleRange || !allCandles || allCandles.length === 0) return;

  const startT = visibleRange.from;
  const endT = visibleRange.to;
  const visibleCandles = allCandles.filter(c => c.time >= startT && c.time <= endT);
  
  if (visibleCandles.length === 0) return;

  let minPrice = Infinity;
  let maxPrice = -Infinity;
  visibleCandles.forEach(c => {
    if (c.low < minPrice) minPrice = c.low;
    if (c.high > maxPrice) maxPrice = c.high;
  });

  if (maxPrice <= minPrice) return;

  const numBins = 24;
  const binSize = (maxPrice - minPrice) / numBins;
  const bins = Array.from({ length: numBins }, () => ({ upVolume: 0, downVolume: 0, totalVolume: 0 }));

  visibleCandles.forEach(c => {
    const price = (c.open + c.high + c.low + c.close) / 4;
    const binIdx = Math.min(numBins - 1, Math.max(0, Math.floor((price - minPrice) / binSize)));
    const vol = c.volume || 0;
    if (c.close >= c.open) {
      bins[binIdx].upVolume += vol;
    } else {
      bins[binIdx].downVolume += vol;
    }
    bins[binIdx].totalVolume += vol;
  });

  let maxBinVol = 0;
  bins.forEach(b => {
    if (b.totalVolume > maxBinVol) maxBinVol = b.totalVolume;
  });

  if (maxBinVol === 0) return;

  const maxBarWidth = width * 0.20; // 20% of chart width

  for (let i = 0; i < numBins; i++) {
    const bin = bins[i];
    if (bin.totalVolume === 0) continue;

    const binMinPrice = minPrice + i * binSize;
    const binMaxPrice = binMinPrice + binSize;
    
    const pMin = getPixel(visibleCandles[0].time, binMinPrice);
    const pMax = getPixel(visibleCandles[0].time, binMaxPrice);
    
    if (!pMin || !pMax) continue;
    const yMin = pMin.y;
    const yMax = pMax.y;

    const yStart = Math.min(yMin, yMax);
    const barHeight = Math.max(1, Math.abs(yMin - yMax) - 1);

    const upRatio = bin.upVolume / bin.totalVolume;
    const totalWidth = (bin.totalVolume / maxBinVol) * maxBarWidth;
    const upWidth = totalWidth * upRatio;
    const downWidth = totalWidth * (1 - upRatio);

    // Draw Up Volume (Green)
    graphics.rect(0, yStart, upWidth, barHeight);
    graphics.fill({ color: 0x089981, alpha: darkMode ? 0.25 : 0.2 });

    // Draw Down Volume (Red)
    graphics.rect(upWidth, yStart, downWidth, barHeight);
    graphics.fill({ color: 0xf23645, alpha: darkMode ? 0.25 : 0.2 });
  }
}

export function renderSessionDividers(graphics, options, getPixel) {
  const { visibleRange, allCandles, darkMode, height } = options;
  if (!visibleRange || !allCandles || allCandles.length < 2) return;

  const startIdx = allCandles.findIndex(c => c.time >= visibleRange.from);
  const endIdx = allCandles.findIndex(c => c.time > visibleRange.to);
  const sIdx = startIdx === -1 ? 0 : startIdx;
  const eIdx = endIdx === -1 ? allCandles.length - 1 : endIdx;

  for (let i = Math.max(1, sIdx); i <= eIdx; i++) {
    const prev = allCandles[i - 1];
    const curr = allCandles[i];
    if (prev && curr) {
      const prevDate = typeof prev.time === 'number' ? new Date(prev.time * 1000) : new Date(prev.time);
      const currDate = typeof curr.time === 'number' ? new Date(curr.time * 1000) : new Date(curr.time);
      
      if (prevDate.getUTCDate() !== currDate.getUTCDate()) {
        const p = getPixel(curr.time, curr.close);
        if (p && p.x >= 0) {
          graphics.moveTo(p.x, 0);
          graphics.lineTo(p.x, height);
          graphics.stroke({ color: darkMode ? 0xffffff : 0x000000, alpha: darkMode ? 0.08 : 0.06, width: 1 });
          // Note: dashed line omitted for simplicity in PixiJS v8 graphics, solid line looks okay for dividers with low alpha
        }
      }
    }
  }
}

export function renderHoverTools(graphics, drawText, options) {
  const { hoverCoords, activeTool, cursorSettings, magicTrail, width, height, coordinateToTimePrice } = options;
  if (!hoverCoords || !activeTool) return;

  const hexColor = cursorSettings.color.startsWith('#') ? parseInt(cursorSettings.color.slice(1), 16) : 0xffffff;
  const opacity = cursorSettings.opacity / 100;

  if (activeTool === 'crosshair') {
    if (cursorSettings.extendLines) {
      graphics.moveTo(hoverCoords.x, 0);
      graphics.lineTo(hoverCoords.x, height);
      graphics.moveTo(0, hoverCoords.y);
      graphics.lineTo(width, hoverCoords.y);
    } else {
      graphics.moveTo(hoverCoords.x - 8, hoverCoords.y);
      graphics.lineTo(hoverCoords.x + 8, hoverCoords.y);
      graphics.moveTo(hoverCoords.x, hoverCoords.y - 8);
      graphics.lineTo(hoverCoords.x, hoverCoords.y + 8);
    }
    graphics.stroke({ color: hexColor, width: cursorSettings.size, alpha: opacity });
  } 
  else if (activeTool === 'dot') {
    graphics.circle(hoverCoords.x, hoverCoords.y, cursorSettings.size * 1.5 + 2);
    graphics.fill({ color: hexColor, alpha: opacity });
    graphics.stroke({ color: 0x000000, width: 1 });
  } 
  else if (activeTool === 'demonstration') {
    graphics.circle(hoverCoords.x, hoverCoords.y, 4);
    graphics.fill({ color: hexColor, alpha: 1 });
    
    const pulseRadius = cursorSettings.size * 4 + Math.sin(Date.now() / 120) * 3;
    graphics.circle(hoverCoords.x, hoverCoords.y, pulseRadius);
    graphics.fill({ color: hexColor, alpha: opacity * 0.3 });
    graphics.stroke({ color: hexColor, width: 1, alpha: 0.5 });
  } 
  else if (activeTool === 'magic' && magicTrail) {
    magicTrail.forEach((p, idx) => {
      const alpha = ((idx + 1) / magicTrail.length) * opacity;
      drawText('⭐', p.x - p.size/2, p.y - p.size/2, { fontSize: p.size + cursorSettings.size, fill: hexColor, alpha });
    });
    drawText('🪄', hoverCoords.x, hoverCoords.y, { fontSize: 16 });
  }

  if (cursorSettings.showTooltip && ['crosshair', 'dot', 'demonstration', 'magic'].includes(activeTool) && coordinateToTimePrice) {
    const tp = coordinateToTimePrice(hoverCoords.x, hoverCoords.y);
    if (tp && tp.time && tp.price !== undefined) {
      const timeStr = typeof tp.time === 'number' ? new Date(tp.time * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : String(tp.time);
      const text = `${timeStr} | $${tp.price.toFixed(2)}`;
      
      const boxW = 110;
      const boxH = 18;
      const tooltipX = Math.min(hoverCoords.x + 10, width - boxW - 5);
      const tooltipY = Math.min(hoverCoords.y - 12, height - boxH - 5);
      
      graphics.roundRect(tooltipX, tooltipY, boxW, boxH, 4);
      graphics.fill({ color: 0x1c2030, alpha: 0.9 });
      graphics.stroke({ color: 0x2a2e39, width: 1 });
      
      drawText(text, tooltipX + 5, tooltipY + 2, { fill: 0xffffff, fontSize: 9, fontFamily: 'monospace' });
    }
  }
}
