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

const wgslShaders = `
struct Uniforms {
  transform: mat3x3<f32>,
  resolution: vec2<f32>,
  padding: vec2<f32>,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

struct VertexInput {
  @location(0) position: vec2<f32>,
  @location(1) color: vec4<f32>,
};

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) color: vec4<f32>,
};

@vertex
fn vs_main(in: VertexInput) -> VertexOutput {
  var out: VertexOutput;
  // Convert from pixel space to WebGPU clip space (-1 to 1)
  let pos = uniforms.transform * vec3<f32>(in.position, 1.0);
  out.position = vec4<f32>(
    (pos.x / uniforms.resolution.x) * 2.0 - 1.0,
    1.0 - (pos.y / uniforms.resolution.y) * 2.0,
    0.0,
    1.0
  );
  out.color = in.color;
  return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
  return in.color;
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

        // Create Uniform Buffer (holds transform and resolution)
        const uniformBuffer = device.createBuffer({
          size: 48, // mat3x3 (36 bytes) + resolution (8 bytes) + padding (4 bytes)
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        gpu.current.uniformBuffer = uniformBuffer;

        // Compile Shader Module
        const shaderModule = device.createShaderModule({
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
        const wgslText = `
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
        `;
        
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
          size: 10000 * 32,
          usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
        });

        // ── DRAWING SHADERS (LINES) ──
        const wgslLine = `
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
        `;
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
          primitive: { topology: 'triangle-list' }
        });
        
        gpu.current.lineBindGroup = device.createBindGroup({
          layout: gpu.current.linePipeline.getBindGroupLayout(0),
          entries: [{ binding: 0, resource: { buffer: uniformBuffer } }]
        });
        
        gpu.current.lineBufferSize = 1000 * 48; // 1000 lines * 2 verts * 6 floats * 4 bytes
        gpu.current.lineBuffer = device.createBuffer({
          size: gpu.current.lineBufferSize,
          usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
        });
        
        if (onChartReady) onChartReady();
        requestAnimationFrame(render);
        
      } catch (err) {
        setGpuError(err.message);
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
    
    // Generate Buffer Data for Candlesticks
    if (candles && candles.length > 0) {
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
      const toIdx = Math.min(candles.length - 1, Math.ceil(logicalRange.to));
      
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
          const c = candles[i];
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

    // Update Uniforms
    const uniformsData = new Float32Array(12);
    // Identity Transform for now
    uniformsData.set([
      1, 0, 0,
      0, 1, 0,
      0, 0, 1
    ], 0);
    uniformsData[9]  = vState.current.width * dpr;
    uniformsData[10] = vState.current.height * dpr;
    
    gpu.current.device.queue.writeBuffer(gpu.current.uniformBuffer, 0, uniformsData);

    const commandEncoder = gpu.current.device.createCommandEncoder();
    const textureView = gpu.current.context.getCurrentTexture().createView();

    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [{
        view: textureView,
        clearValue: { r: 0.075, g: 0.09, b: 0.133, a: 1.0 }, // bg-[#131722]
        loadOp: 'clear',
        storeOp: 'store',
      }]
    });

    renderPass.setPipeline(gpu.current.pipeline);
    renderPass.setBindGroup(0, gpu.current.bindGroup);
    
    if (gpu.current.vertexBuffer && gpu.current.vertexCount > 0) {
      renderPass.setVertexBuffer(0, gpu.current.vertexBuffer);
      renderPass.draw(gpu.current.vertexCount);
    }
    
    // NATIVE WEBGPU DRAWINGS & INDICATORS RENDERER
    if (gpu.current.linePipeline) {
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
         const idx = timeToIndex(time, candles);
         return ((idx - logicalRange.from) / rangeLen) * (cw - pAxisW);
       };
       const py = (price) => timeAxisY - ((price - min) * priceScale);

       // First pass: Calculate total line segments needed
       let totalSegments = 0;
       
       // Trendlines count
       if (drawings && drawings.length > 0) {
           for (let i = 0; i < drawings.length; i++) {
               if (drawings[i].tool === 'trendline' && drawings[i].points.length >= 2) totalSegments++;
           }
       }
       if (activeTool === 'trendline' && gpu.current.activeDrawStart && gpu.current.activeTempShape) {
           totalSegments++;
       }
       
       // Indicators count
       const activeOverlays = visualIndicators ? visualIndicators.filter(i => i.visible && INDICATOR_REGISTRY[i.type]?.kind === 'overlay') : [];
       let indicatorRenderData = []; 
       activeOverlays.forEach(ind => {
           const reg = INDICATOR_REGISTRY[ind.type];
           const dataObj = indicatorDataMap ? indicatorDataMap[ind.id] : null;
           if (!reg || !dataObj) return;
           
           reg.seriesConfig.forEach(series => {
               const lineData = dataObj[series.key];
               if (!lineData || lineData.length < 2) return;
               
               const opts = series.options(ind.params, ind.color);
               let colorStr = opts.color || '#2962ff';
               let colorArr = [0.16, 0.38, 1.0, 1.0]; // default blue
               if (colorStr.startsWith('#')) {
                   const hex = parseInt(colorStr.replace('#', '0x'), 16) || 0x2962ff;
                   colorArr = [((hex >> 16) & 0xFF)/255, ((hex >> 8) & 0xFF)/255, (hex & 0xFF)/255, 1.0];
               } else if (colorStr.startsWith('rgba')) {
                   const parts = colorStr.match(/[\d.]+/g);
                   if (parts && parts.length >= 4) {
                       colorArr = [parseInt(parts[0])/255, parseInt(parts[1])/255, parseInt(parts[2])/255, parseFloat(parts[3])];
                   }
               }
               const thickness = (opts.lineWidth || 1.5) * dpr;
               
               // Collect segments in visible range
               let validPoints = [];
               for (let i = 0; i < lineData.length; i++) {
                   const pt = lineData[i];
                   const idx = timeToIndex(pt.time, candles);
                   // Only collect if somewhat near visible range
                   if (idx >= logicalRange.from - 5 && idx <= logicalRange.to + 5) {
                       validPoints.push({ x: px(pt.time), y: py(pt.value) });
                   }
               }
               
               if (validPoints.length >= 2) {
                   totalSegments += (validPoints.length - 1);
                   indicatorRenderData.push({ points: validPoints, color: colorArr, thickness });
               }
           });
       });
       
       if (totalSegments > 0) {
           const floatsRequired = totalSegments * 36; // 6 vertices * 6 floats per line segment
           
           // Ensure buffer is large enough
           if (!gpu.current.lineBuffer || gpu.current.lineBufferSize < floatsRequired * 4) {
               if (gpu.current.lineBuffer) gpu.current.lineBuffer.destroy();
               gpu.current.lineBufferSize = floatsRequired * 4 * 1.5; // 50% headroom
               gpu.current.lineBuffer = gpu.current.device.createBuffer({
                   size: gpu.current.lineBufferSize,
                   usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
               });
           }
           
           const lineData = new Float32Array(floatsRequired);
           let ptr = 0;
           
           const pushThickLine = (v1, v2, thickness, color) => {
               const quadVertices = lineToQuad(v1, v2, thickness);
               for (const v of quadVertices) {
                   lineData[ptr++] = v.x; lineData[ptr++] = v.y;
                   lineData[ptr++] = color[0]; lineData[ptr++] = color[1]; lineData[ptr++] = color[2]; lineData[ptr++] = color[3];
               }
           };

           // 1. Draw indicator lines
           for (const item of indicatorRenderData) {
               const { points, color, thickness } = item;
               for (let i = 0; i < points.length - 1; i++) {
                   pushThickLine(points[i], points[i+1], thickness, color);
               }
           }
           
           // 2. Draw drawings lines
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
           
           if (ptr > 0) {
               gpu.current.device.queue.writeBuffer(gpu.current.lineBuffer, 0, lineData, 0, ptr);
               renderPass.setPipeline(gpu.current.linePipeline);
               renderPass.setBindGroup(0, gpu.current.lineBindGroup);
               renderPass.setVertexBuffer(0, gpu.current.lineBuffer);
               renderPass.draw(ptr / 6);
           }
       }
    }
    
    renderTextOverlay(renderPass);
    renderPass.end();
    gpu.current.device.queue.submit([commandEncoder.finish()]);
    
    if (onRequestDraw) onRequestDraw();
  };

  const renderTextOverlay = (renderPass) => {
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
      
      if (onVisibleRangeChange) {
         onVisibleRangeChange(vState.current.logicalRange);
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
       
       if (onVisibleRangeChange) {
         onVisibleRangeChange(vState.current.logicalRange);
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
