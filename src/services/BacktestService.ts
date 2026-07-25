/**
 * BacktestService - Web App Integration for Rust Backtest Engine
 * 
 * Sends strategy parameters to Rust Server (Port 3030)
 * and receives instant strategy performance metrics.
 */

export interface BacktestParams {
  strategy: 'sma_crossover' | 'rsi_oversold';
  initialCapital: number;
  fastPeriod: number;
  slowPeriod: number;
}

export interface TradeResult {
  entry_time: number;
  exit_time: number;
  entry_price: number;
  exit_price: number;
  profit_loss: number;
  is_win: boolean;
}

export interface BacktestResponse {
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  win_rate_pct: number;
  initial_capital: number;
  final_capital: number;
  total_pnl_pct: number;
  max_drawdown_pct: number;
  trades: TradeResult[];
}

export class BacktestService {
  private static rustServerUrl = import.meta.env.VITE_RUST_SERVER_URL || "http://127.0.0.1:3030";

  public static async executeBacktest(params: BacktestParams): Promise<BacktestResponse | null> {
    try {
      const response = await fetch(`${this.rustServerUrl}/api/v1/backtest/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategy: params.strategy,
          initial_capital: params.initialCapital,
          fast_period: params.fastPeriod,
          slow_period: params.slowPeriod,
        }),
      });

      if (!response.ok) {
        throw new Error(`Backtest HTTP error: ${response.status}`);
      }

      return await response.json();
    } catch (err) {
      console.error('[BacktestService] Failed to execute backtest on Rust Server:', err);
      return null;
    }
  }
}
