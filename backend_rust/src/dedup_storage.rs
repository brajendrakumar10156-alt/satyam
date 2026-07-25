use crate::binary_translator::BinaryCandle;
use std::collections::BTreeMap;
use std::sync::RwLock;

/// Deduplicated Central Historical Data Storage Engine
/// Uses a BTreeMap indexed by candle timestamp to guarantee ZERO DUPLICATES.
pub struct DeduplicatedStorage {
    // Map: Unix Timestamp (u32) -> BinaryCandle (No Duplicate Timestamps Allowed)
    store: RwLock<BTreeMap<u32, BinaryCandle>>,
}

impl DeduplicatedStorage {
    pub fn new() -> Self {
        Self {
            store: RwLock::new(BTreeMap::new()),
        }
    }

    /// Ingest a single candle. Automatically deduplicates based on timestamp.
    /// Returns true if it was a new candle, false if it updated an existing candle.
    pub fn ingest_candle(&self, candle: BinaryCandle) -> bool {
        let ts_key = candle.time as u32;
        let mut map = self.store.write().unwrap();
        let is_new = !map.contains_key(&ts_key);
        map.insert(ts_key, candle);
        is_new
    }

    /// Ingest a bulk array of candles with automatic deduplication.
    /// Returns count of new candles added.
    pub fn ingest_bulk(&self, candles: &[BinaryCandle]) -> usize {
        let mut map = self.store.write().unwrap();
        let mut new_count = 0;
        for c in candles {
            let ts_key = c.time as u32;
            if !map.contains_key(&ts_key) {
                new_count += 1;
            }
            map.insert(ts_key, *c);
        }
        new_count
    }

    /// Query historical candles in a specific timestamp range [start_ts, end_ts]
    pub fn query_range(&self, start_ts: u32, end_ts: u32) -> Vec<BinaryCandle> {
        let map = self.store.read().unwrap();
        map.range(start_ts..=end_ts)
           .map(|(_, candle)| *candle)
           .collect()
    }

    /// Get total count of unique deduplicated candles stored
    pub fn total_count(&self) -> usize {
        let map = self.store.read().unwrap();
        map.len()
    }

    /// Retrieve all stored candles in sorted chronological order
    pub fn get_all(&self) -> Vec<BinaryCandle> {
        let map = self.store.read().unwrap();
        map.values().cloned().collect()
    }
}
