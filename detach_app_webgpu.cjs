const fs = require('fs');
let appCode = fs.readFileSync('src_demo/App.jsx', 'utf8');

// 1. Add onDrawingComplete callback to App.jsx
const regexSetDrawings = /const handleAddDrawing = \(newDrawing\) => \{[\s\S]*?\};/m;
const replacementAddDrawing = `const handleAddDrawing = (newDrawing) => {
    setDrawings(prev => [...prev, newDrawing]);
  };
  
  const handleWebGPUDrawingComplete = (newDrawing) => {
    setDrawings(prev => [...prev, newDrawing]);
    setDrawStart(null);
    setTempShape(null);
    setActiveTool(null);
  };`;

if (!appCode.includes('handleWebGPUDrawingComplete')) {
  appCode = appCode.replace(regexSetDrawings, replacementAddDrawing);
}

// 2. Detach Pointer events from WebGPU container
// We previously passed onPointerDown, etc to a div wrapping WebGPU
const regexWebGPUWrapper = /<div [\s\S]*?className="w-full h-full relative border border-blue-500\/20 rounded overflow-hidden"[\s\S]*?onPointerDown=\{handlePointerDown\}[\s\S]*?onPointerLeave=\{handlePointerUp\}[\s\S]*?>[\s\S]*?<WebGPUErrorBoundary>/m;

// Actually, in App.jsx, the events are on the `chartContainerRef` div which wraps the entire engine.
// Let's modify the onPointer handlers in App.jsx to IGNORE events if renderEngine === 'webgpu'

const regexPointerDown = /const handlePointerDown = \(e\) => \{/m;
const replacementPointerDown = `const handlePointerDown = (e) => {
    if (renderEngine === 'webgpu') return; // WebGPU is autonomous`;
appCode = appCode.replace(regexPointerDown, replacementPointerDown);

const regexPointerMove = /const handlePointerMove = \(e\) => \{/m;
const replacementPointerMove = `const handlePointerMove = (e) => {
    if (renderEngine === 'webgpu') return; // WebGPU is autonomous`;
appCode = appCode.replace(regexPointerMove, replacementPointerMove);

const regexPointerUp = /const handlePointerUp = \(\) => \{/m;
const replacementPointerUp = `const handlePointerUp = () => {
    if (renderEngine === 'webgpu') return; // WebGPU is autonomous`;
appCode = appCode.replace(regexPointerUp, replacementPointerUp);


// 3. Pass onDrawingComplete to WebGPUChartEngine
const regexGPUProp = /<WebGPUChartEngine[\s\S]*?onChartReady=\{\(\) => \{[\s\S]*?\}\}\n\s*\/>/m;

const matchGPU = appCode.match(regexGPUProp);
if (matchGPU) {
  const newGPUProp = matchGPU[0].replace(
    /onChartReady=\{/,
    `onDrawingComplete={handleWebGPUDrawingComplete}\n                            onChartReady={`
  );
  appCode = appCode.replaceAll(matchGPU[0], newGPUProp);
}

fs.writeFileSync('src_demo/App.jsx', appCode, 'utf8');
console.log('Successfully detached App.jsx pointer events from WebGPU');
