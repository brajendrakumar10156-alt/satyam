use wasm_bindgen::prelude::*;
use crate::hardware_detector::HardwareDetector;
use std::collections::HashMap;

#[wasm_bindgen]
pub struct OmniOrchestrator {
    detector: HardwareDetector,
    load_metrics: HashMap<String, f32>,
    routing_cache: HashMap<String, String>,
}

#[wasm_bindgen]
impl OmniOrchestrator {
    #[wasm_bindgen(constructor)]
    pub fn new() -> OmniOrchestrator {
        let mut metrics = HashMap::new();
        metrics.insert("cpu".to_string(), 0.0);
        metrics.insert("gpu".to_string(), 0.0);
        metrics.insert("npu".to_string(), 0.0);
        metrics.insert("wsl_backend".to_string(), 0.0);

        OmniOrchestrator {
            detector: HardwareDetector::new(),
            load_metrics: metrics,
            routing_cache: HashMap::new(),
        }
    }

    #[wasm_bindgen]
    pub fn initialize(&mut self) {
        self.detector.detect_sync();
    }

    /// O(1) Permutation & Combination Routing Native Logic
    #[wasm_bindgen]
    pub fn route_task(&mut self, task_type: &str, dataset_size: u32) -> String {
        let size_category = if dataset_size > 10000 { "LARGE" } else { "SMALL" };
        let cache_key = format!("{}_{}", task_type, size_category);

        if let Some(cached_target) = self.routing_cache.get(&cache_key) {
            if let Some(load) = self.load_metrics.get(cached_target) {
                if *load < 0.8 {
                    return cached_target.clone();
                }
            }
        }

        let mut best_target = "cpu".to_string();

        match task_type {
            "MATH_PARALLEL" => {
                let gpu_load = *self.load_metrics.get("gpu").unwrap_or(&0.0);
                if dataset_size > 50000 && self.detector.has_webgpu && gpu_load < 0.8 {
                    best_target = "gpu".to_string(); // WebGPU Compute Shaders
                }
            },
            "MATH_SEQUENTIAL" => {
                best_target = "cpu".to_string(); // Rust WASM is best for sequential
            },
            "AI_INFERENCE" => {
                let npu_load = *self.load_metrics.get("npu").unwrap_or(&0.0);
                if self.detector.has_webnn && npu_load < 0.8 {
                    best_target = "npu".to_string(); // Native WebNN AI Chip
                } else if self.detector.has_webgpu {
                    best_target = "gpu".to_string(); // Fallback WebGPU
                } else {
                    best_target = "wsl_backend".to_string();
                }
            },
            "HFT_ARBITRAGE" => {
                best_target = "wsl_backend".to_string(); // Always Backend C++
            },
            _ => {}
        }

        self.routing_cache.insert(cache_key, best_target.clone());
        best_target
    }

    #[wasm_bindgen]
    pub fn report_load(&mut self, target: &str, new_load: f32) {
        self.load_metrics.insert(target.to_string(), new_load);
    }
}
