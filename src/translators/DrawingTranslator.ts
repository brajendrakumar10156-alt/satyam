// DrawingTranslator.ts
// Bridges universal Time/Price coordinates of Drawings into native formats 
// for Canvas2D, WebGL, and WebGPU. Leverages Rust WASM for math speed.

import { wasmUniversalTranslator } from '../utils/wasmCompute';
import { dataStore } from '../store/DataTranslatorStore';

export class DrawingTranslator {
  /**
   * Pre-processes all drawings in the DataStore to pixel coordinates
   * so rendering engines (Canvas/WebGL/WebGPU) don't have to do the math.
   * This offloads CPU math from the rendering loop directly into Rust WASM!
   */
  public static translateDrawingsForRender(
    width: number, 
    height: number, 
    minTime: number,
    maxTime: number,
    minPrice: number,
    maxPrice: number
  ) {
    const drawings = dataStore.drawings;
    if (!drawings || drawings.length === 0) return [];
    
    // FAST PATH: If WASM is loaded, we use the Rust Binary
    if (wasmUniversalTranslator) {
      wasmUniversalTranslator.set_view_bounds(width, height, minPrice, maxPrice, minTime, maxTime);
    }

    return drawings.map(d => {
      const translated = { ...d, renderPaths: [] };

      // We extract all (Time, Price) tuples for this drawing
      let rawTimes: number[] = [];
      let rawPrices: number[] = [];
      
      if (d.start && d.start.time) {
        rawTimes.push(d.start.time);
        rawPrices.push(d.start.price);
      }
      if (d.end && d.end.time) {
        rawTimes.push(d.end.time);
        rawPrices.push(d.end.price);
      }
      if (d.points && d.points.length > 0) {
        d.points.forEach(pt => {
          rawTimes.push(pt.time);
          rawPrices.push(pt.price);
        });
      }

      if (rawTimes.length > 0 && wasmUniversalTranslator) {
        // Feed Float64/Float32 arrays straight into WASM memory!
        const timeArray = new Float64Array(rawTimes);
        const priceArray = new Float32Array(rawPrices);
        
        // C++ / Rust instantly computes everything and returns interleaved X/Y Array
        const screenCoords = wasmUniversalTranslator.translate_to_screen_coords(priceArray, timeArray);
        
        // Unpack interleaved X/Y back to JS layout
        let coordIdx = 0;
        if (d.start && d.start.time) {
          translated.pixelStart = { x: screenCoords[coordIdx++], y: screenCoords[coordIdx++] };
        }
        if (d.end && d.end.time) {
          translated.pixelEnd = { x: screenCoords[coordIdx++], y: screenCoords[coordIdx++] };
        }
        if (d.points && d.points.length > 0) {
          translated.pixelPoints = [];
          for (let i = 0; i < d.points.length; i++) {
            translated.pixelPoints.push({ x: screenCoords[coordIdx++], y: screenCoords[coordIdx++] });
          }
        }
      }

      return translated;
    });
  }
}

