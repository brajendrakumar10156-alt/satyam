use serde_json::Value;
use tauri::{AppHandle, Emitter, State, Manager};
use tauri::ipc::Response;
use std::sync::Arc;
use tokio::sync::Mutex;
use std::collections::HashMap;
use tokio_tungstenite::connect_async;
use futures_util::{StreamExt, SinkExt};
use tokio_tungstenite::tungstenite::Message;

mod mmap_storage;

struct WsState {
    subscriptions: Arc<Mutex<HashMap<String, tokio::task::JoinHandle<()>>>>,
}

#[tauri::command]
async fn subscribe_ws(
    id: String,
    url: String,
    subscribe_payloads: Option<Vec<String>>,
    app_handle: AppHandle,
    state: State<'_, WsState>,
) -> Result<(), String> {
    let mut subs = state.subscriptions.lock().await;
    
    if let Some(existing) = subs.remove(&id) {
        existing.abort();
    }
    
    let id_clone = id.clone();
    let handle = tokio::spawn(async move {
        let (ws_stream, _) = match connect_async(&url).await {
            Ok(s) => s,
            Err(e) => {
                log::error!("WebSocket connect error: {}", e);
                let _ = app_handle.emit(&format!("ws-status-{}", id_clone), "Polling");
                return;
            }
        };
        
        let _ = app_handle.emit(&format!("ws-status-{}", id_clone), "Connected");
        
        let (mut write, mut read) = ws_stream.split();
        
        if let Some(payloads) = subscribe_payloads {
            for payload in payloads {
                if write.send(Message::Text(payload.into())).await.is_err() {
                    break;
                }
            }
        }
        
        while let Some(msg) = read.next().await {
            match msg {
                Ok(Message::Text(text)) => {
                    let _ = app_handle.emit(&format!("ws-message-{}", id_clone), text.to_string());
                }
                Ok(Message::Close(_)) => {
                    break;
                }
                Err(_) => {
                    break;
                }
                _ => {}
            }
        }
        
        let _ = app_handle.emit(&format!("ws-status-{}", id_clone), "Reconnecting");
    });
    
    subs.insert(id, handle);
    
    Ok(())
}

#[tauri::command]
async fn unsubscribe_ws(
    id: String,
    state: State<'_, WsState>,
) -> Result<(), String> {
    let mut subs = state.subscriptions.lock().await;
    if let Some(handle) = subs.remove(&id) {
        handle.abort();
    }
    Ok(())
}

#[tauri::command]
async fn fetch_market_data(symbol: String, _interval: String, limit: u32) -> Result<Response, String> {
    // Route historical fetch to our Master Rust Collector (Central Storage)
    let url = format!("http://127.0.0.1:8080/api/history?symbol={}&limit={}", symbol.to_uppercase(), limit);
    let resp = reqwest::get(&url).await.map_err(|e| e.to_string())?;
    
    let json_resp: Value = resp.json().await.map_err(|e| e.to_string())?;
    let klines = json_resp.get("candles").and_then(|v| v.as_array()).ok_or("Invalid format from Master Collector")?;
    
    let mut data: Vec<f32> = Vec::with_capacity(klines.len() * 5);
    
    for k in klines {
        // Master Collector format: { open, high, low, close, time }
        let time = k.get("time").and_then(|v| v.as_f64()).unwrap_or(0.0) as f32;
        let open = k.get("open").and_then(|v| v.as_f64()).unwrap_or(0.0) as f32;
        let high = k.get("high").and_then(|v| v.as_f64()).unwrap_or(0.0) as f32;
        let low = k.get("low").and_then(|v| v.as_f64()).unwrap_or(0.0) as f32;
        let close = k.get("close").and_then(|v| v.as_f64()).unwrap_or(0.0) as f32;
        
        data.push(open);
        data.push(high);
        data.push(low);
        data.push(close);
        data.push(time);
    }
    
    let byte_len = data.len() * std::mem::size_of::<f32>();
    let ptr = data.as_mut_ptr() as *mut u8;
    
    let bytes = unsafe {
        let b = Vec::from_raw_parts(ptr, byte_len, byte_len);
        std::mem::forget(data);
        b
    };
    
    Ok(Response::new(bytes))
}

#[tauri::command]
fn get_candles_binary() -> Response {
    let count = 100_000;
    let mut data: Vec<f32> = Vec::with_capacity(count * 5);
    let mut time = 1700000000.0;
    let mut price = 50000.0;
    for _ in 0..count {
        data.push(price); // open
        data.push(price + 50.0); // high
        data.push(price - 50.0); // low
        data.push(price + 10.0); // close
        data.push(time); // time
        price += 10.0;
        time += 60.0;
    }
    let byte_len = data.len() * std::mem::size_of::<f32>();
    let ptr = data.as_mut_ptr() as *mut u8;
    unsafe {
        let b = Vec::from_raw_parts(ptr, byte_len, byte_len);
        std::mem::forget(data);
        Response::new(b)
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      app.manage(WsState {
          subscriptions: Arc::new(Mutex::new(HashMap::new())),
      });
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
        get_candles_binary, 
        fetch_market_data,
        subscribe_ws,
        unsubscribe_ws,
        mmap_storage::save_candles_to_binary_file,
        mmap_storage::load_mmap_candles
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
