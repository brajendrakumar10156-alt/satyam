// Native WebGPU Indicator Rendering Pipeline
// Embedded Universal Translator (Time/Price -> NDC)

struct ViewportUniforms {
    width: f32,
    height: f32,
    minPrice: f32,
    maxPrice: f32,
    startIndex: f32,
    endIndex: f32,
    candleWidth: f32
};

@group(0) @binding(0) var<uniform> viewport: ViewportUniforms;

struct VertexInput {
    @location(0) timeIndex: f32,
    @location(1) price: f32
};

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) color: vec4<f32>
};

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;
    
    // ==============================================================
    // NATIVE UNIVERSAL TRANSLATOR (WebGPU WGSL)
    // Runs on thousands of GPU threads simultaneously (0 ms CPU cost)
    // ==============================================================
    
    // Normalize Time Index to Screen X (-1.0 to 1.0)
    let visiblePoints = viewport.endIndex - viewport.startIndex;
    var normalizedX = (input.timeIndex - viewport.startIndex) / visiblePoints;
    let screenX = (normalizedX * 2.0) - 1.0;
    
    // Normalize Price to Screen Y (-1.0 to 1.0)
    let priceRange = viewport.maxPrice - viewport.minPrice;
    var normalizedY = 0.5; // default center
    if (priceRange > 0.0) {
        normalizedY = (input.price - viewport.minPrice) / priceRange;
    }
    // Flip Y because WebGPU NDC has Y pointing UP, but our minPrice is bottom.
    // Actually, minPrice is bottom, so lower price = lower Y. This is correct for WebGPU!
    let screenY = (normalizedY * 2.0) - 1.0;

    output.position = vec4<f32>(screenX, screenY, 0.0, 1.0);
    output.color = vec4<f32>(0.16, 0.38, 1.0, 1.0); // Default Blue, will be overridden by pipeline uniform if needed
    
    return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
    return input.color;
}
