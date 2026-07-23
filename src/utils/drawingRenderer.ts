import { colorToPixiHex } from './drawingStore';

/**
 * Renders a single drawing onto a PixiJS Graphics object.
 *
 * @param {Object} d The drawing data object ({ type, start, end, ... })
 * @param {Graphics} graphics The PixiJS Graphics instance
 * @param {Function} getPixel Function that converts (time, price) -> {x, y}
 * @param {Function} drawText Callback to render text: drawText(text, x, y, options)
 * @param {Object} options Canvas dimensions, candles data, etc.
 * @param {boolean} isTemp Is this the temporary shape being drawn?
 * @param {boolean} isSelected Is this shape currently selected?
 */
export function renderDrawing(d, graphics, getPixel, drawText, options, isTemp = false, isSelected = false) {
  const { width, height, allCandles } = options;

  const color = isTemp ? '#00ffff' : (d.color || '#7C5CFF');
  const pixiColor = colorToPixiHex(color);
  const opacity = d.opacity !== undefined ? d.opacity / 100 : 0.08;
  const fillColor = isTemp ? 0x00ffff : colorToPixiHex(d.fillColor || color);
  const fillAlpha = isTemp ? 0.08 : (d.fillColor ? 1 : opacity);
  
  const lineWidth = d.lineWidth || 2;
  const lineStyle = isTemp ? 'solid' : (d.lineStyle || 'solid');

  // Helper for drawing lines with dash support (simulated if necessary, 
  // PixiJS v8 doesn't have native setLineDash on Graphics, but we can do a solid line for now
  // or use a dashed texture/shader later).
  const strokeOptions = { color: pixiColor, width: lineWidth };
  
  const drawLine = (p1, p2, widthOverride) => {
    graphics.moveTo(p1.x, p1.y);
    graphics.lineTo(p2.x, p2.y);
    graphics.stroke({ ...strokeOptions, width: widthOverride || lineWidth });
  };

  const p1 = d.start ? getPixel(d.start.time, d.start.price) : null;
  const p2 = d.end ? getPixel(d.end.time, d.end.price) : null;

  if (d.type === 'brush' && d.points && d.points.length > 0) {
    const pts = d.points.map(pt => getPixel(pt.time, pt.price)).filter(Boolean);
    if (pts.length > 0) {
      graphics.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        graphics.lineTo(pts[i].x, pts[i].y);
      }
      graphics.stroke(strokeOptions);
    }
    return; // Selection handled differently for brush if needed
  }

  if (!p1 && !d.points) return;

  // ---------------------------------------------------------
  // Shape Rendering
  // ---------------------------------------------------------

  if (d.type === 'trendline') {
    if (p2) drawLine(p1, p2);
  } 
  else if (d.type === 'ray') {
    if (p2) {
      const m = (p2.y - p1.y) / (p2.x - p1.x);
      let endX, endY;
      if (p2.x > p1.x) {
        endX = width; endY = p1.y + m * (width - p1.x);
      } else if (p2.x < p1.x) {
        endX = 0; endY = p1.y - m * p1.x;
      } else {
        endX = p1.x; endY = p2.y > p1.y ? height : 0;
      }
      drawLine(p1, { x: endX, y: endY });
    }
  } 
  else if (d.type === 'infoline') {
    if (p2) {
      drawLine(p1, p2);
      const priceDiff = d.end.price - d.start.price;
      const pctChange = (priceDiff / d.start.price) * 100;
      const txt = `${priceDiff >= 0 ? '+' : ''}${priceDiff.toFixed(2)} (${pctChange >= 0 ? '+' : ''}${pctChange.toFixed(2)}%)`;
      drawText(txt, (p1.x + p2.x)/2 + 5, (p1.y + p2.y)/2 - 5, { fill: pixiColor, fontSize: 10 });
    }
  } 
  else if (d.type === 'extendedline') {
    if (p2) {
      const m = (p2.y - p1.y) / (p2.x - p1.x);
      let pA, pB;
      if (p2.x === p1.x) {
        pA = { x: p1.x, y: 0 }; pB = { x: p1.x, y: height };
      } else {
        pA = { x: 0, y: p1.y - m * p1.x }; pB = { x: width, y: p1.y + m * (width - p1.x) };
      }
      drawLine(pA, pB);
    }
  } 
  else if (d.type === 'trendangle') {
    if (p2) {
      drawLine(p1, p2);
      drawLine(p1, { x: p1.x + 80, y: p1.y }, 1); // Dash line simulation
      
      const angle = Math.round(Math.atan2(-(p2.y - p1.y), p2.x - p1.x) * 180 / Math.PI);
      drawText(`${angle}°`, p1.x + 35, p1.y - 5, { fill: pixiColor, fontSize: 10 });
    }
  } 
  else if (d.type === 'horizontal_line') {
    drawLine({ x: 0, y: p1.y }, { x: width, y: p1.y });
  } 
  else if (d.type === 'horizontal_ray') {
    drawLine(p1, { x: width, y: p1.y });
  } 
  else if (d.type === 'vertical_line') {
    drawLine({ x: p1.x, y: 0 }, { x: p1.x, y: height });
  } 
  else if (d.type === 'crossline') {
    drawLine({ x: 0, y: p1.y }, { x: width, y: p1.y });
    drawLine({ x: p1.x, y: 0 }, { x: p1.x, y: height });
  } 
  else if (d.type === 'channel') {
    if (p2) {
      drawLine(p1, p2);
      const offset = 40;
      drawLine({ x: p1.x, y: p1.y + offset }, { x: p2.x, y: p2.y + offset });
      drawLine({ x: p1.x, y: p1.y + offset / 2 }, { x: p2.x, y: p2.y + offset / 2 }, 1);
    }
  } 
  else if (d.type === 'fibonacci' || d.type === 'fib_extension') {
    if (p2) {
      const isExt = d.type === 'fib_extension';
      const levels = isExt ? [0, 0.618, 1, 1.618, 2.618] : [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.618];
      const colors = [0xf23645, 0xff9800, 0x4caf50, 0x009688, 0x2196f3, 0x9c27b0, 0x7c5cff, 0x7c5cff];
      
      levels.forEach((lvl, idx) => {
        const lvlPrice = d.start.price + lvl * (d.end.price - d.start.price);
        const lvlPixel = getPixel(d.start.time, lvlPrice);
        if (lvlPixel) {
          drawLine({ x: 0, y: lvlPixel.y }, { x: width, y: lvlPixel.y }, 1);
          drawText(`${isExt ? 'Ext ' : ''}${lvl} (${lvlPrice.toFixed(2)})`, 10, lvlPixel.y - 13, { fill: pixiColor, fontSize: 9 });
          
          if (!isExt && idx < levels.length - 1) {
            const nextLvl = levels[idx + 1];
            const nextPrice = d.start.price + nextLvl * (d.end.price - d.start.price);
            const nextPixel = getPixel(d.start.time, nextPrice);
            if (nextPixel) {
              graphics.rect(0, Math.min(lvlPixel.y, nextPixel.y), width, Math.abs(nextPixel.y - lvlPixel.y));
              graphics.fill({ color: colors[idx % colors.length], alpha: 0.05 });
            }
          }
        }
      });
    }
  } 
  else if (d.type === 'pitchfork' || d.type === 'andrews_pitchfork' || d.type === 'schiff_pitchfork') {
    if (p2) {
      let pt1 = p1, pt2 = p2;
      let offset = 30;
      if (d.type === 'schiff_pitchfork') {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        pt1 = { x: (p1.x + p2.x)/2, y: (p1.y + p2.y)/2 };
        pt2 = { x: pt1.x + dx, y: pt1.y + dy };
      }
      drawLine(pt1, pt2);
      drawLine({ x: pt1.x, y: pt1.y - offset }, { x: pt2.x, y: pt2.y - offset });
      drawLine({ x: pt1.x, y: pt1.y + offset }, { x: pt2.x, y: pt2.y + offset });
    }
  } 
  else if (d.type === 'polyline') {
    if (p2) {
      const dx = p2.x - p1.x; const dy = p2.y - p1.y;
      const ptA = { x: p1.x + dx * 0.33, y: p1.y + dy * 0.75 };
      const ptB = { x: p1.x + dx * 0.66, y: p1.y + dy * 0.25 };
      graphics.moveTo(p1.x, p1.y);
      graphics.lineTo(ptA.x, ptA.y);
      graphics.lineTo(ptB.x, ptB.y);
      graphics.lineTo(p2.x, p2.y);
      graphics.stroke(strokeOptions);
      
      [p1, ptA, ptB, p2].forEach(pt => {
        graphics.circle(pt.x, pt.y, 3);
        graphics.fill({ color: pixiColor });
      });
    }
  } 
  else if (d.type === 'fib_timezone') {
    if (p2) {
      const baseGap = Math.abs(p2.x - p1.x) || 24;
      const fibs = [0, 1, 2, 3, 5, 8, 13, 21, 34, 55];
      fibs.forEach((f) => {
        const lineX = p1.x + f * baseGap;
        if (lineX >= 0 && lineX <= width) {
          drawLine({ x: lineX, y: 0 }, { x: lineX, y: height });
          drawText(`F${f}`, lineX + 4, 18, { fill: pixiColor, fontSize: 9, fontFamily: 'monospace' });
        }
      });
    }
  } 
  else if (d.type === 'regression_trend') {
    if (p2 && allCandles?.length > 1) {
      const startT = Math.min(d.start.time, d.end.time);
      const endT = Math.max(d.start.time, d.end.time);
      const rangeCandles = allCandles.filter(c => c.time >= startT && c.time <= endT);
      if (rangeCandles.length > 1) {
        const n = rangeCandles.length;
        let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
        for (let i = 0; i < n; i++) {
          sumX += i; sumY += rangeCandles[i].close;
          sumXY += i * rangeCandles[i].close; sumXX += i * i;
        }
        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;
        let sumSqDiff = 0;
        for (let i = 0; i < n; i++) {
          sumSqDiff += Math.pow(rangeCandles[i].close - (slope * i + intercept), 2);
        }
        const stdDev = Math.sqrt(sumSqDiff / n);
        
        const pStart = getPixel(rangeCandles[0].time, intercept);
        const pEnd = getPixel(rangeCandles[n-1].time, slope * (n - 1) + intercept);
        const pStartUp = getPixel(rangeCandles[0].time, intercept + stdDev * 1.5);
        const pEndUp = getPixel(rangeCandles[n-1].time, slope * (n - 1) + intercept + stdDev * 1.5);
        const pStartDown = getPixel(rangeCandles[0].time, intercept - stdDev * 1.5);
        const pEndDown = getPixel(rangeCandles[n-1].time, slope * (n - 1) + intercept - stdDev * 1.5);
        
        if (pStart && pEnd && pStartUp && pEndUp && pStartDown && pEndDown) {
          drawLine(pStart, pEnd, 2);
          drawLine(pStartUp, pEndUp, 1);
          drawLine(pStartDown, pEndDown, 1);
          
          graphics.moveTo(pStartUp.x, pStartUp.y);
          graphics.lineTo(pEndUp.x, pEndUp.y);
          graphics.lineTo(pEndDown.x, pEndDown.y);
          graphics.lineTo(pStartDown.x, pStartDown.y);
          graphics.fill({ color: pixiColor, alpha: 0.1 });
        }
      }
    }
  } 
  else if (['gann_square', 'gann_box', 'rectangle'].includes(d.type)) {
    if (p2) {
      const minX = Math.min(p1.x, p2.x); const minY = Math.min(p1.y, p2.y);
      const w = Math.abs(p2.x - p1.x); const h = Math.abs(p2.y - p1.y);
      graphics.rect(minX, minY, w, h);
      graphics.fill({ color: fillColor, alpha: fillAlpha });
      graphics.stroke(strokeOptions);
      
      if (d.type === 'gann_square') {
        drawLine(p1, p2);
        drawLine({ x: p1.x, y: p2.y }, { x: p2.x, y: p1.y });
      } else if (d.type === 'gann_box') {
        const gridRatios = [0.25, 0.382, 0.5, 0.618, 0.75];
        gridRatios.forEach(r => {
          const gridX = p1.x + r * (p2.x - p1.x);
          const gridY = p1.y + r * (p2.y - p1.y);
          drawLine({ x: gridX, y: p1.y }, { x: gridX, y: p2.y }, 1);
          drawLine({ x: p1.x, y: gridY }, { x: p2.x, y: gridY }, 1);
        });
      }
    }
  } 
  else if (d.type === 'circle' || d.type === 'ellipse') {
    if (p2) {
      if (d.type === 'circle') {
        const radius = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
        graphics.circle(p1.x, p1.y, radius);
      } else {
        graphics.ellipse(p1.x, p1.y, Math.abs(p2.x - p1.x), Math.abs(p2.y - p1.y));
      }
      graphics.fill({ color: fillColor, alpha: fillAlpha });
      graphics.stroke(strokeOptions);
    }
  } 
  else if (d.type === 'triangle') {
    if (p2) {
      graphics.moveTo((p1.x + p2.x) / 2, Math.min(p1.y, p2.y));
      graphics.lineTo(p1.x, Math.max(p1.y, p2.y));
      graphics.lineTo(p2.x, Math.max(p1.y, p2.y));
      graphics.closePath();
      graphics.fill({ color: fillColor, alpha: fillAlpha });
      graphics.stroke(strokeOptions);
    }
  } 
  else if (d.type === 'curve') {
    if (p2) {
      graphics.moveTo(p1.x, p1.y);
      const cx = (p1.x + p2.x) / 2;
      const cy = Math.min(p1.y, p2.y) - 30;
      graphics.quadraticCurveTo(cx, cy, p2.x, p2.y);
      graphics.stroke(strokeOptions);
    }
  } 
  else if (['text', 'note', 'price_note', 'callout', 'signpost', 'icon_up', 'icon_down', 'icon_star', 'icon_heart'].includes(d.type)) {
    if (d.type === 'text') {
      drawText(d.text || 'Text', p1.x, p1.y, { fill: isTemp ? 0x00ffff : 0xffffff, fontSize: 12 });
    } else if (d.type === 'note') {
      graphics.rect(p1.x, p1.y, 100, 30);
      graphics.fill({ color: 0x191919, alpha: 0.85 });
      graphics.stroke({ color: 0xffffff, width: 1 });
      drawText(d.text || 'Note', p1.x + 5, p1.y + 10, { fill: 0xffffff, fontSize: 10 });
    } else if (d.type === 'price_note') {
      graphics.rect(p1.x, p1.y - 10, 60, 20);
      graphics.fill({ color: pixiColor, alpha: 1 });
      drawText(`$${d.start.price.toFixed(2)}`, p1.x + 5, p1.y - 8, { fill: 0xffffff, fontSize: 9, fontFamily: 'monospace' });
    } else if (d.type === 'callout') {
      graphics.rect(p1.x + 10, p1.y - 40, 80, 25);
      graphics.moveTo(p1.x, p1.y); graphics.lineTo(p1.x + 10, p1.y - 25); graphics.lineTo(p1.x + 18, p1.y - 25); graphics.closePath();
      graphics.fill({ color: 0x7c5cff, alpha: 0.2 });
      graphics.stroke({ color: pixiColor, width: 1 });
      drawText(d.text || 'Callout', p1.x + 15, p1.y - 35, { fill: 0xffffff, fontSize: 10 });
    } else if (d.type === 'signpost') {
      drawLine(p1, { x: p1.x, y: p1.y - 30 });
      graphics.rect(p1.x, p1.y - 30, 60, 15);
      graphics.fill({ color: pixiColor, alpha: 1 });
      drawText(d.text || 'Info', p1.x + 4, p1.y - 28, { fill: 0xffffff, fontSize: 9 });
    } else if (d.type.startsWith('icon_')) {
      const iconChar = { icon_up: '⬆️', icon_down: '⬇️', icon_star: '⭐', icon_heart: '❤️' }[d.type] || '📍';
      drawText(iconChar, p1.x - 8, p1.y - 8, { fontSize: 16 });
    }
  } 
  else if (d.type === 'xabcd' || d.type === 'elliott_wave' || d.type === 'abcd' || d.type === 'head_shoulders') {
    if (p2) {
      let pts = [];
      const dx = p2.x - p1.x; const dy = p2.y - p1.y;
      
      if (d.type === 'xabcd') {
        pts = [
          { x: p1.x, y: p1.y, lbl: 'X' }, { x: p1.x + dx * 0.25, y: p1.y - dy * 0.5, lbl: 'A' },
          { x: p1.x + dx * 0.5, y: p1.y, lbl: 'B' }, { x: p1.x + dx * 0.75, y: p1.y - dy * 0.3, lbl: 'C' },
          { x: p2.x, y: p2.y, lbl: 'D' }
        ];
      } else if (d.type === 'elliott_wave') {
        pts = [
          { x: p1.x, y: p1.y, lbl: '0' }, { x: p1.x + dx * 0.2, y: p1.y - dy * 0.4, lbl: '1' },
          { x: p1.x + dx * 0.4, y: p1.y - dy * 0.1, lbl: '2' }, { x: p1.x + dx * 0.6, y: p1.y - dy * 0.9, lbl: '3' },
          { x: p1.x + dx * 0.8, y: p1.y - dy * 0.5, lbl: '4' }, { x: p2.x, y: p2.y, lbl: '5' }
        ];
      } else if (d.type === 'abcd') {
        pts = [
          { x: p1.x, y: p1.y, lbl: 'A' }, { x: p1.x + dx/3, y: p1.y + dy/2, lbl: 'B' },
          { x: p1.x + 2*dx/3, y: p1.y - dy/4, lbl: 'C' }, { x: p2.x, y: p2.y, lbl: 'D' }
        ];
      }
      
      if (d.type === 'head_shoulders') {
        const w = p2.x - p1.x; const h = p1.y - p2.y; const base = p1.y;
        graphics.moveTo(p1.x, base);
        graphics.lineTo(p1.x + w*0.2, base - h*0.5); graphics.lineTo(p1.x + w*0.4, base);
        graphics.lineTo(p1.x + w*0.5, base - h); graphics.lineTo(p1.x + w*0.6, base);
        graphics.lineTo(p1.x + w*0.8, base - h*0.5); graphics.lineTo(p2.x, base);
        graphics.stroke(strokeOptions);
        drawLine({ x: p1.x, y: base }, { x: p2.x, y: base }, 1);
      } else {
        graphics.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) graphics.lineTo(pts[i].x, pts[i].y);
        graphics.stroke(strokeOptions);
        pts.forEach(pt => {
          graphics.circle(pt.x, pt.y, 4);
          graphics.fill({ color: pixiColor });
          drawText(pt.lbl, pt.x - 3, pt.y - 12, { fill: 0xffffff, fontSize: 9, fontWeight: 'bold' });
        });
      }
    }
  } 
  else if (d.type === 'long_position' || d.type === 'short_position') {
    if (p2) {
      const entryY = p1.y; const targetY = p2.y;
      const stopY = d.type === 'long_position' ? entryY + (entryY - targetY) / 1.5 : entryY - (targetY - entryY) / 1.5;
      const w = Math.abs(p2.x - p1.x); const x = Math.min(p1.x, p2.x);
      
      graphics.rect(x, Math.min(entryY, targetY), w, Math.abs(entryY - targetY));
      graphics.fill({ color: 0x089981, alpha: 0.15 });
      graphics.stroke({ color: 0x089981, width: 1 });

      graphics.rect(x, Math.min(entryY, stopY), w, Math.abs(entryY - stopY));
      graphics.fill({ color: 0xf23645, alpha: 0.15 });
      graphics.stroke({ color: 0xf23645, width: 1 });
      
      drawText(`Risk/Reward: 1.5`, x + 5, d.type === 'long_position' ? entryY - 14 : entryY + 5, { fill: 0xffffff, fontSize: 9, fontWeight: 'bold' });
    }
  } 
  else if (d.type === 'price_range' || d.type === 'date_range' || d.type === 'date_price_range' || d.type === 'ruler') {
    if (p2) {
      const minX = Math.min(p1.x, p2.x); const minY = Math.min(p1.y, p2.y);
      const w = Math.abs(p2.x - p1.x); const h = Math.abs(p2.y - p1.y);
      
      graphics.rect(
        d.type === 'price_range' ? 0 : minX,
        d.type === 'date_range' ? 0 : minY,
        d.type === 'price_range' ? width : w,
        d.type === 'date_range' ? height : h
      );
      graphics.fill({ color: 0x2962ff, alpha: 0.08 });
      graphics.stroke({ color: 0x2962ff, width: 1 });
      
      if (d.type === 'price_range') {
        const diff = d.end.price - d.start.price;
        const pct = (diff / d.start.price) * 100;
        drawText(`Price: ${diff.toFixed(2)} (${pct.toFixed(2)}%)`, p1.x + 10, minY + h/2, { fill: 0x2962ff, fontSize: 10 });
      } else if (d.type === 'date_range') {
        const bars = Math.round(w / 8);
        drawText(`${bars} Bars`, minX + w/2 - 15, height - 20, { fill: 0x2962ff, fontSize: 10 });
      } else if (d.type === 'ruler') {
        drawLine(p1, p2, 1);
        const diff = d.end.price - d.start.price;
        const pct = (diff / d.start.price) * 100;
        drawText(`${diff >= 0 ? '+' : ''}${diff.toFixed(2)} (${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%)`, minX + w/2 - 30, minY + h/2 - 5, { fill: 0x2962ff, fontSize: 11, fontWeight: 'bold' });
      }
    }
  }

  // ---------------------------------------------------------
  // Selection Highlight
  // ---------------------------------------------------------
  if (isSelected && p1) {
    [p1, p2].forEach(pt => {
      if (pt) {
        graphics.circle(pt.x, pt.y, 4.5);
        graphics.fill({ color: 0xffffff, alpha: 1 });
        graphics.stroke({ color: 0x2962ff, width: 1.5 });
      }
    });
  }
}
