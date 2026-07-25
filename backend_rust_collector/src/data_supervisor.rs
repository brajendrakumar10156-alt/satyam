use std::fs;
use std::path::{Path, PathBuf};
use std::io::Read;

pub fn get_storage_dir() -> PathBuf {
    let dir = PathBuf::from(r"C:\Users\satya\OneDrive\Documents\Desktop\satyam\market_data");
    fs::create_dir_all(&dir).unwrap_or_default();
    dir
}

fn guess_timeframe_from_file(path: &Path) -> Option<String> {
    if let Ok(mut file) = fs::File::open(path) {
        let mut buffer = [0u8; 200]; // read up to 10 candles
        if let Ok(bytes_read) = file.read(&mut buffer) {
            let record_size = 20;
            let records = bytes_read / record_size;
            if records >= 2 {
                let mut min_diff = u32::MAX;
                for i in 1..records {
                    let off1 = (i - 1) * record_size;
                    let off2 = i * record_size;
                    let t1 = u32::from_le_bytes(buffer[off1+16..off1+20].try_into().unwrap_or([0;4]));
                    let t2 = u32::from_le_bytes(buffer[off2+16..off2+20].try_into().unwrap_or([0;4]));
                    let diff = t2.saturating_sub(t1);
                    if diff > 0 && diff < min_diff {
                        min_diff = diff;
                    }
                }
                
                let tf = match min_diff {
                    1 => "1s",
                    60 => "1m",
                    180 => "3m",
                    300 => "5m",
                    900 => "15m",
                    1800 => "30m",
                    3600 => "1h",
                    7200 => "2h",
                    14400 => "4h",
                    21600 => "6h",
                    28800 => "8h",
                    43200 => "12h",
                    86400 => "1d",
                    259200 => "3d",
                    604800 => "1w",
                    _ if min_diff >= 2419200 && min_diff <= 2678400 => "1M",
                    _ => "1m",
                };
                return Some(tf.to_string());
            }
        }
    }
    Some("1m".to_string())
}

fn expected_gap_for_timeframe(tf: &str) -> u32 {
    match tf {
        "1s" => 1,
        "1m" => 60,
        "3m" => 180,
        "5m" => 300,
        "15m" => 900,
        "30m" => 1800,
        "1h" => 3600,
        "2h" => 7200,
        "4h" => 14400,
        "6h" => 21600,
        "8h" => 28800,
        "12h" => 43200,
        "1d" => 86400,
        "3d" => 259200,
        "1w" => 604800,
        "1M" => 2592000,
        _ => 60,
    }
}

pub fn run_data_supervisor() {
    println!("[Data Supervisor] Starting integrity check and folder restructuring for all timeframes...");
    
    let storage_dir = get_storage_dir();

    // 1. Move legacy files from root to their respective timeframe folders
    if let Ok(entries) = fs::read_dir(&storage_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("iqbin") {
                if let Some(file_name) = path.file_name() {
                    let tf = guess_timeframe_from_file(&path).unwrap_or_else(|| "1m".to_string());
                    let tf_dir = storage_dir.join(&tf);
                    fs::create_dir_all(&tf_dir).unwrap_or_default();
                    let new_path = tf_dir.join(file_name);
                    println!("[Data Supervisor] Moving legacy file {:?} to {:?}", path, new_path);
                    let _ = fs::rename(&path, &new_path);
                }
            }
        }
    }

    // 2. Scan ALL timeframe directories for gaps and corruption
    if let Ok(entries) = fs::read_dir(&storage_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                let tf = path.file_name().unwrap_or_default().to_string_lossy().to_string();
                let expected_gap = expected_gap_for_timeframe(&tf);
                
                if let Ok(sub_entries) = fs::read_dir(&path) {
                    for sub_entry in sub_entries.flatten() {
                        let sub_path = sub_entry.path();
                        if sub_path.is_file() && sub_path.extension().and_then(|s| s.to_str()) == Some("iqbin") {
                            if let Some(stem) = sub_path.file_stem().and_then(|s| s.to_str()) {
                                let symbol = stem.to_uppercase();
                                check_file_integrity(&sub_path, &symbol, &tf, expected_gap);
                            }
                        }
                    }
                }
            }
        }
    }
    
    println!("[Data Supervisor] Integrity check completed.");
}

fn check_file_integrity(path: &Path, symbol: &str, tf: &str, expected_gap: u32) {
    if let Ok(mut file) = fs::File::open(path) {
        let mut buffer = Vec::new();
        if file.read_to_end(&mut buffer).is_ok() {
            let record_size = 20; // 4 * f32 + 1 * u32
            let total_records = buffer.len() / record_size;
            
            let mut last_time = 0;
            let mut gaps_found = 0;
            
            for i in 0..total_records {
                let off = i * record_size;
                let time = u32::from_le_bytes(buffer[off+16..off+20].try_into().unwrap_or([0;4]));
                
                if i > 0 {
                    let diff = time.saturating_sub(last_time);
                    if diff > expected_gap * 10 { // If gap is more than 10 candles
                        println!("[Data Supervisor] Missing Data / Corruption in {} ({}): Gap from timestamp {} to {} ({} seconds)", symbol, tf, last_time, time, diff);
                        gaps_found += 1;
                    }
                }
                last_time = time;
            }
            if gaps_found > 0 {
                println!("[Data Supervisor] Total {} significant gaps found in {} ({}).", gaps_found, symbol, tf);
            }
        }
    }
}
