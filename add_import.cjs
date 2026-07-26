const fs = require('fs');
let content = fs.readFileSync('src/WebContainer.tsx', 'utf8');
if (!content.includes('import NativeCanvasEngine')) {
    content = "import NativeCanvasEngine from './core_render_canvas2d/NativeCanvasEngine';\n" + content;
    fs.writeFileSync('src/WebContainer.tsx', content, 'utf8');
    console.log('Added missing import');
}
