// QuantaAI — WGSL Compute Shader: Parallel Simple Moving Average (SMA)
// Language: WGSL (WebGPU Shading Language)
// Executes directly on User GPU VRAM

struct Uniforms {
    length: u32,
    period: u32,
};

@group(0) @binding(0) var<uniform> params: Uniforms;
@group(0) @binding(1) var<storage, read> inputData: array<f32>;
@group(0) @binding(2) var<storage, read_write> outputData: array<f32>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let index = global_id.x;

    if (index >= params.length) {
        return;
    }

    if (index < params.period - 1u) {
        outputData[index] = 0.0;
        return;
    }

    var sum: f32 = 0.0;
    let start = index + 1u - params.period;
    for (var i: u32 = start; i <= index; i = i + 1u) {
        sum = sum + inputData[i];
    }

    outputData[index] = sum / f32(params.period);
}
