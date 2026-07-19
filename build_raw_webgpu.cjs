const fs = require('fs');

const fullEngineCode = `import React, { useEffect, useRef, useState, useImperativeHandle } from 'react';
import { calculateHorizontalTimeAxisLabels, calculateVerticalPriceAxisLabels } from '../utils/webgpuAxisCollisionEngine';

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

const wgslShaders = \`
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
\`;

const WebGPUChartEngine = React.forwardRef(({
  data = [],
  layout = {},
  theme = {},
  priceScaleMode = 0,
  autoScale = true,
  initialVisibleRange,
  onVisibleRangeChange,
  onChartReady,
  activeTool,
  isHoveringDrawing,
  timezoneOffset = 0,
  preference = 'webgpu'
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
    
    renderPass.end();
    gpu.current.device.queue.submit([commandEncoder.finish()]);
    
    // Draw Text Overlay (Axis + Smart Collision)
    renderTextOverlay();
  };

  const renderTextOverlay = () => {
    const ctx = textCanvasRef.current?.getContext('2d');
    if (!ctx) return;
    
    const cw = vState.current.width;
    const ch = vState.current.height;
    
    ctx.clearRect(0, 0, cw, ch);
    ctx.font = '11px -apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, Ubuntu, sans-serif';
    ctx.fillStyle = '#787b86';
    ctx.textAlign = 'center';
    
    // Test native collision math
    const testLabels = [
      { y: 100, p: 45000, label: '45000.00' },
      { y: 105, p: 44990, label: '44990.00' }, // Will collide
      { y: 200, p: 44000, label: '44000.00' },
    ];
    
    const survivingPriceLabels = calculateVerticalPriceAxisLabels({
      priceLabels: testLabels,
      cH: ch,
    });
    
    ctx.textAlign = 'left';
    survivingPriceLabels.forEach(l => {
      ctx.fillText(l.label, cw - 60, l.y + 4);
    });
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
        if (textCanvasRef.current) {
          textCanvasRef.current.width = width * dpr;
          textCanvasRef.current.height = height * dpr;
          textCanvasRef.current.getContext('2d').scale(dpr, dpr);
        }
        requestAnimationFrame(render);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useImperativeHandle(ref, () => ({
    timeScale: () => ({
      getVisibleLogicalRange: () => vState.current.logicalRange,
      getVisibleRange: () => null,
      fitContent: () => {}
    }),
    priceScale: () => ({ applyOptions: () => {} }),
    captureViewport: () => ({ logicalRange: vState.current.logicalRange }),
    applyViewport: (vp) => { if (vp && vp.logicalRange) vState.current.logicalRange = vp.logicalRange; }
  }));

  if (gpuError) {
    return <div className="w-full h-full flex items-center justify-center text-red-500 bg-[#131722] text-sm font-medium p-4 text-center">WebGPU Error: {gpuError}</div>;
  }

  return (
    <div ref={containerRef} className="w-full h-full relative bg-[#131722] overflow-hidden cursor-crosshair">
      <canvas ref={gpuCanvasRef} className="absolute top-0 left-0 w-full h-full touch-none" />
      <canvas ref={textCanvasRef} className="absolute top-0 left-0 w-full h-full pointer-events-none" />
    </div>
  );
});

export default WebGPUChartEngine;
`;

fs.writeFileSync('src_demo/components/WebGPUChartEngine.jsx', fullEngineCode, 'utf8');
console.log('Successfully wrote raw WebGPU core and rendering pipeline');
