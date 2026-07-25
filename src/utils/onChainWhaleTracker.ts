/**
 * QuantaAI — On-Chain Blockchain Whale Movement Tracker (Phase 18)
 * Monitors Large BTC, ETH & SOL Exchange Deposits & Withdrawals
 */

export class OnChainWhaleTracker {
  constructor() {
    this.alerts = [];
  }

  /**
   * Stream live simulated on-chain transactions
   * @param {Function} onAlert Callback for whale transfer alerts
   */
  startMonitoring(onAlert) {
    const coins = ['BTC', 'ETH', 'SOL', 'USDT'];
    const exchanges = ['Binance', 'Coinbase', 'OKX', 'Kraken'];

    const interval = setInterval(() => {
      const coin = coins[Math.floor(Math.random() * coins.length)];
      const amount = Math.floor(Math.random() * 5000) + 500;
      const usdVal = coin === 'BTC' ? amount * 65000 : coin === 'ETH' ? amount * 3500 : amount * 150;

      if (usdVal > 1000000) { // > $1 Million Transfer
        const fromEx = Math.random() > 0.5 ? 'Unknown Wallet' : exchanges[Math.floor(Math.random() * exchanges.length)];
        const toEx = exchanges[Math.floor(Math.random() * exchanges.length)];

        const alertData = {
          id: `WHALE-${Date.now()}`,
          coin,
          amount,
          usdValFormatted: `$${(usdVal / 1000000).toFixed(2)}M`,
          from: fromEx,
          to: toEx,
          time: new Date().toLocaleTimeString(),
        };

        this.alerts.unshift(alertData);
        if (onAlert) onAlert(alertData);
      }
    }, 8000); // Check every 8 seconds

    return () => clearInterval(interval);
  }
}

export const onChainWhaleTracker = new OnChainWhaleTracker();
export default onChainWhaleTracker;
