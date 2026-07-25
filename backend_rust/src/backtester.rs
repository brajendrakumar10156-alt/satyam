use crate::binary_translator::BinaryCandle;
use crate::indicators::{calculate_rsi, calculate_sma};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct BacktestRequest {
    pub strategy: String, // "rsi_crossover", "sma_crossover"
    pub initial_capital: f32,
    pub fast_period: usize,
    pub slow_period: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Trade {
    pub entry_time: f32,
    pub exit_time: f32,
    pub entry_price: f32,
    pub exit_price: f32,
    pub profit_loss: f32,
    pub is_win: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BacktestResult {
    pub total_trades: usize,
    pub winning_trades: usize,
    pub losing_trades: usize,
    pub win_rate_pct: f32,
    pub initial_capital: f32,
    pub final_capital: f32,
    pub total_pnl_pct: f32,
    pub max_drawdown_pct: f32,
    pub trades: Vec<Trade>,
}

pub fn run_backtest(candles: &[BinaryCandle], req: &BacktestRequest) -> BacktestResult {
    if candles.len() < req.slow_period + 10 {
        return BacktestResult {
            total_trades: 0,
            winning_trades: 0,
            losing_trades: 0,
            win_rate_pct: 0.0,
            initial_capital: req.initial_capital,
            final_capital: req.initial_capital,
            total_pnl_pct: 0.0,
            max_drawdown_pct: 0.0,
            trades: vec![],
        };
    }

    let prices: Vec<f32> = candles.iter().map(|c| c.close).collect();
    let fast_sma = calculate_sma(&prices, req.fast_period);
    let slow_sma = calculate_sma(&prices, req.slow_period);
    let rsi = calculate_rsi(&prices, 14);

    let mut capital = req.initial_capital;
    let mut peak_capital = capital;
    let mut max_drawdown = 0.0f32;
    let mut position: Option<(f32, f32)> = None; // (entry_price, entry_time)
    let mut trades: Vec<Trade> = Vec::new();

    let offset = req.slow_period;

    for i in 1..slow_sma.len() {
        let candle_idx = offset + i;
        if candle_idx >= candles.len() { break; }

        let current_candle = &candles[candle_idx];
        let price = current_candle.close;

        // Buy Condition: Fast SMA crosses above Slow SMA OR RSI < 30
        let buy_signal = match req.strategy.as_str() {
            "rsi_oversold" => {
                let rsi_idx = candle_idx.saturating_sub(14);
                rsi_idx < rsi.len() && rsi[rsi_idx] < 30.0
            },
            _ => { // default sma_crossover
                fast_sma[i] > slow_sma[i] && fast_sma[i - 1] <= slow_sma[i - 1]
            }
        };

        // Sell Condition: Fast SMA crosses below Slow SMA OR RSI > 70
        let sell_signal = match req.strategy.as_str() {
            "rsi_oversold" => {
                let rsi_idx = candle_idx.saturating_sub(14);
                rsi_idx < rsi.len() && rsi[rsi_idx] > 70.0
            },
            _ => { // default sma_crossover
                fast_sma[i] < slow_sma[i] && fast_sma[i - 1] >= slow_sma[i - 1]
            }
        };

        if let Some((entry_price, entry_time)) = position {
            if sell_signal {
                let pnl = price - entry_price;
                let is_win = pnl > 0.0;
                let return_pct = pnl / entry_price;
                capital *= 1.0 + return_pct;

                if capital > peak_capital {
                    peak_capital = capital;
                } else {
                    let dd = (peak_capital - capital) / peak_capital * 100.0;
                    if dd > max_drawdown { max_drawdown = dd; }
                }

                trades.push(Trade {
                    entry_time,
                    exit_time: current_candle.time as f32,
                    entry_price,
                    exit_price: price,
                    profit_loss: pnl,
                    is_win,
                });
                position = None;
            }
        } else if buy_signal {
            position = Some((price, current_candle.time as f32));
        }
    }

    let winning_trades = trades.iter().filter(|t| t.is_win).count();
    let total_trades = trades.len();
    let losing_trades = total_trades - winning_trades;
    let win_rate_pct = if total_trades > 0 { (winning_trades as f32 / total_trades as f32) * 100.0 } else { 0.0 };
    let total_pnl_pct = ((capital - req.initial_capital) / req.initial_capital) * 100.0;

    BacktestResult {
        total_trades,
        winning_trades,
        losing_trades,
        win_rate_pct,
        initial_capital: req.initial_capital,
        final_capital: capital,
        total_pnl_pct,
        max_drawdown_pct: max_drawdown,
        trades,
    }
}
