const fs = require('fs');
let code = fs.readFileSync('src_demo/components/WebGPUChartEngine.jsx', 'utf8');

// 1. Add drawings prop to signature
code = code.replace(
  "preference = 'webgpu'\n}, ref) => {",
  "preference = 'webgpu',\n  drawings = []\n}, ref) => {"
);

// 2. Add line pipeline and buffers to initialization
const regexPipeline = /\/\/ ── TEXT BUFFER ──[\s\S]*?gpu\.current\.textBuffer = device\.createBuffer\(\{[\s\S]*?usage: GPUBufferUsage\.VERTEX \| GPUBufferUsage\.COPY_DST\n        \}\);/m;

const replacementPipeline = `// ── TEXT BUFFER ──
        gpu.current.textBuffer = device.createBuffer({
          size: 10000 * 32,
          usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
        });

        // ── DRAWING SHADERS (LINES) ──
        const wgslLine = \`
          struct Uniforms { transform: mat3x3<f32>, res: vec2<f32>, pad: vec2<f32> };
          @group(0) @binding(0) var<uniform> uniforms: Uniforms;
          struct VIn { @location(0) pos: vec2<f32>, @location(1) color: vec4<f32> };
          struct VOut { @builtin(position) pos: vec4<f32>, @location(0) color: vec4<f32> };
          
          @vertex fn vs(in: VIn) -> VOut {
             var out: VOut;
             let p = uniforms.transform * vec3<f32>(in.pos, 1.0);
             out.pos = vec4<f32>((p.x / uniforms.res.x) * 2.0 - 1.0, 1.0 - (p.y / uniforms.res.y) * 2.0, 0.0, 1.0);
             out.color = in.color;
             return out;
          }
          
          @fragment fn fs(in: VOut) -> @location(0) vec4<f32> {
             return in.color;
          }
        \`;
        const lineShader = device.createShaderModule({ label: 'Line', code: wgslLine });
        
        gpu.current.linePipeline = device.createRenderPipeline({
          layout: 'auto',
          vertex: {
            module: lineShader,
            entryPoint: 'vs',
            buffers: [{
              arrayStride: 24, // 2 f32 (pos) + 4 f32 (color)
              attributes: [
                { shaderLocation: 0, offset: 0, format: 'float32x2' },
                { shaderLocation: 1, offset: 8, format: 'float32x4' }
              ]
            }]
          },
          fragment: {
            module: lineShader,
            entryPoint: 'fs',
            targets: [{ 
              format, 
              blend: {
                color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
                alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' }
              }
            }]
          },
          primitive: { topology: 'line-list' }
        });
        
        gpu.current.lineBindGroup = device.createBindGroup({
          layout: gpu.current.linePipeline.getBindGroupLayout(0),
          entries: [{ binding: 0, resource: { buffer: uniformBuffer } }]
        });
        
        gpu.current.lineBuffer = device.createBuffer({
          size: 1000 * 48, // 1000 lines * 2 verts * 6 floats * 4 bytes
          usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
        });`;

code = code.replace(regexPipeline, replacementPipeline);

// 3. Add drawing loop to render function
const regexRenderPass = /if \(gpu\.current\.vertexBuffer && gpu\.current\.vertexCount > 0\) \{[\s\S]*?renderPass\.draw\(gpu\.current\.vertexCount\);\n    \}/m;

const replacementRenderPass = `if (gpu.current.vertexBuffer && gpu.current.vertexCount > 0) {
      renderPass.setVertexBuffer(0, gpu.current.vertexBuffer);
      renderPass.draw(gpu.current.vertexCount);
    }
    
    // NATIVE WEBGPU DRAWINGS RENDERER (Trendlines, etc)
    if (drawings && drawings.length > 0 && gpu.current.linePipeline) {
       const cw = vState.current.width * dpr;
       const ch = vState.current.height * dpr;
       const pAxisW = 64 * dpr;
       const timeAxisY = ch - (26 * dpr);
       
       const { min, max } = vState.current.priceRange;
       const priceRange = max - min;
       const priceScale = priceRange > 0 ? timeAxisY / priceRange : 1;
       
       const logicalRange = vState.current.logicalRange;
       const rangeLen = logicalRange.to - logicalRange.from;
       
       const px = (time) => {
         const idx = timeToIndex(time, data);
         return ((idx - logicalRange.from) / rangeLen) * (cw - pAxisW);
       };
       const py = (price) => timeAxisY - ((price - min) * priceScale);

       const lineData = new Float32Array(drawings.length * 12); // 2 verts * 6 floats
       let ptr = 0;
       
       for (let i=0; i<drawings.length; i++) {
          const d = drawings[i];
          if (d.tool === 'trendline' && d.points.length >= 2) {
             const p1 = d.points[0];
             const p2 = d.points[1];
             const color = [0.2, 0.6, 1.0, 1.0]; // Blue
             
             lineData[ptr++] = px(p1.time); lineData[ptr++] = py(p1.price); 
             lineData[ptr++] = color[0]; lineData[ptr++] = color[1]; lineData[ptr++] = color[2]; lineData[ptr++] = color[3];
             
             lineData[ptr++] = px(p2.time); lineData[ptr++] = py(p2.price); 
             lineData[ptr++] = color[0]; lineData[ptr++] = color[1]; lineData[ptr++] = color[2]; lineData[ptr++] = color[3];
          }
       }
       
       if (ptr > 0) {
          gpu.current.device.queue.writeBuffer(gpu.current.lineBuffer, 0, lineData, 0, ptr);
          renderPass.setPipeline(gpu.current.linePipeline);
          renderPass.setBindGroup(0, gpu.current.lineBindGroup);
          renderPass.setVertexBuffer(0, gpu.current.lineBuffer);
          renderPass.draw(ptr / 6); // 6 floats per vertex
       }
    }`;

code = code.replace(regexRenderPass, replacementRenderPass);

// 4. Expose getPixel universally
const regexHandle = /useImperativeHandle\(ref, \(\) => \(\{[\s\S]*?applyViewport: \(vp\) => \{ if \(vp && vp\.logicalRange\) vState\.current\.logicalRange = vp\.logicalRange; \}\n  \}\)\);/m;

const replacementHandle = `useImperativeHandle(ref, () => ({
    timeScale: () => ({
      getVisibleLogicalRange: () => vState.current.logicalRange,
      getVisibleRange: () => null,
      fitContent: () => {}
    }),
    priceScale: () => ({ applyOptions: () => {} }),
    captureViewport: () => ({ logicalRange: vState.current.logicalRange }),
    applyViewport: (vp) => { if (vp && vp.logicalRange) vState.current.logicalRange = vp.logicalRange; },
    getPixel: (time, price) => {
       const cw = vState.current.width * dpr;
       const ch = vState.current.height * dpr;
       const pAxisW = 64 * dpr;
       const timeAxisY = ch - (26 * dpr);
       
       const { min, max } = vState.current.priceRange;
       const priceRange = max - min;
       const priceScale = priceRange > 0 ? timeAxisY / priceRange : 1;
       
       const logicalRange = vState.current.logicalRange;
       const rangeLen = logicalRange.to - logicalRange.from;
       
       const idx = timeToIndex(time, data);
       const x = ((idx - logicalRange.from) / rangeLen) * (cw - pAxisW);
       const y = timeAxisY - ((price - min) * priceScale);
       return { x, y };
    }
  }));`;

code = code.replace(regexHandle, replacementHandle);

// Force re-render when drawings array changes
code = code.replace('useEffect(() => {\n    if (initialVisibleRange)', 'useEffect(() => {\n    requestAnimationFrame(render);\n  }, [drawings]);\n\n  useEffect(() => {\n    if (initialVisibleRange)');

fs.writeFileSync('src_demo/components/WebGPUChartEngine.jsx', code, 'utf8');
console.log('Successfully injected Native WebGPU Drawings Shader & getPixel logic');
