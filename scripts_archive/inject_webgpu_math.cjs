const fs = require('fs');
let code = fs.readFileSync('src_demo/components/WebGPUChartEngine.jsx', 'utf8');

// 1. Update Topology to triangle-list for Thick Lines
code = code.replace("primitive: { topology: 'line-list' }", "primitive: { topology: 'triangle-list' }");

// 2. Add Math imports
code = code.replace(
  "import { calculateHorizontalTimeAxisLabels",
  "import { lineToQuad } from '../utils/webgpuMath';\nimport { calculateHorizontalTimeAxisLabels"
);

// 3. Update WGSL Drawing rendering to use lineToQuad (Thick lines)
const regexRenderPass = /const lineData = new Float32Array\(\(drawings\.length \+ 1\) \* 12\);[\s\S]*?renderPass\.draw\(ptr \/ 6\);\n       \}/m;

const replacementRenderPass = `const lineData = new Float32Array((drawings.length + 1) * 36); // +1 for internal tempShape. 6 verts per quad, 6 floats per vert = 36 floats per line
       let ptr = 0;
       const color = [0.2, 0.6, 1.0, 1.0]; // Blue
       
       const drawThickLine = (p1, p2, thickness = 2) => {
           const v1 = { x: px(p1.time), y: py(p1.price) };
           const v2 = { x: px(p2.time), y: py(p2.price) };
           const quadVertices = lineToQuad(v1, v2, thickness);
           
           for (const v of quadVertices) {
               lineData[ptr++] = v.x; lineData[ptr++] = v.y;
               lineData[ptr++] = color[0]; lineData[ptr++] = color[1]; lineData[ptr++] = color[2]; lineData[ptr++] = color[3];
           }
       };

       for (let i=0; i<drawings.length; i++) {
          const d = drawings[i];
          if (d.tool === 'trendline' && d.points.length >= 2) {
             drawThickLine(d.points[0], d.points[1], 2);
          }
       }
       
       // Draw autonomous internal active shape
       if (activeTool === 'trendline' && gpu.current.activeDrawStart && gpu.current.activeTempShape) {
          drawThickLine(gpu.current.activeDrawStart, gpu.current.activeTempShape, 2);
       }
       
       if (ptr > 0) {
          gpu.current.device.queue.writeBuffer(gpu.current.lineBuffer, 0, lineData, 0, ptr);
          renderPass.setPipeline(gpu.current.linePipeline);
          renderPass.setBindGroup(0, gpu.current.lineBindGroup);
          renderPass.setVertexBuffer(0, gpu.current.lineBuffer);
          renderPass.draw(ptr / 6); // 6 floats per vertex
       }`;

if (regexRenderPass.test(code)) {
  code = code.replace(regexRenderPass, replacementRenderPass);
}

// 4. Implement Autonomous Pointer Events for Drawing
const regexEvents = /const onPointerDown = \(e\) => \{[\s\S]*?canvas\.addEventListener\('wheel', onWheel, \{ passive: false \}\);/m;

const replacementEvents = `const onPointerDown = (e) => {
      // INTERNAL DRAWING LOGIC (Autonomous WebGPU)
      if (activeTool && activeTool !== 'cursor') {
         const { left, top } = canvas.getBoundingClientRect();
         const px = e.clientX - left;
         const py = e.clientY - top;
         
         const { min, max } = vState.current.priceRange;
         const priceRange = max - min;
         const ch = vState.current.height;
         const priceScale = priceRange > 0 ? (ch - 26) / priceRange : 1;
         
         const price = max - (py / priceScale);
         
         const cw = vState.current.width;
         const logicalRange = vState.current.logicalRange;
         const rangeLen = logicalRange.to - logicalRange.from;
         const idx = logicalRange.from + ((px / (cw - 64)) * rangeLen);
         
         const time = data[Math.min(data.length - 1, Math.max(0, Math.floor(idx)))]?.time || 0;
         const coordinate = { time, price };
         
         if (!gpu.current.activeDrawStart) {
            // First click: start drawing
            gpu.current.activeDrawStart = coordinate;
            gpu.current.activeTempShape = coordinate;
         } else {
            // Second click: finish drawing and dispatch to global vault
            if (onDrawingComplete) {
               onDrawingComplete({
                  id: Date.now().toString(),
                  tool: activeTool,
                  points: [gpu.current.activeDrawStart, coordinate]
               });
            }
            gpu.current.activeDrawStart = null;
            gpu.current.activeTempShape = null;
         }
         requestAnimationFrame(render);
         return;
      }
      
      // Default panning logic
      isDragging = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      startLogicalFrom = vState.current.logicalRange.from;
      startLogicalTo = vState.current.logicalRange.to;
      canvas.setPointerCapture(e.pointerId);
    };
    
    const onPointerMove = (e) => {
      if (activeTool && activeTool !== 'cursor' && gpu.current.activeDrawStart) {
         const { left, top } = canvas.getBoundingClientRect();
         const px = e.clientX - left;
         const py = e.clientY - top;
         
         const { min, max } = vState.current.priceRange;
         const priceRange = max - min;
         const ch = vState.current.height;
         const priceScale = priceRange > 0 ? (ch - 26) / priceRange : 1;
         
         const price = max - (py / priceScale);
         
         const cw = vState.current.width;
         const logicalRange = vState.current.logicalRange;
         const rangeLen = logicalRange.to - logicalRange.from;
         const idx = logicalRange.from + ((px / (cw - 64)) * rangeLen);
         
         const time = data[Math.min(data.length - 1, Math.max(0, Math.floor(idx)))]?.time || 0;
         gpu.current.activeTempShape = { time, price };
         requestAnimationFrame(render);
         return;
      }
      
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
      if (activeTool && activeTool !== 'cursor') return;
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
    canvas.addEventListener('wheel', onWheel, { passive: false });`;

if (regexEvents.test(code)) {
  code = code.replace(regexEvents, replacementEvents);
}

// 5. Inject onDrawingComplete prop
code = code.replace(
  "activeTool = null\n}, ref) => {",
  "activeTool = null,\n  onDrawingComplete\n}, ref) => {"
);

// 6. Fix Render deps for activeTools
code = code.replace('}, [drawings, tempShape, activeTool, drawStart]);', '}, [drawings, activeTool]);');


fs.writeFileSync('src_demo/components/WebGPUChartEngine.jsx', code, 'utf8');
console.log('Successfully applied mathematical redefinition of WebGPU drawings');
