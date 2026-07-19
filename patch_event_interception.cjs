const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, 'src_demo', 'App.jsx');
let code = fs.readFileSync(appPath, 'utf8');

const interceptionCode = `
  // ─── WebGL Event Interception (Capture Phase) ───
  // Native events (WebGL Canvas) fire before React events.
  // We MUST stop propagation here if we are drawing or hit a drawing,
  // so WebGLChartEngine doesn't steal the pointer and start panning!
  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) return;

    const handlePointerDownCapture = (e) => {
      if (!useWebGL) return;
      
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // 1. If a drawing tool is active, stop WebGL from panning
      if (activeTool) {
        e.stopPropagation();
        return;
      }

      // 2. If clicking on an existing drawing to select it, stop WebGL from panning
      const hitId = findDrawingAtCoords(x, y);
      if (hitId) {
        e.stopPropagation();
      }
    };

    // Attach in capture phase!
    container.addEventListener('pointerdown', handlePointerDownCapture, { capture: true });
    
    return () => {
      container.removeEventListener('pointerdown', handlePointerDownCapture, { capture: true });
    };
  }, [useWebGL, activeTool, drawings, findDrawingAtCoords]);

`;

if (!code.includes('WebGL Event Interception')) {
  code = code.replace(
    "const handlePointerDown = (e) => {",
    interceptionCode + "const handlePointerDown = (e) => {"
  );
  fs.writeFileSync(appPath, code, 'utf8');
  console.log("App.jsx updated with Event Interception!");
} else {
  console.log("App.jsx already has Event Interception.");
}
