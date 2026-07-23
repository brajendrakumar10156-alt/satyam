import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { Canvas2DDrawings } from '../core_render_canvas2d/drawings/Canvas2DDrawings';
import { WebGLDrawings } from '../core_render_webgl/drawings/WebGLDrawings';
import { WebGPUDrawings } from '../core_render_webgpu/drawings/WebGPUDrawings';

const NativeDrawingLayer = forwardRef(({
  width,
  height,
  drawings,
  brushPath,
  tempShape,
  drawStart,
  activeTool,
  allCandles,
  visibleRange,
  selectedDrawingId,
  hideDrawings,
  preference = 'webgl' // 'canvas2d', 'webgl', 'webgpu'
}, ref) => {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const engineRef = useRef(null);

  // Expose an imperative draw method to App.tsx for high-frequency rendering without React overhead
  useImperativeHandle(ref, () => ({
    draw: () => {
      renderAll();
    }
  }));

  // Initialize correct native hardware engine
  useEffect(() => {
    if (!canvasRef.current) return;

    if (preference === 'webgpu' && navigator.gpu) {
      engineRef.current = new WebGPUDrawings(canvasRef.current);
    } else if (preference === 'webgl' || preference === 'webgpu') {
      engineRef.current = new WebGLDrawings(canvasRef.current);
    } else {
      engineRef.current = new Canvas2DDrawings(canvasRef.current);
    }

    return () => {
      engineRef.current = null;
    };
  }, [preference]);

  // Resize canvas native buffers
  useEffect(() => {
    if (engineRef.current && width && height) {
      engineRef.current.resize(width, height);
      renderAll();
    }
  }, [width, height]);

  // If props change naturally
  useEffect(() => {
    renderAll();
  }, [drawings, brushPath, tempShape, drawStart, activeTool, allCandles, visibleRange, selectedDrawingId, hideDrawings]);

  const renderAll = () => {
    if (!engineRef.current || hideDrawings) return;

    // We pass the viewport state to the native engines so the UniversalTranslator can work its math
    const viewportState = {
      width, height,
      minPrice: visibleRange?.minPrice || 0,
      maxPrice: visibleRange?.maxPrice || 0,
      startIndex: visibleRange?.startIndex || 0,
      endIndex: visibleRange?.endIndex || 0,
      candleWidth: visibleRange?.candleWidth || 1
    };

    // Combine all drawings to render
    const allShapes = [];

    // Permanent Drawings
    if (drawings) {
      drawings.forEach(d => {
        allShapes.push({
           ...d,
           color: selectedDrawingId === d.id ? '#FFD700' : (d.color || '#2962FF'),
           thickness: selectedDrawingId === d.id ? 3 : 2
        });
      });
    }

    // Temporary Brush Path
    if (brushPath && brushPath.length > 0) {
        // Break brush into small line segments for GPU
        for(let i=1; i<brushPath.length; i++) {
            allShapes.push({
                type: 'trendline',
                start: brushPath[i-1],
                end: brushPath[i],
                color: '#2962FF',
                thickness: 2
            });
        }
    }

    // Temporary Drawing shape
    if (drawStart && tempShape && activeTool && activeTool !== 'brush') {
      allShapes.push({ type: activeTool, start: drawStart, end: tempShape, color: '#2962FF', thickness: 2 });
    }

    // Ship everything to Native Engine
    engineRef.current.render(allShapes, viewportState);
  };

  return (
    <div ref={containerRef} className="absolute inset-0 pointer-events-none z-10" style={{ width: '100%', height: '100%' }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', pointerEvents: 'none' }} />
    </div>
  );
});

export default NativeDrawingLayer;
