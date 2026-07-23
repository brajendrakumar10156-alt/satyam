const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, 'src_demo', 'App.jsx');
let code = fs.readFileSync(appPath, 'utf8');

// 1. Imports
if (!code.includes('generateDrawingId')) {
  code = code.replace(
    "import { captureViewportSnapshot } from './utils/drawingStore';",
    "import { captureViewportSnapshot, generateDrawingId } from './utils/drawingStore';\nimport { loadDrawingsFromDB, saveDrawingsToDB } from './utils/drawingPersistence';"
  );
}

// 2. State
code = code.replace(
  "const [selectedDrawingIndex, setSelectedDrawingIndex] = useState(null);",
  "const [selectedDrawingId, setSelectedDrawingId] = useState(null);"
);

// 3. findDrawingAtCoords logic
code = code.replace(
  "if (Math.abs(y - p1.y) < hitRadius) return i;",
  "if (Math.abs(y - p1.y) < hitRadius) return d.id;"
);
code = code.replace(
  "if (Math.abs(x - p1.x) < hitRadius) return i;",
  "if (Math.abs(x - p1.x) < hitRadius) return d.id;"
);
code = code.replace(
  "if (distanceToSegment(x, y, p1.x, p1.y, p2.x, p2.y) < hitRadius) return i;",
  "if (distanceToSegment(x, y, p1.x, p1.y, p2.x, p2.y) < hitRadius) return d.id;"
);
code = code.replace(
  "if (dist1 < hitRadius || dist2 < hitRadius) return i;",
  "if (dist1 < hitRadius || dist2 < hitRadius) return d.id;"
);
code = code.replace(
  "if (dist < hitRadius * 1.5) return i;",
  "if (dist < hitRadius * 1.5) return d.id;"
);
code = code.replace(
  "return -1;\n  };",
  "return null;\n  };"
);

// 4. Hit detection usage
code = code.replace(
  "const hitIdx = findDrawingAtCoords(x, y);\n      if (hitIdx >= 0) {\n        setSelectedDrawingIndex(hitIdx);\n        const rect = chartRef.current.getBoundingClientRect();\n        setFloatingToolbarCoords({\n          time: drawings[hitIdx].start.time,\n          price: drawings[hitIdx].start.price,",
  "const hitId = findDrawingAtCoords(x, y);\n      if (hitId) {\n        setSelectedDrawingId(hitId);\n        const hitDrawing = drawings.find(d => d.id === hitId);\n        const rect = chartRef.current.getBoundingClientRect();\n        setFloatingToolbarCoords({\n          time: hitDrawing.start.time,\n          price: hitDrawing.start.price,"
);
code = code.replace(
  "setSelectedDrawingIndex(null);",
  "setSelectedDrawingId(null);"
);
// Replace all other instances of setSelectedDrawingIndex
code = code.split('setSelectedDrawingIndex').join('setSelectedDrawingId');

// Replace all instances of selectedDrawingIndex with selectedDrawingId in the toolbar rendering logic
// and change array indexing `drawings[selectedDrawingIndex]` to `.find`
// We will do a generic replacement for the toolbar block
code = code.split('selectedDrawingIndex').join('selectedDrawingId');

// Now fix the `.map((d, idx) => idx === selectedDrawingId` -> `.map(d => d.id === selectedDrawingId`
code = code.replace(/\.map\(\(d, idx\) => idx === selectedDrawingId \? \{ \.\.\.d, color: c \} : d\)/g, ".map(d => d.id === selectedDrawingId ? { ...d, color: c } : d)");
code = code.replace(/\.map\(\(d, idx\) => idx === selectedDrawingId \? \{ \.\.\.d, lineWidth: val \} : d\)/g, ".map(d => d.id === selectedDrawingId ? { ...d, lineWidth: val } : d)");
code = code.replace(/\.map\(\(d, idx\) => idx === selectedDrawingId \? \{ \.\.\.d, lineStyle: val \} : d\)/g, ".map(d => d.id === selectedDrawingId ? { ...d, lineStyle: val } : d)");
code = code.replace(/\.map\(\(d, idx\) => idx === selectedDrawingId \? \{ \.\.\.d, locked: isLocked \} : d\)/g, ".map(d => d.id === selectedDrawingId ? { ...d, locked: isLocked } : d)");

// fix drawings[selectedDrawingId]
const fixSelectedDrawing = (str) => {
  return str.replace(/drawings\[selectedDrawingId\]/g, "(drawings.find(d => d.id === selectedDrawingId) || {})");
};
code = fixSelectedDrawing(code);

// fix deletion: setDrawings(prev => prev.filter((_, idx) => idx !== selectedDrawingId));
code = code.replace(/setDrawings\(prev => prev\.filter\(\(_, idx\) => idx !== selectedDrawingId\)\);/g, "setDrawings(prev => prev.filter(d => d.id !== selectedDrawingId));");


// 5. Tool Creation
code = code.replace(
  "setDrawings(prev => [...prev, { type: activeTool, start: { time, price }, end: { time, price }, text: textVal }]);",
  "setDrawings(prev => [...prev, { id: generateDrawingId(), type: activeTool, start: { time, price }, end: { time, price }, text: textVal }]);"
);
code = code.replace(
  "setDrawings(prev => [...prev, { type: activeTool, start: { time, price }, end: { time, price } }]);",
  "setDrawings(prev => [...prev, { id: generateDrawingId(), type: activeTool, start: { time, price }, end: { time, price } }]);"
);
code = code.replace(
  "setDrawings(prev => [...prev, { type: 'brush', points: brushPath }]);",
  "setDrawings(prev => [...prev, { id: generateDrawingId(), type: 'brush', points: brushPath }]);"
);
code = code.replace(
  "setDrawings(prev => [...prev, { type: activeTool, start: drawStart, end: tempShape }]);",
  "setDrawings(prev => [...prev, { id: generateDrawingId(), type: activeTool, start: drawStart, end: tempShape }]);"
);

// 6. Persistence Effects
const effectsCode = `
  // ─── Drawing Persistence Effects ───
  useEffect(() => {
    if (selectedCoin && chartInterval && selectedExchange) {
      loadDrawingsFromDB(selectedExchange, selectedCoin, chartInterval).then(loaded => {
        setDrawings(loaded || []);
      });
    }
  }, [selectedCoin, chartInterval, selectedExchange]);

  useEffect(() => {
    if (selectedCoin && chartInterval && selectedExchange) {
      const timeoutId = setTimeout(() => {
        saveDrawingsToDB(selectedExchange, selectedCoin, chartInterval, drawings);
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [drawings, selectedCoin, chartInterval, selectedExchange]);
`;

if (!code.includes('Drawing Persistence Effects')) {
  // Insert before return () => { if (unsub) unsub(); } in some useEffect or after const [drawings, setDrawings] = useState([]);
  code = code.replace("const [drawings, setDrawings] = useState([]);", "const [drawings, setDrawings] = useState([]);" + effectsCode);
}

// 7. Erase tool:
code = code.replace(
  "const foundIndex = drawings.findIndex(d => {",
  "const foundId = drawings.find(d => {"
);
code = code.replace(
  "if (foundIndex >= 0) setDrawings(prev => prev.filter((_, i) => i !== foundIndex));",
  "if (foundId) setDrawings(prev => prev.filter(d => d.id !== foundId.id));"
);

// 8. PixiDrawingLayer Prop rename
code = code.replace(/selectedDrawingIndex={selectedDrawingId}/g, "selectedDrawingId={selectedDrawingId}");

fs.writeFileSync(appPath, code, 'utf8');
console.log("App.jsx updated!");
