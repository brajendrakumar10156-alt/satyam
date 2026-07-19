const fs = require('fs');
let code = fs.readFileSync('src_demo/App.jsx', 'utf8');

// Fix the corrupted dependency arrays
code = code.replace(/\[\(renderEngine === 'webgl' \|\| renderEngine === 'webgpu'\)\]/g, "[renderEngine]");
code = code.replace(/\[\(renderEngine === 'webgl' \|\| renderEngine === 'webgpu'\),/g, "[renderEngine,");
code = code.replace(/, \(renderEngine === 'webgl' \|\| renderEngine === 'webgpu'\)\]/g, ", renderEngine]");
code = code.replace(/, \(renderEngine === 'webgl' \|\| renderEngine === 'webgpu'\),/g, ", renderEngine,");

// Fix toggleWebGL logic
const corruptedToggleStart = "const toggleWebGL = useCallback(() => {";
const toggleEnd = "}, [renderEngine, isDrawing, priceScaleMode, autoScale]);";
const startIndex = code.indexOf(corruptedToggleStart);
if (startIndex !== -1) {
  let endIndex = code.indexOf(toggleEnd, startIndex);
  if (endIndex !== -1) {
    const newToggleCode = `const toggleWebGL = useCallback(() => {
    // 3-way toggle
    let nextMode = 'canvas2d';
    if (renderEngine === 'canvas2d') nextMode = 'webgl';
    else if (renderEngine === 'webgl') nextMode = 'webgpu';
    else nextMode = 'canvas2d';

    setRenderEngine(nextMode);
    localStorage.setItem('renderEngine', nextMode);
    setToastMsg(nextMode === 'canvas2d' ? '🎨 Canvas 2D Engine' : nextMode === 'webgl' ? '⚡ WebGL Engine' : '🚀 WebGPU Engine');
  }, [renderEngine, isDrawing, priceScaleMode, autoScale]);`;
    code = code.substring(0, startIndex) + newToggleCode + code.substring(endIndex + toggleEnd.length);
  }
}

// Fix the UI Button block
const oldBtnStart = `<button
            onClick={toggleWebGL}`;
const btnEnd = `</button>`;
let btnStartIdx = code.indexOf(oldBtnStart);
if (btnStartIdx !== -1) {
  let btnEndIdx = code.indexOf(btnEnd, btnStartIdx);
  if (btnEndIdx !== -1) {
    const newBtn = `<button
            onClick={toggleWebGL}
            className={\`px-3 py-1.5 rounded-md flex items-center gap-2 text-sm font-medium transition-all duration-300 relative group
              \${renderEngine === 'webgl' 
                ? 'bg-emerald-500/20 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.25)]' 
                : renderEngine === 'webgpu'
                ? 'bg-purple-500/20 text-purple-400 shadow-[0_0_12px_rgba(168,85,247,0.25)]'
                : \`\${t.muted} \${t.hover}\`
              }
            \`}
            title={\`Rendering: \${renderEngine === 'webgl' ? 'WebGL' : renderEngine === 'webgpu' ? 'WebGPU' : 'Canvas 2D'}\`}
          >
            {renderEngine === 'webgl' ? <Zap size={18} strokeWidth={2} className="drop-shadow-[0_0_4px_rgba(16,185,129,0.6)]" /> :
             renderEngine === 'webgpu' ? <Rocket size={18} strokeWidth={2} className="drop-shadow-[0_0_4px_rgba(168,85,247,0.6)]" /> :
             <LayoutGrid size={18} strokeWidth={2} />}
            
            {(renderEngine === 'webgl' || renderEngine === 'webgpu') && (
              <span className={\`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full animate-pulse \${renderEngine === 'webgl' ? 'bg-emerald-400 shadow-[0_0_4px_rgba(16,185,129,0.8)]' : 'bg-purple-400 shadow-[0_0_4px_rgba(168,85,247,0.8)]'}\`} />
            )}
            
            <span className="hidden md:inline">
              {renderEngine === 'webgl' ? 'WebGL' : renderEngine === 'webgpu' ? 'WebGPU' : 'Canvas 2D'}
            </span>
          </button>`;
    code = code.substring(0, btnStartIdx) + newBtn + code.substring(btnEndIdx + btnEnd.length);
  }
}

// Add Rocket to lucide-react imports if it's not there
if (code.indexOf('Rocket,') === -1) {
  code = code.replace(/import \{/, 'import { Rocket,');
}

// Also import WebGPUChartEngine
if (code.indexOf('WebGPUChartEngine') === -1) {
  code = code.replace("const WebGLChartEngine = lazy(() => import('./components/WebGLChartEngine'));", "const WebGLChartEngine = lazy(() => import('./components/WebGLChartEngine'));\nconst WebGPUChartEngine = lazy(() => import('./components/WebGPUChartEngine'));");
}

// Fix the render block
const renderBlockStart = `{(renderEngine === 'webgl' || renderEngine === 'webgpu') ? (`;
const renderBlockEnd = `) : null}`;
const rbsIdx = code.indexOf(renderBlockStart);
if (rbsIdx !== -1) {
    // We will just replace it completely. But we must be careful with the inner contents, let's use a regex that matches the whole block.
}

fs.writeFileSync('src_demo/App.jsx', code, 'utf8');
console.log('done fixing');
