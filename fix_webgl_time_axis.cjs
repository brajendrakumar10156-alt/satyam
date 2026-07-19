const fs = require('fs');
let glCode = fs.readFileSync('src_demo/components/WebGLChartEngine.jsx', 'utf8');

const regexTimeAxis = /\/\/ ADVANCED 3-PHASE TIME-AXIS COLLISION ENGINE[\s\S]*?timeAxisWinners\.forEach\(\(\{ x, label, priority, isMajor \}\) => \{[\s\S]*?\}\);\n\s*\}\n/m;

const replacementTimeAxis = `// ── Advanced Spatial Collision (Time Axis) ──────────────────────────
    // Generate candidates
    const rawTimeLabels = [];
    const firstI = Math.max(0, Math.floor(v.timeRange.from));
    const lastI  = Math.min(candles.length - 1, Math.ceil(v.timeRange.to));
    for (let i = firstI; i <= lastI; i++) {
       const c = candles[i];
       if (!c) continue;
       const x = Math.round(px(i)) + 0.5;
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
       rawTimeLabels.push({ center: x, size: 40, text: label, isMajor, color: gridColor });
    }
    
    // NATIVE MATH: 1D Spatial Filter
    const timeAxisWinners = calculateHorizontalTimeAxisLabels({
      timeLabels: rawTimeLabels,
      cW,
      pAxisW: cW - pAxisX
    });
    
    // ── Draw survivors ───────────────────────────────
    timeAxisWinners.forEach(({ center, text, isMajor }) => {
        const x = center;
        const style = isMajor
          ? (darkMode ? cachedStyles.current.axisTextBoldDark : cachedStyles.current.axisTextBoldLight)
          : textStyle;

        // Draw grid tick
        gridLayerRef.current.moveTo(x, cH - 26);
        gridLayerRef.current.lineTo(x, cH - 23);
        
        // Faint vertical grid line (if you want)
        gridLayerRef.current.moveTo(x, 0);
        gridLayerRef.current.lineTo(x, cH - 26);
        
        const pt = getPooledText(textIndex++, style);
        pt.text = text;
        pt.x    = Math.floor(x - pt.width / 2);
        pt.y    = cH - 20;
    });
    // Batch stroke grid lines
    gridLayerRef.current.stroke({ width: 1, color: gridColor, alpha: gridAlpha * 0.4 });
  }
`;

if (regexTimeAxis.test(glCode)) {
  glCode = glCode.replace(regexTimeAxis, replacementTimeAxis);
  fs.writeFileSync('src_demo/components/WebGLChartEngine.jsx', glCode, 'utf8');
  console.log('Successfully fixed Time Axis logic in WebGLChartEngine');
} else {
  console.log('Could not find the target regex for Time Axis');
}
