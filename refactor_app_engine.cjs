const fs = require('fs');
let code = fs.readFileSync('src_demo/App.jsx', 'utf8');

// State init
code = code.replace(
  "const [useWebGL, setUseWebGL] = useState(() => {",
  "const [renderEngine, setRenderEngine] = useState(() => {"
);
code = code.replace(
  "return localStorage.getItem('renderEngine') === 'webgl';",
  "return localStorage.getItem('renderEngine') || 'canvas2d';"
);

// Toggle logic
const oldToggle = "const nextMode = !useWebGL;\n    setUseWebGL(nextMode);\n    localStorage.setItem('renderEngine', nextMode ? 'webgl' : '2d');\n    setToastMsg(nextMode ? '⚡ WebGL Engine — GPU Accelerated' : '🎨 Canvas 2D Engine');";
const newToggle = "const nextMode = renderEngine === 'canvas2d' ? 'webgl' : renderEngine === 'webgl' ? 'webgpu' : 'canvas2d';\n    setRenderEngine(nextMode);\n    localStorage.setItem('renderEngine', nextMode);\n    setToastMsg(nextMode === 'canvas2d' ? '🎨 Canvas 2D Engine' : nextMode === 'webgl' ? '⚡ WebGL Engine' : '🚀 WebGPU Engine');";
code = code.replace(oldToggle, newToggle);

// If statements
code = code.replace(/if \(!useWebGL && \(!chartInstance/g, "if (renderEngine === 'canvas2d' && (!chartInstance");
code = code.replace(/if \(!useWebGL && chartInstance/g, "if (renderEngine === 'canvas2d' && chartInstance");
code = code.replace(/if \(useWebGL && webGLEngineRef/g, "if ((renderEngine === 'webgl' || renderEngine === 'webgpu') && webGLEngineRef");
code = code.replace(/if \(!chartRef\.current \|\| useWebGL\)/g, "if (!chartRef.current || renderEngine !== 'canvas2d')");
code = code.replace(/!useWebGL/g, "(renderEngine === 'canvas2d')");
code = code.replace(/useWebGL/g, "(renderEngine === 'webgl' || renderEngine === 'webgpu')");

// We should be careful blindly replacing useWebGL. I will just do the dependencies manually.

fs.writeFileSync('src_demo/App.jsx', code, 'utf8');
console.log('done refactoring script');
