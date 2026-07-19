// ─── Client-Side Technical Indicators Registry & Calculations ───

// A. Mathematical Helper Functions

export function calculateEMA(data, period) {
  if (data.length < period) return [];
  const ema = [];
  const k = 2 / (period + 1);
  let sum = 0;
  for (let i = 0; i < period; i++) {
    const val = data[i].close !== undefined ? data[i].close : (data[i].value !== undefined ? data[i].value : data[i]);
    sum += val;
  }
  let val = sum / period;
  ema.push({ time: data[period - 1].time, value: val });
  for (let i = period; i < data.length; i++) {
    const currVal = data[i].close !== undefined ? data[i].close : (data[i].value !== undefined ? data[i].value : data[i]);
    val = currVal * k + val * (1 - k);
    ema.push({ time: data[i].time, value: val });
  }
  return ema;
}

export function calculateSMA(data, period) {
  if (data.length < period) return [];
  const sma = [];
  let sum = 0;
  for (let i = 0; i < period; i++) {
    const val = data[i].close !== undefined ? data[i].close : (data[i].value !== undefined ? data[i].value : data[i]);
    sum += val;
  }
  sma.push({ time: data[period - 1].time, value: sum / period });
  for (let i = period; i < data.length; i++) {
    const prevVal = data[i - period].close !== undefined ? data[i - period].close : (data[i - period].value !== undefined ? data[i - period].value : data[i - period]);
    const currVal = data[i].close !== undefined ? data[i].close : (data[i].value !== undefined ? data[i].value : data[i]);
    sum = sum - prevVal + currVal;
    sma.push({ time: data[i].time, value: sum / period });
  }
  return sma;
}

export function calculateBB(data, period, stdDevMultiplier) {
  if (data.length < period) return { upper: [], middle: [], lower: [] };
  const upper = [];
  const middle = [];
  const lower = [];
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sum += data[j].close;
    }
    const ma = sum / period;
    let varianceSum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      varianceSum += Math.pow(data[j].close - ma, 2);
    }
    const stdDev = Math.sqrt(varianceSum / period);
    const time = data[i].time;
    middle.push({ time, value: ma });
    upper.push({ time, value: ma + stdDevMultiplier * stdDev });
    lower.push({ time, value: ma - stdDevMultiplier * stdDev });
  }
  return { upper, middle, lower };
}

export function calculateRSI(data, period = 14) {
  if (data.length <= period) return [];
  const rsi = [];
  let gains = 0;
  let losses = 0;

  // Welles Wilder initial average calculation (SMA)
  for (let i = 1; i <= period; i++) {
    const diff = data[i].close - data[i - 1].close;
    if (diff > 0) gains += diff;
    else losses -= diff;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;
  
  let val;
  if (avgLoss === 0) {
    val = 100;
  } else if (avgGain === 0) {
    val = 0;
  } else {
    const rs = avgGain / avgLoss;
    val = 100 - (100 / (1 + rs));
  }
  rsi.push({ time: data[period].time, value: val });

  // Welles Wilder smoothing calculation for remaining periods
  for (let i = period + 1; i < data.length; i++) {
    const diff = data[i].close - data[i - 1].close;
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    if (avgLoss === 0) {
      val = 100;
    } else if (avgGain === 0) {
      val = 0;
    } else {
      const rs = avgGain / avgLoss;
      val = 100 - (100 / (1 + rs));
    }
    rsi.push({ time: data[i].time, value: val });
  }
  return rsi;
}

export function calculateMACD(data, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  if (data.length <= slowPeriod + signalPeriod) return { macd: [], signal: [], hist: [] };

  const fastEma = calculateEMA(data, fastPeriod);
  const slowEma = calculateEMA(data, slowPeriod);

  const macdLine = [];
  const slowMap = new Map(slowEma.map(item => [item.time, item.value]));

  fastEma.forEach(item => {
    if (slowMap.has(item.time)) {
      macdLine.push({ time: item.time, value: item.value - slowMap.get(item.time) });
    }
  });

  const signalLine = calculateEMA(macdLine, signalPeriod);
  const signalMap = new Map(signalLine.map(item => [item.time, item.value]));

  const hist = [];
  macdLine.forEach(item => {
    if (signalMap.has(item.time)) {
      hist.push({ time: item.time, value: item.value - signalMap.get(item.time) });
    }
  });

  const coloredHist = hist.map(h => ({
    time: h.time,
    value: h.value,
    color: h.value >= 0 ? 'rgba(8, 153, 129, 0.5)' : 'rgba(242, 54, 69, 0.5)'
  }));

  return {
    macd: macdLine.filter(item => signalMap.has(item.time)),
    signal: signalLine,
    hist: coloredHist
  };
}

export function calculateVWAP(data) {
  let sumTypicalVolume = 0;
  let sumVolume = 0;
  return data.map(c => {
    const tp = (c.high + c.low + c.close) / 3;
    sumTypicalVolume += tp * (c.volume || 0);
    sumVolume += (c.volume || 0);
    return { time: c.time, value: sumVolume === 0 ? tp : (sumTypicalVolume / sumVolume) };
  });
}

export function calculateATR(data, period = 14) {
  if (data.length === 0) return [];
  const atr = [];
  const trs = [];
  for (let i = 0; i < data.length; i++) {
    if (i === 0) {
      trs.push(data[i].high - data[i].low);
    } else {
      const tr = Math.max(
        data[i].high - data[i].low,
        Math.abs(data[i].high - data[i - 1].close),
        Math.abs(data[i].low - data[i - 1].close)
      );
      trs.push(tr);
    }
  }
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum += trs[i];
    if (i >= period - 1) {
      if (i >= period) {
        sum -= trs[i - period];
      }
      atr.push({ time: data[i].time, value: sum / period });
    }
  }
  return atr;
}

export function calculateADX(data, period = 14) {
  if (data.length <= period) return [];
  const tr = [];
  const plusDM = [];
  const minusDM = [];
  for (let i = 0; i < data.length; i++) {
    if (i === 0) {
      tr.push(data[i].high - data[i].low);
      plusDM.push(0);
      minusDM.push(0);
    } else {
      const highDiff = data[i].high - data[i - 1].high;
      const lowDiff = data[i - 1].low - data[i].low;
      tr.push(Math.max(
        data[i].high - data[i].low,
        Math.abs(data[i].high - data[i - 1].close),
        Math.abs(data[i].low - data[i - 1].close)
      ));
      plusDM.push(highDiff > lowDiff && highDiff > 0 ? highDiff : 0);
      minusDM.push(lowDiff > highDiff && lowDiff > 0 ? lowDiff : 0);
    }
  }
  const smoothedTR = [];
  const smoothedPlusDM = [];
  const smoothedMinusDM = [];
  let trSum = 0, plusSum = 0, minusSum = 0;
  for (let i = 0; i < period; i++) {
    trSum += tr[i];
    plusSum += plusDM[i];
    minusSum += minusDM[i];
  }
  smoothedTR.push(trSum);
  smoothedPlusDM.push(plusSum);
  smoothedMinusDM.push(minusSum);
  for (let i = period; i < data.length; i++) {
    trSum = trSum - trSum / period + tr[i];
    plusSum = plusSum - plusSum / period + plusDM[i];
    minusSum = minusSum - minusSum / period + minusDM[i];
    smoothedTR.push(trSum);
    smoothedPlusDM.push(plusSum);
    smoothedMinusDM.push(minusSum);
  }
  const dxVals = [];
  for (let i = 0; i < smoothedTR.length; i++) {
    const tVal = smoothedTR[i];
    const pDI = tVal === 0 ? 0 : 100 * (smoothedPlusDM[i] / tVal);
    const mDI = tVal === 0 ? 0 : 100 * (smoothedMinusDM[i] / tVal);
    const diff = Math.abs(pDI - mDI);
    const sum = pDI + mDI;
    const dx = sum === 0 ? 0 : 100 * (diff / sum);
    dxVals.push({ time: data[period - 1 + i].time, value: dx });
  }
  const adx = [];
  let dxSum = 0;
  for (let i = 0; i < period; i++) {
    dxSum += dxVals[i].value;
  }
  adx.push({ time: dxVals[period - 1].time, value: dxSum / period });
  for (let i = period; i < dxVals.length; i++) {
    dxSum = dxSum - dxSum / period + dxVals[i].value;
    adx.push({ time: dxVals[i].time, value: dxSum / period });
  }
  return adx;
}

export function calculateCCI(data, period = 20) {
  if (data.length < period) return [];
  const cci = [];
  const tps = data.map(c => (c.high + c.low + c.close) / 3);
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sum += tps[j];
    }
    const ma = sum / period;
    let devSum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      devSum += Math.abs(tps[j] - ma);
    }
    const md = devSum / period;
    const val = md === 0 ? 0 : (tps[i] - ma) / (0.015 * md);
    cci.push({ time: data[i].time, value: val });
  }
  return cci;
}

export function calculateOBV(data) {
  if (data.length === 0) return [];
  const obv = [];
  let currentObv = 0;
  obv.push({ time: data[0].time, value: currentObv });
  for (let i = 1; i < data.length; i++) {
    if (data[i].close > data[i - 1].close) {
      currentObv += data[i].volume || 0;
    } else if (data[i].close < data[i - 1].close) {
      currentObv -= data[i].volume || 0;
    }
    obv.push({ time: data[i].time, value: currentObv });
  }
  return obv;
}

export function calculateMFI(data, period = 14) {
  if (data.length < period + 1) return [];
  const mfi = [];
  for (let i = period; i < data.length; i++) {
    let posFlow = 0, negFlow = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const tp = (data[j].high + data[j].low + data[j].close) / 3;
      const prevTp = (data[j - 1].high + data[j - 1].low + data[j - 1].close) / 3;
      const rawFlow = tp * (data[j].volume || 0);
      if (tp >= prevTp) posFlow += rawFlow;
      else negFlow += rawFlow;
    }
    const mfRatio = negFlow === 0 ? 100 : posFlow / negFlow;
    mfi.push({ time: data[i].time, value: 100 - 100 / (1 + mfRatio) });
  }
  return mfi;
}

export function calculateSuperTrend(data, period = 10, multiplier = 3) {
  if (data.length < period) return { supertrend: [], direction: [] };
  const atr = calculateATR(data, period);
  const atrMap = new Map(atr.map(a => [a.time, a.value]));
  const result = [];
  let prevUpper = Infinity, prevLower = -Infinity, prevSuper = 0, prevDir = 1;
  for (let i = period; i < data.length; i++) {
    const c = data[i];
    const atrVal = atrMap.get(c.time) || 0;
    const hl2 = (c.high + c.low) / 2;
    let upper = hl2 + multiplier * atrVal;
    let lower = hl2 - multiplier * atrVal;
    upper = (upper < prevUpper || data[i - 1].close > prevUpper) ? upper : prevUpper;
    lower = (lower > prevLower || data[i - 1].close < prevLower) ? lower : prevLower;
    let dir, st;
    if (c.close > prevUpper) { dir = 1; st = lower; }
    else if (c.close < prevLower) { dir = -1; st = upper; }
    else { dir = prevDir; st = prevDir === 1 ? lower : upper; }
    result.push({ time: c.time, value: st, dir });
    prevUpper = upper; prevLower = lower; prevSuper = st; prevDir = dir;
  }
  const upLine = result.filter(r => r.dir === 1).map(r => ({ time: r.time, value: r.value }));
  const downLine = result.filter(r => r.dir === -1).map(r => ({ time: r.time, value: r.value }));
  return { up: upLine, down: downLine };
}

export function calculateParabolicSAR(data, step = 0.02, maxStep = 0.2) {
  if (data.length < 2) return [];
  const sar = [];
  let isLong = true;
  let af = step;
  let ep = data[0].high;
  let sarVal = data[0].low;
  for (let i = 1; i < data.length; i++) {
    const prevSar = sarVal;
    sarVal = sarVal + af * (ep - sarVal);
    if (isLong) {
      sarVal = Math.min(sarVal, data[i - 1].low, i >= 2 ? data[i - 2].low : data[i - 1].low);
      if (data[i].low < sarVal) {
        isLong = false; sarVal = ep; ep = data[i].low; af = step;
      } else {
        if (data[i].high > ep) { ep = data[i].high; af = Math.min(af + step, maxStep); }
      }
    } else {
      sarVal = Math.max(sarVal, data[i - 1].high, i >= 2 ? data[i - 2].high : data[i - 1].high);
      if (data[i].high > sarVal) {
        isLong = true; sarVal = ep; ep = data[i].high; af = step;
      } else {
        if (data[i].low < ep) { ep = data[i].low; af = Math.min(af + step, maxStep); }
      }
    }
    sar.push({ time: data[i].time, value: sarVal });
  }
  return sar;
}

export function calculateIchimoku(data, tenkanPeriod = 9, kijunPeriod = 26, senkouBPeriod = 52) {
  const midpoint = (period, idx) => {
    let high = -Infinity, low = Infinity;
    for (let j = Math.max(0, idx - period + 1); j <= idx; j++) {
      if (data[j].high > high) high = data[j].high;
      if (data[j].low < low) low = data[j].low;
    }
    return (high + low) / 2;
  };
  const tenkan = [], kijun = [], senkouA = [], senkouB = [], chikou = [];
  for (let i = 0; i < data.length; i++) {
    const tk = midpoint(tenkanPeriod, i);
    const kj = midpoint(kijunPeriod, i);
    tenkan.push({ time: data[i].time, value: tk });
    kijun.push({ time: data[i].time, value: kj });
    chikou.push({ time: data[i].time, value: data[i].close });
    if (i + kijunPeriod < data.length) {
      const futureTime = data[i + kijunPeriod].time;
      senkouA.push({ time: futureTime, value: (tk + kj) / 2 });
      const sb = midpoint(senkouBPeriod, i);
      senkouB.push({ time: futureTime, value: sb });
    }
  }
  return { tenkan, kijun, senkouA, senkouB, chikou };
}

export function calculateWilliamsR(data, period = 14) {
  if (data.length < period) return [];
  const wR = [];
  for (let i = period - 1; i < data.length; i++) {
    let highestHigh = -Infinity;
    let lowestLow = Infinity;
    for (let j = i - period + 1; j <= i; j++) {
      if (data[j].high > highestHigh) highestHigh = data[j].high;
      if (data[j].low < lowestLow) lowestLow = data[j].low;
    }
    const num = highestHigh - data[i].close;
    const den = highestHigh - lowestLow;
    const val = den === 0 ? -50 : -100 * (num / den);
    wR.push({ time: data[i].time, value: val });
  }
  return wR;
}

export function calculateStochastic(data, period = 14, kPeriod = 3, dPeriod = 3) {
  if (data.length < period) return { k: [], d: [] };
  const fastK = [];
  for (let i = period - 1; i < data.length; i++) {
    let highestHigh = -Infinity;
    let lowestLow = Infinity;
    for (let j = i - period + 1; j <= i; j++) {
      if (data[j].high > highestHigh) highestHigh = data[j].high;
      if (data[j].low < lowestLow) lowestLow = data[j].low;
    }
    const num = data[i].close - lowestLow;
    const den = highestHigh - lowestLow;
    const val = den === 0 ? 50 : 100 * (num / den);
    fastK.push({ time: data[i].time, value: val });
  }
  const k = [];
  for (let i = kPeriod - 1; i < fastK.length; i++) {
    let sum = 0;
    for (let j = i - kPeriod + 1; j <= i; j++) {
      sum += fastK[j].value;
    }
    k.push({ time: fastK[i].time, value: sum / kPeriod });
  }
  const d = [];
  for (let i = dPeriod - 1; i < k.length; i++) {
    let sum = 0;
    for (let j = i - dPeriod + 1; j <= i; j++) {
      sum += k[j].value;
    }
    d.push({ time: k[i].time, value: sum / dPeriod });
  }
  const dTimes = new Set(d.map(item => item.time));
  return {
    k: k.filter(item => dTimes.has(item.time)),
    d: d
  };
}

// B. Technical Indicators Registry

export const INDICATOR_REGISTRY = {
  ema: {
    id: 'ema',
    name: 'EMA',
    kind: 'overlay',
    defaultParams: { period: 9 },
    paramSchema: [
      { key: 'period', label: 'Period', type: 'number', min: 1, max: 500 }
    ],
    seriesConfig: [
      {
        key: 'value',
        type: 'line',
        options: (params, color) => ({
          color: color || '#ff9800',
          lineWidth: 1.5,
          title: `EMA (${params.period})`
        })
      }
    ],
    compute: (candles, params) => ({
      value: calculateEMA(candles, params.period)
    })
  },
  sma: {
    id: 'sma',
    name: 'SMA',
    kind: 'overlay',
    defaultParams: { period: 50 },
    paramSchema: [
      { key: 'period', label: 'Period', type: 'number', min: 1, max: 500 }
    ],
    seriesConfig: [
      {
        key: 'value',
        type: 'line',
        options: (params, color) => ({
          color: color || '#2962ff',
          lineWidth: 1.5,
          title: `SMA (${params.period})`
        })
      }
    ],
    compute: (candles, params) => ({
      value: calculateSMA(candles, params.period)
    })
  },
  bb: {
    id: 'bb',
    name: 'Bollinger Bands',
    kind: 'overlay',
    defaultParams: { period: 20, stdDev: 2 },
    paramSchema: [
      { key: 'period', label: 'Period', type: 'number', min: 1, max: 200 },
      { key: 'stdDev', label: 'StdDev', type: 'float', min: 0.1, max: 10, step: 0.1 }
    ],
    seriesConfig: [
      {
        key: 'upper',
        type: 'line',
        options: (params, color) => ({
          color: color || '#26a69a',
          lineWidth: 1,
          lineStyle: 1,
          title: `BB Upper (${params.period}, ${params.stdDev})`
        })
      },
      {
        key: 'middle',
        type: 'line',
        options: (params, color) => ({
          color: color || '#26a69a',
          lineWidth: 1.5,
          title: 'BB Basis'
        })
      },
      {
        key: 'lower',
        type: 'line',
        options: (params, color) => ({
          color: color || '#26a69a',
          lineWidth: 1,
          lineStyle: 1,
          title: 'BB Lower'
        })
      }
    ],
    compute: (candles, params) => {
      const { upper, middle, lower } = calculateBB(candles, params.period, params.stdDev);
      return { upper, middle, lower };
    }
  },
  vwap: {
    id: 'vwap',
    name: 'VWAP',
    kind: 'overlay',
    defaultParams: {},
    paramSchema: [],
    seriesConfig: [
      {
        key: 'value',
        type: 'line',
        options: (params, color) => ({
          color: color || '#00e676',
          lineWidth: 1.5,
          title: 'VWAP'
        })
      }
    ],
    compute: (candles) => ({
      value: calculateVWAP(candles)
    })
  },
  rsi: {
    id: 'rsi',
    name: 'RSI',
    kind: 'subchart',
    defaultParams: { period: 14 },
    paramSchema: [
      { key: 'period', label: 'RSI Period', type: 'number', min: 1, max: 200 }
    ],
    seriesConfig: [
      {
        key: 'value',
        type: 'line',
        options: (params, color) => ({
          color: color || '#e040fb',
          lineWidth: 1.5,
          title: `RSI (${params.period})`
        })
      }
    ],
    compute: (candles, params) => ({
      value: calculateRSI(candles, params.period)
    })
  },
  macd: {
    id: 'macd',
    name: 'MACD',
    kind: 'subchart',
    defaultParams: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
    paramSchema: [
      { key: 'fastPeriod', label: 'Fast Period', type: 'number', min: 1 },
      { key: 'slowPeriod', label: 'Slow Period', type: 'number', min: 1 },
      { key: 'signalPeriod', label: 'Signal Period', type: 'number', min: 1 }
    ],
    seriesConfig: [
      {
        key: 'macd',
        type: 'line',
        options: (params, color) => ({
          color: '#2962ff',
          lineWidth: 1.5,
          title: 'MACD'
        })
      },
      {
        key: 'signal',
        type: 'line',
        options: (params, color) => ({
          color: '#ff6d00',
          lineWidth: 1.5,
          title: 'Signal'
        })
      },
      {
        key: 'hist',
        type: 'histogram',
        options: (params, color) => ({
          color: '#26a69a',
          lineWidth: 1.5,
          title: 'Histogram'
        })
      }
    ],
    compute: (candles, params) => {
      const { macd, signal, hist } = calculateMACD(candles, params.fastPeriod, params.slowPeriod, params.signalPeriod);
      return { macd, signal, hist };
    }
  },
  atr: {
    id: 'atr',
    name: 'Average True Range',
    kind: 'subchart',
    defaultParams: { period: 14 },
    paramSchema: [
      { key: 'period', label: 'ATR Period', type: 'number', min: 1, max: 200 }
    ],
    seriesConfig: [
      {
        key: 'value',
        type: 'line',
        options: (params, color) => ({
          color: color || '#ff5252',
          lineWidth: 1.5,
          title: `ATR (${params.period})`
        })
      }
    ],
    compute: (candles, params) => ({
      value: calculateATR(candles, params.period)
    })
  },
  adx: {
    id: 'adx',
    name: 'ADX',
    kind: 'subchart',
    defaultParams: { period: 14 },
    paramSchema: [
      { key: 'period', label: 'ADX Period', type: 'number', min: 1, max: 200 }
    ],
    seriesConfig: [
      {
        key: 'value',
        type: 'line',
        options: (params, color) => ({
          color: color || '#ffd700',
          lineWidth: 1.5,
          title: `ADX (${params.period})`
        })
      }
    ],
    compute: (candles, params) => ({
      value: calculateADX(candles, params.period)
    })
  },
  cci: {
    id: 'cci',
    name: 'CCI',
    kind: 'subchart',
    defaultParams: { period: 20 },
    paramSchema: [
      { key: 'period', label: 'CCI Period', type: 'number', min: 1, max: 200 }
    ],
    seriesConfig: [
      {
        key: 'value',
        type: 'line',
        options: (params, color) => ({
          color: color || '#00bcd4',
          lineWidth: 1.5,
          title: `CCI (${params.period})`
        })
      }
    ],
    compute: (candles, params) => ({
      value: calculateCCI(candles, params.period)
    })
  },
  obv: {
    id: 'obv',
    name: 'OBV',
    kind: 'subchart',
    defaultParams: {},
    paramSchema: [],
    seriesConfig: [
      {
        key: 'value',
        type: 'line',
        options: (params, color) => ({
          color: color || '#ec407a',
          lineWidth: 1.5,
          title: 'OBV'
        })
      }
    ],
    compute: (candles) => ({
      value: calculateOBV(candles)
    })
  },
  williams: {
    id: 'williams',
    name: 'Williams %R',
    kind: 'subchart',
    defaultParams: { period: 14 },
    paramSchema: [
      { key: 'period', label: 'Period', type: 'number', min: 1, max: 200 }
    ],
    seriesConfig: [
      {
        key: 'value',
        type: 'line',
        options: (params, color) => ({
          color: color || '#ab47bc',
          lineWidth: 1.5,
          title: `Williams %R (${params.period})`
        })
      }
    ],
    compute: (candles, params) => ({
      value: calculateWilliamsR(candles, params.period)
    })
  },
  mfi: {
    id: 'mfi',
    name: 'Money Flow Index',
    kind: 'subchart',
    defaultParams: { period: 14 },
    paramSchema: [
      { key: 'period', label: 'MFI Period', type: 'number', min: 1, max: 200 }
    ],
    seriesConfig: [
      {
        key: 'value',
        type: 'line',
        options: (params, color) => ({
          color: color || '#4caf50',
          lineWidth: 1.5,
          title: `MFI (${params.period})`
        })
      }
    ],
    compute: (candles, params) => ({
      value: calculateMFI(candles, params.period)
    })
  },
  supertrend: {
    id: 'supertrend',
    name: 'SuperTrend',
    kind: 'overlay',
    defaultParams: { period: 10, multiplier: 3 },
    paramSchema: [
      { key: 'period', label: 'ATR Period', type: 'number', min: 1, max: 200 },
      { key: 'multiplier', label: 'Multiplier', type: 'float', min: 0.1, max: 20, step: 0.1 }
    ],
    seriesConfig: [
      {
        key: 'up',
        type: 'line',
        options: (params, color) => ({
          color: '#089981',
          lineWidth: 2,
          title: `ST Bull (${params.period}, ${params.multiplier})`
        })
      },
      {
        key: 'down',
        type: 'line',
        options: (params, color) => ({
          color: '#F23645',
          lineWidth: 2,
          title: `ST Bear (${params.period}, ${params.multiplier})`
        })
      }
    ],
    compute: (candles, params) => {
      const { up, down } = calculateSuperTrend(candles, params.period, params.multiplier);
      return { up, down };
    }
  },
  psar: {
    id: 'psar',
    name: 'Parabolic SAR',
    kind: 'overlay',
    defaultParams: { step: 0.02, maxStep: 0.2 },
    paramSchema: [
      { key: 'step', label: 'Step', type: 'float', min: 0.001, max: 1, step: 0.001 },
      { key: 'maxStep', label: 'Max Step', type: 'float', min: 0.01, max: 1, step: 0.01 }
    ],
    seriesConfig: [
      {
        key: 'value',
        type: 'line',
        options: (params, color) => ({
          color: color || '#ff6d00',
          lineWidth: 1,
          lineStyle: 3,
          title: `PSAR (${params.step}, ${params.maxStep})`
        })
      }
    ],
    compute: (candles, params) => ({
      value: calculateParabolicSAR(candles, params.step, params.maxStep)
    })
  },
  ichimoku: {
    id: 'ichimoku',
    name: 'Ichimoku Cloud',
    kind: 'overlay',
    defaultParams: { tenkan: 9, kijun: 26, senkouB: 52 },
    paramSchema: [
      { key: 'tenkan', label: 'Tenkan', type: 'number', min: 1, max: 200 },
      { key: 'kijun', label: 'Kijun', type: 'number', min: 1, max: 200 },
      { key: 'senkouB', label: 'Senkou B', type: 'number', min: 1, max: 300 }
    ],
    seriesConfig: [
      {
        key: 'tenkan',
        type: 'line',
        options: (params, color) => ({
          color: '#e91e63',
          lineWidth: 1,
          title: `Tenkan (${params.tenkan})`
        })
      },
      {
        key: 'kijun',
        type: 'line',
        options: (params, color) => ({
          color: '#2196f3',
          lineWidth: 1,
          title: `Kijun (${params.kijun})`
        })
      },
      {
        key: 'senkouA',
        type: 'line',
        options: (params, color) => ({
          color: 'rgba(8,153,129,0.6)',
          lineWidth: 1,
          title: 'Senkou A'
        })
      },
      {
        key: 'senkouB',
        type: 'line',
        options: (params, color) => ({
          color: 'rgba(242,54,69,0.6)',
          lineWidth: 1,
          title: 'Senkou B'
        })
      },
      {
        key: 'chikou',
        type: 'line',
        options: (params, color) => ({
          color: '#9c27b0',
          lineWidth: 1,
          lineStyle: 1,
          title: 'Chikou'
        })
      }
    ],
    compute: (candles, params) => {
      const { tenkan, kijun, senkouA, senkouB, chikou } = calculateIchimoku(candles, params.tenkan, params.kijun, params.senkouB);
      return { tenkan, kijun, senkouA, senkouB, chikou };
    }
  },
  stochastic: {
    id: 'stochastic',
    name: 'Stochastic Oscillator',
    kind: 'subchart',
    defaultParams: { period: 14, kPeriod: 3, dPeriod: 3 },
    paramSchema: [
      { key: 'period', label: 'K Period', type: 'number', min: 1 },
      { key: 'kPeriod', label: 'Smooth K', type: 'number', min: 1 },
      { key: 'dPeriod', label: 'Smooth D', type: 'number', min: 1 }
    ],
    seriesConfig: [
      {
        key: 'k',
        type: 'line',
        options: (params, color) => ({
          color: '#2962ff',
          lineWidth: 1.5,
          title: `%K (${params.period}, ${params.kPeriod})`
        })
      },
      {
        key: 'd',
        type: 'line',
        options: (params, color) => ({
          color: '#ff6d00',
          lineWidth: 1.5,
          title: `%D (${params.dPeriod})`
        })
      }
    ],
    compute: (candles, params) => {
      const { k, d } = calculateStochastic(candles, params.period, params.kPeriod, params.dPeriod);
      return { k, d };
    }
  }
};
