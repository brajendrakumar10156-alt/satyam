use wasm_bindgen::prelude::*;
use web_sys::{HtmlCanvasElement, WebGlRenderingContext};

#[wasm_bindgen]
pub struct ChartEngine {
    canvas: HtmlCanvasElement,
    gl: WebGlRenderingContext,
}

#[wasm_bindgen]
impl ChartEngine {
    #[wasm_bindgen(constructor)]
    pub fn new(canvas: HtmlCanvasElement) -> Result<ChartEngine, JsValue> {
        let gl = canvas
            .get_context("webgl")?
            .unwrap()
            .dyn_into::<WebGlRenderingContext>()?;

        // Initialize WebGL clear color
        gl.clear_color(0.0, 0.0, 0.0, 1.0);
        gl.clear(WebGlRenderingContext::COLOR_BUFFER_BIT);

        Ok(ChartEngine { canvas, gl })
    }

    #[wasm_bindgen]
    pub fn render_candles(&self, candles_array: &[f32]) {
        // High-performance Rust WebGL rendering loop will go here
        self.gl.clear_color(0.08, 0.1, 0.14, 1.0); // Dark theme background
        self.gl.clear(WebGlRenderingContext::COLOR_BUFFER_BIT);
        
        web_sys::console::log_1(&"Rendering candles via Rust WebGL engine!".into());
        // TODO: Map Float32Array directly into WebGL vertex buffer and draw triangles
    }
}
