const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src_demo/components/WebGPUChartEngine.jsx');
let code = fs.readFileSync(filePath, 'utf8');

// 1. Replace wgslShaders with Native Storage Buffer version
const newWgslShaders = `
struct Uniforms {
  scale: vec2<f32>,
  offset: vec2<f32>,
  resolution: vec2<f32>,
  priceRange: vec2<f32>,
};
@group(0) @binding(0) var<uniform> u: Uniforms;

struct Candle {
  prices: vec4<f32>, // open, high, low, close
  meta: vec4<f32>,   // x = timeIndex
};
@group(0) @binding(1) var<storage, read> candles: array<Candle>;

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) color: vec4<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) vIdx: u32, @builtin(instance_index) iIdx: u32) -> VertexOutput {
  var out: VertexOutput;
  let c = candles[iIdx];
  let open = c.prices.x;
  let high = c.prices.y;
  let low = c.prices.z;
  let close = c.prices.w;
  let index = c.meta.x;

  let isUp = close >= open;
  let color = select(vec4<f32>(0.96, 0.24, 0.38, 1.0), vec4<f32>(0.08, 0.80, 0.55, 1.0), isUp);

  let isWick = vIdx > 5u;
  let localVIdx = vIdx % 6u;
  var quad = array<vec2<f32>, 6>(
    vec2<f32>(0.0, 0.0), vec2<f32>(1.0, 0.0), vec2<f32>(0.0, 1.0),
    vec2<f32>(0.0, 1.0), vec2<f32>(1.0, 0.0), vec2<f32>(1.0, 1.0)
  );
  let q = quad[localVIdx];

  let candleWidth = 6.0 * u.scale.x;
  let wickWidth = max(1.0, 1.0 * u.scale.x);
  let priceRange = u.priceRange.y - u.priceRange.x;
  let priceScale = select(u.resolution.y / priceRange, 0.0, priceRange == 0.0);

  var topP = max(open, close);
  var botP = min(open, close);
  if (topP == botP) { botP = botP - 0.1; }
  if (isWick) { topP = high; botP = low; }

  let pixelYTop = (u.priceRange.y - topP) * priceScale * u.scale.y;
  let pixelYBot = (u.priceRange.y - botP) * priceScale * u.scale.y;
  let heightPx = max(1.0, pixelYBot - pixelYTop);
  let widthPx = select(candleWidth, wickWidth, isWick);
  let xOffset = select(0.0, (candleWidth - wickWidth) * 0.5, isWick);

  let pixelX = (index * 10.0 * u.scale.x) + u.offset.x + xOffset;
  let pixelY = pixelYTop + u.offset.y;

  let px = pixelX + (q.x * widthPx);
  let py = pixelY + (q.y * heightPx);
  let clipX = (px / u.resolution.x) * 2.0 - 1.0;
  let clipY = 1.0 - (py / u.resolution.y) * 2.0;

  out.position = vec4<f32>(clipX, clipY, 0.0, 1.0);
  out.color = color;
  return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
  return in.color;
}
`;

// Replace old wgslShaders
code = code.replace(/const wgslShaders = `[\s\S]*?`;/, 'const wgslShaders = `' + newWgslShaders + '`;');

// 2. Add wgslTextShader
const textShader = `
const wgslTextShader = \`
struct TextUniforms {
  resolution: vec2<f32>,
};
@group(0) @binding(0) var<uniform> uniforms: TextUniforms;
@group(0) @binding(1) var fontSampler: sampler;
@group(0) @binding(2) var fontTexture: texture_2d<f32>;

struct Character {
  pos: vec2<f32>, // pixel X, Y
  uvInfo: vec4<f32>, // ux, uy, uw, uh (in atlas pixels)
};
@group(0) @binding(3) var<storage, read> chars: array<Character>;

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) vIdx: u32, @builtin(instance_index) iIdx: u32) -> VertexOutput {
  var out: VertexOutput;
  let charData = chars[iIdx];
  
  var quad = array<vec2<f32>, 6>(
    vec2<f32>(0.0, 0.0), vec2<f32>(1.0, 0.0), vec2<f32>(0.0, 1.0),
    vec2<f32>(0.0, 1.0), vec2<f32>(1.0, 0.0), vec2<f32>(1.0, 1.0)
  );
  let q = quad[vIdx % 6u];
  
  let w = charData.uvInfo.z;
  let h = charData.uvInfo.w;
  let px = charData.pos.x + (q.x * w);
  let py = charData.pos.y + (q.y * h);
  
  let clipX = (px / uniforms.resolution.x) * 2.0 - 1.0;
  let clipY = 1.0 - (py / uniforms.resolution.y) * 2.0;
  out.position = vec4<f32>(clipX, clipY, 0.0, 1.0);
  
  let atlasSize = 512.0;
  out.uv = vec2<f32>(
    (charData.uvInfo.x + q.x * w) / atlasSize,
    (charData.uvInfo.y + q.y * h) / atlasSize
  );
  return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
  let texColor = textureSample(fontTexture, fontSampler, in.uv);
  if (texColor.r < 0.5) { discard; }
  return vec4<f32>(0.8, 0.8, 0.85, 1.0); // White text
}
\`;
`;
code = code.replace(/const wgslGridShader = `/, textShader + '\nconst wgslGridShader = `');

// 3. Update initWebGPU to create Candle Storage Buffer, Text Pipeline, and Textures
const initInsertStr = `
        // ── 1. CANDLE PIPELINE (Native Data Packing) ──
        const uniformBuffer = device.createBuffer({
          size: 32, // scale, offset, res, priceRange
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        gpu.current.uniformBuffer = uniformBuffer;

        const maxCandles = 100000;
        const candleBuffer = device.createBuffer({
          size: maxCandles * 32,
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });
        gpu.current.candleBuffer = candleBuffer;
        gpu.current.maxCandles = maxCandles;

        const shaderModule = device.createShaderModule({ code: wgslShaders });
        const pipeline = device.createRenderPipeline({
          layout: 'auto',
          vertex: { module: shaderModule, entryPoint: 'vs_main' },
          fragment: { module: shaderModule, entryPoint: 'fs_main', targets: [{ format }] },
          primitive: { topology: 'triangle-list' }
        });
        gpu.current.pipeline = pipeline;
        gpu.current.bindGroup = device.createBindGroup({
          layout: pipeline.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: { buffer: uniformBuffer } },
            { binding: 1, resource: { buffer: candleBuffer } }
          ]
        });
`;
// Replace the old pipeline setup
code = code.replace(/\/\/\s*Compile Shader Module[\s\S]*?\/\/\s*── NATIVE SDF GRID PIPELINE ──/, initInsertStr + '\n        // ── NATIVE SDF GRID PIPELINE ──');

// 4. Update the Font Texture Upload
const fontUploadStr = `
        // Create WebGPU Texture from the Atlas
        const fontTexture = device.createTexture({
          size: [atlasSize, atlasSize, 1],
          format: 'rgba8unorm',
          usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
        });
        device.queue.copyExternalImageToTexture(
          { source: offCanvas },
          { texture: fontTexture },
          [atlasSize, atlasSize]
        );
        
        const fontSampler = device.createSampler({
          magFilter: 'linear', minFilter: 'linear', addressModeU: 'clamp-to-edge', addressModeV: 'clamp-to-edge'
        });

        const textUniformBuffer = device.createBuffer({
          size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });
        gpu.current.textUniformBuffer = textUniformBuffer;

        const maxChars = 2000;
        const textStorageBuffer = device.createBuffer({
          size: maxChars * 24, // 6 floats (px,py, ux,uy,uw,uh) per char
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        });
        gpu.current.textStorageBuffer = textStorageBuffer;
        gpu.current.maxChars = maxChars;

        const textShaderModule = device.createShaderModule({ code: wgslTextShader });
        const textPipeline = device.createRenderPipeline({
          layout: 'auto',
          vertex: { module: textShaderModule, entryPoint: 'vs_main' },
          fragment: {
            module: textShaderModule, entryPoint: 'fs_main',
            targets: [{ 
              format, blend: {
                color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
                alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' }
              }
            }]
          },
          primitive: { topology: 'triangle-list' }
        });
        gpu.current.textPipeline = textPipeline;
        gpu.current.textBindGroup = device.createBindGroup({
          layout: textPipeline.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: { buffer: textUniformBuffer } },
            { binding: 1, resource: fontSampler },
            { binding: 2, resource: fontTexture.createView() },
            { binding: 3, resource: { buffer: textStorageBuffer } }
          ]
        });
`;
code = code.replace(/const imgData = oCtx.getImageData\(0,0, atlasSize, atlasSize\);/, fontUploadStr);

// 5. Replace render logic to pass raw candles
const dataPackStr = `
      // Pack Data Natively (Phase 2)
      if (candles && candles.length > 0) {
        const count = Math.min(candles.length, gpu.current.maxCandles);
        const data = new Float32Array(count * 8);
        for (let i = 0; i < count; i++) {
          const c = candles[i];
          const offset = i * 8;
          data[offset] = c.open; data[offset+1] = c.high; data[offset+2] = c.low; data[offset+3] = c.close;
          data[offset+4] = i; 
        }
        gpu.current.device.queue.writeBuffer(gpu.current.candleBuffer, 0, data);
        gpu.current.candleCount = count;
      }
`;
code = code.replace(/\/\/ Generate Buffer Data for Candlesticks[\s\S]*?if \(candles && candles\.length > 0\) \{[\s\S]*?gpu\.current\.vertexCount = candlesToDraw \* 12;\s*\}\s*\}/, dataPackStr);

// 6. Fix Render Pass execution
const passExecStr = `
    const rangeLen = vState.current.logicalRange.to - vState.current.logicalRange.from;
    const { min, max } = vState.current.priceRange;
    const priceRange = max - min;
    const scaleX = (cw - pAxisW) / (rangeLen * 10);
    const scaleY = timeAxisY / priceRange;
    const offsetX = -(vState.current.logicalRange.from * 10 * scaleX);
    const offsetY = timeAxisY - (max * scaleY);

    const uniformsData = new Float32Array([
      scaleX, scaleY, offsetX, offsetY, cw, ch, min, max
    ]);
    gpu.current.device.queue.writeBuffer(gpu.current.uniformBuffer, 0, uniformsData);
    
    // Setup Text Data
    const textData = new Float32Array(gpu.current.maxChars * 6);
    let charCount = 0;
    const pushText = (str, x, y) => {
      for(let i=0; i<str.length; i++) {
        const c = str[i];
        const map = gpu.current.charMap[c];
        if(!map) continue;
        if(charCount >= gpu.current.maxChars) break;
        const off = charCount * 6;
        textData[off] = x; textData[off+1] = y;
        textData[off+2] = map.x; textData[off+3] = map.y; textData[off+4] = map.w; textData[off+5] = map.h;
        x += map.w;
        charCount++;
      }
    };
    
    // Draw Axis Labels (Phase 4)
    pushText(max.toFixed(2), cw - pAxisW + 10, 20);
    pushText(min.toFixed(2), cw - pAxisW + 10, timeAxisY - 20);
    pushText("12:00", cw / 2, timeAxisY + 10);
    
    if(charCount > 0) {
       gpu.current.device.queue.writeBuffer(gpu.current.textStorageBuffer, 0, textData);
       gpu.current.device.queue.writeBuffer(gpu.current.textUniformBuffer, 0, new Float32Array([cw, ch]));
    }
`;
code = code.replace(/\/\/ Update Uniforms[\s\S]*?gpu\.current\.device\.queue\.writeBuffer\(gpu\.current\.uniformBuffer, 0, uniformsData\);/, passExecStr);

const drawStr = `
    // ── 2. DRAW CANDLESTICKS (NATIVE) ──
    renderPass.setPipeline(gpu.current.pipeline);
    renderPass.setBindGroup(0, gpu.current.bindGroup);
    if (gpu.current.candleCount > 0) {
       renderPass.draw(12, gpu.current.candleCount, 0, 0);
    }
    
    // ── 3. DRAW TEXT (NATIVE) ──
    if (gpu.current.textPipeline && charCount > 0) {
       renderPass.setPipeline(gpu.current.textPipeline);
       renderPass.setBindGroup(0, gpu.current.textBindGroup);
       renderPass.draw(6, charCount, 0, 0);
    }
`;
code = code.replace(/\/\/ ── 2\. DRAW CANDLESTICKS ──[\s\S]*?renderPass\.setBindGroup\(0, gpu\.current\.bindGroup\);(\s*if \(gpu\.current\.vertexBuffer[\s\S]*?\})?/, drawStr);

fs.writeFileSync(filePath, code);
console.log('Successfully patched WebGPUChartEngine.jsx with Phase 2 (Data Packing) and Phase 4 (Text Rendering)');
