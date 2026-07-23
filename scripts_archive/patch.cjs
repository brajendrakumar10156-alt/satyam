const fs = require('fs');
let code = fs.readFileSync('src/App.jsx', 'utf8');

// 1. Add Imports
code = code.replace(
  `import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';\nimport Editor from '@monaco-editor/react';`,
  `import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';\nimport PixiDrawingLayer from './components/PixiDrawingLayer';\nimport WebGLChartEngine from './components/WebGLChartEngine';\nimport Editor from '@monaco-editor/react';`
);

// 2. Add canvasRef/drawingLayerRef (Line 279 area)
code = code.replace(
  `const canvasRef = useRef(null);`,
  `const drawingLayerRef = useRef(null);`
);

// 3. Add useWebGL state
code = code.replace(
  `const [chartLayout, setChartLayout] = useState('1');`,
  `const [chartLayout, setChartLayout] = useState('1');\n  const [useWebGL, setUseWebGL] = useState(false);\n  const webGLEngineRef = useRef(null);`
);

// 4. Add getPixel, coordinateToTimePrice right before handlePointerUp
code = code.replace(
  `const handlePointerUp = () => {`,
  `const getPixel = useCallback((time, price) => {\n    if (useWebGL && webGLEngineRef.current) {\n      return webGLEngineRef.current.getPixel(time, price);\n    }\n    if (!chartInstance.current || !candleSeries.current) return null;\n    const x = chartInstance.current.timeScale().timeToCoordinate(time);\n    const y = candleSeries.current.priceToCoordinate(price);\n    return { x, y };\n  }, [useWebGL]);\n\n  const coordinateToTimePrice = useCallback((x, y) => {\n    if (useWebGL && webGLEngineRef.current) {\n      return webGLEngineRef.current.coordinateToTimePrice(x, y);\n    }\n    if (!chartInstance.current || !candleSeries.current) return null;\n    const time = chartInstance.current.timeScale().coordinateToTime(x);\n    const price = candleSeries.current.coordinateToPrice(y);\n    return { time, price };\n  }, [useWebGL]);\n\n  const handlePointerUp = () => {`
);

// 5. Replace requestDraw and remove drawOnCanvas entirely
const lines = code.split('\n');
let start = -1;
let end = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('const drawOnCanvas = useCallback(() => {')) start = i;
  if (start !== -1 && i > start && lines[i].includes('}, [drawings, tempShape, activeTool, drawStart, brushPath, hideDrawings, magnetMode, hoverCoords, magicTrail, cursorSettings]);')) {
    end = i;
    break;
  }
}

if (start !== -1 && end !== -1) {
  let requestDrawStart = -1;
  let requestDrawEnd = -1;
  for (let i = end; i < lines.length; i++) {
    if (lines[i].includes('const requestDraw = useCallback(() => {')) requestDrawStart = i;
    if (requestDrawStart !== -1 && i > requestDrawStart && lines[i].includes('}, [drawOnCanvas]);')) {
      requestDrawEnd = i;
      break;
    }
  }

  let rafIdx = lines.findIndex(l => l.includes('const rafIdRef = useRef(null);'));

  const beforeDrawOnCanvas = lines.slice(0, Math.min(start, rafIdx !== -1 ? rafIdx : start));
  const afterRequestDraw = lines.slice(requestDrawEnd + 1);

  const newCodeArr = [
    ...beforeDrawOnCanvas,
    `  const requestDraw = useCallback(() => {`,
    `    if (drawingLayerRef.current) drawingLayerRef.current.draw();`,
    `  }, []);`,
    ...afterRequestDraw
  ];
  code = newCodeArr.join('\n');
}

// 6. Fix resizeCanvas (remove canvasRef usage)
code = code.replace(
  /const resizeCanvas = \(\) => \{[\s\S]*?requestDraw\(\);\n    \};/g,
  `const resizeCanvas = () => {
      if (!chartRef.current || !chartInstance.current) return;
      // Drawing Layer is responsive via CSS/ResizeObserver internally
      requestDraw();
    };`
);

// 7. Inject WebGL toggle button in Topbar JSX
const webGLButtonStr = `
            {/* Toggle WebGL Button */}
            <button
              onClick={() => setUseWebGL(!useWebGL)}
              className={\`p-2 rounded-lg transition-colors flex items-center justify-center \${useWebGL ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'}\`}
              title={useWebGL ? 'WebGL Engine Active' : 'Switch to WebGL'}
            >
              <Zap className="w-5 h-5" />
            </button>`;
code = code.replace(
  `{/* Settings Button */}`,
  webGLButtonStr + `\n            {/* Settings Button */}`
);

if (!code.includes('Zap')) {
  code = code.replace(`from 'lucide-react';`, `, Zap } from 'lucide-react';`);
}

// 8. Replace canvas element in Render with WebGLChartEngine & PixiDrawingLayer
const newRenderStr = `{useWebGL ? (
            <WebGLChartEngine
              ref={webGLEngineRef}
              candles={allCandles}
              chartType={chartType}
              drawings={drawings}
              tempShape={tempShape}
              drawStart={drawStart}
              brushPath={brushPath}
              activeTool={activeTool}
              selectedDrawingIndex={selectedDrawingIndex}
              hideDrawings={hideDrawings}
              volumeProfile={volumeProfile}
              darkMode={darkMode}
              cursorSettings={cursorSettings}
              hoverCoords={hoverCoords}
              magicTrail={magicTrail}
            />
          ) : (
            <div ref={chartRef} className="absolute inset-0 z-0" />
          )}
          <PixiDrawingLayer 
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
            selectedDrawingIndex={selectedDrawingIndex}
            hideDrawings={hideDrawings}
            volumeProfile={volumeProfile}
            darkMode={darkMode}
            cursorSettings={cursorSettings}
            hoverCoords={hoverCoords}
            magicTrail={magicTrail}
          />`;

code = code.replace(
  `<div ref={chartRef} className="absolute inset-0 z-0" />\n          <canvas\n            ref={canvasRef}\n            className="absolute inset-0 pointer-events-none z-10"\n          />`,
  newRenderStr
);

fs.writeFileSync('src/App.jsx', code);
console.log('App.jsx successfully patched.');
