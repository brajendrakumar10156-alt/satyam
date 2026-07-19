import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
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
  initialVisibleRange, onVisibleRangeChange, onChartReady, activeTool, isHoveringDrawing, timezoneOffset = 0
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
  const livePriceLayerRef  = useRef(null);
  const axesBgLayerRef     = useRef(null);
  const axesTextContainerRef = useRef(null);

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

  const getPooledText = (index, style) => {
    let t = textPoolRef.current[index];
    if (!t) {
      t = new Text({ text: '', style, resolution: dprRef.current });
      axesTextContainerRef.current.addChild(t);
      textPoolRef.current[index] = t;
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
    // Interpolate between lo-1 and lo
    const t1 = arr[hi].time, t2 = arr[lo].time;
    return t2 === t1 ? hi : hi + (time - t1) / (t2 - t1);
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
    const scaleY = ((cH - 26) * 0.80) / pRange;
    return (_v.priceRange.max - price) * scaleY + (cH - 26) * 0.10;
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
      const scaleY = ((cH - 26) * 0.80) / pRange;
      const idx    = (x / scaleX) + v.timeRange.from;
      return {
        time:  indexToTime(idx),
        price: v.priceRange.max - ((y - (cH - 26) * 0.10) / scaleY),
      };
    },
  }));

  // ── getNicePriceStep: minimum 28px gap between price labels ───────────────
  const getNicePriceStep = (scaleY) => {
    const rough = 28 / scaleY;
    if (!rough || !isFinite(rough)) return 1;
    const mag  = Math.pow(10, Math.floor(Math.log10(rough)));
    const norm = rough / mag;
    const mult = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
    return mult * mag;
  };

  // ── formatTimeLabel: for crosshair ────────────────────────────────────────
  const formatTimeLabel = (ts) => {
    const d = new Date((ts + timezoneOffset) * 1000);
    const date = `${d.getUTCDate()} ${d.toLocaleString('default', { month: 'short', timeZone: 'UTC' })}`;
    const time = `${d.getUTCHours().toString().padStart(2, '0')}:${d.getUTCMinutes().toString().padStart(2, '0')}`;
    return `${date}  ${time}`;
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
        v.priceRange.min = minP;
        v.priceRange.max = maxP;
      }
      v.maxVol      = maxVol;
      v.lastDrawnFrom = v.timeRange.from;
    }

    const pRange = v.priceRange.max - v.priceRange.min || 1;
    const scaleY = ((cH - 26) * 0.80) / pRange;

    // Pixel helpers with current scale
    const px = (idx)   => (idx   - v.timeRange.from)   * scaleX;
    const py = (price) => (v.priceRange.max - price)    * scaleY + (cH - 26) * 0.10;

    // ── Background ─────────────────────────────────────────────────────────
    if (appRef.current)
      appRef.current.renderer.background.color = darkMode ? 0x0d1117 : 0xffffff;

    gridLayerRef.current.clear();
    axesBgLayerRef.current.clear();
    crosshairLayerRef.current.clear();
    livePriceLayerRef.current.clear();

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
        fontFamily: ff, fontSize: 11, fontWeight: '500',
        fill: darkMode ? '#8b93a6' : '#4b5563',
      });
      cachedStyles.current.axisTextBoldDark = new TextStyle({
        fontFamily: ff, fontSize: 11, fontWeight: 'bold', fill: '#d1d5db',
      });
      cachedStyles.current.axisTextBoldLight = new TextStyle({
        fontFamily: ff, fontSize: 11, fontWeight: 'bold', fill: '#1f2937',
      });
      cachedStyles.current.crosshairText = new TextStyle({
        fontFamily: ff, fontSize: 11, fontWeight: '600',
        fill: darkMode ? '#ffffff' : '#131722',
      });
      cachedStyles.current.livePriceText = new TextStyle({
        fontFamily: ff, fontSize: 11, fontWeight: '600', fill: '#ffffff',
      });
    }
    const textStyle = cachedStyles.current.axisText;

    // ── Dynamic price axis width ──────────────────────────────────────────
    const longestLabel = Math.max(
      v.priceRange.max.toFixed(2).length,
      v.priceRange.min.toFixed(2).length,
    );
    const pAxisW = Math.max(58, longestLabel * 7 + 16);
    v.pAxisW     = pAxisW;
    const pAxisX = Math.floor(cW - pAxisW);
    const timeAxisY = Math.floor(cH - 26);

    // Axis backgrounds — pixel-floor aligned
    const axisBgColor = darkMode ? 0x0d1117 : 0xffffff;
    axesBgLayerRef.current.rect(0,      timeAxisY, cW,    26   ).fill({ color: axisBgColor });
    axesBgLayerRef.current.rect(pAxisX, 0,         pAxisW, cH  ).fill({ color: axisBgColor });

    // Crisp 1px separator lines
    const sepColor = darkMode ? 0x363A45 : 0xDDE0E8;
    axesBgLayerRef.current.moveTo(0,      timeAxisY).lineTo(cW, timeAxisY).stroke({ width: 1, color: sepColor });
    axesBgLayerRef.current.moveTo(pAxisX, 0        ).lineTo(pAxisX, cH   ).stroke({ width: 1, color: sepColor });

    const gridColor = darkMode ? 0x2A2E39 : 0xE0E3EB;
    const gridAlpha = darkMode ? 0.6 : 0.8;

    let textIndex = 0;

    // ── Price (horizontal) grid lines ───────────────────────────────────
    const pStep = getNicePriceStep(scaleY);
    for (let p = Math.floor(v.priceRange.min / pStep) * pStep; p <= v.priceRange.max; p += pStep) {
      const y = Math.round(py(p)) + 0.5;   // pixel-center snap
      drawDashedLine(gridLayerRef.current, 0, y, pAxisX, y, 1, 4);
      gridLayerRef.current.stroke({ width: 1, color: gridColor, alpha: gridAlpha * 0.7 });

      const txt = getPooledText(textIndex++, textStyle);
      txt.text = p.toFixed(2);
      txt.x    = Math.floor(pAxisX + (pAxisW - txt.width) / 2);
      txt.y    = Math.floor(y - 6);
    }

    // ══════════════════════════════════════════════════════════════════════
    // ── Advanced Spatial Collision (Time Axis) ──────────────────────────
    // Generate candidates
    const rawTimeLabels = [];
    const firstI = Math.max(0, Math.floor(v.timeRange.from));
    const lastI  = Math.min(candles.length - 1, Math.ceil(v.timeRange.to));
    for (let i = firstI; i <= lastI; i++) {
       const c = candles[i];
       if (!c) continue;
       const x = Math.round(px(i)) + 0.5;
       if (x < -20 || x > cW + 20) continue;
       
       const d = new Date((c.time + timezoneOffset) * 1000);
       const H = d.getUTCHours(), M = d.getUTCMinutes();
       const isNewDay = H === 0 && M === 0;
       const isNewMonth = isNewDay && d.getUTCDate() === 1;
       const isNewYear = isNewMonth && d.getUTCMonth() === 0;
       
       let isMajor = false;
       let label = '';
       if (isNewYear) { label = d.getUTCFullYear().toString(); isMajor = true; }
       else if (isNewMonth) { label = d.toLocaleString('default', { month: 'short', timeZone: 'UTC' }); isMajor = true; }
       else if (isNewDay) { label = `${d.getUTCDate()} ${d.toLocaleString('default', { month: 'short', timeZone: 'UTC' })}`; isMajor = true; }
       else {
          if ((H * 60 + M) % 15 !== 0) continue;
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
        gridLayerRef.current.moveTo(x, cH - 26);
        gridLayerRef.current.lineTo(x, cH - 23);
        
        // Faint vertical grid line (if you want)
        gridLayerRef.current.moveTo(x, 0);
        gridLayerRef.current.lineTo(x, cH - 26);
        
        const pt = getPooledText(textIndex++, style);
        pt.text = label;
        pt.x    = Math.floor(x - pt.width / 2);
        pt.y    = cH - 20;
    });
    // Batch stroke grid lines
    gridLayerRef.current.stroke({ width: 1, color: gridColor, alpha: gridAlpha * 0.4 });


    // ── Volume bars ──────────────────────────────────────────────────────
    const candleW = Math.max(1, scaleX * 0.8);
    if (!isPanOnly && visibleCandles.length > 0 && v.maxVol > 0) {
      for (const { c, idx } of visibleCandles) {
        const x    = px(idx) - v.lastDrawnFrom * 0 + (idx - v.lastDrawnFrom) * scaleX;
        // Use static x relative to lastDrawnFrom for layer-offset pan
        const sx   = (idx - v.lastDrawnFrom) * scaleX;
        const volH = (c.volume / v.maxVol) * (cH * 0.15);
        const isUp = c.close >= c.open;
        volumeLayerRef.current
          .rect(sx - candleW / 2, timeAxisY - volH, candleW, volH)
          .fill({ color: isUp ? 0x089981 : 0xf23645, alpha: 0.3 });
      }
    }

    // ── Candles ───────────────────────────────────────────────────────────
    if (!isPanOnly) {
      for (const { c, idx } of visibleCandles) {
        const sx     = (idx - v.lastDrawnFrom) * scaleX;
        const yOpen  = py(c.open);
        const yClose = py(c.close);
        const yHigh  = py(c.high);
        const yLow   = py(c.low);
        const isUp   = c.close >= c.open;
        const color  = isUp ? 0x089981 : 0xf23645;

        // Wick
        candleLayerRef.current.moveTo(sx, yHigh).lineTo(sx, yLow).stroke({ width: 1, color });
        // Body
        const top    = Math.min(yOpen, yClose);
        const bottom = Math.max(yOpen, yClose);
        candleLayerRef.current.rect(sx - candleW / 2, top, candleW, Math.max(1, bottom - top)).fill({ color });
      }
    }

    // ── Live price line ───────────────────────────────────────────────────
    const lastC  = candles[candles.length - 1];
    const isUp   = lastC.close >= lastC.open;
    const liveColor = isUp ? 0x089981 : 0xf23645;
    const lastY  = Math.round(py(lastC.close)) + 0.5;

    drawDashedLine(livePriceLayerRef.current, 0, lastY, pAxisX, lastY, 4, 4);
    livePriceLayerRef.current.stroke({ width: 1, color: liveColor, alpha: 0.8 });

    const pillY = Math.floor(lastY - 10);
    livePriceLayerRef.current.rect(pAxisX, pillY, pAxisW, 20).fill({ color: liveColor });
    const liveTxt = getPooledText(textIndex++, cachedStyles.current.livePriceText);
    liveTxt.text = lastC.close.toFixed(2);
    liveTxt.x    = Math.floor(pAxisX + (pAxisW - liveTxt.width) / 2);
    liveTxt.y    = pillY + 3;

    // ── Indicator lines ───────────────────────────────────────────────────
    if (!isPanOnly && visualIndicators && indicatorDataMap) {
      visualIndicators.forEach(ind => {
        const data = indicatorDataMap[ind.id];
        if (!data || data.length === 0) return;
        const indColor = parseInt(ind.color.replace('#', ''), 16) || 0xffaa00;
        let first = true;
        for (const d of data) {
          const idx = timeToIndex(d.time);
          if (idx >= v.timeRange.from - 50 && idx <= v.timeRange.to + 50) {
            const sx = (idx - v.lastDrawnFrom) * scaleX;
            const sy = py(d.value);
            if (first) { indicatorLayerRef.current.moveTo(sx, sy); first = false; }
            else         indicatorLayerRef.current.lineTo(sx, sy);
          }
        }
        if (!first) indicatorLayerRef.current.stroke({ width: 2, color: indColor });
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

      drawDashedLine(crosshairLayerRef.current, 0,     snapY, pAxisX,    snapY, 4, 4);
      drawDashedLine(crosshairLayerRef.current, snapX, 0,     snapX, timeAxisY, 4, 4);
      crosshairLayerRef.current.stroke({ width: 1, color: crossColor, alpha: 0.4 });

      // Dot on close price
      const dotY = Math.round(py(candles[nearestIdx].close)) + 0.5;
      crosshairLayerRef.current.circle(snapX, dotY, 3.5).fill({ color: darkMode ? 0xffffff : 0x000000 });

      const boxColor = darkMode ? 0x2a2e39 : 0xe0e3eb;

      // Price label box
      const pAtMouse = v.priceRange.max - ((hoverY - (cH - 26) * 0.10) / scaleY);
      const priceTxt = getPooledText(textIndex++, cachedStyles.current.crosshairText);
      priceTxt.text  = pAtMouse.toFixed(2);
      const pBoxY = Math.floor(hoverY - 11);
      const pBoxX = pAxisX + 2;
      const pBoxW = pAxisW - 4;
      crosshairLayerRef.current.roundRect(pBoxX, pBoxY, pBoxW, 22, 3).fill({ color: boxColor });
      priceTxt.x = Math.floor(pBoxX + (pBoxW - priceTxt.width) / 2);
      priceTxt.y = pBoxY + 4;

      // Time label box — shows timestamp of snapped candle
      const hoverTime = indexToTime(nearestIdx);
      const timeTxt   = getPooledText(textIndex++, cachedStyles.current.crosshairText);
      timeTxt.text = formatTimeLabel(hoverTime);
      const tBoxW = Math.ceil(timeTxt.width) + 16;
      const tBoxX = Math.floor(snapX - tBoxW / 2);
      const tBoxY = timeAxisY + 2;
      crosshairLayerRef.current.roundRect(tBoxX, tBoxY, tBoxW, 22, 3).fill({ color: boxColor });
      timeTxt.x = tBoxX + 8;
      timeTxt.y = tBoxY + 4;
    }

    hideUnusedTexts(textIndex);
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

      app.stage.addChild(gridLayerRef.current);
      app.stage.addChild(volumeLayerRef.current);
      app.stage.addChild(candleLayerRef.current);
      app.stage.addChild(indicatorLayerRef.current);
      app.stage.addChild(livePriceLayerRef.current);
      app.stage.addChild(axesBgLayerRef.current);
      app.stage.addChild(axesTextContainerRef.current);
      app.stage.addChild(crosshairLayerRef.current); // topmost

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
        if (activeToolRef.current) return;
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
        if (activeToolRef.current || isHoveringDrawingRef.current) return;
        const v  = viewportRef.current;
        const cW = app.screen.width;
        const cH = app.screen.height;
        interactionRef.current.isDragging   = true;
        interactionRef.current.isGliding    = false;
        interactionRef.current.velocityX    = 0;
        interactionRef.current.lastX        = e.offsetX;
        interactionRef.current.lastY        = e.offsetY;
        interactionRef.current.lastDragTime = performance.now();
        if      (e.offsetX > cW - (v.pAxisW || 64)) interactionRef.current.dragType = 'price';
        else if (e.offsetY > cH - 26)               interactionRef.current.dragType = 'time';
        else                                         interactionRef.current.dragType = 'chart';
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
        }
      });

      app.canvas.addEventListener('pointerleave', () => {
        interactionRef.current.isHovering = false;
        drawAll(true);
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
          if      (e.offsetX > cW - (v.pAxisW || 64)) app.canvas.style.cursor = 'ns-resize';
          else if (e.offsetY > cH - 26)               app.canvas.style.cursor = 'ew-resize';
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
          const scaleY = ((cH - 26) * 0.80) / pRange;

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
            drawAll(true);

          } else if (interactionRef.current.dragType === 'price') {
            v.manualPriceScale   = true;
            const zoomY          = Math.exp(dy * 0.005);
            const priceAtMouse   = v.priceRange.max - ((e.offsetY - (cH - 26) * 0.10) / scaleY);
            const newPRange      = pRange / zoomY;
            const ratioY         = (e.offsetY - (cH - 26) * 0.10) / ((cH - 26) * 0.80);
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
        drawAll(true);
      });

      // ── Momentum glide ticker ────────────────────────────────────────
      app.ticker.add((ticker) => {
        if (!interactionRef.current.isGliding) return;
        const vx = interactionRef.current.velocityX;
        if (Math.abs(vx) < 0.01) {
          interactionRef.current.isGliding = false;
          interactionRef.current.velocityX = 0;
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
        drawAll(true);
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
