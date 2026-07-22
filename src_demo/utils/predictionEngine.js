export function predictNextCandle(candles, intervalSeconds) {
  if (!candles || candles.length < 50) return null;

  // Simple heuristic based on momentum (RSI approximation) and short-term trend
  const period = 14;
  let gains = 0;
  let losses = 0;
  
  for (let i = candles.length - period; i < candles.length; i++) {
    const diff = candles[i].close - candles[i - 1].close;
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  
  const avgGain = gains / period;
  const avgLoss = losses / period;
  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  const rsi = 100 - (100 / (1 + rs));

  // Determine trend via 9 EMA vs 21 EMA
  let sum9 = 0, sum21 = 0;
  for (let i = candles.length - 9; i < candles.length; i++) sum9 += candles[i].close;
  for (let i = candles.length - 21; i < candles.length; i++) sum21 += candles[i].close;
  
  const ema9 = sum9 / 9;
  const ema21 = sum21 / 21;
  const isUptrend = ema9 > ema21;

  // Base prediction
  let isPredictionUp = true;
  
  // Combine signals
  if (rsi > 70) {
    isPredictionUp = false; // Overbought, predict reversal
  } else if (rsi < 30) {
    isPredictionUp = true; // Oversold, predict reversal
  } else {
    // Trend continuation
    isPredictionUp = isUptrend;
  }

  // Calculate target range based on Average True Range (ATR)
  let trSum = 0;
  for (let i = candles.length - 14; i < candles.length; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    const prevClose = candles[i-1].close;
    const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
    trSum += tr;
  }
  const atr = trSum / 14;
  
  // Add a touch of randomization to simulate probability within a normal distribution
  const randomFactor = (Math.random() * 0.4) + 0.6; // 0.6 to 1.0 of ATR
  const moveSize = atr * randomFactor;

  const lastCandle = candles[candles.length - 1];
  const open = lastCandle.close;
  const close = isPredictionUp ? open + moveSize : open - moveSize;
  const high = Math.max(open, close) + (moveSize * 0.2);
  const low = Math.min(open, close) - (moveSize * 0.2);

  return {
    time: lastCandle.time + intervalSeconds,
    open,
    high,
    low,
    close,
    isPrediction: true,
    predictedUp: isPredictionUp
  };
}
