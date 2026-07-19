import time
import requests
import logging
from apscheduler.schedulers.background import BackgroundScheduler
from database import save_candles, export_to_parquet

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT"]

def fetch_binance_candles(symbol, interval="1m", limit=10):
    url = f"https://api.binance.com/api/v3/klines?symbol={symbol}&interval={interval}&limit={limit}"
    try:
        res = requests.get(url, timeout=10)
        res.raise_for_status()
        data = res.json()
        candles = []
        for k in data:
            candles.append({
                'time': int(k[0]), # Binance returns ms
                'open': float(k[1]),
                'high': float(k[2]),
                'low': float(k[3]),
                'close': float(k[4]),
                'volume': float(k[5])
            })
        return candles
    except Exception as e:
        logger.error(f"Binance fetch error for {symbol}: {e}")
        return []

def fetch_bybit_candles(symbol, interval="1", limit=10):
    url = f"https://api.bybit.com/v5/market/kline?category=spot&symbol={symbol}&interval={interval}&limit={limit}"
    try:
        res = requests.get(url, timeout=10)
        res.raise_for_status()
        data = res.json()
        candles = []
        if data.get('retCode') == 0 and data.get('result') and data['result'].get('list'):
            for k in data['result']['list']:
                candles.append({
                    'time': int(k[0]),
                    'open': float(k[1]),
                    'high': float(k[2]),
                    'low': float(k[3]),
                    'close': float(k[4]),
                    'volume': float(k[5])
                })
        return candles
    except Exception as e:
        logger.error(f"Bybit fetch error for {symbol}: {e}")
        return []

def harvest_job():
    """Fetches the latest candles from multiple exchanges and saves to DB."""
    logger.info("Harvesting new candles...")
    for sym in SYMBOLS:
        # Fetch Binance
        binance_data = fetch_binance_candles(sym, interval="1m", limit=5)
        if binance_data:
            inserted = save_candles("binance", sym, "1m", binance_data)
            if inserted > 0:
                logger.info(f"Saved {inserted} new Binance candles for {sym}")
        
        # Fetch Bybit
        bybit_data = fetch_bybit_candles(sym, interval="1", limit=5)
        if bybit_data:
            inserted = save_candles("bybit", sym, "1m", bybit_data)
            if inserted > 0:
                logger.info(f"Saved {inserted} new Bybit candles for {sym}")
                
        time.sleep(1) # Prevent rapid rate limits

def daily_archive_job():
    """Runs every midnight to export SQLite data to Parquet."""
    logger.info("Running daily Parquet archive...")
    filename = export_to_parquet()
    if filename:
        logger.info(f"Archived successfully to {filename}")
    else:
        logger.info("No data to archive.")

def start_harvester():
    scheduler = BackgroundScheduler()
    # Run harvest every 1 minute
    scheduler.add_job(harvest_job, 'interval', minutes=1)
    # Run archive every day at midnight
    scheduler.add_job(daily_archive_job, 'cron', hour=0, minute=0)
    scheduler.start()
    logger.info("Autonomous Harvester Daemon Started.")
