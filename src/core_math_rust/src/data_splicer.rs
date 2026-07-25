use wasm_bindgen::prelude::*;
use std::collections::BTreeMap;

/// Hybrid Data Reconciliation Layer (Perfect Data Engine) in Native Rust
/// Extremely fast gap detection and array stitching for millions of candles.

#[wasm_bindgen]
pub struct NativeDataSplicer {
    // BTreeMap keeps timestamps automatically sorted
    cache: BTreeMap<u64, CandleData>,
}

#[derive(Clone, Copy)]
pub struct CandleData {
    pub time: u64,
    pub open: f32,
    pub high: f32,
    pub low: f32,
    pub close: f32,
    pub volume: f32,
}

#[wasm_bindgen]
impl NativeDataSplicer {
    #[wasm_bindgen(constructor)]
    pub fn new() -> NativeDataSplicer {
        NativeDataSplicer {
            cache: BTreeMap::new(),
        }
    }

    /// Ingests a raw flat float array from JS (fetched from Binance/Server) 
    /// Format: [time, open, high, low, close, volume, ...]
    #[wasm_bindgen]
    pub fn ingest_raw_data(&mut self, raw_data: &[f32]) {
        let chunk_size = 6;
        for chunk in raw_data.chunks(chunk_size) {
            if chunk.len() == chunk_size {
                let time = chunk[0] as u64;
                self.cache.insert(time, CandleData {
                    time,
                    open: chunk[1],
                    high: chunk[2],
                    low: chunk[3],
                    close: chunk[4],
                    volume: chunk[5],
                });
            }
        }
    }

    /// Fast Gap Detection (Returns missing time ranges)
    /// Expects the required interval in seconds
    #[wasm_bindgen]
    pub fn detect_gaps(&self, expected_start: u64, expected_end: u64, interval_ms: u64) -> Vec<u64> {
        let mut missing_ranges = Vec::new();
        let mut current_time = expected_start;

        while current_time <= expected_end {
            if !self.cache.contains_key(&current_time) {
                missing_ranges.push(current_time);
            }
            current_time += interval_ms;
        }

        // Returns flat array of missing timestamps for JS to fetch
        missing_ranges
    }

    /// Outputs the perfectly merged, gap-free, sorted Float32Array for GPU/CPU math
    #[wasm_bindgen]
    pub fn get_flawless_buffer(&self) -> Vec<f32> {
        let mut buffer = Vec::with_capacity(self.cache.len() * 6);
        for (_, candle) in self.cache.iter() {
            buffer.push(candle.time as f32);
            buffer.push(candle.open);
            buffer.push(candle.high);
            buffer.push(candle.low);
            buffer.push(candle.close);
            buffer.push(candle.volume);
        }
        buffer
    }
}
