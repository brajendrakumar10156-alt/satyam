const fs = require('fs');

const webContainerPath = 'src/WebContainer.tsx';
let code = fs.readFileSync(webContainerPath, 'utf8');

function extractAndRemove(type, componentName, startStr, isArrow = false) {
    let startIdx = code.indexOf(startStr);
    
    if (startIdx === -1) {
        console.log(`${componentName} not found in WebContainer.tsx`);
        return;
    }
    
    let bodyStart;
    if (isArrow) {
        bodyStart = code.indexOf('=> {', startIdx);
        if (bodyStart === -1) {
             console.log('Could not find => {'); return;
        }
        bodyStart += 3; // Index of '{'
    } else {
        let argsEnd = code.indexOf(')', startIdx);
        bodyStart = code.indexOf('{', argsEnd);
    }
    
    let braceCount = 0;
    let endIdx = -1;
    
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
    
    if (endIdx === -1) {
        console.log(`Could not find end of ${componentName}`);
        return;
    }
    
    const componentCode = code.substring(startIdx, endIdx + 1);
    
    // Remove it from WebContainer.tsx
    code = code.substring(0, startIdx) + `// ${componentName} extracted/removed\n` + code.substring(endIdx + 1);
    
    // Add import to the top of WebContainer.tsx if not already there
    let importFile = type === 'layout' ? `./components/layout/${componentName}` : `./components/${componentName}`;
    const importStr = `import ${isArrow ? '{ ' + componentName + ' }' : componentName} from '${importFile}';\n`;
    if (!code.includes(importStr)) {
        code = importStr + code;
    }
    
    // Create the new component file if it's not layout (layout components already exist)
    if (type !== 'layout') {
        let newFileContent = `import React, { useRef, useState, useEffect, useMemo } from 'react';\n`;
        newFileContent += `import { createChart } from 'lightweight-charts';\n`;
        newFileContent += `import { fetchExchangeCandles } from '../exchanges';\n\n`;
        newFileContent += `export default ${componentCode}\n`;
        
        fs.writeFileSync(`src/components/${componentName}.tsx`, newFileContent);
        console.log(`Successfully extracted ${componentName} to src/components/${componentName}.tsx`);
    } else {
        console.log(`Removed inline ${componentName}.`);
    }
}

// 1. MiniChartWrapper
extractAndRemove('component', 'MiniChartWrapper', 'function MiniChartWrapper({ coin: propCoin, interval, darkMode }) {');

// 2. OrderBookPanel
extractAndRemove('component', 'OrderBookPanel', 'function OrderBookPanel({ livePrice, selectedCoin, selectedExchange }) {');

// 3. LeftToolbar
extractAndRemove('layout', 'LeftToolbar', 'const LeftToolbar = ({ horizontal = false }) => {', true);

// Fix LeftToolbar usage inside WebContainer.tsx because it needs props
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
console.log('WebContainer.tsx updated successfully.');
