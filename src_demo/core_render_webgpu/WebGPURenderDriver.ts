/**
 * WebGPU Render Driver
 * Zero-dependency pipeline for rendering native WGSL.
 */

import renderWgsl from './render_pipeline.wgsl?raw';

export class WebGPURenderDriver {
    constructor(canvasElement) {
        this.canvas = canvasElement;
        this.context = null;
        this.device = null;
        this.pipeline = null;
    }

    async init() {
        if (!navigator.gpu) throw new Error("WebGPU not supported");

        const adapter = await navigator.gpu.requestAdapter();
        this.device = await adapter.requestDevice();

        this.context = this.canvas.getContext('webgpu');
        const format = navigator.gpu.getPreferredCanvasFormat();
        
        this.context.configure({
            device: this.device,
            format: format,
            alphaMode: 'premultiplied',
        });

        const wgslCode = renderWgsl;

        const shaderModule = this.device.createShaderModule({
            label: "Render Shader",
            code: wgslCode
        });

        this.pipeline = await this.device.createRenderPipelineAsync({
            layout: 'auto',
            vertex: {
                module: shaderModule,
                entryPoint: 'vs_main',
                buffers: [{
                    arrayStride: 8, // 2 f32s
                    attributes: [{
                        shaderLocation: 0,
                        offset: 0,
                        format: 'float32x2'
                    }]
                }]
            },
            fragment: {
                module: shaderModule,
                entryPoint: 'fs_main',
                targets: [{
                    format: format
                }]
            },
            primitive: {
                topology: 'line-strip'
            }
        });

        console.log("🚀 [WebGPU] Native Render Pipeline Initialized");
    }

    async loadWGSL(url) {
        try {
            const res = await fetch(url);
            return await res.text();
        } catch(e) {
            console.error("Failed to load WGSL render shader:", e);
            return "";
        }
    }

    /**
     * Renders array of float coordinates natively.
     * @param {Float32Array} screenCoords 
     */
    renderLines(screenCoords) {
        if (!this.pipeline) return;

        const vertexBuffer = this.device.createBuffer({
            size: screenCoords.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });

        this.device.queue.writeBuffer(vertexBuffer, 0, screenCoords);

        // Uniform buffer for resolution
        const uniformBuffer = this.device.createBuffer({
            size: 8,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        this.device.queue.writeBuffer(uniformBuffer, 0, new Float32Array([this.canvas.width, this.canvas.height]));

        const bindGroup = this.device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: uniformBuffer } }
            ]
        });

        const commandEncoder = this.device.createCommandEncoder();
        const renderPassDescriptor = {
            colorAttachments: [
                {
                    view: this.context.getCurrentTexture().createView(),
                    clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
                    loadOp: 'clear',
                    storeOp: 'store',
                },
            ],
        };

        const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
        passEncoder.setPipeline(this.pipeline);
        passEncoder.setBindGroup(0, bindGroup);
        passEncoder.setVertexBuffer(0, vertexBuffer);
        passEncoder.draw(screenCoords.length / 2, 1, 0, 0);
        passEncoder.end();

        this.device.queue.submit([commandEncoder.finish()]);
        
        vertexBuffer.destroy();
        uniformBuffer.destroy();
    }
}
