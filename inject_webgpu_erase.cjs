const fs = require('fs');

let appCode = fs.readFileSync('src_demo/App.jsx', 'utf8');

// 1. Add onDrawingDelete callback to App.jsx
const regexDeleteCallback = /const handleWebGPUDrawingComplete = \(newDrawing\) => \{[\s\S]*?\};/m;
const replacementDeleteCallback = `const handleWebGPUDrawingComplete = (newDrawing) => {
    setDrawings(prev => [...prev, newDrawing]);
    setDrawStart(null);
    setTempShape(null);
    setActiveTool(null);
  };
  
  const handleWebGPUDrawingDelete = (id) => {
    setDrawings(prev => prev.filter(d => d.id !== id));
  };`;

if (!appCode.includes('handleWebGPUDrawingDelete')) {
  appCode = appCode.replace(regexDeleteCallback, replacementDeleteCallback);
}

// 2. Pass onDrawingDelete to WebGPUChartEngine
const matchGPU = appCode.match(/<WebGPUChartEngine[\s\S]*?onDrawingComplete=\{handleWebGPUDrawingComplete\}\n\s*onChartReady=\{/m);
if (matchGPU) {
  const newGPUProp = matchGPU[0].replace(
    /onChartReady=\{/,
    `onDrawingDelete={handleWebGPUDrawingDelete}\n                            onChartReady={`
  );
  appCode = appCode.replaceAll(matchGPU[0], newGPUProp);
}

fs.writeFileSync('src_demo/App.jsx', appCode, 'utf8');


// 3. Update WebGPUChartEngine to use Raycasting on click
let gpuCode = fs.readFileSync('src_demo/components/WebGPUChartEngine.jsx', 'utf8');

// Add raycastDrawings import
gpuCode = gpuCode.replace(
  "import { lineToQuad } from '../utils/webgpuMath';",
  "import { lineToQuad, raycastDrawings } from '../utils/webgpuMath';"
);

// Add onDrawingDelete prop
gpuCode = gpuCode.replace(
  "onDrawingComplete\n}, ref) => {",
  "onDrawingComplete,\n  onDrawingDelete\n}, ref) => {"
);

// Update pointer events for Erase tool
const regexPointerDown = /if \(activeTool && activeTool !== 'cursor'\) \{/m;
const replacementPointerDown = `if (activeTool === 'eraser') {
         const { left, top } = canvas.getBoundingClientRect();
         const mouseX = e.clientX - left;
         const mouseY = e.clientY - top;
         
         const { min, max } = vState.current.priceRange;
         const priceRange = max - min;
         const ch = vState.current.height;
         const priceScale = priceRange > 0 ? (ch - 26) / priceRange : 1;
         const py = (price) => (max - price) * priceScale;
         
         const cw = vState.current.width;
         const logicalRange = vState.current.logicalRange;
         const rangeLen = logicalRange.to - logicalRange.from;
         const px = (time) => {
            const idx = timeToIndex(time, data);
            return ((idx - logicalRange.from) / rangeLen) * (cw - 64);
         };
         
         const hit = raycastDrawings(drawings, mouseX, mouseY, px, py, 8); // 8px tolerance
         if (hit && onDrawingDelete) {
            onDrawingDelete(hit.id);
         }
         return;
      }
      
      if (activeTool && activeTool !== 'cursor') {`;

if (gpuCode.includes("if (activeTool && activeTool !== 'cursor') {")) {
  gpuCode = gpuCode.replace(regexPointerDown, replacementPointerDown);
}

// 4. TimeToIndex helper missing in WebGPU event handler
// Add a quick binary search helper to webgpu math or locally
const regexTimeToIndex = /const timeToIndex = \(time, data\) => \{[\s\S]*?\};/m;
if (!regexTimeToIndex.test(gpuCode)) {
  const helper = `\n  const timeToIndex = (time, data) => {
    let l = 0, r = data.length - 1;
    while (l <= r) {
      const m = (l + r) >> 1;
      if (data[m].time === time) return m;
      if (data[m].time < time) l = m + 1;
      else r = m - 1;
    }
    return l;
  };\n\n  useEffect(() => {`;
  gpuCode = gpuCode.replace('useEffect(() => {', helper);
}

fs.writeFileSync('src_demo/components/WebGPUChartEngine.jsx', gpuCode, 'utf8');
console.log('Successfully applied Erase logic and WebGPU detachment');
