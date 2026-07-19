const fs = require('fs');

let app = fs.readFileSync('src_demo/App.jsx', 'utf8');

// 1. Fix findDrawingAtCoords
let findDrawOld = `  const findDrawingAtCoords = (x, y) => {
    if (!chartInstance.current || !candleSeries.current) return -1;
    
    const getPixel = (time, price) => {
      const px = chartInstance.current.timeScale().timeToCoordinate(time);
      const py = candleSeries.current.priceToCoordinate(price);
      return { x: px, y: py };
    };`;
let findDrawNew = `  const findDrawingAtCoords = (x, y) => {
    if (!useWebGL && (!chartInstance.current || !candleSeries.current)) return null;
    
    // getPixel is already available in the component scope, so we use it directly instead of redefining it locally.
    // Wait, the outer getPixel might not be captured here if we shadow it or if we define this function before getPixel.
    // Let's rely on the outer getPixel by removing the local definition.`;

app = app.replace(findDrawOld, findDrawNew);

// 2. Fix handlePointerDown
let hDownOld = `  const handlePointerDown = (e) => {
    if (!chartInstance.current || !candleSeries.current) return;`;
let hDownNew = `  const handlePointerDown = (e) => {
    if (!useWebGL && (!chartInstance.current || !candleSeries.current)) return;`;
app = app.replace(hDownOld, hDownNew);

// 3. Fix handlePointerDown coordinate reading
let hDownCoordOld = `    const { x, y } = getChartCoords(e.clientX, e.clientY);
    let time = chartInstance.current.timeScale().coordinateToTime(x);
    let price = candleSeries.current.coordinateToPrice(y);`;
let hDownCoordNew = `    const { x, y } = getChartCoords(e.clientX, e.clientY);
    const coords = coordinateToTimePrice(x, y);
    if (!coords) return;
    let time = coords.time;
    let price = coords.price;`;
app = app.replace(hDownCoordOld, hDownCoordNew);

// 4. Fix Eraser tool logic
let eraserOld = `    if (activeTool === 'eraser') {
      const getPixel = (t, p) => ({
        x: chartInstance.current.timeScale().timeToCoordinate(t),
        y: candleSeries.current.priceToCoordinate(p)
      });
      const hitRadius = 25;`;
let eraserNew = `    if (activeTool === 'eraser') {
      const hitRadius = 25;`;
app = app.replace(eraserOld, eraserNew);

// 5. Fix handlePointerMove
let hMoveOld = `  const handlePointerMove = (e) => {
    if (!chartInstance.current || !candleSeries.current) return;`;
let hMoveNew = `  const handlePointerMove = (e) => {
    if (!useWebGL && (!chartInstance.current || !candleSeries.current)) return;`;
app = app.replace(hMoveOld, hMoveNew);

let hMoveCoordOld = `    if (!isDrawing || !activeTool) return;
    let time = chartInstance.current.timeScale().coordinateToTime(x);
    let price = candleSeries.current.coordinateToPrice(y);`;
let hMoveCoordNew = `    if (!isDrawing || !activeTool) return;
    const coords = coordinateToTimePrice(x, y);
    if (!coords) return;
    let time = coords.time;
    let price = coords.price;`;
app = app.replace(hMoveCoordOld, hMoveCoordNew);

// 6. Left Toolbar UI Update - Grouping drawing tools
const leftToolbarOldRegex = /const drawingTools = \[[\s\S]*?\];/;
const leftToolbarNew = `const drawingTools = [
      { id: 'trendline', title: 'Trendline', icon: Minus },
      { id: 'ray', title: 'Ray', icon: ArrowUpRight },
      { id: 'infoline', title: 'Info Line', icon: Info },
      { id: 'extendedline', title: 'Extended Line', icon: MoveHorizontal },
      { id: 'channel', title: 'Parallel Channel', icon: SplitSquareHorizontal },
      { id: 'horizontal_line', title: 'Horiz Line', icon: Minus },
      { id: 'horizontal_ray', title: 'Horiz Ray', icon: ArrowRight },
      { id: 'vertical_line', title: 'Vertical Line', icon: MoveVertical },
      { id: 'crossline', title: 'Cross Line', icon: Plus },
      { id: 'trendangle', title: 'Trend Angle', icon: BaseLine || Minus }, // Fallback if Baseline is missing
      { id: 'fibonacci', title: 'Fib Retracement', icon: Columns },
      { id: 'fib_extension', title: 'Fib Extension', icon: Columns },
      { id: 'fib_timezone', title: 'Fib Time Zone', icon: Columns },
      { id: 'pitchfork', title: 'Pitchfork', icon: GitBranch },
      { id: 'schiff_pitchfork', title: 'Schiff Pitchfork', icon: GitBranch },
      { id: 'andrews_pitchfork', title: 'Andrews Pitchfork', icon: GitBranch },
      { id: 'gann_square', title: 'Gann Square', icon: Grid3x3 },
      { id: 'gann_box', title: 'Gann Box', icon: Grid3x3 },
      { id: 'rectangle', title: 'Rectangle', icon: SplitSquareHorizontal },
      { id: 'polyline', title: 'Polyline', icon: Spline },
      { id: 'regression_trend', title: 'Regression Trend', icon: TrendingDown },
    ];`;

app = app.replace(leftToolbarOldRegex, leftToolbarNew);

const oldDrawingRender = /{drawingTools\.map\(t => \([\s\S]*?}\)}/;
const newDrawingRender = `{/* Grouped Drawing Tools */}
        <div className="relative group">
          <button
            title="Drawing Tools"
            className={\`p-2.5 rounded-lg transition-all flex items-center justify-center \${activeTool && drawingTools.find(d => d.id === activeTool) ? 'bg-[#7C5CFF] text-white shadow-lg shadow-[#7C5CFF]/30' : (darkMode ? 'hover:bg-[#2a2e39] text-[#B2B5BE] hover:text-[#7C5CFF]' : 'hover:bg-gray-200 text-gray-500 hover:text-blue-600')}\`}
          >
            <PenTool size={20} />
          </button>
          
          <div className="absolute left-full ml-2 top-0 hidden group-hover:flex flex-col bg-[#131722] border border-[#2a2e39] rounded-lg shadow-xl w-64 max-h-[80vh] overflow-y-auto z-50 p-2">
            <div className="text-xs font-semibold text-gray-400 mb-2 px-2 pt-1 uppercase tracking-wider">Drawing Tools</div>
            <div className="grid grid-cols-2 gap-1">
              {drawingTools.map(t => (
                <button
                  key={t.id}
                  onClick={() => setActiveTool(activeTool === t.id ? null : t.id)}
                  className={\`flex items-center gap-2 p-2 rounded transition-all text-left \${activeTool === t.id ? 'bg-[#7C5CFF] text-white' : 'hover:bg-[#2a2e39] text-[#B2B5BE] hover:text-[#7C5CFF]'}\`}
                  title={t.title}
                >
                  <t.icon size={16} />
                  <span className="text-sm">{t.title}</span>
                </button>
              ))}
            </div>
          </div>
        </div>`;

app = app.replace(oldDrawingRender, newDrawingRender);

fs.writeFileSync('src_demo/App.jsx', app);
console.log('src_demo/App.jsx modified successfully to support WebGL drawing and grouped toolbar.');
