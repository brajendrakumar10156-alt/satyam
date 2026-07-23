/** Indicator snippets & helpers for TradingView-style features */

export const INDICATOR_LIBRARY = [
  {
    id: 'ema',
    name: 'EMA Crossover (9/21)',
    pine: `ema_fast = ta.ema(close, 9)\nema_slow = ta.ema(close, 21)\nlongCondition = ta.crossover(ema_fast, ema_slow)\nshortCondition = ta.crossunder(ema_fast, ema_slow)`,
    python: `    df['ema9'] = df['close'].ewm(span=9, adjust=False).mean()\n    df['ema21'] = df['close'].ewm(span=21, adjust=False).mean()`,
  },
  {
    id: 'sma',
    name: 'SMA Crossover (50/200)',
    pine: `sma_fast = ta.sma(close, 50)\nsma_slow = ta.sma(close, 200)\nlongCondition = ta.crossover(sma_fast, sma_slow)`,
    python: `    df['sma50'] = df['close'].rolling(50).mean()\n    df['sma200'] = df['close'].rolling(200).mean()`,
  },
  {
    id: 'rsi',
    name: 'RSI (14)',
    pine: `rsi_val = ta.rsi(close, 14)\nlongCondition = ta.crossover(rsi_val, 30)\nshortCondition = ta.crossunder(rsi_val, 70)`,
    python: `    delta = df['close'].diff()\n    gain = delta.clip(lower=0).rolling(14).mean()\n    loss = (-delta.clip(upper=0)).rolling(14).mean()\n    df['rsi'] = 100 - (100 / (1 + gain / (loss + 1e-9)))`,
  },
  {
    id: 'rsi7',
    name: 'RSI (7)',
    pine: `rsi_val = ta.rsi(close, 7)\nlongCondition = ta.crossover(rsi_val, 20)\nshortCondition = ta.crossunder(rsi_val, 80)`,
    python: `    delta = df['close'].diff()\n    gain = delta.clip(lower=0).rolling(7).mean()\n    loss = (-delta.clip(upper=0)).rolling(7).mean()\n    df['rsi7'] = 100 - (100 / (1 + gain / (loss + 1e-9)))`,
  },
  {
    id: 'rsi21',
    name: 'RSI (21)',
    pine: `rsi_val = ta.rsi(close, 21)\nlongCondition = ta.crossover(rsi_val, 40)\nshortCondition = ta.crossunder(rsi_val, 60)`,
    python: `    delta = df['close'].diff()\n    gain = delta.clip(lower=0).rolling(21).mean()\n    loss = (-delta.clip(upper=0)).rolling(21).mean()\n    df['rsi21'] = 100 - (100 / (1 + gain / (loss + 1e-9)))`,
  },
  {
    id: 'macd',
    name: 'MACD (12,26,9)',
    pine: `[macdLine, signalLine, hist] = ta.macd(close, 12, 26, 9)\nlongCondition = ta.crossover(macdLine, signalLine)`,
    python: `    ema12 = df['close'].ewm(span=12, adjust=False).mean()\n    ema26 = df['close'].ewm(span=26, adjust=False).mean()\n    df['macd'] = ema12 - ema26\n    df['macd_signal'] = df['macd'].ewm(span=9, adjust=False).mean()`,
  },
  {
    id: 'bb',
    name: 'Bollinger Bands (20,2)',
    pine: `[mid, upper, lower] = ta.bb(close, 20, 2)\nlongCondition = ta.crossover(close, lower)`,
    python: `    mid = df['close'].rolling(20).mean()\n    std = df['close'].rolling(20).std()\n    df['bb_upper'] = mid + 2 * std\n    df['bb_lower'] = mid - 2 * std`,
  },
  {
    id: 'bb3',
    name: 'Bollinger Bands (20,3)',
    pine: `[mid, upper, lower] = ta.bb(close, 20, 3)\nlongCondition = ta.crossover(close, lower)`,
    python: `    mid = df['close'].rolling(20).mean()\n    std = df['close'].rolling(20).std()\n    df['bb3_upper'] = mid + 3 * std\n    df['bb3_lower'] = mid - 3 * std`,
  },
  {
    id: 'volume',
    name: 'Volume Spike',
    pine: `vol_avg = ta.sma(volume, 20)\nlongCondition = volume > vol_avg * 1.5`,
    python: `    df['vol_avg'] = df['volume'].rolling(20).mean()`,
  },
  {
    id: 'stochastic',
    name: 'Stochastic Oscillator',
    pine: `[k, d] = ta.stoch(close, high, low, 14, 3, 3)\nlongCondition = ta.crossover(k, d) and k < 20`,
    python: `    low14 = df['low'].rolling(14).min()\n    high14 = df['high'].rolling(14).max()\n    df['stoch_k'] = 100 * ((df['close'] - low14) / (high14 - low14 + 1e-9))\n    df['stoch_d'] = df['stoch_k'].rolling(3).mean()`,
  },
  {
    id: 'cci',
    name: 'Commodity Channel Index (20)',
    pine: `cci_val = ta.cci(close, high, low, 20)\nlongCondition = ta.crossover(cci_val, -100)`,
    python: `    tp = (df['high'] + df['low'] + df['close']) / 3\n    ma_tp = tp.rolling(20).mean()\n    mad = tp.rolling(20).apply(lambda x: abs(x - x.mean()).mean())\n    df['cci'] = (tp - ma_tp) / (0.015 * mad + 1e-9)`,
  },
  {
    id: 'adx',
    name: 'ADX (14)',
    pine: `adx_val = ta.adx(high, low, close, 14)\nlongCondition = adx_val > 25`,
    python: `    high_low = df['high'] - df['low']\n    high_close = abs(df['high'] - df['close'].shift())\n    low_close = abs(df['low'] - df['close'].shift())\n    tr = high_low.combine(high_close, max).combine(low_close, max)\n    plus_dm = df['high'].diff().where((df['high'].diff() > df['low'].diff()) & (df['high'].diff() > 0), 0)\n    minus_dm = -df['low'].diff().where((df['low'].diff() > df['high'].diff()) & (df['low'].diff() > 0), 0)\n    atr = tr.rolling(14).mean()\n    plus_di = 100 * (plus_dm.rolling(14).mean() / atr)\n    minus_di = 100 * (minus_dm.rolling(14).mean() / atr)\n    dx = 100 * abs(plus_di - minus_di) / (plus_di + minus_di + 1e-9)\n    df['adx'] = dx.rolling(14).mean()`,
  },
  {
    id: 'atr',
    name: 'ATR (14)',
    pine: `atr_val = ta.atr(high, low, close, 14)`,
    python: `    high_low = df['high'] - df['low']\n    high_close = abs(df['high'] - df['close'].shift())\n    low_close = abs(df['low'] - df['close'].shift())\n    tr = high_low.combine(high_close, max).combine(low_close, max)\n    df['atr'] = tr.rolling(14).mean()`,
  },
  {
    id: 'obv',
    name: 'On-Balance Volume',
    pine: `obv_val = ta.obv(close, volume)`,
    python: `    obv = (np.sign(df['close'].diff()) * df['volume']).fillna(0).cumsum()\n    df['obv'] = obv`,
  },
  {
    id: 'vwap',
    name: 'VWAP',
    pine: `vwap_val = ta.vwap(close, volume)`,
    python: `    tp = (df['high'] + df['low'] + df['close']) / 3\n    vwap = (tp * df['volume']).cumsum() / df['volume'].cumsum()\n    df['vwap'] = vwap`,
  },
  {
    id: 'roc',
    name: 'Rate of Change (12)',
    pine: `roc_val = ta.roc(close, 12)\nlongCondition = ta.crossover(roc_val, 0)`,
    python: `    df['roc'] = (df['close'] - df['close'].shift(12)) / df['close'].shift(12) * 100`,
  },
  {
    id: 'momentum',
    name: 'Momentum (10)',
    pine: `mom_val = ta.mom(close, 10)\nlongCondition = ta.crossover(mom_val, 0)`,
    python: `    df['momentum'] = df['close'].diff(10)`,
  },
  {
    id: 'williams',
    name: "Williams %R (14)",
    pine: `wr_val = ta.williamsr(high, low, close, 14)\nlongCondition = ta.crossover(wr_val, -80)`,
    python: `    low14 = df['low'].rolling(14).min()\n    high14 = df['high'].rolling(14).max()\n    df['williams_r'] = -100 * ((high14 - df['close']) / (high14 - low14 + 1e-9))`,
  },
  {
    id: 'psar',
    name: 'Parabolic SAR',
    pine: `psar_val = ta.sar(high, low, 0.02, 0.2)\nlongCondition = close > psar_val`,
    python: `    def _psar(df, af_start=0.02, af_step=0.02, af_max=0.2):
        high = df['high'].values
        low = df['low'].values
        length = len(df)
        psar = df['close'].values.copy().astype(float)
        bull = True
        af = af_start
        hp = high[0]
        lp = low[0]
        for i in range(2, length):
            psar[i] = psar[i - 1] + af * ((hp if bull else lp) - psar[i - 1])
            reverse = False
            if bull:
                if low[i] < psar[i]:
                    bull, reverse, af = False, True, af_start
                    psar[i] = hp
                    lp = low[i]
            else:
                if high[i] > psar[i]:
                    bull, reverse, af = True, True, af_start
                    psar[i] = lp
                    hp = high[i]
            if not reverse:
                if bull:
                    if high[i] > hp:
                        hp = high[i]
                        af = min(af + af_step, af_max)
                    psar[i] = min(psar[i], low[i - 1], low[i - 2])
                else:
                    if low[i] < lp:
                        lp = low[i]
                        af = min(af + af_step, af_max)
                    psar[i] = max(psar[i], high[i - 1], high[i - 2])
        return psar

    df['psar'] = _psar(df)`,
  },
  {
    id: 'ichimoku',
    name: 'Ichimoku Cloud',
    pine: `tenkan = ta.sma((high + low) / 2, 9)\nkijun = ta.sma((high + low) / 2, 26)\nlongCondition = close > tenkan and tenkan > kijun`,
    python: `    hl2 = (df['high'] + df['low']) / 2\n    df['tenkan_sen'] = hl2.rolling(9).mean()\n    df['kijun_sen'] = hl2.rolling(26).mean()`,
  },
  {
    id: 'keltner',
    name: 'Keltner Channels (20)',
    pine: `ma = ta.sma(close, 20)\natr = ta.atr(high, low, close, 10)\nupper = ma + atr * 2\nlower = ma - atr * 2\nlongCondition = ta.crossover(close, lower)`,
    python: `    ma = df['close'].rolling(20).mean()\n    high_low = df['high'] - df['low']\n    high_close = abs(df['high'] - df['close'].shift())\n    low_close = abs(df['low'] - df['close'].shift())\n    tr = high_low.combine(high_close, max).combine(low_close, max)\n    atr = tr.rolling(10).mean()\n    df['keltner_upper'] = ma + atr * 2\n    df['keltner_lower'] = ma - atr * 2`,
  },
  {
    id: 'donchian',
    name: 'Donchian Channels (20)',
    pine: `upper = ta.highest(high, 20)\nlower = ta.lowest(low, 20)\nlongCondition = ta.crossover(close, upper)`,
    python: `    df['donchian_upper'] = df['high'].rolling(20).max()\n    df['donchian_lower'] = df['low'].rolling(20).min()`,
  },
  {
    id: 'pivot',
    name: 'Pivot Points',
    pine: `pivot = (high[1] + low[1] + close[1]) / 3\nr1 = 2 * pivot - low[1]\ns1 = 2 * pivot - high[1]`,
    python: `    pivot = (df['high'].shift() + df['low'].shift() + df['close'].shift()) / 3\n    df['pivot'] = pivot\n    df['r1'] = 2 * pivot - df['low'].shift()\n    df['s1'] = 2 * pivot - df['high'].shift()`,
  },
  {
    id: 'golden_cross',
    name: 'Golden Cross (50/200)',
    pine: `sma50 = ta.sma(close, 50)\nsma200 = ta.sma(close, 200)\nlongCondition = ta.crossover(sma50, sma200)`,
    python: `    df['sma50'] = df['close'].rolling(50).mean()\n    df['sma200'] = df['close'].rolling(200).mean()`,
  },
  {
    id: 'death_cross',
    name: 'Death Cross (50/200)',
    pine: `sma50 = ta.sma(close, 50)\nsma200 = ta.sma(close, 200)\nshortCondition = ta.crossunder(sma50, sma200)`,
    python: `    df['sma50'] = df['close'].rolling(50).mean()\n    df['sma200'] = df['close'].rolling(200).mean()`,
  },
  {
    id: 'awesome',
    name: 'Awesome Oscillator',
    pine: `ao_val = ta.ao(high, low)`,
    python: `    median = (df['high'] + df['low']) / 2\n    df['awesome_oscillator'] = median.rolling(5).mean() - median.rolling(34).mean()`,
  },
  {
    id: 'stoch_rsi',
    name: 'Stochastic RSI',
    pine: `[k, d] = ta.stochrsi(close, 14, 14, 3, 3)\nlongCondition = ta.crossover(k, d) and k < 20`,
    python: `    delta = df['close'].diff()\n    gain = delta.clip(lower=0).rolling(14).mean()\n    loss = (-delta.clip(upper=0)).rolling(14).mean()\n    rsi = 100 - (100 / (1 + gain / (loss + 1e-9)))\n    min_rsi = rsi.rolling(14).min()\n    max_rsi = rsi.rolling(14).max()\n    stoch_rsi = (rsi - min_rsi) / (max_rsi - min_rsi + 1e-9) * 100\n    df['stoch_rsi_k'] = stoch_rsi.rolling(3).mean()\n    df['stoch_rsi_d'] = df['stoch_rsi_k'].rolling(3).mean()`,
  },
  {
    id: 'trix',
    name: 'TRIX (14)',
    pine: `trix_val = ta.trix(close, 14)`,
    python: `    ema1 = df['close'].ewm(span=14).mean()\n    ema2 = ema1.ewm(span=14).mean()\n    ema3 = ema2.ewm(span=14).mean()\n    df['trix'] = 100 * (ema3 - ema3.shift()) / ema3.shift()`,
  },
  {
    id: 'dema',
    name: 'DEMA (20)',
    pine: `ema1 = ta.ema(close, 20)\nema2 = ta.ema(ema1, 20)\ndema_val = 2 * ema1 - ema2`,
    python: `    ema1 = df['close'].ewm(span=20, adjust=False).mean()\n    ema2 = ema1.ewm(span=20, adjust=False).mean()\n    df['dema'] = 2 * ema1 - ema2`,
  },
  {
    id: 'tema',
    name: 'TEMA (20)',
    pine: `ema1 = ta.ema(close, 20)\nema2 = ta.ema(ema1, 20)\nema3 = ta.ema(ema2, 20)\ntema_val = 3 * ema1 - 3 * ema2 + ema3`,
    python: `    ema1 = df['close'].ewm(span=20, adjust=False).mean()\n    ema2 = ema1.ewm(span=20, adjust=False).mean()\n    ema3 = ema2.ewm(span=20, adjust=False).mean()\n    df['tema'] = 3 * ema1 - 3 * ema2 + ema3`,
  },
  {
    id: 'hull',
    name: 'Hull Moving Average (20)',
    pine: `hma_val = ta.hma(close, 20)`,
    python: `    half = 10\n    sqrt_length = int(np.sqrt(20))\n    wma1 = df['close'].rolling(half).apply(lambda x: np.dot(x, np.arange(1, half + 1)) / np.sum(np.arange(1, half + 1)))\n    wma2 = df['close'].rolling(20).apply(lambda x: np.dot(x, np.arange(1, 21)) / np.sum(np.arange(1, 21)))\n    raw_hma = 2 * wma1 - wma2\n    df['hma'] = raw_hma.rolling(sqrt_length).apply(lambda x: np.dot(x, np.arange(1, sqrt_length + 1)) / np.sum(np.arange(1, sqrt_length + 1)))`,
  },
  {
    id: 'supertrend',
    name: 'Supertrend (10,3)',
    pine: `atr = ta.atr(high, low, close, 10)\nhl2 = (high + low) / 2\nbasic_upper = hl2 + (3 * atr)\nbasic_lower = hl2 - (3 * atr)\nlongCondition = close > basic_upper`,
    python: `    high_low = df['high'] - df['low']\n    high_close = abs(df['high'] - df['close'].shift())\n    low_close = abs(df['low'] - df['close'].shift())\n    tr = high_low.combine(high_close, max).combine(low_close, max)\n    atr = tr.rolling(10).mean()\n    hl2 = (df['high'] + df['low']) / 2\n    df['supertrend_upper'] = hl2 + (3 * atr)\n    df['supertrend_lower'] = hl2 - (3 * atr)`,
  },
  {
    id: 'chaikin',
    name: 'Chaikin Money Flow (20)',
    pine: `cmf_val = ta.cmf(close, volume, high, low, 20)`,
    python: `    mfm = ((df['close'] - df['low']) - (df['high'] - df['close'])) / (df['high'] - df['low'] + 1e-9)\n    mfv = mfm * df['volume']\n    df['cmf'] = mfv.rolling(20).sum() / df['volume'].rolling(20).sum()`,
  },
  {
    id: 'mfi',
    name: 'Money Flow Index (14)',
    pine: `mfi_val = ta.mfi(close, high, low, volume, 14)\nlongCondition = ta.crossover(mfi_val, 30)`,
    python: `    tp = (df['high'] + df['low'] + df['close']) / 3\n    mf = tp * df['volume']\n    pos_mf = mf.where(tp > tp.shift(), 0)\n    neg_mf = mf.where(tp < tp.shift(), 0)\n    mfr = pos_mf.rolling(14).sum() / neg_mf.rolling(14).sum()\n    df['mfi'] = 100 - (100 / (1 + mfr))`,
  },
  {
    id: 'elder_ray',
    name: 'Elder Ray Index',
    pine: `ema13 = ta.ema(close, 13)\nbull_power = high - ema13\nbear_power = low - ema13\nlongCondition = bull_power > 0 and bear_power > 0`,
    python: `    ema13 = df['close'].ewm(span=13, adjust=False).mean()\n    df['bull_power'] = df['high'] - ema13\n    df['bear_power'] = df['low'] - ema13`,
  },
  {
    id: 'force_index',
    name: 'Force Index (13)',
    pine: `fi_val = (close - close[1]) * volume\nfi_sma = ta.sma(fi_val, 13)`,
    python: `    fi = (df['close'] - df['close'].shift()) * df['volume']\n    df['force_index'] = fi.rolling(13).mean()`,
  },
  {
    id: 'eom',
    name: 'Ease of Movement (14)',
    pine: `emv_val = ta.eom(high, low, volume, 14)\nlongCondition = ta.crossover(emv_val, 0)`,
    python: `    mid = (df['high'] + df['low']) / 2\n    dm = mid.diff()\n    br = (df['volume'] / 100000000) / (df['high'] - df['low'])\n    df['eom'] = (dm / br).rolling(14).mean()`,
  },
  {
    id: 'vpt',
    name: 'Volume Price Trend',
    pine: `vpt_val = 0\nvpt_val := vpt_val[1] + volume * ((close - close[1]) / close[1])`,
    python: `    vpt = df['volume'] * ((df['close'] - df['close'].shift()) / (df['close'].shift() + 1e-9))\n    df['vpt'] = vpt.cumsum()`,
  },
  {
    id: 'ultimate',
    name: 'Ultimate Oscillator',
    pine: `uo_val = ta.uo(close, high, low, 7, 14, 28)\nlongCondition = ta.crossover(uo_val, 30)`,
    python: `    def true_low(h, l, c): return min(l, c.shift())\n    def true_high(h, l, c): return max(h, c.shift())\n    tl = true_low(df['high'], df['low'], df['close'])\n    th = true_high(df['high'], df['low'], df['close'])\n    bp = df['close'] - tl\n    tr = th - tl\n    avg7 = bp.rolling(7).sum() / tr.rolling(7).sum()\n    avg14 = bp.rolling(14).sum() / tr.rolling(14).sum()\n    avg28 = bp.rolling(28).sum() / tr.rolling(28).sum()\n    df['ultimate'] = 100 * ((4 * avg7) + (2 * avg14) + avg28) / 7`,
  },
  {
    id: 'true_strength',
    name: 'True Strength Index',
    pine: `tsi_val = ta.tsi(close, 25, 13)\nlongCondition = ta.crossover(tsi_val, 0)`,
    python: `    diff = df['close'].diff()\n    abs_diff = abs(diff)\n    ema25 = diff.ewm(span=25).mean()\n    ema13 = ema25.ewm(span=13).mean()\n    abs_ema25 = abs_diff.ewm(span=25).mean()\n    abs_ema13 = abs_ema25.ewm(span=13).mean()\n    df['tsi'] = 100 * (ema13 / (abs_ema13 + 1e-9))`,
  },
  {
    id: 'squeeze_momentum',
    name: 'Squeeze Momentum',
    pine: `[mid, upper, lower] = ta.bb(close, 20, 2)\natr = ta.atr(high, low, close, 10)\nkma = ta.sma(close, 20)\nkc_upper = kma + (atr * 1.5)\nkc_lower = kma - (atr * 1.5)\nsqueeze_on = lower > kc_lower and upper < kc_upper\nlinreg = ta.linreg(close, 20, 0)`,
    python: `    mid = df['close'].rolling(20).mean()\n    std = df['close'].rolling(20).std()\n    bb_upper = mid + 2 * std\n    bb_lower = mid - 2 * std\n    high_low = df['high'] - df['low']\n    high_close = abs(df['high'] - df['close'].shift())\n    low_close = abs(df['low'] - df['close'].shift())\n    tr = high_low.combine(high_close, max).combine(low_close, max)\n    atr = tr.rolling(10).mean()\n    kma = mid\n    kc_upper = kma + atr * 1.5\n    kc_lower = kma - atr * 1.5\n    df['squeeze_on'] = (bb_lower > kc_lower) & (bb_upper < kc_upper)`,
  },
  {
    id: 'chandelier',
    name: 'Chandelier Exit',
    pine: `atr = ta.atr(high, low, close, 22)\nlong_exit = ta.highest(high, 22) - (atr * 3)\nshort_exit = ta.lowest(low, 22) + (atr * 3)`,
    python: `    high_low = df['high'] - df['low']\n    high_close = abs(df['high'] - df['close'].shift())\n    low_close = abs(df['low'] - df['close'].shift())\n    tr = high_low.combine(high_close, max).combine(low_close, max)\n    atr = tr.rolling(22).mean()\n    df['chandelier_long_exit'] = df['high'].rolling(22).max() - (atr * 3)\n    df['chandelier_short_exit'] = df['low'].rolling(22).min() + (atr * 3)`,
  },
  {
    id: 'dpo',
    name: 'Detrended Price Oscillator (20)',
    pine: `dpo_val = ta.dpo(close, 20)\nlongCondition = ta.crossover(dpo_val, 0)`,
    python: `    sma20 = df['close'].rolling(20).mean()\n    df['dpo'] = df['close'].shift(-10) - sma20`,
  },
  {
    id: 'mass_index',
    name: 'Mass Index',
    pine: `mi_val = ta.mi(high, low, 9, 25)`,
    python: `    high_low = df['high'] - df['low']\n    ema1 = high_low.ewm(span=9).mean()\n    ema2 = ema1.ewm(span=9).mean()\n    ratio = ema1 / (ema2 + 1e-9)\n    df['mass_index'] = ratio.rolling(25).sum()`,
  },
  {
    id: 'relative_vigor',
    name: 'Relative Vigor Index',
    pine: `[rvi, signal] = ta.rvi(close, high, low, 10)\nlongCondition = ta.crossover(rvi, signal)`,
    python: `    o = df['open']\n    h = df['high']\n    l = df['low']\n    c = df['close']\n    num = (c - o) + 2*(c.shift()-o.shift()) + 2*(c.shift(2)-o.shift(2)) + (c.shift(3)-o.shift(3))\n    den = (h - l) + 2*(h.shift()-l.shift()) + 2*(h.shift(2)-l.shift(2)) + (h.shift(3)-l.shift(3))\n    rvi = num.rolling(10).mean() / (den.rolling(10).mean() + 1e-9)\n    df['rvi'] = rvi\n    df['rvi_signal'] = rvi.rolling(4).mean()`,
  },
  {
    id: 'typical_price',
    name: 'Typical Price',
    pine: `tp_val = (high + low + close) / 3`,
    python: `    df['typical_price'] = (df['high'] + df['low'] + df['close']) / 3`,
  },
  {
    id: 'median_price',
    name: 'Median Price',
    pine: `mp_val = (high + low) / 2`,
    python: `    df['median_price'] = (df['high'] + df['low']) / 2`,
  },
  {
    id: 'weighted_close',
    name: 'Weighted Close',
    pine: `wc_val = (high + low + close * 2) / 4`,
    python: `    df['weighted_close'] = (df['high'] + df['low'] + df['close'] * 2) / 4`,
  },
  {
    id: 'ema50',
    name: 'EMA (50)',
    pine: `ema50_val = ta.ema(close, 50)\nlongCondition = ta.crossover(close, ema50_val)`,
    python: `    df['ema50'] = df['close'].ewm(span=50, adjust=False).mean()`,
  },
  {
    id: 'ema100',
    name: 'EMA (100)',
    pine: `ema100_val = ta.ema(close, 100)\nlongCondition = ta.crossover(close, ema100_val)`,
    python: `    df['ema100'] = df['close'].ewm(span=100, adjust=False).mean()`,
  },
  {
    id: 'ema200',
    name: 'EMA (200)',
    pine: `ema200_val = ta.ema(close, 200)\nlongCondition = ta.crossover(close, ema200_val)`,
    python: `    df['ema200'] = df['close'].ewm(span=200, adjust=False).mean()`,
  },
  {
    id: 'sma20',
    name: 'SMA (20)',
    pine: `sma20_val = ta.sma(close, 20)\nlongCondition = ta.crossover(close, sma20_val)`,
    python: `    df['sma20'] = df['close'].rolling(20).mean()`,
  },
  {
    id: 'vwma',
    name: 'VWMA (20)',
    pine: `vwma_val = ta.vwma(close, volume, 20)`,
    python: `    pv = df['close'] * df['volume']\n    df['vwma'] = pv.rolling(20).sum() / df['volume'].rolling(20).sum()`,
  },
  {
    id: 'coppock',
    name: 'Coppock Curve',
    pine: `roc14 = ta.roc(close, 14)\nroc11 = ta.roc(close, 11)\ncc_val = ta.wma(roc14 + roc11, 10)\nlongCondition = ta.crossover(cc_val, 0)`,
    python: `    roc14 = (df['close'] - df['close'].shift(14)) / (df['close'].shift(14) + 1e-9) * 100\n    roc11 = (df['close'] - df['close'].shift(11)) / (df['close'].shift(11) + 1e-9) * 100\n    combined = roc14 + roc11\n    df['coppock'] = combined.rolling(10).apply(lambda x: np.dot(x, np.arange(10, 0, -1)) / np.sum(np.arange(10, 0, -1)))`,
  },
  {
    id: 'kst',
    name: 'KST Oscillator',
    pine: `kst_val = ta.kst(close, 10, 15, 20, 30, 10, 10, 10, 15)\nlongCondition = ta.crossover(kst_val, ta.sma(kst_val, 9))`,
    python: `    def roc(s, n): return (s - s.shift(n)) / (s.shift(n) + 1e-9) * 100\n    rcma1 = roc(df['close'], 10).rolling(10).mean()\n    rcma2 = roc(df['close'], 15).rolling(10).mean()\n    rcma3 = roc(df['close'], 20).rolling(10).mean()\n    rcma4 = roc(df['close'], 30).rolling(15).mean()\n    df['kst'] = rcma1 + rcma2 * 2 + rcma3 * 3 + rcma4 * 4`,
  },
];

export const DEFAULT_PYTHON_STRATEGY = `def strategy(df):
    """EMA 9/21 crossover — must return list of dicts with 'profit'."""
    trades = []
    close = df['close'].astype(float)
    ema9 = close.ewm(span=9, adjust=False).mean()
    ema21 = close.ewm(span=21, adjust=False).mean()
    in_position = False
    entry = 0.0

    for i in range(22, len(df)):
        cross_up = ema9.iloc[i] > ema21.iloc[i] and ema9.iloc[i - 1] <= ema21.iloc[i - 1]
        cross_down = ema9.iloc[i] < ema21.iloc[i] and ema9.iloc[i - 1] >= ema21.iloc[i - 1]
        if cross_up and not in_position:
            in_position = True
            entry = float(close.iloc[i])
        elif cross_down and in_position:
            exit_price = float(close.iloc[i])
            trades.append({
                'type': 'Long',
                'date': str(df['time'].iloc[i]),
                'price': exit_price,
                'profit': round(exit_price - entry, 4),
            })
            in_position = False
    return trades`;

export function parseBacktestNumber(val) {
  if (typeof val === 'number' && !Number.isNaN(val)) return val;
  const m = String(val ?? '').replace(/,/g, '').match(/-?[\d.]+/);
  return m ? parseFloat(m[0]) : 0;
}

export function normalizeEquityCurve(curve) {
  return (curve || []).map((p, i) => ({
    trade: p.trade || p.date || `T${i + 1}`,
    date: p.date || p.trade || `T${i + 1}`,
    equity: parseBacktestNumber(p.equity),
    pnl: parseBacktestNumber(p.pnl ?? p.profit ?? 0),
    drawdown: parseBacktestNumber(p.drawdown ?? p.drawdownPct ?? 0),
  }));
}

function csvField(value) {
  const str = String(value ?? '');
  // Quote (and escape internal quotes) whenever the field contains a comma,
  // quote, or newline — otherwise those characters would silently shift columns.
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportTradesCsv(trades, symbol) {
  const header = 'id,type,date,price,profit\n';
  const rows = (trades || []).map((t) =>
    [t.id, t.type, t.date, t.price, t.profit].map(csvField).join(',')
  ).join('\n');
  const blob = new Blob([header + rows], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${symbol}_trades.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadStrategyFile(code, language, symbol) {
  const ext = language === 'pine' ? 'pine' : 'py';
  const blob = new Blob([code], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${symbol}_strategy.${ext}`;
  a.click();
  URL.revokeObjectURL(url);
}
