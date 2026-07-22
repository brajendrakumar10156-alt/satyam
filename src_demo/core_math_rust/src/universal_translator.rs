use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct UniversalTranslator {
    width: f32,
    height: f32,
    min_price: f32,
    max_price: f32,
    min_time: f64,
    max_time: f64,
}

#[wasm_bindgen]
impl UniversalTranslator {
    #[wasm_bindgen(constructor)]
    pub fn new() -> UniversalTranslator {
        UniversalTranslator {
            width: 0.0,
            height: 0.0,
            min_price: 0.0,
            max_price: 0.0,
            min_time: 0.0,
            max_time: 0.0,
        }
    }

    /// Sets the view boundaries based on the active canvas dimensions and data range.
    #[wasm_bindgen]
    pub fn set_view_bounds(&mut self, width: f32, height: f32, min_p: f32, max_p: f32, min_t: f64, max_t: f64) {
        self.width = width;
        self.height = height;
        self.min_price = min_p;
        self.max_price = max_p;
        self.min_time = min_t;
        self.max_time = max_t;
    }

    /// Translates raw financial data (Price/Time) into 2D Screen Coordinates (X/Y Float32Array)
    /// This happens natively in WASM, bypassing slow JS mapping loops.
    /// Returns interleaved [X, Y, X, Y...] array for instant WebGL/WebGPU buffer loading.
    #[wasm_bindgen]
    pub fn translate_to_screen_coords(&self, prices: &[f32], timestamps: &[f64]) -> Vec<f32> {
        let count = prices.len();
        let mut screen_coords = Vec::with_capacity(count * 2);
        
        let price_range = self.max_price - self.min_price;
        let time_range = self.max_time - self.min_time;

        for i in 0..count {
            let p = prices[i];
            let t = timestamps[i];

            // Normalize X (Time) and scale to width
            let x = if time_range > 0.0 {
                ((t - self.min_time) / time_range) as f32 * self.width
            } else {
                0.0
            };

            // Normalize Y (Price) and scale to height (Inverted Y for screen space)
            let y = if price_range > 0.0 {
                self.height - (((p - self.min_price) / price_range) * self.height)
            } else {
                0.0
            };

            screen_coords.push(x);
            screen_coords.push(y);
        }

        screen_coords
    }
}
