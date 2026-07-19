const fs = require('fs');
const file = 'src/App.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Import WebGLChartEngine
if (!content.includes('WebGLChartEngine')) {
  content = content.replace("import PixiDrawingLayer from './components/PixiDrawingLayer';", "import PixiDrawingLayer from './components/PixiDrawingLayer';\nimport WebGLChartEngine from './components/WebGLChartEngine';");
}

// 2. Add State and Ref
if (!content.includes('const [useWebGL, setUseWebGL] = useState(false);')) {
  content = content.replace("const [chartLayout, setChartLayout] = useState('1v');", "const [chartLayout, setChartLayout] = useState('1v');\n  const [useWebGL, setUseWebGL] = useState(false);\n  const webGLEngineRef = useRef(null);");
}

// 3. Update getPixel and coordinateToTimePrice
const oldGetPixel = `  const getPixel = useCallback((time, price) => {
    if (!chartInstance.current || !candleSeries.current) return null;
    const x = chartInstance.current.timeScale().timeToCoordinate(time);
    const y = candleSeries.current.priceToCoordinate(price);
    return { x, y };
  }, []);
  
  const coordinateToTimePrice = useCallback((x, y) => {
    if (!chartInstance.current || !candleSeries.current) return null;
    const time = chartInstance.current.timeScale().coordinateToTime(x);
    const price = candleSeries.current.coordinateToPrice(y);
    return { time, price };
  }, []);`;

const newGetPixel = `  const getPixel = useCallback((time, price) => {
    if (useWebGL && webGLEngineRef.current) {
      return webGLEngineRef.current.getPixel(time, price);
    }
    if (!chartInstance.current || !candleSeries.current) return null;
    const x = chartInstance.current.timeScale().timeToCoordinate(time);
    const y = candleSeries.current.priceToCoordinate(price);
    return { x, y };
  }, [useWebGL]);
  
  const coordinateToTimePrice = useCallback((x, y) => {
    if (useWebGL && webGLEngineRef.current) {
      return webGLEngineRef.current.coordinateToTimePrice(x, y);
    }
    if (!chartInstance.current || !candleSeries.current) return null;
    const time = chartInstance.current.timeScale().coordinateToTime(x);
    const price = candleSeries.current.coordinateToPrice(y);
    return { time, price };
  }, [useWebGL]);`;

if (content.includes(oldGetPixel)) {
  content = content.replace(oldGetPixel, newGetPixel);
}

// 4. Update the render container
const oldChartRender = '<div ref={chartRef} className="w-full h-full absolute top-0 left-0" />';
const newChartRender = `
                      {!useWebGL && <div ref={chartRef} className="w-full h-full absolute top-0 left-0" />}
                      {useWebGL && (
                        <WebGLChartEngine
                          ref={webGLEngineRef}
                          width={window.innerWidth - 320}
                          height={window.innerHeight - 56}
                          data={allCandles}
                          darkMode={darkMode}
                        />
                      )}
`;
if (content.includes(oldChartRender)) {
  content = content.replace(oldChartRender, newChartRender);
}

// 5. Add a button to the toolbar
const oldDarkModeBtn = '<button\n              onClick={() => setDarkMode(!darkMode)}';
const newWebGLBtn = `
            <button
              onClick={() => setUseWebGL(!useWebGL)}
              className={\`p-2 rounded-lg transition-colors flex items-center gap-2 \${
                useWebGL ? (darkMode ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-100 text-indigo-600') : (darkMode ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-600')
              }\`}
              title="Toggle WebGL Chart Engine"
            >
              <Zap size={20} />
              <span className="text-sm font-medium">WebGL</span>
            </button>
            <button
              onClick={() => setDarkMode(!darkMode)}`;
if (content.includes(oldDarkModeBtn)) {
  content = content.replace(oldDarkModeBtn, newWebGLBtn);
}

fs.writeFileSync(file, content);
console.log('Phase 3 implementation injected.');
