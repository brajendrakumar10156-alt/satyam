const fs = require('fs');

const webContainerPath = 'src/WebContainer.tsx';
let code = fs.readFileSync(webContainerPath, 'utf8');

// We want to extract components safely
function extractComponent(componentName, fileName) {
    const startStr = `function ${componentName}(`;
    let startIdx = code.indexOf(startStr);
    
    if (startIdx === -1) {
        console.log(`${componentName} not found in WebContainer.tsx`);
        return;
    }
    
    // Find the end of arguments
    let argsEnd = code.indexOf(')', startIdx);
    // Find the start of function body
    let bodyStart = code.indexOf('{', argsEnd);
    
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
    code = code.substring(0, startIdx) + `// ${componentName} extracted to ${fileName}` + code.substring(endIdx + 1);
    
    // Add import to the top of WebContainer.tsx
    const importStr = `import ${componentName} from './components/${fileName}';\n`;
    code = importStr + code;
    
    // Create the new component file
    let newFileContent = `import React, { useRef, useState, useEffect, useMemo } from 'react';\n`;
    newFileContent += `import { createChart } from 'lightweight-charts';\n`;
    newFileContent += `import { fetchExchangeCandles } from '../exchanges';\n\n`;
    newFileContent += `export default ${componentCode}\n`;
    
    fs.writeFileSync(`src/components/${fileName}.tsx`, newFileContent);
    console.log(`Successfully extracted ${componentName} to src/components/${fileName}.tsx`);
}

extractComponent('MiniChartWrapper', 'MiniChartWrapper');
extractComponent('OrderBookPanel', 'OrderBookPanel');

fs.writeFileSync(webContainerPath, code);
console.log('WebContainer.tsx updated.');
