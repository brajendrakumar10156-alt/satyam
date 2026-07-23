// Rust implementation for Master Coordinate System Mapping
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct CoordinateBridge {
    time_scale_start: f64,
    time_scale_end: f64,
    price_scale_min: f32,
    price_scale_max: f32,
    width: f32,
    height: f32,
}

#[wasm_bindgen]
impl CoordinateBridge {
    #[wasm_bindgen(constructor)]
    pub fn new() -> CoordinateBridge {
        CoordinateBridge {
            time_scale_start: 0.0,
            time_scale_end: 1.0,
            price_scale_min: 0.0,
            price_scale_max: 1.0,
            width: 800.0,
            height: 600.0,
        }
    }
    
    pub fn time_to_x(&self, time: f64) -> f32 {
        let range = self.time_scale_end - self.time_scale_start;
        (((time - self.time_scale_start) / range) as f32) * self.width
    }
    
    pub fn price_to_y(&self, price: f32) -> f32 {
        let range = self.price_scale_max - self.price_scale_min;
        (1.0 - ((price - self.price_scale_min) / range)) * self.height
    }
}
