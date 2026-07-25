use std::fs::{File, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use tauri::AppHandle;
use memmap2::MmapOptions;
use std::sync::Mutex;
use std::collections::HashMap;
use lazy_static::lazy_static;

lazy_static! {
    // Cache memory maps to avoid frequent re-opening
    static ref MMAP_CACHE: Mutex<HashMap<String, memmap2::Mmap>> = Mutex::new(HashMap::new());
}

/// Helper to get the correct path for a symbol's binary file
fn get_file_path(_app_handle: &AppHandle, symbol: &str) -> Result<PathBuf, String> {
    // Using a shared directory in the project root for both Collector and Tauri App
    let mut path = PathBuf::from(r"C:\Users\satya\OneDrive\Documents\Desktop\satyam\market_data");
    std::fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    
    path.push(format!("{}.iqbin", symbol.to_uppercase()));
    Ok(path)
}

/// Saves raw f32 data into the binary file
#[tauri::command]
pub async fn save_candles_to_binary_file(
    app_handle: AppHandle,
    symbol: String,
    data: Vec<f32>,
) -> Result<(), String> {
    let path = get_file_path(&app_handle, &symbol)?;
    
    // We get the raw bytes from the f32 array
    let byte_len = data.len() * std::mem::size_of::<f32>();
    let ptr = data.as_ptr() as *const u8;
    
    let bytes = unsafe { std::slice::from_raw_parts(ptr, byte_len) };
    
    let mut file = OpenOptions::new()
        .create(true)
        .write(true)
        .truncate(true)
        .open(&path)
        .map_err(|e| e.to_string())?;
        
    file.write_all(bytes).map_err(|e| e.to_string())?;
    
    // Invalidate cache
    let mut cache = MMAP_CACHE.lock().unwrap();
    cache.remove(&symbol);
    
    Ok(())
}

/// Uses mmap to read a specific chunk of candles extremely fast (zero-copy from disk to memory mapping)
#[tauri::command]
pub async fn load_mmap_candles(
    app_handle: AppHandle,
    symbol: String,
    from_idx: usize,
    count: usize,
) -> Result<Vec<u8>, String> {
    let mut cache = MMAP_CACHE.lock().unwrap();
    
    if !cache.contains_key(&symbol) {
        let path = get_file_path(&app_handle, &symbol)?;
        if !path.exists() {
            return Err("Data not found".into());
        }
        
        let file = File::open(&path).map_err(|e| e.to_string())?;
        let mmap = unsafe { MmapOptions::new().map(&file).map_err(|e| e.to_string())? };
        cache.insert(symbol.clone(), mmap);
    }
    
    let mmap = cache.get(&symbol).unwrap();
    
    let floats_per_candle = 5;
    let bytes_per_float = 4;
    let bytes_per_candle = floats_per_candle * bytes_per_float;
    
    let start_byte = from_idx * bytes_per_candle;
    let end_byte = start_byte + (count * bytes_per_candle);
    
    if start_byte >= mmap.len() {
        return Ok(vec![]);
    }
    
    let actual_end = std::cmp::min(end_byte, mmap.len());
    
    // Return a copy of the slice (which goes to JS via Tauri IPC as Uint8Array)
    Ok(mmap[start_byte..actual_end].to_vec())
}
