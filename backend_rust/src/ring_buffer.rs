use crate::binary_translator::BinaryCandle;
use std::collections::VecDeque;
use std::sync::RwLock;

pub struct RingBuffer {
    capacity: usize,
    candles: RwLock<VecDeque<BinaryCandle>>,
}

impl RingBuffer {
    pub fn new(capacity: usize) -> Self {
        Self {
            capacity,
            candles: RwLock::new(VecDeque::with_capacity(capacity)),
        }
    }

    /// Push a new live candle into the ring buffer
    pub fn push(&self, candle: BinaryCandle) {
        let mut lock = self.candles.write().unwrap();
        if lock.len() >= self.capacity {
            lock.pop_front();
        }
        lock.push_back(candle);
    }

    /// Get all stored candles in chronological order
    pub fn get_snapshot(&self) -> Vec<BinaryCandle> {
        let lock = self.candles.read().unwrap();
        lock.iter().cloned().collect()
    }

    pub fn len(&self) -> usize {
        let lock = self.candles.read().unwrap();
        lock.len()
    }
}
