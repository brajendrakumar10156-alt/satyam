const fs = require('fs');

let gpuCode = fs.readFileSync('src_demo/components/WebGPUChartEngine.jsx', 'utf8');

// 1. Crosshair Snapping Math in WebGPU PointerMove
const regexPointerMove = /const time = data\[Math\.min\(data\.length - 1, Math\.max\(0, Math\.floor\(idx\)\)\)\]\?\.time \|\| 0;\n         gpu\.current\.activeTempShape = \{ time, price \};/m;

const replacementPointerMove = `const cIdx = Math.min(data.length - 1, Math.max(0, Math.floor(idx)));
         const c = data[cIdx];
         const time = c?.time || 0;
         
         // Crosshair Magnet Snapping
         let snapPrice = price;
         if (c) {
            // Snap to closest (High, Low, Open, Close)
            const distO = Math.abs(price - c.open);
            const distH = Math.abs(price - c.high);
            const distL = Math.abs(price - c.low);
            const distC = Math.abs(price - c.close);
            const minDist = Math.min(distO, distH, distL, distC);
            if (minDist === distO) snapPrice = c.open;
            else if (minDist === distH) snapPrice = c.high;
            else if (minDist === distL) snapPrice = c.low;
            else snapPrice = c.close;
         }
         
         gpu.current.activeTempShape = { time, price: snapPrice };`;

if (regexPointerMove.test(gpuCode)) {
  gpuCode = gpuCode.replace(regexPointerMove, replacementPointerMove);
}

// 2. Session Dividers
const regexDividers = /\/\/ NATIVE WEBGPU VOLUME PROFILE/m;
const replacementDividers = `// NATIVE WEBGPU SESSION DIVIDERS
       const firstI = Math.max(0, Math.floor(vState.current.logicalRange.from));
       const lastI = Math.min(data.length - 1, Math.ceil(vState.current.logicalRange.to));
       const divColor = [1.0, 1.0, 1.0, 0.1]; // Faint white line
       
       for (let i = firstI; i <= lastI; i++) {
          const c = data[i];
          if (!c) continue;
          
          const d = new Date(c.time * 1000);
          if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0) {
             const xPos = px(c.time);
             
             // Draw vertical line from top to bottom
             const v1 = { x: xPos - 0.5, y: 0 };
             const v2 = { x: xPos + 0.5, y: ch - 26 };
             
             lineData[ptr++] = v1.x; lineData[ptr++] = v1.y;
             lineData[ptr++] = divColor[0]; lineData[ptr++] = divColor[1]; lineData[ptr++] = divColor[2]; lineData[ptr++] = divColor[3];
             
             lineData[ptr++] = v2.x; lineData[ptr++] = v1.y;
             lineData[ptr++] = divColor[0]; lineData[ptr++] = divColor[1]; lineData[ptr++] = divColor[2]; lineData[ptr++] = divColor[3];
             
             lineData[ptr++] = v2.x; lineData[ptr++] = v2.y;
             lineData[ptr++] = divColor[0]; lineData[ptr++] = divColor[1]; lineData[ptr++] = divColor[2]; lineData[ptr++] = divColor[3];
             
             lineData[ptr++] = v2.x; lineData[ptr++] = v2.y;
             lineData[ptr++] = divColor[0]; lineData[ptr++] = divColor[1]; lineData[ptr++] = divColor[2]; lineData[ptr++] = divColor[3];
             
             lineData[ptr++] = v1.x; lineData[ptr++] = v2.y;
             lineData[ptr++] = divColor[0]; lineData[ptr++] = divColor[1]; lineData[ptr++] = divColor[2]; lineData[ptr++] = divColor[3];
             
             lineData[ptr++] = v1.x; lineData[ptr++] = v1.y;
             lineData[ptr++] = divColor[0]; lineData[ptr++] = divColor[1]; lineData[ptr++] = divColor[2]; lineData[ptr++] = divColor[3];
          }
       }
       
       // NATIVE WEBGPU VOLUME PROFILE`;

if (regexDividers.test(gpuCode)) {
  gpuCode = gpuCode.replace(regexDividers, replacementDividers);
}


// Pass visualIndicators to WebGPU in App.jsx
let appCode = fs.readFileSync('src_demo/App.jsx', 'utf8');
const regexWebGPUProp = /<WebGPUChartEngine[\s\S]*?onChartReady=/m;
const matchProp = appCode.match(regexWebGPUProp);
if (matchProp && !matchProp[0].includes('visualIndicators={')) {
  appCode = appCode.replace(
    /onChartReady=/,
    `visualIndicators={visualIndicators}\n                            indicatorDataMap={indicatorDataMapRef.current}\n                            onChartReady=`
  );
}
fs.writeFileSync('src_demo/App.jsx', appCode, 'utf8');

fs.writeFileSync('src_demo/components/WebGPUChartEngine.jsx', gpuCode, 'utf8');
console.log('Successfully injected Session Dividers and Crosshair Hover Math');
