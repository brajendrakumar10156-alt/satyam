const fs = require('fs');
const file = 'src/App.jsx';
let content = fs.readFileSync(file, 'utf8');

const targetStr = `    const requestDraw = useCallback(() => {
    if (drawingLayerRef.current) drawingLayerRef.current.draw();
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

const newStr = `  const requestDraw = useCallback(() => {
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

content = content.replace(targetStr, newStr);

// Also remove resizeCanvas block
const resizeRegex = /  useEffect\(\(\) => \{\n    const resizeCanvas = \(\) => \{[\s\S]*?\}, \[requestDraw\]\);/;
content = content.replace(resizeRegex, '');

fs.writeFileSync(file, content);
console.log('Fixed App.jsx via script');
