const fs = require('fs');
const file = 'src_demo/App.tsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Add Import
if (!code.includes("import { LeftToolbar }")) {
    code = code.replace(
        "import React,", 
        "import { LeftToolbar } from './components/layout/LeftToolbar';\nimport React,"
    );
}

// 2. Locate LeftToolbar block
const startText = "  const LeftToolbar = ({ horizontal = false }) => {";
const endText = "  // --- MAIN RENDER ---";
const startIdx = code.indexOf(startText);
const endIdx = code.indexOf(endText);

if (startIdx !== -1 && endIdx !== -1) {
    const before = code.substring(0, startIdx);
    const after = code.substring(endIdx);
    
    code = before + "\n  /* LeftToolbar extracted to LeftToolbar.tsx */\n\n" + after;
}

// 3. Replace {<LeftToolbar horizontal />} and <LeftToolbar /> in App.tsx
// It's rendered as <LeftToolbar horizontal={true} /> or <LeftToolbar />
// But wait, it's actually rendered as <LeftToolbar /> and <LeftToolbar horizontal />.
const propsString = `
<LeftToolbar 
  horizontal={false} t={t} darkMode={darkMode} activeTool={activeTool} 
  setActiveTool={setActiveTool} showToast={showToast} setDrawings={setDrawings}
  selectedTools={selectedTools} setSelectedTools={setSelectedTools} activeFlyout={activeFlyout}
  setActiveFlyout={setActiveFlyout} setIsCursorStudioOpen={setIsCursorStudioOpen} 
  setIsTrendStudioOpen={setIsTrendStudioOpen} chartInstance={chartInstance}
  isMagnetEnabled={magnetMode !== 'off'} setIsMagnetEnabled={() => setMagnetMode(magnetMode === 'off' ? 'normal' : 'off')}
  isDrawingLocked={lockDrawings} setIsDrawingLocked={setLockDrawings}
  isDrawingHidden={hideDrawings} setIsDrawingHidden={setHideDrawings}
  renderEngine={renderEngine} handleEngineToggle={handleEngineToggle}
  keepDrawing={keepDrawing} setKeepDrawing={setKeepDrawing}
  lockDrawings={lockDrawings} setLockDrawings={setLockDrawings}
/>`.trim();

const propsStringHorizontal = `
<LeftToolbar 
  horizontal={true} t={t} darkMode={darkMode} activeTool={activeTool} 
  setActiveTool={setActiveTool} showToast={showToast} setDrawings={setDrawings}
  selectedTools={selectedTools} setSelectedTools={setSelectedTools} activeFlyout={activeFlyout}
  setActiveFlyout={setActiveFlyout} setIsCursorStudioOpen={setIsCursorStudioOpen} 
  setIsTrendStudioOpen={setIsTrendStudioOpen} chartInstance={chartInstance}
  isMagnetEnabled={magnetMode !== 'off'} setIsMagnetEnabled={() => setMagnetMode(magnetMode === 'off' ? 'normal' : 'off')}
  isDrawingLocked={lockDrawings} setIsDrawingLocked={setLockDrawings}
  isDrawingHidden={hideDrawings} setIsDrawingHidden={setHideDrawings}
  renderEngine={renderEngine} handleEngineToggle={handleEngineToggle}
  keepDrawing={keepDrawing} setKeepDrawing={setKeepDrawing}
  lockDrawings={lockDrawings} setLockDrawings={setLockDrawings}
/>`.trim();

// Note: Replace exact tags.
code = code.replace(/<LeftToolbar \/>/g, propsString);
code = code.replace(/<LeftToolbar horizontal \/>/g, propsStringHorizontal);
code = code.replace(/<LeftToolbar horizontal=\{true\} \/>/g, propsStringHorizontal);

fs.writeFileSync(file, code);
console.log("LeftToolbar replaced successfully in App.tsx!");
