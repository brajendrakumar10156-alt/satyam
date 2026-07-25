import vertShaderCode from '../shaders/indicator_vert.glsl?raw';
import fragShaderCode from '../shaders/indicator_frag.glsl?raw';

/**
 * QuantaAI - WebGL Native Indicator Engine
 * Hardware-accelerated fallback for WebGPU, featuring native Universal Translation in GLSL.
 */
export class WebGLIndicators {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = this.canvas.getContext('webgl', { antialias: true, alpha: true, premultipliedAlpha: true });
    this.program = null;
    this.ready = false;
    
    // Uniform locations
    this.uResolution = null;
    this.uPriceRange = null;
    this.uTimeRange = null;
    this.uColor = null;
  }

  async init() {
    if (!this.gl) return false;

    // Compile Shaders
    const vs = this.gl.createShader(this.gl.VERTEX_SHADER);
    this.gl.shaderSource(vs, vertShaderCode);
    this.gl.compileShader(vs);
    if (!this.gl.getShaderParameter(vs, this.gl.COMPILE_STATUS)) {
        console.error('WebGL VS Error:', this.gl.getShaderInfoLog(vs));
        return false;
    }

    const fs = this.gl.createShader(this.gl.FRAGMENT_SHADER);
    this.gl.shaderSource(fs, fragShaderCode);
    this.gl.compileShader(fs);

    // Create Program
    this.program = this.gl.createProgram();
    this.gl.attachShader(this.program, vs);
    this.gl.attachShader(this.program, fs);
    this.gl.linkProgram(this.program);

    this.gl.useProgram(this.program);

    // Cache Uniform Locations
    this.uResolution = this.gl.getUniformLocation(this.program, 'uResolution');
    this.uPriceRange = this.gl.getUniformLocation(this.program, 'uPriceRange');
    this.uTimeRange = this.gl.getUniformLocation(this.program, 'uTimeRange');
    this.uColor = this.gl.getUniformLocation(this.program, 'uColor');

    // Setup generic buffer
    this.buffer = this.gl.createBuffer();
    
    this.ready = true;
    console.log('[WebGLIndicators] Hardware Engine initialized ✓');
    return true;
  }

  resize(width, height) {
    this.canvas.width = width;
    this.canvas.height = height;
    if (this.gl) this.gl.viewport(0, 0, width, height);
  }

  hexToRgbA(hex, alpha = 1) {
    let c;
    if(/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)){
        c= hex.substring(1).split('');
        if(c.length== 3){
            c= [c[0], c[0], c[1], c[1], c[2], c[2]];
        }
        c= '0x'+c.join('');
        return [(c>>16)&255, (c>>8)&255, c&255, alpha];
    }
    return [41, 98, 255, alpha]; // Default Blue
  }

  render(indicatorsDataMap, viewportState) {
    if (!this.ready) return;
    
    this.gl.clearColor(0.0, 0.0, 0.0, 0.0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);

    this.gl.useProgram(this.program);
    
    // Inject Universal Translation Uniforms (The GLSL Vertex Shader does the actual translating)
    this.gl.uniform2f(this.uResolution, viewportState.width, viewportState.height);
    this.gl.uniform2f(this.uPriceRange, viewportState.minPrice, viewportState.maxPrice);
    this.gl.uniform2f(this.uTimeRange, viewportState.startIndex, viewportState.endIndex);

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffer);
    const aPosition = this.gl.getAttribLocation(this.program, 'aPosition');
    this.gl.enableVertexAttribArray(aPosition);
    this.gl.vertexAttribPointer(aPosition, 2, this.gl.FLOAT, false, 0, 0);

    for (const [indId, data] of Object.entries(indicatorsDataMap)) {
      if (!data || !data.array || data.array.length === 0) continue;
      
      const arr = data.array; // array of prices
      
      // We pass the raw data (timeIndex, price) to GPU. 
      const vertexData = new Float32Array(arr.length * 2);
      for(let i=0; i<arr.length; i++) {
         vertexData[i*2] = i; // timeIndex
         vertexData[i*2+1] = arr[i]; // price
      }
      
      this.gl.bufferData(this.gl.ARRAY_BUFFER, vertexData, this.gl.DYNAMIC_DRAW);

      // Extract Color from config
      const color = this.hexToRgbA(data.color || '#2962FF', 1.0);
      this.gl.uniform4f(this.uColor, color[0]/255, color[1]/255, color[2]/255, color[3]);
      
      this.gl.lineWidth(data.thickness || 2.0); // Note: Core profile WebGL might ignore this, but it works on many devices
      this.gl.drawArrays(this.gl.LINE_STRIP, 0, arr.length);
    }
  }
}
