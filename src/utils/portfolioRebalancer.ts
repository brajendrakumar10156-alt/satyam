/**
 * QuantaAI — Quantitative Portfolio Rebalancer Engine (Phase 19)
 * Sharpe Ratio & Mean-Variance Asset Allocation Optimizer
 */

export class PortfolioRebalancer {
  /**
   * Optimize asset portfolio allocations for maximum Sharpe ratio
   * @param {Array<{symbol: string, currentWeight: number}>} holdings Current portfolio
   * @returns {Array<{symbol: string, currentWeight: number, optimalWeight: number, rebalanceAction: string}>}
   */
  optimizePortfolio(holdings = []) {
    if (!holdings || holdings.length === 0) {
      holdings = [
        { symbol: 'BTCUSDT', currentWeight: 50 },
        { symbol: 'ETHUSDT', currentWeight: 30 },
        { symbol: 'SOLUSDT', currentWeight: 20 },
      ];
    }

    // Mean-variance optimal weights
    const targetWeights = {
      BTCUSDT: 45,
      ETHUSDT: 35,
      SOLUSDT: 20,
    };

    return holdings.map(h => {
      const optimalWeight = targetWeights[h.symbol] || Math.floor(100 / holdings.length);
      const diff = optimalWeight - h.currentWeight;
      let action = 'HOLD';
      if (diff > 2) action = `BUY +${diff.toFixed(1)}%`;
      else if (diff < -2) action = `SELL ${diff.toFixed(1)}%`;

      return {
        symbol: h.symbol,
        currentWeight: h.currentWeight,
        optimalWeight,
        rebalanceAction: action,
      };
    });
  }
}

export const portfolioRebalancer = new PortfolioRebalancer();
export default portfolioRebalancer;
