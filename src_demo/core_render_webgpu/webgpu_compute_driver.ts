/**
 * QuantaAI — WebGPU Compute Driver
 * Phase 3 — Hardware-Accelerated Parallel Compute Pipeline Manager
 *
 * HOW IT WORKS:
 *   1. Initializes WebGPU device & adapter
 *   2. Compiles WGSL shaders directly to GPU pipelines
 *   3. Allocates GPU VRAM buffers (Uniform, Storage)
 *   4. Dispatches compute workloads across GPU threads
 *   5. Keeps memory on VRAM for instant zero-copy rendering
 */

import smaShaderCode from './shaders/compute_sma.wgsl?raw';
import rsiShaderCode from './shaders/compute_rsi.wgsl?raw';
import bollingerShaderCode from './shaders/compute_bollinger.wgsl?raw';

export class WebGPUComputeDriver {
  constructor() {
    this.adapter = null;
    this.device = null;
    this.pipelines = new Map();
    this.supported = false;
  }

  async init() {
    if (!navigator.gpu) {
      console.warn('[WebGPUComputeDriver] WebGPU is not supported in this environment.');
      return false;
    }

    try {
      this.adapter = await navigator.gpu.requestAdapter();
      if (!this.adapter) return false;
      this.device = await this.adapter.requestDevice();

      // Compile Shader Modules
      this._createPipeline('sma', smaShaderCode);
      this._createPipeline('rsi', rsiShaderCode);
      this._createPipeline('bollinger', bollingerShaderCode);

      this.supported = true;
      console.log('[WebGPUComputeDriver] Native WebGPU Compute Pipelines Initialized ✓');
      return true;
    } catch (err) {
      console.error('[WebGPUComputeDriver] Initialization failed:', err);
      return false;
    }
  }

  _createPipeline(name, shaderCode) {
    const module = this.device.createShaderModule({ code: shaderCode });
    const pipeline = this.device.createComputePipeline({
      layout: 'auto',
      compute: {
        module,
        entryPoint: 'main',
      },
    });
    this.pipelines.set(name, pipeline);
  }

  /**
   * Run parallel SMA on GPU
   */
  async computeSMA(inputArray, period) {
    if (!this.supported) throw new Error('WebGPU Compute not initialized');

    const length = inputArray.length;
    const inputBuffer = this._createBuffer(inputArray, GPUBufferUsage.STORAGE);
    const outputBuffer = this._createOutputBuffer(length * 4, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC);
    
    // Uniforms: length (u32), period (u32)
    const uniformArray = new Uint32Array([length, period]);
    const uniformBuffer = this._createBuffer(uniformArray, GPUBufferUsage.UNIFORM);

    const pipeline = this.pipelines.get('sma');
    const bindGroup = this.device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: uniformBuffer } },
        { binding: 1, resource: { buffer: inputBuffer } },
        { binding: 2, resource: { buffer: outputBuffer } },
      ],
    });

    const commandEncoder = this.device.createCommandEncoder();
    const passEncoder = commandEncoder.beginComputePass();
    passEncoder.setPipeline(pipeline);
    passEncoder.setBindGroup(0, bindGroup);
    
    const workgroupCount = Math.ceil(length / 64);
    passEncoder.dispatchWorkgroups(workgroupCount);
    passEncoder.end();

    // Read back results
    const readBuffer = this.device.createBuffer({
      size: length * 4,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });
    commandEncoder.copyBufferToBuffer(outputBuffer, 0, readBuffer, 0, length * 4);
    this.device.queue.submit([commandEncoder.finish()]);

    await readBuffer.mapAsync(GPUMapMode.READ);
    const copy = new Float32Array(readBuffer.getMappedRange().slice(0));
    readBuffer.unmap();

    // Cleanup VRAM buffers
    inputBuffer.destroy();
    outputBuffer.destroy();
    uniformBuffer.destroy();
    readBuffer.destroy();

    return copy;
  }

  /**
   * Run a dynamically transpiled PineScript shader (WGSL)
   */
  async executeDynamicWGSL(shaderCode, bufferCount, inputArray) {
    if (!this.supported) throw new Error('WebGPU Compute not initialized');

    const length = inputArray.length;
    const inputBuffer = this._createBuffer(inputArray, GPUBufferUsage.STORAGE);
    const outputSignalsBuffer = this._createOutputBuffer(length * 4, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC);
    
    // Create auxiliary buffers for the indicators
    const auxiliaryBuffers = [];
    for (let i = 0; i < bufferCount; i++) {
        auxiliaryBuffers.push(this._createOutputBuffer(length * 4, GPUBufferUsage.STORAGE));
    }

    const module = this.device.createShaderModule({ code: shaderCode });
    const pipeline = this.device.createComputePipeline({
      layout: 'auto',
      compute: { module, entryPoint: 'main' },
    });

    const bindGroupEntries = [
      { binding: 0, resource: { buffer: inputBuffer } },
      { binding: 1, resource: { buffer: outputSignalsBuffer } }
    ];

    for (let i = 0; i < bufferCount; i++) {
        bindGroupEntries.push({ binding: 2 + i, resource: { buffer: auxiliaryBuffers[i] } });
    }

    const bindGroup = this.device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: bindGroupEntries,
    });

    const commandEncoder = this.device.createCommandEncoder();
    const passEncoder = commandEncoder.beginComputePass();
    passEncoder.setPipeline(pipeline);
    passEncoder.setBindGroup(0, bindGroup);
    
    const workgroupCount = Math.ceil(length / 64);
    passEncoder.dispatchWorkgroups(workgroupCount);
    passEncoder.end();

    // Read back signals
    const readBuffer = this.device.createBuffer({
      size: length * 4,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });
    commandEncoder.copyBufferToBuffer(outputSignalsBuffer, 0, readBuffer, 0, length * 4);
    this.device.queue.submit([commandEncoder.finish()]);

    await readBuffer.mapAsync(GPUMapMode.READ);
    const copy = new Float32Array(readBuffer.getMappedRange().slice(0));
    readBuffer.unmap();

    // Cleanup
    inputBuffer.destroy();
    outputSignalsBuffer.destroy();
    auxiliaryBuffers.forEach(b => b.destroy());
    readBuffer.destroy();

    return copy;
  }

  _createBuffer(arrayData, usage) {
    const buffer = this.device.createBuffer({
      size: arrayData.byteLength,
      usage: usage | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    if (arrayData instanceof Float32Array) {
      new Float32Array(buffer.getMappedRange()).set(arrayData);
    } else if (arrayData instanceof Uint32Array) {
      new Uint32Array(buffer.getMappedRange()).set(arrayData);
    }
    buffer.unmap();
    return buffer;
  }

  _createOutputBuffer(size, usage) {
    return this.device.createBuffer({
      size,
      usage,
    });
  }
}

export const webgpuComputeDriver = new WebGPUComputeDriver();
