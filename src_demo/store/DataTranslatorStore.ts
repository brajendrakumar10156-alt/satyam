// DataTranslatorStore.ts
// Unified State Manager for Multi-Engine Charting
// This completely decouples data from App.tsx React State so that WebWorkers, Rust WASM, and Renderers can access raw memory directly without React re-render lag.

type Listener = () => void;

class DataTranslatorStore {
  private listeners: Set<Listener> = new Set();
  
  // Core Data Arrays
  public candles: any[] = [];
  public drawings: any[] = [];
  public visualIndicators: any[] = [];
  
  // Market State
  public livePrice: number = 0;
  
  // Subscribe to changes (React hook integration)
  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  
  private notify() {
    this.listeners.forEach(l => l());
  }

  // --- Mutators ---
  setCandles(newCandles: any[]) {
    this.candles = newCandles;
    this.notify();
  }

  appendCandles(newCandles: any[]) {
    // Highly optimized append for WebSockets
    this.candles.push(...newCandles);
    this.notify();
  }

  setLivePrice(price: number) {
    this.livePrice = price;
    this.notify();
  }

  setDrawings(drawings: any[]) {
    this.drawings = drawings;
    this.notify();
  }

  setVisualIndicators(indicators: any[]) {
    this.visualIndicators = indicators;
    this.notify();
  }

  // --- Translators Access (Bridging to Rust WASM or Compute Shaders) ---
  
  /**
   * Translates current drawing time/price coordinates into screen space
   * using the Rust WASM UniversalTranslator
   */
  getTranslatedDrawings(width: number, height: number, minTime: number, maxTime: number, minPrice: number, maxPrice: number) {
    // This will interface with `src_demo/core_math_rust/src/universal_translator.rs`
    // Placeholder until WASM bindings are fully imported in the UI thread
    return this.drawings; 
  }
}

export const dataStore = new DataTranslatorStore();

// Custom React Hook to safely access the fast-updating store
import { useSyncExternalStore } from 'react';

export function useDataStore() {
  return useSyncExternalStore(
    (l) => dataStore.subscribe(l),
    () => dataStore
  );
}
