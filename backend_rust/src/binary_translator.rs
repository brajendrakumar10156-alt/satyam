use serde::{Deserialize, Serialize};

/// 20-Byte Binary Candle Structure (4 x f32 + 1 x u32 = 20 Bytes)
/// Packing: [open (4b), high (4b), low (4b), close (4b), time (4b u32 Little-Endian)]
#[repr(C, packed)]
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct BinaryCandle {
    pub open: f32,
    pub high: f32,
    pub low: f32,
    pub close: f32,
    pub time: u32, // Exact Unix timestamp in seconds (u32 integer)
}

impl BinaryCandle {
    pub fn new(open: f32, high: f32, low: f32, close: f32, time: f32) -> Self {
        Self { open, high, low, close, time: time as u32 }
    }

    pub fn new_u32(open: f32, high: f32, low: f32, close: f32, time: u32) -> Self {
        Self { open, high, low, close, time }
    }

    /// Serialize struct directly into raw Little-Endian bytes for ultra-fast transfer
    pub fn to_bytes(&self) -> [u8; 20] {
        let mut bytes = [0u8; 20];
        bytes[0..4].copy_from_slice(&self.open.to_le_bytes());
        bytes[4..8].copy_from_slice(&self.high.to_le_bytes());
        bytes[8..12].copy_from_slice(&self.low.to_le_bytes());
        bytes[12..16].copy_from_slice(&self.close.to_le_bytes());
        bytes[16..20].copy_from_slice(&self.time.to_le_bytes());
        bytes
    }

    /// Unpack 20 raw bytes back into BinaryCandle
    pub fn from_bytes(bytes: &[u8; 20]) -> Self {
        let open = f32::from_le_bytes(bytes[0..4].try_into().unwrap());
        let high = f32::from_le_bytes(bytes[4..8].try_into().unwrap());
        let low = f32::from_le_bytes(bytes[8..12].try_into().unwrap());
        let close = f32::from_le_bytes(bytes[12..16].try_into().unwrap());
        let time = u32::from_le_bytes(bytes[16..20].try_into().unwrap());
        Self { open, high, low, close, time }
    }
}

/// Packs an array of BinaryCandles into a single raw byte vector (N * 20 bytes)
pub fn pack_candles_to_binary_stream(candles: &[BinaryCandle]) -> Vec<u8> {
    let mut buffer = Vec::with_capacity(candles.len() * 20);
    for candle in candles {
        buffer.extend_from_slice(&candle.to_bytes());
    }
    buffer
}
