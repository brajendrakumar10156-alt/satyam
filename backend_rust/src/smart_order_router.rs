use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};
use chrono::Local;
use std::thread;
use std::time::Duration;

#[derive(Serialize, Deserialize, Clone)]
pub struct OrderSlice {
    pub order_id: String,
    pub symbol: String,
    pub side: String,
    pub slice: u32,
    pub total_slices: u32,
    pub slice_qty: f64,
    pub status: String,
    pub timestamp: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct IcebergResult {
    pub status: String,
    pub total_executed: f64,
    pub slices: u32,
    pub orders: Vec<OrderSlice>,
}

pub struct SmartOrderRouter {
    // In a real app, you would keep track of active orders here
    // pub active_orders: Vec<String>,
}

impl SmartOrderRouter {
    pub fn new() -> Self {
        Self {}
    }

    pub fn execute_iceberg_order(&self, symbol: &str, side: &str, total_qty: f64, slices: u32) -> IcebergResult {
        let slices_safe = if slices == 0 { 1 } else { slices };
        let slice_qty = total_qty / slices_safe as f64;
        let mut execution_log = Vec::new();

        for i in 0..slices_safe {
            let start = SystemTime::now();
            let since_the_epoch = start.duration_since(UNIX_EPOCH).expect("Time went backwards");
            let ms = since_the_epoch.as_millis();
            
            let order_id = format!("ICEBERG-{}-{}", ms, i + 1);
            let timestamp = Local::now().format("%H:%M:%S IST").to_string();

            execution_log.push(OrderSlice {
                order_id,
                symbol: symbol.to_uppercase(),
                side: side.to_uppercase(),
                slice: i + 1,
                total_slices: slices_safe,
                slice_qty: (slice_qty * 10000.0).round() / 10000.0,
                status: "FILLED".to_string(),
                timestamp,
            });

            // Simulated microsecond exchange delay
            thread::sleep(Duration::from_millis(10));
        }

        IcebergResult {
            status: "ICEBERG_COMPLETED".to_string(),
            total_executed: total_qty,
            slices: slices_safe,
            orders: execution_log,
        }
    }
}
