import os
import time
import re
import ccxt
import pandas as pd
import numpy as np
import requests
from datetime import datetime
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from ai_service import run_ai_assist, ai_status
from auth_store import (
    AuthError,
    create_session,
    verify_otp,
    get_user_by_token,
    signup_with_password,
    verify_password_and_issue_token,
    reset_password_with_verified_otp,
)
from contextlib import asynccontextmanager
from apscheduler.schedulers.background import BackgroundScheduler
from typing import Optional

from db import get_news_by_symbol, get_sentiment_by_symbol, create_bounty, get_all_bounties, submit_solution, approve_solution
from news_fetcher import fetch_all_news
from harvester import start_harvester
from database import get_candles, save_candles, get_latest_timestamp

scheduler = BackgroundScheduler()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Start the background news fetcher
    scheduler.add_job(fetch_all_news, 'interval', minutes=10)
    scheduler.start()
    # Also trigger it immediately on startup
    try:
        fetch_all_news()
    except Exception as e:
        print(f"Initial fetch error: {e}")

    # Start the Autonomous Multi-Exchange Harvester
    print("Starting Autonomous Harvester & Auto-Archiver...")
    start_harvester()
    
    yield
    
    # Shutdown scheduler
    scheduler.shutdown()

app = FastAPI(lifespan=lifespan)

# =========================================
# DEMO AUTH ENDPOINTS (OTP + access token)
# =========================================

class AuthStartRequest(BaseModel):
    email: Optional[str] = None

class AuthVerifyRequest(BaseModel):
    sessionId: str
    otp: str

@app.post("/auth/start")
async def auth_start(request: AuthStartRequest):
    email = (request.email or '').strip()
    if not email:
        raise HTTPException(status_code=400, detail="Provide Gmail address")
    try:
        return create_session(email)
    except AuthError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/auth/verify")
async def auth_verify(request: AuthVerifyRequest):
    try:
        token = verify_otp(request.sessionId, request.otp)
    except AuthError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {
        "accessToken": token.get('accessToken'),
        "user": token.get('user'),
    }


class PasswordSignupRequest(BaseModel):
    email: Optional[str] = None
    password: str = ''


class PasswordLoginRequest(BaseModel):
    email: Optional[str] = None
    password: str = ''


class PasswordResetRequest(BaseModel):
    sessionId: str
    otp: str
    email: Optional[str] = None
    newPassword: str = ''


@app.post("/auth/signup-password")
async def auth_signup_password(request: PasswordSignupRequest):
    email = (request.email or '').strip()
    password = request.password or ''
    if not email:
        raise HTTPException(status_code=400, detail="Provide Gmail address")
    try:
        token = signup_with_password(email, password)
    except AuthError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {
        "accessToken": token.get('accessToken'),
        "user": token.get('user'),
    }


@app.post("/auth/login-password")
async def auth_login_password(request: PasswordLoginRequest):
    email = (request.email or '').strip()
    password = request.password or ''
    if not email:
        raise HTTPException(status_code=400, detail="Provide Gmail address")
    try:
        token = verify_password_and_issue_token(email, password)
    except AuthError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {
        "accessToken": token.get('accessToken'),
        "user": token.get('user'),
    }


@app.post("/auth/reset-password")
async def auth_reset_password(request: PasswordResetRequest):
    email = (request.email or '').strip()
    if not email:
        raise HTTPException(status_code=400, detail="Provide Gmail address")
    try:
        reset_password_with_verified_otp(
            session_id=request.sessionId,
            otp=request.otp,
            email=email,
            new_password=request.newPassword,
        )
        token = verify_password_and_issue_token(email, request.newPassword)
    except AuthError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {
        "accessToken": token.get('accessToken'),
        "user": token.get('user'),
    }


def _extract_bearer_token(authorization: Optional[str]) -> Optional[str]:
    if not authorization:
        return None
    scheme, _, token = authorization.partition(' ')
    if scheme.lower() != 'bearer' or not token.strip():
        return None
    return token.strip()


@app.get("/me")
async def get_me(authorization: Optional[str] = Header(None)):
    token = _extract_bearer_token(authorization)
    user = get_user_by_token(token or '')
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return {"user": user}

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class PineRequest(BaseModel):
    code: str
    ticker: str
    timeframe: str

class PythonRequest(BaseModel):
    code: str
    ticker: str
    timeframe: str

class AIAssistRequest(BaseModel):
    provider: str = 'groq'
    prompt: str = ''
    mode: str = 'chat'
    code: str = ''
    language: str = 'pine'
    ticker: str = 'BTCUSDT'
    timeframe: str = '1m'
    exchange: str = 'binance'
    context: Optional[dict] = None

# =========================================
# BOUNTY ENDPOINTS
# =========================================
import uuid

class BountyCreateRequest(BaseModel):
    title: str
    description: str
    reward: str

class BountySolveRequest(BaseModel):
    solution_text: str

class BountyApproveRequest(BaseModel):
    solution_id: str
    solver_id: str
    solution_text: str

@app.get("/api/bounties")
async def get_bounties():
    try:
        return {"bounties": get_all_bounties()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/bounties")
async def post_bounty(request: BountyCreateRequest, authorization: Optional[str] = Header(None)):
    token = _extract_bearer_token(authorization)
    user = get_user_by_token(token or '')
    poster_id = user.get('email') if user else 'Anonymous'
    
    bounty_id = str(uuid.uuid4())
    created_at = int(time.time() * 1000)
    
    try:
        create_bounty(bounty_id, request.title, request.description, request.reward, poster_id, created_at)
        return {"status": "success", "bounty_id": bounty_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/bounties/{bounty_id}/solve")
async def solve_bounty(bounty_id: str, request: BountySolveRequest, authorization: Optional[str] = Header(None)):
    token = _extract_bearer_token(authorization)
    user = get_user_by_token(token or '')
    solver_id = user.get('email') if user else 'Anonymous'
    
    solution_id = str(uuid.uuid4())
    submitted_at = int(time.time() * 1000)
    
    try:
        submit_solution(solution_id, bounty_id, solver_id, request.solution_text, submitted_at)
        return {"status": "success", "solution_id": solution_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/bounties/{bounty_id}/approve")
async def approve_bounty(bounty_id: str, request: BountyApproveRequest, authorization: Optional[str] = Header(None)):
    token = _extract_bearer_token(authorization)
    user = get_user_by_token(token or '')
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
        
    try:
        approve_solution(bounty_id, request.solver_id, request.solution_text)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# =========================================
# CONFIGURATION
# =========================================
DATA_BASE = "./binance_data/spot/klines"  # Downloaded folder root
RATE_LIMIT_SAFE = 0.05  # seconds between Binance requests

# =========================================
# LOCAL DATA LOADER
# =========================================
def load_local_candles(symbol: str, interval: str):
    folder = os.path.join(DATA_BASE, interval, symbol.upper())
    if not os.path.exists(folder):
        return None
    csv_files = sorted([f for f in os.listdir(folder) if f.endswith('.csv')])
    if not csv_files:
        return None

    dfs = []
    for f in csv_files:
        df = pd.read_csv(os.path.join(folder, f))
        dfs.append(df)
    full_df = pd.concat(dfs, ignore_index=True)

    # Rename columns (Binance historical data format)
    full_df.rename(columns={
        'Open time': 'open_time',
        'Open': 'open',
        'High': 'high',
        'Low': 'low',
        'Close': 'close',
        'Volume': 'volume'
    }, inplace=True)
    full_df['open_time'] = pd.to_datetime(full_df['open_time'], unit='ms')
    full_df.sort_values('open_time', inplace=True)
    full_df['time'] = full_df['open_time'].dt.strftime('%Y-%m-%d %H:%M')
    return full_df

# =========================================
# BINANCE FETCHER (Rate‑limited pagination)
# =========================================
_last_binance_request = 0

def fetch_binance_batch(symbol: str, interval: str, limit: int = 1000, end_time: int = None):
    global _last_binance_request
    now = time.time()
    if now - _last_binance_request < RATE_LIMIT_SAFE:
        time.sleep(RATE_LIMIT_SAFE - (now - _last_binance_request))
    _last_binance_request = time.time()

    url = f"https://api.binance.com/api/v3/klines?symbol={symbol}&interval={interval}&limit={limit}"
    if end_time:
        url += f"&endTime={end_time}"
    try:
        resp = requests.get(url, timeout=10)
        data = resp.json()
        if isinstance(data, dict) and 'code' in data:
            return []
        return data
    except:
        return []

def fetch_binance_candles(symbol: str, interval: str, limit: int = 1000, before: int = None):
    symbol_upper = symbol.upper()
    all_klines = []
    end_time = before * 1000 if before else None  # API expects milliseconds
    fetch_limit = 1000
    remaining = limit

    while remaining > 0:
        batch = fetch_binance_batch(symbol_upper, interval, limit=min(fetch_limit, remaining), end_time=end_time)
        if not batch:
            break
        # Binance returns oldest first, we prepend since we're going backwards
        all_klines = batch + all_klines
        end_time = batch[0][0] - 1  # next batch endTime = start of current - 1ms
        remaining -= len(batch)
        if len(batch) < fetch_limit:
            break

    candles = []
    for c in all_klines:
        candles.append({
            "time": c[0] // 1000,  # ms → seconds
            "open": float(c[1]),
            "high": float(c[2]),
            "low": float(c[3]),
            "close": float(c[4]),
            "volume": float(c[5])
        })
    return candles

# =========================================
# HELPER: Get available coins (local + Binance)
# =========================================
_binance_coins_cache = None

def get_all_available_coins():
    global _binance_coins_cache
    coins = set()
    # Local coins from any timeframe folder (prefer '1d')
    base_1d = os.path.join(DATA_BASE, "1d")
    if os.path.exists(base_1d):
        for name in os.listdir(base_1d):
            if name.endswith('.csv'):
                coins.add(name[:-4])
            else:
                coins.add(name)

    if _binance_coins_cache is not None:
        coins.update(_binance_coins_cache)
        return sorted(list(coins))

    # All Binance Spot TRADING pairs
    try:
        resp = requests.get("https://api.binance.com/api/v3/exchangeInfo", timeout=2.0)
        if resp.status_code == 200:
            data = resp.json()
            binance_list = []
            for s in data.get('symbols', []):
                if s.get('status') != 'TRADING':
                    continue
                permissions = s.get('permissions') or []
                if permissions and 'SPOT' not in permissions:
                    continue
                if s.get('isSpotTradingAllowed') is False:
                    continue
                binance_list.append(s['symbol'])
            if binance_list:
                _binance_coins_cache = binance_list
                coins.update(binance_list)
                return sorted(list(coins))
    except Exception as e:
        pass

    # Fallback to major spot pairs if binance request fails/times out
    fallback_binance = [
        'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT', 'ADAUSDT',
        'AVAXUSDT', 'LINKUSDT', 'TRXUSDT', 'DOTUSDT', 'MATICUSDT', 'LTCUSDT', 'ATOMUSDT',
        'UNIUSDT', 'SHIBUSDT', 'OPUSDT', 'ARBUSDT', 'NEARUSDT', 'INJUSDT', 'AAVEUSDT',
        'SUIUSDT', 'PEPEUSDT', 'RUNEUSDT', 'ALGOUSDT', 'FILUSDT', 'APTUSDT', 'SEIUSDT',
        'TAOUSDT'
    ]
    coins.update(fallback_binance)
    return sorted(list(coins))

# =========================================
# INDICATOR FUNCTIONS (unchanged)
# =========================================
def compute_ema(series, period):
    return series.ewm(span=period, adjust=False).mean()

def compute_sma(series, period):
    return series.rolling(window=period).mean()

def compute_rsi(series, period):
    delta = series.diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
    rs = gain / (loss + 1e-9)
    return 100 - (100 / (1 + rs))

def compute_macd(series, fast=12, slow=26, signal=9):
    ema_fast = compute_ema(series, fast)
    ema_slow = compute_ema(series, slow)
    macd_line = ema_fast - ema_slow
    signal_line = compute_ema(macd_line, signal)
    return macd_line, signal_line

def compute_bollinger(series, period=20, std=2):
    sma = compute_sma(series, period)
    std_dev = series.rolling(window=period).std()
    upper = sma + std * std_dev
    lower = sma - std * std_dev
    return upper, sma, lower

def compute_stochastic(df, k_period=14, d_period=3):
    low_min = df['low'].rolling(window=k_period).min()
    high_max = df['high'].rolling(window=k_period).max()
    k = 100 * ((df['close'] - low_min) / (high_max - low_min + 1e-9))
    d = k.rolling(window=d_period).mean()
    return k, d

def compute_atr(df, period=14):
    high = df['high']
    low = df['low']
    close = df['close']
    tr1 = high - low
    tr2 = abs(high - close.shift())
    tr3 = abs(low - close.shift())
    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    return tr.rolling(window=period).mean()

def compute_adx(df, period=14):
    high = df['high']
    low = df['low']
    close = df['close']
    plus_dm = high.diff()
    minus_dm = -low.diff()
    plus_dm[plus_dm < 0] = 0
    minus_dm[minus_dm < 0] = 0
    tr = compute_atr(df, period)
    plus_di = 100 * (compute_ema(plus_dm, period) / tr)
    minus_di = 100 * (compute_ema(minus_dm, period) / tr)
    dx = (abs(plus_di - minus_di) / (plus_di + minus_di + 1e-9)) * 100
    adx = compute_ema(dx, period)
    return adx, plus_di, minus_di

def compute_supertrend(df, period=7, multiplier=3):
    high = df['high']
    low = df['low']
    close = df['close']
    atr = compute_atr(df, period)
    hl_avg = (high + low) / 2
    upper_band = hl_avg + multiplier * atr
    lower_band = hl_avg - multiplier * atr
    trend = pd.Series(1, index=df.index)
    
    close_arr = close.values
    upper_arr = upper_band.values
    lower_arr = lower_band.values
    trend_arr = trend.values
    
    for i in range(1, len(df)):
        if close_arr[i] > upper_arr[i-1]:
            trend_arr[i] = 1
        elif close_arr[i] < lower_arr[i-1]:
            trend_arr[i] = -1
        else:
            trend_arr[i] = trend_arr[i-1]
            
        if trend_arr[i] == 1 and lower_arr[i] < lower_arr[i-1]:
            lower_arr[i] = lower_arr[i-1]
        if trend_arr[i] == -1 and upper_arr[i] > upper_arr[i-1]:
            upper_arr[i] = upper_arr[i-1]
            
    return trend, upper_band, lower_band

# =========================================
# PINE PARSER & BACKTEST ENGINE
# =========================================
def parse_and_run_backtest(df, code_content):
    script = code_content.lower()
    indicator_pattern = re.findall(r'(ema|sma|rsi|macd|bollinger|stochastic|atr|adx|supertrend)\s*\(\s*(close|high|low|open)\s*,\s*(\d+(?:,\s*\d+)?)\s*\)', script)
    ind_refs = {}

    for ind_type, src, params in indicator_pattern:
        params = [int(p) for p in params.split(',')]
        src_col = df[src]
        if ind_type == 'ema':
            val = compute_ema(src_col, params[0])
            col_name = f"ema_{params[0]}"
            df[col_name] = val
            ind_refs[col_name] = val
        elif ind_type == 'sma':
            val = compute_sma(src_col, params[0])
            col_name = f"sma_{params[0]}"
            df[col_name] = val
            ind_refs[col_name] = val
        elif ind_type == 'rsi':
            val = compute_rsi(src_col, params[0])
            col_name = f"rsi_{params[0]}"
            df[col_name] = val
            ind_refs[col_name] = val
        elif ind_type == 'macd':
            fast, slow, signal = (params + [9])[:3]
            macd_line, signal_line = compute_macd(src_col, fast, slow, signal)
            col_macd = f"macd_{fast}_{slow}"
            col_signal = f"signal_{fast}_{slow}"
            df[col_macd] = macd_line
            df[col_signal] = signal_line
            ind_refs[col_macd] = macd_line
            ind_refs[col_signal] = signal_line
        elif ind_type == 'bollinger':
            period, std = params[0], params[1] if len(params)>1 else 2
            upper, mid, lower = compute_bollinger(src_col, period, std)
            df[f"bb_upper_{period}"] = upper
            df[f"bb_mid_{period}"] = mid
            df[f"bb_lower_{period}"] = lower
            ind_refs[f"bb_upper_{period}"] = upper
            ind_refs[f"bb_lower_{period}"] = lower
        elif ind_type == 'stochastic':
            k_period, d_period = params[0], params[1] if len(params)>1 else 3
            k, d = compute_stochastic(df, k_period, d_period)
            df[f"stoch_k_{k_period}"] = k
            df[f"stoch_d_{k_period}"] = d
            ind_refs[f"stoch_k_{k_period}"] = k
            ind_refs[f"stoch_d_{k_period}"] = d
        elif ind_type == 'atr':
            val = compute_atr(df, params[0])
            col_name = f"atr_{params[0]}"
            df[col_name] = val
            ind_refs[col_name] = val
        elif ind_type == 'adx':
            period = params[0]
            adx, plus_di, minus_di = compute_adx(df, period)
            df[f"adx_{period}"] = adx
            df[f"plus_di_{period}"] = plus_di
            df[f"minus_di_{period}"] = minus_di
            ind_refs[f"adx_{period}"] = adx
        elif ind_type == 'supertrend':
            period, mult = params[0], params[1] if len(params)>1 else 3
            trend, upper, lower = compute_supertrend(df, period, mult)
            df[f"supertrend_{period}"] = trend
            ind_refs[f"supertrend_{period}"] = trend

    long_cond = None
    short_cond = None
    long_match = re.search(r'longcondition\s*=\s*(.+?)(?:\n|$)', script)
    short_match = re.search(r'shortcondition\s*=\s*(.+?)(?:\n|$)', script)
    if long_match:
        long_cond = long_match.group(1).strip()
    if short_match:
        short_cond = short_match.group(1).strip()

    if not long_cond and not short_cond:
        cross_match = re.search(r'crossover\(\s*(\w+)\s*,\s*(\w+)\s*\)', script)
        if cross_match:
            ind1 = cross_match.group(1).lower()
            ind2 = cross_match.group(2).lower()
            if ind1 in df.columns and ind2 in df.columns:
                long_cond = f"crossover({ind1}, {ind2})"
        rsi_match = re.search(r'rsi\w*\s*<\s*(\d+)', script)
        if rsi_match:
            long_cond = f"rsi < {rsi_match.group(1)}"
        macd_cross = re.search(r'crossover\(macd\w*,\s*signal\w*\)', script)
        if macd_cross:
            long_cond = "crossover(macd, signal)"

    buy_signal = pd.Series(0, index=df.index)
    sell_signal = pd.Series(0, index=df.index)

    def eval_cond(cond_str):
        if not cond_str:
            return pd.Series(0, index=df.index)
        def crossover_repl(match):
            a = match.group(1)
            b = match.group(2)
            return f"(({a} > {b}) & ({a}_shift <= {b}_shift))"
        cond_str = re.sub(r'crossover\(\s*(\w+)\s*,\s*(\w+)\s*\)', crossover_repl, cond_str)
        def crossunder_repl(match):
            a = match.group(1)
            b = match.group(2)
            return f"(({a} < {b}) & ({a}_shift >= {b}_shift))"
        cond_str = re.sub(r'crossunder\(\s*(\w+)\s*,\s*(\w+)\s*\)', crossunder_repl, cond_str)

        used_cols = re.findall(r'\b([a-zA-Z_]\w*)\b', cond_str)
        needed_shifts = [c for c in used_cols if c in df.columns]
        for c in needed_shifts:
            df[c+'_shift'] = df[c].shift(1)

        try:
            result = df.eval(cond_str, engine='python')
        except Exception:
            result = pd.Series(0, index=df.index)
        finally:
            for c in needed_shifts:
                if c+'_shift' in df.columns:
                    del df[c+'_shift']
        return result.astype(int)

    if long_cond:
        buy_signal = eval_cond(long_cond)
    if short_cond:
        sell_signal = eval_cond(short_cond)

    in_position = False
    entry_price = 0
    trades = []
    trade_id = 1
    
    # Extract numpy arrays for fast iteration instead of slow .iloc
    buy_arr = buy_signal.values
    sell_arr = sell_signal.values
    close_arr = df['close'].values
    time_arr = df['time'].values
    
    for i in range(len(close_arr)):
        if buy_arr[i] == 1 and not in_position:
            in_position = True
            entry_price = close_arr[i]
        elif (sell_arr[i] == 1 and in_position) or (buy_arr[i] == 0 and in_position):
            in_position = False
            exit_price = close_arr[i]
            pnl = round(float(exit_price - entry_price), 2)
            date_str = str(time_arr[i])
            trades.append({
                "id": trade_id,
                "type": "Long",
                "date": date_str,
                "price": float(exit_price),
                "profit": pnl
            })
            trade_id += 1
    return trades

# =========================================
# ENDPOINTS
# =========================================

@app.get("/health")
async def health():
    return {"ok": True, "service": "quantaai-backend"}


@app.get("/coins")
async def get_coins():
    return {"coins": get_all_available_coins()}


@app.get("/ai/status")
async def get_ai_status():
    return ai_status()


@app.post("/ai/assist")
async def ai_assist(request: AIAssistRequest):
    try:
        result = run_ai_assist(
            provider=request.provider,
            prompt=request.prompt,
            language=request.language,
            ticker=request.ticker,
            timeframe=request.timeframe,
            exchange=request.exchange,
            code=request.code,
            mode=request.mode,
            context=request.context,
        )
        return result
    except Exception as e:
        return {"error": str(e)}

# =========================================
# REAL-TIME MARKET DATA & MARKET INTELLIGENCE
# =========================================

@app.get("/market/depth/{symbol}")
async def get_order_book(symbol: str, limit: int = 100):
    url = f"https://api.binance.com/api/v3/depth?symbol={symbol.upper()}&limit={limit}"
    try:
        resp = requests.get(url, timeout=5)
        return resp.json()
    except Exception as e:
        return {"error": str(e)}

@app.get("/market/trades/{symbol}")
async def get_recent_trades(symbol: str, limit: int = 50):
    url = f"https://api.binance.com/api/v3/trades?symbol={symbol.upper()}&limit={limit}"
    try:
        resp = requests.get(url, timeout=5)
        return resp.json()
    except Exception as e:
        return {"error": str(e)}

@app.get("/market/ticker/24hr")
async def get_24hr_ticker(symbol: str = None):
    url = "https://api.binance.com/api/v3/ticker/24hr"
    if symbol:
        url += f"?symbol={symbol.upper()}"
    try:
        resp = requests.get(url, timeout=5)
        return resp.json()
    except Exception as e:
        return {"error": str(e)}

@app.get("/market/funding-rate/{symbol}")
async def get_funding_rate(symbol: str):
    url = f"https://fapi.binance.com/fapi/v1/fundingRate?symbol={symbol.upper()}"
    try:
        resp = requests.get(url, timeout=5)
        return resp.json()
    except Exception as e:
        return {"error": str(e)}

@app.get("/market/exchange-info")
async def get_exchange_info(symbol: str = None):
    url = "https://api.binance.com/api/v3/exchangeInfo"
    if symbol:
        url += f"?symbol={symbol.upper()}"
    try:
        resp = requests.get(url, timeout=5)
        return resp.json()
    except Exception as e:
        return {"error": str(e)}

# =========================================
# ACCOUNT & USER DATA (MOCKED FOR DASHBOARD)
# =========================================

@app.get("/account/balance")
async def get_account_balance():
    # In a real app, you would require API Key & Secret and make a signed request to Binance API
    # return fetch_signed_binance_data("/api/v3/account")
    return {
        "balances": [
            {"asset": "USDT", "free": "12500.50", "locked": "0.00"},
            {"asset": "BTC", "free": "0.45", "locked": "0.10"},
            {"asset": "ETH", "free": "2.3", "locked": "0.00"}
        ]
    }

@app.get("/account/open-orders")
async def get_open_orders(symbol: str = None):
    # Mock data for active pending trades
    return [
        {"symbol": symbol or "BTCUSDT", "orderId": 123456, "price": "60000.00", "origQty": "0.1", "side": "BUY", "type": "LIMIT", "status": "NEW"},
        {"symbol": symbol or "ETHUSDT", "orderId": 123457, "price": "3000.00", "origQty": "1.5", "side": "SELL", "type": "LIMIT", "status": "NEW"}
    ]

@app.get("/account/trades")
async def get_personal_trades(symbol: str = None):
    # Mock data for personal trade history (profit/loss)
    return [
        {"symbol": symbol or "BTCUSDT", "id": 98765, "price": "61000.00", "qty": "0.1", "realizedPnl": "100.00", "side": "SELL", "time": int(time.time() * 1000) - 86400000},
        {"symbol": symbol or "BTCUSDT", "id": 98764, "price": "62000.00", "qty": "0.05", "realizedPnl": "-50.00", "side": "SELL", "time": int(time.time() * 1000) - 172800000}
    ]

# =========================================
# WEBSOCKET HELPER
# =========================================

@app.get("/ws-info")
async def get_websocket_urls(symbol: str):
    """
    Frontend should connect to these WebSocket URLs directly for ultra-fast updates.
    """
    sym = symbol.lower()
    return {
        "trade": f"wss://stream.binance.com:9443/ws/{sym}@trade",
        "ticker": f"wss://stream.binance.com:9443/ws/{sym}@ticker",
        "depth": f"wss://stream.binance.com:9443/ws/{sym}@depth",
        "kline_1m": f"wss://stream.binance.com:9443/ws/{sym}@kline_1m",
        "kline_5m": f"wss://stream.binance.com:9443/ws/{sym}@kline_5m",
        "kline_1h": f"wss://stream.binance.com:9443/ws/{sym}@kline_1h",
        "kline_1d": f"wss://stream.binance.com:9443/ws/{sym}@kline_1d",
        "kline_1w": f"wss://stream.binance.com:9443/ws/{sym}@kline_1w"
    }

@app.get("/candles/{symbol}/{interval}")
async def get_candles(symbol: str, interval: str, limit: int = 1000, before: int = None):
    # Try local data first
    local_df = load_local_candles(symbol, interval)
    if local_df is not None:
        if before:
            before_dt = pd.to_datetime(before, unit='s')
            local_df = local_df[local_df['open_time'] < before_dt]
        result = local_df.tail(limit)
        candles = []
        for _, row in result.iterrows():
            candles.append({
                "time": int(row['open_time'].timestamp()),
                "open": float(row['open']),
                "high": float(row['high']),
                "low": float(row['low']),
                "close": float(row['close']),
                "volume": float(row['volume'])
            })
        return {"candles": candles, "source": "local"}

    # Fallback to Binance
    candles = fetch_binance_candles(symbol, interval, limit=limit, before=before)
    if candles:
        return {"candles": candles, "source": "binance"}
    return {"error": "No data found"}

QUOTE_ASSETS_LIST = [
    'USDT', 'USDC', 'BUSD', 'FDUSD', 'TUSD', 'DAI', 'BTC', 'ETH', 'BNB', 'EUR', 'TRY',
    'BRL', 'AUD', 'GBP', 'RUB', 'UAH', 'IDR', 'ZAR', 'NGN', 'PLN', 'RON', 'ARS', 'JPY',
    'MXN', 'CZK', 'CAD', 'VAI', 'USDP', 'UST', 'BKRW', 'BVND', 'TRX', 'XRP', 'DOGE',
]

def parse_unified_symbol(symbol: str) -> str:
    upper = symbol.upper().replace('_', '').replace('-', '')
    for quote in QUOTE_ASSETS_LIST:
        if upper.endswith(quote) and len(upper) > len(quote):
            base = upper[:-len(quote)]
            return f"{base}/{quote}"
    return f"{upper}/USDT"

INTERVAL_SECONDS_MAP = {
    '1m': 60, '3m': 180, '5m': 300, '15m': 900, '30m': 1800,
    '1h': 3600, '2h': 7200, '4h': 14400, '6h': 21600, '8h': 28800, '12h': 43200,
    '1d': 86400, '3d': 259200, '1w': 604800, '1M': 2592000,
}

def interval_to_seconds(interval: str) -> int:
    if interval in INTERVAL_SECONDS_MAP:
        return INTERVAL_SECONDS_MAP[interval]
    match = re.match(r'^(\d+)([mhdWM])$', interval)
    if not match:
        return 60
    amount = int(match.group(1))
    unit = match.group(2)
    unit_seconds = 60 if unit == 'm' else 3600 if unit == 'h' else 86400 if unit == 'd' else 604800 if unit == 'w' or unit == 'W' else 2592000
    return amount * unit_seconds

@app.get("/symbols/{exchange}")
def get_exchange_symbols_route(exchange: str):
    try:
        ex_id = exchange.lower()
        exchange_name = 'gateio' if ex_id == 'gate' else ex_id
        exchange_class = getattr(ccxt, exchange_name)
        exchange_instance = exchange_class({
            'timeout': 2000,
            'enableRateLimit': False
        })
        markets = exchange_instance.load_markets()
        symbols = []
        for symbol, m in markets.items():
            if m.get('active') and m.get('spot', True):
                clean_sym = symbol.replace('/', '').replace(':', '').upper()
                symbols.append(clean_sym)
        return sorted(list(set(symbols)))
    except Exception as e:
        # Fallback to Binance symbols if specific exchange fetch fails
        try:
            exchange_class = getattr(ccxt, 'binance')
            exchange_instance = exchange_class({
                'timeout': 2000,
                'enableRateLimit': False
            })
            markets = exchange_instance.load_markets()
            symbols = []
            for symbol, m in markets.items():
                if m.get('active') and m.get('spot', True):
                    clean_sym = symbol.replace('/', '').replace(':', '').upper()
                    symbols.append(clean_sym)
            return sorted(list(set(symbols)))
        except Exception as inner_e:
            raise HTTPException(status_code=400, detail=str(e))

@app.get("/candles/{exchange}/{symbol}/{interval}")
def get_exchange_candles_route(exchange: str, symbol: str, interval: str, limit: int = 1000, before: int = None):
    try:
        ex_id = exchange.lower()
        exchange_name = 'gateio' if ex_id == 'gate' else ex_id
        exchange_class = getattr(ccxt, exchange_name)
        exchange_instance = exchange_class({
            'timeout': 2000,
            'enableRateLimit': False
        })
        
        ccxt_symbol = parse_unified_symbol(symbol)
        since = None
        if before:
            secs = interval_to_seconds(interval)
            since = int((before - (limit * secs)) * 1000)
            
        ohlcv = exchange_instance.fetch_ohlcv(ccxt_symbol, timeframe=interval, since=since, limit=limit)
        
        candles = []
        for row in ohlcv:
            candles.append({
                "time": int(row[0] / 1000),
                "open": float(row[1]),
                "high": float(row[2]),
                "low": float(row[3]),
                "close": float(row[4]),
                "volume": float(row[5])
            })
        return {"candles": candles, "source": exchange}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/backtest-pine")
async def backtest_pine(request: PineRequest):
    code_content = request.code
    detected_ticker = request.ticker.upper()
    match = re.search(r'(?:ticker\s*=\s*["\']|@ticker\s*=\s*["\'])([A-Za-z0-9]+)["\']', code_content)
    if match:
        detected_ticker = match.group(1).upper()

    interval_map = {'1m':'1m', '5m':'5m', '15m':'15m', '1h':'1h', '4h':'4h',
                    '1D':'1d', '1W':'1w'}
    interval = interval_map.get(request.timeframe, '1d')

    # Try local data first
    df = load_local_candles(detected_ticker, interval)
    source = "local"
    if df is None or df.empty:
        # Fallback to Binance pagination
        candles = fetch_binance_candles(detected_ticker, interval, limit=10000)
        if not candles:
            return {"error": f"No data found for {detected_ticker} {interval}"}
        # Build DataFrame from fetched candles
        rows = []
        for c in candles:
            rows.append([datetime.utcfromtimestamp(c['time']).strftime('%Y-%m-%d %H:%M'),
                         c['open'], c['high'], c['low'], c['close'], c['volume']])
        df = pd.DataFrame(rows, columns=['time', 'open', 'high', 'low', 'close', 'volume'])
        source = "binance"

    trades_list = parse_and_run_backtest(df, code_content)

    for i, trade in enumerate(trades_list):
        trade['id'] = trade.get('id', i + 1)
        trade['type'] = str(trade.get('type', 'Long'))
        trade['profit'] = round(float(trade.get('profit', 0)), 4)
        trade['price'] = float(trade.get('price', 0) or 0)
        trade['date'] = str(trade.get('date', 'N/A'))

    total_trades = len(trades_list)
    wins = [t for t in trades_list if t['profit'] > 0]
    losses = [t for t in trades_list if t['profit'] <= 0]
    gross_profit = sum(t['profit'] for t in wins)
    gross_loss = sum(t['profit'] for t in losses)
    net_pnl = round(gross_profit + gross_loss, 2)
    long_trades = [t for t in trades_list if 'short' not in str(t.get('type', '')).lower()]
    short_trades = [t for t in trades_list if 'short' in str(t.get('type', '')).lower()]
    long_wins = [t for t in long_trades if t['profit'] > 0]
    short_wins = [t for t in short_trades if t['profit'] > 0]

    if total_trades > 0:
        accuracy = round((len(wins) / total_trades) * 100, 2)
        total_loss = abs(gross_loss)
        profit_factor = round(gross_profit / total_loss, 2) if total_loss else 0
        avg_win = round(gross_profit / len(wins), 2) if wins else 0
        avg_loss = round(gross_loss / len(losses), 2) if losses else 0
        avg_trade = round(net_pnl / total_trades, 4)
        best_trade = max(t['profit'] for t in trades_list)
        worst_trade = min(t['profit'] for t in trades_list)
        payoff_ratio = round(avg_win / abs(avg_loss), 2) if avg_loss else 0
        cur_w = max_w = cur_l = max_l = 0
        for t in trades_list:
            if t['profit'] > 0:
                cur_w += 1; max_l = max(max_l, cur_l); cur_l = 0
            else:
                cur_l += 1; max_w = max(max_w, cur_w); cur_w = 0
        max_w = max(max_w, cur_w); max_l = max(max_l, cur_l)
    else:
        accuracy = profit_factor = avg_win = avg_loss = avg_trade = 0
        best_trade = worst_trade = payoff_ratio = max_w = max_l = 0

    equity_curve = []
    capital = 10000.0
    peak_equity = capital
    max_drawdown_pct = 0.0
    max_drawdown_val = 0.0
    for i, trade in enumerate(trades_list):
        capital += trade['profit']
        peak_equity = max(peak_equity, capital)
        drawdown_val = max(0.0, peak_equity - capital)
        drawdown_pct = (drawdown_val / peak_equity) * 100 if peak_equity else 0.0
        max_drawdown_val = max(max_drawdown_val, drawdown_val)
        max_drawdown_pct = max(max_drawdown_pct, drawdown_pct)
        trade['equity'] = round(capital, 2)
        trade['drawdown'] = round(drawdown_pct, 2)
        equity_curve.append({
            "trade": f"T{i+1}",
            "date": trade['date'][:10],
            "equity": round(capital, 2),
            "pnl": round(trade['profit'], 4),
            "drawdown": round(drawdown_pct, 2),
        })

    expectancy = round(((accuracy / 100) * avg_win) + (((100 - accuracy) / 100) * avg_loss), 4) if total_trades else 0
    recovery_factor = round(net_pnl / max_drawdown_val, 2) if max_drawdown_val else 0

    return {
        "detected_ticker": detected_ticker,
        "source": source,
        "summary": {
            "totalPnL": f"{'+' if net_pnl>=0 else ''}{net_pnl} USDT",
            "pct": f"{round(net_pnl/10000*100, 2)}%",
            "maxDrawdown": f"{max_drawdown_pct:.2f}%",
            "maxDrawdownValue": round(max_drawdown_val, 2),
            "totalTrades": total_trades,
            "profitableTrades": f"{accuracy}%",
            "profitFactor": profit_factor
        },
        "advanced_stats": {
            "accuracy": accuracy,
            "grossProfit": round(gross_profit, 2),
            "grossLoss": round(gross_loss, 2),
            "wins": len(wins),
            "losses": len(losses),
            "longTotal": len(long_trades),
            "longWins": len(long_wins),
            "shortTotal": len(short_trades),
            "shortWins": len(short_wins),
            "maxWinStreak": max_w,
            "maxLossStreak": max_l,
            "avgWin": avg_win,
            "avgLoss": avg_loss,
            "avgTrade": avg_trade,
            "bestTrade": round(best_trade, 4),
            "worstTrade": round(worst_trade, 4),
            "expectancy": expectancy,
            "payoffRatio": payoff_ratio,
            "recoveryFactor": recovery_factor,
            "maxDrawdownPct": round(max_drawdown_pct, 2),
            "maxDrawdownVal": round(max_drawdown_val, 2)
        },
        "trades": trades_list[::-1],
        "equity_curve": equity_curve
    }

INTERVAL_MAP = {
    '1m': '1m', '5m': '5m', '15m': '15m', '1h': '1h', '4h': '4h',
    '1d': '1d', '1D': '1d', '1w': '1w', '1W': '1w',
}


def normalize_interval(tf: str) -> str:
    return INTERVAL_MAP.get(tf, '1d')


def prepare_backtest_df(ticker: str, interval: str, limit: int = 10000):
    """Load OHLCV for backtests; coerce numeric columns."""
    symbol = ticker.upper()
    df = load_local_candles(symbol, interval)
    if df is not None and not df.empty:
        df = df[['open', 'high', 'low', 'close', 'volume', 'time']].copy()
        if 'time' not in df.columns or df['time'].isna().all():
            df['time'] = df.index.astype(str)
    else:
        candles = fetch_binance_candles(symbol, interval, limit=limit)
        if not candles:
            return None
        df = pd.DataFrame(candles)
        df['time'] = pd.to_datetime(df['time'], unit='s').dt.strftime('%Y-%m-%d %H:%M')

    for col in ('open', 'high', 'low', 'close', 'volume'):
        df[col] = pd.to_numeric(df[col], errors='coerce')
    df = df.dropna(subset=['close']).reset_index(drop=True)
    return df


PYTHON_EXEC_GLOBALS = {
    "pd": pd,
    "np": np,
    "__builtins__": {
        "range": range,
        "len": len,
        "min": min,
        "max": max,
        "abs": abs,
        "float": float,
        "int": int,
        "str": str,
        "bool": bool,
        "enumerate": enumerate,
        "zip": zip,
        "list": list,
        "dict": dict,
        "tuple": tuple,
        "set": set,
        "sum": sum,
        "round": round,
        "sorted": sorted,
        "reversed": reversed,
        "map": map,
        "filter": filter,
        "any": any,
        "all": all,
        "isinstance": isinstance,
        "ValueError": ValueError,
        "TypeError": TypeError,
        "Exception": Exception,
        "print": print,
    },
}


# Python backtest endpoint
@app.post("/backtest-python")
async def backtest_python(request: PythonRequest):
    interval = normalize_interval(request.timeframe)
    df = prepare_backtest_df(request.ticker, interval)
    if df is None or df.empty:
        return {"error": f"No data found for {request.ticker.upper()} ({interval})"}

    # Execute user's strategy. Use one namespace so helper functions and constants
    # defined above strategy(df) are visible inside the strategy body.
    try:
        exec_env = dict(PYTHON_EXEC_GLOBALS)
        exec(request.code, exec_env, exec_env)
        if 'strategy' not in exec_env:
            return {"error": "Function 'strategy' not defined"}
        raw_trades = exec_env['strategy'](df)
        if not isinstance(raw_trades, list):
            return {"error": "strategy must return a list of dicts with 'profit' key"}
        for t in raw_trades:
            if not isinstance(t, dict):
                return {"error": "Each trade must be a dict"}
            if 'profit' not in t:
                return {"error": "Each trade must have 'profit' key"}
    except Exception as e:
        return {"error": f"Python error: {str(e)}"}

    # Format trades and preserve timestamp/price details returned by the strategy.
    trades = []
    trade_id = 1
    for t in raw_trades:
        trade_date = t.get('date') or t.get('time') or t.get('timestamp')
        trade_price = t.get('price')
        exit_index = t.get('exit_index', t.get('index', t.get('bar_index')))
        if exit_index is not None:
            try:
                idx = int(exit_index)
                if 0 <= idx < len(df):
                    if trade_date is None:
                        trade_date = str(df['time'].iloc[idx])
                    if trade_price is None:
                        trade_price = float(df['close'].iloc[idx])
            except (TypeError, ValueError):
                pass

        try:
            profit = float(t.get('profit', 0))
        except (TypeError, ValueError):
            return {"error": "Trade profit must be numeric"}

        trades.append({
            "id": trade_id,
            "type": str(t.get('type', "Long")),
            "date": str(trade_date) if trade_date is not None else "N/A",
            "price": float(trade_price) if trade_price is not None else 0.0,
            "profit": round(profit, 4)
        })
        trade_id += 1

    total = len(trades)
    wins = [t for t in trades if t['profit'] > 0]
    losses = [t for t in trades if t['profit'] <= 0]
    gross_profit = sum(t['profit'] for t in wins)
    gross_loss = sum(t['profit'] for t in losses)
    net_pnl = gross_profit + gross_loss
    long_trades = [t for t in trades if 'short' not in str(t.get('type', '')).lower()]
    short_trades = [t for t in trades if 'short' in str(t.get('type', '')).lower()]
    long_wins = [t for t in long_trades if t['profit'] > 0]
    short_wins = [t for t in short_trades if t['profit'] > 0]
    avg_trade = round(net_pnl / total, 4) if total else 0
    best_trade = max((t['profit'] for t in trades), default=0)
    worst_trade = min((t['profit'] for t in trades), default=0)

    if total > 0:
        win_rate = round((len(wins) / total) * 100, 2)
        pct = round((net_pnl / 10000) * 100, 2)
        profit_factor = round(gross_profit / abs(gross_loss), 2) if gross_loss != 0 else 0
        avg_win = round(gross_profit / len(wins), 2) if wins else 0
        avg_loss = round(gross_loss / len(losses), 2) if losses else 0
        payoff_ratio = round(avg_win / abs(avg_loss), 2) if avg_loss else 0

        cur_w = max_w = cur_l = max_l = 0
        for t in trades:
            if t['profit'] > 0:
                cur_w += 1
                max_l = max(max_l, cur_l)
                cur_l = 0
            else:
                cur_l += 1
                max_w = max(max_w, cur_w)
                cur_w = 0
        max_w = max(max_w, cur_w)
        max_l = max(max_l, cur_l)

        equity_curve = []
        capital = 10000.0
        peak_equity = capital
        max_drawdown_pct = 0.0
        max_drawdown_val = 0.0
        for i, t in enumerate(trades):
            capital += t['profit']
            peak_equity = max(peak_equity, capital)
            drawdown_val = max(0.0, peak_equity - capital)
            drawdown_pct = (drawdown_val / peak_equity) * 100 if peak_equity else 0.0
            max_drawdown_val = max(max_drawdown_val, drawdown_val)
            max_drawdown_pct = max(max_drawdown_pct, drawdown_pct)
            t['equity'] = round(capital, 2)
            t['drawdown'] = round(drawdown_pct, 2)
            label = (t.get('date') or '')[:10] or f"T{i+1}"
            equity_curve.append({
                "trade": f"T{i+1}",
                "date": label,
                "equity": round(capital, 2),
                "pnl": round(t['profit'], 4),
                "drawdown": round(drawdown_pct, 2),
            })
    else:
        win_rate = profit_factor = avg_win = avg_loss = max_w = max_l = pct = max_drawdown_pct = 0
        payoff_ratio = max_drawdown_val = 0
        equity_curve = []

    expectancy = round(((win_rate / 100) * avg_win) + (((100 - win_rate) / 100) * avg_loss), 4) if total else 0
    recovery_factor = round(net_pnl / max_drawdown_val, 2) if max_drawdown_val else 0

    return {
        "summary": {
            "totalPnL": f"{'+' if net_pnl>=0 else ''}{round(net_pnl, 2)} USDT",
            "pct": pct,
            "maxDrawdown": f"{max_drawdown_pct:.2f}%",
            "maxDrawdownValue": round(max_drawdown_val, 2),
            "totalTrades": total,
            "profitableTrades": f"{win_rate}%",
            "profitFactor": profit_factor
        },
        "advanced_stats": {
            "accuracy": win_rate,
            "grossProfit": round(gross_profit, 2),
            "grossLoss": round(gross_loss, 2),
            "wins": len(wins) if total > 0 else 0,
            "losses": len(losses) if total > 0 else 0,
            "longTotal": len(long_trades),
            "longWins": len(long_wins),
            "shortTotal": len(short_trades),
            "shortWins": len(short_wins),
            "maxWinStreak": max_w,
            "maxLossStreak": max_l,
            "avgWin": avg_win,
            "avgLoss": avg_loss,
            "avgTrade": avg_trade,
            "bestTrade": round(best_trade, 4),
            "worstTrade": round(worst_trade, 4),
            "expectancy": expectancy,
            "payoffRatio": payoff_ratio,
            "recoveryFactor": recovery_factor,
            "maxDrawdownPct": round(max_drawdown_pct, 2),
            "maxDrawdownVal": round(max_drawdown_val, 2)
        },
        "trades": trades,
        "equity_curve": equity_curve
    }

# =========================================
# LOCAL DATABASE CANDLES ENDPOINT
# =========================================

@app.get("/candles/{exchange}/{symbol}/{interval}")
async def get_local_candles(exchange: str, symbol: str, interval: str, limit: int = 1000, before: int = None):
    """
    Fetches candles from our Permanent SQLite Database.
    If data is missing or we need to backfill, it fetches from CCXT, saves to DB, then returns.
    """
    try:
        ex_id = exchange.lower()
        sym = symbol.upper()
        
        # 1. Try to get from SQLite
        db_candles = get_candles(ex_id, sym, interval, end_time=before)
        
        # 2. Check if we have enough data or if it's completely missing
        if len(db_candles) < min(limit, 100):
            print(f"Backfilling {ex_id} {sym} {interval} because DB has only {len(db_candles)} rows")
            
            # Use CCXT to fetch massive historical data
            try:
                ex_class = getattr(ccxt, ex_id)
                ex_instance = ex_class({'enableRateLimit': True})
                
                # Fetch
                since = None # We just want the most recent 'limit' if before is None
                raw_candles = ex_instance.fetch_ohlcv(sym.replace('USDT', '/USDT'), timeframe=interval, limit=limit)
                
                # Format
                formatted = []
                for k in raw_candles:
                    formatted.append({
                        'time': int(k[0]),
                        'open': float(k[1]),
                        'high': float(k[2]),
                        'low': float(k[3]),
                        'close': float(k[4]),
                        'volume': float(k[5])
                    })
                
                # 3. Save permanently to SQLite
                save_candles(ex_id, sym, interval, formatted)
                
                # Return the newly fetched data
                db_candles = formatted
                
            except Exception as e:
                print(f"CCXT Backfill failed: {e}")
                # Fallback to whatever we have in DB
        
        # Return exactly 'limit' amount
        return {"candles": db_candles[-limit:]}

    except Exception as e:
        return {"error": str(e)}

# =========================================
# LOCAL NEWS & SENTIMENT ENDPOINTS
# =========================================

@app.get("/api/news")
async def get_local_news(symbol: str, limit: int = 100):
    try:
        clean_symbol = symbol.upper().replace('USDT', '').replace('USD', '')
        news = get_news_by_symbol(clean_symbol, limit=limit)
        return {"news": news}
    except Exception as e:
        return {"error": str(e)}

@app.get("/api/sentiment")
async def get_local_sentiment(symbol: str):
    try:
        clean_symbol = symbol.upper().replace('USDT', '').replace('USD', '')
        sentiment = get_sentiment_by_symbol(clean_symbol)
        if sentiment:
            return {"sentiment": sentiment}
        return {"error": "No sentiment found"}
    except Exception as e:
        return {"error": str(e)}
