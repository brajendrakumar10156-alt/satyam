import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';

import { INDICATOR_REGISTRY } from '../indicatorsRegistry';
import { calculateHorizontalTimeAxisLabels, calculateVerticalPriceAxisLabels } from '../utils/axisCollisionEngine';
import { Application, Graphics, Container, Text, TextStyle } from 'pixi.js';

// ─────────────────────────────────────────────────────────────────────────────
// Dashed line helper
// ─────────────────────────────────────────────────────────────────────────────
const drawDashedLine = (g, x1, y1, x2, y2, dash = 4, gap = 4) => {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return;
  const steps = len / (dash + gap);
  for (let i = 0; i < steps; i++) {
    const sx = x1 + (dx / len) * (i * (dash + gap));
    const sy = y1 + (dy / len) * (i * (dash + gap));
    let ex = sx + (dx / len) * dash;
    let ey = sy + (dy / len) * dash;
    if ((dx > 0 && ex > x2) || (dx < 0 && ex < x2)) ex = x2;
    if ((dy > 0 && ey > y2) || (dy < 0 && ey < y2)) ey = y2;
    g.moveTo(sx, sy).lineTo(ex, ey);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// WebGLChartEngine — Index-Based Coordinate System (TradingView-style)
//
// KEY DESIGN: viewportRef.timeRange.{from,to} are CANDLE INDICES (floats).
// This eliminates weekend gaps and gives perfectly even candle spacing.
// Time labels are placed at real candle positions → no floating labels.
// ─────────────────────────────────────────────────────────────────────────────
const WebGLChartEngine = forwardRef(({
  width, height, candles, visualIndicators, indicatorDataMap, darkMode, autoScale,
  initialVisibleRange, onVisibleRangeChange, onChartReady, activeTool, isHoveringDrawing, timezoneOffset = 0,
  onRequestDraw
}, ref) => {

  const containerRef   = useRef(null);
  const appRef         = useRef(null);
  const activeToolRef  = useRef(activeTool);
  const isHoveringDrawingRef = useRef(isHoveringDrawing);
  useEffect(() => { isHoveringDrawingRef.current = isHoveringDrawing; }, [isHoveringDrawing]);
  const dprRef         = useRef(Math.max(1, Math.round(window.devicePixelRatio || 1)));

  useEffect(() => { activeToolRef.current = activeTool; }, [activeTool]);

  // Layers
  const gridLayerRef       = useRef(null);
  const volumeLayerRef     = useRef(null);
  const candleLayerRef     = useRef(null);
  const indicatorLayerRef  = useRef(null);
  const crosshairLayerRef  = useRef(null);
  const axesTextContainerRef = useRef(null);
  const crosshairTextContainerRef = useRef(null);
  const livePriceLayerRef  = useRef(null);
  const axesBgLayerRef     = useRef(null);
  const livePriceTopLayerRef = useRef(null);

  // Viewport: timeRange in CANDLE INDEX space
  const viewportRef = useRef({
    timeRange:  { from: 0, to: 100 },
    priceRange: { min: 0, max: 1 },
    manualPriceScale: false,
    pAxisW: 64,
  });

  const cachedStyles = useRef({
    darkMode: null, axisText: null, axisTextBoldDark: null,
    axisTextBoldLight: null, crosshairText: null, livePriceText: null,
  });

  const interactionRef = useRef({
    isDragging: false, hoverX: -1, hoverY: -1, isHovering: false,
    lastX: 0, lastY: 0, velocityX: 0, isGliding: false,
    lastDragTime: 0, dragType: 'chart',
  });

  // ── Text Pool ──────────────────────────────────────────────────────────────
  const textPoolRef = useRef([]);

  const getPooledText = (index, style, isCrosshair = false) => {
    let t = textPoolRef.current[index];
    if (!t) {
      t = new Text({ text: '', style, resolution: dprRef.current });
      if (isCrosshair) {
        crosshairTextContainerRef.current.addChild(t);
      } else {
        axesTextContainerRef.current.addChild(t);
      }
      textPoolRef.current[index] = t;
    } else {
      // Ensure it is in the correct container if we're reusing it
      if (isCrosshair && t.parent !== crosshairTextContainerRef.current) {
        crosshairTextContainerRef.current.addChild(t);
      } else if (!isCrosshair && t.parent !== axesTextContainerRef.current) {
        axesTextContainerRef.current.addChild(t);
      }
    }
    t.visible    = true;
    t.style      = style;
    t.resolution = dprRef.current;
    return t;
  };

  const hideUnusedTexts = (from) => {
    for (let i = from; i < textPoolRef.current.length; i++)
      textPoolRef.current[i].visible = false;
  };

  // ── Index ↔ Time converters ────────────────────────────────────────────────
  // Binary search: timestamp → float candle index
  const timeToIndex = (time, arr = candles) => {
    if (!arr || arr.length === 0) return 0;
    if (time <= arr[0].time)               return 0;
    if (time >= arr[arr.length - 1].time)  return arr.length - 1;
    let lo = 0, hi = arr.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (arr[mid].time === time) return mid;
      if (arr[mid].time < time)  lo = mid + 1;
      else                        hi = mid - 1;
    }
    if (hi < 0) return 0;
    if (lo >= arr.length) return arr.length - 1;
    const t0 = arr[hi].time;
    const t1 = arr[lo].time;
    return hi + (time - t0) / (t1 - t0);
  };

  // Float index → interpolated timestamp
  const indexToTime = (index, arr = candles) => {
    if (!arr || arr.length === 0) return 0;
    if (index <= 0)               return arr[0].time;
    if (index >= arr.length - 1)  return arr[arr.length - 1].time;
    const fl = Math.floor(index), ce = Math.ceil(index);
    if (fl === ce) return arr[fl].time;
    return arr[fl].time + (arr[ce].time - arr[fl].time) * (index - fl);
  };

  // ── Pixel helper: price → y ────────────────────────────────────────────────
  const getP = (price, cH, v) => {
    const _v = v || viewportRef.current;
    const pRange = _v.priceRange.max - _v.priceRange.min || 1;
    const scaleY = ((cH - 24) * 0.80) / pRange;
    return (_v.priceRange.max - price) * scaleY + (cH - 24) * 0.10;
  };

  // ── Pixel helper: candle index → x ────────────────────────────────────────
  const getX = (idx, cW, v) => {
    const _v = v || viewportRef.current;
    const range  = _v.timeRange.to - _v.timeRange.from || 1;
    const scaleX = cW / range;
    return (idx - _v.timeRange.from) * scaleX;
  };

  // ── fireRangeChange ────────────────────────────────────────────────────────
  const fireRangeChange = () => {
    if (onVisibleRangeChange && candles && candles.length > 0) {
      const v = viewportRef.current;
      onVisibleRangeChange({
        from: indexToTime(v.timeRange.from),
        to:   indexToTime(v.timeRange.to),
      });
    }
  };

  // ── Exposed API (drawing layer bridge) ────────────────────────────────────
  useImperativeHandle(ref, () => ({
    // timestamp + price → pixel {x, y}
    getPixel: (time, price) => {
      if (!appRef.current) return { x: 0, y: 0 };
      const cW = appRef.current.screen.width;
      const cH = appRef.current.screen.height;
      const v  = viewportRef.current;
      const idx = timeToIndex(time);
      return { x: getX(idx, cW, v), y: getP(price, cH, v) };
    },
    // pixel → {time (timestamp), price}
    coordinateToTimePrice: (x, y) => {
      if (!appRef.current) return { time: 0, price: 0 };
      const cW = appRef.current.screen.width;
      const cH = appRef.current.screen.height;
      const v  = viewportRef.current;
      const range  = v.timeRange.to - v.timeRange.from || 1;
      const pRange = v.priceRange.max - v.priceRange.min || 1;
      const scaleX = cW / range;
      const scaleY = ((cH - 24) * 0.80) / pRange;
      const idx    = (x / scaleX) + v.timeRange.from;
      return {
        time:  indexToTime(idx),
        price: v.priceRange.max - ((y - (cH - 24) * 0.10) / scaleY),
      };
    },
  }));

  // ── getNicePriceStep: minimum 28px gap between price labels ───────────────
  const calculatePriceStep = (range) => {
    const minGridCount = 12;
    const maxGridCount = 24;
    const roughStep = range / minGridCount;
    const mag = Math.pow(10, Math.floor(Math.log10(roughStep)));
    const norm = roughStep / mag;
    const mult = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
    return mult * mag;
  };

  // ── formatTimeLabel: for crosshair ────────────────────────────────────────
  const formatTimeLabel = (ts) => {
    // ts is in seconds.
    const d = new Date(ts * 1000); // Use local time like WebGPU
    const dd = d.getDate().toString().padStart(2, '0');
    const mo = d.toLocaleString('en-US', { month: 'short' });
    const yy = d.getFullYear().toString().slice(-2);
    const H = d.getHours().toString().padStart(2, '0');
    const M = d.getMinutes().toString().padStart(2, '0');
    return `${dd} ${mo} '${yy} ${H}:${M}`;
  };

  // ════════════════════════════════════════════════════════════════════════════
  // DRAW ALL — main render function
  // ════════════════════════════════════════════════════════════════════════════
  const drawAll = (isPanOnly = false) => {
    if (!appRef.current || !candleLayerRef.current || !candles || candles.length === 0) return;
    const v  = viewportRef.current;
    const cW = appRef.current.screen.width;
    const cH = appRef.current.screen.height;

    // ── Cancel pan-only if offset too large ─────────────────────────────────
    if (isPanOnly && v.lastDrawnFrom !== undefined) {
      const range  = v.timeRange.to - v.timeRange.from || 1;
      const scaleX = cW / range;
      const offset = (v.lastDrawnFrom - v.timeRange.from) * scaleX;
      if (Math.abs(offset) > cW) isPanOnly = false;
    }

    // ── Compute scales & collect visible candles ────────────────────────────
    const range  = v.timeRange.to - v.timeRange.from || 1;
    const scaleX = cW / range;

    let visibleCandles = [];
    if (!isPanOnly) {
      let minP = Infinity, maxP = -Infinity, maxVol = 0;
      const overscanFrom = v.timeRange.from - range;
      const overscanTo   = v.timeRange.to   + range;
      const startI = Math.max(0, Math.floor(overscanFrom));
      const endI   = Math.min(candles.length - 1, Math.ceil(overscanTo));

      for (let i = startI; i <= endI; i++) {
        const c = candles[i];
        if (!c) continue;
        if (i >= v.timeRange.from && i <= v.timeRange.to) {
          if (autoScale && !v.manualPriceScale) {
            if (c.low  < minP) minP = c.low;
            if (c.high > maxP) maxP = c.high;
          }
        }
        visibleCandles.push({ c, idx: i });
        if (c.volume > maxVol) maxVol = c.volume;
      }

      if (autoScale && !v.manualPriceScale && minP !== Infinity) {
        let pad = (maxP - minP) * 0.1;
        if (pad === 0) pad = maxP * 0.01 || 1;
        const targetMin = minP - pad;
        const targetMax = maxP + pad;
        
        const diffMin = targetMin - v.priceRange.min;
        const diffMax = targetMax - v.priceRange.max;
        
        if (Math.abs(diffMin) > 0.000001 || Math.abs(diffMax) > 0.000001) {
           v.priceRange.min += diffMin * 0.4;
           v.priceRange.max += diffMax * 0.4;
           requestAnimationFrame(() => drawAll(false));
        }
      }
      v.maxVol      = maxVol;
      v.lastDrawnFrom = v.timeRange.from;
    }

    const pRange = v.priceRange.max - v.priceRange.min || 1;
    const scaleY = ((cH - 24) * 0.80) / pRange;

    // Pixel helpers with current scale
    const px = (idx)   => (idx   - v.timeRange.from)   * scaleX;
    const py = (price) => (v.priceRange.max - price)    * scaleY + (cH - 24) * 0.10;

    // ── Background ─────────────────────────────────────────────────────────
    if (appRef.current)
      appRef.current.renderer.background.color = darkMode ? 0x0d1117 : 0xffffff;

    gridLayerRef.current.clear();
    axesBgLayerRef.current.clear();
    crosshairLayerRef.current.clear();
    livePriceLayerRef.current.clear();
    if (livePriceTopLayerRef.current) livePriceTopLayerRef.current.clear();

    if (!isPanOnly) {
      volumeLayerRef.current.clear();
      candleLayerRef.current.clear();
      indicatorLayerRef.current.clear();
      candleLayerRef.current.position.x   = 0;
      volumeLayerRef.current.position.x   = 0;
      indicatorLayerRef.current.position.x = 0;
    } else {
      const offset = (v.lastDrawnFrom - v.timeRange.from) * scaleX;
      candleLayerRef.current.position.x   = offset;
      volumeLayerRef.current.position.x   = offset;
      indicatorLayerRef.current.position.x = offset;
    }

    // ── Rebuild TextStyle cache on theme change ───────────────────────────
    if (cachedStyles.current.darkMode !== darkMode) {
      cachedStyles.current.darkMode = darkMode;
      const ff = "'Inter', -apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, sans-serif";
      cachedStyles.current.axisText = new TextStyle({
        fontFamily: ff, fontSize: 11, fontWeight: '400',
        fill: darkMode ? '#c9d1d9' : '#131722',
      });
      cachedStyles.current.axisTextBoldDark = new TextStyle({
        fontFamily: ff, fontSize: 11, fontWeight: '600', fill: '#d1d5db',
      });
      cachedStyles.current.axisTextBoldLight = new TextStyle({
        fontFamily: ff, fontSize: 11, fontWeight: '600', fill: '#1f2937',
      });
      cachedStyles.current.crosshairText = new TextStyle({
        fontFamily: ff, fontSize: 11, fontWeight: 'bold', fill: darkMode ? 0xffffff : 0x131722,
      });
      cachedStyles.current.livePriceText = new TextStyle({
        fontFamily: ff, fontSize: 11, fontWeight: 'bold', fill: 0xffffff,
      });
    }
    const textStyle = cachedStyles.current.axisText;

    // ── Dynamic price axis width ──────────────────────────────────────────
    const longestLabel = Math.max(
      v.priceRange.max.toFixed(2).length,
      v.priceRange.min.toFixed(2).length,
    );
    const pAxisW = Math.max(50, longestLabel * 6 + 14);
    v.pAxisW     = pAxisW;
    const pAxisX = Math.floor(cW - pAxisW);
    const timeAxisY = Math.floor(cH - 24);

    // Update clipping mask for the graph area
    if (appRef.current && appRef.current.graphMask) {
       appRef.current.graphMask.clear();
       appRef.current.graphMask.rect(0, 0, pAxisX, timeAxisY).fill({ color: 0xffffff });
    }

    // Axis backgrounds — pixel-floor aligned (Stopping at the intersection, no corner square)
    const axisBgColor = darkMode ? 0x0d1117 : 0xffffff;
    axesBgLayerRef.current.rect(0,      timeAxisY, pAxisX, 24       ).fill({ color: axisBgColor });
    axesBgLayerRef.current.rect(pAxisX, 0,         pAxisW, timeAxisY).fill({ color: axisBgColor });

    // Axis Borders
    const axisBorderColor = darkMode ? 0x2B2F36 : 0xe0e3eb;
    axesBgLayerRef.current.moveTo(pAxisX, 0);
    axesBgLayerRef.current.lineTo(pAxisX, timeAxisY);
    axesBgLayerRef.current.moveTo(0, timeAxisY);
    axesBgLayerRef.current.lineTo(pAxisX, timeAxisY);
    axesBgLayerRef.current.stroke({ width: 1, color: axisBorderColor });

    const gridColor = darkMode ? 0x2B2F36 : 0xe0e3eb;
    const gridAlpha = 1.0;

    let textIndex = 0;

    // ── Grid & Price labels ───────────────────────────────────────────────
    const paddingY = (cH - 24) * 0.10;
    const topPrice = v.priceRange.max + (paddingY / scaleY);
    const bottomPrice = v.priceRange.max - (((cH - 24) - paddingY) / scaleY);
    
    const pStep = calculatePriceStep(topPrice - bottomPrice);
    for (let p = Math.floor(bottomPrice / pStep) * pStep; p <= topPrice; p += pStep) {
      if (p === 0 && bottomPrice < 0) continue; // Skip zero line if it clutters

      const y = Math.round(py(p)) + 0.5;      // Horizontal grid line
      gridLayerRef.current.moveTo(0, y);
      gridLayerRef.current.lineTo(pAxisX, y);
      gridLayerRef.current.stroke({ width: 1 / dprRef.current, color: gridColor, alpha: gridAlpha });

      const txt = getPooledText(textIndex++, textStyle);
      txt.text = p.toFixed(2);
      txt.anchor.set(0.5, 0.5);
      txt.x    = Math.floor(pAxisX + pAxisW / 2);
      txt.y    = Math.floor(y);
    }

    // ══════════════════════════════════════════════════════════════════════
    // ── Advanced Spatial Collision (Time Axis) ──────────────────────────
    // Generate candidates
    const rawTimeLabels = [];
    const firstI = Math.max(0, Math.floor(v.timeRange.from));
    const lastI  = Math.min(candles.length - 1, Math.ceil(v.timeRange.to));
    let lastMonth = -1, lastDay = -1;
    for (let i = firstI; i <= lastI; i++) {
       const c = candles[i];
       if (!c) continue;
       const x = Math.round(px(i)) + 0.5;
       if (x < -20 || x > cW + 20) continue;
       
       const d = new Date((c.time + timezoneOffset) * 1000);
       const mon = d.getUTCMonth();
       const day = d.getUTCDate();
       const H = d.getUTCHours();
       const M = d.getUTCMinutes();
       
       const isNewMonth = (mon !== lastMonth && lastMonth !== -1);
       const isNewDay = (day !== lastDay && lastDay !== -1) && !isNewMonth;
       lastMonth = mon; lastDay = day;
       
       const isNewYear = isNewMonth && d.getUTCMonth() === 0;
       
       let isMajor = false;
       let label = '';
       if (isNewYear) { label = d.getUTCFullYear().toString(); isMajor = true; }
       else if (isNewMonth) { label = d.toLocaleString('default', { month: 'short', timeZone: 'UTC' }); isMajor = true; }
       else if (isNewDay) { label = `${d.getUTCDate()} ${d.toLocaleString('default', { month: 'short', timeZone: 'UTC' })}`; isMajor = true; }
        else {
          // Dynamic robust spacing based on zoom, increased density
          const tickSpacing = Math.max(1, Math.floor(((v.timeRange.to - v.timeRange.from) || 1) / 40));
          if (i % tickSpacing !== 0) continue;
          label = `${H.toString().padStart(2, '0')}:${M.toString().padStart(2, '0')}`;
       }
       rawTimeLabels.push({ x, size: 40, label, isMajor, color: gridColor });
    }
    
    // NATIVE MATH: 1D Spatial Filter
    const timeAxisWinners = calculateHorizontalTimeAxisLabels({
      timeLabels: rawTimeLabels,
      cW,
      pAxisW: cW - pAxisX
    });
    
    // ── Draw survivors ───────────────────────────────
    timeAxisWinners.forEach(({ x, label, isMajor }) => {
        // x is already extracted
        const style = isMajor
          ? (darkMode ? cachedStyles.current.axisTextBoldDark : cachedStyles.current.axisTextBoldLight)
          : textStyle;

        // Draw grid tick
        gridLayerRef.current.moveTo(x, timeAxisY);
        gridLayerRef.current.lineTo(x, timeAxisY + 3);
        
        // Visible vertical grid line
        gridLayerRef.current.moveTo(x, 0);
        gridLayerRef.current.lineTo(x, timeAxisY);
        
        const pt = getPooledText(textIndex++, style);
        pt.text = label;
        pt.anchor.set(0.5, 0);
        pt.x    = Math.floor(x);
        pt.y    = timeAxisY + 4;
    });
    // Batch stroke grid lines
    gridLayerRef.current.stroke({ width: 1 / dprRef.current, color: gridColor, alpha: gridAlpha });


    // ── Volume bars ──────────────────────────────────────────────────────
    const cW2 = Math.max(0, Math.floor((scaleX * 0.8) / 2));
    const rectW = Math.max(1, cW2 * 2 + 1); // ensures perfectly centered odd width

    if (!isPanOnly && visibleCandles.length > 0 && v.maxVol > 0) {
      for (const { c, idx } of visibleCandles) {
        const sxRaw = (idx - v.lastDrawnFrom) * scaleX;
        const left  = Math.round(sxRaw) - cW2;
        const volH  = (c.volume / v.maxVol) * (cH * 0.15);
        const isUp  = c.close >= c.open;
        const color = isUp ? 0x10b981 : 0xef4444;

        volumeLayerRef.current
          .rect(left, timeAxisY - volH, rectW, volH)
          .fill({ color, alpha: 0.35 });
      }
    }

    // ── Candles ───────────────────────────────────────────────────────────
    if (!isPanOnly) {
      for (const { c, idx } of visibleCandles) {
        const sxRaw  = (idx - v.lastDrawnFrom) * scaleX;
        const sx     = Math.round(sxRaw) + 0.5; // Snap to 0.5 for crisp 1px wicks
        const left   = Math.round(sxRaw) - cW2;
        
        const yOpen  = py(c.open);
        const yClose = py(c.close);
        const yHigh  = Math.round(py(c.high)) + 0.5;
        const yLow   = Math.round(py(c.low)) + 0.5;
        const isUp   = c.close >= c.open;
        const color  = isUp ? 0x10b981 : 0xef4444;

        // Wick
        candleLayerRef.current.moveTo(sx, yHigh).lineTo(sx, yLow).stroke({ width: 1 / dprRef.current, color });
        
        // Body
        const top    = Math.min(yOpen, yClose);
        const bottom = Math.max(yOpen, yClose);
        const bodyH  = Math.max(1, Math.round(bottom - top));
        const bodyY  = Math.round(top);
        candleLayerRef.current.rect(left, bodyY, rectW, bodyH).fill({ color });
      }
    }

    // ── Indicators (Overlays) ─────────────────────────────────────────────
    if (!isPanOnly && visualIndicators && indicatorDataMap) {
      const activeOverlays = visualIndicators.filter(i => i.visible && INDICATOR_REGISTRY[i.type]?.kind === 'overlay');
      activeOverlays.forEach(ind => {
        const reg = INDICATOR_REGISTRY[ind.type];
        const dataObj = indicatorDataMap[ind.id];
        if (!reg || !dataObj) return;
        
        reg.seriesConfig.forEach(series => {
          const lineData = dataObj[series.key];
          if (!lineData || lineData.length === 0) return;
          const opts = series.options(ind.params, ind.color);
          
          let colorStr = opts.color || '#2962ff';
          let colorNum = 0x2962ff;
          let alpha = 1.0;
          if (colorStr.startsWith('#')) {
            colorNum = parseInt(colorStr.replace('#', '0x'), 16) || 0x2962ff;
          } else if (colorStr.startsWith('rgba')) {
            const parts = colorStr.match(/[\d.]+/g);
            if (parts && parts.length >= 4) {
              colorNum = (parseInt(parts[0]) << 16) + (parseInt(parts[1]) << 8) + parseInt(parts[2]);
              alpha = parseFloat(parts[3]);
            }
          }
          
          const thickness = opts.lineWidth || 1.5;
          let started = false;
          
          for (let i = 0; i < lineData.length; i++) {
            const pt = lineData[i];
            const idx = timeToIndex(pt.time);
            if (idx < v.timeRange.from - 5 || idx > v.timeRange.to + 5) continue;
            
            const sx = (idx - v.lastDrawnFrom) * scaleX;
            const sy = py(pt.value);
            
            if (!started) {
              indicatorLayerRef.current.moveTo(sx, sy);
              started = true;
            } else {
              indicatorLayerRef.current.lineTo(sx, sy);
            }
          }
          if (started) {
            indicatorLayerRef.current.stroke({ width: thickness, color: colorNum, alpha: alpha });
          }
        });
      });
    }

    // ── Live price line ───────────────────────────────────────────────────
    const lastIdx = candles.length - 1;
    const lastC  = candles[lastIdx];
    const isUp   = lastC.close >= lastC.open;
    const liveColor = isUp ? 0x089981 : 0xf23645;
    const lastY  = Math.round(py(lastC.close)) + 0.5;
    
    // Start from the right edge of the last candle to prevent any overlapping/cutting
    const candleWidth = Math.max(1, Math.floor(scaleX * 0.8));
    const lastX  = Math.round(px(lastIdx) + (candleWidth / 2)) + 0.5; 

    livePriceLayerRef.current.moveTo(lastX, lastY).lineTo(pAxisX, lastY);
    livePriceLayerRef.current.stroke({ width: 1 / dprRef.current, color: liveColor, alpha: 1.0 });

    const pillY = Math.floor(lastY - 10);
    if (livePriceTopLayerRef.current) {
      livePriceTopLayerRef.current.rect(pAxisX, pillY, pAxisW, 20).fill({ color: liveColor });
      const liveTxt = getPooledText(textIndex++, cachedStyles.current.livePriceText, true);
      liveTxt.text = lastC.close.toFixed(2);
      liveTxt.x    = Math.floor(pAxisX + (pAxisW - liveTxt.width) / 2);
      liveTxt.y    = pillY + 3;
    }

    // ── Indicator lines ───────────────────────────────────────────────────
    if (!isPanOnly && visualIndicators && indicatorDataMap) {
      visualIndicators.forEach(ind => {
        const dataObj = indicatorDataMap[ind.id];
        const reg = INDICATOR_REGISTRY[ind.type];
        if (!dataObj || !reg || reg.kind !== 'overlay') return;
        
        reg.seriesConfig.forEach(series => {
          const lineData = dataObj[series.key];
          if (!lineData || lineData.length < 2) return;
          
          const opts = series.options(ind.params, ind.color);
          const indColor = parseInt((opts.color || ind.color || '#ffaa00').replace('#', ''), 16) || 0xffaa00;
          const thickness = opts.lineWidth || 2;
          
          let first = true;
          for (let i = 0; i < lineData.length; i++) {
            const d = lineData[i];
            const idx = timeToIndex(d.time);
            if (idx >= v.timeRange.from - 50 && idx <= v.timeRange.to + 50) {
              const sx = (idx - v.lastDrawnFrom) * scaleX;
              const sy = py(d.value);
              if (first) { indicatorLayerRef.current.moveTo(sx, sy); first = false; }
              else         indicatorLayerRef.current.lineTo(sx, sy);
            }
          }
          if (!first) indicatorLayerRef.current.stroke({ width: thickness, color: indColor });
        });
      });
    }

    // ── Crosshair ────────────────────────────────────────────────────────
    const { isHovering, hoverX, hoverY } = interactionRef.current;
    if (isHovering && hoverX >= 0 && hoverX <= cW && hoverY >= 0 && hoverY <= cH) {
      const crossColor = darkMode ? 0xB4BED2 : 0x646E82;

      // Magnet: snap to nearest candle x
      const nearestIdx = Math.max(0, Math.min(candles.length - 1,
        Math.round((hoverX / scaleX) + v.timeRange.from)));
      const snapX = Math.round(px(nearestIdx)) + 0.5;
      const snapY = Math.round(hoverY) + 0.5;

      crosshairLayerRef.current.moveTo(0, snapY).lineTo(pAxisX, snapY);
      crosshairLayerRef.current.moveTo(snapX, 0).lineTo(snapX, timeAxisY);
      crosshairLayerRef.current.stroke({ width: 1 / dprRef.current, color: crossColor, alpha: 0.4 });

      // Dot on close price
      const dotY = Math.round(py(candles[nearestIdx].close)) + 0.5;
      crosshairLayerRef.current.circle(snapX, dotY, 3.5).fill({ color: darkMode ? 0xffffff : 0x000000 });

      const boxColor = darkMode ? 0x2a2e39 : 0xe0e3eb;

      // Price label box
      const pAtMouse = v.priceRange.max - ((hoverY - (cH - 24) * 0.10) / scaleY);
      const priceTxt = getPooledText(textIndex++, cachedStyles.current.crosshairText, true);
      priceTxt.text  = pAtMouse.toFixed(2);
      const pBoxY = Math.floor(hoverY - 11);
      const pBoxX = pAxisX + 2;
      const pBoxW = pAxisW - 4;
      crosshairLayerRef.current.roundRect(pBoxX, pBoxY, pBoxW, 22, 3).fill({ color: boxColor });
      priceTxt.x = Math.floor(pBoxX + (pBoxW - priceTxt.width) / 2);
      priceTxt.y = pBoxY + 4;

      // Time label box — shows timestamp of snapped candle
      const hoverTime = indexToTime(nearestIdx);
      const timeTxt   = getPooledText(textIndex++, cachedStyles.current.crosshairText, true);
      timeTxt.text = formatTimeLabel(hoverTime);
      const tBoxW = Math.ceil(timeTxt.width) + 16;
      const tBoxX = Math.floor(snapX - tBoxW / 2);
      const tBoxY = timeAxisY + 2;
      crosshairLayerRef.current.roundRect(tBoxX, tBoxY, tBoxW, 22, 3).fill({ color: boxColor });
      timeTxt.x = tBoxX + 8;
      timeTxt.y = tBoxY + 4;
    }

    hideUnusedTexts(textIndex);

    if (onRequestDraw) {
      onRequestDraw();
    }
  };

  // ════════════════════════════════════════════════════════════════════════════
  // INIT PIXI
  // ════════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!containerRef.current) return;
    let isMounted = true;

    const initPixi = async () => {
      const app = new Application();
      dprRef.current = Math.max(1, Math.round(window.devicePixelRatio || 1));
      await app.init({
        resizeTo:        containerRef.current,
        backgroundColor: darkMode ? 0x0d1117 : 0xffffff,
        preference:      'webgl',
        preserveDrawingBuffer: true,
        antialias:       true,            // crisp GPU lines & text edges
        resolution:      dprRef.current,  // exact screen pixel density
        autoDensity:     true,            // canvas CSS size auto-scaled
      });

      if (!isMounted) { app.destroy(true, { children: true }); return; }

      app.canvas.style.position = 'absolute';
      app.canvas.style.top      = '0';
      app.canvas.style.left     = '0';
      containerRef.current.appendChild(app.canvas);

      gridLayerRef.current      = new Graphics();
      volumeLayerRef.current    = new Graphics();
      candleLayerRef.current    = new Graphics();
      indicatorLayerRef.current = new Graphics();
      crosshairLayerRef.current = new Graphics();
      livePriceLayerRef.current = new Graphics();
      axesBgLayerRef.current    = new Graphics();
      axesTextContainerRef.current = new Container();
      crosshairTextContainerRef.current = new Container();
      livePriceTopLayerRef.current = new Graphics();

      // Mask for graph layers to prevent drawing under axes
      const graphMask = new Graphics();
      app.stage.addChild(graphMask);
      
      gridLayerRef.current.mask = graphMask;
      volumeLayerRef.current.mask = graphMask;
      candleLayerRef.current.mask = graphMask;
      indicatorLayerRef.current.mask = graphMask;
      
      // Store mask for resizing
      app.graphMask = graphMask;

      app.stage.addChild(gridLayerRef.current);
      app.stage.addChild(livePriceLayerRef.current);
      app.stage.addChild(crosshairLayerRef.current);
      app.stage.addChild(volumeLayerRef.current);
      app.stage.addChild(candleLayerRef.current);
      app.stage.addChild(indicatorLayerRef.current);
      app.stage.addChild(axesBgLayerRef.current);
      app.stage.addChild(axesTextContainerRef.current);
      app.stage.addChild(livePriceTopLayerRef.current);
      app.stage.addChild(crosshairTextContainerRef.current);

      appRef.current = app;

      // Set initial viewport in INDEX space
      if (candles && candles.length > 0) {
        if (initialVisibleRange?.visibleRange) {
          const fromIdx = timeToIndex(initialVisibleRange.visibleRange.from, candles);
          const toIdx   = timeToIndex(initialVisibleRange.visibleRange.to,   candles);
          viewportRef.current.timeRange = { from: fromIdx, to: toIdx };
        } else {
          viewportRef.current.timeRange = {
            from: Math.max(0, candles.length - 100),
            to:   candles.length - 1,
          };
        }
      }

      const ro = new ResizeObserver(() => drawAll());
      ro.observe(containerRef.current);

      // ── Wheel: zoom or horizontal pan ────────────────────────────────
      app.canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const v = viewportRef.current;
        const cW = app.screen.width;
        const range = v.timeRange.to - v.timeRange.from || 1;
        const scaleX = cW / range;
        const isPan = Math.abs(e.deltaX) > Math.abs(e.deltaY) && !e.ctrlKey;

        if (!isPan) {
          // Zoom around mouse position
          const zoom         = Math.exp(-e.deltaY * 0.001);
          const idxAtMouse   = (e.offsetX / scaleX) + v.timeRange.from;
          const newRange     = range / zoom;
          const ratio        = e.offsetX / cW;
          v.timeRange.from   = idxAtMouse - newRange * ratio;
          v.timeRange.to     = idxAtMouse + newRange * (1 - ratio);
          fireRangeChange();
          drawAll();
        } else {
          // Pan
          const idxShift   = e.deltaX / scaleX;
          v.timeRange.from += idxShift;
          v.timeRange.to   += idxShift;
          fireRangeChange();
          drawAll(true);
        }
      }, { passive: false });

      // ── Pointer down ──────────────────────────────────────────────────
      app.canvas.addEventListener('pointerdown', (e) => {
        const v  = viewportRef.current;
        const cW = app.screen.width;
        const cH = app.screen.height;
        
        let dragType = 'chart';
        if      (e.offsetX > cW - (v.pAxisW || 64)) dragType = 'price';
        else if (e.offsetY > cH - 24)               dragType = 'time';
        
        if (dragType === 'chart' && (activeToolRef.current || isHoveringDrawingRef.current)) return;
        
        interactionRef.current.isDragging   = true;
        interactionRef.current.isGliding    = false;
        interactionRef.current.velocityX    = 0;
        interactionRef.current.lastX        = e.offsetX;
        interactionRef.current.lastY        = e.offsetY;
        interactionRef.current.lastDragTime = performance.now();
        interactionRef.current.dragType     = dragType;
      });

      // ── Double-click: reset price scale ──────────────────────────────
      app.canvas.addEventListener('dblclick', () => {
        viewportRef.current.manualPriceScale = false;
        drawAll();
      });

      // ── Pointer up ────────────────────────────────────────────────────
      window.addEventListener('pointerup', () => {
        if (!interactionRef.current.isDragging) return;
        interactionRef.current.isDragging = false;
        const now = performance.now();
        const { lastDragTime, velocityX } = interactionRef.current;
        if (now - lastDragTime < 100 && Math.abs(velocityX) > 0.05) {
          interactionRef.current.isGliding = true;
        } else {
          interactionRef.current.velocityX = 0;
          drawAll(false); // Force full re-render and auto-scale
        }
      });

      app.canvas.addEventListener('pointerleave', () => {
        interactionRef.current.isHovering = false;
        drawAll();
      });

      app.canvas.addEventListener('pointerenter', () => {
        interactionRef.current.isHovering = true;
      });

      // ── Pointer move ──────────────────────────────────────────────────
      app.canvas.addEventListener('pointermove', (e) => {
        interactionRef.current.hoverX = e.offsetX;
        interactionRef.current.hoverY = e.offsetY;
        const v  = viewportRef.current;
        const cW = app.screen.width;
        const cH = app.screen.height;

        if (!interactionRef.current.isDragging && !activeToolRef.current) {
          if      (e.offsetX > cW - (v.pAxisW || 50)) app.canvas.style.cursor = 'ns-resize';
          else if (e.offsetY > cH - 24)               app.canvas.style.cursor = 'ew-resize';
          else                                         app.canvas.style.cursor = 'crosshair';
        }

        if (interactionRef.current.isDragging && !activeToolRef.current) {
          const now    = performance.now();
          const dx     = e.offsetX - interactionRef.current.lastX;
          const dy     = e.offsetY - interactionRef.current.lastY;
          const dt     = Math.max(1, now - interactionRef.current.lastDragTime);
          const range  = v.timeRange.to - v.timeRange.from || 1;
          const scaleX = cW / range;
          const pRange = v.priceRange.max - v.priceRange.min || 1;
          const scaleY = ((cH - 24) * 0.80) / pRange;

          if (interactionRef.current.dragType === 'chart') {
            interactionRef.current.velocityX = dx / dt;
            const idxShift   = dx / scaleX;
            v.timeRange.from -= idxShift;
            v.timeRange.to   -= idxShift;
            if (v.manualPriceScale) {
              const priceShift  = dy / scaleY;
              v.priceRange.min += priceShift;
              v.priceRange.max += priceShift;
            }
            fireRangeChange();
            drawAll();

          } else if (interactionRef.current.dragType === 'price') {
            v.manualPriceScale   = true;
            const zoomY          = Math.exp(dy * 0.005);
            const priceAtMouse   = v.priceRange.max - ((e.offsetY - (cH - 24) * 0.10) / scaleY);
            const newPRange      = pRange / zoomY;
            const ratioY         = (e.offsetY - (cH - 24) * 0.10) / ((cH - 24) * 0.80);
            v.priceRange.max     = priceAtMouse + newPRange * ratioY;
            v.priceRange.min     = priceAtMouse - newPRange * (1 - ratioY);
            drawAll();

          } else if (interactionRef.current.dragType === 'time') {
            const zoomX      = Math.exp(-dx * 0.005);
            const idxAtMouse = (e.offsetX / scaleX) + v.timeRange.from;
            const newRange   = range / zoomX;
            const ratioX     = e.offsetX / cW;
            v.timeRange.from = idxAtMouse - newRange * ratioX;
            v.timeRange.to   = idxAtMouse + newRange * (1 - ratioX);
            fireRangeChange();
            drawAll();
          }

          interactionRef.current.lastX        = e.offsetX;
          interactionRef.current.lastY        = e.offsetY;
          interactionRef.current.lastDragTime = now;
          return;
        }
        drawAll();
      });

      // ── Momentum glide ticker ────────────────────────────────────────
      app.ticker.add((ticker) => {
        if (!interactionRef.current.isGliding) return;
        const vx = interactionRef.current.velocityX;
        if (Math.abs(vx) < 0.01) {
          interactionRef.current.isGliding = false;
          interactionRef.current.velocityX = 0;
          drawAll(false); // Force full re-render and auto-scale when glide stops
          return;
        }
        const v      = viewportRef.current;
        const cW     = app.screen.width;
        const range  = v.timeRange.to - v.timeRange.from || 1;
        const scaleX = cW / range;
        const dx     = vx * 16 * (ticker.deltaTime || 1);
        v.timeRange.from -= dx / scaleX;
        v.timeRange.to   -= dx / scaleX;
        interactionRef.current.velocityX *= 0.90;
        fireRangeChange();
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

  // ── Live candle auto-scroll ────────────────────────────────────────────────
  const lastCandleTimeRef = useRef(null);

  useEffect(() => {
    if (!candles || candles.length === 0) return;
    const v = viewportRef.current;
    const currentLastTime = candles[candles.length - 1].time;
    const prevLastTime    = lastCandleTimeRef.current;

    if (prevLastTime && currentLastTime > prevLastTime) {
      // New candle appeared — auto-scroll only if user was at live edge
      const prevLastIdx = timeToIndex(prevLastTime);
      if (v.timeRange.to >= prevLastIdx - 0.5) {
        const newLastIdx     = candles.length - 1;
        const shift          = newLastIdx - prevLastIdx;
        v.timeRange.from    += shift;
        v.timeRange.to      += shift;
        fireRangeChange();
      }
    }
    lastCandleTimeRef.current = currentLastTime;
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
