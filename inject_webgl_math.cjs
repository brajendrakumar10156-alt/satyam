const fs = require('fs');

// 1. Update WebGPUChartEngine.jsx
let gpuCode = fs.readFileSync('src_demo/components/WebGPUChartEngine.jsx', 'utf8');
gpuCode = gpuCode.replace(/webgpuAxisCollisionEngine/g, 'axisCollisionEngine');
fs.writeFileSync('src_demo/components/WebGPUChartEngine.jsx', gpuCode, 'utf8');

// 2. Update WebGLChartEngine.jsx
let glCode = fs.readFileSync('src_demo/components/WebGLChartEngine.jsx', 'utf8');

// Replace old import with new universal engine import
glCode = glCode.replace(
  "import { calculateTimeAxisLabels } from '../utils/webglTimeAxisCollision';",
  "import { calculateHorizontalTimeAxisLabels, calculateVerticalPriceAxisLabels } from '../utils/axisCollisionEngine';"
);

// We need to implement the Price Axis Math (calculateVerticalPriceAxisLabels) in WebGL
// Let's locate the price axis render block
const regexPriceAxis = /\/\/ ── Dynamic price axis width[\s\S]*?graphics\.stroke\(\{ width: 1, color: gridColor, alpha: 0\.3 \}\);\n\s*\}/m;

if (regexPriceAxis.test(glCode)) {
  const newPriceAxis = `// ── Advanced Spatial Collision (Price Axis) ──────────────────────────
    const priceLabels = [];
    const minP = Math.floor(v.priceRange.min);
    const maxP = Math.ceil(v.priceRange.max);
    
    // Generate candidates (lots of them, so the math engine can filter)
    const pStepApprox = (maxP - minP) / 20; 
    let pStep = 1;
    if (pStepApprox > 100) pStep = 50;
    else if (pStepApprox > 50) pStep = 25;
    else if (pStepApprox > 10) pStep = 5;
    else if (pStepApprox < 0.5) pStep = 0.1;
    else if (pStepApprox < 0.1) pStep = 0.01;
    
    for (let p = Math.floor(minP / pStep) * pStep; p <= maxP; p += pStep) {
      if (p < v.priceRange.min || p > v.priceRange.max) continue;
      const y = Math.floor(py(p));
      if (y < 20 || y > cH - 40) continue;
      priceLabels.push({ y, p, label: p.toFixed(2) });
    }
    
    // NATIVE MATH: 1D Spatial Filter
    const finalPriceLabels = calculateVerticalPriceAxisLabels({
      priceLabels,
      cH,
      timeAxisH: 26,
      labelHeight: 14
    });
    
    finalPriceLabels.forEach(({ y, label }) => {
      // Draw grid line
      graphics.moveTo(0, y);
      graphics.lineTo(cW - pAxisW, y);
      graphics.stroke({ width: 1, color: gridColor, alpha: 0.3 });
      
      // Draw text
      const pt = getPooledText(textIndex++, cachedStyles.current.priceAxis);
      pt.text = label;
      pt.x = cW - pAxisW + 4;
      pt.y = y - pt.height / 2;
    });`;
    
  glCode = glCode.replace(regexPriceAxis, newPriceAxis);
}

// Update the Time Axis Math
const regexTimeAxis = /const timeLabels = calculateTimeAxisLabels\(\{[\s\S]*?\}\);/m;
const newTimeAxis = `// Generate candidates
    const rawTimeLabels = [];
    const firstI = Math.max(0, Math.floor(v.logicalRange.from));
    const lastI  = Math.min(candles.length - 1, Math.ceil(v.logicalRange.to));
    for (let i = firstI; i <= lastI; i++) {
       const c = candles[i];
       if (!c) continue;
       const x = Math.round(getX(i, cW, v)) + 0.5;
       if (x < -20 || x > cW + 20) continue;
       
       const d = new Date((c.time + timezoneOffset) * 1000);
       const H = d.getUTCHours(), M = d.getUTCMinutes();
       const isNewDay = H === 0 && M === 0;
       const isNewMonth = isNewDay && d.getUTCDate() === 1;
       const isNewYear = isNewMonth && d.getUTCMonth() === 0;
       
       let isMajor = false;
       let label = '';
       if (isNewYear) { label = d.getUTCFullYear().toString(); isMajor = true; }
       else if (isNewMonth) { label = d.toLocaleString('default', { month: 'short', timeZone: 'UTC' }); isMajor = true; }
       else if (isNewDay) { label = \`\${d.getUTCDate()} \${d.toLocaleString('default', { month: 'short', timeZone: 'UTC' })}\`; isMajor = true; }
       else {
          if ((H * 60 + M) % 15 !== 0) continue;
          label = \`\${H.toString().padStart(2, '0')}:\${M.toString().padStart(2, '0')}\`;
       }
       rawTimeLabels.push({ x, time: c.time, label, isMajor });
    }
    
    // NATIVE MATH: 1D Spatial Filter
    const timeLabels = calculateHorizontalTimeAxisLabels({
      timeLabels: rawTimeLabels,
      cW,
      pAxisW
    });`;

if (regexTimeAxis.test(glCode)) {
  glCode = glCode.replace(regexTimeAxis, newTimeAxis);
}

fs.writeFileSync('src_demo/components/WebGLChartEngine.jsx', glCode, 'utf8');
console.log('Successfully applied universal math to WebGLChartEngine');
