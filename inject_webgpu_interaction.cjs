const fs = require('fs');
let code = fs.readFileSync('src_demo/components/WebGPUChartEngine.jsx', 'utf8');

const regexEvents = /\/\/ ── RESIZE & EVENTS ────────────────────────────────────────────────────────[\s\S]*?useImperativeHandle/m;

const replacementEvents = `// ── RESIZE & EVENTS ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      for (let e of entries) {
        const { width, height } = e.contentRect;
        vState.current.width = width;
        vState.current.height = height;
        
        if (gpuCanvasRef.current) {
          gpuCanvasRef.current.width = width * dpr;
          gpuCanvasRef.current.height = height * dpr;
        }
        
        // Auto-scale price initially if needed
        if (autoScale && data.length > 0) {
           let minP = Infinity, maxP = -Infinity;
           const from = Math.max(0, Math.floor(vState.current.logicalRange.from));
           const to = Math.min(data.length - 1, Math.ceil(vState.current.logicalRange.to));
           for (let i=from; i<=to; i++) {
              if (data[i].low < minP) minP = data[i].low;
              if (data[i].high > maxP) maxP = data[i].high;
           }
           if (minP !== Infinity && maxP !== -Infinity) {
              const pad = (maxP - minP) * 0.1;
              vState.current.priceRange = { min: minP - pad, max: maxP + pad };
           }
        }
        
        requestAnimationFrame(render);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [data, autoScale]);

  // Pointer Events for Panning and Zooming
  useEffect(() => {
    const canvas = containerRef.current;
    if (!canvas) return;
    
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let startLogicalFrom = 0;
    let startLogicalTo = 0;
    
    const onPointerDown = (e) => {
      if (activeTool && activeTool !== 'cursor') return; // Let drawing layer handle tools
      isDragging = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      startLogicalFrom = vState.current.logicalRange.from;
      startLogicalTo = vState.current.logicalRange.to;
      canvas.setPointerCapture(e.pointerId);
    };
    
    const onPointerMove = (e) => {
      if (!isDragging) return;
      const dx = e.clientX - dragStartX;
      
      const cw = vState.current.width;
      const rangeLen = startLogicalTo - startLogicalFrom;
      const candlesPerPixel = rangeLen / cw;
      
      const shift = dx * candlesPerPixel;
      vState.current.logicalRange.from = startLogicalFrom - shift;
      vState.current.logicalRange.to = startLogicalTo - shift;
      
      if (onVisibleRangeChange) {
         onVisibleRangeChange(vState.current.logicalRange);
      }
      requestAnimationFrame(render);
    };
    
    const onPointerUp = (e) => {
      isDragging = false;
      canvas.releasePointerCapture(e.pointerId);
    };
    
    const onWheel = (e) => {
       e.preventDefault();
       const zoomFactor = e.deltaY > 0 ? 1.05 : 0.95;
       const rangeLen = vState.current.logicalRange.to - vState.current.logicalRange.from;
       const center = vState.current.logicalRange.from + (rangeLen / 2);
       
       const newLen = Math.max(10, Math.min(data.length, rangeLen * zoomFactor));
       vState.current.logicalRange.from = center - (newLen / 2);
       vState.current.logicalRange.to = center + (newLen / 2);
       
       if (onVisibleRangeChange) {
         onVisibleRangeChange(vState.current.logicalRange);
       }
       requestAnimationFrame(render);
    };
    
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    
    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('wheel', onWheel);
    };
  }, [data, activeTool, onVisibleRangeChange]);

  useImperativeHandle`;

if (regexEvents.test(code)) {
  code = code.replace(regexEvents, replacementEvents);
  
  // Connect external logicalRange updates
  const extRangeSync = `
  useEffect(() => {
    if (initialVisibleRange) {
      vState.current.logicalRange = { ...initialVisibleRange };
      requestAnimationFrame(render);
    }
  }, [initialVisibleRange]);
  `;
  
  code = code.replace('const dpr = window.devicePixelRatio || 1;', `const dpr = window.devicePixelRatio || 1;\n${extRangeSync}`);
  
  fs.writeFileSync('src_demo/components/WebGPUChartEngine.jsx', code, 'utf8');
  console.log('Successfully injected native WebGPU interaction math (drag/zoom)');
} else {
  console.log('Failed to match events block');
}
