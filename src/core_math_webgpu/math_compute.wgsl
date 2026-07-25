// WebGPU Compute Shader for High-Performance Indicator Math
// Native WGSL Language - ZERO JavaScript GC Pause

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
fn sma_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let index = global_id.x;
    let period = config.period;
    let len = config.total_candles;

    if (index >= len) {
        return;
    }

    if (index < period - 1u) {
        outputData.data[index] = 0.0;
        return;
    }

    var sum: f32 = 0.0;
    for (var i: u32 = 0u; i < period; i = i + 1u) {
        sum = sum + inputData.data[index - i];
    }
    
    outputData.data[index] = sum / f32(period);
}

@compute @workgroup_size(64)
fn rsi_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let index = global_id.x;
    let period = config.period;
    let len = config.total_candles;

    if (index >= len) {
        return;
    }

    if (index <= period) {
        outputData.data[index] = 0.0; 
        return;
    }

    var gainSum: f32 = 0.0;
    var lossSum: f32 = 0.0;

    for (var i: u32 = 0u; i < period; i = i + 1u) {
        let currentIdx = index - i;
        let diff = inputData.data[currentIdx] - inputData.data[currentIdx - 1u];
        if (diff > 0.0) {
            gainSum = gainSum + diff;
        } else {
            lossSum = lossSum - diff; // absolute value
        }
    }
    
    let avgGain = gainSum / f32(period);
    let avgLoss = lossSum / f32(period);

    if (avgLoss == 0.0) {
        outputData.data[index] = 100.0;
    } else {
        let rs = avgGain / avgLoss;
        outputData.data[index] = 100.0 - (100.0 / (1.0 + rs));
    }
}

@compute @workgroup_size(64)
fn macd_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let index = global_id.x;
    let len = config.total_candles;
    let fast_period = 12u;
    let slow_period = 26u;

    if (index >= len) {
        return;
    }

    if (index < slow_period - 1u) {
        outputData.data[index] = 0.0;
        return;
    }

    // Simplified independent MACD calculation per thread (O(N) per thread)
    let fast_mult = 2.0 / f32(fast_period + 1u);
    let slow_mult = 2.0 / f32(slow_period + 1u);
    
    var fast_ema = inputData.data[0];
    var slow_ema = inputData.data[0];

    for (var i: u32 = 1u; i <= index; i = i + 1u) {
        fast_ema = (inputData.data[i] - fast_ema) * fast_mult + fast_ema;
        slow_ema = (inputData.data[i] - slow_ema) * slow_mult + slow_ema;
    }

    outputData.data[index] = fast_ema - slow_ema;
}
