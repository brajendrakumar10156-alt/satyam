/**
 * Canvas 2D Native Rendering Engine
 * Fallback engine. Receives pre-calculated coordinates from Rust WASM 
 * and purely executes the CanvasRenderingContext2D API.
 */

export class Canvas2DRenderer {
    constructor(canvasElement) {
        this.ctx = canvasElement.getContext('2d', { alpha: false });
    }

    /**
     * Renders lines/candles natively via 2D Context.
     * @param {Float32Array} screenCoords - [x1, y1, x2, y2, ...]
     */
    renderLines(screenCoords) {
        this.ctx.beginPath();
        this.ctx.strokeStyle = '#00ff00';
        this.ctx.lineWidth = 1;

        for (let i = 0; i < screenCoords.length; i += 2) {
            const x = screenCoords[i];
            const y = screenCoords[i+1];
            
            if (i === 0) {
                this.ctx.moveTo(x, y);
            } else {
                this.ctx.lineTo(x, y);
            }
        }
        this.ctx.stroke();
    }
}
