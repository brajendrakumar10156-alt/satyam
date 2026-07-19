const fs = require('fs');

let app = fs.readFileSync('src_demo/App.jsx', 'utf8');

// 1. Add import
if (!app.includes('import DrawingAxisLabels')) {
  app = app.replace(
    "import PixiDrawingLayer from './components/PixiDrawingLayer';",
    "import PixiDrawingLayer from './components/PixiDrawingLayer';\nimport DrawingAxisLabels from './components/DrawingAxisLabels';"
  );
}

// 2. Insert DrawingAxisLabels below PixiDrawingLayer
// We find all instances of </PixiDrawingLayer> or <PixiDrawingLayer ... />
// PixiDrawingLayer is used like:
/*
          <PixiDrawingLayer 
            ref={drawingLayerRef}
            drawings={drawings}
            ...
          />
*/
// Let's use regex to find the closing '/>' of PixiDrawingLayer and append DrawingAxisLabels.
app = app.replace(
  /<PixiDrawingLayer([\s\S]*?)\/>/g,
  '<PixiDrawingLayer$1/>\n          <DrawingAxisLabels drawings={drawings} getPixel={getPixel} />'
);

fs.writeFileSync('src_demo/App.jsx', app);
console.log('DrawingAxisLabels injected into src_demo/App.jsx');
