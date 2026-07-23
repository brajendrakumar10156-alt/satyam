/**
 * WebGPU Compute Driver
 * Native Zero-Dependency Bridge to WGSL.
 * Directly routes JS Float32Arrays to GPU VRAM for native WGSL calculation.
 */

import computeWgsl from './math_compute.wgsl?raw';

export class WebGPUComputeDriver {
    constructor() {
        this.device = null;
        this.computePipeline = null;
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
            label: "SMA Compute Shader",
            code: wgslCode
        });

        this.computePipeline = await this.device.createComputePipelineAsync({
            label: "SMA Compute Pipeline",
            layout: "auto",
            compute: {
                module: shaderModule,
                entryPoint: "main"
            }
        });
        
        console.log("🚀 [WebGPU] Native WGSL Compute Driver Initialized!");
    }

    async loadWGSL(url) {
        // In a real bundler like Vite, we would import the raw WGSL string.
        // For development, we fetch it.
        try {
            const res = await fetch(url);
            return await res.text();
        } catch(e) {
            console.error("Failed to load WGSL shader:", e);
            return "";
        }
    }

    /**
     * Executes SMA natively on the GPU using WGSL.
     * @param {Float32Array} data 
     * @param {number} period 
     */
    async calculateSMA(data, period) {
        if (!this.device || !this.computePipeline) {
            throw new Error("WebGPU driver not initialized.");
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
            layout: this.computePipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: inputBuffer } },
                { binding: 1, resource: { buffer: outputBuffer } },
                { binding: 2, resource: { buffer: configBuffer } }
            ]
        });

        // 4. Dispatch Commands
        const commandEncoder = this.device.createCommandEncoder();
        const passEncoder = commandEncoder.beginComputePass();
        passEncoder.setPipeline(this.computePipeline);
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
