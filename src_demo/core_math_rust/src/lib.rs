pub mod hardware_detector;
pub mod orchestrator;
pub mod universal_translator;
pub mod math_indicators;
pub mod data_splicer;

use wasm_bindgen::prelude::*;

// Expose them to JS
pub use hardware_detector::HardwareDetector;
pub use orchestrator::OmniOrchestrator;
pub use universal_translator::UniversalTranslator;
pub use math_indicators::CPUMathEngine;
pub use data_splicer::NativeDataSplicer;

#[wasm_bindgen(start)]
pub fn main_js() -> Result<(), JsValue> {
    // This provides better error messages in debug mode.
    // It's optional, but helpful for WASM development.
    #[cfg(debug_assertions)]
    console_error_panic_hook::set_once();
    
    Ok(())
}
