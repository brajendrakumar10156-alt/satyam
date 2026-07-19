const fs = require('fs');

let glCode = fs.readFileSync('src_demo/components/WebGLChartEngine.jsx', 'utf8');

const badLoop = /finalPriceLabels\.forEach\(\(\{ y, label \}\) => \{[\s\S]*?graphics\.stroke\(\{ width: 1, color: gridColor, alpha: 0\.3 \}\);[\s\S]*?\}\);/m;

const goodLoop = `finalPriceLabels.forEach(({ y, label }) => {
      // Build grid line path
      graphics.moveTo(0, y);
      graphics.lineTo(cW - pAxisW, y);
      
      // Draw text
      const pt = getPooledText(textIndex++, cachedStyles.current.priceAxis);
      pt.text = label;
      pt.x = cW - pAxisW + 4;
      pt.y = y - pt.height / 2;
    });
    // Batch stroke all price grid lines at once (PixiJS best practice)
    graphics.stroke({ width: 1, color: gridColor, alpha: 0.3 });`;

if (badLoop.test(glCode)) {
  glCode = glCode.replace(badLoop, goodLoop);
}

// Similarly, check the horizontal time axis loop to see if stroke is inside the loop.
const regexTimeLoop = /timeLabels\.forEach\(\(\{ x, label \}\) => \{[\s\S]*?graphics\.stroke\(\{ width: 1, color: gridColor, alpha: 0\.3 \}\);[\s\S]*?\}\);/m;

const goodTimeLoop = `timeLabels.forEach(({ x, label }) => {
      // Build grid line path
      graphics.moveTo(x, 0);
      graphics.lineTo(x, cH - 26);
      
      // Draw text
      const pt = getPooledText(textIndex++, cachedStyles.current.timeAxis);
      pt.text = label;
      pt.x = x - pt.width / 2;
      pt.y = cH - 20;
    });
    // Batch stroke all time grid lines at once
    graphics.stroke({ width: 1, color: gridColor, alpha: 0.3 });`;

if (regexTimeLoop.test(glCode)) {
  glCode = glCode.replace(regexTimeLoop, goodTimeLoop);
}

fs.writeFileSync('src_demo/components/WebGLChartEngine.jsx', glCode, 'utf8');
console.log('Successfully optimized WebGL PixiJS batching');
