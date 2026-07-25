export class WebNNComputeDriver {
    private context: any = null;
    private builder: any = null;
    private isSupported: boolean = false;

    constructor() {
        this.init();
    }

    private async init() {
        try {
            // WebNN API is highly experimental (e.g. Chrome with specific flags)
            // @ts-ignore
            if (navigator.ml && navigator.ml.getNeuralNetworkContext) {
                // @ts-ignore
                this.context = await navigator.ml.getNeuralNetworkContext();
                // @ts-ignore
                this.builder = new MLGraphBuilder(this.context);
                this.isSupported = true;
                console.log("[WebNN] NPU hardware accelerated math available.");
            } else {
                console.warn("[WebNN] NPU API not available. Will fallback to WASM or CPU.");
            }
        } catch (error) {
            console.error("[WebNN] Failed to initialize NPU context:", error);
            this.isSupported = false;
        }
    }

    /**
     * Executes Indicator natively on the NPU using WebNN Graph Topologies.
     */
    public async calculate(indicator: string, data: Float32Array, period: number): Promise<Float32Array | null> {
        if (!this.isSupported || !this.builder) {
            return null; // Fallback to other engines
        }

        try {
            const length = data.length;
            
            // Example: 1D SMA using 1D Convolution on the NPU
            if (indicator === 'SMA') {
                const input = this.builder.input('input', { type: 'float32', dimensions: [1, 1, length] });
                // Filter array with weights 1/period
                const filterData = new Float32Array(period).fill(1.0 / period);
                const filter = this.builder.constant(
                    { type: 'float32', dimensions: [1, 1, period] },
                    filterData
                );
                
                // padding logic for SMA
                const outputNode = this.builder.conv1d(input, filter, { 
                    padding: [period - 1, 0],
                    groups: 1 
                });

                const graph = await this.builder.build({ output: outputNode });
                
                // We use Float32Array directly for zero-copy-like buffer binding
                const outputBuffer = new Float32Array(length);
                
                // compute the graph
                const inputs = { 'input': data };
                const outputs = { 'output': outputBuffer };
                
                // @ts-ignore
                await this.context.compute(graph, inputs, outputs);
                return outputBuffer;
            }

            // Other indicators can be mapped to custom WebNN topologies.
            // For complex iterative logic like EMA/RSI, WebNN is harder because it's a feed-forward DAG.
            // In those cases, NPU returns null to fallback to WASM.
            
            return null;
        } catch (e) {
            console.error("[WebNN] NPU Execution Error:", e);
            return null;
        }
    }
}

// Export a singleton instance
export const webNNComputeDriver = new WebNNComputeDriver();
