/**
 * BinanceShieldService — Ultra-Fast Dual Stream, Rate Limit Protection & IP Block Emergency Failover
 * 
 * Logic:
 * 1. Connects to BOTH Binance Live Stream & Rust Server Live Stream simultaneously.
 * 2. Renders whichever tick/candle arrives FIRST (Race condition winner for minimum latency).
 * 3. Pre-Emptive 4-Step Disconnect: Disconnects Binance 4 steps before reaching API weight cap.
 * 4. Emergency IP Block Failover: If Binance EVER returns 429 (Rate Limit), 418 (IP Ban), 403, or Network Error,
 *    IMMEDIATELY mark Binance as BLOCKED and permanently route ALL requests to YOUR RUST SERVER!
 */

export interface KlineCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  source?: 'binance' | 'rust';
}

export class BinanceShieldService {
  private static weightUsed = 0;
  private static readonly MAX_WEIGHT = 1200;
  private static readonly DISCONNECT_THRESHOLD = 1180; // (4 steps before cap)
  private static isBinanceDisconnected = false;
  private static isBinanceBlockedByIP = false; // Emergency flag for 429/418/403 IP block
  private static resetTimer: any = null;

  /**
   * Called whenever a Binance request fails with 429, 418, 403, or Network Error.
   * Instantly locks Binance out and routes 100% traffic to YOUR Rust Server.
   */
  public static triggerEmergencyIPBlockFailover(reason: string) {
    console.error(`🚨 [BinanceShield] EMERGENCY FAILOVER TRIGGERED! Binance blocked/errored: "${reason}". Routing 100% traffic to YOUR RUST SERVER!`);
    this.isBinanceBlockedByIP = true;
    this.isBinanceDisconnected = true;
  }

  /**
   * Track request weight. Disconnects Binance 4 steps before cap.
   */
  public static trackRequestWeight(weight: number): boolean {
    if (this.isBinanceBlockedByIP) return true; // Always route to server if blocked

    this.weightUsed += weight;

    if (!this.resetTimer) {
      this.resetTimer = setTimeout(() => {
        this.resetWeightBudget();
      }, 60000);
    }

    if (this.weightUsed >= this.DISCONNECT_THRESHOLD) {
      if (!this.isBinanceDisconnected) {
        console.warn(`🛑 [BinanceShield] 4 STEPS BEFORE LIMIT REACHED! (${this.weightUsed}/${this.MAX_WEIGHT} weight). Disconnecting Binance NOW & switching 100% to YOUR Rust Server!`);
        this.isBinanceDisconnected = true;
      }
    }
    return this.isBinanceDisconnected;
  }

  public static shouldRouteToRustServer(): boolean {
    return this.isBinanceDisconnected || this.isBinanceBlockedByIP;
  }

  public static isBinanceActive(): boolean {
    return !this.isBinanceDisconnected && !this.isBinanceBlockedByIP;
  }

  public static resetWeightBudget() {
    if (this.isBinanceBlockedByIP) {
      console.warn(`[BinanceShield] Binance is IP Blocked. Keeping traffic on YOUR Rust Server for safety.`);
      return;
    }
    console.log(`[BinanceShield] 1-Minute window reset. Weight budget restored.`);
    this.weightUsed = 0;
    this.isBinanceDisconnected = false;
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }
  }

  /**
   * Dual Parallel Stream Manager:
   * Races Binance vs Rust stream, renders whichever arrives FIRST.
   * If Binance is blocked or rate-limited, routes 100% to YOUR Rust Server.
   */
  public static createDualParallelStream(
    symbol: string,
    onCandleReceived: (candle: KlineCandle) => void
  ): () => void {
    let lastRenderedTime = 0;

    // 1. YOUR RUST SERVER WebSocket / Binary IPC Stream (Primary Reliable Stream)
    const rustWs = new WebSocket('ws://127.0.0.1:3030/api/v1/binary/stream');
    rustWs.binaryType = 'arraybuffer';

    rustWs.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        const floatArray = new Float32Array(event.data);
        if (floatArray.length >= 5) {
          const candle: KlineCandle = {
            open: floatArray[0],
            high: floatArray[1],
            low: floatArray[2],
            close: floatArray[3],
            time: floatArray[4],
            source: 'rust',
          };
          if (candle.time >= lastRenderedTime) {
            lastRenderedTime = candle.time;
            onCandleReceived(candle);
          }
        }
      }
    };

    // 2. Binance Live Stream (Only if NOT blocked by IP and NOT rate-limited)
    let binanceWs: WebSocket | null = null;
    if (this.isBinanceActive()) {
      const binanceSymbol = symbol.toLowerCase();
      binanceWs = new WebSocket(`wss://stream.binance.com:9443/ws/${binanceSymbol}@kline_1m`);

      binanceWs.onmessage = (event) => {
        if (!this.isBinanceActive()) {
          if (binanceWs) {
            console.log('[BinanceShield] Closing Binance WebSocket. Handing over 100% to YOUR Rust Server.');
            binanceWs.close();
            binanceWs = null;
          }
          return;
        }

        try {
          const msg = JSON.parse(event.data);
          if (msg.k) {
            const k = msg.k;
            const candle: KlineCandle = {
              time: Math.floor(k.t / 1000),
              open: parseFloat(k.o),
              high: parseFloat(k.h),
              low: parseFloat(k.l),
              close: parseFloat(k.c),
              volume: parseFloat(k.v),
              source: 'binance',
            };
            if (candle.time >= lastRenderedTime) {
              lastRenderedTime = candle.time;
              onCandleReceived(candle);
            }
          }
        } catch (e) { /* ignore parse error */ }
      };

      binanceWs.onerror = () => {
        this.triggerEmergencyIPBlockFailover('WebSocket connection error / IP Block');
      };
    }

    return () => {
      if (rustWs && rustWs.readyState === WebSocket.OPEN) rustWs.close();
      if (binanceWs && binanceWs.readyState === WebSocket.OPEN) binanceWs.close();
    };
  }
}
