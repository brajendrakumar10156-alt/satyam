const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, 'src_demo', 'App.jsx');
let appCode = fs.readFileSync(appPath, 'utf8');

// 1. Add state to App.jsx
if (!appCode.includes('isHoveringDrawing')) {
  appCode = appCode.replace(
    "const [magnetMode, setMagnetMode] = useState('off');",
    "const [magnetMode, setMagnetMode] = useState('off');\n  const [isHoveringDrawing, setIsHoveringDrawing] = useState(false);"
  );

  // 2. Add to handlePointerMove
  const handlePointerMoveRegex = /if \(activeTool && \['dot', 'demonstration', 'magic'\]\.includes\(activeTool\)\) \{/;
  appCode = appCode.replace(
    handlePointerMoveRegex,
    `const hitId = findDrawingAtCoords(x, y);\n    setIsHoveringDrawing(!!hitId);\n\n    if (activeTool && ['dot', 'demonstration', 'magic'].includes(activeTool)) {`
  );

  // 3. Pass to WebGLChartEngine
  appCode = appCode.replace(
    /<WebGLChartEngine/g,
    "<WebGLChartEngine\n                            isHoveringDrawing={isHoveringDrawing}"
  );

  fs.writeFileSync(appPath, appCode, 'utf8');
  console.log("App.jsx patched safely.");
}

// Update WebGLChartEngine.jsx
const enginePath = path.join(__dirname, 'src_demo', 'components', 'WebGLChartEngine.jsx');
let engineCode = fs.readFileSync(enginePath, 'utf8');

if (!engineCode.includes('isHoveringDrawing')) {
  // Add to props
  engineCode = engineCode.replace(
    "initialVisibleRange, onVisibleRangeChange, onChartReady, activeTool,",
    "initialVisibleRange, onVisibleRangeChange, onChartReady, activeTool, isHoveringDrawing,"
  );

  // Add ref
  engineCode = engineCode.replace(
    "const activeToolRef  = useRef(activeTool);",
    "const activeToolRef  = useRef(activeTool);\n  const isHoveringDrawingRef = useRef(isHoveringDrawing);\n  useEffect(() => { isHoveringDrawingRef.current = isHoveringDrawing; }, [isHoveringDrawing]);"
  );

  // Add to pointerdown and wheel
  engineCode = engineCode.replace(
    /if \(activeToolRef\.current\) return;/g,
    "if (activeToolRef.current || isHoveringDrawingRef.current) return;"
  );

  fs.writeFileSync(enginePath, engineCode, 'utf8');
  console.log("WebGLChartEngine.jsx patched safely.");
}
