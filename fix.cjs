const fs = require('fs');
const file = 'src/App.jsx';
let lines = fs.readFileSync(file, 'utf8').split('\n');

let startIdx = -1;
let endIdx = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('const requestDraw = useCallback(() => {') && lines[i+1].includes('if (drawingLayerRef.current) drawingLayerRef.current.draw();') && lines[i+2].includes('if (saveRangeTimeoutRef.current) clearTimeout(saveRangeTimeoutRef.current);')) {
    startIdx = i;
  }
  if (startIdx !== -1 && lines[i].includes('return () => { ro.disconnect(); window.removeEventListener(')) {
    endIdx = i + 1;
    break;
  }
}

if (startIdx !== -1 && endIdx !== -1) {
  const replacement = `  const requestDraw = useCallback(() => {
    if (drawingLayerRef.current) drawingLayerRef.current.draw();
  }, []);

  useEffect(() => {
    return () => {
      if (saveRangeTimeoutRef.current) clearTimeout(saveRangeTimeoutRef.current);
      
      Object.keys(subChartsMapRef.current).forEach(id => {
        try {
          const subChartObj = subChartsMapRef.current[id];
          if (subChartObj) {
            if (typeof subChartObj.unsubscribeSync === 'function') {
              subChartObj.unsubscribeSync();
            }
            if (subChartObj.chart) {
              subChartObj.chart.remove();
            }
          }
        } catch (e) {
          console.error(\`Failed to cleanup subchart \${id} on unmount:\`, e);
        }
      });
      subChartsMapRef.current = {};
    };
  }, []);`;
  
  lines.splice(startIdx, endIdx - startIdx + 1, replacement);
  fs.writeFileSync(file, lines.join('\n'));
  console.log('Fixed syntax error successfully.');
} else {
  console.log('Could not find exact block to replace. startIdx=' + startIdx + ' endIdx=' + endIdx);
}
