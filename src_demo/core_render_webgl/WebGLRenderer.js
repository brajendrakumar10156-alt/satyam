/**
 * Native WebGL Render Driver
 * Zero third-party dependencies (No Three.js, No PixiJS).
 * Pure GLSL compilation and rendering.
 */

export class WebGLRenderer {
    constructor(canvasElement) {
        this.gl = canvasElement.getContext('webgl2') || canvasElement.getContext('webgl');
        if (!this.gl) throw new Error("WebGL not supported");
        
        this.program = null;
        this.positionBuffer = null;
    }

    async init() {
        const vsSource = await this.loadShaderFile('./vertex_shader.glsl');
        const fsSource = await this.loadShaderFile('./fragment_shader.glsl');

        const vertexShader = this.compileShader(this.gl.VERTEX_SHADER, vsSource);
        const fragmentShader = this.compileShader(this.gl.FRAGMENT_SHADER, fsSource);

        this.program = this.gl.createProgram();
        this.gl.attachShader(this.program, vertexShader);
        this.gl.attachShader(this.program, fragmentShader);
        this.gl.linkProgram(this.program);

        if (!this.gl.getProgramParameter(this.program, this.gl.LINK_STATUS)) {
            console.error("Unable to initialize the shader program: " + this.gl.getProgramInfoLog(this.program));
        }

        this.positionBuffer = this.gl.createBuffer();
        console.log("🚀 [WebGL] Native Renderer Initialized");
    }

    async loadShaderFile(url) {
        try {
            const res = await fetch(url);
            return await res.text();
        } catch(e) {
            console.error("Failed to load shader:", e);
            return "";
        }
    }

    compileShader(type, source) {
        const shader = this.gl.createShader(type);
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);
        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            console.error('An error occurred compiling the shaders: ' + this.gl.getShaderInfoLog(shader));
            this.gl.deleteShader(shader);
            return null;
        }
        return shader;
    }

    /**
     * Renders coordinates natively via WebGL Buffer
     * @param {Float32Array} screenCoords 
     */
    renderLines(screenCoords) {
        this.gl.useProgram(this.program);

        // Bind data
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, screenCoords, this.gl.STATIC_DRAW);

        // Set attributes
        const positionLocation = this.gl.getAttribLocation(this.program, "a_position");
        this.gl.enableVertexAttribArray(positionLocation);
        this.gl.vertexAttribPointer(positionLocation, 2, this.gl.FLOAT, false, 0, 0);

        // Set uniforms
        const resolutionLocation = this.gl.getUniformLocation(this.program, "u_resolution");
        this.gl.uniform2f(resolutionLocation, this.gl.canvas.width, this.gl.canvas.height);
        
        const colorLocation = this.gl.getUniformLocation(this.program, "u_color");
        this.gl.uniform4f(colorLocation, 0.0, 1.0, 0.0, 1.0); // Green

        // Draw
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);
        this.gl.drawArrays(this.gl.LINE_STRIP, 0, screenCoords.length / 2);
    }
}
