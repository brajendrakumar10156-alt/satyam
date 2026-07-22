use serde::Serialize;
use std::time::Instant;

#[derive(Serialize)]
pub struct ArbitrageResult {
    pub buy_local_sell_binance: Vec<f64>,
    pub buy_binance_sell_local: Vec<f64>,
    pub computation_time_ns: u128,
}

pub fn calculate_arbitrage_matrix(
    exchange_a_prices: &[f64],
    exchange_b_prices: &[f64],
    min_spread_pct: f64,
) -> ArbitrageResult {
    let start = Instant::now();
    let n = exchange_a_prices.len().min(exchange_b_prices.len());
    
    let mut buy_a_spreads = Vec::with_capacity(n / 100);
    let mut buy_b_spreads = Vec::with_capacity(n / 100);
    
    // Rust will automatically vectorize this loop using SIMD instructions
    // at compile time if optimization is enabled (e.g., release profile).
    for i in 0..n {
        let price_a = exchange_a_prices[i];
        let price_b = exchange_b_prices[i];
        
        if price_a > 0.0 && price_b > 0.0 {
            // Check Buy Exchange A, Sell Exchange B
            let spread_a = (price_b - price_a) / price_a;
            if spread_a >= min_spread_pct {
                buy_a_spreads.push(spread_a);
            }
            
            // Check Buy Exchange B, Sell Exchange A
            let spread_b = (price_a - price_b) / price_b;
            if spread_b >= min_spread_pct {
                buy_b_spreads.push(spread_b);
            }
        }
    }
    
    let duration = start.elapsed();
    
    ArbitrageResult {
        buy_local_sell_binance: buy_a_spreads,
        buy_binance_sell_local: buy_b_spreads,
        computation_time_ns: duration.as_nanos(),
    }
}
