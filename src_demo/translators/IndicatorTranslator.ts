// IndicatorTranslator.ts
// Translates raw indicator array values (calculated by Rust/WASM or WebGPU)
// into formatted render buffers (Lines, Histograms) for Canvas2D, WebGL, or WebGPU.

import { wasmUniversalTranslator } from '../utils/wasmCompute';
import { dataStore } from '../store/DataTranslatorStore';

export class IndicatorTranslator {
  /**
   * Pre-processes raw indicator data into pixel arrays or specialized buffers
   * for the specific rendering engine currently active.
   */
  public static translateIndicatorsForRender(
    width: number, 
    height: number, 
    minTime: number,
    maxTime: number,
    minPrice: number,
    maxPrice: number,
    rawIndicatorData: Map<string, { time: number, value: number }[]>
  ) {
    // If we have WASM initialized, sync bounds
    if (wasmUniversalTranslator) {
      wasmUniversalTranslator.set_view_bounds(width, height, minPrice, maxPrice, minTime, maxTime);
    }

    const translatedBuffers = new Map<string, { x: number, y: number }[]>();

    // This loop bypasses expensive UI thread math by relying on Rust WASM
    // to map indicator (Time/Value) to (PixelX, PixelY) instantly.
    rawIndicatorData.forEach((dataPoints, indicatorId) => {
      if (dataPoints.length === 0) return;

      let rawTimes: number[] = [];
      let rawValues: number[] = [];

      for (let i = 0; i < dataPoints.length; i++) {
         rawTimes.push(dataPoints[i].time);
         rawValues.push(dataPoints[i].value);
      }

      if (rawTimes.length > 0 && wasmUniversalTranslator) {
        const timeArray = new Float64Array(rawTimes);
        const valArray = new Float32Array(rawValues);
        
        // Use Rust WASM for instant transformation
        const screenCoords = wasmUniversalTranslator.translate_to_screen_coords(valArray, timeArray);
        
        // Repackage for renderer consumption
        const pixelData = [];
        for (let i = 0; i < screenCoords.length; i += 2) {
          pixelData.push({ x: screenCoords[i], y: screenCoords[i+1] });
        }
        translatedBuffers.set(indicatorId, pixelData);
      } else {
        // Fallback or empty logic
        translatedBuffers.set(indicatorId, []);
      }
    });

    return translatedBuffers;
  }
}
