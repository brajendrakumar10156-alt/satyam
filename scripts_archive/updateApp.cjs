const fs = require('fs');
const file = 'src/App.jsx';
let content = fs.readFileSync(file, 'utf8');

// Import PixiDrawingLayer
if (!content.includes('PixiDrawingLayer')) {
  content = content.replace("import React,", "import React, { useRef, useCallback } from 'react';\nimport PixiDrawingLayer from './components/PixiDrawingLayer';\nimport React_,");
}

// Replace canvasRef
content = content.replace('const canvasRef = useRef(null);', 'const drawingLayerRef = React.useRef(null);');

// Remove drawOnCanvas block
const startStr = '  const drawOnCanvas = useCallback(() => {';
const endStr = '  }, [drawings, tempShape, activeTool, drawStart, brushPath, hideDrawings, magnetMode, hoverCoords, magicTrail, cursorSettings]);';
const startIdx = content.indexOf(startStr);
const endIdx = content.indexOf(endStr);
if (startIdx !== -1 && endIdx !== -1) {
  content = content.slice(0, startIdx) + content.slice(endIdx + endStr.length + 1); // +1 for newline
}

// Update requestDraw
content = content.replace(
  'if (rafIdRef.current) return;\n    rafIdRef.current = requestAnimationFrame(() => {\n      drawOnCanvas();\n      rafIdRef.current = null;\n    });',
  'if (drawingLayerRef.current) drawingLayerRef.current.draw();'
);

// Update getPixel function which needs to be passed to PixiDrawingLayer
const getPixelDef = `
  const getPixel = React.useCallback((time, price) => {
    if (!chartInstance.current || !candleSeries.current) return null;
    const x = chartInstance.current.timeScale().timeToCoordinate(time);
    const y = candleSeries.current.priceToCoordinate(price);
    return { x, y };
  }, []);
  
  const coordinateToTimePrice = React.useCallback((x, y) => {
    if (!chartInstance.current || !candleSeries.current) return null;
    const time = chartInstance.current.timeScale().coordinateToTime(x);
    const price = candleSeries.current.coordinateToPrice(y);
    return { time, price };
  }, []);
`;
if (!content.includes('const getPixel =')) {
  content = content.replace('const handleChartClick =', getPixelDef + '\n  const handleChartClick =');
}

// Replace canvas element
const canvasElemStart = content.indexOf('<canvas ref={canvasRef}');
if (canvasElemStart !== -1) {
  const canvasElemEnd = content.indexOf('/>', canvasElemStart) + 2;
  const pixiLayerStr = `<PixiDrawingLayer 
          ref={drawingLayerRef}
          width={window.innerWidth - 320}
          height={window.innerHeight - 56}
          drawings={drawings}
          brushPath={brushPath}
          tempShape={tempShape}
          drawStart={drawStart}
          activeTool={activeTool}
          getPixel={getPixel}
          coordinateToTimePrice={coordinateToTimePrice}
          allCandles={allCandles}
          visibleRange={chartInstance.current?.timeScale().getVisibleRange()}
          selectedDrawingIndex={selectedDrawingIndex}
          hideDrawings={hideDrawings}
          volumeProfile={volumeProfile}
          darkMode={darkMode}
          cursorSettings={cursorSettings}
          hoverCoords={hoverCoords}
          magicTrail={magicTrail}
        />`;
  content = content.slice(0, canvasElemStart) + pixiLayerStr + content.slice(canvasElemEnd);
}

fs.writeFileSync(file, content);
console.log('App.jsx updated successfully!');
