/**
 * UniversalTranslator.ts
 * 
 * Maps Financial Data (Time & Price) to Screen Coordinates (X & Y)
 * and normalizes them for WebGL/WebGPU (-1 to +1 space).
 * Ensures mathematical consistency across Canvas2D, WebGL, and WebGPU.
 */
export class UniversalTranslator {
    constructor() {
        this.width = 0;
        this.height = 0;
        this.minPrice = 0;
        this.maxPrice = 0;
        this.startIndex = 0;
        this.endIndex = 0;
        this.candleWidth = 0;
    }

    /**
     * Updates the current viewport state.
     */
    updateState(width, height, minPrice, maxPrice, startIndex, endIndex, candleWidth) {
        this.width = width;
        this.height = height;
        this.minPrice = minPrice;
        this.maxPrice = maxPrice;
        this.startIndex = startIndex;
        this.endIndex = endIndex;
        this.candleWidth = candleWidth;
    }

    /**
     * Converts a Price value to Screen Y Pixel.
     */
    priceToY(price) {
        const range = this.maxPrice - this.minPrice;
        if (range === 0) return this.height / 2;
        const normalized = (this.maxPrice - price) / range;
        return normalized * this.height;
    }

    /**
     * Converts a Time Index to Screen X Pixel.
     */
    indexToX(index) {
        return (index - this.startIndex) * this.candleWidth + (this.candleWidth / 2);
    }

    /**
     * Converts an array of Drawing Points [{timeIndex, price}] to raw pixel coordinates Float32Array.
     * Useful for raw WebGL/WebGPU buffers.
     * Format: [x1, y1, x2, y2, ...]
     */
    pointsToPixels(points) {
        const coords = new Float32Array(points.length * 2);
        for (let i = 0; i < points.length; i++) {
            coords[i * 2] = this.indexToX(points[i].timeIndex);
            coords[i * 2 + 1] = this.priceToY(points[i].price);
        }
        return coords;
    }

    /**
     * Converts Pixel coordinates to Normalized Device Coordinates (NDC) for WebGL/WebGPU.
     * NDC maps: X [0, width] -> [-1, 1]
     * NDC maps: Y [0, height] -> [1, -1]
     */
    pixelsToNDC(pixelsArray) {
        const ndc = new Float32Array(pixelsArray.length);
        for (let i = 0; i < pixelsArray.length; i += 2) {
            const x = pixelsArray[i];
            const y = pixelsArray[i + 1];
            ndc[i] = (x / this.width) * 2.0 - 1.0;
            ndc[i + 1] = (1.0 - (y / this.height)) * 2.0 - 1.0;
        }
        return ndc;
    }

    /**
     * Complete pipeline: Data -> NDC
     */
    pointsToNDC(points) {
        return this.pixelsToNDC(this.pointsToPixels(points));
    }
}
