const fs = require('fs');
let content = fs.readFileSync('src/WebContainer.tsx', 'utf8');

const editorStart = content.indexOf('const renderEditorPanel = (className = ');
if (editorStart !== -1) {
  let depth = 0;
  let editorEnd = -1;
  let inFunc = false;
  for (let i = editorStart; i < content.length; i++) {
    if (content[i] === '{') {
      depth++;
      inFunc = true;
    } else if (content[i] === '}') {
      depth--;
      if (inFunc && depth === 0) {
        editorEnd = i + 1;
        break;
      }
    }
  }
  
  if (editorEnd !== -1) {
    const editorStr = content.substring(editorStart, editorEnd);
    const lines = editorStr.split('\n');
    console.log(enderEditorPanel is  lines long.);
  }
}

const renderChartOverlaysStart = content.indexOf('const renderChartOverlays = () => {');
if (renderChartOverlaysStart !== -1) {
  let depth = 0;
  let overlaysEnd = -1;
  let inFunc = false;
  for (let i = renderChartOverlaysStart; i < content.length; i++) {
    if (content[i] === '{') {
      depth++;
      inFunc = true;
    } else if (content[i] === '}') {
      depth--;
      if (inFunc && depth === 0) {
        overlaysEnd = i + 1;
        break;
      }
    }
  }
  if (overlaysEnd !== -1) {
    const lines = content.substring(renderChartOverlaysStart, overlaysEnd).split('\n');
    console.log(enderChartOverlays is  lines long.);
  }
}
