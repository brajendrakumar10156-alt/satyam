const fs = require('fs');
let code = fs.readFileSync('src/App.jsx', 'utf8');

const targetStr = `      Object.keys(subChartsMapRef.current).forEach(id => {
        try {
          const subChartObj = subChartsMapRef.current[id];
          if (subChartObj) {
      requestDraw();
    };
    resizeCanvas();`;

const replacementStr = `      Object.keys(subChartsMapRef.current).forEach(id => {
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
  }, []);

  useEffect(() => {
    const resizeCanvas = () => {
      if (!chartRef.current || !chartInstance.current) return;
      // Drawing Layer is responsive via CSS/ResizeObserver internally
      requestDraw();
    };
    resizeCanvas();`;

code = code.replace(targetStr, replacementStr);
fs.writeFileSync('src/App.jsx', code);
console.log('Fixed the corrupted cleanup block!');
