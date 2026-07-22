// src_demo/utils/gpuCompute.js

/**
 * Headless WebGPU Compute Node.
 * Compiles WGSL and executes financial math in parallel.
 */

let device = null;

export async function initWebGPUCompute() {
  if (device) return true;
  if (!navigator.gpu) {
    console.warn("WebGPU not supported on this browser.");
    return false;
  }
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) return false;
  device = await adapter.requestDevice();
  return true;
}

// WGSL Shader for Simple Moving Average (Perfectly parallel)
const smaWGSL = `
  @group(0) @binding(0) var<storage, read> dataIn : array<f32>;
  @group(0) @binding(1) var<storage, read_write> dataOut : array<f32>;
  @group(0) @binding(2) var<uniform> params : vec2<u32>; // [period, data_length]

  @compute @workgroup_size(64)
  fn main(@builtin(global_invocation_id) global_id : vec3<u32>) {
    let index = global_id.x;
    let period = params[0];
    let len = params[1];

    if (index >= len) {
      return;
    }

    if (index < period - 1u) {
      dataOut[index] = 0.0; // NaN equivalent
      return;
    }

    var sum: f32 = 0.0;
    for (var i: u32 = 0u; i < period; i = i + 1u) {
      sum = sum + dataIn[index - i];
    }
    
    dataOut[index] = sum / f32(period);
  }
`;

// WGSL Shader for RSI (Simplified Sliding Window approximation for parallelization)
// Note: True Wilder's RSI (RMA) is strictly sequential. This uses an SMA of gains/losses to allow O(1) parallelization per thread.
const rsiWGSL = `
  @group(0) @binding(0) var<storage, read> dataIn : array<f32>;
  @group(0) @binding(1) var<storage, read_write> dataOut : array<f32>;
  @group(0) @binding(2) var<uniform> params : vec2<u32>; // [period, data_length]

  @compute @workgroup_size(64)
  fn main(@builtin(global_invocation_id) global_id : vec3<u32>) {
    let index = global_id.x;
    let period = params[0];
    let len = params[1];

    if (index >= len) {
      return;
    }

    if (index <= period) {
      dataOut[index] = 0.0; 
      return;
    }

    var gainSum: f32 = 0.0;
    var lossSum: f32 = 0.0;

    for (var i: u32 = 0u; i < period; i = i + 1u) {
      let currentIdx = index - i;
      let diff = dataIn[currentIdx] - dataIn[currentIdx - 1u];
      if (diff > 0.0) {
        gainSum = gainSum + diff;
      } else {
        lossSum = lossSum - diff; // absolute value
      }
    }
    
    let avgGain = gainSum / f32(period);
    let avgLoss = lossSum / f32(period);

    if (avgLoss == 0.0) {
      dataOut[index] = 100.0;
    } else {
      let rs = avgGain / avgLoss;
      dataOut[index] = 100.0 - (100.0 / (1.0 + rs));
    }
  }
`;

const SHADERS = {
  SMA: smaWGSL,
  RSI: rsiWGSL
};

const pipelines = new Map();

/**
 * Execute a WGSL compute shader on an array of prices.
 * @param {string} indicator - 'SMA', 'RSI'
 * @param {Float32Array} inputData - The close prices
 * @param {number} period - The lookback period
 * @returns {Promise<Float32Array>} - The calculated results
 */
export async function executeWGSLCompute(indicator, inputData, period) {
  if (!device) {
    const success = await initWebGPUCompute();
    if (!success) throw new Error("WebGPU not available");
  }

  const wgslCode = SHADERS[indicator];
  if (!wgslCode) throw new Error(`No WGSL shader found for ${indicator}`);

  // Create or retrieve pipeline
  let pipeline = pipelines.get(indicator);
  if (!pipeline) {
    const shaderModule = device.createShaderModule({ code: wgslCode });
    pipeline = await device.createComputePipelineAsync({
      layout: 'auto',
      compute: {
        module: shaderModule,
        entryPoint: 'main',
      },
    });
    pipelines.set(indicator, pipeline);
  }

  const dataByteLength = inputData.byteLength;
  const elementCount = inputData.length;

  // 1. Input Buffer (Storage)
  const inputBuffer = device.createBuffer({
    size: dataByteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(inputBuffer, 0, inputData);

  // 2. Output Buffer (Storage + Copy Src)
  const outputBuffer = device.createBuffer({
    size: dataByteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
  });

  // 3. Staging Buffer (Map Read)
  const stagingBuffer = device.createBuffer({
    size: dataByteLength,
    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
  });

  // 4. Uniform Buffer (Params)
  const uniformData = new Uint32Array([period, elementCount]);
  const uniformBuffer = device.createBuffer({
    size: uniformData.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(uniformBuffer, 0, uniformData);

  // Bind Group
  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: inputBuffer } },
      { binding: 1, resource: { buffer: outputBuffer } },
      { binding: 2, resource: { buffer: uniformBuffer } },
    ],
  });

  // Command Encoder
  const encoder = device.createCommandEncoder();
  const pass = encoder.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  
  // Dispatch Workgroups
  const workgroupCount = Math.ceil(elementCount / 64);
  pass.dispatchWorkgroups(workgroupCount);
  pass.end();

  // Copy output to staging
  encoder.copyBufferToBuffer(outputBuffer, 0, stagingBuffer, 0, dataByteLength);
  
  device.queue.submit([encoder.finish()]);

  // Map Async to read back to CPU
  await stagingBuffer.mapAsync(GPUMapMode.READ);
  const copyArrayBuffer = stagingBuffer.getMappedRange();
  
  // Must clone the data before unmapping
  const result = new Float32Array(copyArrayBuffer.slice(0));
  
  stagingBuffer.unmap();
  inputBuffer.destroy();
  outputBuffer.destroy();
  stagingBuffer.destroy();
  uniformBuffer.destroy();

  return result;
}
