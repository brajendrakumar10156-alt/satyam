const fs = require('fs');

let gpuCode = fs.readFileSync('src_demo/components/WebGPUChartEngine.jsx', 'utf8');

const regexVolumeProfile = /\/\/ Draw Technical Indicators \(NATIVE WGSL PIPELINE\)/m;

const replacementVolumeProfile = `// NATIVE WEBGPU VOLUME PROFILE
       const hasVolumeProfile = visualIndicators.some(ind => ind.type === 'VolumeProfile');
       if (hasVolumeProfile) {
          const firstI = Math.max(0, Math.floor(vState.current.logicalRange.from));
          const lastI = Math.min(data.length - 1, Math.ceil(vState.current.logicalRange.to));
          
          let minVolPrice = Infinity;
          let maxVolPrice = -Infinity;
          
          for (let i = firstI; i <= lastI; i++) {
             const c = data[i];
             if (!c) continue;
             if (c.low < minVolPrice) minVolPrice = c.low;
             if (c.high > maxVolPrice) maxVolPrice = c.high;
          }
          
          if (minVolPrice !== Infinity) {
             const BINS = 50;
             const binSize = (maxVolPrice - minVolPrice) / BINS;
             const bins = new Float32Array(BINS);
             let maxVol = 0;
             let pocIndex = 0;
             
             // Bin the volume
             for (let i = firstI; i <= lastI; i++) {
                const c = data[i];
                if (!c || !c.volume) continue;
                const typicalPrice = (c.high + c.low + c.close) / 3;
                let binIdx = Math.floor((typicalPrice - minVolPrice) / binSize);
                if (binIdx >= BINS) binIdx = BINS - 1;
                if (binIdx < 0) binIdx = 0;
                
                bins[binIdx] += c.volume;
                if (bins[binIdx] > maxVol) {
                   maxVol = bins[binIdx];
                   pocIndex = binIdx;
                }
             }
             
             const maxBarWidth = (cw - 64) * 0.3; // 30% of screen width
             const color = [0.2, 0.4, 0.8, 0.3]; // Semi-transparent blue
             const pocColor = [0.8, 0.2, 0.2, 0.6]; // Red for Point of Control
             
             // Draw Volume Profile Bins natively as Rectangles
             for (let b = 0; b < BINS; b++) {
                if (bins[b] === 0) continue;
                
                const price = minVolPrice + (b * binSize);
                const yBottom = py(price);
                const yTop = py(price + binSize);
                const width = (bins[b] / maxVol) * maxBarWidth;
                
                // Native Quad Vertices
                const xRight = cw - 64; // align right
                const xLeft = xRight - width;
                
                const cArr = b === pocIndex ? pocColor : color;
                
                // Triangle 1
                lineData[ptr++] = xLeft; lineData[ptr++] = yBottom;
                lineData[ptr++] = cArr[0]; lineData[ptr++] = cArr[1]; lineData[ptr++] = cArr[2]; lineData[ptr++] = cArr[3];
                
                lineData[ptr++] = xRight; lineData[ptr++] = yBottom;
                lineData[ptr++] = cArr[0]; lineData[ptr++] = cArr[1]; lineData[ptr++] = cArr[2]; lineData[ptr++] = cArr[3];
                
                lineData[ptr++] = xRight; lineData[ptr++] = yTop;
                lineData[ptr++] = cArr[0]; lineData[ptr++] = cArr[1]; lineData[ptr++] = cArr[2]; lineData[ptr++] = cArr[3];
                
                // Triangle 2
                lineData[ptr++] = xRight; lineData[ptr++] = yTop;
                lineData[ptr++] = cArr[0]; lineData[ptr++] = cArr[1]; lineData[ptr++] = cArr[2]; lineData[ptr++] = cArr[3];
                
                lineData[ptr++] = xLeft; lineData[ptr++] = yTop;
                lineData[ptr++] = cArr[0]; lineData[ptr++] = cArr[1]; lineData[ptr++] = cArr[2]; lineData[ptr++] = cArr[3];
                
                lineData[ptr++] = xLeft; lineData[ptr++] = yBottom;
                lineData[ptr++] = cArr[0]; lineData[ptr++] = cArr[1]; lineData[ptr++] = cArr[2]; lineData[ptr++] = cArr[3];
             }
          }
       }
       
       // Draw Technical Indicators (NATIVE WGSL PIPELINE)`;

if (regexVolumeProfile.test(gpuCode)) {
  gpuCode = gpuCode.replace(regexVolumeProfile, replacementVolumeProfile);
}

fs.writeFileSync('src_demo/components/WebGPUChartEngine.jsx', gpuCode, 'utf8');
console.log('Successfully injected Native Volume Profile for WebGPU');
