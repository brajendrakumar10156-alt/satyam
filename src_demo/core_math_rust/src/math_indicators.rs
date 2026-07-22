use wasm_bindgen::prelude::*;

/// Pure Rust CPU Math Engine
/// Extremely fast sequential mathematical calculations via WASM.
/// Used when dataset is small or GPU is overloaded.

#[wasm_bindgen]
pub struct CPUMathEngine;

#[wasm_bindgen]
impl CPUMathEngine {
    /// Calculates Simple Moving Average natively on CPU
    #[wasm_bindgen]
    pub fn calculate_sma(prices: &[f32], period: usize) -> Vec<f32> {
        let mut result = vec![0.0; prices.len()];
        
        if prices.len() < period || period == 0 {
            return result;
        }

        let mut sum: f32 = prices[0..period].iter().sum();
        result[period - 1] = sum / period as f32;

        for i in period..prices.len() {
            sum += prices[i] - prices[i - period];
            result[i] = sum / period as f32;
        }
        
        result
    }

    /// Calculates Exponential Moving Average natively on CPU
    #[wasm_bindgen]
    pub fn calculate_ema(prices: &[f32], period: usize) -> Vec<f32> {
        let mut result = vec![0.0; prices.len()];
        if prices.is_empty() || period == 0 {
            return result;
        }

        let multiplier = 2.0 / (period as f32 + 1.0);
        result[0] = prices[0];

        for i in 1..prices.len() {
            result[i] = (prices[i] - result[i - 1]) * multiplier + result[i - 1];
        }

        result
    }
}
