import sqlite3
import pandas as pd
import os
import datetime
from pathlib import Path

DB_PATH = "historical_data.db"
ARCHIVE_DIR = "data_archives"

def init_db():
    """Initialize the SQLite database and create tables if they don't exist."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    # Create the massive unified candles table
    # We use (exchange, symbol, timeframe, timestamp) as the Primary Key to avoid duplicates
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS candles (
            exchange TEXT,
            symbol TEXT,
            timeframe TEXT,
            timestamp INTEGER,
            open REAL,
            high REAL,
            low REAL,
            close REAL,
            volume REAL,
            PRIMARY KEY (exchange, symbol, timeframe, timestamp)
        )
    """)
    # Index for faster querying
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_query 
        ON candles(exchange, symbol, timeframe, timestamp)
    """)
    conn.commit()
    conn.close()

    # Ensure archive directory exists
    Path(ARCHIVE_DIR).mkdir(parents=True, exist_ok=True)

def save_candles(exchange: str, symbol: str, timeframe: str, candles: list):
    """
    Save or update candles in the database.
    candles should be a list of dicts: [{'time': ms, 'open': 0, 'high': 0, 'low': 0, 'close': 0, 'volume': 0}, ...]
    """
    if not candles:
        return 0

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # We use INSERT OR IGNORE to automatically discard duplicates seamlessly
    query = """
        INSERT OR IGNORE INTO candles (exchange, symbol, timeframe, timestamp, open, high, low, close, volume)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """
    
    data_tuples = [
        (exchange.lower(), symbol.upper(), timeframe, c['time'], c['open'], c['high'], c['low'], c['close'], c['volume'])
        for c in candles
    ]
    
    cursor.executemany(query, data_tuples)
    inserted = cursor.rowcount
    conn.commit()
    conn.close()
    return inserted

def get_candles(exchange: str, symbol: str, timeframe: str, start_time: int = None, end_time: int = None):
    """
    Retrieve candles from the local database.
    """
    conn = sqlite3.connect(DB_PATH)
    
    query = "SELECT timestamp as time, open, high, low, close, volume FROM candles WHERE exchange=? AND symbol=? AND timeframe=?"
    params = [exchange.lower(), symbol.upper(), timeframe]
    
    if start_time:
        query += " AND timestamp >= ?"
        params.append(start_time)
    if end_time:
        query += " AND timestamp <= ?"
        params.append(end_time)
        
    query += " ORDER BY timestamp ASC"
    
    df = pd.read_sql_query(query, conn, params=params)
    conn.close()
    
    # Convert DataFrame back to list of dicts
    return df.to_dict('records')

def get_latest_timestamp(exchange: str, symbol: str, timeframe: str):
    """Get the most recent candle timestamp for self-healing backfills."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        SELECT MAX(timestamp) FROM candles 
        WHERE exchange=? AND symbol=? AND timeframe=?
    """, (exchange.lower(), symbol.upper(), timeframe))
    row = cursor.fetchone()
    conn.close()
    return row[0] if row[0] else None

def export_to_parquet():
    """
    Auto-Archiver: Dumps the SQLite DB into a highly compressed Apache Parquet file.
    """
    conn = sqlite3.connect(DB_PATH)
    df = pd.read_sql_query("SELECT * FROM candles", conn)
    conn.close()
    
    if df.empty:
        return None
        
    date_str = datetime.datetime.now().strftime("%Y%m%d")
    filename = os.path.join(ARCHIVE_DIR, f"market_data_backup_{date_str}.parquet")
    
    # Write to Parquet (requires pyarrow or fastparquet)
    df.to_parquet(filename, index=False)
    return filename

# Initialize on import
init_db()
