/**
 * WebGLDrawings.ts
 * 
 * Native WebGL implementation of Drawing Tools.
 * Uses UniversalTranslator for Normalized Device Coordinates (NDC) mapping.
 */
import { UniversalTranslator } from '../../core_render_shared/UniversalTranslator';
import VS_SOURCE from '../shaders/drawing_vertex.glsl?raw';
import FS_SOURCE from '../shaders/drawing_fragment.glsl?raw';

export class WebGLDrawings {
    constructor(canvasElement) {
        this.canvas = canvasElement;
        this.gl = this.canvas.getContext('webgl2', { antialias: true, alpha: true }) || 
                  this.canvas.getContext('webgl', { antialias: true, alpha: true });
        this.translator = new UniversalTranslator();
        
        if (this.gl) this.initShaders();
    }

    initShaders() {
        const gl = this.gl;
        
        const vertexShader = this.compileShader(gl, gl.VERTEX_SHADER, VS_SOURCE);
        const fragmentShader = this.compileShader(gl, gl.FRAGMENT_SHADER, FS_SOURCE);
        
        this.program = gl.createProgram();
        gl.attachShader(this.program, vertexShader);
        gl.attachShader(this.program, fragmentShader);
        gl.linkProgram(this.program);
        
        if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
            console.error('WebGL Program Link Error:', gl.getProgramInfoLog(this.program));
        }

        this.positionLocation = gl.getAttribLocation(this.program, "a_position");
        this.colorLocation = gl.getUniformLocation(this.program, "u_color");

        this.positionBuffer = gl.createBuffer();
    }

    compileShader(gl, type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('WebGL Shader Compile Error:', gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    }

    hexToVec4(hexStr, alpha = 1.0) {
        // e.g. #2962FF
        const hex = hexStr.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16) / 255.0;
        const g = parseInt(hex.substring(2, 4), 16) / 255.0;
        const b = parseInt(hex.substring(4, 6), 16) / 255.0;
        return [r, g, b, alpha];
    }

    resize(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;
        if (this.gl) this.gl.viewport(0, 0, width, height);
    }

    render(drawings, viewportState) {
        if (!this.gl) return;
        const gl = this.gl;

        this.translator.updateState(
            viewportState.width, viewportState.height,
            viewportState.minPrice, viewportState.maxPrice,
            viewportState.startIndex, viewportState.endIndex,
            viewportState.candleWidth
        );

        gl.clearColor(0, 0, 0, 0); // Transparent background
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.useProgram(this.program);
        gl.enableVertexAttribArray(this.positionLocation);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.vertexAttribPointer(this.positionLocation, 2, gl.FLOAT, false, 0, 0);

        // Blending for transparency (like fill colors)
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        for (const drawing of drawings) {
            this.drawShape(gl, drawing);
        }
    }

    drawShape(gl, drawing) {
        if (drawing.type === 'trendline') {
            const ndc = this.translator.pointsToNDC([drawing.start, drawing.end]);
            
            gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, ndc, gl.DYNAMIC_DRAW);
            
            const color = this.hexToVec4(drawing.color || '#2962FF', 1.0);
            gl.uniform4fv(this.colorLocation, color);
            
            gl.lineWidth(drawing.thickness || 2);
            gl.drawArrays(gl.LINES, 0, 2);
        } else if (drawing.type === 'rectangle') {
            // NDC coordinates
            const p1 = this.translator.pointsToNDC([drawing.start])[0]; // x1, y1
            const x1 = p1, y1 = this.translator.pointsToNDC([drawing.start])[1];
            const x2 = this.translator.pointsToNDC([drawing.end])[0];
            const y2 = this.translator.pointsToNDC([drawing.end])[1];

            // 4 vertices of the rectangle
            const rectNdc = new Float32Array([
                x1, y1,
                x2, y1,
                x1, y2,
                x2, y2
            ]);

            gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, rectNdc, gl.DYNAMIC_DRAW);

            // Fill
            const fillCol = drawing.fillColor ? this.extractRgba(drawing.fillColor) : [0.16, 0.38, 1.0, 0.2];
            gl.uniform4fv(this.colorLocation, fillCol);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

            // Outline (Line Loop)
            const outlineNdc = new Float32Array([
                x1, y1, x2, y1,
                x2, y1, x2, y2,
                x2, y2, x1, y2,
                x1, y2, x1, y1
            ]);
            gl.bufferData(gl.ARRAY_BUFFER, outlineNdc, gl.DYNAMIC_DRAW);
            const edgeCol = this.hexToVec4(drawing.color || '#2962FF', 1.0);
            gl.uniform4fv(this.colorLocation, edgeCol);
            gl.lineWidth(drawing.thickness || 1);
            gl.drawArrays(gl.LINES, 0, 8);
        }
    }

    extractRgba(rgbaStr) {
        // e.g. "rgba(41, 98, 255, 0.2)"
        const match = rgbaStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
        if (match) {
            return [
                parseInt(match[1]) / 255,
                parseInt(match[2]) / 255,
                parseInt(match[3]) / 255,
                match[4] ? parseFloat(match[4]) : 1.0
            ];
        }
        return [0,0,0,1];
    }
}
