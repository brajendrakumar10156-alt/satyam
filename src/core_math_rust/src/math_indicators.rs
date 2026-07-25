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
        
        let mut sum = 0.0;
        for i in 0..period {
            sum += prices[i];
        }
        result[period - 1] = sum / period as f32;

        for i in period..prices.len() {
            result[i] = (prices[i] - result[i - 1]) * multiplier + result[i - 1];
        }

        result
    }

    /// Calculates Relative Strength Index (RSI) natively on CPU
    #[wasm_bindgen]
    pub fn calculate_rsi(prices: &[f32], period: usize) -> Vec<f32> {
        let mut result = vec![0.0; prices.len()];
        if prices.len() <= period || period == 0 {
            return result;
        }

        let mut gains = 0.0;
        let mut losses = 0.0;

        for i in 1..=period {
            let diff = prices[i] - prices[i - 1];
            if diff > 0.0 {
                gains += diff;
            } else {
                losses -= diff;
            }
        }

        let mut avg_gain = gains / period as f32;
        let mut avg_loss = losses / period as f32;

        if avg_loss == 0.0 {
            result[period] = 100.0;
        } else if avg_gain == 0.0 {
            result[period] = 0.0;
        } else {
            let rs = avg_gain / avg_loss;
            result[period] = 100.0 - (100.0 / (1.0 + rs));
        }

        for i in (period + 1)..prices.len() {
            let diff = prices[i] - prices[i - 1];
            let gain = if diff > 0.0 { diff } else { 0.0 };
            let loss = if diff < 0.0 { -diff } else { 0.0 };

            avg_gain = (avg_gain * (period as f32 - 1.0) + gain) / period as f32;
            avg_loss = (avg_loss * (period as f32 - 1.0) + loss) / period as f32;

            if avg_loss == 0.0 {
                result[i] = 100.0;
            } else if avg_gain == 0.0 {
                result[i] = 0.0;
            } else {
                let rs = avg_gain / avg_loss;
                result[i] = 100.0 - (100.0 / (1.0 + rs));
            }
        }
        result
    }

    /// Calculates Bollinger Bands natively on CPU
    /// Returns interleaved array: [upper0, middle0, lower0, upper1, middle1, lower1, ...]
    #[wasm_bindgen]
    pub fn calculate_bb(prices: &[f32], period: usize, std_dev_multiplier: f32) -> Vec<f32> {
        let mut result = vec![0.0; prices.len() * 3];
        if prices.len() < period || period == 0 {
            return result;
        }

        for i in (period - 1)..prices.len() {
            let mut sum = 0.0;
            for j in (i + 1 - period)..=i {
                sum += prices[j];
            }
            let ma = sum / period as f32;

            let mut variance_sum = 0.0;
            for j in (i + 1 - period)..=i {
                let diff = prices[j] - ma;
                variance_sum += diff * diff;
            }
            let std_dev = (variance_sum / period as f32).sqrt();

            let upper = ma + std_dev_multiplier * std_dev;
            let lower = ma - std_dev_multiplier * std_dev;

            let base_idx = i * 3;
            result[base_idx] = upper;
            result[base_idx + 1] = ma;
            result[base_idx + 2] = lower;
        }
        result
    }

    /// Calculates MACD natively on CPU
    /// Returns interleaved array: [macd0, signal0, hist0, macd1, signal1, hist1, ...]
    #[wasm_bindgen]
    pub fn calculate_macd(prices: &[f32], fast_period: usize, slow_period: usize, signal_period: usize) -> Vec<f32> {
        let mut result = vec![0.0; prices.len() * 3];
        if prices.len() <= slow_period + signal_period {
            return result;
        }

        let fast_ema = Self::calculate_ema(prices, fast_period);
        let slow_ema = Self::calculate_ema(prices, slow_period);
        
        let mut macd_line = vec![0.0; prices.len()];
        for i in (slow_period - 1)..prices.len() {
            macd_line[i] = fast_ema[i] - slow_ema[i];
        }

        let signal_start = (slow_period - 1) + (signal_period - 1);
        let mut signal_line = vec![0.0; prices.len()];
        
        let mut sum = 0.0;
        for i in (slow_period - 1)..(slow_period - 1 + signal_period) {
            sum += macd_line[i];
        }
        signal_line[signal_start] = sum / signal_period as f32;

        let multiplier = 2.0 / (signal_period as f32 + 1.0);
        for i in (signal_start + 1)..prices.len() {
            signal_line[i] = (macd_line[i] - signal_line[i - 1]) * multiplier + signal_line[i - 1];
        }

        for i in signal_start..prices.len() {
            let macd_val = macd_line[i];
            let signal_val = signal_line[i];
            let hist_val = macd_val - signal_val;

            let base_idx = i * 3;
            result[base_idx] = macd_val;
            result[base_idx + 1] = signal_val;
            result[base_idx + 2] = hist_val;
        }

        result
    }
}
