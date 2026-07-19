const fs = require('fs');

let glCode = fs.readFileSync('src_demo/components/WebGLChartEngine.jsx', 'utf8');

// The garbage left over from the old regex replacement:
const garbage = `  }

        // Axis label — Pixi real measured width for pixel-perfect centering
        const txt = getPooledText(textIndex++, style);
        txt.text  = label;
        txt.x     = Math.floor(x - txt.width / 2);
        txt.y     = timeAxisY + 5;
        txt.alpha = 1.0;
      });`;

if (glCode.includes(garbage)) {
  glCode = glCode.replace(garbage, '');
  fs.writeFileSync('src_demo/components/WebGLChartEngine.jsx', glCode, 'utf8');
  console.log('Successfully removed leftover syntax garbage from WebGLChartEngine');
} else {
  console.log('Garbage not found exactly as specified. Attempting regex cleanup...');
  // More robust regex cleanup for lines 398-406
  const regexGarbage = /\s*\}\n\s*\/\/ Axis label — Pixi real measured width[\s\S]*?\}\);/m;
  if (regexGarbage.test(glCode)) {
    glCode = glCode.replace(regexGarbage, '');
    fs.writeFileSync('src_demo/components/WebGLChartEngine.jsx', glCode, 'utf8');
    console.log('Successfully removed leftover syntax garbage using Regex');
  } else {
     console.log('Still could not find garbage.');
  }
}
