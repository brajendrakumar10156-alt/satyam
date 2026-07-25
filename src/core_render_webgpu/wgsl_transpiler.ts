/**
 * QuantaAI — WGSL Transpiler (Pine-to-WGSL)
 * Dynamically generates WebGPU Compute Shaders from an Abstract Syntax Tree (AST).
 * Converts sequential PineScript into highly-parallel WGSL for Zero-JS Math execution.
 */

export class WGSLTranspiler {
  constructor() {
    this.shaderTemplate = `
      @group(0) @binding(0) var<storage, read> prices: array<f32>;
      @group(0) @binding(1) var<storage, read_write> out_signals: array<f32>;
      // out_signals conventions: 1.0 = BUY, -1.0 = SELL, 0.0 = HOLD
      // Or for indicators, stores the indicator value directly.

      // Dynamic Indicator Buffers
      {{BUFFER_DECLARATIONS}}

      @compute @workgroup_size(64)
      fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
          let i = global_id.x;
          let len = arrayLength(&prices);
          if (i >= len) { return; }
          
          let price = prices[i];

          // Dynamic Computation Logic
          {{COMPUTATION_LOGIC}}
      }
    `;
  }

  /**
   * Transpile AST into a complete WGSL Compute Shader string.
   * @param {Object} ast { indicators: [], entryCondition: {}, exitCondition: {} }
   * @returns {string} The raw WGSL shader code
   */
  transpile(ast) {
    let bufferDecls = "";
    let computeLogic = "";
    let bindingIndex = 2; // 0 and 1 are reserved for prices and out_signals

    // 1. Process Indicators
    for (const node of ast.indicators) {
      const bufferName = `buf_${node.id}`;
      bufferDecls += `@group(0) @binding(${bindingIndex}) var<storage, read_write> ${bufferName}: array<f32>;\n`;
      
      if (node.type === 'sma') {
        const period = node.period;
        computeLogic += `
          // SMA Calculation for ${node.id}
          if (i >= ${period - 1}u) {
              var sum: f32 = 0.0;
              for (var j: u32 = 0u; j < ${period}u; j = j + 1u) {
                  sum = sum + prices[i - j];
              }
              ${bufferName}[i] = sum / ${period}.0;
          } else {
              ${bufferName}[i] = prices[i];
          }
        `;
      } else if (node.type === 'ema') {
        const period = node.period;
        const k = 2.0 / (period + 1.0);
        // EMA is sequential, so in a parallel compute shader, we have to approximate it 
        // or calculate it using a rolling window if threads are independent.
        // For a true parallel EMA, prefix sum is needed. For this JIT prototype, we will 
        // use a windowed approximation based on the SMA over the period to make it parallelizable.
        computeLogic += `
          // EMA (Parallel Window Approximation) for ${node.id}
          if (i >= ${period - 1}u) {
              var ema: f32 = prices[i - ${period - 1}u];
              for (var j: u32 = i - ${period - 2}u; j <= i; j = j + 1u) {
                  ema = prices[j] * ${k} + ema * (1.0 - ${k});
              }
              ${bufferName}[i] = ema;
          } else {
              ${bufferName}[i] = prices[i];
          }
        `;
      } else if (node.type === 'rsi') {
          const period = node.period;
          computeLogic += `
            // RSI (Parallel Windowed) for ${node.id}
            if (i >= ${period}u) {
                var gains: f32 = 0.0;
                var losses: f32 = 0.0;
                for (var j: u32 = i - ${period}u + 1u; j <= i; j = j + 1u) {
                    let diff = prices[j] - prices[j-1u];
                    if (diff > 0.0) { gains = gains + diff; }
                    else { losses = losses - diff; }
                }
                let avgGain = gains / ${period}.0;
                let avgLoss = losses / ${period}.0;
                if (avgLoss == 0.0) {
                    ${bufferName}[i] = 100.0;
                } else {
                    ${bufferName}[i] = 100.0 - (100.0 / (1.0 + (avgGain / avgLoss)));
                }
            } else {
                ${bufferName}[i] = 50.0;
            }
          `;
      }
      bindingIndex++;
    }

    // 2. Process Crossover/Crossunder Signals
    // We only evaluate signals if we have a previous candle (i > 0)
    if (ast.entryCondition || ast.exitCondition) {
      computeLogic += `
          // Signal Evaluation Matrix
          if (i > 0u) {
              var signal: f32 = 0.0;
      `;

      if (ast.entryCondition && ast.entryCondition.type === 'crossover') {
        const fast = `buf_${ast.entryCondition.fast}`;
        const slow = `buf_${ast.entryCondition.slow}`;
        computeLogic += `
              // Crossover (BUY)
              let fast_prev = ${fast}[i-1u];
              let fast_curr = ${fast}[i];
              let slow_prev = ${slow}[i-1u];
              let slow_curr = ${slow}[i];
              if (fast_prev <= slow_prev && fast_curr > slow_curr) {
                  signal = 1.0;
              }
        `;
      }

      if (ast.exitCondition && ast.exitCondition.type === 'crossunder') {
        const fast = `buf_${ast.exitCondition.fast}`;
        const slow = `buf_${ast.exitCondition.slow}`;
        computeLogic += `
              // Crossunder (SELL)
              let fast_prev2 = ${fast}[i-1u];
              let fast_curr2 = ${fast}[i];
              let slow_prev2 = ${slow}[i-1u];
              let slow_curr2 = ${slow}[i];
              if (fast_prev2 >= slow_prev2 && fast_curr2 < slow_curr2) {
                  signal = -1.0;
              }
        `;
      }

      computeLogic += `
              out_signals[i] = signal;
          } else {
              out_signals[i] = 0.0;
          }
      `;
    }

    const code = this.shaderTemplate
      .replace('{{BUFFER_DECLARATIONS}}', bufferDecls)
      .replace('{{COMPUTATION_LOGIC}}', computeLogic);

    return {
        code,
        bufferCount: ast.indicators.length
    };
  }
}

export const wgslTranspiler = new WGSLTranspiler();
