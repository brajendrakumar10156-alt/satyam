const fs = require('fs');
const lines = fs.readFileSync('src/App.jsx.bak', 'utf8').split(/\r?\n/);

// 1. Add Imports
const importIdx = lines.findIndex(l => l.includes("import Editor from '@monaco-editor/react';"));
if (importIdx !== -1) {
  lines.splice(importIdx, 0, "import PixiDrawingLayer from './components/PixiDrawingLayer';");
  lines.splice(importIdx + 1, 0, "import WebGLChartEngine from './components/WebGLChartEngine';");
}

// 2. Add useWebGL state
const chartLayoutIdx = lines.findIndex(l => l.includes("const [chartLayout, setChartLayout] = useState('1');"));
if (chartLayoutIdx !== -1) {
  lines.splice(chartLayoutIdx + 1, 0, "  const [useWebGL, setUseWebGL] = useState(false);");
  lines.splice(chartLayoutIdx + 2, 0, "  const webGLEngineRef = useRef(null);");
}

// 3. Replace canvasRef with drawingLayerRef
const canvasRefIdx = lines.findIndex(l => l.includes("const canvasRef = useRef(null);"));
if (canvasRefIdx !== -1) {
  lines[canvasRefIdx] = "  const drawingLayerRef = useRef(null);";
}

// 4. Add getPixel & coordinateToTimePrice right before handlePointerUp
const handlePointerUpIdx = lines.findIndex(l => l.includes("const handlePointerUp = () => {"));
if (handlePointerUpIdx !== -1) {
  const getPixelCode = [
    "  const getPixel = useCallback((time, price) => {",
    "    if (useWebGL && webGLEngineRef.current) {",
    "      return webGLEngineRef.current.getPixel(time, price);",
    "    }",
    "    if (!chartInstance.current || !candleSeries.current) return null;",
    "    const x = chartInstance.current.timeScale().timeToCoordinate(time);",
    "    const y = candleSeries.current.priceToCoordinate(price);",
    "    return { x, y };",
    "  }, [useWebGL]);",
    "",
    "  const coordinateToTimePrice = useCallback((x, y) => {",
    "    if (useWebGL && webGLEngineRef.current) {",
    "      return webGLEngineRef.current.coordinateToTimePrice(x, y);",
    "    }",
    "    if (!chartInstance.current || !candleSeries.current) return null;",
    "    const time = chartInstance.current.timeScale().coordinateToTime(x);",
    "    const price = candleSeries.current.coordinateToPrice(y);",
    "    return { time, price };",
    "  }, [useWebGL]);",
    ""
  ];
  lines.splice(handlePointerUpIdx, 0, ...getPixelCode);
}

// 5. Remove drawOnCanvas, requestDraw block, and rafIdRef usage
let rafIdRefDeclIdx = lines.findIndex(l => l.includes("const rafIdRef = useRef(null);"));
let drawOnCanvasStart = lines.findIndex(l => l.includes("const drawOnCanvas = useCallback(() => {"));
let requestDrawEnd = lines.findIndex(l => l.includes("}, [drawOnCanvas]);"));

if (rafIdRefDeclIdx !== -1 && drawOnCanvasStart !== -1 && requestDrawEnd !== -1) {
  // Remove everything from rafIdRef to the end of requestDraw
  lines.splice(rafIdRefDeclIdx, requestDrawEnd - rafIdRefDeclIdx + 1, 
    "  const requestDraw = useCallback(() => {",
    "    if (drawingLayerRef.current) drawingLayerRef.current.draw();",
    "  }, []);"
  );
}

// Remove the rafIdRef cleanup inside the useEffect
const rafCleanupIdx = lines.findIndex(l => l.includes("if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);"));
if (rafCleanupIdx !== -1) {
  lines.splice(rafCleanupIdx, 1); // Delete the line completely
}

// 6. Fix resizeCanvas inside useEffect
const resizeCanvasStart = lines.findIndex(l => l.includes("const resizeCanvas = () => {"));
if (resizeCanvasStart !== -1) {
  let resizeCanvasEnd = -1;
  for (let i = resizeCanvasStart; i < lines.length; i++) {
    if (lines[i].includes("};")) {
      resizeCanvasEnd = i;
      break;
    }
  }
  if (resizeCanvasEnd !== -1) {
    lines.splice(resizeCanvasStart, resizeCanvasEnd - resizeCanvasStart + 1,
      "    const resizeCanvas = () => {",
      "      if (!chartRef.current || !chartInstance.current) return;",
      "      requestDraw();",
      "    };"
    );
  }
}

// 7. Inject WebGL toggle button in Topbar JSX
const settingsBtnIdx = lines.findIndex(l => l.includes("{/* Settings Button */}"));
if (settingsBtnIdx !== -1) {
  const webGLBtnCode = [
    '            {/* Toggle WebGL Button */}',
    '            <button',
    '              onClick={() => setUseWebGL(!useWebGL)}',
    '              className={`p-2 rounded-lg transition-colors flex items-center justify-center ${useWebGL ? \'bg-emerald-500/20 text-emerald-400\' : \'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100\'}`}',
    '              title={useWebGL ? \'WebGL Engine Active\' : \'Switch to WebGL\'}',
    '            >',
    '              <Zap className="w-5 h-5" />',
    '            </button>'
  ];
  lines.splice(settingsBtnIdx, 0, ...webGLBtnCode);
}

// Fix lucide-react Zap import if necessary
const lucideIdx = lines.findIndex(l => l.includes("from 'lucide-react';"));
if (lucideIdx !== -1 && !lines[lucideIdx].includes("Zap")) {
  lines[lucideIdx] = lines[lucideIdx].replace("from 'lucide-react';", ", Zap } from 'lucide-react';");
}

// 8. Replace ALL <canvas ref={canvasRef} ... /> with PixiDrawingLayer
const pixiLayerCode = [
  '          <PixiDrawingLayer ',
  '            ref={drawingLayerRef}',
  '            drawings={drawings}',
  '            brushPath={brushPath}',
  '            tempShape={tempShape}',
  '            drawStart={drawStart}',
  '            activeTool={activeTool}',
  '            getPixel={getPixel}',
  '            coordinateToTimePrice={coordinateToTimePrice}',
  '            allCandles={allCandles}',
  '            visibleRange={chartInstance.current ? chartInstance.current.timeScale().getVisibleRange() : null}',
  '            selectedDrawingIndex={selectedDrawingIndex}',
  '            hideDrawings={hideDrawings}',
  '            volumeProfile={volumeProfile}',
  '            darkMode={darkMode}',
  '            cursorSettings={cursorSettings}',
  '            hoverCoords={hoverCoords}',
  '            magicTrail={magicTrail}',
  '          />'
];

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("<canvas ref={canvasRef}")) {
    lines.splice(i, 1, ...pixiLayerCode); // Replace canvas with PixiDrawingLayer
  }
}

// 9. Replace main layout chart wrapper to support WebGLChartEngine
const mainLayoutChartDiv = '<div ref={chartRef} className="absolute inset-0 z-0" />';
for (let i = 0; i < lines.length; i++) {
  if (lines[i].trim() === mainLayoutChartDiv) {
    const spaces = lines[i].match(/^\s*/)[0]; // Preserve indentation
    const newEngineCode = [
      spaces + '{useWebGL ? (',
      spaces + '  <WebGLChartEngine',
      spaces + '    ref={webGLEngineRef}',
      spaces + '    candles={allCandles}',
      spaces + '    chartType={chartType}',
      spaces + '    drawings={drawings}',
      spaces + '    tempShape={tempShape}',
      spaces + '    drawStart={drawStart}',
      spaces + '    brushPath={brushPath}',
      spaces + '    activeTool={activeTool}',
      spaces + '    selectedDrawingIndex={selectedDrawingIndex}',
      spaces + '    hideDrawings={hideDrawings}',
      spaces + '    volumeProfile={volumeProfile}',
      spaces + '    darkMode={darkMode}',
      spaces + '    cursorSettings={cursorSettings}',
      spaces + '    hoverCoords={hoverCoords}',
      spaces + '    magicTrail={magicTrail}',
      spaces + '  />',
      spaces + ') : (',
      spaces + '  <div ref={chartRef} className="absolute inset-0 z-0" />',
      spaces + ')}'
    ];
    lines.splice(i, 1, ...newEngineCode);
    break; // Only replace the first one which is the main chart
  }
}

fs.writeFileSync('src/App.jsx', lines.join('\n'));
console.log('App.jsx successfully and perfectly patched.');
