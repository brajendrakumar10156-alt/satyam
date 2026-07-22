/**
 * Canvas2DDrawings.js
 * 
 * Native Canvas 2D implementation of Drawing Tools.
 * Replaces Pixi.js for pure native performance.
 */
import { UniversalTranslator } from '../core_render_shared/UniversalTranslator.js';

export class Canvas2DDrawings {
    constructor(canvasElement) {
        this.canvas = canvasElement;
        this.ctx = this.canvas.getContext('2d', { alpha: true, desynchronized: true });
        this.translator = new UniversalTranslator();
    }

    resize(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;
    }

    /**
     * Renders all drawings natively
     */
    render(drawings, viewportState) {
        this.translator.updateState(
            viewportState.width, viewportState.height,
            viewportState.minPrice, viewportState.maxPrice,
            viewportState.startIndex, viewportState.endIndex,
            viewportState.candleWidth
        );

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        for (const drawing of drawings) {
            this.drawShape(drawing);
        }
    }

    drawShape(drawing) {
        if (drawing.type === 'trendline') {
            const pixels = this.translator.pointsToPixels([drawing.start, drawing.end]);
            this.ctx.beginPath();
            this.ctx.moveTo(pixels[0], pixels[1]);
            this.ctx.lineTo(pixels[2], pixels[3]);
            this.ctx.strokeStyle = drawing.color || '#2962FF';
            this.ctx.lineWidth = drawing.thickness || 2;
            this.ctx.stroke();
        } else if (drawing.type === 'rectangle') {
            const pixels = this.translator.pointsToPixels([drawing.start, drawing.end]);
            const x = Math.min(pixels[0], pixels[2]);
            const y = Math.min(pixels[1], pixels[3]);
            const w = Math.abs(pixels[2] - pixels[0]);
            const h = Math.abs(pixels[3] - pixels[1]);

            this.ctx.fillStyle = drawing.fillColor || 'rgba(41, 98, 255, 0.2)';
            this.ctx.fillRect(x, y, w, h);
            
            this.ctx.strokeStyle = drawing.color || '#2962FF';
            this.ctx.lineWidth = drawing.thickness || 1;
            this.ctx.strokeRect(x, y, w, h);
        }
    }
}
