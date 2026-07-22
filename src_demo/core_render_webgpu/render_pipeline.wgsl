// WebGPU Native Rendering Pipeline
// Reads VRAM buffers directly from WGSL Compute Shader

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
};

@group(0) @binding(0) var<uniform> resolution: vec2<f32>;

@vertex
fn vs_main(@location(0) position: vec2<f32>) -> VertexOutput {
    var out: VertexOutput;
    
    // Normalize to clip space
    let zeroToOne = position / resolution;
    let zeroToTwo = zeroToOne * 2.0;
    let clipSpace = zeroToTwo - 1.0;
    
    out.position = vec4<f32>(clipSpace.x, -clipSpace.y, 0.0, 1.0);
    return out;
}

@fragment
fn fs_main() -> @location(0) vec4<f32> {
    return vec4<f32>(0.0, 1.0, 0.0, 1.0); // Green color
}
