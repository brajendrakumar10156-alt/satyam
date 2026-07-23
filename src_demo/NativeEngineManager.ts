/**
 * Native Engine Manager & Universal Bridge
 * Hooks all physical Native engines into the React UI.
 * Relies on Rust's OmniOrchestrator for hardware detection and O(1) routing.
 */

// 1. Math Engines & Orchestrator
import { wasmMath, OmniOrchestrator, NativeDataSplicer } from './core_math_rust/wasm_loader.ts';
import { WebGPUComputeDriver } from './core_math_webgpu/WebGPUComputeDriver.ts';
import { WebNNEngine } from './core_math_webnn/WebNNEngine.ts';
import { perfectData } from './PerfectDataSplicer.ts';

// 2. Render Engines
import { Canvas2DRenderer } from './core_render_canvas2d/Canvas2DRenderer.ts';
import { WebGLRenderer } from './core_render_webgl/WebGLRenderer.ts';
import { WebGPURenderDriver } from './core_render_webgpu/WebGPURenderDriver.ts';

export class NativeEngineManager {
    constructor() {
        this.cpuMath = wasmMath;
        this.gpuMath = new WebGPUComputeDriver();
        this.npuMath = new WebNNEngine();
        this.orchestrator = null;
        
        this.renderers = {
            canvas2d: null,
            webgl: null,
            webgpu: null
        };
        
        this.ready = false;
    }

    async initializeSystem() {
        console.log("🚀 [NativeEngineManager] Booting up hardware-specific engines...");
        
        // Boot Math Engines in parallel
        await Promise.allSettled([
            this.cpuMath.init(),
            this.gpuMath.init(),
            this.npuMath.init()
        ]);

        // Fallback or Native init
        if (this.cpuMath.ready) {
            // Initialize Rust Orchestrator now that WASM is loaded
            this.orchestrator = new OmniOrchestrator();
            this.orchestrator.initialize(); // Detects hardware natively

            // Inject Native Data Splicer into the Singleton
            const wasmSplicer = new NativeDataSplicer();
            perfectData.injectWasmEngine(wasmSplicer);
            console.log("✅ [NativeEngineManager] Math Engines & Rust Orchestrator Ready");
        } else {
            console.warn("⚠️ [NativeEngineManager] Rust WASM not ready. Running in JS Fallback Mode temporarily.");
            this.orchestrator = null;
        }

        this.ready = true;

        // Determine best render engine for initial load
        if (this.gpuMath.device) return 'webgpu';
        return 'webgl';
    }

    mountRenderers(canvasElement) {
        this.renderers.canvas2d = new Canvas2DRenderer(canvasElement);
        this.renderers.webgl = new WebGLRenderer(canvasElement);
        this.renderers.webgpu = new WebGPURenderDriver(canvasElement);
    }

    async calculateAndRender(indicator, data, currentRenderEngine) {
        if (!this.ready) return;

        let mathResult = [];
        const datasetSize = data.length;

        let targetHardware = 'gpu'; // Fallback default

        if (this.orchestrator) {
            // Ask the Rust OmniOrchestrator to route the math task (O(1) time)
            const taskType = (indicator === 'ai_predict') ? "AI_INFERENCE" : "MATH_PARALLEL";
            targetHardware = this.orchestrator.route_task(taskType, datasetSize);
        }

        // Execute exactly where Rust told us to
        if (targetHardware === 'gpu' && this.gpuMath.device) {
            console.log(`[Orchestrator] Routed ${indicator} to WGSL (WebGPU)`);
            mathResult = await this.gpuMath.calculateSMA(data, 14); // Example period
        } else if (targetHardware === 'npu' && this.npuMath.isSupported) {
            console.log(`[Orchestrator] Routed ${indicator} to NPU (WebNN)`);
            mathResult = await this.npuMath.compileModel(data);
        } else {
            console.log(`[Orchestrator] Routed ${indicator} to CPU (Rust/WASM)`);
            mathResult = this.cpuMath.sma(data, 14);
        }

        // Render Routing
        if (currentRenderEngine === 'webgpu' && this.renderers.webgpu) {
            this.renderers.webgpu.renderLines(mathResult);
        } else if (currentRenderEngine === 'webgl' && this.renderers.webgl) {
            this.renderers.webgl.renderLines(mathResult);
        } else {
            this.renderers.canvas2d.renderLines(mathResult);
        }
    }
}

export const nativeManager = new NativeEngineManager();
