const fs = require('fs');
let code = fs.readFileSync('src/App.jsx', 'utf8');

// Fix resizeCanvas correctly
code = code.replace(
  /const resizeCanvas = \(\) => \{[\s\S]*?requestDraw\(\);\n    \};/g,
  `const resizeCanvas = () => {
      if (!chartRef.current || !chartInstance.current) return;
      // Drawing Layer is responsive via CSS/ResizeObserver internally
      requestDraw();
    };`
);

// We define the PixiDrawingLayer props string
const pixiLayerStr = `<PixiDrawingLayer 
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

// The old canvas line
const oldCanvasStr = `<canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full pointer-events-none z-10" />`;

// Replace all occurrences of old canvas with PixiDrawingLayer
code = code.split(oldCanvasStr).join(pixiLayerStr);

fs.writeFileSync('src/App.jsx', code);
console.log('App.jsx successfully patched for canvasRef.');
