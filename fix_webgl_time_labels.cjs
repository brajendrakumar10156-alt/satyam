const fs = require('fs');
let code = fs.readFileSync('src_demo/components/WebGLChartEngine.jsx', 'utf8');

// Replace { center: x, size: 40, text: label, isMajor, color: gridColor }
// with { x, size: 40, label, isMajor, color: gridColor }
if (code.includes('rawTimeLabels.push({ center: x, size: 40, text: label, isMajor, color: gridColor });')) {
  code = code.replace(
    'rawTimeLabels.push({ center: x, size: 40, text: label, isMajor, color: gridColor });',
    'rawTimeLabels.push({ x, size: 40, label, isMajor, color: gridColor });'
  );
  console.log('Fixed rawTimeLabels.push');
}

// And then in the loop `timeAxisWinners.forEach(({ center, text, isMajor }) => {`
// replace with `timeAxisWinners.forEach(({ x, label, isMajor }) => {`
if (code.includes('timeAxisWinners.forEach(({ center, text, isMajor }) => {')) {
  code = code.replace(
    /timeAxisWinners\.forEach\(\(\{ center, text, isMajor \}\) => \{/g,
    'timeAxisWinners.forEach(({ x, label, isMajor }) => {'
  );
  
  // also replace `const x = center;` which is no longer needed but we can just replace `pt.text = text;` with `pt.text = label;`
  code = code.replace(
    /const x = center;/g,
    '// x is already extracted'
  );
  
  code = code.replace(
    /pt\.text = text;/g,
    'pt.text = label;'
  );
  console.log('Fixed timeAxisWinners loop');
}

fs.writeFileSync('src_demo/components/WebGLChartEngine.jsx', code, 'utf8');
