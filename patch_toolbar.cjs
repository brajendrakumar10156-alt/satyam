const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src', 'App.jsx');
let code = fs.readFileSync(file, 'utf8');

// 1. Fix LeftToolbar button click logic
code = code.replace(
  /setActiveTool\(isCurrentCatActive \? null : activeSubToolId\);\s+setActiveFlyout\(null\);/g,
  `setActiveTool(isCurrentCatActive ? null : activeSubToolId);\n                  setActiveFlyout(isFlyoutOpen ? null : cat.id);`
);

// 2. Fix Floating Toolbar coordinate assignment
code = code.replace(
  /setFloatingToolbarCoords\(\{\s*x:\s*Math\.max\(16,\s*Math\.min\(window\.innerWidth\s*-\s*320,\s*e\.clientX\s*-\s*100\)\),\s*y:\s*Math\.max\(80,\s*rect\.top\s*\+\s*y\s*-\s*60\)\s*\}\);/g,
  `setFloatingToolbarCoords({
          time: drawings[hitIdx].start.time,
          price: drawings[hitIdx].start.price,
          offsetX: -100,
          offsetY: -60,
          x: Math.max(16, Math.min(window.innerWidth - 320, e.clientX - 100)),
          y: Math.max(80, rect.top + y - 60)
        });`
);

// 3. Fix Floating Toolbar rendering logic
code = code.replace(
  /\{selectedDrawingIndex !== null && floatingToolbarCoords && drawings\[selectedDrawingIndex\] && \(\s*<div\s+className="fixed z-50 flex items-center gap-2 bg-\[#1e222d\] border border-\[#2a2e39\] rounded-lg shadow-2xl p-1\.5 transition-all"\s+style=\{\{\s*left:\s*`\$\{floatingToolbarCoords\.x\}px`,\s*top:\s*`\$\{floatingToolbarCoords\.y\}px`,\s*\}\}\s*>/g,
  `{selectedDrawingIndex !== null && floatingToolbarCoords && drawings[selectedDrawingIndex] && (() => {
        let px = floatingToolbarCoords.x;
        let py = floatingToolbarCoords.y;
        if (floatingToolbarCoords.time && chartRef.current) {
          const pt = getPixel(floatingToolbarCoords.time, floatingToolbarCoords.price);
          const rect = chartRef.current.getBoundingClientRect();
          if (pt) {
            px = Math.max(16, Math.min(window.innerWidth - 320, rect.left + pt.x + floatingToolbarCoords.offsetX));
            py = Math.max(80, rect.top + pt.y + floatingToolbarCoords.offsetY);
          }
        }
        return (
        <div 
          className="fixed z-50 flex items-center gap-2 bg-[#1e222d] border border-[#2a2e39] rounded-lg shadow-2xl p-1.5 transition-all"
          style={{ 
            left: \`\${px}px\`, 
            top: \`\${py}px\`,
          }}
        >`
);

// We need to also close the self-invoking function if we opened one.
code = code.replace(
  /<\/div>\s*\)\}\s*\{selectedDrawingIndex !== null && floatingToolbarCoords && !drawings\[selectedDrawingIndex\]\.isLocked/g,
  `</div>\n        );\n      })()}\n\n      {selectedDrawingIndex !== null && floatingToolbarCoords && !drawings[selectedDrawingIndex].isLocked`
);

fs.writeFileSync(file, code);
console.log('App.jsx patched successfully');
