const fs = require('fs');

const webContainerPath = 'src/WebContainer.tsx';
let code = fs.readFileSync(webContainerPath, 'utf8');

const startStr = "  const LeftToolbar = ({ horizontal = false }) => {";
let startIdx = code.indexOf(startStr);

if (startIdx !== -1) {
    let braceCount = 0;
    let endIdx = -1;
    let bodyStart = code.indexOf('{', startIdx);
    
    for (let i = bodyStart; i < code.length; i++) {
        if (code[i] === '{') {
            braceCount++;
        } else if (code[i] === '}') {
            braceCount--;
        }
        
        if (braceCount === 0) {
            endIdx = i;
            break;
        }
    }
    
    if (endIdx !== -1) {
        // Remove the inline declaration
        const before = code.substring(0, startIdx);
        const after = code.substring(endIdx + 1);
        code = before + "\n  /* LeftToolbar extracted to LeftToolbar.tsx */\n" + after;
        
        console.log("Inline LeftToolbar removed.");
    } else {
        console.log("Could not find end of LeftToolbar.");
    }
} else {
    console.log("Inline LeftToolbar not found.");
}

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

const propsStringHorizontal = propsString.replace('horizontal={false}', 'horizontal={true}');

code = code.replace(/<LeftToolbar \/>/g, propsString);
code = code.replace(/<LeftToolbar horizontal \/>/g, propsStringHorizontal);
code = code.replace(/<LeftToolbar horizontal=\{true\} \/>/g, propsStringHorizontal);

fs.writeFileSync(webContainerPath, code);
console.log('WebContainer.tsx updated for LeftToolbar.');
