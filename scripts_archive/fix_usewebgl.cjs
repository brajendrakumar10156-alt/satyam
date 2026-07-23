const fs = require('fs');
let content = fs.readFileSync('src/App.jsx', 'utf8');

const cleanupEffect = `// Engine lifecycle: destroy old engine on toggle
  useEffect(() => {
    if (useWebGL) {
      if (chartInstance.current) {
        Object.keys(subChartsMapRef.current).forEach(id => {
          try {
            subChartsMapRef.current[id].unsubscribeSync?.();
            subChartsMapRef.current[id].chart.remove();
          } catch (e) {}
        });
        subChartsMapRef.current = {};
        chartInstance.current.remove();
        chartInstance.current = null;
        candleSeries.current = null;
        volumeSeries.current = null;
        indicatorSeriesRef.current = {};
        setChartCreated(false);
      }
    }
  }, [useWebGL]);\n\n`;

content = content.replace(cleanupEffect, '');

const handleToggleEnd = '  }, [useWebGL, isDrawing, priceScaleMode, autoScale]);';
content = content.replace(handleToggleEnd, handleToggleEnd + '\n\n  ' + cleanupEffect);

fs.writeFileSync('src/App.jsx', content);
console.log('Fixed useWebGL initialization error.');
