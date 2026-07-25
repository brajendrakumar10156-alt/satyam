use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct IndicatorResult {
    pub name: String,
    pub values: Vec<f32>,
}

/// Calculate Simple Moving Average (SMA)
pub fn calculate_sma(data: &[f32], period: usize) -> Vec<f32> {
    if data.len() < period || period == 0 {
        return vec![];
    }
    let mut result = Vec::with_capacity(data.len() - period + 1);
    let mut window_sum: f32 = data[..period].iter().sum();
    result.push(window_sum / period as f32);

    for i in period..data.len() {
        window_sum += data[i] - data[i - period];
        result.push(window_sum / period as f32);
    }
    result
}

/// Calculate Exponential Moving Average (EMA)
pub fn calculate_ema(data: &[f32], period: usize) -> Vec<f32> {
    if data.len() < period || period == 0 {
        return vec![];
    }
    let k = 2.0 / (period as f32 + 1.0);
    let mut result = Vec::with_capacity(data.len());
    
    // Initial SMA for first EMA point
    let initial_sma: f32 = data[..period].iter().sum::<f32>() / period as f32;
    result.push(initial_sma);

    let mut prev_ema = initial_sma;
    for &price in &data[period..] {
        let ema = (price * k) + (prev_ema * (1.0 - k));
        result.push(ema);
        prev_ema = ema;
    }
    result
}

/// Calculate Relative Strength Index (RSI)
pub fn calculate_rsi(data: &[f32], period: usize) -> Vec<f32> {
    if data.len() <= period || period == 0 {
        return vec![];
    }

    let mut gains = 0.0f32;
    let mut losses = 0.0f32;

    for i in 1..=period {
        let change = data[i] - data[i - 1];
        if change >= 0.0 {
            gains += change;
        } else {
            losses -= change;
        }
    }

    let mut avg_gain = gains / period as f32;
    let mut avg_loss = losses / period as f32;

    let mut rsi_values = Vec::with_capacity(data.len() - period);
    
    let rs = if avg_loss == 0.0 { 100.0 } else { avg_gain / avg_loss };
    rsi_values.push(100.0 - (100.0 / (1.0 + rs)));

    for i in (period + 1)..data.len() {
        let change = data[i] - data[i - 1];
        let (gain, loss) = if change >= 0.0 { (change, 0.0) } else { (0.0, -change) };

        avg_gain = (avg_gain * (period as f32 - 1.0) + gain) / period as f32;
        avg_loss = (avg_loss * (period as f32 - 1.0) + loss) / period as f32;

        let rs = if avg_loss == 0.0 { 100.0 } else { avg_gain / avg_loss };
        rsi_values.push(100.0 - (100.0 / (1.0 + rs)));
    }

    rsi_values
}
