import React, { useEffect, useRef, useState, useImperativeHandle } from 'react';
import { lineToQuad, raycastDrawings } from '../utils/webgpuMath';
import { calculateHorizontalTimeAxisLabels, calculateVerticalPriceAxisLabels } from '../utils/axisCollisionEngine';
import { INDICATOR_REGISTRY } from '../indicatorsRegistry';

// Basic utility to map time to index
function timeToIndex(time, candles) {
  if (!candles || candles.length === 0) return 0;
  if (time <= candles[0].time) return 0;
  if (time >= candles[candles.length - 1].time) return candles.length - 1;
  let l = 0, r = candles.length - 1;
  while (l <= r) {
    const m = Math.floor((l + r) / 2);
    if (candles[m].time === time) return m;
    if (candles[m].time < time) l = m + 1;
    else r = m - 1;
  }
  return l;
}

const wgslComputeSMA = `
struct Candle {
  prices: vec4<f32>, // open, high, low, close
  meta: vec4<f32>,   // x = timeIndex
};

struct Uniforms {
  period: f32,
  candleCount: f32,
};

@group(0) @binding(0) var<storage, read> candles: array<Candle>;
@group(0) @binding(1) var<storage, read_write> outBuffer: array<f32>;
@group(0) @binding(2) var<uniform> u: Uniforms;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let i = global_id.x;
    let totalCandles = u32(u.candleCount);
    let period = u32(u.period);
    
    if (i >= totalCandles) { return; }
    
    if (i < period - 1u) {
        outBuffer[i] = -1.0; // Not enough data
        return;
    }
    
    var sum = 0.0;
    for (var j = 0u; j < period; j++) {
        sum += candles[i - j].prices.w; // sum of closes
    }
    outBuffer[i] = sum / f32(period);
}
`;

const wgslLineShader = `
struct Uniforms {
  scale: vec2<f32>,
  offset: vec2<f32>,
  resolution: vec2<f32>,
  priceRange: vec2<f32>,
};
@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var<storage, read> indicatorData: array<f32>;

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) color: vec4<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) vIdx: u32, @builtin(instance_index) iIdx: u32) -> VertexOutput {
  var out: VertexOutput;
  let val1 = indicatorData[iIdx];
  let val2 = indicatorData[iIdx + 1u];
  
  if (val1 < 0.0 || val2 < 0.0) {
     out.position = vec4<f32>(0.0, 0.0, 0.0, 0.0); // Hidden
     return out;
  }
  
  // A simple thick line using 6 vertices for a quad connecting P1 and P2
  let p1x = (f32(iIdx) * 10.0 * u.scale.x) + u.offset.x;
  let p2x = (f32(iIdx + 1u) * 10.0 * u.scale.x) + u.offset.x;
  
  let priceRange = u.priceRange.y - u.priceRange.x;
  let priceScale = select(u.resolution.y / priceRange, 0.0, priceRange == 0.0);
  
  let p1y = (u.priceRange.y - val1) * priceScale * u.scale.y + u.offset.y;
  let p2y = (u.priceRange.y - val2) * priceScale * u.scale.y + u.offset.y;
  
  // Calculate perpendicular vector for line thickness
  let dir = normalize(vec2<f32>(p2x - p1x, p2y - p1y));
  let normal = vec2<f32>(-dir.y, dir.x);
  let thickness = 2.0;
  
  var pos = vec2<f32>(0.0, 0.0);
  let localIdx = vIdx % 6u;
  if (localIdx == 0u) { pos = vec2<f32>(p1x, p1y) + normal * thickness; }
  if (localIdx == 1u) { pos = vec2<f32>(p2x, p2y) + normal * thickness; }
  if (localIdx == 2u) { pos = vec2<f32>(p1x, p1y) - normal * thickness; }
  if (localIdx == 3u) { pos = vec2<f32>(p1x, p1y) - normal * thickness; }
  if (localIdx == 4u) { pos = vec2<f32>(p2x, p2y) + normal * thickness; }
  if (localIdx == 5u) { pos = vec2<f32>(p2x, p2y) - normal * thickness; }
  
  let clipX = (pos.x / u.resolution.x) * 2.0 - 1.0;
  let clipY = 1.0 - (pos.y / u.resolution.y) * 2.0;
  
  out.position = vec4<f32>(clipX, clipY, 0.0, 1.0);
  out.color = vec4<f32>(0.16, 0.50, 0.96, 1.0); // Blue SMA line
  return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
  return in.color;
}
`;

const wgslShaders = `
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

const wgslTextShader = `
struct TextUniforms {
  resolution: vec2<f32>,
};
@group(0) @binding(0) var<uniform> uniforms: TextUniforms;
@group(0) @binding(1) var fontSampler: sampler;
@group(0) @binding(2) var fontTexture: texture_2d<f32>;

struct Character {
  posInfo: vec4<f32>, // x, y, pad, pad
  uvInfo: vec4<f32>,  // ux, uy, uw, uh (in atlas pixels)
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
  let px = charData.posInfo.x + (q.x * w);
  let py = charData.posInfo.y + (q.y * h);
  
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
`;

const wgslGridShader = `
struct GridUniforms {
  resolution: vec2<f32>,
  hoverPixel: vec2<f32>,
  gridSpacing: vec2<f32>,
  padding: vec2<f32>,
};
@group(0) @binding(0) var<uniform> uniforms: GridUniforms;

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) fragPos: vec2<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) VertexIndex: u32) -> VertexOutput {
  var pos = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0), vec2<f32>( 1.0, -1.0), vec2<f32>(-1.0,  1.0),
    vec2<f32>(-1.0,  1.0), vec2<f32>( 1.0, -1.0), vec2<f32>( 1.0,  1.0)
  );
  var out: VertexOutput;
  out.position = vec4<f32>(pos[VertexIndex], 0.0, 1.0);
  out.fragPos = vec2<f32>(
    (pos[VertexIndex].x + 1.0) * 0.5 * uniforms.resolution.x,
    (1.0 - pos[VertexIndex].y) * 0.5 * uniforms.resolution.y
  );
  return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
  let coord = in.fragPos;
  let gridColor = vec4<f32>(0.18, 0.21, 0.28, 0.35);
  let thickness = 1.0;
  
  let dx = coord.x % uniforms.gridSpacing.x;
  let dy = coord.y % uniforms.gridSpacing.y;
  
  var finalColor = vec4<f32>(0.043, 0.055, 0.078, 1.0); // #0B0E14 — Premium Dark
  
  if (dx < thickness || dy < thickness) {
    finalColor = mix(finalColor, gridColor, 0.6);
  }
  
  let crosshairColor = vec4<f32>(1.0, 1.0, 1.0, 0.4);
  if (uniforms.hoverPixel.x > 0.0) {
    let distX = abs(coord.x - uniforms.hoverPixel.x);
    let distY = abs(coord.y - uniforms.hoverPixel.y);
    if (distX < 1.0 || distY < 1.0) {
       if ((coord.x + coord.y) % 8.0 < 4.0) {
         finalColor = crosshairColor;
       }
    }
  }
  return finalColor;
}
`;

const WebGPUChartEngine = React.forwardRef(({
  candles = [],
  darkMode = false,
  chartStyle = 'Candles',
  priceScaleMode = 0,
  autoScale = true,
  invertScale = false,
  timezoneOffset = 0,
  initialVisibleRange,
  onVisibleRangeChange,
  onChartReady,
  activeTool = null,
  isHoveringDrawing,
  drawings = [],
  tempShape = null,
  drawStart = null,
  onDrawingComplete,
  onDrawingDelete,
  visualIndicators = [],
  indicatorDataMap = {},
  volumeProfile = [],
  hoverCoords,
  selectedDrawingId,
  hideDrawings = false,
  cursorSettings = {},
  onRequestDraw
}, ref) => {
  const containerRef = useRef(null);
  const gpuCanvasRef = useRef(null);
  const textCanvasRef = useRef(null);
  
  const [gpuError, setGpuError] = useState(null);
  
  // GPU References
  const gpu = useRef({
    device: null,
    context: null,
    format: null,
    pipeline: null,
    uniformBuffer: null,
    vertexBuffer: null,
    vertexCount: 0
  });
  
  // Viewport State
  const vState = useRef({
    logicalRange: { from: 0, to: 100 },
    priceRange: { min: 0, max: 100 },
    width: 800,
    height: 600,
    isDragging: false,
    dragStart: null,
    hoverPixel: null,
  });

  const dpr = window.devicePixelRatio || 1;

  
  const timeToIndex = (time, arr) => {
    if (!arr || arr.length === 0) return 0;
    let l = 0, r = arr.length - 1;
    while (l <= r) {
      const m = (l + r) >> 1;
      if (arr[m].time === time) return m;
      if (arr[m].time < time) l = m + 1;
      else r = m - 1;
    }
    return l;
  };

  useEffect(() => {
    requestAnimationFrame(render);
  }, [drawings, activeTool, visualIndicators, indicatorDataMap]);

  useEffect(() => {
    if (initialVisibleRange) {
      vState.current.logicalRange = { ...initialVisibleRange };
      requestAnimationFrame(render);
    }
  }, [initialVisibleRange]);
  

  // ── INIT WEBGPU ─────────────────────────────────────────────────────────────
  useEffect(() => {
    async function initWebGPU() {
      if (!navigator.gpu) {
        setGpuError('WebGPU not supported on this browser/OS.');
        return;
      }
      try {
        const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
        if (!adapter) throw new Error('No adapter found.');
        
        const device = await adapter.requestDevice();
        gpu.current.device = device;
        
        const context = gpuCanvasRef.current.getContext('webgpu');
        gpu.current.context = context;
        
        const format = navigator.gpu.getPreferredCanvasFormat();
        gpu.current.format = format;
        
        context.configure({
          device,
          format,
          alphaMode: 'premultiplied'
        });

        // ── 1. CANDLE PIPELINE (Native Data Packing) ──
        const uniformBuffer = device.createBuffer({
          size: 32, // scale, offset, res, priceRange
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        gpu.current.uniformBuffer = uniformBuffer;

        const maxCandles = 100000;
        const candleBuffer = device.createBuffer({
          size: maxCandles * 32, // 8 floats
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

        // ── 1.5 COMPUTE SHADER (SMA) ──
        const computeUniformBuffer = device.createBuffer({
          size: 16, // period, candleCount, pad, pad
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        gpu.current.computeUniformBuffer = computeUniformBuffer;

        const indicatorBuffer = device.createBuffer({
          size: maxCandles * 4, // 1 float per candle
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
        });
        gpu.current.indicatorBuffer = indicatorBuffer;

        const computeShaderModule = device.createShaderModule({ code: wgslComputeSMA });
        const computePipeline = device.createComputePipeline({
          layout: 'auto',
          compute: { module: computeShaderModule, entryPoint: 'main' }
        });
        gpu.current.computePipeline = computePipeline;
        
        gpu.current.computeBindGroup = device.createBindGroup({
          layout: computePipeline.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: { buffer: candleBuffer } },
            { binding: 1, resource: { buffer: indicatorBuffer } },
            { binding: 2, resource: { buffer: computeUniformBuffer } }
          ]
        });

        // ── 1.6 LINE SHADER (DRAW SMA) ──
        const lineShaderModule = device.createShaderModule({ code: wgslLineShader });
        const linePipeline = device.createRenderPipeline({
          layout: 'auto',
          vertex: { module: lineShaderModule, entryPoint: 'vs_main' },
          fragment: { module: lineShaderModule, entryPoint: 'fs_main', targets: [{ 
            format, blend: {
                color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
                alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' }
            }
          }]},
          primitive: { topology: 'triangle-list' }
        });
        gpu.current.linePipeline = linePipeline;
        gpu.current.lineBindGroup = device.createBindGroup({
          layout: linePipeline.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: { buffer: uniformBuffer } },
            { binding: 1, resource: { buffer: indicatorBuffer } }
          ]
        });


        // ── NATIVE SDF GRID PIPELINE ──
        const gridUniformBuffer = device.createBuffer({
          size: 32, // 8 floats
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        gpu.current.gridUniformBuffer = gridUniformBuffer;

        const gridShaderModule = device.createShaderModule({ code: wgslGridShader });
        gpu.current.gridPipeline = device.createRenderPipeline({
          layout: 'auto',
          vertex: { module: gridShaderModule, entryPoint: 'vs_main' },
          fragment: {
            module: gridShaderModule,
            entryPoint: 'fs_main',
            targets: [{ format }]
          },
          primitive: { topology: 'triangle-list' }
        });
        gpu.current.gridBindGroup = device.createBindGroup({
          layout: gpu.current.gridPipeline.getBindGroupLayout(0),
          entries: [{ binding: 0, resource: { buffer: gridUniformBuffer } }]
        });

        // ── TEXTURE ATLAS (NATIVE GPU TEXT RENDERING) ──
        const atlasSize = 512;
        const offCanvas = document.createElement('canvas');
        offCanvas.width = atlasSize;
        offCanvas.height = atlasSize;
        const oCtx = offCanvas.getContext('2d', { willReadFrequently: true });
        
        oCtx.fillStyle = '#000000';
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
          usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
        });
        
        device.queue.writeTexture(
          { texture: fontTexture }, imgData.data,
          { bytesPerRow: atlasSize * 4, rowsPerImage: atlasSize },
          [atlasSize, atlasSize, 1]
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
          size: maxChars * 32, // 8 floats per char (vec4 posInfo, vec4 uvInfo)
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

        // ── 5. DRAWINGS PIPELINE (USER TRENDLINES) ──
        const wgslDrawing = `
          struct Uniforms { cw: f32, ch: f32, pad1: f32, pad2: f32 };
          @group(0) @binding(0) var<uniform> u: Uniforms;
          struct VIn { @location(0) pos: vec2<f32>, @location(1) color: vec4<f32> };
          struct VOut { @builtin(position) pos: vec4<f32>, @location(0) color: vec4<f32> };
          
          @vertex fn vs_main(in: VIn) -> VOut {
             var out: VOut;
             let x = (in.pos.x / u.cw) * 2.0 - 1.0;
             let y = 1.0 - (in.pos.y / u.ch) * 2.0;
             out.pos = vec4<f32>(x, y, 0.0, 1.0);
             out.color = in.color;
             return out;
          }
          
          @fragment fn fs_main(in: VOut) -> @location(0) vec4<f32> {
             return in.color;
          }
        `;
        const drawingShaderModule = device.createShaderModule({ code: wgslDrawing });
        const drawingPipeline = device.createRenderPipeline({
          layout: 'auto',
          vertex: {
            module: drawingShaderModule,
            entryPoint: 'vs_main',
            buffers: [{
              arrayStride: 24, // 2 f32 pos + 4 f32 color
              attributes: [
                { shaderLocation: 0, offset: 0, format: 'float32x2' },
                { shaderLocation: 1, offset: 8, format: 'float32x4' }
              ]
            }]
          },
          fragment: {
            module: drawingShaderModule,
            entryPoint: 'fs_main',
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
        
        const drawingUniformBuffer = device.createBuffer({
          size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });
        const drawingBuffer = device.createBuffer({
          size: 1000 * 36 * 4, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
        });
        
        gpu.current.drawingPipeline = drawingPipeline;
        gpu.current.drawingUniformBuffer = drawingUniformBuffer;
        gpu.current.drawingBuffer = drawingBuffer;
        gpu.current.drawingBindGroup = device.createBindGroup({
          layout: drawingPipeline.getBindGroupLayout(0),
          entries: [{ binding: 0, resource: { buffer: drawingUniformBuffer } }]
        });

        if (onChartReady) onChartReady();
        requestAnimationFrame(render);
        
      } catch (err) {
        setGpuError(
          "WebGPU Adapter failed to initialize. " +
          "Your browser may have WebGPU disabled. " +
          "Please open a new tab, go to chrome://flags/#enable-unsafe-webgpu , Enable it, and Relaunch Chrome."
        );
      }
    }
    
    initWebGPU();
    
    return () => {
      if (gpu.current.device) gpu.current.device.destroy();
    };
  }, []);

  // ── RENDER PIPELINE ────────────────────────────────────────────────────────
  const render = () => {
    if (!gpu.current.device || !gpu.current.pipeline) return;

    const cw = vState.current.width * dpr;
    const ch = vState.current.height * dpr;
    
    // Calculate layout metrics
    const pAxisW = 64 * dpr;
    const timeAxisY = ch - (26 * dpr);
    
    // Generate Buffer Data for Candlesticks (Phase 2 Native Packing)
    if (candles && candles.length > 0) {
      const count = Math.min(candles.length, gpu.current.maxCandles || 100000);
      const data = new Float32Array(count * 8);
      for (let i = 0; i < count; i++) {
        const c = candles[i];
        const offset = i * 8;
        data[offset] = c.open; data[offset+1] = c.high; data[offset+2] = c.low; data[offset+3] = c.close;
        data[offset+4] = i; 
      }
      if (gpu.current.candleBuffer) {
        gpu.current.device.queue.writeBuffer(gpu.current.candleBuffer, 0, data);
        gpu.current.candleCount = count;
      }
    }

    const logicalRange = vState.current.logicalRange;
    const rangeLen = logicalRange.to - logicalRange.from;
    const { min, max } = vState.current.priceRange;
    const priceRange = max - min;
    const scaleX = (cw - pAxisW) / (rangeLen * 10);
    const scaleY = timeAxisY / priceRange;
    const offsetX = -(logicalRange.from * 10 * scaleX);
    const offsetY = timeAxisY - (max * scaleY);

    const uniformsData = new Float32Array([
      scaleX, scaleY, offsetX, offsetY, cw, ch, min, max
    ]);
    gpu.current.device.queue.writeBuffer(gpu.current.uniformBuffer, 0, uniformsData);
    
    // Setup Text Data (Phase 4)
    let charCount = 0;
    if (gpu.current.charMap && gpu.current.textStorageBuffer) {
      const textData = new Float32Array(gpu.current.maxChars * 8);
      const pushText = (str, x, y) => {
        for(let i=0; i<str.length; i++) {
          const c = str[i];
          const map = gpu.current.charMap[c];
          if(!map) continue;
          if(charCount >= gpu.current.maxChars) break;
          const off = charCount * 8;
          textData[off] = x; textData[off+1] = y; textData[off+2] = 0; textData[off+3] = 0;
          textData[off+4] = map.x; textData[off+5] = map.y; textData[off+6] = map.w; textData[off+7] = map.h;
          x += map.w;
          charCount++;
        }
      };
      
      // Draw Axis Labels
      pushText(max.toFixed(2), cw - pAxisW + 10, 20);
      pushText(min.toFixed(2), cw - pAxisW + 10, timeAxisY - 20);
      pushText("12:00", cw / 2, timeAxisY + 10); // Example horizontal time
      
      if(charCount > 0) {
         gpu.current.device.queue.writeBuffer(gpu.current.textStorageBuffer, 0, textData);
         gpu.current.device.queue.writeBuffer(gpu.current.textUniformBuffer, 0, new Float32Array([cw, ch]));
      }
    }

    const commandEncoder = gpu.current.device.createCommandEncoder();
    
    // ── 0. EXECUTE COMPUTE SHADER (Phase 3) ──
    if (gpu.current.computePipeline && gpu.current.candleCount > 0) {
       const period = 14.0; // Default SMA 14 for testing native logic
       gpu.current.device.queue.writeBuffer(gpu.current.computeUniformBuffer, 0, new Float32Array([period, gpu.current.candleCount, 0, 0]));
       const computePass = commandEncoder.beginComputePass();
       computePass.setPipeline(gpu.current.computePipeline);
       computePass.setBindGroup(0, gpu.current.computeBindGroup);
       computePass.dispatchWorkgroups(Math.ceil(gpu.current.candleCount / 64));
       computePass.end();
    }

    const textureView = gpu.current.context.getCurrentTexture().createView();
    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [{
        view: textureView,
        clearValue: { r: 0.043, g: 0.055, b: 0.078, a: 1.0 }, // bg-[#0B0E14] — Premium Dark
        loadOp: 'clear',
        storeOp: 'store',
      }]
    });

    // ── 1. DRAW PROCEDURAL SDF GRID & CROSSHAIR ──
    if (gpu.current.gridPipeline) {
      const hoverX = vState.current.hoverPixel ? vState.current.hoverPixel.x * dpr : -1.0;
      const hoverY = vState.current.hoverPixel ? vState.current.hoverPixel.y * dpr : -1.0;
      // Make grid spacing deterministic + visible (match WebGL tick-ish density)
      // uniforms = resolution(cw,ch), hoverPixel, gridSpacing, padding
      const gridSpacingX = Math.max(24 * dpr, (cw - 64 * dpr) / 10);
      const gridSpacingY = Math.max(18 * dpr, (ch - 26 * dpr) / 8);
      const gridUniforms = new Float32Array([
        cw, ch, hoverX, hoverY,
        gridSpacingX, gridSpacingY,
        0, 0
      ]);
      gpu.current.device.queue.writeBuffer(gpu.current.gridUniformBuffer, 0, gridUniforms);
      
      renderPass.setPipeline(gpu.current.gridPipeline);
      renderPass.setBindGroup(0, gpu.current.gridBindGroup);
      renderPass.draw(6); // Fullscreen Quad
    }

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
    
    // ── 4. DRAW INDICATORS NATIVELY (Phase 3) ──
    if (gpu.current.linePipeline && gpu.current.candleCount > 1) {
       renderPass.setPipeline(gpu.current.linePipeline);
       renderPass.setBindGroup(0, gpu.current.lineBindGroup);
       renderPass.draw(6, gpu.current.candleCount - 1, 0, 0);
    }
    
    // ── 5. DRAW USER TRENDLINES (RESTORED LOGIC) ──
    if (gpu.current.drawingPipeline) {
        const pAxisW = 64 * dpr;
        const timeAxisY = ch - (26 * dpr);
        const { min, max } = vState.current.priceRange;
        const priceScale = (max - min) > 0 ? timeAxisY / (max - min) : 1;
        const logicalRange = vState.current.logicalRange;
        const rangeLen = logicalRange.to - logicalRange.from;
        
        const px = (time) => {
           const idx = timeToIndex(time, candles);
           return ((idx - logicalRange.from) / rangeLen) * (cw - pAxisW);
        };
        const py = (price) => timeAxisY - ((price - min) * priceScale);
        
        let totalSegments = 0;
        if (drawings && drawings.length > 0) {
            for (let i = 0; i < drawings.length; i++) {
                if (drawings[i].tool === 'trendline' && drawings[i].points.length >= 2) totalSegments++;
            }
        }
        if (activeTool === 'trendline' && gpu.current.activeDrawStart && gpu.current.activeTempShape) {
            totalSegments++;
        }
        
        if (totalSegments > 0) {
            const floatsRequired = totalSegments * 36; 
            const drawingData = new Float32Array(floatsRequired);
            let ptr = 0;
            const pushThickLine = (v1, v2, thickness, color) => {
                const quadVertices = lineToQuad(v1, v2, thickness);
                for (const v of quadVertices) {
                    drawingData[ptr++] = v.x; drawingData[ptr++] = v.y;
                    drawingData[ptr++] = color[0]; drawingData[ptr++] = color[1]; drawingData[ptr++] = color[2]; drawingData[ptr++] = color[3];
                }
            };
            const drawingColor = [0.2, 0.6, 1.0, 1.0];
            
            if (drawings && drawings.length > 0) {
                for (let i=0; i<drawings.length; i++) {
                    const d = drawings[i];
                    if (d.tool === 'trendline' && d.points.length >= 2) {
                        const v1 = { x: px(d.points[0].time), y: py(d.points[0].price) };
                        const v2 = { x: px(d.points[1].time), y: py(d.points[1].price) };
                        pushThickLine(v1, v2, 2 * dpr, drawingColor);
                    }
                }
            }
            if (activeTool === 'trendline' && gpu.current.activeDrawStart && gpu.current.activeTempShape) {
                const v1 = { x: px(gpu.current.activeDrawStart.time), y: py(gpu.current.activeDrawStart.price) };
                const v2 = { x: px(gpu.current.activeTempShape.time), y: py(gpu.current.activeTempShape.price) };
                pushThickLine(v1, v2, 2 * dpr, drawingColor);
            }
            
            gpu.current.device.queue.writeBuffer(gpu.current.drawingUniformBuffer, 0, new Float32Array([cw, ch, 0, 0]));
            gpu.current.device.queue.writeBuffer(gpu.current.drawingBuffer, 0, drawingData);
            
            renderPass.setPipeline(gpu.current.drawingPipeline);
            renderPass.setBindGroup(0, gpu.current.drawingBindGroup);
            renderPass.setVertexBuffer(0, gpu.current.drawingBuffer);
            renderPass.draw(ptr / 6);
        }
    }
    
    renderPass.end();
    gpu.current.device.queue.submit([commandEncoder.finish()]);
    
    if (onRequestDraw) onRequestDraw();
  };

  // ── RESIZE & EVENTS ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      for (let e of entries) {
        const { width, height } = e.contentRect;
        vState.current.width = width;
        vState.current.height = height;
        
        if (gpuCanvasRef.current) {
          gpuCanvasRef.current.width = width * dpr;
          gpuCanvasRef.current.height = height * dpr;
        }
        
        // Auto-scale price initially if needed
        if (autoScale && candles.length > 0) {
           let minP = Infinity, maxP = -Infinity;
           const from = Math.max(0, Math.floor(vState.current.logicalRange.from));
           const to = Math.min(candles.length - 1, Math.ceil(vState.current.logicalRange.to));
           for (let i=from; i<=to; i++) {
              if (candles[i].low < minP) minP = candles[i].low;
              if (candles[i].high > maxP) maxP = candles[i].high;
           }
           if (minP !== Infinity && maxP !== -Infinity) {
              const pad = (maxP - minP) * 0.1;
              vState.current.priceRange = { min: minP - pad, max: maxP + pad };
           }
        }
        
        requestAnimationFrame(render);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [candles, autoScale]);

  // Pointer Events for Panning and Zooming
  useEffect(() => {
    const canvas = containerRef.current;
    if (!canvas) return;
    
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let startLogicalFrom = 0;
    let startLogicalTo = 0;
    
    const onPointerDown = (e) => {
      const { left, top } = canvas.getBoundingClientRect();
      const px = e.clientX - left;
      const py = e.clientY - top;
      
      const cw = vState.current.width;
      const ch = vState.current.height;
      
      const isAxisClick = (px > cw - 64) || (py > ch - 26);
      
      // INTERNAL DRAWING LOGIC (Autonomous WebGPU)
      if (!isAxisClick && activeTool === 'eraser') {
         const { left, top } = canvas.getBoundingClientRect();
         const mouseX = e.clientX - left;
         const mouseY = e.clientY - top;
         
         const { min, max } = vState.current.priceRange;
         const priceRange = max - min;
         const ch = vState.current.height;
         const priceScale = priceRange > 0 ? (ch - 26) / priceRange : 1;
         const py = (price) => (max - price) * priceScale;
         
         const cw = vState.current.width;
         const logicalRange = vState.current.logicalRange;
         const rangeLen = logicalRange.to - logicalRange.from;
         const px = (time) => {
            const idx = timeToIndex(time, candles);
            return ((idx - logicalRange.from) / rangeLen) * (cw - 64);
         };
         
         const hit = raycastDrawings(drawings, mouseX, mouseY, px, py, 8); // 8px tolerance
         if (hit && onDrawingDelete) {
            onDrawingDelete(hit.id);
         }
         return;
      }
      
      if (!isAxisClick && activeTool && activeTool !== 'cursor') {
         const { left, top } = canvas.getBoundingClientRect();
         const px = e.clientX - left;
         const py = e.clientY - top;
         
         const { min, max } = vState.current.priceRange;
         const priceRange = max - min;
         const ch = vState.current.height;
         const priceScale = priceRange > 0 ? (ch - 26) / priceRange : 1;
         
         const price = max - (py / priceScale);
         
         const cw = vState.current.width;
         const logicalRange = vState.current.logicalRange;
         const rangeLen = logicalRange.to - logicalRange.from;
         const idx = logicalRange.from + ((px / (cw - 64)) * rangeLen);
         
         const time = candles[Math.min(candles.length - 1, Math.max(0, Math.floor(idx)))]?.time || 0;
         const coordinate = { time, price };
         
         if (!gpu.current.activeDrawStart) {
            // First click: start drawing
            gpu.current.activeDrawStart = coordinate;
            gpu.current.activeTempShape = coordinate;
         } else {
            // Second click: finish drawing and dispatch to global vault
            if (onDrawingComplete) {
               onDrawingComplete({
                  id: Date.now().toString(),
                  tool: activeTool,
                  points: [gpu.current.activeDrawStart, coordinate]
               });
            }
            gpu.current.activeDrawStart = null;
            gpu.current.activeTempShape = null;
         }
         requestAnimationFrame(render);
         return;
      }
      
      // Default panning logic
      isDragging = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      startLogicalFrom = vState.current.logicalRange.from;
      startLogicalTo = vState.current.logicalRange.to;
      canvas.setPointerCapture(e.pointerId);
    };
    
    const onPointerMove = (e) => {
      if (activeTool && activeTool !== 'cursor' && gpu.current.activeDrawStart) {
         const { left, top } = canvas.getBoundingClientRect();
         const px = e.clientX - left;
         const py = e.clientY - top;
         
         const { min, max } = vState.current.priceRange;
         const priceRange = max - min;
         const ch = vState.current.height;
         const priceScale = priceRange > 0 ? (ch - 26) / priceRange : 1;
         
         const price = max - (py / priceScale);
         
         const cw = vState.current.width;
         const logicalRange = vState.current.logicalRange;
         const rangeLen = logicalRange.to - logicalRange.from;
         const idx = logicalRange.from + ((px / (cw - 64)) * rangeLen);
         
         const cIdx = Math.min(candles.length - 1, Math.max(0, Math.floor(idx)));
         const c = candles[cIdx];
         const time = c?.time || 0;
         
         // Crosshair Magnet Snapping
         let snapPrice = price;
         if (c) {
            // Snap to closest (High, Low, Open, Close)
            const distO = Math.abs(price - c.open);
            const distH = Math.abs(price - c.high);
            const distL = Math.abs(price - c.low);
            const distC = Math.abs(price - c.close);
            const minDist = Math.min(distO, distH, distL, distC);
            if (minDist === distO) snapPrice = c.open;
            else if (minDist === distH) snapPrice = c.high;
            else if (minDist === distL) snapPrice = c.low;
            else snapPrice = c.close;
         }
         
         gpu.current.activeTempShape = { time, price: snapPrice };
         requestAnimationFrame(render);
         return;
      }
      
      if (!isDragging) return;
      const dx = e.clientX - dragStartX;
      
      const cw = vState.current.width;
      const rangeLen = startLogicalTo - startLogicalFrom;
      const candlesPerPixel = rangeLen / cw;
      
      const shift = dx * candlesPerPixel;
      vState.current.logicalRange.from = startLogicalFrom - shift;
      vState.current.logicalRange.to = startLogicalTo - shift;
      
      if (onVisibleRangeChange && candles && candles.length > 0) {
         onVisibleRangeChange({
            from: candles[Math.max(0, Math.floor(vState.current.logicalRange.from))]?.time,
            to: candles[Math.min(candles.length - 1, Math.ceil(vState.current.logicalRange.to))]?.time
         });
      }
      requestAnimationFrame(render);
    };
    
    const onPointerUp = (e) => {
      isDragging = false;
      canvas.releasePointerCapture(e.pointerId);
    };
    
    const onWheel = (e) => {
       e.preventDefault();
       const zoomFactor = e.deltaY > 0 ? 1.05 : 0.95;
       const rangeLen = vState.current.logicalRange.to - vState.current.logicalRange.from;
       const center = vState.current.logicalRange.from + (rangeLen / 2);
       
       const newLen = Math.max(10, Math.min(candles.length, rangeLen * zoomFactor));
       vState.current.logicalRange.from = center - (newLen / 2);
       vState.current.logicalRange.to = center + (newLen / 2);
       
       if (onVisibleRangeChange && candles && candles.length > 0) {
         onVisibleRangeChange({
            from: candles[Math.max(0, Math.floor(vState.current.logicalRange.from))]?.time,
            to: candles[Math.min(candles.length - 1, Math.ceil(vState.current.logicalRange.to))]?.time
         });
       }
       requestAnimationFrame(render);
    };
    
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    
    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('wheel', onWheel);
    };
  }, [candles, activeTool, onVisibleRangeChange]);

  useImperativeHandle(ref, () => ({
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
       
       const idx = timeToIndex(time, candles);
       const x = ((idx - logicalRange.from) / rangeLen) * (cw - pAxisW);
       const y = timeAxisY - ((price - min) * priceScale);
       return { x, y };
    }
  }));

  if (gpuError) {
    return <div className="w-full h-full flex items-center justify-center text-red-500 bg-[#131722] text-sm font-medium p-4 text-center">WebGPU Error: {gpuError}</div>;
  }

  return (
    <div ref={containerRef} className="w-full h-full relative bg-[#131722] overflow-hidden cursor-crosshair">
      <canvas ref={gpuCanvasRef} className="absolute top-0 left-0 w-full h-full touch-none" />
       {/* Text canvas removed, 100% native GPU! */} 
    </div>
  );
});

export default WebGPUChartEngine;
