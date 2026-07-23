/**
 * QuantaAI — Options Volatility Surface & Greeks Engine (Phase 11)
 * Black-Scholes Formula & Volatility Surface Model
 */

export class OptionsGreeksEngine {
  /**
   * Calculate Black-Scholes Option Price and Greeks (Delta, Gamma, Vega, Theta)
   * @param {number} S Spot price
   * @param {number} K Strike price
   * @param {number} T Time to expiry in years (e.g. 30/365)
   * @param {number} r Risk-free interest rate (e.g. 0.05)
   * @param {number} sigma Volatility (e.g. 0.50 = 50%)
   * @param {'call'|'put'} type Option type
   */
  calculateGreeks(S, K, T = 30 / 365, r = 0.05, sigma = 0.50, type = 'call') {
    if (S <= 0 || K <= 0 || T <= 0 || sigma <= 0) {
      return { price: 0, delta: 0, gamma: 0, vega: 0, theta: 0 };
    }

    const d1 = (Math.log(S / K) + (r + (sigma * sigma) / 2) * T) / (sigma * Math.sqrt(T));
    const d2 = d1 - sigma * Math.sqrt(T);

    const cnd = (x) => 0.5 * (1 + this._erf(x / Math.sqrt(2)));
    const pdf = (x) => (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * x * x);

    let price = 0;
    let delta = 0;

    if (type === 'call') {
      price = S * cnd(d1) - K * Math.exp(-r * T) * cnd(d2);
      delta = cnd(d1);
    } else {
      price = K * Math.exp(-r * T) * cnd(-d2) - S * cnd(-d1);
      delta = cnd(d1) - 1;
    }

    const gamma = pdf(d1) / (S * sigma * Math.sqrt(T));
    const vega = (S * pdf(d1) * Math.sqrt(T)) / 100;
    const theta = (-(S * pdf(d1) * sigma) / (2 * Math.sqrt(T)) - r * K * Math.exp(-r * T) * cnd(d2)) / 365;

    return {
      price: parseFloat(price.toFixed(2)),
      delta: parseFloat(delta.toFixed(4)),
      gamma: parseFloat(gamma.toFixed(6)),
      vega: parseFloat(vega.toFixed(4)),
      theta: parseFloat(theta.toFixed(4)),
    };
  }

  _erf(x) {
    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x);
    const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
    return sign * y;
  }
}

export const optionsGreeksEngine = new OptionsGreeksEngine();
export default optionsGreeksEngine;
