use std::sync::atomic::{AtomicU32, Ordering};
use std::time::{Duration, Instant};

const BINANCE_WEIGHT_LIMIT_PER_MIN: u32 = 1200;
// Trigger fallback 4 steps before (at 80% capacity = 960 weight)
const SHIELD_FALLBACK_THRESHOLD: u32 = 960;

pub struct RateLimitShield {
    current_weight: AtomicU32,
    last_reset: Instant,
}

impl RateLimitShield {
    pub fn new() -> Self {
        Self {
            current_weight: AtomicU32::new(0),
            last_reset: Instant::now(),
        }
    }

    /// Register incoming request weight
    pub fn record_weight(&mut self, weight: u32) -> u32 {
        if self.last_reset.elapsed() >= Duration::from_secs(60) {
            self.current_weight.store(0, Ordering::Relaxed);
            self.last_reset = Instant::now();
        }
        self.current_weight.fetch_add(weight, Ordering::Relaxed) + weight
    }

    /// Check if client should switch to Rust server stream immediately
    pub fn is_shield_active(&self) -> bool {
        let weight = self.current_weight.load(Ordering::Relaxed);
        weight >= SHIELD_FALLBACK_THRESHOLD
    }

    pub fn get_status(&self) -> (u32, u32, bool) {
        let weight = self.current_weight.load(Ordering::Relaxed);
        (weight, BINANCE_WEIGHT_LIMIT_PER_MIN, self.is_shield_active())
    }
}
