const fs = require('fs');
let content = fs.readFileSync('src/WebContainer.tsx', 'utf8');

content = content.replace(/<NativeCanvasEngine candles={allCandles} darkMode={darkMode} \/>/g, 
    '<NativeCanvasEngine candles={allCandles} darkMode={darkMode} onVisibleRangeChange={setNativeVisibleRange} />');

content = content.replace(/visibleRange={viewportSnapshotRef.current\?\.visibleRange \|\| \(chartInstance.current \? chartInstance.current.timeScale\(\).getVisibleRange\(\) : null\)}/g, 
    'visibleRange={nativeVisibleRange || viewportSnapshotRef.current?.visibleRange}');

fs.writeFileSync('src/WebContainer.tsx', content, 'utf8');
