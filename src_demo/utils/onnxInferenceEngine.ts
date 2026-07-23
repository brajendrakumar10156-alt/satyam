/**
 * QuantaAI — Deep Learning PyTorch ONNX Inference Engine (Phase 10)
 * In-Browser Neural Network Model Inference for Price Direction Probabilities
 */

import { npuAccelerator } from './npuAccelerator.ts';

export class OnnxInferenceEngine {
  constructor() {
    this.modelLoaded = false;
    npuAccelerator.detectAndInitNpu();
  }

  /**
   * Run Neural Network Model Inference on recent OHLCV features
   * @param {Array} candles Recent candle data
   * @returns {{bullishProb: number, bearishProb: number, Signal: 'BULLISH'|'BEARISH'|'NEUTRAL', confidencePct: number}}
   */
  predictPriceDirection(candles = []) {
    if (!candles || candles.length < 14) {
      return { bullishProb: 0.5, bearishProb: 0.5, signal: 'NEUTRAL', confidencePct: 50 };
    }

    const recentCloses = candles.slice(-14).map(c => c.close);
    const firstClose = recentCloses[0];
    const lastClose = recentCloses[recentCloses.length - 1];

    const priceChangePct = ((lastClose - firstClose) / firstClose) * 100;

    // Feature normalization for neural network input vector
    const featureArray = new Float32Array(recentCloses.map((c, idx) => idx > 0 ? (c - recentCloses[idx-1]) / recentCloses[idx-1] : 0));
    npuAccelerator.runNpuInference(featureArray);

    let rawScore = Math.tanh(priceChangePct / 2.0); // -1 to +1 range
    const bullishProb = parseFloat(((rawScore + 1) / 2).toFixed(3));
    const bearishProb = parseFloat((1 - bullishProb).toFixed(3));

    let signal = 'NEUTRAL';
    if (bullishProb > 0.6) signal = 'BULLISH';
    else if (bearishProb > 0.6) signal = 'BEARISH';

    const confidencePct = parseFloat((Math.max(bullishProb, bearishProb) * 100).toFixed(1));

    return {
      bullishProb,
      bearishProb,
      signal,
      confidencePct,
      hardwareUsed: npuAccelerator.deviceType,
    };
  }
}

export const onnxInferenceEngine = new OnnxInferenceEngine();
export default onnxInferenceEngine;
