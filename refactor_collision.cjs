const fs = require('fs');

let file = fs.readFileSync('src_demo/components/WebGLChartEngine.jsx', 'utf8');

if (!file.includes('calculateTimeAxisLabels')) {
  file = file.replace(
    "import React, { useEffect, useRef, forwardRef } from 'react';",
    "import React, { useEffect, useRef, forwardRef } from 'react';\nimport { calculateTimeAxisLabels } from '../utils/webglTimeAxisCollision';"
  );
}

const startString = "// ADVANCED 3-PHASE TIME-AXIS COLLISION ENGINE (Index-Based)";
const endString = "// ── Phase 3: Draw in x-order";

const startIndex = file.indexOf(startString);
const endIndex = file.indexOf(endString);

if (startIndex !== -1 && endIndex !== -1) {
  const toReplace = file.substring(startIndex, endIndex);
  
  const newCode = `// ADVANCED 3-PHASE TIME-AXIS COLLISION ENGINE (Extracted to utility)
    const timeAxisWinners = calculateTimeAxisLabels({
      candles,
      timeRange: v.timeRange,
      cW,
      pAxisX,
      px,
      timezoneOffset
    });

    // ── Phase 3: Draw in x-order `;
    
  file = file.replace(toReplace, newCode);
  
  // Now replace the iterators in Phase 3
  file = file.replace(
    `    candidates
      .filter((_, ci) => winners.has(ci))
      .sort((a, b) => a.x - b.x)
      .forEach(({ x, label, priority, isMajor }) => {`,
    `    timeAxisWinners.forEach(({ x, label, priority, isMajor }) => {`
  );
  
  fs.writeFileSync('src_demo/components/WebGLChartEngine.jsx', file);
  console.log("Refactored WebGLChartEngine.jsx successfully.");
} else {
  console.log("Could not find the collision engine block to replace.");
}
