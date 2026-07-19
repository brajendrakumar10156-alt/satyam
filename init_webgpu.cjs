const fs = require('fs');

const rawWebGPUCode = `import React, { useEffect, useRef, useState, useMemo } from 'react';
import { calculateHorizontalTimeAxisLabels, calculateVerticalPriceAxisLabels } from '../utils/webgpuAxisCollisionEngine';

const WebGPUChartEngine = React.forwardRef(({
  data = [],
  layout = {},
  theme = {},
  priceScaleMode = 0,
  autoScale = true,
  initialVisibleRange,
  onVisibleRangeChange,
  onChartReady,
  activeTool,
  isHoveringDrawing,
  timezoneOffset = 0,
  preference = 'webgpu'
}, ref) => {
  const containerRef = useRef(null);
  const gpuCanvasRef = useRef(null);
  const textCanvasRef = useRef(null);
  
  const [gpuError, setGpuError] = useState(null);
  
  // GPU State
  const deviceRef = useRef(null);
  const contextRef = useRef(null);
  const pipelineRef = useRef(null);
  const formatRef = useRef(null);
  
  // Render Loop State
  const animationFrameId = useRef(null);
  
  // Initialize WebGPU
  useEffect(() => {
    async function initWebGPU() {
      if (!navigator.gpu) {
        setGpuError('WebGPU is not supported in your browser.');
        return;
      }
      
      try {
        const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
        if (!adapter) {
          setGpuError('Failed to get WebGPU adapter.');
          return;
        }
        
        const device = await adapter.requestDevice();
        deviceRef.current = device;
        
        const canvas = gpuCanvasRef.current;
        const context = canvas.getContext('webgpu');
        contextRef.current = context;
        
        const format = navigator.gpu.getPreferredCanvasFormat();
        formatRef.current = format;
        
        context.configure({
          device,
          format,
          alphaMode: 'premultiplied'
        });
        
        // Load WGSL Shaders and create pipelines here...
        
        if (onChartReady) onChartReady();
        
      } catch (err) {
        console.error('WebGPU Init Error:', err);
        setGpuError(err.message);
      }
    }
    
    initWebGPU();
    
    return () => {
      if (deviceRef.current) {
        deviceRef.current.destroy();
      }
    };
  }, []);
  
  // Resize Observer
  useEffect(() => {
    if (!containerRef.current) return;
    
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (gpuCanvasRef.current) {
          gpuCanvasRef.current.width = width * window.devicePixelRatio;
          gpuCanvasRef.current.height = height * window.devicePixelRatio;
          gpuCanvasRef.current.style.width = \`\${width}px\`;
          gpuCanvasRef.current.style.height = \`\${height}px\`;
        }
        if (textCanvasRef.current) {
          textCanvasRef.current.width = width * window.devicePixelRatio;
          textCanvasRef.current.height = height * window.devicePixelRatio;
          textCanvasRef.current.style.width = \`\${width}px\`;
          textCanvasRef.current.style.height = \`\${height}px\`;
          textCanvasRef.current.getContext('2d').scale(window.devicePixelRatio, window.devicePixelRatio);
        }
      }
    });
    
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);
  
  // Expose API to parent (App.jsx)
  React.useImperativeHandle(ref, () => ({
    timeScale: () => ({
      getVisibleLogicalRange: () => null,
      getVisibleRange: () => null,
      fitContent: () => {}
    }),
    priceScale: () => ({
      applyOptions: () => {}
    }),
    captureViewport: () => null,
    applyViewport: () => {}
  }));
  
  if (gpuError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#131722] text-red-400">
        WebGPU Error: {gpuError}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full h-full relative bg-[#131722] overflow-hidden cursor-crosshair">
      {/* Layer 1: Raw WebGPU Canvas (Candles, Grid, Lines) */}
      <canvas 
        ref={gpuCanvasRef} 
        className="absolute top-0 left-0 w-full h-full touch-none"
      />
      
      {/* Layer 2: Canvas 2D Text Overlay (Axes, Crosshair labels) */}
      <canvas 
        ref={textCanvasRef} 
        className="absolute top-0 left-0 w-full h-full pointer-events-none"
      />
    </div>
  );
});

export default WebGPUChartEngine;
`;

fs.writeFileSync('src_demo/components/WebGPUChartEngine.jsx', rawWebGPUCode, 'utf8');
console.log('Successfully created raw WebGPU skeleton');
