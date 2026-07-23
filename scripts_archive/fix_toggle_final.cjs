const fs = require('fs');
let code = fs.readFileSync('src_demo/App.jsx', 'utf8');

// 1. Fix handleEngineToggle
const oldToggle = `    const nextMode = (renderEngine === 'canvas2d');
    setUseWebGL(nextMode);
    localStorage.setItem('renderEngine', nextMode ? 'webgl' : '2d');
    setToastMsg(nextMode ? '⚡ WebGL Engine — GPU Accelerated' : '🎨 Canvas 2D Engine');`;

const newToggle = `    let nextMode = 'webgl';
    if (renderEngine === 'canvas2d') nextMode = 'webgl';
    else if (renderEngine === 'webgl') nextMode = 'webgpu';
    else nextMode = 'canvas2d';

    setRenderEngine(nextMode);
    localStorage.setItem('renderEngine', nextMode);
    
    if (nextMode === 'webgpu') setToastMsg('🚀 WebGPU Engine — Extreme Performance');
    else if (nextMode === 'webgl') setToastMsg('⚡ WebGL Engine — GPU Accelerated');
    else setToastMsg('🎨 Canvas 2D Engine');`;

if (code.includes(oldToggle)) {
  code = code.replace(oldToggle, newToggle);
  console.log('Fixed handleEngineToggle logic!');
} else {
  // Let's try regex if it failed
  const toggleRegex = /const nextMode = \(renderEngine === 'canvas2d'\);[\s\S]*?setToastMsg\([^)]+\);/m;
  if (toggleRegex.test(code)) {
    code = code.replace(toggleRegex, newToggle);
    console.log('Fixed handleEngineToggle logic using regex!');
  } else {
    // Wait, let's look at the actual text again
    const fallbackRegex = /const nextMode =[^]+?setToastMsg[^)]+\);/m;
    if (fallbackRegex.test(code)) {
        code = code.replace(fallbackRegex, newToggle);
        console.log('Fixed handleEngineToggle logic using fallback regex!');
    } else {
        console.log('Failed to find handleEngineToggle logic.');
    }
  }
}

// 2. Fix toggle button UI
const oldButtonRegex = /\{\/\* ⚡ Rendering Engine Toggle \*\/\}[\s\S]*?<div className="w-6 h-px bg-border my-1" \/>/m;

const newButton = `{/* ⚡ Rendering Engine Toggle */}
          <button
            onClick={handleEngineToggle}
            className={\`w-9 h-9 rounded-lg flex items-center justify-center relative transition-all duration-300 \${
              renderEngine === 'webgpu'
                ? 'bg-purple-500/20 text-purple-400 shadow-[0_0_12px_rgba(168,85,247,0.25)]'
                : renderEngine === 'webgl' 
                ? 'bg-emerald-500/20 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.25)]' 
                : \`\${t.muted} \${t.hover}\`
            }\`}
            title={renderEngine === 'webgpu' ? 'Rendering: WebGPU (Extreme Performance)' : renderEngine === 'webgl' ? 'Rendering: WebGL (GPU Accelerated)' : 'Rendering: Canvas 2D'}
          >
            {renderEngine === 'webgpu' ? (
              <Rocket size={18} strokeWidth={2} className="drop-shadow-[0_0_4px_rgba(168,85,247,0.6)]" />
            ) : (
              <Zap size={18} strokeWidth={2} className={renderEngine === 'webgl' ? 'drop-shadow-[0_0_4px_rgba(16,185,129,0.6)]' : ''} />
            )}
            
            {renderEngine === 'webgpu' ? (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-purple-400 animate-pulse shadow-[0_0_4px_rgba(168,85,247,0.8)]" />
            ) : renderEngine === 'webgl' ? (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_4px_rgba(16,185,129,0.8)]" />
            ) : null}
          </button>
          <div className="w-6 h-px bg-border my-1" />`;

if (oldButtonRegex.test(code)) {
  code = code.replace(oldButtonRegex, newButton);
  console.log('Fixed toggle button UI!');
} else {
  console.log('Failed to find toggle button UI.');
}

fs.writeFileSync('src_demo/App.jsx', code, 'utf8');
