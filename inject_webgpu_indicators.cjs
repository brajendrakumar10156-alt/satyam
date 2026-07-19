const fs = require('fs');

let gpuCode = fs.readFileSync('src_demo/components/WebGPUChartEngine.jsx', 'utf8');

// 1. Add props to WebGPUChartEngine
gpuCode = gpuCode.replace(
  "onDrawingDelete\n}, ref) => {",
  "onDrawingDelete,\n  visualIndicators = [],\n  indicatorDataMap = {}\n}, ref) => {"
);

// 2. Expand line buffer to hold indicator lines
// Currently: const lineData = new Float32Array((drawings.length + 1) * 36);
// We need to calculate how many vertices are needed for indicators.
const regexLineBuffer = /const lineData = new Float32Array\(\(drawings\.length \+ 1\) \* 36\);[\s\S]*?renderPass\.draw\(ptr \/ 6\);\n       \}/m;

const replacementLineBuffer = `// Calculate buffer size for Drawings + Indicators
       let totalSegments = drawings.length + 1; // 1 for tempShape
       
       // Calculate segments for indicators
       const visibleIndices = Math.floor(vState.current.logicalRange.to - vState.current.logicalRange.from) + 2;
       let indicatorSegments = 0;
       
       for (const ind of visualIndicators) {
          if (ind.type === 'VolumeProfile') continue; // Handled separately
          const results = indicatorDataMap[ind.id];
          if (results && results.length > 1) {
             indicatorSegments += visibleIndices; // roughly visibleIndices segments per line
          }
       }
       
       const MAX_INDICATOR_VERTS = 10000;
       const lineData = new Float32Array((totalSegments * 36) + (MAX_INDICATOR_VERTS * 36)); 
       let ptr = 0;
       
       const drawThickLine = (p1, p2, thickness, hexColor) => {
           // Parse hex color or use default blue
           let r = 0.2, g = 0.6, b = 1.0, a = 1.0;
           if (hexColor && hexColor.startsWith('#')) {
              const hex = hexColor.replace('#', '');
              r = parseInt(hex.substring(0,2), 16) / 255;
              g = parseInt(hex.substring(2,4), 16) / 255;
              b = parseInt(hex.substring(4,6), 16) / 255;
           }

           const v1 = { x: px(p1.time), y: py(p1.price) };
           const v2 = { x: px(p2.time), y: py(p2.price) };
           
           // NATIVE MATH: Thick Line Geometry
           const quadVertices = lineToQuad(v1, v2, thickness);
           
           for (const v of quadVertices) {
               lineData[ptr++] = v.x; lineData[ptr++] = v.y;
               lineData[ptr++] = r; lineData[ptr++] = g; lineData[ptr++] = b; lineData[ptr++] = a;
           }
       };

       // Draw Universal Drawings
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
       
       // Draw Technical Indicators (NATIVE WGSL PIPELINE)
       const firstI = Math.max(0, Math.floor(vState.current.logicalRange.from));
       const lastI = Math.min(data.length - 1, Math.ceil(vState.current.logicalRange.to));
       
       for (const ind of visualIndicators) {
          if (ind.type === 'VolumeProfile') continue;
          
          const results = indicatorDataMap[ind.id];
          if (!results || results.length === 0) continue;
          
          let prevTime = null;
          let prevPrice = null;
          const color = ind.color || '#F59E0B';
          const thickness = ind.thickness || 2;
          
          for (let i = firstI; i <= lastI; i++) {
             const c = data[i];
             if (!c) continue;
             
             // Indicators are usually matched by index or timestamp. 
             // We'll assume the results array maps 1:1 with candle data, or has {time, value}
             let value = null;
             
             // Fast path: if results array is same length as data
             if (results.length === data.length && typeof results[i] === 'number') {
                value = results[i];
             } else {
                // Find matching timestamp
                const result = results.find(r => r.time === c.time);
                if (result) value = result.value !== undefined ? result.value : result;
             }
             
             if (value !== null && !isNaN(value)) {
                if (prevTime !== null && prevPrice !== null) {
                   drawThickLine({ time: prevTime, price: prevPrice }, { time: c.time, price: value }, thickness, color);
                }
                prevTime = c.time;
                prevPrice = value;
             }
          }
       }
       
       if (ptr > 0) {
          gpu.current.device.queue.writeBuffer(gpu.current.lineBuffer, 0, lineData, 0, ptr);
          renderPass.setPipeline(gpu.current.linePipeline);
          renderPass.setBindGroup(0, gpu.current.lineBindGroup);
          renderPass.setVertexBuffer(0, gpu.current.lineBuffer);
          renderPass.draw(ptr / 6); // 6 floats per vertex
       }`;

if (regexLineBuffer.test(gpuCode)) {
  gpuCode = gpuCode.replace(regexLineBuffer, replacementLineBuffer);
}

// 3. Add indicator deps to render loop
gpuCode = gpuCode.replace(
  '}, [drawings, activeTool]);', 
  '}, [drawings, activeTool, visualIndicators, indicatorDataMap]);'
);

fs.writeFileSync('src_demo/components/WebGPUChartEngine.jsx', gpuCode, 'utf8');
console.log('Successfully injected Native WebGPU Indicators');
