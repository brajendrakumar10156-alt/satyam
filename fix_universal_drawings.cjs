const fs = require('fs');
let appCode = fs.readFileSync('src_demo/App.jsx', 'utf8');

// 1. Trigger requestDraw on important state changes
const regexDeps = /useEffect\(\(\) => \{ requestDraw\(\); \}, \[requestDraw, allCandles\]\);/m;
const replacementDeps = `useEffect(() => { requestDraw(); }, [requestDraw, allCandles, drawings, tempShape, renderEngine]);`;
if (regexDeps.test(appCode)) {
  appCode = appCode.replace(regexDeps, replacementDeps);
} else {
  // If not found, inject it after the definition of requestDraw
  const regexDef = /const requestDraw = useCallback\(\(\) => \{[\s\S]*?\}, \[\]\);/m;
  const match = appCode.match(regexDef);
  if (match) {
    appCode = appCode.replace(match[0], `${match[0]}\n  useEffect(() => { requestDraw(); }, [requestDraw, allCandles, drawings, tempShape, renderEngine]);`);
  }
}

// 2. Hide PixiDrawingLayer in WebGPU mode
const regexPixiLayer = /<PixiDrawingLayer[\s\S]*?magicTrail=\{magicTrail\}\n\s*\/>/g;
const replacementPixiLayer = `{renderEngine !== 'webgpu' && (
          <PixiDrawingLayer
            preference={renderEngine === 'webgl' ? 'webgl' : 'webgpu'} 
            ref={drawingLayerRef}
            drawings={drawings}
            brushPath={brushPath}
            tempShape={tempShape}
            drawStart={drawStart}
            activeTool={activeTool}
            getPixel={getPixel}
            coordinateToTimePrice={coordinateToTimePrice}
            allCandles={allCandles}
            visibleRange={chartInstance.current ? chartInstance.current.timeScale().getVisibleRange() : null}
            selectedDrawingId={selectedDrawingId}
            hideDrawings={hideDrawings}
            volumeProfile={volumeProfile}
            darkMode={darkMode}
            cursorSettings={cursorSettings}
            hoverCoords={hoverCoords}
            magicTrail={magicTrail}
          />
        )}`;

appCode = appCode.replace(regexPixiLayer, replacementPixiLayer);

fs.writeFileSync('src_demo/App.jsx', appCode, 'utf8');


// 4. Update WebGPUChartEngine to render tempShape and active drawings natively
let gpuCode = fs.readFileSync('src_demo/components/WebGPUChartEngine.jsx', 'utf8');

// Add props
gpuCode = gpuCode.replace(
  "drawings = []\n}, ref) => {",
  "drawings = [],\n  tempShape = null,\n  drawStart = null,\n  activeTool = null\n}, ref) => {"
);

// Update WGSL drawings injector
const wgslDrawingMatch = gpuCode.match(/const lineData = new Float32Array\(drawings\.length \* 12\);[\s\S]*?renderPass\.draw\(ptr \/ 6\);/m);

if (wgslDrawingMatch) {
  const newWgslDrawing = `const lineData = new Float32Array((drawings.length + 1) * 12); // +1 for tempShape
       let ptr = 0;
       const color = [0.2, 0.6, 1.0, 1.0]; // Blue
       
       const drawLine = (p1, p2) => {
           lineData[ptr++] = px(p1.time); lineData[ptr++] = py(p1.price); 
           lineData[ptr++] = color[0]; lineData[ptr++] = color[1]; lineData[ptr++] = color[2]; lineData[ptr++] = color[3];
           
           lineData[ptr++] = px(p2.time); lineData[ptr++] = py(p2.price); 
           lineData[ptr++] = color[0]; lineData[ptr++] = color[1]; lineData[ptr++] = color[2]; lineData[ptr++] = color[3];
       };

       for (let i=0; i<drawings.length; i++) {
          const d = drawings[i];
          if (d.tool === 'trendline' && d.points.length >= 2) {
             drawLine(d.points[0], d.points[1]);
          }
       }
       
       if (activeTool === 'trendline' && drawStart && tempShape) {
          drawLine(drawStart, tempShape);
       }
       
       if (ptr > 0) {
          gpu.current.device.queue.writeBuffer(gpu.current.lineBuffer, 0, lineData, 0, ptr);
          renderPass.setPipeline(gpu.current.linePipeline);
          renderPass.setBindGroup(0, gpu.current.lineBindGroup);
          renderPass.setVertexBuffer(0, gpu.current.lineBuffer);
          renderPass.draw(ptr / 6);
       }`;
  gpuCode = gpuCode.replace(wgslDrawingMatch[0], newWgslDrawing);
}

// Add tempShape dependencies to render hook
gpuCode = gpuCode.replace('}, [drawings]);', '}, [drawings, tempShape, activeTool, drawStart]);');

fs.writeFileSync('src_demo/components/WebGPUChartEngine.jsx', gpuCode, 'utf8');

console.log('Successfully applied universal drawing persistence logic');
