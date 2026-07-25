// QuantaAI — WGSL Compute Shader: Parallel Bollinger Bands
// Language: WGSL (WebGPU Shading Language)
// Output: Padded vec4 (upper, middle, lower, unused) per index

struct Uniforms {
    length: u32,
    period: u32,
    multiplier: f32,
};

@group(0) @binding(0) var<uniform> params: Uniforms;
@group(0) @binding(1) var<storage, read> inputData: array<f32>;
@group(0) @binding(2) var<storage, read_write> outputData: array<vec4<f32>>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let index = global_id.x;

    if (index >= params.length) {
        return;
    }

    if (index < params.period - 1u) {
        outputData[index] = vec4<f32>(0.0, 0.0, 0.0, 0.0);
        return;
    }

    var sum: f32 = 0.0;
    let start = index + 1u - params.period;
    for (var i: u32 = start; i <= index; i = i + 1u) {
        sum = sum + inputData[i];
    }
    let mean = sum / f32(params.period);

    var varianceSum: f32 = 0.0;
    for (var i: u32 = start; i <= index; i = i + 1u) {
        let diff = inputData[i] - mean;
        varianceSum = varianceSum + (diff * diff);
    }
    let stdDev = sqrt(varianceSum / f32(params.period));

    let upper = mean + (params.multiplier * stdDev);
    let lower = mean - (params.multiplier * stdDev);

    outputData[index] = vec4<f32>(upper, mean, lower, 0.0);
}
