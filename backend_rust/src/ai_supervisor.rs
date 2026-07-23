use serde::{Deserialize, Serialize};
use reqwest::Client;

#[derive(Serialize)]
struct OllamaRequest {
    model: String,
    prompt: String,
    stream: bool,
}

#[derive(Deserialize, Debug)]
pub struct OllamaResponse {
    pub response: String,
}

pub struct AiSupervisor {
    client: Client,
    model: String,
    ollama_url: String,
}

impl AiSupervisor {
    pub fn new() -> Self {
        Self {
            client: Client::new(),
            model: "qwen2.5-coder:7b".to_string(),
            ollama_url: "http://127.0.0.1:11434/api/generate".to_string(),
        }
    }

    pub async fn check_risk(&self, symbol: &str, price: f64, indicator: &str, result: f64) -> Result<String, Box<dyn std::error::Error>> {
        let prompt = format!(
            "You are the Chief Risk Officer for QuantaAI, a high-frequency trading firm. \
            We are evaluating a trade for {symbol} at current price ${price}. \
            Our internal WebAssembly Math Engine calculated the {indicator} to be {result}. \
            \n\nTask 1: Is this mathematically a good setup assuming standard momentum strategies? \
            \nTask 2: Based on your internal knowledge, what is the general market sentiment and risk for {symbol}? \
            \nProvide a short, direct approval or rejection with a brief 2-3 sentence justification.",
            symbol = symbol, price = price, indicator = indicator, result = result
        );

        let req_body = OllamaRequest {
            model: self.model.clone(),
            prompt,
            stream: false,
        };

        let res = self.client.post(&self.ollama_url)
            .json(&req_body)
            .send()
            .await?;

        if res.status().is_success() {
            let ollama_res: OllamaResponse = res.json().await?;
            Ok(ollama_res.response)
        } else {
            let status = res.status();
            let text = res.text().await?;
            Err(format!("Ollama API Error: {} - {}", status, text).into())
        }
    }
}
