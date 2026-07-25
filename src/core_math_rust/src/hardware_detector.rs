use wasm_bindgen::prelude::*;
use wasm_bindgen::JsCast;
use web_sys::window;
#[wasm_bindgen]
pub struct HardwareDetector {
    pub has_webgpu: bool,
    pub has_webgl: bool,
    pub has_webnn: bool,
    pub cpu_cores: u32,
    pub has_sab: bool,
}

#[wasm_bindgen]
impl HardwareDetector {
    #[wasm_bindgen(constructor)]
    pub fn new() -> HardwareDetector {
        HardwareDetector {
            has_webgpu: false,
            has_webgl: false,
            has_webnn: false,
            cpu_cores: 1,
            has_sab: false,
        }
    }

    #[wasm_bindgen]
    pub fn detect_sync(&mut self) {
        if let Some(win) = window() {
            // Detect WebGPU (navigator.gpu)
            let navigator = win.navigator();
            // Check if gpu property exists dynamically (web_sys doesn't have it natively exposed on all versions yet)
            let nav_val = JsValue::from(navigator.clone());
            if js_sys::Reflect::has(&nav_val, &JsValue::from_str("gpu")).unwrap_or(false) {
                self.has_webgpu = true;
            }

            // Check WebNN (navigator.ml)
            if js_sys::Reflect::has(&nav_val, &JsValue::from_str("ml")).unwrap_or(false) {
                self.has_webnn = true;
            }

            self.cpu_cores = navigator.hardware_concurrency() as u32;

            // Detect WebGL
            if let Some(document) = win.document() {
                if let Ok(canvas) = document.create_element("canvas") {
                    if let Ok(canvas_el) = canvas.dyn_into::<web_sys::HtmlCanvasElement>() {
                        if let Ok(Some(_gl)) = canvas_el.get_context("webgl2") {
                            self.has_webgl = true;
                        }
                    }
                }
            }

            // Check SharedArrayBuffer
            let global = js_sys::global();
            if js_sys::Reflect::has(&global, &JsValue::from_str("SharedArrayBuffer")).unwrap_or(false) {
                self.has_sab = true;
            }
        }
    }
}
