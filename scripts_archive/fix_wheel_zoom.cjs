const fs = require('fs');
const path = require('path');

const enginePath = path.join(__dirname, 'src_demo', 'components', 'WebGLChartEngine.jsx');
let engineCode = fs.readFileSync(enginePath, 'utf8');

// The wheel listener is the first occurrence of this string, the pointerdown is the second.
// We can just replace the specific wheel event line.
const wheelRegex = /app\.canvas\.addEventListener\('wheel', \(e\) => \{\n\s*if \(activeToolRef\.current \|\| isHoveringDrawingRef\.current\) return;/;
const wheelFixed = `app.canvas.addEventListener('wheel', (e) => {\n        if (activeToolRef.current) return;`;

engineCode = engineCode.replace(wheelRegex, wheelFixed);

fs.writeFileSync(enginePath, engineCode, 'utf8');
console.log("WebGLChartEngine.jsx wheel zoom bug fixed!");
