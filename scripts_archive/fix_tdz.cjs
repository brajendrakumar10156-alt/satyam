const fs = require('fs');
let content = fs.readFileSync('src/App.jsx', 'utf8');

const handleToggleCode = `  const handleEngineToggle = useCallback(() => {
    if (isDrawing) {
      setToastMsg('⚠️ Pehle drawing complete karo, phir toggle karo');
      setTimeout(() => setToastMsg(''), 3000);
      return;
    }
    if (chartInstance.current) {
      viewportSnapshotRef.current = captureViewportSnapshot(
        chartInstance.current, priceScaleMode, autoScale
      );
    }
    setSelectedDrawingIndex(null);
    setFloatingToolbarCoords(null);
    setHoverCoords(null);
    setActiveFlyout(null);
    const nextMode = !useWebGL;
    setUseWebGL(nextMode);
    localStorage.setItem('renderEngine', nextMode ? 'webgl' : '2d');
    setToastMsg(nextMode ? '⚡ WebGL Engine — GPU Accelerated' : '🎨 Canvas 2D Engine');
    setTimeout(() => setToastMsg(''), 3000);
  }, [useWebGL, isDrawing, priceScaleMode, autoScale]);`;

content = content.replace(handleToggleCode, '');
content = content.replace('  // ─── Collapsible Right Sidebar ───', handleToggleCode + '\n\n  // ─── Collapsible Right Sidebar ───');

fs.writeFileSync('src/App.jsx', content);
console.log('Fixed TDZ for priceScaleMode');
