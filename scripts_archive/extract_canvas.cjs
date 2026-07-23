const fs = require('fs');

function removeCreateChart() {
  let code = fs.readFileSync('src_demo/App.jsx', 'utf8');

  // 1. Inject import
  const importStr = "import Canvas2DChartEngine from './components/Canvas2DChartEngine';\n";
  if (!code.includes('Canvas2DChartEngine')) {
    code = code.replace("import PixiDrawingLayer", importStr + "import PixiDrawingLayer");
  }

  // 2. Remove createChart
  const startIdx = code.indexOf('useEffect(() => {\r\n    if (!chartRef.current || renderEngine !== \'canvas2d\') return;');
  const startIdxLF = code.indexOf('useEffect(() => {\n    if (!chartRef.current || renderEngine !== \'canvas2d\') return;');
  const actualStart = startIdx !== -1 ? startIdx : startIdxLF;

  if (actualStart !== -1) {
    let braceCount = 0;
    let endIdx = -1;
    for (let i = actualStart; i < code.length; i++) {
      if (code[i] === '{') braceCount++;
      if (code[i] === '}') {
        braceCount--;
        if (braceCount === 0) {
          endIdx = i;
          break;
        }
      }
    }
    let fullEndIdx = endIdx;
    while (fullEndIdx < code.length && code[fullEndIdx] !== ';') {
      fullEndIdx++;
    }
    if (fullEndIdx !== -1) {
      code = code.substring(0, actualStart) + code.substring(fullEndIdx + 1);
      console.log('Successfully removed createChart useEffect.');
    }
  }

  // 3. Replace div WITH CORRECT JSX (No curly brace expressions inside ternary wrapper)
  const divStr = '<div ref={chartRef} className="w-full h-full absolute top-0 left-0" />';
  const newCanvasEngineStr = `<Canvas2DChartEngine
      ref={(r) => {
        if (r) {
          chartInstance.current = r.chartInstance;
          candleSeries.current = r.candleSeries;
          volumeSeries.current = r.volumeSeries;
        }
      }}
      candles={allCandles}
      darkMode={darkMode}
      chartInterval={chartInterval}
      timezoneOffset={timezoneOffset}
      isMobile={isMobile}
      onCrosshairMove={(param) => {
        if (param.time) updateCrosshairDOM(param.time);
        else updateCrosshairDOM(null);
      }}
    />`;

  if (code.includes(divStr)) {
    code = code.replace(divStr, newCanvasEngineStr);
    console.log('Replaced div.');
  }

  fs.writeFileSync('src_demo/App.jsx', code);
  console.log('Done.');
}

removeCreateChart();
