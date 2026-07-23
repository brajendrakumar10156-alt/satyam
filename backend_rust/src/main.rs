use axum::{
    routing::{get, post},
    Router, Json,
};
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use std::sync::Arc;

mod arbitrage;
mod smart_order_router;
mod ai_supervisor;

use smart_order_router::SmartOrderRouter;
use ai_supervisor::AiSupervisor;

#[derive(Deserialize)]
struct ArbitrageRequest {
    exchange_a_prices: Vec<f64>,
    exchange_b_prices: Vec<f64>,
    min_spread_pct: f64,
}

#[derive(Deserialize)]
struct IcebergRequest {
    symbol: String,
    side: String,
    total_qty: f64,
    slices: u32,
}

// Shared application state
struct AppState {
    smart_router: SmartOrderRouter,
    ai_supervisor: AiSupervisor,
}

#[derive(Deserialize)]
struct AiRiskRequest {
    symbol: String,
    price: f64,
    indicator: String,
    result: f64,
}

#[derive(Serialize)]
struct AiRiskResponse {
    analysis: String,
}

#[tokio::main]
async fn main() {
    let shared_state = Arc::new(AppState {
        smart_router: SmartOrderRouter::new(),
        ai_supervisor: AiSupervisor::new(),
    });

    // Build our application with a route
    let app = Router::new()
        .route("/", get(|| async { "QuantaAI Native Rust HFT Backend Running! 🚀" }))
        .route("/api/v1/arbitrage", post(calculate_arbitrage_handler))
        .route("/api/v1/smart-order/iceberg", post(execute_iceberg_handler))
        .route("/api/v1/ai/risk-check", post(risk_check_handler))
        .with_state(shared_state);

    let port = 3030;
    println!("Starting native Rust server on port {}", port);
    
    // Bind the server to an address
    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", port)).await.unwrap();
    
    // Run our app
    axum::serve(listener, app).await.unwrap();
}

async fn calculate_arbitrage_handler(
    Json(payload): Json<ArbitrageRequest>,
) -> Json<arbitrage::ArbitrageResult> {
    
    let result = arbitrage::calculate_arbitrage_matrix(
        &payload.exchange_a_prices,
        &payload.exchange_b_prices,
        payload.min_spread_pct
    );
    
    Json(result)
}

async fn execute_iceberg_handler(
    axum::extract::State(state): axum::extract::State<Arc<AppState>>,
    Json(payload): Json<IcebergRequest>,
) -> Json<smart_order_router::IcebergResult> {
    
    let result = state.smart_router.execute_iceberg_order(
        &payload.symbol,
        &payload.side,
        payload.total_qty,
        payload.slices
    );
    
    Json(result)
}

async fn risk_check_handler(
    axum::extract::State(state): axum::extract::State<Arc<AppState>>,
    Json(payload): Json<AiRiskRequest>,
) -> Json<AiRiskResponse> {
    let analysis = match state.ai_supervisor.check_risk(&payload.symbol, payload.price, &payload.indicator, payload.result).await {
        Ok(text) => text,
        Err(e) => format!("AI Supervisor Error: {}", e),
    };
    
    Json(AiRiskResponse { analysis })
}
