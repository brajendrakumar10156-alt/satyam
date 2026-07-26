const fs = require('fs');
let content = fs.readFileSync('src/WebContainer.tsx', 'utf8');
content = content.replace('import Canvas2DChartEngine from "./components/Canvas2DChartEngine";', '');
fs.writeFileSync('src/WebContainer.tsx', content, 'utf8');
console.log('Removed dead import');
