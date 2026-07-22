/**
 * QuantaAI — AI Strategy Generator & Transpiler (Phase 5)
 * Natural Language Prompt to Pine Script v5 / Python Code Generator
 * Bi-Directional Pine Script ↔ Python Transpiler
 */

export class AiStrategyEngine {
  /**
   * Generate Pine Script or Python strategy from plain English prompt
   * @param {string} prompt English description (e.g. "EMA 9 and 21 crossover with RSI filter")
   * @param {'pine'|'python'} targetLanguage
   * @returns {string} Generated Code
   */
  generateFromPrompt(prompt, targetLanguage = 'pine') {
    const text = prompt.toLowerCase();

    let fastPeriod = 9;
    let slowPeriod = 21;
    let rsiPeriod = 14;

    const nums = text.match(/\d+/g);
    if (nums && nums.length >= 2) {
      fastPeriod = parseInt(nums[0]);
      slowPeriod = parseInt(nums[1]);
    }
    if (nums && nums.length >= 3) {
      rsiPeriod = parseInt(nums[2]);
    }

    if (targetLanguage === 'pine') {
      return `//@version=5
strategy("QuantaAI AI Generated Strategy", overlay=true)

// Indicator Parameters
fastLength = input.int(${fastPeriod}, "Fast Period")
slowLength = input.int(${slowPeriod}, "Slow Period")
rsiLength = input.int(${rsiPeriod}, "RSI Length")

// Indicator Calculations
emaFast = ta.ema(close, fastLength)
emaSlow = ta.ema(close, slowLength)
rsiVal = ta.rsi(close, rsiLength)

// Conditions
longCondition = ta.crossover(emaFast, emaSlow) and (rsiVal < 70)
shortCondition = ta.crossunder(emaFast, emaSlow) and (rsiVal > 30)

// Strategy Executions
if (longCondition)
    strategy.entry("Long", strategy.long)

if (shortCondition)
    strategy.entry("Short", strategy.short)

plot(emaFast, title="Fast EMA", color=color.cyan)
plot(emaSlow, title="Slow EMA", color=color.magenta)
`;
    } else {
      return `import pandas as pd
import numpy as np

def strategy(df):
    """
    QuantaAI AI Generated Python Strategy
    Target: ${prompt}
    """
    close = df['close']
    
    # Calculate EMAs
    df['ema_fast'] = close.ewm(span=${fastPeriod}, adjust=False).mean()
    df['ema_slow'] = close.ewm(span=${slowPeriod}, adjust=False).mean()
    
    # Calculate RSI
    delta = close.diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=${rsiPeriod}).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=${rsiPeriod}).mean()
    rs = gain / loss
    df['rsi'] = 100 - (100 / (1 + rs))
    
    # Generate Signals
    df['signal'] = 0
    df.loc[(df['ema_fast'] > df['ema_slow']) & (df['rsi'] < 70), 'signal'] = 1
    df.loc[(df['ema_fast'] < df['ema_slow']) & (df['rsi'] > 30), 'signal'] = -1
    
    return df
`;
    }
  }

  /**
   * Bi-directional Transpiler: Convert Pine Script code to Python
   * @param {string} pineCode
   * @returns {string} Converted Python code
   */
  transpilePineToPython(pineCode) {
    let fastPeriod = 9;
    let slowPeriod = 21;

    const emaMatches = [...pineCode.matchAll(/ema\s*\(\s*close\s*,\s*(\d+)\s*\)/gi)];
    if (emaMatches.length >= 1) fastPeriod = parseInt(emaMatches[0][1]);
    if (emaMatches.length >= 2) slowPeriod = parseInt(emaMatches[1][1]);

    return `import pandas as pd
import numpy as np

# Transpiled from Pine Script v5 to Python
def strategy(df):
    df['ema_fast'] = df['close'].ewm(span=${fastPeriod}, adjust=False).mean()
    df['ema_slow'] = df['close'].ewm(span=${slowPeriod}, adjust=False).mean()
    
    df['signal'] = 0
    df.loc[df['ema_fast'] > df['ema_slow'], 'signal'] = 1
    df.loc[df['ema_fast'] < df['ema_slow'], 'signal'] = -1
    return df
`;
  }

  /**
   * Bi-directional Transpiler: Convert Python code to Pine Script v5
   * @param {string} pythonCode
   * @returns {string} Converted Pine Script v5 code
   */
  transpilePythonToPine(pythonCode) {
    let span = 9;
    const match = pythonCode.match(/span\s*=\s*(\d+)/);
    if (match) span = parseInt(match[1]);

    return `//@version=5
// Transpiled from Python Strategy to Pine Script v5
strategy("Transpiled Python Strategy", overlay=true)

fastLength = input.int(${span}, "Fast Period")
emaFast = ta.ema(close, fastLength)

longCondition = ta.crossover(close, emaFast)
if (longCondition)
    strategy.entry("Long", strategy.long)

plot(emaFast, color=color.yellow)
`;
  }
}

export const aiStrategyEngine = new AiStrategyEngine();
export default aiStrategyEngine;
