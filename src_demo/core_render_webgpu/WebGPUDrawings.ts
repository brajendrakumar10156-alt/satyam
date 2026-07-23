/**
 * WebGPUDrawings.ts
 * 
 * Native WebGPU implementation of Drawing Tools.
 * Uses UniversalTranslator for Normalized Device Coordinates (NDC) mapping.
 */
import { UniversalTranslator } from '../core_render_shared/UniversalTranslator.ts';
import WGSL_SOURCE from './shaders/drawing.wgsl?raw';

export class WebGPUDrawings {
    constructor(canvasElement) {
        this.canvas = canvasElement;
        this.translator = new UniversalTranslator();
        this.ready = false;
        this.initWebGPU();
    }

    async initWebGPU() {
        if (!navigator.gpu) return;
        this.adapter = await navigator.gpu.requestAdapter();
        if (!this.adapter) return;
        this.device = await this.adapter.requestDevice();
        this.context = this.canvas.getContext('webgpu');
        
        const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
        this.context.configure({
            device: this.device,
            format: presentationFormat,
            alphaMode: 'premultiplied',
        });

        const shaderModule = this.device.createShaderModule({
            code: WGSL_SOURCE
        });

        // Line pipeline
        this.pipelineLines = this.device.createRenderPipeline({
            layout: 'auto',
            vertex: {
                module: shaderModule,
                entryPoint: 'vs_main',
                buffers: [{
                    arrayStride: 8,
                    attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x2' }]
                }]
            },
            fragment: {
                module: shaderModule,
                entryPoint: 'fs_main',
                targets: [{
                    format: presentationFormat,
                    blend: {
                        color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha' },
                        alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' }
                    }
                }]
            },
            primitive: {
                topology: 'line-list'
            }
        });

        // Triangle pipeline (for fills)
        this.pipelineTriangles = this.device.createRenderPipeline({
            layout: 'auto',
            vertex: {
                module: shaderModule,
                entryPoint: 'vs_main',
                buffers: [{
                    arrayStride: 8,
                    attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x2' }]
                }]
            },
            fragment: {
                module: shaderModule,
                entryPoint: 'fs_main',
                targets: [{
                    format: presentationFormat,
                    blend: {
                        color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha' },
                        alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' }
                    }
                }]
            },
            primitive: {
                topology: 'triangle-strip'
            }
        });

        // Uniform buffer for colors
        this.colorBuffer = this.device.createBuffer({
            size: 16, // vec4<f32>
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        this.bindGroupLines = this.device.createBindGroup({
            layout: this.pipelineLines.getBindGroupLayout(0),
            entries: [{ binding: 0, resource: { buffer: this.colorBuffer } }]
        });

        this.bindGroupTriangles = this.device.createBindGroup({
            layout: this.pipelineTriangles.getBindGroupLayout(0),
            entries: [{ binding: 0, resource: { buffer: this.colorBuffer } }]
        });

        this.ready = true;
    }

    resize(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;
    }

    hexToRgba(hexStr, alpha = 1.0) {
        const hex = hexStr.replace('#', '');
        return [
            parseInt(hex.substring(0, 2), 16) / 255.0,
            parseInt(hex.substring(2, 4), 16) / 255.0,
            parseInt(hex.substring(4, 6), 16) / 255.0,
            alpha
        ];
    }

    extractRgba(rgbaStr) {
        const match = rgbaStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
        if (match) {
            return [
                parseInt(match[1]) / 255, parseInt(match[2]) / 255, parseInt(match[3]) / 255,
                match[4] ? parseFloat(match[4]) : 1.0
            ];
        }
        return [0,0,0,1];
    }

    render(drawings, viewportState) {
        if (!this.ready) return;

        this.translator.updateState(
            viewportState.width, viewportState.height,
            viewportState.minPrice, viewportState.maxPrice,
            viewportState.startIndex, viewportState.endIndex,
            viewportState.candleWidth
        );

        const commandEncoder = this.device.createCommandEncoder();
        const textureView = this.context.getCurrentTexture().createView();
        const renderPass = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: textureView,
                clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 0.0 },
                loadOp: 'clear',
                storeOp: 'store'
            }]
        });

        for (const drawing of drawings) {
            if (drawing.type === 'trendline') {
                const ndc = this.translator.pointsToNDC([drawing.start, drawing.end]);
                
                const vertexBuffer = this.device.createBuffer({
                    size: ndc.byteLength,
                    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
                });
                this.device.queue.writeBuffer(vertexBuffer, 0, ndc);
                
                const color = new Float32Array(this.hexToRgba(drawing.color || '#2962FF', 1.0));
                this.device.queue.writeBuffer(this.colorBuffer, 0, color);

                renderPass.setPipeline(this.pipelineLines);
                renderPass.setBindGroup(0, this.bindGroupLines);
                renderPass.setVertexBuffer(0, vertexBuffer);
                renderPass.draw(2, 1, 0, 0);
            } else if (drawing.type === 'rectangle') {
                const p1 = this.translator.pointsToNDC([drawing.start])[0];
                const x1 = p1, y1 = this.translator.pointsToNDC([drawing.start])[1];
                const x2 = this.translator.pointsToNDC([drawing.end])[0];
                const y2 = this.translator.pointsToNDC([drawing.end])[1];

                // Fill
                const rectNdc = new Float32Array([
                    x1, y1, x2, y1, x1, y2, x2, y2
                ]);
                const fillBuffer = this.device.createBuffer({
                    size: rectNdc.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
                });
                this.device.queue.writeBuffer(fillBuffer, 0, rectNdc);

                const fillCol = new Float32Array(drawing.fillColor ? this.extractRgba(drawing.fillColor) : [0.16, 0.38, 1.0, 0.2]);
                this.device.queue.writeBuffer(this.colorBuffer, 0, fillCol);

                renderPass.setPipeline(this.pipelineTriangles);
                renderPass.setBindGroup(0, this.bindGroupTriangles);
                renderPass.setVertexBuffer(0, fillBuffer);
                renderPass.draw(4, 1, 0, 0);

                // Outline
                const outlineNdc = new Float32Array([
                    x1, y1, x2, y1, x2, y1, x2, y2, x2, y2, x1, y2, x1, y2, x1, y1
                ]);
                const outlineBuffer = this.device.createBuffer({
                    size: outlineNdc.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
                });
                this.device.queue.writeBuffer(outlineBuffer, 0, outlineNdc);

                const edgeCol = new Float32Array(this.hexToRgba(drawing.color || '#2962FF', 1.0));
                this.device.queue.writeBuffer(this.colorBuffer, 0, edgeCol);

                renderPass.setPipeline(this.pipelineLines);
                renderPass.setBindGroup(0, this.bindGroupLines);
                renderPass.setVertexBuffer(0, outlineBuffer);
                renderPass.draw(8, 1, 0, 0);
            }
        }

        renderPass.end();
        this.device.queue.submit([commandEncoder.finish()]);
    }
}
