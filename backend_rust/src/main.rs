use axum::{
    extract::{ws::{WebSocket, WebSocketUpgrade, Message}, Query, State},
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::time::{sleep, Duration};
use tower_http::cors::CorsLayer;

mod arbitrage;
mod smart_order_router;
mod ai_supervisor;
mod binary_translator;
mod rate_limit_shield;
mod ring_buffer;
mod indicators;
mod dedup_storage;
mod backtester;

use smart_order_router::SmartOrderRouter;
use ai_supervisor::AiSupervisor;
use rate_limit_shield::RateLimitShield;
use ring_buffer::RingBuffer;
use dedup_storage::DeduplicatedStorage;
use binary_translator::{BinaryCandle, pack_candles_to_binary_stream};
use backtester::{BacktestRequest, BacktestResult, run_backtest};

struct AppState {
    smart_router: SmartOrderRouter,
    ai_supervisor: AiSupervisor,
    ring_buffer: RingBuffer,
    dedup_storage: DeduplicatedStorage,
}

#[derive(Deserialize)]
struct IndicatorRequest {
    prices: Vec<f32>,
    indicator: String,
    period: usize,
}

#[derive(Deserialize)]
struct StorageQueryParam {
    start_ts: Option<u32>,
    end_ts: Option<u32>,
}

#[derive(Serialize)]
struct ShieldStatusResponse {
    current_weight: u32,
    max_weight: u32,
    shield_active: bool,
}

#[derive(Serialize)]
struct StorageStatsResponse {
    total_deduplicated_candles: usize,
}

#[tokio::main]
async fn main() {
    let storage = DeduplicatedStorage::new();

    // Populate initial sample candles with timestamp index
    let mut initial_candles = Vec::new();
    for i in 0..1000 {
        let price = 60000.0 + (i as f32 * 0.5);
        let ts = 1700000000.0 + (i as f32 * 60.0);
        initial_candles.push(BinaryCandle::new(price, price + 5.0, price - 5.0, price + 2.0, ts));
    }
    storage.ingest_bulk(&initial_candles);

    let state = Arc::new(AppState {
        smart_router: SmartOrderRouter::new(),
        ai_supervisor: AiSupervisor::new(),
        ring_buffer: RingBuffer::new(5000),
        dedup_storage: storage,
    });

    let cors = CorsLayer::permissive();

    let app = Router::new()
        .route("/", get(|| async { "QuantaAI Ultra-Fast Binary & WebSocket Rust Engine Running on Port 3030!" }))
        .route("/api/v1/binary/history", get(get_binary_history_handler))
        .route("/api/v1/binary/stream", get(ws_binary_stream_handler))
        .route("/api/v1/shield/status", get(get_shield_status_handler))
        .route("/api/v1/indicators/compute", post(compute_indicator_handler))
        .route("/api/v1/storage/ingest", post(ingest_candles_handler))
        .route("/api/v1/storage/query", get(query_storage_handler))
        .route("/api/v1/storage/stats", get(storage_stats_handler))
        .route("/api/v1/backtest/run", post(run_backtest_handler))
        .layer(cors)
        .with_state(state);

    let port = 3030;
    println!("🚀 [Rust Engine] Dual Stream & Deduplicated Storage Server running on 0.0.0.0:{}", port);

    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", port)).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

async fn get_binary_history_handler(
    State(state): State<Arc<AppState>>,
) -> Vec<u8> {
    let candles = state.dedup_storage.get_all();
    pack_candles_to_binary_stream(&candles)
}

/// WebSocket binary stream handler sending 20-byte packed binary frames to client
async fn ws_binary_stream_handler(
    ws: WebSocketUpgrade,
    State(state): State<Arc<AppState>>,
) -> impl axum::response::IntoResponse {
    ws.on_upgrade(|socket| handle_websocket_stream(socket, state))
}

async fn handle_websocket_stream(mut socket: WebSocket, state: Arc<AppState>) {
    let mut base_price = 65000.0f32;
    let mut step = 0;

    loop {
        step += 1;
        base_price += (step as f32 % 3.0) - 1.0;
        let ts = 1700000000.0 + (step as f32 * 60.0);
        let candle = BinaryCandle::new(base_price, base_price + 3.0, base_price - 3.0, base_price + 1.0, ts);
        
        state.dedup_storage.ingest_candle(candle);

        let binary_bytes = candle.to_bytes().to_vec();
        if socket.send(Message::Binary(binary_bytes)).await.is_err() {
            break; // Client disconnected
        }

        sleep(Duration::from_millis(500)).await; // 500ms high-frequency tick stream
    }
}

async fn get_shield_status_handler() -> Json<ShieldStatusResponse> {
    let mut shield = RateLimitShield::new();
    shield.record_weight(10);
    let (weight, max_weight, shield_active) = shield.get_status();
    Json(ShieldStatusResponse {
        current_weight: weight,
        max_weight,
        shield_active,
    })
}

async fn compute_indicator_handler(
    Json(payload): Json<IndicatorRequest>,
) -> Json<indicators::IndicatorResult> {
    let values = match payload.indicator.to_lowercase().as_str() {
        "rsi" => indicators::calculate_rsi(&payload.prices, payload.period),
        "ema" => indicators::calculate_ema(&payload.prices, payload.period),
        _ => indicators::calculate_sma(&payload.prices, payload.period),
    };
    Json(indicators::IndicatorResult {
        name: payload.indicator,
        values,
    })
}

async fn ingest_candles_handler(
    State(state): State<Arc<AppState>>,
    Json(candles): Json<Vec<BinaryCandle>>,
) -> Json<usize> {
    let added = state.dedup_storage.ingest_bulk(&candles);
    Json(added)
}

async fn query_storage_handler(
    State(state): State<Arc<AppState>>,
    Query(params): Query<StorageQueryParam>,
) -> Vec<u8> {
    let start = params.start_ts.unwrap_or(0);
    let end = params.end_ts.unwrap_or(u32::MAX);
    let candles = state.dedup_storage.query_range(start, end);
    pack_candles_to_binary_stream(&candles)
}

async fn storage_stats_handler(
    State(state): State<Arc<AppState>>,
) -> Json<StorageStatsResponse> {
    Json(StorageStatsResponse {
        total_deduplicated_candles: state.dedup_storage.total_count(),
    })
}

async fn run_backtest_handler(
    State(state): State<Arc<AppState>>,
    Json(req): Json<BacktestRequest>,
) -> Json<BacktestResult> {
    let candles = state.dedup_storage.get_all();
    let result = run_backtest(&candles, &req);
    Json(result)
}
