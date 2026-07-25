import initWasm from './pkg/core_math_rust.js';

export const wasmMath = {
    ready: false,
    async init() {
        try {
            await initWasm();
            this.ready = true;
        } catch(e) {
            console.error("WASM init failed", e);
        }
    },
    sma(data: any, period: number) {
        return data; // Mock
    }
};

export class OmniOrchestrator {
    initialize() {}
    route_task(taskType: string, datasetSize: number) {
        return 'gpu'; // Mock
    }
}

export class NativeDataSplicer {
    // Mock
}
