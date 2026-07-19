const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, 'src_demo', 'App.jsx');
let code = fs.readFileSync(appPath, 'utf8');

// 1. Remove the capture phase interception
const interceptionCodeRegex = /  \/\/ ─── WebGL Event Interception[\s\S]*?}, \[useWebGL, activeTool, drawings, findDrawingAtCoords\]\);\n\n/m;
code = code.replace(interceptionCodeRegex, "  ");
fs.writeFileSync(appPath, code, 'utf8');

console.log("App.jsx cleaned up from bad capture patch.");
