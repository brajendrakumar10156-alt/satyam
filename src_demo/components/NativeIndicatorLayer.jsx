import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { Canvas2DIndicators } from '../core_render_canvas2d/Canvas2DIndicators.js';
import { WebGLIndicators } from '../core_render_webgl/WebGLIndicators.js';
import { WebGPUIndicators } from '../core_render_webgpu/WebGPUIndicators.js';

const NativeIndicatorLayer = forwardRef(({
  width,
  height,
  visualIndicators,
  indicatorDataMap,
  visibleRange,
  preference = 'webgl' // 'canvas2d', 'webgl', 'webgpu'
}, ref) => {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const engineRef = useRef(null);

  // Expose imperative draw method
  useImperativeHandle(ref, () => ({
    draw: () => {
      renderAll();
    }
  }));

  // Initialize correct native hardware engine
  useEffect(() => {
    if (!canvasRef.current) return;

    const initEngine = async () => {
      let engine = null;
      if (preference === 'webgpu' && navigator.gpu) {
        engine = new WebGPUIndicators(canvasRef.current);
      } else if (preference === 'webgl' || preference === 'webgpu') {
        engine = new WebGLIndicators(canvasRef.current);
      } else {
        engine = new Canvas2DIndicators(canvasRef.current);
      }
      
      const success = await engine.init();
      if (success) {
         engineRef.current = engine;
         if (width && height) engine.resize(width, height);
         renderAll();
      }
    };
    
    initEngine();

    return () => {
      engineRef.current = null;
    };
  }, [preference]);

  // Resize canvas
  useEffect(() => {
    if (engineRef.current && width && height) {
      engineRef.current.resize(width, height);
      renderAll();
    }
  }, [width, height]);

  // If props change naturally
  useEffect(() => {
    renderAll();
  }, [visualIndicators, indicatorDataMap, visibleRange]);

  const renderAll = () => {
    if (!engineRef.current || !visualIndicators || !indicatorDataMap) return;

    // Viewport state to send to the Shaders for native Universal Translation
    const viewportState = {
      width, height,
      minPrice: visibleRange?.minPrice || 0,
      maxPrice: visibleRange?.maxPrice || 0,
      startIndex: visibleRange?.startIndex || 0,
      endIndex: visibleRange?.endIndex || 0,
      candleWidth: visibleRange?.candleWidth || 1
    };

    // Construct a map of indicators to render
    const renderMap = {};
    visualIndicators.forEach(ind => {
       if (ind.visible && indicatorDataMap[ind.id]) {
           renderMap[ind.id] = {
               array: indicatorDataMap[ind.id],
               color: ind.color || '#2962FF',
               thickness: ind.lineWidth || 2
           };
       }
    });

    // Ship raw data to the GPU/Hardware engine
    engineRef.current.render(renderMap, viewportState);
  };

  return (
    <div ref={containerRef} className="absolute inset-0 pointer-events-none z-0" style={{ width: '100%', height: '100%' }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', pointerEvents: 'none' }} />
    </div>
  );
});

export default NativeIndicatorLayer;
