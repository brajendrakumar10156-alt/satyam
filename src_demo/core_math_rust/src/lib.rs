// ============================================================
// QuantaAI — CPU Precision Math Engine
// Language: Rust → WebAssembly (WASM)
// Phase: 2 — Full Implementation
//
// ARCHITECTURE:
//   - Sequential math (EMA, RSI) → Pure CPU mode
//   - Parallel math (SMA batch, Bollinger) → Selective SIMD
//   - No JS in this file — pure Rust only
//   - Runs in Web Worker via SharedArrayBuffer
// ============================================================

use wasm_bindgen::prelude::*;

// ─────────────────────────────────────────────
// SECTION A: TREND INDICATORS
// ─────────────────────────────────────────────

/// Simple Moving Average
/// Mode: Pure CPU (sliding window sum — sequential)
#[wasm_bindgen]
pub fn sma(prices: &[f32], period: usize) -> Vec<f32> {
    if prices.len() < period || period == 0 {
        return vec![];
    }
    let mut result = Vec::with_capacity(prices.len() - period + 1);
    let mut window_sum: f32 = prices[..period].iter().sum();
    result.push(window_sum / period as f32);
    for i in period..prices.len() {
        window_sum += prices[i] - prices[i - period];
        result.push(window_sum / period as f32);
    }
    result
}

/// Exponential Moving Average
/// Mode: Pure CPU (sequential — each value depends on previous)
#[wasm_bindgen]
pub fn ema(prices: &[f32], period: usize) -> Vec<f32> {
    if prices.len() < period || period == 0 {
        return vec![];
    }
    let k = 2.0_f32 / (period as f32 + 1.0);
    let mut result = Vec::with_capacity(prices.len());
    // Seed with SMA of first `period` values
    let seed: f32 = prices[..period].iter().sum::<f32>() / period as f32;
    result.push(seed);
    for i in period..prices.len() {
        let prev = *result.last().unwrap();
        result.push(prices[i] * k + prev * (1.0 - k));
    }
    result
}

/// Weighted Moving Average
/// Mode: Pure CPU (weighted sum)
#[wasm_bindgen]
pub fn wma(prices: &[f32], period: usize) -> Vec<f32> {
    if prices.len() < period || period == 0 {
        return vec![];
    }
    let denom = (period * (period + 1) / 2) as f32;
    let mut result = Vec::with_capacity(prices.len() - period + 1);
    for i in (period - 1)..prices.len() {
        let mut weighted_sum = 0.0_f32;
        for j in 0..period {
            weighted_sum += prices[i - (period - 1 - j)] * (j as f32 + 1.0);
        }
        result.push(weighted_sum / denom);
    }
    result
}

/// Hull Moving Average = WMA(2*WMA(n/2) - WMA(n), sqrt(n))
/// Mode: Pure CPU (composed WMAs)
#[wasm_bindgen]
pub fn hma(prices: &[f32], period: usize) -> Vec<f32> {
    if prices.len() < period || period < 2 {
        return vec![];
    }
    let half = period / 2;
    let sqrt_p = (period as f32).sqrt() as usize;

    let wma_half = wma(prices, half);
    let wma_full = wma(prices, period);

    if wma_half.len() < wma_full.len() {
        return vec![];
    }

    let offset = wma_half.len() - wma_full.len();
    let mut combined: Vec<f32> = wma_full
        .iter()
        .enumerate()
        .map(|(i, &wf)| 2.0 * wma_half[i + offset] - wf)
        .collect();

    wma(&combined, sqrt_p)
}

/// Double EMA (DEMA)
#[wasm_bindgen]
pub fn dema(prices: &[f32], period: usize) -> Vec<f32> {
    let ema1 = ema(prices, period);
    let ema2 = ema(&ema1, period);
    if ema1.len() < ema2.len() {
        return vec![];
    }
    let offset = ema1.len() - ema2.len();
    ema2.iter()
        .enumerate()
        .map(|(i, &e2)| 2.0 * ema1[i + offset] - e2)
        .collect()
}

/// Triple EMA (TEMA)
#[wasm_bindgen]
pub fn tema(prices: &[f32], period: usize) -> Vec<f32> {
    let ema1 = ema(prices, period);
    let ema2 = ema(&ema1, period);
    let ema3 = ema(&ema2, period);
    if ema1.len() < ema3.len() || ema2.len() < ema3.len() {
        return vec![];
    }
    let o1 = ema1.len() - ema3.len();
    let o2 = ema2.len() - ema3.len();
    ema3.iter()
        .enumerate()
        .map(|(i, &e3)| 3.0 * ema1[i + o1] - 3.0 * ema2[i + o2] + e3)
        .collect()
}

// ─────────────────────────────────────────────
// SECTION B: MOMENTUM INDICATORS
// ─────────────────────────────────────────────

/// RSI — Relative Strength Index (Wilder's Smoothing)
/// Mode: Pure CPU (sequential — each step depends on previous avg)
#[wasm_bindgen]
pub fn rsi(prices: &[f32], period: usize) -> Vec<f32> {
    if prices.len() <= period || period == 0 {
        return vec![];
    }
    let mut gains = 0.0_f32;
    let mut losses = 0.0_f32;

    // Initial average gain/loss
    for i in 1..=period {
        let diff = prices[i] - prices[i - 1];
        if diff > 0.0 { gains += diff; } else { losses -= diff; }
    }
    let mut avg_gain = gains / period as f32;
    let mut avg_loss = losses / period as f32;

    let mut result = Vec::with_capacity(prices.len() - period);
    let rs = if avg_loss == 0.0 { f32::INFINITY } else { avg_gain / avg_loss };
    result.push(100.0 - 100.0 / (1.0 + rs));

    // Wilder's smoothing (sequential)
    for i in (period + 1)..prices.len() {
        let diff = prices[i] - prices[i - 1];
        let gain = if diff > 0.0 { diff } else { 0.0 };
        let loss = if diff < 0.0 { -diff } else { 0.0 };
        avg_gain = (avg_gain * (period as f32 - 1.0) + gain) / period as f32;
        avg_loss = (avg_loss * (period as f32 - 1.0) + loss) / period as f32;
        let rs = if avg_loss == 0.0 { f32::INFINITY } else { avg_gain / avg_loss };
        result.push(100.0 - 100.0 / (1.0 + rs));
    }
    result
}

/// MACD — Moving Average Convergence Divergence
/// Returns: [macd_line, signal_line, histogram] as flat Vec<f32>
/// Mode: Pure CPU (composed EMAs — sequential)
#[wasm_bindgen]
pub fn macd(
    prices: &[f32],
    fast: usize,
    slow: usize,
    signal: usize,
) -> Vec<f32> {
    let ema_fast = ema(prices, fast);
    let ema_slow = ema(prices, slow);

    if ema_fast.len() < ema_slow.len() {
        return vec![];
    }

    let offset = ema_fast.len() - ema_slow.len();
    let macd_line: Vec<f32> = ema_slow
        .iter()
        .enumerate()
        .map(|(i, &s)| ema_fast[i + offset] - s)
        .collect();

    let signal_line = ema(&macd_line, signal);
    if macd_line.len() < signal_line.len() {
        return vec![];
    }

    let sig_offset = macd_line.len() - signal_line.len();
    let n = signal_line.len();

    // Pack as [macd, signal, histogram, macd, signal, histogram, ...]
    let mut result = Vec::with_capacity(n * 3);
    for i in 0..n {
        let m = macd_line[i + sig_offset];
        let s = signal_line[i];
        result.push(m);
        result.push(s);
        result.push(m - s);
    }
    result
}

/// Stochastic Oscillator — %K and %D
/// Returns: [k, d, k, d, ...] flat Vec
#[wasm_bindgen]
pub fn stochastic(
    highs: &[f32],
    lows: &[f32],
    closes: &[f32],
    k_period: usize,
    d_period: usize,
) -> Vec<f32> {
    let n = closes.len();
    if n < k_period { return vec![]; }

    let mut k_vals = Vec::with_capacity(n - k_period + 1);
    for i in (k_period - 1)..n {
        let lo = lows[(i + 1 - k_period)..=i]
            .iter().cloned().fold(f32::INFINITY, f32::min);
        let hi = highs[(i + 1 - k_period)..=i]
            .iter().cloned().fold(f32::NEG_INFINITY, f32::max);
        let k = if (hi - lo).abs() < 1e-10 { 50.0 } else {
            100.0 * (closes[i] - lo) / (hi - lo)
        };
        k_vals.push(k);
    }

    let d_vals = sma(&k_vals, d_period);
    if k_vals.len() < d_vals.len() { return vec![]; }

    let offset = k_vals.len() - d_vals.len();
    let mut result = Vec::with_capacity(d_vals.len() * 2);
    for (i, &d) in d_vals.iter().enumerate() {
        result.push(k_vals[i + offset]);
        result.push(d);
    }
    result
}

/// Williams %R
#[wasm_bindgen]
pub fn williams_r(
    highs: &[f32],
    lows: &[f32],
    closes: &[f32],
    period: usize,
) -> Vec<f32> {
    let n = closes.len();
    if n < period { return vec![]; }
    let mut result = Vec::with_capacity(n - period + 1);
    for i in (period - 1)..n {
        let lo = lows[(i + 1 - period)..=i]
            .iter().cloned().fold(f32::INFINITY, f32::min);
        let hi = highs[(i + 1 - period)..=i]
            .iter().cloned().fold(f32::NEG_INFINITY, f32::max);
        let wr = if (hi - lo).abs() < 1e-10 { -50.0 } else {
            -100.0 * (hi - closes[i]) / (hi - lo)
        };
        result.push(wr);
    }
    result
}

/// Rate of Change (ROC)
#[wasm_bindgen]
pub fn roc(prices: &[f32], period: usize) -> Vec<f32> {
    if prices.len() <= period { return vec![]; }
    prices[period..]
        .iter()
        .enumerate()
        .map(|(i, &p)| {
            if prices[i].abs() < 1e-10 { 0.0 }
            else { (p - prices[i]) / prices[i] * 100.0 }
        })
        .collect()
}

// ─────────────────────────────────────────────
// SECTION C: VOLATILITY INDICATORS
// ─────────────────────────────────────────────

/// Average True Range (ATR) — Wilder's smoothing
/// Mode: Pure CPU (sequential)
#[wasm_bindgen]
pub fn atr(
    highs: &[f32],
    lows: &[f32],
    closes: &[f32],
    period: usize,
) -> Vec<f32> {
    let n = closes.len();
    if n < period + 1 { return vec![]; }

    let mut tr_vals: Vec<f32> = Vec::with_capacity(n - 1);
    for i in 1..n {
        let hl = highs[i] - lows[i];
        let hc = (highs[i] - closes[i - 1]).abs();
        let lc = (lows[i] - closes[i - 1]).abs();
        tr_vals.push(hl.max(hc).max(lc));
    }

    // Seed with SMA of first period TRs
    let mut atr_val: f32 = tr_vals[..period].iter().sum::<f32>() / period as f32;
    let mut result = vec![atr_val];
    for i in period..tr_vals.len() {
        atr_val = (atr_val * (period as f32 - 1.0) + tr_vals[i]) / period as f32;
        result.push(atr_val);
    }
    result
}

/// Bollinger Bands
/// Returns: [upper, middle, lower, upper, middle, lower, ...] flat Vec
/// Mode: Pure CPU (sliding window std dev)
#[wasm_bindgen]
pub fn bollinger_bands(
    prices: &[f32],
    period: usize,
    multiplier: f32,
) -> Vec<f32> {
    let n = prices.len();
    if n < period { return vec![]; }
    let mut result = Vec::with_capacity((n - period + 1) * 3);

    for i in (period - 1)..n {
        let slice = &prices[(i + 1 - period)..=i];
        let mean: f32 = slice.iter().sum::<f32>() / period as f32;
        let variance: f32 = slice.iter()
            .map(|&x| (x - mean).powi(2))
            .sum::<f32>() / period as f32;
        let std_dev = variance.sqrt();
        result.push(mean + multiplier * std_dev); // upper
        result.push(mean);                         // middle
        result.push(mean - multiplier * std_dev); // lower
    }
    result
}

/// Keltner Channel
/// Returns: [upper, middle, lower, ...] flat Vec
#[wasm_bindgen]
pub fn keltner_channel(
    highs: &[f32],
    lows: &[f32],
    closes: &[f32],
    ema_period: usize,
    atr_period: usize,
    multiplier: f32,
) -> Vec<f32> {
    let ema_vals = ema(closes, ema_period);
    let atr_vals = atr(highs, lows, closes, atr_period);

    // Align lengths
    let n = ema_vals.len().min(atr_vals.len());
    let e_off = ema_vals.len() - n;
    let a_off = atr_vals.len() - n;

    let mut result = Vec::with_capacity(n * 3);
    for i in 0..n {
        let mid = ema_vals[i + e_off];
        let a = atr_vals[i + a_off];
        result.push(mid + multiplier * a);
        result.push(mid);
        result.push(mid - multiplier * a);
    }
    result
}

// ─────────────────────────────────────────────
// SECTION D: VOLUME INDICATORS
// ─────────────────────────────────────────────

/// On Balance Volume (OBV)
/// Mode: Pure CPU (sequential cumulative)
#[wasm_bindgen]
pub fn obv(closes: &[f32], volumes: &[f32]) -> Vec<f32> {
    let n = closes.len().min(volumes.len());
    if n < 2 { return vec![]; }
    let mut result = Vec::with_capacity(n);
    let mut running = volumes[0];
    result.push(running);
    for i in 1..n {
        if closes[i] > closes[i - 1] { running += volumes[i]; }
        else if closes[i] < closes[i - 1] { running -= volumes[i]; }
        result.push(running);
    }
    result
}

/// Volume Weighted Average Price (VWAP)
/// Mode: Pure CPU (sequential cumulative)
#[wasm_bindgen]
pub fn vwap(
    highs: &[f32],
    lows: &[f32],
    closes: &[f32],
    volumes: &[f32],
) -> Vec<f32> {
    let n = closes.len()
        .min(highs.len())
        .min(lows.len())
        .min(volumes.len());
    if n == 0 { return vec![]; }

    let mut cum_tp_vol = 0.0_f32;
    let mut cum_vol = 0.0_f32;
    let mut result = Vec::with_capacity(n);

    for i in 0..n {
        let tp = (highs[i] + lows[i] + closes[i]) / 3.0;
        cum_tp_vol += tp * volumes[i];
        cum_vol += volumes[i];
        result.push(if cum_vol == 0.0 { tp } else { cum_tp_vol / cum_vol });
    }
    result
}

/// Money Flow Index (MFI)
/// Mode: Pure CPU (sequential)
#[wasm_bindgen]
pub fn mfi(
    highs: &[f32],
    lows: &[f32],
    closes: &[f32],
    volumes: &[f32],
    period: usize,
) -> Vec<f32> {
    let n = closes.len()
        .min(highs.len())
        .min(lows.len())
        .min(volumes.len());
    if n <= period { return vec![]; }

    let tp: Vec<f32> = (0..n)
        .map(|i| (highs[i] + lows[i] + closes[i]) / 3.0)
        .collect();

    let mut result = Vec::with_capacity(n - period);
    for i in period..n {
        let mut pos_flow = 0.0_f32;
        let mut neg_flow = 0.0_f32;
        for j in (i - period + 1)..=i {
            let mf = tp[j] * volumes[j];
            if tp[j] > tp[j - 1] { pos_flow += mf; }
            else { neg_flow += mf; }
        }
        let mfi_val = if neg_flow == 0.0 { 100.0 }
            else { 100.0 - 100.0 / (1.0 + pos_flow / neg_flow) };
        result.push(mfi_val);
    }
    result
}

/// Chaikin Money Flow (CMF)
#[wasm_bindgen]
pub fn cmf(
    highs: &[f32],
    lows: &[f32],
    closes: &[f32],
    volumes: &[f32],
    period: usize,
) -> Vec<f32> {
    let n = closes.len()
        .min(highs.len())
        .min(lows.len())
        .min(volumes.len());
    if n < period { return vec![]; }

    let mut result = Vec::with_capacity(n - period + 1);
    for i in (period - 1)..n {
        let mut sum_mfv = 0.0_f32;
        let mut sum_vol = 0.0_f32;
        for j in (i + 1 - period)..=i {
            let hl = highs[j] - lows[j];
            let mfm = if hl < 1e-10 { 0.0 }
                else { ((closes[j] - lows[j]) - (highs[j] - closes[j])) / hl };
            sum_mfv += mfm * volumes[j];
            sum_vol += volumes[j];
        }
        result.push(if sum_vol == 0.0 { 0.0 } else { sum_mfv / sum_vol });
    }
    result
}

// ─────────────────────────────────────────────
// SECTION E: TREND STRENGTH
// ─────────────────────────────────────────────

/// ADX — Average Directional Index
/// Returns: [adx, plus_di, minus_di, ...] flat Vec
/// Mode: Pure CPU (sequential Wilder smoothing)
#[wasm_bindgen]
pub fn adx(
    highs: &[f32],
    lows: &[f32],
    closes: &[f32],
    period: usize,
) -> Vec<f32> {
    let n = closes.len()
        .min(highs.len())
        .min(lows.len());
    if n < period + 1 { return vec![]; }

    let mut tr_vals = Vec::with_capacity(n - 1);
    let mut pdm_vals = Vec::with_capacity(n - 1);
    let mut mdm_vals = Vec::with_capacity(n - 1);

    for i in 1..n {
        let hl = highs[i] - lows[i];
        let hpc = (highs[i] - closes[i - 1]).abs();
        let lpc = (lows[i] - closes[i - 1]).abs();
        tr_vals.push(hl.max(hpc).max(lpc));

        let up = highs[i] - highs[i - 1];
        let down = lows[i - 1] - lows[i];
        pdm_vals.push(if up > down && up > 0.0 { up } else { 0.0 });
        mdm_vals.push(if down > up && down > 0.0 { down } else { 0.0 });
    }

    // Wilder smoothing seed
    let mut smoothed_tr: f32 = tr_vals[..period].iter().sum();
    let mut smoothed_pdm: f32 = pdm_vals[..period].iter().sum();
    let mut smoothed_mdm: f32 = mdm_vals[..period].iter().sum();

    let mut dx_vals: Vec<f32> = Vec::new();
    let p = period as f32;

    let make_di = |pdm: f32, mdm: f32, tr: f32| -> (f32, f32, f32) {
        let pdi = if tr == 0.0 { 0.0 } else { 100.0 * pdm / tr };
        let mdi = if tr == 0.0 { 0.0 } else { 100.0 * mdm / tr };
        let dx = if (pdi + mdi) == 0.0 { 0.0 }
            else { 100.0 * (pdi - mdi).abs() / (pdi + mdi) };
        (pdi, mdi, dx)
    };

    let (_, _, dx0) = make_di(smoothed_pdm, smoothed_mdm, smoothed_tr);
    dx_vals.push(dx0);

    let mut pdi_vals = vec![100.0 * smoothed_pdm / smoothed_tr];
    let mut mdi_vals = vec![100.0 * smoothed_mdm / smoothed_tr];

    for i in period..tr_vals.len() {
        smoothed_tr = smoothed_tr - smoothed_tr / p + tr_vals[i];
        smoothed_pdm = smoothed_pdm - smoothed_pdm / p + pdm_vals[i];
        smoothed_mdm = smoothed_mdm - smoothed_mdm / p + mdm_vals[i];
        let (pdi, mdi, dx) = make_di(smoothed_pdm, smoothed_mdm, smoothed_tr);
        pdi_vals.push(pdi);
        mdi_vals.push(mdi);
        dx_vals.push(dx);
    }

    // ADX = smoothed DX
    let adx_vals = ema(&dx_vals, period);
    let offset = dx_vals.len() - adx_vals.len();
    let n_out = adx_vals.len();

    // Pack as [adx, +DI, -DI, ...]
    let mut result = Vec::with_capacity(n_out * 3);
    for i in 0..n_out {
        result.push(adx_vals[i]);
        result.push(pdi_vals[i + offset]);
        result.push(mdi_vals[i + offset]);
    }
    result
}

/// SuperTrend
/// Returns: [supertrend_value, direction (1=up, -1=down), ...] flat
#[wasm_bindgen]
pub fn supertrend(
    highs: &[f32],
    lows: &[f32],
    closes: &[f32],
    period: usize,
    multiplier: f32,
) -> Vec<f32> {
    let atr_vals = atr(highs, lows, closes, period);
    let n = atr_vals.len();
    if n == 0 { return vec![]; }

    // ATR starts from index `period` of closes (Wilder seed offset)
    let start = closes.len() - n;

    let mut upper_band = vec![0.0_f32; n];
    let mut lower_band = vec![0.0_f32; n];
    let mut supertrend = vec![0.0_f32; n];
    let mut direction = vec![1.0_f32; n]; // 1=bullish, -1=bearish

    for i in 0..n {
        let ci = i + start;
        let hl2 = (highs[ci] + lows[ci]) / 2.0;
        let basic_upper = hl2 + multiplier * atr_vals[i];
        let basic_lower = hl2 - multiplier * atr_vals[i];

        upper_band[i] = if i > 0 && basic_upper < upper_band[i-1]
            { basic_upper }
            else if i > 0 && closes[ci - 1] > upper_band[i-1]
            { basic_upper }
            else if i == 0 { basic_upper }
            else { upper_band[i-1] };

        lower_band[i] = if i > 0 && basic_lower > lower_band[i-1]
            { basic_lower }
            else if i > 0 && closes[ci - 1] < lower_band[i-1]
            { basic_lower }
            else if i == 0 { basic_lower }
            else { lower_band[i-1] };

        if i == 0 {
            supertrend[i] = upper_band[i];
            direction[i] = -1.0;
        } else {
            if supertrend[i-1] == upper_band[i-1] {
                if closes[ci] <= upper_band[i] {
                    supertrend[i] = upper_band[i];
                    direction[i] = -1.0;
                } else {
                    supertrend[i] = lower_band[i];
                    direction[i] = 1.0;
                }
            } else {
                if closes[ci] >= lower_band[i] {
                    supertrend[i] = lower_band[i];
                    direction[i] = 1.0;
                } else {
                    supertrend[i] = upper_band[i];
                    direction[i] = -1.0;
                }
            }
        }
    }

    // Pack as [value, direction, value, direction, ...]
    let mut result = Vec::with_capacity(n * 2);
    for i in 0..n {
        result.push(supertrend[i]);
        result.push(direction[i]);
    }
    result
}

/// Parabolic SAR
/// Returns: [sar, direction (1=bull, -1=bear), ...] flat Vec
#[wasm_bindgen]
pub fn parabolic_sar(
    highs: &[f32],
    lows: &[f32],
    step: f32,
    max_step: f32,
) -> Vec<f32> {
    let n = highs.len().min(lows.len());
    if n < 2 { return vec![]; }

    let mut sar = lows[0];
    let mut ep = highs[0];    // extreme point
    let mut af = step;        // acceleration factor
    let mut bull = true;      // trend direction

    let mut result = Vec::with_capacity(n * 2);
    result.push(sar);
    result.push(if bull { 1.0 } else { -1.0 });

    for i in 1..n {
        let prev_sar = sar;

        if bull {
            sar = prev_sar + af * (ep - prev_sar);
            sar = sar.min(lows[i - 1]).min(if i > 1 { lows[i - 2] } else { lows[0] });
            if lows[i] < sar {
                bull = false;
                sar = ep;
                ep = lows[i];
                af = step;
            } else {
                if highs[i] > ep {
                    ep = highs[i];
                    af = (af + step).min(max_step);
                }
            }
        } else {
            sar = prev_sar + af * (ep - prev_sar);
            sar = sar.max(highs[i - 1]).max(if i > 1 { highs[i - 2] } else { highs[0] });
            if highs[i] > sar {
                bull = true;
                sar = ep;
                ep = highs[i];
                af = step;
            } else {
                if lows[i] < ep {
                    ep = lows[i];
                    af = (af + step).min(max_step);
                }
            }
        }

        result.push(sar);
        result.push(if bull { 1.0 } else { -1.0 });
    }
    result
}

/// CCI — Commodity Channel Index
#[wasm_bindgen]
pub fn cci(
    highs: &[f32],
    lows: &[f32],
    closes: &[f32],
    period: usize,
) -> Vec<f32> {
    let n = closes.len()
        .min(highs.len())
        .min(lows.len());
    if n < period { return vec![]; }

    let tp: Vec<f32> = (0..n)
        .map(|i| (highs[i] + lows[i] + closes[i]) / 3.0)
        .collect();

    let mut result = Vec::with_capacity(n - period + 1);
    for i in (period - 1)..n {
        let slice = &tp[(i + 1 - period)..=i];
        let mean: f32 = slice.iter().sum::<f32>() / period as f32;
        let md: f32 = slice.iter()
            .map(|&x| (x - mean).abs())
            .sum::<f32>() / period as f32;
        result.push(if md < 1e-10 { 0.0 } else { (tp[i] - mean) / (0.015 * md) });
    }
    result
}

/// Aroon Indicator
/// Returns: [aroon_up, aroon_down, ...] flat Vec
#[wasm_bindgen]
pub fn aroon(
    highs: &[f32],
    lows: &[f32],
    period: usize,
) -> Vec<f32> {
    let n = highs.len().min(lows.len());
    if n < period { return vec![]; }

    let p = period as f32;
    let mut result = Vec::with_capacity((n - period) * 2);
    for i in period..n {
        let slice_h = &highs[(i - period)..=i];
        let slice_l = &lows[(i - period)..=i];
        let max_pos = slice_h.iter().enumerate()
            .max_by(|a, b| a.1.partial_cmp(b.1).unwrap())
            .map(|(j, _)| j).unwrap_or(0);
        let min_pos = slice_l.iter().enumerate()
            .min_by(|a, b| a.1.partial_cmp(b.1).unwrap())
            .map(|(j, _)| j).unwrap_or(0);
        result.push(100.0 * max_pos as f32 / p);
        result.push(100.0 * min_pos as f32 / p);
    }
    result
}

// ─────────────────────────────────────────────
// SECTION F: UTILITY
// ─────────────────────────────────────────────

/// Extract close prices from OHLCV flat array
/// OHLCV format: [open, high, low, close, volume, open, high, ...]
#[wasm_bindgen]
pub fn extract_closes(ohlcv: &[f32]) -> Vec<f32> {
    ohlcv.chunks(5).filter_map(|c| c.get(3).copied()).collect()
}

#[wasm_bindgen]
pub fn extract_highs(ohlcv: &[f32]) -> Vec<f32> {
    ohlcv.chunks(5).filter_map(|c| c.get(1).copied()).collect()
}

#[wasm_bindgen]
pub fn extract_lows(ohlcv: &[f32]) -> Vec<f32> {
    ohlcv.chunks(5).filter_map(|c| c.get(2).copied()).collect()
}

#[wasm_bindgen]
pub fn extract_volumes(ohlcv: &[f32]) -> Vec<f32> {
    ohlcv.chunks(5).filter_map(|c| c.get(4).copied()).collect()
}

/// Returns engine version string
#[wasm_bindgen]
pub fn engine_version() -> String {
    "QuantaAI Math Engine v0.2.0 — Phase 2".to_string()
}
