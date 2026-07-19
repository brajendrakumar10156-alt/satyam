const fs = require('fs');
let code = fs.readFileSync('src_demo/App.jsx', 'utf8');

const oldButton = `{/* ⚡ Rendering Engine Toggle */}
          <button
            onClick={handleEngineToggle}
            className={\`w-9 h-9 rounded-lg flex items-center justify-center relative transition-all duration-300 \${
              (renderEngine === 'webgl' || renderEngine === 'webgpu') 
                ? 'bg-emerald-500/20 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.25)]' 
                : \`\${t.muted} \${t.hover}\`
            }\`}
            title={\`Rendering: \${(renderEngine === 'webgl' || renderEngine === 'webgpu') ? 'WebGL (GPU Accelerated)' : 'Canvas 2D'}\`}
          >
            <Zap size={18} strokeWidth={2} className={(renderEngine === 'webgl' || renderEngine === 'webgpu') ? 'drop-shadow-[0_0_4px_rgba(16,185,129,0.6)]' : ''} />
            {(renderEngine === 'webgl' || renderEngine === 'webgpu') && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_4px_rgba(16,185,129,0.8)]" />
            )}
          </button>`;

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
          </button>`;

if (code.includes(oldButton)) {
  code = code.replace(oldButton, newButton);
  fs.writeFileSync('src_demo/App.jsx', code, 'utf8');
  console.log('Fixed button!');
} else {
  console.log('Old button not found!');
}
