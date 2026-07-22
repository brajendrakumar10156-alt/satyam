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
  metaData: vec4<f32>,   // x = timeIndex
};

struct Uniforms {
  period: f32,
  candleCount: f32,
  _pad1: f32,
  _pad2: f32,
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
  let spacing = 10.0 * u.scale.x;
  let candleWidth = max(1.0, spacing * 0.8);
  
  let p1x = (f32(iIdx) * 10.0 * u.scale.x) + u.offset.x + (candleWidth * 0.5);
  let p2x = (f32(iIdx + 1u) * 10.0 * u.scale.x) + u.offset.x + (candleWidth * 0.5);
  
  let p1y = (u.priceRange.y - val1) * u.scale.y + u.offset.y;
  let p2y = (u.priceRange.y - val2) * u.scale.y + u.offset.y;
  
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
  metaData: vec4<f32>,   // x = timeIndex
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
  let index = c.metaData.x;
  let isPrediction = c.metaData.y == 1.0;

  let isUp = close >= open;
  var color = select(vec4<f32>(0.941, 0.329, 0.314, 1.0), vec4<f32>(0.153, 0.651, 0.604, 1.0), isUp);
  if (isPrediction) {
    color = vec4<f32>(color.r, color.g, color.b, 0.4);
  }

  let isWick = vIdx > 5u;
  let localVIdx = vIdx % 6u;
  var quad = array<vec2<f32>, 6>(
    vec2<f32>(0.0, 0.0), vec2<f32>(1.0, 0.0), vec2<f32>(0.0, 1.0),
    vec2<f32>(0.0, 1.0), vec2<f32>(1.0, 0.0), vec2<f32>(1.0, 1.0)
  );
  let q = quad[localVIdx];

  let spacing = 10.0 * u.scale.x;
  let candleWidth = max(1.0, spacing * 0.8);
  let wickWidth = max(1.0, spacing * 0.1);

  var topP = max(open, close);
  var botP = min(open, close);
  if (isWick) { topP = high; botP = low; }

  let pixelYTop = (u.priceRange.y - topP) * u.scale.y;
  var pixelYBot = (u.priceRange.y - botP) * u.scale.y;
  if (!isWick && pixelYBot - pixelYTop < 1.0) {
      pixelYBot = pixelYTop + 1.0;
  }
  
  let heightPx = pixelYBot - pixelYTop;
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
  _pad: vec2<f32>,
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
  // Canvas 2D Text Color (#c9d1d9)
  return vec4<f32>(0.788, 0.820, 0.851, 1.0); 
}
`;

const wgslGridShader = `
struct Uniforms {
  resolution: vec2<f32>,
  hoverPixel: vec2<f32>,
  gridSpacing: vec2<f32>,
  offset: vec2<f32>,
  axisSize: vec2<f32>,
  livePixelY: f32,
  lastPixelX: f32,
  liveColor: vec4<f32>,
};
@group(0) @binding(0) var<uniform> uniforms: Uniforms;

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
  
  // ── L-SHAPED AXIS BACKGROUND ──
  if (coord.x > (uniforms.resolution.x - uniforms.axisSize.x) || 
      coord.y > (uniforms.resolution.y - uniforms.axisSize.y)) {
    return vec4<f32>(0.051, 0.067, 0.090, 1.0); // Solid #0d1117 background
  }

  var finalColor = vec4<f32>(0.0, 0.0, 0.0, 0.0); // Transparent chart background
  
  // ── LIVE PRICE DASHED LINE ──
  if (uniforms.livePixelY > 0.0 && coord.x < (uniforms.resolution.x - uniforms.axisSize.x)) {
    let distY = abs(coord.y - uniforms.livePixelY);
    if (distY < 1.0) {
       // Dashed pattern: 4px dash, 4px gap
       if (u32(coord.x) % 8u < 4u) {
         finalColor = vec4<f32>(uniforms.liveColor.rgb, 0.8);
       }
    }
  }

  return finalColor;
}
`;

const WebGPUChartEngine = React.forwardRef(({
  candles = [],
  predictedCandle = null,
  darkMode = true,
  chartStyle = 'candles',
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
  const hoverPriceLabelRef = useRef(null);
  const hoverTimeLabelRef = useRef(null);
  const livePriceLabelRef = useRef(null);
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
    manualPriceScale: false,
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

  const lastCandleTimeRef = useRef(null);

  useEffect(() => {
    if (!candles || candles.length === 0) return;
    const currentLastTime = candles[candles.length - 1].time;
    const prevLastTime    = lastCandleTimeRef.current;

    if (prevLastTime && currentLastTime > prevLastTime) {
      // New candle appeared — auto-scroll only if user was at live edge
      const prevLastIdx = timeToIndex(prevLastTime, candles);
      if (vState.current.logicalRange.to >= prevLastIdx - 0.5) {
        const newLastIdx = candles.length - 1;
        const shift = newLastIdx - prevLastIdx;
        vState.current.logicalRange.from += shift;
        vState.current.logicalRange.to   += shift;
        
        if (onVisibleRangeChange) {
           onVisibleRangeChange({ 
               from: candles[Math.max(0, Math.floor(vState.current.logicalRange.from))]?.time, 
               to: candles[Math.min(candles.length - 1, Math.ceil(vState.current.logicalRange.to))]?.time 
           });
        }
      }
    }
    lastCandleTimeRef.current = currentLastTime;
    requestAnimationFrame(render);
  }, [drawings, activeTool, visualIndicators, indicatorDataMap, candles, onVisibleRangeChange]);

  const isInitializedRef = useRef(false);
  useEffect(() => {
    if (isInitializedRef.current || !candles || candles.length === 0) return;
    isInitializedRef.current = true;
    if (initialVisibleRange?.visibleRange) {
      const fromIdx = timeToIndex(initialVisibleRange.visibleRange.from, candles);
      const toIdx = timeToIndex(initialVisibleRange.visibleRange.to, candles);
      vState.current.logicalRange = { from: fromIdx, to: toIdx };
    } else {
      vState.current.logicalRange = {
        from: Math.max(0, candles.length - 80),
        to: candles.length - 1 + 20
      };
    }
    requestAnimationFrame(render);
  }, [initialVisibleRange, candles]);
  

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
          size: 64, // 16 floats (resolution, hoverPixel, gridSpacing, offset, axisSize, liveY, pad, liveColor)
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
        const ff = "'Inter', -apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, sans-serif";
        const fontSize = Math.floor(11 * dpr);
        oCtx.font = `bold ${fontSize}px ${ff}`; // Bold Canvas2D equivalent, scaled by DPR
        oCtx.textAlign = 'left';
        oCtx.textBaseline = 'top';
        
        const chars = "0123456789.:- ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
        const charMap = {};
        let cx = 0, cy = 0;
        const cell = Math.max(24, fontSize + 8);
        
        for (let i=0; i<chars.length; i++) {
           const char = chars[i];
           const m = oCtx.measureText(char);
           const w = Math.ceil(m.width);
           const ch_h = fontSize + 4; // Use scaled font size for cell height
           if (cx + cell > atlasSize) { cx = 0; cy += cell; }
           oCtx.fillText(char, cx, cy);
           charMap[char] = { x: cx, y: cy, w: (w===0 ? fontSize : w), h: ch_h };
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
          size: 50000 * 36 * 4, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
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
    const pAxisW = 50 * dpr;
    const timeAxisY = ch - (24 * dpr);
    
    let timeAxisWinners = [];
    let priceAxisWinners = [];
    
    // Auto-Scale Y-Axis (Smooth Easing)
    if (autoScale && !vState.current.manualPriceScale && candles && candles.length > 0) {
       let minP = Infinity, maxP = -Infinity;
       const fromIdx = Math.max(0, Math.floor(vState.current.logicalRange.from));
       const toIdx = Math.min(candles.length - 1, Math.ceil(vState.current.logicalRange.to));
       
       for (let i = fromIdx; i <= toIdx; i++) {
          if (candles[i].low < minP) minP = candles[i].low;
          if (candles[i].high > maxP) maxP = candles[i].high;
       }
       
       if (minP !== Infinity && maxP !== -Infinity) {
          let pad = (maxP - minP) * 0.1;
          if (pad === 0) pad = maxP * 0.01 || 1;
          
          const targetMin = minP - pad;
          const targetMax = maxP + pad;
          
          // Smoothly interpolate current priceRange towards target
          const diffMin = targetMin - vState.current.priceRange.min;
          const diffMax = targetMax - vState.current.priceRange.max;
          
          // Only apply and request next frame if difference is meaningful
          if (Math.abs(diffMin) > 0.000001 || Math.abs(diffMax) > 0.000001) {
             vState.current.priceRange.min += diffMin * 0.4;
             vState.current.priceRange.max += diffMax * 0.4;
             // Queue next frame for continuous smooth easing
             requestAnimationFrame(render);
          }
       }
    }
    
    // Generate Buffer Data for Candlesticks (Phase 2 Native Packing)
    const renderCandles = predictedCandle ? [...candles, predictedCandle] : candles;
    if (renderCandles && renderCandles.length > 0) {
      const count = Math.min(renderCandles.length, gpu.current.maxCandles || 100000);
      const data = new Float32Array(count * 8);
      for (let i = 0; i < count; i++) {
        const c = renderCandles[i];
        const offset = i * 8;
        data[offset] = c.open; data[offset+1] = c.high; data[offset+2] = c.low; data[offset+3] = c.close;
        data[offset+4] = i; 
        data[offset+5] = c.isPrediction ? 1.0 : 0.0;
      }
      if (gpu.current.candleBuffer) {
        gpu.current.device.queue.writeBuffer(gpu.current.candleBuffer, 0, data);
        gpu.current.candleCount = count;
      }
    }

    const logicalRange = vState.current.logicalRange;
    const rangeLen = (logicalRange.to - logicalRange.from) || 1;
    const { min, max } = vState.current.priceRange;
    const priceRange = (max - min) || 1;
    const scaleX = (cw - pAxisW) / (rangeLen * 10);
    const scaleY = timeAxisY / priceRange;
    const offsetX = -(logicalRange.from * 10 * scaleX);
    const offsetY = 0;

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
      
      // Raw labels generator
      const rawTimeLabels = [];
      const logicalRange = vState.current.logicalRange;
      const startIdx = Math.max(0, Math.floor(logicalRange.from));
      const endIdx = Math.min(candles.length - 1, Math.ceil(logicalRange.to));
      const timeAxisY = ch - (26 * dpr);
      const pAxisW = 54 * dpr;

      let lastMonth = -1, lastDay = -1;
      for (let i = startIdx; i <= endIdx; i++) {
        if (!candles[i]) continue;
        const rawTime = candles[i].time;
        const timeMs = rawTime < 10000000000 ? rawTime * 1000 : rawTime;
        const d = new Date(timeMs);
        const mon = d.getUTCMonth();
        const day = d.getUTCDate();
        const H = d.getUTCHours();
        const M = d.getUTCMinutes();

        const isNewMonth = (mon !== lastMonth && lastMonth !== -1);
        const isNewDay = (day !== lastDay && lastDay !== -1) && !isNewMonth;
        lastMonth = mon; lastDay = day;

        const isNewYear = isNewMonth && d.getUTCMonth() === 0;

        let isMajor = false;
        let label = '';
        if (isNewYear) { label = d.getUTCFullYear().toString(); isMajor = true; }
        else if (isNewMonth) { label = d.toLocaleString('default', { month: 'short', timeZone: 'UTC' }); isMajor = true; }
        else if (isNewDay) { label = `${d.getUTCDate()} ${d.toLocaleString('default', { month: 'short', timeZone: 'UTC' })}`; isMajor = true; }
        else {
           // Fallback robust spacing: place a label every ~12 candles based on zoom
           const tickSpacing = Math.max(1, Math.floor(((logicalRange.to - logicalRange.from) || 1) / 12));
           if (i % tickSpacing !== 0) continue;
           label = `${H.toString().padStart(2, '0')}:${M.toString().padStart(2, '0')}`;
        }
        
        // Calculate X position
        const rangeLen = (logicalRange.to - logicalRange.from) || 1;
        const scaleX = (cw - pAxisW) / (rangeLen * 10);
        const offsetX = -(logicalRange.from * 10 * scaleX);
        const candleWidth = Math.max(1.0, 10.0 * scaleX * 0.8);
        const x = (i * 10.0 * scaleX) + offsetX + (candleWidth * 0.5);

        rawTimeLabels.push({ x, label, isMajor });
      }

      timeAxisWinners = calculateHorizontalTimeAxisLabels({
        timeLabels: rawTimeLabels,
        cW: cw,
        pAxisW: pAxisW
      });

      const rawPriceLabels = [];
      const { min, max } = vState.current.priceRange;
      const priceRange = (max - min) || 1;
      
      // Dynamic price step calculation (target ~8-10 labels based on height)
      const targetSteps = Math.max(4, Math.floor(ch / (60 * dpr))); 
      const rawStep = priceRange / targetSteps;
      
      const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
      const normalized = rawStep / magnitude;
      
      let stepMult = 1;
      if (normalized > 7.5) stepMult = 10;
      else if (normalized > 3.5) stepMult = 5;
      else if (normalized > 1.5) stepMult = 2;
      
      const pStep = Math.max(0.000001, stepMult * magnitude);
      
      // Determine decimal places for formatting
      const decPlaces = pStep >= 1 ? 0 : pStep >= 0.1 ? 2 : pStep >= 0.01 ? 2 : pStep >= 0.001 ? 3 : 4;
      
      const startP = Math.floor(min / pStep) * pStep;
      for (let p = startP; p <= max; p += pStep) {
        if (p < min || p > max) continue;
        const py = timeAxisY - ((p - min) * (timeAxisY / priceRange));
        rawPriceLabels.push({ y: py, p: p, label: p.toFixed(decPlaces) });
      }

      priceAxisWinners = calculateVerticalPriceAxisLabels({
        priceLabels: rawPriceLabels,
        cH: ch,
        timeAxisH: 24 * dpr
      });

      // Draw Axis Labels
      const getTextWidth = (str) => {
        let w = 0;
        for (let i = 0; i < str.length; i++) {
          const map = gpu.current.charMap[str[i]];
          if (map) w += map.w;
        }
        return w;
      };

      timeAxisWinners.forEach(({ x, label }) => {
         const w = getTextWidth(label);
         // Move the time labels down so they are perfectly centered in the 24px box
         pushText(label, Math.floor(x - w / 2), Math.floor(timeAxisY + (8 * dpr)));
      });
      priceAxisWinners.forEach(({ y, label }) => {
         const w = getTextWidth(label);
         const fontSize = Math.floor(11 * dpr);
         const centerX = Math.floor(cw - pAxisW + (pAxisW - w) / 2);
         pushText(label, centerX, Math.floor(y - (fontSize / 2)));
      });
      
      if(charCount > 0) {
         gpu.current.device.queue.writeBuffer(gpu.current.textStorageBuffer, 0, textData);
         gpu.current.device.queue.writeBuffer(gpu.current.textUniformBuffer, 0, new Float32Array([cw, ch, 0, 0]));
      }
    }

    const commandEncoder = gpu.current.device.createCommandEncoder();
    
    // ── 0. EXECUTE COMPUTE SHADER (Phase 3) ──
    if (gpu.current.computePipeline && gpu.current.candleCount > 0) {
       // const period = 14.0; // Default SMA 14 for testing native logic
       // gpu.current.device.queue.writeBuffer(gpu.current.computeUniformBuffer, 0, new Float32Array([period, gpu.current.candleCount, 0, 0]));
       // const computePass = commandEncoder.beginComputePass();
       // computePass.setPipeline(gpu.current.computePipeline);
       // computePass.setBindGroup(0, gpu.current.computeBindGroup);
       // computePass.dispatchWorkgroups(Math.ceil(gpu.current.candleCount / 64));
       // computePass.end();
    }

    const textureView = gpu.current.context.getCurrentTexture().createView();
    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [{
        view: textureView,
        clearValue: { r: 0.051, g: 0.067, b: 0.090, a: 1.0 }, // #0d1117 to match Canvas2D
        loadOp: 'clear',
        storeOp: 'store',
      }]
    });

    // ── 1. DRAW PROCEDURAL SDF GRID & CROSSHAIR ──
    if (gpu.current.gridPipeline) {
      const hoverX = vState.current.hoverPixel ? vState.current.hoverPixel.x * dpr : -1.0;
      const hoverY = vState.current.hoverPixel ? vState.current.hoverPixel.y * dpr : -1.0;
      // Make grid spacing deterministic + visible (match WebGL tick-ish density)
      const gridSpacingX = Math.max(24 * dpr, (cw - 54 * dpr) / 10);
      const gridSpacingY = Math.max(18 * dpr, (ch - 26 * dpr) / 8);
      
      let livePixelY = -1.0;
      let lastPixelX = -1.0;
      let lcR = 0.0, lcG = 0.0, lcB = 0.0;
      if (candles && candles.length > 0) {
        const lastIdx = candles.length - 1;
        const lastC = candles[lastIdx];
        const isUp = lastC.close >= lastC.open;
        lcR = isUp ? 0.031 : 0.949; // 0x08 / 0xf2
        lcG = isUp ? 0.600 : 0.211; // 0x99 / 0x36
        lcB = isUp ? 0.505 : 0.270; // 0x81 / 0x45
        const minP = vState.current.priceRange.min;
        const maxP = vState.current.priceRange.max;
        const priceScale = (maxP - minP) > 0 ? (ch - 24 * dpr) / (maxP - minP) : 1;
        livePixelY = (ch - 24 * dpr) - ((lastC.close - minP) * priceScale);
        
        // Calculate last candle X position in screen pixels (multiplied by dpr to match WebGPU viewport)
        // Offset it to the RIGHT EDGE of the candle so it doesn't overlap the body
        const logicalRange = vState.current.logicalRange;
        const rangeLen = logicalRange.to - logicalRange.from;
        const px = ((lastIdx - logicalRange.from) / rangeLen) * (cw - 54 * dpr);
        const cwScaleX = (cw - 54 * dpr) / rangeLen;
        const candleWidthPx = Math.max(1.0, (10.0 * cwScaleX) * 0.8);
        lastPixelX = px + (candleWidthPx / 2.0) + 0.5;

        // Update Live Price DOM Label
        if (livePriceLabelRef.current) {
          livePriceLabelRef.current.textContent = lastC.close.toFixed(2);
          livePriceLabelRef.current.style.top = `${Math.floor(livePixelY / dpr) - 10}px`;
          livePriceLabelRef.current.style.backgroundColor = isUp ? '#089981' : '#f23645';
          livePriceLabelRef.current.style.display = 'flex';
        }
      } else if (livePriceLabelRef.current) {
         livePriceLabelRef.current.style.display = 'none';
      }

      const gridUniforms = new Float32Array([
        cw, ch, hoverX, hoverY,
        gridSpacingX, gridSpacingY,
        offsetX, offsetY,
        54 * dpr, 24 * dpr, livePixelY, lastPixelX,
        lcR, lcG, lcB, 1.0
      ]);
      gpu.current.device.queue.writeBuffer(gpu.current.gridUniformBuffer, 0, gridUniforms);
      
      renderPass.setPipeline(gpu.current.gridPipeline);
      renderPass.setBindGroup(0, gpu.current.gridBindGroup);
      renderPass.draw(6); // Fullscreen Quad
    }

    let drawingBufferOffset = 0;
    gpu.current.device.queue.writeBuffer(gpu.current.drawingUniformBuffer, 0, new Float32Array([cw, ch, 0, 0]));

    // ── 1.5 DRAW GRID LINES (UNDER CANDLES) ──
    const gridSegmentsCount = timeAxisWinners.length + priceAxisWinners.length + 2; // +2 for axes borders
    if (gridSegmentsCount > 0) {
        const gridFloats = gridSegmentsCount * 36;
        const gridData = new Float32Array(gridFloats);
        let ptr = 0;
        const pushThickLine = (v1, v2, thickness, color) => {
            const quadVertices = lineToQuad(v1, v2, thickness);
            for (const v of quadVertices) {
                gridData[ptr++] = v.x; gridData[ptr++] = v.y;
                gridData[ptr++] = color[0]; gridData[ptr++] = color[1]; gridData[ptr++] = color[2]; gridData[ptr++] = color[3];
            }
        };

        const gridLineColor = darkMode ? [0.168, 0.184, 0.223, 1.0] : [0.878, 0.890, 0.921, 1.0]; // #2B2F36 or #e0e3eb
        timeAxisWinners.forEach(({ x }) => pushThickLine({x, y: 0}, {x, y: timeAxisY}, 1, gridLineColor));
        priceAxisWinners.forEach(({ y }) => pushThickLine({x: 0, y}, {x: cw - pAxisW, y}, 1, gridLineColor));
        
        // Axis Borders (drawn slightly darker/thicker depending on theme)
        pushThickLine({x: cw - pAxisW, y: 0}, {x: cw - pAxisW, y: timeAxisY}, 1, gridLineColor);
        pushThickLine({x: 0, y: timeAxisY}, {x: cw - pAxisW, y: timeAxisY}, 1, gridLineColor);
        
        const byteLen = gridData.byteLength;
        gpu.current.device.queue.writeBuffer(gpu.current.drawingBuffer, drawingBufferOffset, gridData.buffer, gridData.byteOffset, byteLen);
        
        renderPass.setPipeline(gpu.current.drawingPipeline);
        renderPass.setBindGroup(0, gpu.current.drawingBindGroup);
        renderPass.setVertexBuffer(0, gpu.current.drawingBuffer, drawingBufferOffset);
        renderPass.draw(ptr / 6);
        
        drawingBufferOffset += byteLen;
        drawingBufferOffset = Math.ceil(drawingBufferOffset / 4) * 4;
    }

    // ── 1.8 DRAW VOLUME BARS (UNDER CANDLES) ──
    if (candles && candles.length > 0) {
        const logicalRange = vState.current.logicalRange;
        const startIdx = Math.max(0, Math.floor(logicalRange.from));
        const endIdx = Math.min(candles.length - 1, Math.ceil(logicalRange.to));
        
        let maxVol = 0;
        for (let i = startIdx; i <= endIdx; i++) {
            if (candles[i] && candles[i].volume > maxVol) maxVol = candles[i].volume;
        }
        
        if (maxVol > 0 && endIdx >= startIdx) {
            const volCount = endIdx - startIdx + 1;
            const volFloats = volCount * 36;
            const volData = new Float32Array(volFloats);
            let ptr = 0;
            
            const rangeLen = (logicalRange.to - logicalRange.from) || 1;
            const scaleX = (cw - pAxisW) / (rangeLen * 10);
            const offsetX = -(logicalRange.from * 10 * scaleX);
            const spacing = 10.0 * scaleX;
            const candleWidth = Math.max(1.0, spacing * 0.8);
            
            const pushThickLineVol = (v1, v2, thickness, color) => {
                const quadVertices = lineToQuad(v1, v2, thickness);
                for (const v of quadVertices) {
                    volData[ptr++] = v.x; volData[ptr++] = v.y;
                    volData[ptr++] = color[0]; volData[ptr++] = color[1]; volData[ptr++] = color[2]; volData[ptr++] = color[3];
                }
            };

            for (let i = startIdx; i <= endIdx; i++) {
                const c = candles[i];
                if (!c) continue;
                
                const x = (i * 10.0 * scaleX) + offsetX + (candleWidth * 0.5);
                const volH = (c.volume / maxVol) * (ch * 0.15);
                const isUp = c.close >= c.open;
                
                // WebGL matching colors with 0.35 alpha
                const r = isUp ? 16 / 255 : 239 / 255;
                const g = isUp ? 185 / 255 : 68 / 255;
                const b = isUp ? 129 / 255 : 68 / 255;
                
                pushThickLineVol(
                    { x, y: timeAxisY }, 
                    { x, y: timeAxisY - volH }, 
                    candleWidth, 
                    [r, g, b, 0.35]
                );
            }
            
            if (ptr > 0) {
                const safeW = Math.max(1, Math.floor(cw - pAxisW));
                const safeH = Math.max(1, Math.floor(timeAxisY));
                renderPass.setScissorRect(0, 0, safeW, safeH);
                
                const byteLen = volData.byteLength;
                gpu.current.device.queue.writeBuffer(gpu.current.drawingBuffer, drawingBufferOffset, volData.buffer, volData.byteOffset, byteLen);
                
                renderPass.setPipeline(gpu.current.drawingPipeline);
                renderPass.setBindGroup(0, gpu.current.drawingBindGroup);
                renderPass.setVertexBuffer(0, gpu.current.drawingBuffer, drawingBufferOffset);
                renderPass.draw(ptr / 6);
                
                drawingBufferOffset += byteLen;
                drawingBufferOffset = Math.ceil(drawingBufferOffset / 4) * 4;
                
                // Reset scissor
                renderPass.setScissorRect(0, 0, Math.floor(cw), Math.floor(ch));
            }
        }
    }

    // ── 2. DRAW CANDLESTICKS (NATIVE) ──
    renderPass.setPipeline(gpu.current.pipeline);
    renderPass.setBindGroup(0, gpu.current.bindGroup);
    if (gpu.current.candleCount > 0) {
       // Clip candles so they don't overlap into the axes area
       const safeW = Math.max(1, Math.floor(cw - pAxisW));
       const safeH = Math.max(1, Math.floor(timeAxisY));
       renderPass.setScissorRect(0, 0, safeW, safeH);
       
       renderPass.draw(12, gpu.current.candleCount, 0, 0);
       
       // Reset scissor for UI elements
       renderPass.setScissorRect(0, 0, Math.floor(cw), Math.floor(ch));
    }
    
    // ── 3. DRAW TEXT (NATIVE) ──
    if (gpu.current.textPipeline && charCount > 0) {
       renderPass.setPipeline(gpu.current.textPipeline);
       renderPass.setBindGroup(0, gpu.current.textBindGroup);
       renderPass.draw(6, charCount, 0, 0);
    }
    
    // ── 4. DRAW INDICATORS NATIVELY (Phase 3) ──
    if (gpu.current.drawingPipeline && candles && candles.length > 1 && visualIndicators && visualIndicators.length > 0) {
      const pAxisW_ind = 54 * dpr;
      const timeAxisY_ind = ch - (26 * dpr);
      const { min: minP_ind, max: maxP_ind } = vState.current.priceRange;
      const priceRange_ind = (maxP_ind - minP_ind) || 1;
      const priceScale_ind = timeAxisY_ind / priceRange_ind;
      const logicalRange_ind = vState.current.logicalRange;
      const rangeLen_ind = (logicalRange_ind.to - logicalRange_ind.from) || 1;

      const pxInd = (time) => {
        const idx = timeToIndex(time, candles);
        return ((idx - logicalRange_ind.from) / rangeLen_ind) * (cw - pAxisW_ind);
      };
      const pyInd = (price) => timeAxisY_ind - ((price - minP_ind) * priceScale_ind);

      // Default colors per indicator type
      const defaultColors = {
        ema: '#ff9800', sma: '#2962ff', bb: '#26a69a', vwap: '#00e676',
        wma: '#e040fb', dema: '#ff5722', tema: '#00bcd4', keltner: '#9c27b0',
        ichimoku_tenkan: '#2962ff', ichimoku_kijun: '#b71c1c',
        supertrend: '#00e676', hma: '#ff6f00', alma: '#7c4dff',
        sar: '#ffeb3b', env_upper: '#4caf50', env_lower: '#f44336',
      };
      const seriesColors = ['#ff9800', '#2962ff', '#26a69a', '#e040fb', '#00e676', '#ff5722', '#00bcd4', '#9c27b0'];

      // Count total line segments needed
      let totalIndSegments = 0;
      const indLinesToDraw = [];

      visualIndicators.forEach((ind, indIdx) => {
        if (!ind.visible) return;
        const reg = INDICATOR_REGISTRY[ind.type];
        if (!reg || reg.kind !== 'overlay') return;
        const results = indicatorDataMap[ind.id];
        if (!results) return;

        reg.seriesConfig.forEach((s, sIdx) => {
          const data = results[s.key];
          if (!data || data.length < 2) return;
          const color = ind.color || (s.options ? s.options(ind.params || reg.defaultParams, ind.color)?.color : null) || seriesColors[(indIdx + sIdx) % seriesColors.length];
          
          // Parse hex color to RGBA floats
          let r = 1, g = 0.6, b = 0, a = 1;
          if (color && color.startsWith('#')) {
            const hex = color.replace('#', '');
            r = parseInt(hex.substring(0, 2), 16) / 255;
            g = parseInt(hex.substring(2, 4), 16) / 255;
            b = parseInt(hex.substring(4, 6), 16) / 255;
          }

          // Build line segment pairs
          for (let i = 1; i < data.length; i++) {
            const prev = data[i - 1];
            const curr = data[i];
            if (prev.value == null || curr.value == null || isNaN(prev.value) || isNaN(curr.value)) continue;
            
            const x1 = pxInd(prev.time);
            const y1 = pyInd(prev.value);
            const x2 = pxInd(curr.time);
            const y2 = pyInd(curr.value);
            
            // Skip off-screen segments
            if (x2 < 0 || x1 > (cw - pAxisW_ind)) continue;
            
            indLinesToDraw.push({ x1, y1, x2, y2, r, g, b, a });
            totalIndSegments++;
          }
        });
      });

      if (totalIndSegments > 0) {
        const indFloats = totalIndSegments * 36;
        const indData = new Float32Array(indFloats);
        let indPtr = 0;

        for (const seg of indLinesToDraw) {
          const quadVertices = lineToQuad(
            { x: seg.x1, y: seg.y1 },
            { x: seg.x2, y: seg.y2 },
            1.5 * dpr
          );
          for (const v of quadVertices) {
            indData[indPtr++] = v.x;
            indData[indPtr++] = v.y;
            indData[indPtr++] = seg.r;
            indData[indPtr++] = seg.g;
            indData[indPtr++] = seg.b;
            indData[indPtr++] = seg.a;
          }
        }

        // Clip indicator lines within chart area
        const safeW = Math.max(1, Math.floor(cw - pAxisW_ind));
        const safeH = Math.max(1, Math.floor(timeAxisY_ind));
        renderPass.setScissorRect(0, 0, safeW, safeH);

        const byteLen = indData.byteLength;
        gpu.current.device.queue.writeBuffer(gpu.current.drawingBuffer, drawingBufferOffset, indData.buffer, indData.byteOffset, byteLen);
        renderPass.setPipeline(gpu.current.drawingPipeline);
        renderPass.setBindGroup(0, gpu.current.drawingBindGroup);
        renderPass.setVertexBuffer(0, gpu.current.drawingBuffer, drawingBufferOffset);
        renderPass.draw(indPtr / 6);
        
        drawingBufferOffset += byteLen;
        drawingBufferOffset = Math.ceil(drawingBufferOffset / 4) * 4;

        // Reset scissor
        renderPass.setScissorRect(0, 0, Math.floor(cw), Math.floor(ch));
      }
    }
    
    // ── 5. DRAW USER TRENDLINES (RESTORED LOGIC) ──
    if (gpu.current.drawingPipeline) {
        const pAxisW = 50 * dpr;
        const timeAxisY = ch - (24 * dpr);
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
        
        // Count user drawings
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
            
            // 3. Draw User Trendlines
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
            
            const byteLen = drawingData.byteLength;
            gpu.current.device.queue.writeBuffer(gpu.current.drawingBuffer, drawingBufferOffset, drawingData.buffer, drawingData.byteOffset, byteLen);
            
            renderPass.setPipeline(gpu.current.drawingPipeline);
            renderPass.setBindGroup(0, gpu.current.drawingBindGroup);
            renderPass.setVertexBuffer(0, gpu.current.drawingBuffer, drawingBufferOffset);
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
          gpuCanvasRef.current.width = Math.floor(width * dpr);
          gpuCanvasRef.current.height = Math.floor(height * dpr);
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
              let pad = (maxP - minP) * 0.1;
              if (pad === 0) pad = maxP * 0.01 || 1;
              vState.current.priceRange = { min: minP - pad, max: maxP + pad };
           }
        }
        
        requestAnimationFrame(render);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [candles, autoScale]);
  // Auto-scale effect when toggled on manually
  useEffect(() => {
    if (autoScale) vState.current.manualPriceScale = false;
    requestAnimationFrame(render);
  }, [autoScale]);

  // Pointer Events for Panning and Zooming
  useEffect(() => {
    const canvas = containerRef.current;
    if (!canvas) return;
    
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let startLogicalFrom = 0;
    let startLogicalTo = 0;
    let startPriceMin = 0;
    let startPriceMax = 0;
    
    const onPointerDown = (e) => {
      const { left, top } = canvas.getBoundingClientRect();
      const px = e.clientX - left;
      const py = e.clientY - top;
      
      const cw = vState.current.width;
      const ch = vState.current.height;
      
      const isAxisClick = (px > cw - 54) || (py > ch - 26);
      
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
            return ((idx - logicalRange.from) / rangeLen) * (cw - 54);
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
         const idx = logicalRange.from + ((px / (cw - 54)) * rangeLen);
         
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
      startPriceMin = vState.current.priceRange.min;
      startPriceMax = vState.current.priceRange.max;
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
         const idx = logicalRange.from + ((px / (cw - 54)) * rangeLen);
         
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

         // Update DOM Crosshair Labels
         if (hoverTimeLabelRef.current && hoverPriceLabelRef.current) {
            const d = new Date(time * 1000);
            const dd = d.getDate().toString().padStart(2, '0');
            const mo = d.toLocaleString('en-US', { month: 'short' });
            const yy = d.getFullYear().toString().slice(-2);
            const H = d.getHours().toString().padStart(2, '0');
            const M = d.getMinutes().toString().padStart(2, '0');
            hoverTimeLabelRef.current.textContent = `${dd} ${mo} '${yy} ${H}:${M}`;
            hoverTimeLabelRef.current.style.display = 'flex';
            hoverTimeLabelRef.current.style.left = `${px - 60}px`; // center it (width 120 / 2)
            
            const decPlaces = priceScale > 100 ? 4 : priceScale > 10 ? 3 : 2;
            hoverPriceLabelRef.current.textContent = price.toFixed(decPlaces);
            hoverPriceLabelRef.current.style.display = 'flex';
            hoverPriceLabelRef.current.style.top = `${py - 11}px`; // center vertically (height 22 / 2)
            
            const lineX = document.getElementById('webgpu-crosshair-x');
            const lineY = document.getElementById('webgpu-crosshair-y');
            if (lineX) { lineX.style.display = 'block'; lineX.style.left = `${px}px`; }
            if (lineY) { lineY.style.display = 'block'; lineY.style.top = `${py}px`; }
         }
         
         vState.current.hoverPixel = { x: px / dpr, y: py / dpr };
         
         gpu.current.activeTempShape = { time, price: snapPrice };
         requestAnimationFrame(render);
         return;
      }
      
      // GENERAL HOVER CROSSHAIR LOGIC
      if (!isDragging && (!activeTool || activeTool === 'cursor')) {
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
         const idx = logicalRange.from + ((px / (cw - 54)) * rangeLen);
         
         const cIdx = Math.min(candles.length - 1, Math.max(0, Math.floor(idx)));
         const c = candles[cIdx];
         const time = c?.time || 0;
         
         vState.current.hoverPixel = { x: px / dpr, y: py / dpr };

         // Center text in the axis region (pAxisW = 50 * dpr = ~100. Font is roughly 36px wide).
         const textWidthApprox = 36 * dpr;
         const centerX = cw - 50 + (50 - textWidthApprox) / 2.0;
         // axisTextData.push({ text: p.toFixed(4), x: centerX, y: py - 6 });

         if (hoverTimeLabelRef.current && hoverPriceLabelRef.current) {
            const d = new Date(time * 1000);
            const dd = d.getDate().toString().padStart(2, '0');
            const mo = d.toLocaleString('en-US', { month: 'short' });
            const yy = d.getFullYear().toString().slice(-2);
            const H = d.getHours().toString().padStart(2, '0');
            const M = d.getMinutes().toString().padStart(2, '0');
            hoverTimeLabelRef.current.textContent = `${dd} ${mo} '${yy} ${H}:${M}`;
            hoverTimeLabelRef.current.style.display = 'flex';
            hoverTimeLabelRef.current.style.left = `${px - 60}px`; 
            
            const decPlaces = priceScale > 100 ? 4 : priceScale > 10 ? 3 : 2;
            hoverPriceLabelRef.current.textContent = price.toFixed(decPlaces);
            hoverPriceLabelRef.current.style.display = 'flex';
            hoverPriceLabelRef.current.style.top = `${py - 11}px`;
            
            const lineX = document.getElementById('webgpu-crosshair-x');
            const lineY = document.getElementById('webgpu-crosshair-y');
            if (lineX) { lineX.style.display = 'block'; lineX.style.left = `${px}px`; }
            if (lineY) { lineY.style.display = 'block'; lineY.style.top = `${py}px`; }
         }
         
         requestAnimationFrame(render);
         return;
      }

      if (!isDragging) return;
      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;
      
      const cw = vState.current.width;
      const rangeLen = startLogicalTo - startLogicalFrom;
      const candlesPerPixel = rangeLen / cw;
      
      const shift = dx * candlesPerPixel;
      vState.current.logicalRange.from = startLogicalFrom - shift;
      vState.current.logicalRange.to = startLogicalTo - shift;

      if (Math.abs(dy) > 2) vState.current.manualPriceScale = true;

      if (vState.current.manualPriceScale) {
         const ch = vState.current.height;
         const pRange = startPriceMax - startPriceMin || 1;
         const priceScale = (ch - 26) / pRange;
         const priceShift = dy / priceScale;
         vState.current.priceRange.min = startPriceMin + priceShift;
         vState.current.priceRange.max = startPriceMax + priceShift;
      }
      
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
       const cw = vState.current.width;
       const rangeLen = vState.current.logicalRange.to - vState.current.logicalRange.from;
       
       if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
          // Horizontal panning (e.g. trackpad)
          const candlesPerPixel = rangeLen / cw;
          const shift = (e.deltaX * 0.5) * candlesPerPixel;
          vState.current.logicalRange.from += shift;
          vState.current.logicalRange.to += shift;
       } else {
          // Vertical scroll -> zoom
          const zoomFactor = e.deltaY > 0 ? 1.05 : 0.95;
          const center = vState.current.logicalRange.from + (rangeLen / 2);
          
          const newLen = Math.max(10, Math.min(candles.length, rangeLen * zoomFactor));
          vState.current.logicalRange.from = center - (newLen / 2);
          vState.current.logicalRange.to = center + (newLen / 2);
       }
       
       if (onVisibleRangeChange && candles && candles.length > 0) {
         onVisibleRangeChange({
            from: candles[Math.max(0, Math.floor(vState.current.logicalRange.from))]?.time,
            to: candles[Math.min(candles.length - 1, Math.ceil(vState.current.logicalRange.to))]?.time
         });
       }
       requestAnimationFrame(render);
    };
    
    const onPointerLeave = (e) => {
      isDragging = false;
      vState.current.hoverPixel = null;
      if (hoverTimeLabelRef.current && hoverPriceLabelRef.current) {
        hoverTimeLabelRef.current.style.display = 'none';
        hoverPriceLabelRef.current.style.display = 'none';
        const lineX = document.getElementById('webgpu-crosshair-x');
        const lineY = document.getElementById('webgpu-crosshair-y');
        if (lineX) lineX.style.display = 'none';
        if (lineY) lineY.style.display = 'none';
      }
      requestAnimationFrame(render);
    };
    
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('pointerleave', onPointerLeave);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    
    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      canvas.removeEventListener('wheel', onWheel);
    };
  }, [candles, activeTool, onVisibleRangeChange]);

  useImperativeHandle(ref, () => ({
    render: () => requestAnimationFrame(render),
    scrollToRealTime: () => {
      if (!candles || candles.length === 0) return;
      const lastIdx = candles.length - 1;
      const rangeLen = vState.current.logicalRange.to - vState.current.logicalRange.from || 100;
      const padding = rangeLen * 0.2;
      vState.current.logicalRange.from = lastIdx - rangeLen + padding;
      vState.current.logicalRange.to = lastIdx + padding;
      vState.current.manualPriceScale = false;
      requestAnimationFrame(render);
      if (onVisibleRangeChange) {
         onVisibleRangeChange({ 
             from: candles[Math.max(0, Math.floor(vState.current.logicalRange.from))]?.time, 
             to: candles[Math.min(candles.length - 1, Math.ceil(vState.current.logicalRange.to))]?.time 
         });
      }
    },
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
       const pAxisW = 50 * dpr;
       const timeAxisY = ch - (24 * dpr);
       
       const { min, max } = vState.current.priceRange;
       const priceRange = max - min;
       const priceScale = priceRange > 0 ? timeAxisY / priceRange : 1;
       
       const logicalRange = vState.current.logicalRange;
       const rangeLen = logicalRange.to - logicalRange.from;
       
       const idx = timeToIndex(time, candles);
       const x = ((idx - logicalRange.from) / rangeLen) * (cw - pAxisW);
       const y = timeAxisY - ((price - min) * priceScale);
       return { x: x / dpr, y: y / dpr };
    },
    coordinateToTimePrice: (x, y) => {
      if (!candles || candles.length === 0) return null;
      const cw = vState.current.width;
      const ch = vState.current.height;
      const pAxisW = 50;
      const timeAxisY = ch - 24;
      const chartW = cw - pAxisW;

      const logicalRange = vState.current.logicalRange;
      const rangeLen = logicalRange.to - logicalRange.from;

      const targetIdx = Math.round(logicalRange.from + (x / chartW) * rangeLen);
      const clampedIdx = Math.max(0, Math.min(candles.length - 1, targetIdx));
      const time = candles[clampedIdx]?.time || 0;

      const { min, max } = vState.current.priceRange;
      const priceRange = max - min;
      const priceScale = priceRange > 0 ? timeAxisY / priceRange : 1;
      const price = max - ((y) / (timeAxisY / priceRange));

      return { time, price };
    }
  }));

  if (gpuError) {
    return <div className="w-full h-full flex items-center justify-center text-red-500 bg-[#131722] text-sm font-medium p-4 text-center">WebGPU Error: {gpuError}</div>;
  }

  return (
    <div ref={containerRef} className="w-full h-full relative bg-[#131722] overflow-hidden cursor-crosshair">
      <canvas ref={gpuCanvasRef} className="absolute top-0 left-0 w-full h-full touch-none" />
      
      {/* Native WebGPU DOM Hover Crosshair Labels & Lines */}
      <div id="webgpu-crosshair-x" className="absolute top-0 bottom-[24px] w-[1px] bg-white/30 pointer-events-none hidden z-[80]" />
      <div id="webgpu-crosshair-y" className="absolute left-0 right-[50px] h-[1px] bg-white/30 pointer-events-none hidden z-[80]" />
      <div ref={hoverPriceLabelRef} className={`absolute right-0 w-[54px] h-[22px] rounded ${darkMode ? 'bg-[#2a2e39] text-[#ffffff]' : 'bg-[#e0e3eb] text-[#131722]'} text-[11px] font-bold font-sans flex items-center justify-center pointer-events-none hidden z-[100]`} />
      <div ref={hoverTimeLabelRef} className={`absolute bottom-[1px] w-[120px] h-[22px] rounded ${darkMode ? 'bg-[#2a2e39] text-[#ffffff]' : 'bg-[#e0e3eb] text-[#131722]'} text-[11px] font-bold font-sans flex items-center justify-center pointer-events-none hidden z-[100]`} />
      <div ref={livePriceLabelRef} className={`absolute right-0 w-[54px] h-[20px] rounded text-white text-[11px] font-bold font-sans flex items-center justify-center pointer-events-none z-[90]`} />
    </div>
  );
});

export default WebGPUChartEngine;
