/**
 * WebGPU Compute Driver
 * Native Zero-Dependency Bridge to WGSL.
 * Directly routes JS Float32Arrays to GPU VRAM for native WGSL calculation.
 */

import computeWgsl from './math_compute.wgsl?raw';

export class WebGPUComputeDriver {
    device: GPUDevice | null;
    pipelines: Map<string, GPUComputePipeline>;

    constructor() {
        this.device = null;
        this.pipelines = new Map();
    }

    async init() {
        if (!navigator.gpu) {
            throw new Error("WebGPU is not supported in this browser.");
        }
        
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) {
            throw new Error("Failed to request WebGPU adapter.");
        }
        
        this.device = await adapter.requestDevice();
        
        // Use Vite ?raw import for zero-latency native WGSL code
        const wgslCode = computeWgsl;

        const shaderModule = this.device.createShaderModule({
            label: "Math Compute Shader",
            code: wgslCode
        });

        const smaPipeline = await this.device.createComputePipelineAsync({
            label: "SMA Compute Pipeline",
            layout: "auto",
            compute: {
                module: shaderModule,
                entryPoint: "sma_main"
            }
        });

        const rsiPipeline = await this.device.createComputePipelineAsync({
            label: "RSI Compute Pipeline",
            layout: "auto",
            compute: {
                module: shaderModule,
                entryPoint: "rsi_main"
            }
        });

        const macdPipeline = await this.device.createComputePipelineAsync({
            label: "MACD Compute Pipeline",
            layout: "auto",
            compute: {
                module: shaderModule,
                entryPoint: "macd_main"
            }
        });

        this.pipelines.set('SMA', smaPipeline);
        this.pipelines.set('RSI', rsiPipeline);
        this.pipelines.set('MACD', macdPipeline);
        
        console.log("?? [WebGPU] Native WGSL Compute Driver Initialized!");
    }

    /**
     * Executes Indicator natively on the GPU using WGSL.
     */
    async calculate(indicator: string, data: Float32Array, period: number) {
        if (!this.device) {
            throw new Error("WebGPU driver not initialized.");
        }

        const pipeline = this.pipelines.get(indicator.toUpperCase());
        if (!pipeline) {
            throw new Error(`No WGSL pipeline found for ${indicator}`);
        }

        const dataByteLength = data.byteLength;
        const totalCandles = data.length;

        // 1. Create GPU Buffers
        const inputBuffer = this.device.createBuffer({
            size: dataByteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        });

        const outputBuffer = this.device.createBuffer({
            size: dataByteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
        });

        // Config Buffer (period, total_candles)
        const configBuffer = this.device.createBuffer({
            size: 8, // 2 u32s
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });

        // 2. Write Data to GPU VRAM
        this.device.queue.writeBuffer(inputBuffer, 0, data);
        this.device.queue.writeBuffer(configBuffer, 0, new Uint32Array([period, totalCandles]));

        // 3. Bind Groups
        const bindGroup = this.device.createBindGroup({
            layout: pipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: inputBuffer } },
                { binding: 1, resource: { buffer: outputBuffer } },
                { binding: 2, resource: { buffer: configBuffer } }
            ]
        });

        // 4. Dispatch Commands
        const commandEncoder = this.device.createCommandEncoder();
        const passEncoder = commandEncoder.beginComputePass();
        passEncoder.setPipeline(pipeline);
        passEncoder.setBindGroup(0, bindGroup);
        
        const workgroups = Math.ceil(totalCandles / 64);
        passEncoder.dispatchWorkgroups(workgroups);
        passEncoder.end();

        // 5. Read Result Back from VRAM
        const readBuffer = this.device.createBuffer({
            size: dataByteLength,
            usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
        });

        commandEncoder.copyBufferToBuffer(outputBuffer, 0, readBuffer, 0, dataByteLength);
        this.device.queue.submit([commandEncoder.finish()]);

        await readBuffer.mapAsync(GPUMapMode.READ);
        const copyArrayBuffer = readBuffer.getMappedRange();
        
        // Zero-cost copy to a new JS array
        const result = new Float32Array(copyArrayBuffer.slice(0));
        
        readBuffer.unmap();
        
        // Cleanup GPU memory
        inputBuffer.destroy();
        outputBuffer.destroy();
        configBuffer.destroy();
        readBuffer.destroy();

        return result;
    }
}
