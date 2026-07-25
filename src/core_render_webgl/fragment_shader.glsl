// WebGL Native Fragment Shader
// Outputs color to the screen at 144+ FPS
precision mediump float;
uniform vec4 u_color;

void main() {
    gl_FragColor = u_color;
}
