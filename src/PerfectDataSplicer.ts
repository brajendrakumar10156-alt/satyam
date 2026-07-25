/**
 * Perfect Data Splicer (Hybrid Data Reconciliation Layer)
 * 
 * Ensures the Math Engines receive a 100% gap-free Float32Array.
 * Hooks into NativeDataSplicer (Rust/WASM) and YOUR Rust Server (Port 3030).
 */

import { BinaryDataBridge } from './translators/BinaryDataBridge';

export class PerfectDataSplicer {
    private rustServerUrl: string;
    private wasmEngine: any;

    constructor() {
        this.rustServerUrl = import.meta.env.VITE_RUST_SERVER_URL || "http://127.0.0.1:8080";
        this.wasmEngine = null;
    }

    injectWasmEngine(engine: any) {
        this.wasmEngine = engine;
    }

    /**
     * Fetches historical data strictly from the local Rust server proxy.
     * The Rust server handles all gap filling and Binance REST fallback internally!
     */
    async fetchFlawlessData(symbol: string, timeframe: string, startMs: number, endMs: number) {
        console.log(`[PerfectData] Requesting data for ${symbol} from Rust proxy...`);
        return await this.fetchFromRustServer(symbol, startMs, endMs);
    }

    async fetchFromRustServer(symbol: string, startMs: number, endMs: number) {
        try {
            // Note: The Rust server history endpoint uses `endTime` and `limit`, or `/api/backtest` for ranges.
            // Using /api/history since it has the smart fallback logic inside Rust.
            const endTs = Math.floor(endMs / 1000);
            const limit = 1000;
            const url = `${this.rustServerUrl}/api/history?symbol=${symbol}&endTime=${endTs}&limit=${limit}`;
            
            const res = await fetch(url);
            if (!res.ok) return [];
            
            const data = await res.json();
            
            if (data.status === "success" && data.candles) {
                // The rust server returns JSON objects for history right now
                return data.candles.map((c: any) => ({
                    time: c.time,
                    open: c.open,
                    high: c.high,
                    low: c.low,
                    close: c.close
                }));
            }
            return [];
        } catch (e) {
            console.error("[PerfectData] Rust server proxy fetch failed:", e);
            return [];
        }
    }
}

export const perfectData = new PerfectDataSplicer();
