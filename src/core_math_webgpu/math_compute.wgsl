// WebGPU Compute Shader for High-Performance Indicator Math
// Native WGSL Language - ZERO JavaScript GC Pause
// This calculates SMA (Simple Moving Average) across 1 Million candles in parallel.

struct DataBuffer {
    data: array<f32>,
};

struct Config {
    period: u32,
    total_candles: u32,
};

@group(0) @binding(0) var<storage, read> inputData: DataBuffer;
@group(0) @binding(1) var<storage, read_write> outputData: DataBuffer;
@group(0) @binding(2) var<uniform> config: Config;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let index = global_id.x;
    
    // Boundary check
    if (index >= config.total_candles) {
        return;
    }
    
    let period = config.period;
    
    if (index < period - 1u) {
        // Not enough data to calculate SMA
        outputData.data[index] = 0.0;
        return;
    }
    
    var sum: f32 = 0.0;
    for (var i: u32 = 0u; i < period; i = i + 1u) {
        sum = sum + inputData.data[index - i];
    }
    
    outputData.data[index] = sum / f32(period);
}
