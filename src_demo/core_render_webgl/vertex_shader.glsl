// WebGL Native Vertex Shader
// Processes geometry from WASM Translator natively on the GPU
attribute vec2 a_position;
uniform vec2 u_resolution;

void main() {
    // Convert from pixel coords to 0.0 -> 1.0
    vec2 zeroToOne = a_position / u_resolution;
    
    // Convert from 0->1 to 0->2
    vec2 zeroToTwo = zeroToOne * 2.0;
    
    // Convert from 0->2 to -1->+1 (clipspace)
    vec2 clipSpace = zeroToTwo - 1.0;
    
    // Invert Y axis for Canvas orientation
    gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
}
