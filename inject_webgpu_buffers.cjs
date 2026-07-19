const fs = require('fs');
let code = fs.readFileSync('src_demo/components/WebGPUChartEngine.jsx', 'utf8');

const regexRender = /const render = \(\) => \{[\s\S]*?\/\/ Update Uniforms/m;

const replacement = `const render = () => {
    if (!gpu.current.device || !gpu.current.pipeline) return;

    const cw = vState.current.width * dpr;
    const ch = vState.current.height * dpr;
    
    // Calculate layout metrics
    const pAxisW = 64 * dpr;
    const timeAxisY = ch - (26 * dpr);
    
    // Generate Buffer Data for Candlesticks
    if (data && data.length > 0) {
      const logicalRange = vState.current.logicalRange;
      const rangeLen = logicalRange.to - logicalRange.from;
      const candleW = Math.max(1, ((cw - pAxisW) / rangeLen) * 0.8);
      const halfW = candleW / 2;
      
      const { min, max } = vState.current.priceRange;
      const priceRange = max - min;
      const priceScale = priceRange > 0 ? timeAxisY / priceRange : 1;
      
      const py = (price) => timeAxisY - ((price - min) * priceScale);
      
      // Calculate visible slice
      const fromIdx = Math.max(0, Math.floor(logicalRange.from));
      const toIdx = Math.min(data.length - 1, Math.ceil(logicalRange.to));
      
      const candlesToDraw = toIdx - fromIdx + 1;
      if (candlesToDraw > 0) {
        // 12 vertices per candle * 6 floats per vertex (x,y,r,g,b,a) = 72 floats
        const floatCount = candlesToDraw * 72;
        
        // Only recreate buffer if size exceeded
        if (!gpu.current.vertexBuffer || gpu.current.vertexBufferSize < floatCount * 4) {
          if (gpu.current.vertexBuffer) gpu.current.vertexBuffer.destroy();
          gpu.current.vertexBufferSize = floatCount * 4 * 1.5; // Add 50% headroom
          gpu.current.vertexBuffer = gpu.current.device.createBuffer({
            size: gpu.current.vertexBufferSize,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
          });
        }
        
        const vData = new Float32Array(floatCount);
        let ptr = 0;
        
        const upColor = [0.1, 0.72, 0.5, 1.0]; // #10b981
        const downColor = [0.93, 0.26, 0.4, 1.0]; // #ef4444
        
        const pushRect = (x, y, w, h, c) => {
          // Triangle 1
          vData[ptr++] = x; vData[ptr++] = y; vData[ptr++] = c[0]; vData[ptr++] = c[1]; vData[ptr++] = c[2]; vData[ptr++] = c[3];
          vData[ptr++] = x+w; vData[ptr++] = y; vData[ptr++] = c[0]; vData[ptr++] = c[1]; vData[ptr++] = c[2]; vData[ptr++] = c[3];
          vData[ptr++] = x; vData[ptr++] = y+h; vData[ptr++] = c[0]; vData[ptr++] = c[1]; vData[ptr++] = c[2]; vData[ptr++] = c[3];
          // Triangle 2
          vData[ptr++] = x+w; vData[ptr++] = y; vData[ptr++] = c[0]; vData[ptr++] = c[1]; vData[ptr++] = c[2]; vData[ptr++] = c[3];
          vData[ptr++] = x+w; vData[ptr++] = y+h; vData[ptr++] = c[0]; vData[ptr++] = c[1]; vData[ptr++] = c[2]; vData[ptr++] = c[3];
          vData[ptr++] = x; vData[ptr++] = y+h; vData[ptr++] = c[0]; vData[ptr++] = c[1]; vData[ptr++] = c[2]; vData[ptr++] = c[3];
        };
        
        for (let i = fromIdx; i <= toIdx; i++) {
          const c = data[i];
          const px = ((i - logicalRange.from) / rangeLen) * (cw - pAxisW);
          const isUp = c.close >= c.open;
          const color = isUp ? upColor : downColor;
          
          const yHigh = py(c.high);
          const yLow = py(c.low);
          const yOpen = py(c.open);
          const yClose = py(c.close);
          
          const bodyTop = Math.min(yOpen, yClose);
          const bodyBottom = Math.max(yOpen, yClose);
          const bodyHeight = Math.max(1, bodyBottom - bodyTop);
          
          // Wick
          pushRect(px - 0.5, yHigh, 1, yLow - yHigh, color);
          
          // Body
          pushRect(px - halfW, bodyTop, candleW, bodyHeight, color);
        }
        
        gpu.current.device.queue.writeBuffer(gpu.current.vertexBuffer, 0, vData);
        gpu.current.vertexCount = candlesToDraw * 12;
      }
    }

    // Update Uniforms`;

if (regexRender.test(code)) {
  code = code.replace(regexRender, replacement);
  fs.writeFileSync('src_demo/components/WebGPUChartEngine.jsx', code, 'utf8');
  console.log('Successfully injected WebGPU vertex buffering logic');
} else {
  console.log('Failed to match render block');
}
