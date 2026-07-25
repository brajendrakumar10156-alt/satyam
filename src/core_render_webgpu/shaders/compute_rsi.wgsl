// QuantaAI — WGSL Compute Shader: Parallel Relative Strength Index (RSI)
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

    if (index < params.period) {
        outputData[index] = 50.0;
        return;
    }

    var totalGain: f32 = 0.0;
    var totalLoss: f32 = 0.0;
    let start = index + 1u - params.period;

    for (var i: u32 = start; i <= index; i = i + 1u) {
        let diff = inputData[i] - inputData[i - 1u];
        if (diff > 0.0) {
            totalGain = totalGain + diff;
        } else {
            totalLoss = totalLoss - diff;
        }
    }

    let avgGain = totalGain / f32(params.period);
    let avgLoss = totalLoss / f32(params.period);

    if (avgLoss == 0.0) {
        outputData[index] = 100.0;
    } else {
        let rs = avgGain / avgLoss;
        outputData[index] = 100.0 - (100.0 / (1.0 + rs));
    }
}
