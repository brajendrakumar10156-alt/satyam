use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn alloc_buffer(size: usize) -> *mut f32 {
    let mut buf = Vec::with_capacity(size);
    let ptr = buf.as_mut_ptr();
    std::mem::forget(buf);
    ptr
}

#[wasm_bindgen]
pub fn free_buffer(ptr: *mut f32, size: usize) {
    unsafe {
        let _ = Vec::from_raw_parts(ptr, 0, size);
    }
}

// Computes Simple Moving Average (SMA) in place or returns a pointer to a new buffer
// For simplicity, we write the SMA back to the exact same buffer (or a secondary buffer)
#[wasm_bindgen]
pub fn compute_sma(data_ptr: *mut f32, out_ptr: *mut f32, len: usize, period: usize) {
    if len < period || period == 0 { return; }

    let data = unsafe { std::slice::from_raw_parts(data_ptr, len) };
    let out = unsafe { std::slice::from_raw_parts_mut(out_ptr, len) };

    let mut sum: f32 = 0.0;
    
    // First window
    for i in 0..period {
        sum += data[i];
    }
    out[period - 1] = sum / (period as f32);

    // Sliding window
    for i in period..len {
        sum += data[i] - data[i - period];
        out[i] = sum / (period as f32);
    }
    
    // Fill initial with NaN or 0
    for i in 0..(period - 1) {
        out[i] = 0.0; // or f32::NAN
    }
}

#[wasm_bindgen]
pub fn compute_ema(data_ptr: *mut f32, out_ptr: *mut f32, len: usize, period: usize) {
    if len < period || period == 0 { return; }

    let data = unsafe { std::slice::from_raw_parts(data_ptr, len) };
    let out = unsafe { std::slice::from_raw_parts_mut(out_ptr, len) };

    let multiplier = 2.0 / ((period + 1) as f32);
    
    // Calculate initial SMA for the first EMA value
    let mut sum: f32 = 0.0;
    for i in 0..period {
        sum += data[i];
    }
    let mut prev_ema = sum / (period as f32);
    out[period - 1] = prev_ema;

    for i in 0..(period - 1) {
        out[i] = 0.0;
    }

    for i in period..len {
        prev_ema = (data[i] - prev_ema) * multiplier + prev_ema;
        out[i] = prev_ema;
    }
}

#[wasm_bindgen]
pub fn compute_rsi(data_ptr: *mut f32, out_ptr: *mut f32, len: usize, period: usize) {
    if len <= period || period == 0 { return; }

    let data = unsafe { std::slice::from_raw_parts(data_ptr, len) };
    let out = unsafe { std::slice::from_raw_parts_mut(out_ptr, len) };

    for i in 0..period {
        out[i] = 0.0;
    }

    let mut gain_sum: f32 = 0.0;
    let mut loss_sum: f32 = 0.0;

    for i in 1..=period {
        let diff = data[i] - data[i - 1];
        if diff > 0.0 {
            gain_sum += diff;
        } else {
            loss_sum -= diff;
        }
    }

    let mut avg_gain = gain_sum / (period as f32);
    let mut avg_loss = loss_sum / (period as f32);

    if avg_loss == 0.0 {
        out[period] = 100.0;
    } else {
        let rs = avg_gain / avg_loss;
        out[period] = 100.0 - (100.0 / (1.0 + rs));
    }

    for i in (period + 1)..len {
        let diff = data[i] - data[i - 1];
        let mut gain = 0.0;
        let mut loss = 0.0;
        if diff > 0.0 {
            gain = diff;
        } else {
            loss = -diff;
        }

        avg_gain = (avg_gain * ((period - 1) as f32) + gain) / (period as f32);
        avg_loss = (avg_loss * ((period - 1) as f32) + loss) / (period as f32);

        if avg_loss == 0.0 {
            out[i] = 100.0;
        } else {
            let rs = avg_gain / avg_loss;
            out[i] = 100.0 - (100.0 / (1.0 + rs));
        }
    }
}

// MACD outputs 3 arrays: MACD Line, Signal Line, Histogram
// For zero-copy with a single output buffer, we can pack them sequentially:
// [MACD_Line (len), Signal_Line (len), Histogram (len)]
// Out_ptr must point to a buffer of size: len * 3
#[wasm_bindgen]
pub fn compute_macd(data_ptr: *mut f32, out_ptr: *mut f32, len: usize, fast_period: usize, slow_period: usize, signal_period: usize) {
    if len < slow_period { return; }

    let data = unsafe { std::slice::from_raw_parts(data_ptr, len) };
    let out = unsafe { std::slice::from_raw_parts_mut(out_ptr, len * 3) };

    // 1. Calculate Fast EMA and Slow EMA (Inline for performance)
    let fast_mult = 2.0 / ((fast_period + 1) as f32);
    let slow_mult = 2.0 / ((slow_period + 1) as f32);
    
    let mut fast_ema = data[0];
    let mut slow_ema = data[0];

    for i in 0..len {
        fast_ema = (data[i] - fast_ema) * fast_mult + fast_ema;
        slow_ema = (data[i] - slow_ema) * slow_mult + slow_ema;
        
        let macd_val = if i >= slow_period - 1 { fast_ema - slow_ema } else { 0.0 };
        out[i] = macd_val;
    }

    // 2. Calculate Signal EMA from MACD Line
    let sig_mult = 2.0 / ((signal_period + 1) as f32);
    let mut sig_ema = 0.0;

    let start_idx = slow_period - 1;
    if start_idx < len {
        sig_ema = out[start_idx]; // First MACD value
    }

    for i in 0..len {
        let signal_val = if i < start_idx + signal_period - 1 {
            0.0
        } else {
            sig_ema = (out[i] - sig_ema) * sig_mult + sig_ema;
            sig_ema
        };
        out[len + i] = signal_val; // Signal line
        out[2 * len + i] = out[i] - signal_val; // Histogram
    }
}

// Bollinger Bands: [Upper (len), Middle (len), Lower (len)]
#[wasm_bindgen]
pub fn compute_bollinger(data_ptr: *mut f32, out_ptr: *mut f32, len: usize, period: usize, std_dev: f32) {
    if len < period || period == 0 { return; }

    let data = unsafe { std::slice::from_raw_parts(data_ptr, len) };
    let out = unsafe { std::slice::from_raw_parts_mut(out_ptr, len * 3) };

    for i in 0..period-1 {
        out[i] = 0.0; // Upper
        out[len + i] = 0.0; // Middle (SMA)
        out[2 * len + i] = 0.0; // Lower
    }

    for i in (period - 1)..len {
        let mut sum = 0.0;
        for j in 0..period {
            sum += data[i - j];
        }
        let sma = sum / (period as f32);

        let mut variance = 0.0;
        for j in 0..period {
            let diff = data[i - j] - sma;
            variance += diff * diff;
        }
        variance /= period as f32;
        
        // Manual sqrt to avoid extra dependencies/overhead if possible, but f32::sqrt is cheap enough
        let stddev = variance.sqrt();

        out[i] = sma + (std_dev * stddev); // Upper
        out[len + i] = sma; // Middle
        out[2 * len + i] = sma - (std_dev * stddev); // Lower
    }
}


