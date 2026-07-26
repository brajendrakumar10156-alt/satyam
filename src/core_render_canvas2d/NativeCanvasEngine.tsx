import React, { useEffect, useRef, useState, useImperativeHandle } from 'react';
import { Canvas2DRenderer } from './Canvas2DRenderer';

// Hybrid Native Canvas Engine: Combines React State + Pure Rendering
const NativeCanvasEngine = React.forwardRef(({
  candles = [],
  darkMode = true,
  onCrosshairMove
}: any, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [panX, setPanX] = useState(0);
  const [zoom, setZoom] = useState(1);
  const isDragging = useRef(false);
  const lastMouseX = useRef(0);

  // Expose API to parent if needed
  useImperativeHandle(ref, () => ({
      get container() { return containerRef.current; }
  }));

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high DPI displays for crisp rendering
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    
    ctx.clearRect(0, 0, width, height);
    
    // Background
    ctx.fillStyle = darkMode ? '#0d1117' : '#ffffff';
    ctx.fillRect(0, 0, width, height);

    if (!candles || candles.length === 0) return;

    const chartHeight = height - 30; // bottom margin for time
    const chartWidth = width - 60;   // right margin for price
    
    let minPrice = Infinity;
    let maxPrice = -Infinity;
    
    const baseCandleWidth = 8;
    const gap = 2;
    const totalW = (baseCandleWidth + gap) * zoom;
    const candleWidth = baseCandleWidth * zoom;
    
    const maxVisible = Math.ceil(chartWidth / totalW) + 2;
    let shiftIndex = Math.floor(panX / totalW);
    let startIndex = Math.max(0, candles.length - maxVisible + shiftIndex);
    let endIndex = Math.min(candles.length, startIndex + maxVisible);
    
    const visibleCandles = candles.slice(startIndex, endIndex);
    if(visibleCandles.length === 0) return;

    visibleCandles.forEach((c: any) => {
        if (c.low < minPrice) minPrice = c.low;
        if (c.high > maxPrice) maxPrice = c.high;
    });

    const priceRange = maxPrice - minPrice || 1;
    maxPrice += priceRange * 0.1;
    minPrice -= priceRange * 0.1;
    const adjustedRange = maxPrice - minPrice;
    const scaleY = chartHeight / adjustedRange;

    // Draw grid
    ctx.strokeStyle = darkMode ? 'rgba(42,46,57,0.6)' : '#e0e3eb';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= 5; i++) {
        const y = (i / 5) * chartHeight;
        ctx.moveTo(0, y);
        ctx.lineTo(chartWidth, y);
    }
    ctx.stroke();

    // Hybrid Rendering: We could pass a Float32Array to Canvas2DRenderer here if WASM was active
    // For now, doing native Canvas rendering of candles directly
    visibleCandles.forEach((c: any, i: number) => {
        const idxFromRight = (visibleCandles.length - 1 - i);
        const x = chartWidth - (idxFromRight * totalW) - (panX % totalW) - totalW;
        
        if (x < -totalW || x > chartWidth) return;

        const openY = chartHeight - ((c.open - minPrice) * scaleY);
        const closeY = chartHeight - ((c.close - minPrice) * scaleY);
        const highY = chartHeight - ((c.high - minPrice) * scaleY);
        const lowY = chartHeight - ((c.low - minPrice) * scaleY);

        const isUp = c.close >= c.open;
        const color = isUp ? '#10b981' : '#ef4444';

        ctx.strokeStyle = color;
        ctx.fillStyle = color;

        // Wick
        ctx.beginPath();
        const centerX = x + (candleWidth / 2);
        ctx.moveTo(centerX, highY);
        ctx.lineTo(centerX, lowY);
        ctx.stroke();

        // Body
        const bodyHeight = Math.max(Math.abs(closeY - openY), 1);
        const bodyY = Math.min(openY, closeY);
        ctx.fillRect(x, bodyY, candleWidth, bodyHeight);
    });
    
    // Draw Price Axis (Right)
    ctx.fillStyle = darkMode ? '#c9d1d9' : '#131722';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    
    for (let i = 0; i <= 5; i++) {
        const y = (i / 5) * chartHeight;
        const price = maxPrice - (i / 5) * adjustedRange;
        ctx.fillText(price.toFixed(2), chartWidth + 5, y);
    }
  };

  useEffect(() => {
    let animationFrameId: number;
    const renderLoop = () => {
        draw();
        animationFrameId = requestAnimationFrame(renderLoop);
    };
    renderLoop();
    return () => cancelAnimationFrame(animationFrameId);
  }, [candles, darkMode, panX, zoom]);

  const handleMouseDown = (e: React.MouseEvent) => {
      isDragging.current = true;
      lastMouseX.current = e.clientX;
  };
  
  const handleMouseMove = (e: React.MouseEvent) => {
      if (isDragging.current) {
          const delta = e.clientX - lastMouseX.current;
          setPanX(p => p + delta);
          lastMouseX.current = e.clientX;
      }
  };

  const handleMouseUp = () => {
      isDragging.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
      setZoom(z => Math.max(0.1, z - e.deltaY * 0.001));
  };

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'absolute', inset: 0, zIndex: 1 }}>
        <canvas 
            ref={canvasRef}
            style={{ width: '100%', height: '100%', display: 'block', cursor: 'crosshair', touchAction: 'none' }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
        />
    </div>
  );
});

export default NativeCanvasEngine;
