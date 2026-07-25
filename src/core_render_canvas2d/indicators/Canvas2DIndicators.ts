/**
 * QuantaAI - Canvas2D Native Indicator Engine
 * Fallback engine for devices without WebGPU/WebGL support.
 * Does manual translation on the CPU because Canvas2D lacks hardware shaders.
 */
export class Canvas2DIndicators {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: true });
    this.ready = true;
  }

  init() {
    this.ready = true;
    console.log('[Canvas2DIndicators] Engine initialized ✓');
    return true;
  }

  resize(width, height) {
    this.canvas.width = width;
    this.canvas.height = height;
  }

  render(indicatorsDataMap, viewportState) {
    if (!this.ready || !this.ctx) return;
    
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    const { width, height, minPrice, maxPrice, startIndex, endIndex } = viewportState;
    const priceSpread = maxPrice - minPrice;
    const visiblePoints = endIndex - startIndex;

    for (const [indId, data] of Object.entries(indicatorsDataMap)) {
      if (!data || !data.array || data.array.length === 0) continue;
      
      const arr = data.array;
      
      this.ctx.beginPath();
      this.ctx.strokeStyle = data.color || '#2962FF';
      this.ctx.lineWidth = data.thickness || 2.0;

      for (let i = 0; i < arr.length; i++) {
        // UNIVERSAL TRANSLATOR (CPU Bound for Canvas2D)
        const timeIndex = i;
        const price = arr[i];
        
        const x = ((timeIndex - startIndex) / visiblePoints) * width;
        
        let y = height / 2;
        if (priceSpread > 0) {
            // y goes top to bottom in Canvas (0 is top)
            y = height - (((price - minPrice) / priceSpread) * height);
        }
        
        // Only draw if it is roughly inside the screen bounds
        if (x >= -50 && x <= width + 50) {
           if (i === 0 || x < 0) {
               this.ctx.moveTo(x, y);
           } else {
               this.ctx.lineTo(x, y);
           }
        }
      }
      this.ctx.stroke();
    }
  }
}
