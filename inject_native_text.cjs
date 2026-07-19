const fs = require('fs');
let code = fs.readFileSync('src_demo/components/WebGPUChartEngine.jsx', 'utf8');

const regexInitWebGPU = /const shaderModule = device\.createShaderModule\(\{[\s\S]*?if \(onChartReady\)/m;

const replacementInit = `const shaderModule = device.createShaderModule({
          label: 'Chart Shaders',
          code: wgslShaders
        });

        // Pipeline Setup
        const pipeline = device.createRenderPipeline({
          layout: 'auto',
          vertex: {
            module: shaderModule,
            entryPoint: 'vs_main',
            buffers: [{
              arrayStride: 24, // 2 f32 (position) + 4 f32 (color)
              attributes: [
                { shaderLocation: 0, offset: 0, format: 'float32x2' },
                { shaderLocation: 1, offset: 8, format: 'float32x4' }
              ]
            }]
          },
          fragment: {
            module: shaderModule,
            entryPoint: 'fs_main',
            targets: [{ 
              format, 
              blend: {
                color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
                alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' }
              }
            }]
          },
          primitive: {
            topology: 'triangle-list'
          }
        });
        
        gpu.current.pipeline = pipeline;
        gpu.current.bindGroup = device.createBindGroup({
          layout: pipeline.getBindGroupLayout(0),
          entries: [{ binding: 0, resource: { buffer: uniformBuffer } }]
        });

        // ── TEXTURE ATLAS (NATIVE GPU TEXT RENDERING) ──
        // Generate a 512x512 font atlas containing numbers and basic chars
        const atlasSize = 512;
        const offCanvas = document.createElement('canvas');
        offCanvas.width = atlasSize;
        offCanvas.height = atlasSize;
        const oCtx = offCanvas.getContext('2d', { willReadFrequently: true });
        
        oCtx.fillStyle = '#000000'; // Background (alpha 0 via shader later or just transparent)
        oCtx.fillRect(0, 0, atlasSize, atlasSize);
        oCtx.fillStyle = '#ffffff';
        oCtx.font = '32px sans-serif';
        oCtx.textAlign = 'left';
        oCtx.textBaseline = 'top';
        
        const chars = "0123456789.:- ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
        const charMap = {};
        let cx = 0, cy = 0;
        const cell = 32;
        
        for (let i=0; i<chars.length; i++) {
           const char = chars[i];
           const m = oCtx.measureText(char);
           const w = Math.ceil(m.width);
           if (cx + cell > atlasSize) { cx = 0; cy += cell; }
           
           oCtx.fillText(char, cx, cy);
           charMap[char] = { x: cx, y: cy, w: (w===0 ? 10 : w), h: cell };
           cx += cell;
        }
        gpu.current.charMap = charMap;
        
        const imgData = oCtx.getImageData(0,0, atlasSize, atlasSize);
        
        const fontTexture = device.createTexture({
          size: [atlasSize, atlasSize, 1],
          format: 'rgba8unorm',
          usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
        });
        
        device.queue.writeTexture(
          { texture: fontTexture },
          imgData.data,
          { bytesPerRow: atlasSize * 4, rowsPerImage: atlasSize },
          [atlasSize, atlasSize, 1]
        );
        
        // Setup Text Shader and Pipeline
        const wgslText = \`
          struct Uniforms { transform: mat3x3<f32>, res: vec2<f32>, pad: vec2<f32> };
          @group(0) @binding(0) var<uniform> uniforms: Uniforms;
          @group(0) @binding(1) var mySampler: sampler;
          @group(0) @binding(2) var myTexture: texture_2d<f32>;

          struct VIn {
            @location(0) pos: vec2<f32>,
            @location(1) uv: vec2<f32>,
            @location(2) color: vec4<f32>,
          };
          struct VOut {
            @builtin(position) pos: vec4<f32>,
            @location(0) uv: vec2<f32>,
            @location(1) color: vec4<f32>,
          };

          @vertex fn vs(in: VIn) -> VOut {
             var out: VOut;
             let p = uniforms.transform * vec3<f32>(in.pos, 1.0);
             out.pos = vec4<f32>((p.x / uniforms.res.x) * 2.0 - 1.0, 1.0 - (p.y / uniforms.res.y) * 2.0, 0.0, 1.0);
             out.uv = in.uv;
             out.color = in.color;
             return out;
          }
          
          @fragment fn fs(in: VOut) -> @location(0) vec4<f32> {
             let texColor = textureSample(myTexture, mySampler, in.uv);
             // We draw white text on black bg in the atlas. The 'r' channel is the mask.
             return vec4<f32>(in.color.rgb, in.color.a * texColor.r);
          }
        \`;
        
        const textShader = device.createShaderModule({ label: 'Text', code: wgslText });
        
        const textPipeline = device.createRenderPipeline({
          layout: 'auto',
          vertex: {
            module: textShader,
            entryPoint: 'vs',
            buffers: [{
              arrayStride: 32, // 2 f32 (pos) + 2 f32 (uv) + 4 f32 (color)
              attributes: [
                { shaderLocation: 0, offset: 0, format: 'float32x2' },
                { shaderLocation: 1, offset: 8, format: 'float32x2' },
                { shaderLocation: 2, offset: 16, format: 'float32x4' }
              ]
            }]
          },
          fragment: {
            module: textShader,
            entryPoint: 'fs',
            targets: [{ 
              format, 
              blend: {
                color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
                alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' }
              }
            }]
          },
          primitive: { topology: 'triangle-list' }
        });
        
        const sampler = device.createSampler({
          magFilter: 'linear', minFilter: 'linear'
        });
        
        gpu.current.textPipeline = textPipeline;
        gpu.current.textBindGroup = device.createBindGroup({
          layout: textPipeline.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: { buffer: uniformBuffer } },
            { binding: 1, resource: sampler },
            { binding: 2, resource: fontTexture.createView() }
          ]
        });

        // ── TEXT BUFFER ──
        gpu.current.textBuffer = device.createBuffer({
          size: 10000 * 32, // up to 10000 chars * 6 verts * 32 bytes = 1.9MB
          usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
        });
        
        if (onChartReady)`;

if (regexInitWebGPU.test(code)) {
  code = code.replace(regexInitWebGPU, replacementInit);
}

const regexRenderOverlay = /const renderTextOverlay = \(\) => \{[\s\S]*?\/\/ ── RESIZE & EVENTS ────────────────────────────────────────────────────────/m;

const replacementOverlay = `const renderTextOverlay = (renderPass) => {
    // 100% NATIVE GPU TEXT RENDERING
    // Bypassing HTML canvas overlay completely
    if (!gpu.current.textPipeline || !gpu.current.charMap) return;
    
    const cw = vState.current.width * dpr;
    const ch = vState.current.height * dpr;
    
    // Axis test labels
    const testLabels = [
      { y: 100 * dpr, p: 45000, label: '45000.00' },
      { y: 105 * dpr, p: 44990, label: '44990.00' }, // Will collide and be removed
      { y: 200 * dpr, p: 44000, label: '44000.00' },
    ];
    
    const survivingPriceLabels = calculateVerticalPriceAxisLabels({
      priceLabels: testLabels,
      cH: ch,
    });
    
    let textFloatCount = 0;
    const maxChars = 10000;
    const textData = new Float32Array(maxChars * 48); // 6 verts * 8 floats per char
    
    const pushChar = (char, x, y, scale, color) => {
      const map = gpu.current.charMap[char];
      if (!map) return 0;
      
      const w = map.w * scale;
      const h = map.h * scale;
      
      const u0 = map.x / 512;
      const v0 = map.y / 512;
      const u1 = (map.x + map.w) / 512;
      const v1 = (map.y + map.h) / 512;
      
      let p = textFloatCount;
      const r = color[0], g = color[1], b = color[2], a = color[3];
      
      // Tri 1
      textData[p++]=x;   textData[p++]=y;   textData[p++]=u0; textData[p++]=v0; textData[p++]=r;textData[p++]=g;textData[p++]=b;textData[p++]=a;
      textData[p++]=x+w; textData[p++]=y;   textData[p++]=u1; textData[p++]=v0; textData[p++]=r;textData[p++]=g;textData[p++]=b;textData[p++]=a;
      textData[p++]=x;   textData[p++]=y+h; textData[p++]=u0; textData[p++]=v1; textData[p++]=r;textData[p++]=g;textData[p++]=b;textData[p++]=a;
      // Tri 2
      textData[p++]=x+w; textData[p++]=y;   textData[p++]=u1; textData[p++]=v0; textData[p++]=r;textData[p++]=g;textData[p++]=b;textData[p++]=a;
      textData[p++]=x+w; textData[p++]=y+h; textData[p++]=u1; textData[p++]=v1; textData[p++]=r;textData[p++]=g;textData[p++]=b;textData[p++]=a;
      textData[p++]=x;   textData[p++]=y+h; textData[p++]=u0; textData[p++]=v1; textData[p++]=r;textData[p++]=g;textData[p++]=b;textData[p++]=a;
      
      textFloatCount = p;
      return w;
    };
    
    const textColor = [0.6, 0.6, 0.6, 1.0];
    
    survivingPriceLabels.forEach(l => {
      let cx = cw - (60 * dpr);
      const cy = l.y;
      for (let i=0; i<l.label.length; i++) {
        cx += pushChar(l.label[i], cx, cy, 0.4, textColor);
      }
    });
    
    if (textFloatCount > 0) {
      gpu.current.device.queue.writeBuffer(gpu.current.textBuffer, 0, textData, 0, textFloatCount);
      
      renderPass.setPipeline(gpu.current.textPipeline);
      renderPass.setBindGroup(0, gpu.current.textBindGroup);
      renderPass.setVertexBuffer(0, gpu.current.textBuffer);
      renderPass.draw(textFloatCount / 8); // 8 floats per vertex
    }
  };

  // ── RESIZE & EVENTS ────────────────────────────────────────────────────────`;

if (regexRenderOverlay.test(code)) {
  code = code.replace(regexRenderOverlay, replacementOverlay);
}

// Ensure render loop calls renderTextOverlay correctly with renderPass before ending it
code = code.replace('renderPass.end();', `renderTextOverlay(renderPass);\n    renderPass.end();`);
code = code.replace('// Draw Text Overlay (Axis + Smart Collision)\n    renderTextOverlay();', '');
// Hide the textCanvasRef in return
code = code.replace('<canvas ref={textCanvasRef} className="absolute top-0 left-0 w-full h-full pointer-events-none" />', ' {/* Text canvas removed, 100% native GPU! */} ');

fs.writeFileSync('src_demo/components/WebGPUChartEngine.jsx', code, 'utf8');
console.log('Successfully injected native WebGPU text atlas renderer');
