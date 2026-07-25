/**
 * BinaryDataBridge - Ultra-Fast Zero-Copy Binary Data Translator
 * 
 * Receives raw ArrayBuffers (20 bytes per candle: 4 x Float32 + 1 x Uint32 Little-Endian)
 * and unpacks directly into CandleData[] for WebGPU / WebGL VRAM rendering.
 */

export interface CandleData {
  open: number;
  high: number;
  low: number;
  close: number;
  time: number;
}

export class BinaryDataBridge {
  private static CANDLE_BYTE_SIZE = 20; // [4*f32 + 1*u32] = 20 Bytes

  /**
   * Precise conversion from ArrayBuffer to CandleData array handling Uint32 timestamps
   */
  public static unpackBinaryStream(buffer: ArrayBuffer): CandleData[] {
    const dataView = new DataView(buffer);
    const count = Math.floor(buffer.byteLength / this.CANDLE_BYTE_SIZE);
    const candles: CandleData[] = new Array(count);

    for (let i = 0; i < count; i++) {
      const byteOffset = i * this.CANDLE_BYTE_SIZE;
      candles[i] = {
        open: dataView.getFloat32(byteOffset, true),       // Little-Endian
        high: dataView.getFloat32(byteOffset + 4, true),   // Little-Endian
        low: dataView.getFloat32(byteOffset + 8, true),    // Little-Endian
        close: dataView.getFloat32(byteOffset + 12, true), // Little-Endian
        time: dataView.getUint32(byteOffset + 16, true),   // Little-Endian Uint32 timestamp
      };
    }
    return candles;
  }

  /**
   * Fetch binary historical candles directly from Rust Backend Server
   */
  public static async fetchBinaryHistory(serverUrl = 'http://127.0.0.1:3030/api/v1/binary/history'): Promise<CandleData[]> {
    try {
      const response = await fetch(serverUrl);
      const buffer = await response.arrayBuffer();
      return this.unpackBinaryStream(buffer);
    } catch (err) {
      console.error('[BinaryDataBridge] Failed to fetch binary stream from Rust server:', err);
      return [];
    }
  }
}
