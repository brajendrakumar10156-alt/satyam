/**
 * WebGL Compute Driver
 * Acts as a highly parallelized fallback when WebGPU is not supported.
 * Encodes Float32Array into WebGL textures and calculates using Fragment Shaders.
 */

import glslCode from './math_compute.glsl?raw';

export class WebGLComputeDriver {
    gl: WebGLRenderingContext | WebGL2RenderingContext | null;
    program: WebGLProgram | null;
    textureSize: number;

    constructor() {
        this.gl = null;
        this.program = null;
        this.textureSize = 4096; // Support up to 16.7M candles
    }

    async init() {
        const canvas = document.createElement('canvas');
        canvas.width = this.textureSize;
        canvas.height = this.textureSize;
        
        // Try WebGL2 first for better float texture support
        this.gl = canvas.getContext('webgl2', { antialias: false, depth: false }) as WebGL2RenderingContext;
        if (!this.gl) {
            this.gl = canvas.getContext('webgl', { antialias: false, depth: false }) as WebGLRenderingContext;
            if (!this.gl) throw new Error("WebGL is not supported in this browser.");
            const ext = this.gl.getExtension('OES_texture_float');
            if (!ext) throw new Error("OES_texture_float not supported. Cannot use WebGL for Math.");
        } else {
            this.gl.getExtension('EXT_color_buffer_float');
        }

        const gl = this.gl;

        // Compile Vertex Shader (Full Screen Quad)
        const vsCode = `
            attribute vec2 a_position;
            varying vec2 v_texCoord;
            void main() {
                gl_Position = vec4(a_position, 0.0, 1.0);
                v_texCoord = a_position * 0.5 + 0.5;
            }
        `;
        const vs = gl.createShader(gl.VERTEX_SHADER);
        if (!vs) throw new Error("Failed to create vertex shader");
        gl.shaderSource(vs, vsCode);
        gl.compileShader(vs);

        // Compile Fragment Shader (Math Logic)
        const fs = gl.createShader(gl.FRAGMENT_SHADER);
        if (!fs) throw new Error("Failed to create fragment shader");
        gl.shaderSource(fs, glslCode);
        gl.compileShader(fs);

        if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
            console.error(gl.getShaderInfoLog(fs));
            throw new Error("GLSL Compile Error");
        }

        this.program = gl.createProgram();
        if (!this.program) throw new Error("Failed to create WebGL program");
        gl.attachShader(this.program, vs);
        gl.attachShader(this.program, fs);
        gl.linkProgram(this.program);

        gl.useProgram(this.program);

        // Setup Quad Geometry
        const positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        const positions = new Float32Array([
            -1, -1,
             1, -1,
            -1,  1,
            -1,  1,
             1, -1,
             1,  1,
        ]);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

        const posLoc = gl.getAttribLocation(this.program, "a_position");
        gl.enableVertexAttribArray(posLoc);
        gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
        
        console.log("?? [WebGL] Legacy GPU Math Driver Initialized!");
    }

    async calculate(indicator: string, data: Float32Array, period: number): Promise<Float32Array> {
        if (!this.gl || !this.program) throw new Error("WebGL Driver not initialized");
        const gl = this.gl;

        let indId = 0;
        if (indicator === 'SMA') indId = 0;
        else if (indicator === 'RSI') indId = 1;
        else if (indicator === 'MACD') indId = 2;

        const totalCandles = data.length;
        const width = this.textureSize;
        const height = Math.ceil(totalCandles / width);

        // 1. Create Input Texture from Float32Array
        // We need an RGBA buffer where R = data, G = 0, B = 0, A = 1 because some WebGL1 setups only support RGBA floats
        const texData = new Float32Array(width * height * 4);
        for(let i=0; i<totalCandles; i++) {
            texData[i * 4] = data[i]; // R
            texData[i * 4 + 3] = 1.0; // A
        }

        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        
        // Disable filtering for exact data mapping
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        const internalFormat = (gl instanceof WebGL2RenderingContext) ? (gl as any).RGBA32F : gl.RGBA;
        gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, width, height, 0, gl.RGBA, gl.FLOAT, texData);

        // 2. Setup Framebuffer to render into
        const fb = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
        
        const targetTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, targetTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, width, height, 0, gl.RGBA, gl.FLOAT, null);
        
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, targetTexture, 0);

        // 3. Set Uniforms and Draw
        gl.viewport(0, 0, width, height);
        gl.useProgram(this.program);
        
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.uniform1i(gl.getUniformLocation(this.program, "u_dataTexture"), 0);
        gl.uniform1i(gl.getUniformLocation(this.program, "u_totalCandles"), totalCandles);
        gl.uniform1i(gl.getUniformLocation(this.program, "u_period"), period);
        gl.uniform1i(gl.getUniformLocation(this.program, "u_indicator"), indId);

        gl.drawArrays(gl.TRIANGLES, 0, 6);

        // 4. Read Pixels Back
        const resultPixels = new Float32Array(width * height * 4);
        gl.readPixels(0, 0, width, height, gl.RGBA, gl.FLOAT, resultPixels);

        // Cleanup
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.deleteFramebuffer(fb);
        gl.deleteTexture(texture);
        gl.deleteTexture(targetTexture);

        // Extract R channel
        const output = new Float32Array(totalCandles);
        for (let i = 0; i < totalCandles; i++) {
            output[i] = resultPixels[i * 4];
        }

        return output;
    }
}
