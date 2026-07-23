const fs = require('fs');

const content = `import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { Application, Graphics, Container, Text, TextStyle } from 'pixi.js';

const drawDashedLine = (graphics, x1, y1, x2, y2, dash = 4, gap = 4) => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx*dx + dy*dy);
    if (len === 0) return;
    const steps = len / (dash + gap);
    for (let i = 0; i < steps; i++) {
        const sx = x1 + (dx / len) * (i * (dash + gap));
        const sy = y1 + (dy / len) * (i * (dash + gap));
        let ex = sx + (dx / len) * dash;
        let ey = sy + (dy / len) * dash;
        
        if ((dx > 0 && ex > x2) || (dx < 0 && ex < x2)) ex = x2;
        if ((dy > 0 && ey > y2) || (dy < 0 && ey < y2)) ey = y2;
        
        graphics.moveTo(sx, sy).lineTo(ex, ey);
    }
};

const WebGLChartEngine = forwardRef(({
  width, height, candles, visualIndicators, indicatorDataMap, darkMode, autoScale,
  initialVisibleRange, onVisibleRangeChange, onChartReady, activeTool
}, ref) => {
  const containerRef = useRef(null);
  const appRef = useRef(null);
  const activeToolRef = useRef(activeTool);
  
  useEffect(() => {
    activeToolRef.current = activeTool;
  }, [activeTool]);

  // Layers
  const gridLayerRef = useRef(null);
  const volumeLayerRef = useRef(null);
  const candleLayerRef = useRef(null);
  const indicatorLayerRef = useRef(null);
  const crosshairLayerRef = useRef(null);
  const livePriceLayerRef = useRef(null);
  const axesTextContainerRef = useRef(null);
  
  // State
  const viewportRef = useRef({
    timeRange: { from: 0, to: 0 },
    priceRange: { min: 0, max: 0 },
    scaleX: 1, scaleY: 1
  });
  
  const interactionRef = useRef({
    isDragging: false,
    lastX: 0, lastY: 0,
    hoverX: -1000, hoverY: -1000,
    isHovering: false
  });
  
  // Text Pooling
  const textPoolRef = useRef([]);

  const getPooledText = (index, style) => {
    let t = textPoolRef.current[index];
    if (!t) {
      t = new Text({ text: '', style });
      axesTextContainerRef.current.addChild(t);
      textPoolRef.current[index] = t;
    }
    t.visible = true;
    t.style = style;
    return t;
  };
  
  const hideUnusedTexts = (startIndex) => {
    for (let i = startIndex; i < textPoolRef.current.length; i++) {
      textPoolRef.current[i].visible = false;
    }
  };

  const getP = (price, cH) => {
      const v = viewportRef.current;
      return (v.priceRange.max - price) * v.scaleY + (cH * 0.08);
  };
  
  const getT = (time) => {
      const v = viewportRef.current;
      return (time - v.timeRange.from) * v.scaleX;
  };

  useImperativeHandle(ref, () => ({
    getPixel: (time, price) => {
      if (!appRef.current) return { x: 0, y: 0 };
      const cH = appRef.current.screen.height;
      return { x: getT(time), y: getP(price, cH) };
    },
    coordinateToTimePrice: (x, y) => {
      if (!appRef.current) return { time: 0, price: 0 };
      const v = viewportRef.current;
      const cH = appRef.current.screen.height;
      return {
        time: (x / v.scaleX) + v.timeRange.from,
        price: v.priceRange.max - ((y - (cH * 0.08)) / v.scaleY)
      };
    }
  }));

  const formatTime = (ts) => {
    const d = new Date(ts * 1000);
    return \`\${d.getHours().toString().padStart(2, '0')}:\${d.getMinutes().toString().padStart(2, '0')}\`;
  };

  const drawAll = () => {
    if (!appRef.current || !candleLayerRef.current) return;
    const v = viewportRef.current;
    const cW = appRef.current.screen.width;
    const cH = appRef.current.screen.height;

    let visibleCandles = [];
    if (candles && candles.length > 0) {
       let minP = Infinity;
       let maxP = -Infinity;
       let maxVol = 0;
       
       for (let i=0; i<candles.length; i++) {
         const c = candles[i];
         if (c.time >= v.timeRange.from && c.time <= v.timeRange.to) {
           visibleCandles.push(c);
           if (autoScale) {
             if (c.low < minP) minP = c.low;
             if (c.high > maxP) maxP = c.high;
           }
           if (c.volume > maxVol) maxVol = c.volume;
         }
       }
       if (autoScale && visibleCandles.length > 0) {
         v.priceRange.min = minP;
         v.priceRange.max = maxP;
       }
       v.maxVol = maxVol;
    }

    v.scaleX = cW / (v.timeRange.to - v.timeRange.from || 1);
    v.scaleY = (cH * 0.80) / (v.priceRange.max - v.priceRange.min || 1);

    gridLayerRef.current.clear();
    volumeLayerRef.current.clear();
    candleLayerRef.current.clear();
    indicatorLayerRef.current.clear();
    crosshairLayerRef.current.clear();
    livePriceLayerRef.current.clear();

    const gridColor = darkMode ? 0x2A2E39 : 0xE0E3EB;
    const gridAlpha = darkMode ? 0.4 : 0.8;
    const textColor = darkMode ? '#B2B5BE' : '#787B86';
    const textStyle = new TextStyle({
        fontFamily: "'Inter', 'SF Pro Display', -apple-system, sans-serif",
        fontSize: 11,
        fill: textColor
    });
    
    let textIndex = 0;

    const priceDiff = v.priceRange.max - v.priceRange.min;
    const pStep = priceDiff > 0 ? Math.pow(10, Math.floor(Math.log10(priceDiff)) - 1) * 5 : 1;
    const startP = Math.ceil(v.priceRange.min / pStep) * pStep;
    
    for (let p = startP; p <= v.priceRange.max; p += pStep) {
        const y = getP(p, cH);
        gridLayerRef.current.moveTo(0, y).lineTo(cW, y).stroke({ width: 1, color: gridColor, alpha: gridAlpha });
        
        const txt = getPooledText(textIndex++, textStyle);
        txt.text = p.toFixed(2);
        txt.x = cW - txt.width - 5;
        txt.y = y - 7;
    }

    const timeDiff = v.timeRange.to - v.timeRange.from;
    const tStep = timeDiff > 0 ? Math.max(60, Math.floor(timeDiff / 8)) : 60; 
    const startT = Math.ceil(v.timeRange.from / tStep) * tStep;
    
    for (let t = startT; t <= v.timeRange.to; t += tStep) {
        const x = getT(t);
        gridLayerRef.current.moveTo(x, 0).lineTo(x, cH).stroke({ width: 1, color: gridColor, alpha: gridAlpha });
        
        const txt = getPooledText(textIndex++, textStyle);
        txt.text = formatTime(t);
        txt.x = x - txt.width / 2;
        txt.y = cH - 15;
    }

    const candleWidth = Math.max(1, v.scaleX * 0.8 * (candles?.[1]?.time - candles?.[0]?.time || 60));
    if (visibleCandles.length > 0 && v.maxVol > 0) {
      for (const c of visibleCandles) {
          const x = getT(c.time);
          const volH = (c.volume / v.maxVol) * (cH * 0.15);
          const isUp = c.close >= c.open;
          volumeLayerRef.current.rect(x - candleWidth/2, cH - volH, candleWidth, volH).fill({ color: isUp ? 0x089981 : 0xf23645, alpha: 0.35 });
      }
    }

    for (const c of visibleCandles) {
      const x = getT(c.time);
      const yOpen = getP(c.open, cH);
      const yClose = getP(c.close, cH);
      const yHigh = getP(c.high, cH);
      const yLow = getP(c.low, cH);

      const isUp = c.close >= c.open;
      const color = isUp ? 0x089981 : 0xf23645;
      
      candleLayerRef.current.moveTo(x, yHigh).lineTo(x, yLow).stroke({ width: 1, color: color });
      
      const top = Math.min(yOpen, yClose);
      const bottom = Math.max(yOpen, yClose);
      const bodyHeight = Math.max(1, bottom - top);
      
      candleLayerRef.current.rect(x - candleWidth / 2, top, candleWidth, bodyHeight).fill({ color: color });
    }
    
    if (candles && candles.length > 0) {
        const lastC = candles[candles.length - 1];
        const isUp = lastC.close >= lastC.open;
        const color = isUp ? 0x089981 : 0xf23645;
        const lastY = getP(lastC.close, cH);
        
        drawDashedLine(livePriceLayerRef.current, 0, lastY, cW, lastY, 4, 4);
        livePriceLayerRef.current.stroke({ width: 1, color: color, alpha: 0.8 });
        
        const pTxt = getPooledText(textIndex++, new TextStyle({
            fontFamily: "'Inter', sans-serif", fontSize: 11, fill: '#fff'
        }));
        pTxt.text = \` \${lastC.close.toFixed(2)} \`;
        livePriceLayerRef.current.rect(cW - pTxt.width - 4, lastY - 10, pTxt.width + 4, 20).fill({ color: color });
        pTxt.x = cW - pTxt.width - 2;
        pTxt.y = lastY - 7;
    }

    if (visualIndicators && indicatorDataMap) {
        visualIndicators.forEach(ind => {
            const data = indicatorDataMap[ind.id];
            if (!data || data.length === 0) return;
            
            const indColor = parseInt(ind.color.replace('#',''), 16) || 0xffaa00;
            let first = true;
            for (const d of data) {
                if (d.time >= v.timeRange.from - 3600 && d.time <= v.timeRange.to + 3600) {
                   const x = getT(d.time);
                   const y = getP(d.value, cH);
                   if (first) {
                       indicatorLayerRef.current.moveTo(x, y);
                       first = false;
                   } else {
                       indicatorLayerRef.current.lineTo(x, y);
                   }
                }
            }
            if (!first) {
                indicatorLayerRef.current.stroke({ width: 2, color: indColor });
            }
        });
    }

    const { isHovering, hoverX, hoverY } = interactionRef.current;
    if (isHovering && hoverX >= 0 && hoverX <= cW && hoverY >= 0 && hoverY <= cH) {
       const crossColor = darkMode ? 0xB4BED2 : 0x646E82;
       
       drawDashedLine(crosshairLayerRef.current, 0, hoverY, cW, hoverY, 4, 4);
       drawDashedLine(crosshairLayerRef.current, hoverX, 0, hoverX, cH, 4, 4);
       crosshairLayerRef.current.stroke({ width: 1, color: crossColor, alpha: 0.4 });

       const tAtMouse = (hoverX / v.scaleX) + v.timeRange.from;
       const pAtMouse = v.priceRange.max - ((hoverY - (cH * 0.08)) / v.scaleY);

       const boxColor = darkMode ? 0x2a2e39 : 0xe0e3eb;
       const boxTextColor = darkMode ? '#ffffff' : '#000000';

       const pTxt = getPooledText(textIndex++, new TextStyle({
           fontFamily: "'Inter', sans-serif", fontSize: 11, fill: boxTextColor
       }));
       pTxt.text = \` \${pAtMouse.toFixed(2)} \`;
       crosshairLayerRef.current.rect(cW - pTxt.width - 4, hoverY - 10, pTxt.width + 4, 20).fill({ color: boxColor });
       pTxt.x = cW - pTxt.width - 2;
       pTxt.y = hoverY - 7;

       const tTxt = getPooledText(textIndex++, new TextStyle({
           fontFamily: "'Inter', sans-serif", fontSize: 11, fill: boxTextColor
       }));
       tTxt.text = \` \${formatTime(tAtMouse)} \`;
       crosshairLayerRef.current.rect(hoverX - tTxt.width/2 - 2, cH - 20, tTxt.width + 4, 20).fill({ color: boxColor });
       tTxt.x = hoverX - tTxt.width/2;
       tTxt.y = cH - 18;
    }

    hideUnusedTexts(textIndex);
  };

  useEffect(() => {
    if (!containerRef.current) return;
    
    let isMounted = true;
    const initPixi = async () => {
      const app = new Application();
      await app.init({
        resizeTo: containerRef.current,
        backgroundColor: darkMode ? 0x131722 : 0xffffff,
        preference: 'webgl',
        antialias: false,
      });

      if (!isMounted) {
        app.destroy(true, { children: true });
        return;
      }
      
      app.canvas.style.position = 'absolute';
      app.canvas.style.top = '0';
      app.canvas.style.left = '0';
      containerRef.current.appendChild(app.canvas);

      gridLayerRef.current = new Graphics();
      volumeLayerRef.current = new Graphics();
      candleLayerRef.current = new Graphics();
      indicatorLayerRef.current = new Graphics();
      crosshairLayerRef.current = new Graphics();
      livePriceLayerRef.current = new Graphics();
      axesTextContainerRef.current = new Container();

      app.stage.addChild(gridLayerRef.current);
      app.stage.addChild(volumeLayerRef.current);
      app.stage.addChild(candleLayerRef.current);
      app.stage.addChild(indicatorLayerRef.current);
      app.stage.addChild(livePriceLayerRef.current);
      app.stage.addChild(axesTextContainerRef.current);
      app.stage.addChild(crosshairLayerRef.current);
      
      appRef.current = app;

      if (candles && candles.length > 0) {
        if (initialVisibleRange && initialVisibleRange.visibleRange) {
          viewportRef.current.timeRange = { ...initialVisibleRange.visibleRange };
        } else {
          const lastTime = candles[candles.length - 1].time;
          viewportRef.current.timeRange = { from: lastTime - 3600 * 5, to: lastTime + 3600 };
        }
      }

      const resizeOb = new ResizeObserver(() => drawAll());
      resizeOb.observe(containerRef.current);

      app.canvas.addEventListener('wheel', (e) => {
        if (activeToolRef.current) return; // Disable zoom while drawing
        e.preventDefault();
        const v = viewportRef.current;
        const zoom = Math.exp(-e.deltaY * 0.001);
        const mouseX = e.offsetX;
        const timeAtMouse = (mouseX / v.scaleX) + v.timeRange.from;
        
        const range = v.timeRange.to - v.timeRange.from;
        const newRange = range / zoom;
        const ratio = mouseX / app.screen.width;
        
        v.timeRange.from = timeAtMouse - (newRange * ratio);
        v.timeRange.to = timeAtMouse + (newRange * (1 - ratio));
        
        if (onVisibleRangeChange) onVisibleRangeChange({ from: v.timeRange.from, to: v.timeRange.to });
        drawAll();
      });

      app.canvas.addEventListener('pointerdown', (e) => {
        if (activeToolRef.current) return; // Disable drag while drawing
        interactionRef.current.isDragging = true;
        interactionRef.current.lastX = e.offsetX;
      });

      window.addEventListener('pointerup', () => {
        interactionRef.current.isDragging = false;
      });
      
      app.canvas.addEventListener('pointerleave', () => {
        interactionRef.current.isHovering = false;
        drawAll();
      });
      
      app.canvas.addEventListener('pointerenter', () => {
        interactionRef.current.isHovering = true;
      });

      app.canvas.addEventListener('pointermove', (e) => {
        interactionRef.current.hoverX = e.offsetX;
        interactionRef.current.hoverY = e.offsetY;
        
        if (interactionRef.current.isDragging && !activeToolRef.current) {
           const dx = e.offsetX - interactionRef.current.lastX;
           const v = viewportRef.current;
           const timeShift = dx / v.scaleX;
           
           v.timeRange.from -= timeShift;
           v.timeRange.to -= timeShift;
           interactionRef.current.lastX = e.offsetX;
           
           if (onVisibleRangeChange) onVisibleRangeChange({ from: v.timeRange.from, to: v.timeRange.to });
        }
        drawAll();
      });

      if (onChartReady) onChartReady();
      drawAll();
    };

    initPixi();

    return () => {
      isMounted = false;
      if (appRef.current) {
        appRef.current.destroy(true, { children: true });
        appRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    drawAll();
  }, [candles, visualIndicators, indicatorDataMap, darkMode, autoScale]);

  return (
    <div 
      ref={containerRef} 
      className="absolute top-0 left-0 w-full h-full"
      style={{ touchAction: 'none' }}
    />
  );
});

export default WebGLChartEngine;
`;

fs.writeFileSync('src/components/WebGLChartEngine.jsx', content);
console.log('Fixed WebGLChartEngine: Disabled drag and zoom while activeTool is active.');
