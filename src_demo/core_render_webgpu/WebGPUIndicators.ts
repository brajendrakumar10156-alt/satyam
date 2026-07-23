import shaderCode from './shaders/indicator_wgsl.wgsl?raw';

/**
 * QuantaAI - WebGPU Native Indicator Engine
 * Uses the GPU to natively render thousands of indicator points using Line Strips.
 */
export class WebGPUIndicators {
  constructor(canvas) {
    this.canvas = canvas;
    this.device = null;
    this.context = null;
    this.pipeline = null;
    this.viewportBuffer = null;
    this.ready = false;
  }

  async init() {
    if (!navigator.gpu) {
      console.warn('WebGPU not supported for indicators.');
      return false;
    }
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return false;
    this.device = await adapter.requestDevice();
    this.context = this.canvas.getContext('webgpu');
    
    const format = navigator.gpu.getPreferredCanvasFormat();
    this.context.configure({
      device: this.device,
      format: format,
      alphaMode: 'premultiplied'
    });

    const shaderModule = this.device.createShaderModule({ code: shaderCode });

    this.pipeline = this.device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module: shaderModule,
        entryPoint: 'vs_main',
        buffers: [{
          arrayStride: 8, // 2 floats (timeIndex, price) -> 8 bytes
          attributes: [
            { shaderLocation: 0, offset: 0, format: 'float32' },
            { shaderLocation: 1, offset: 4, format: 'float32' }
          ]
        }]
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fs_main',
        targets: [{ format }]
      },
      primitive: {
        topology: 'line-strip'
      }
    });

    this.viewportBuffer = this.device.createBuffer({
      size: 28, // 7 floats (width, height, minPrice, maxPrice, start, end, candleW) * 4
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    this.ready = true;
    console.log('[WebGPUIndicators] Hardware Engine initialized ✓');
    return true;
  }

  resize(width, height) {
    this.canvas.width = width;
    this.canvas.height = height;
  }

  /**
   * Renders the indicators natively
   */
  render(indicatorsDataMap, viewportState) {
    if (!this.ready) return;

    // Update Viewport Uniforms
    const uniformData = new Float32Array([
      viewportState.width,
      viewportState.height,
      viewportState.minPrice,
      viewportState.maxPrice,
      viewportState.startIndex,
      viewportState.endIndex,
      viewportState.candleWidth
    ]);
    this.device.queue.writeBuffer(this.viewportBuffer, 0, uniformData);

    const bindGroup = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: this.viewportBuffer } }]
    });

    const commandEncoder = this.device.createCommandEncoder();
    const textureView = this.context.getCurrentTexture().createView();
    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [{
        view: textureView,
        clearValue: { r: 0, g: 0, b: 0, a: 0 },
        loadOp: 'clear',
        storeOp: 'store'
      }]
    });

    renderPass.setPipeline(this.pipeline);
    renderPass.setBindGroup(0, bindGroup);

    // Loop through each indicator and draw it
    for (const [indId, dataArray] of Object.entries(indicatorsDataMap)) {
      if (!dataArray || dataArray.length === 0) continue;
      
      // dataArray is usually an array of floats. We need (timeIndex, price) pairs.
      // So if dataArray has N items, we make a Float32Array of 2N.
      const vertexData = new Float32Array(dataArray.length * 2);
      for(let i=0; i<dataArray.length; i++) {
         vertexData[i*2] = i; // timeIndex
         vertexData[i*2+1] = dataArray[i]; // price
      }

      const vertexBuffer = this.device.createBuffer({
        size: vertexData.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
      });
      this.device.queue.writeBuffer(vertexBuffer, 0, vertexData);

      renderPass.setVertexBuffer(0, vertexBuffer);
      renderPass.draw(dataArray.length);
    }

    renderPass.end();
    this.device.queue.submit([commandEncoder.finish()]);
  }
}
