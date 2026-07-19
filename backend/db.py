import sqlite3
import os
from typing import List, Dict, Any

DB_PATH = os.path.join(os.path.dirname(__file__), "news.db")

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # News Events Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS news_events (
            id TEXT PRIMARY KEY,
            symbol TEXT,
            title TEXT,
            source TEXT,
            url TEXT,
            timestamp INTEGER,
            sentiment TEXT
        )
    """)
    
    # Sentiment Snapshots Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS sentiment_snapshots (
            symbol TEXT PRIMARY KEY,
            sentiment_score REAL,
            timestamp INTEGER
        )
    """)
    
    # Bounties Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS bounties (
            id TEXT PRIMARY KEY,
            title TEXT,
            description TEXT,
            reward TEXT,
            status TEXT,
            poster_id TEXT,
            solver_id TEXT,
            solution_text TEXT,
            created_at INTEGER
        )
    """)
    
    # Bounty Solutions Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS bounty_solutions (
            id TEXT PRIMARY KEY,
            bounty_id TEXT,
            solver_id TEXT,
            solution_text TEXT,
            submitted_at INTEGER
        )
    """)

    # Index for fast querying by symbol and time
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_news_symbol_time ON news_events (symbol, timestamp)")
    
    conn.commit()
    conn.close()

def upsert_news_event(event_id: str, symbol: str, title: str, source: str, url: str, timestamp: int, sentiment: str = "neutral"):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO news_events (id, symbol, title, source, url, timestamp, sentiment)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            title=excluded.title,
            sentiment=excluded.sentiment,
            timestamp=excluded.timestamp
    """, (event_id, symbol, title, source, url, timestamp, sentiment))
    conn.commit()
    conn.close()

def upsert_sentiment_snapshot(symbol: str, sentiment_score: float, timestamp: int):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO sentiment_snapshots (symbol, sentiment_score, timestamp)
        VALUES (?, ?, ?)
        ON CONFLICT(symbol) DO UPDATE SET
            sentiment_score=excluded.sentiment_score,
            timestamp=excluded.timestamp
    """, (symbol, sentiment_score, timestamp))
    conn.commit()
    conn.close()

def get_news_by_symbol(symbol: str, limit: int = 100) -> List[Dict[str, Any]]:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT id, symbol, title, source, url, timestamp, sentiment
        FROM news_events
        ORDER BY timestamp DESC
        LIMIT ?
    """, (limit,))
    
    rows = cursor.fetchall()
    conn.close()
    
    return [dict(row) for row in rows]

def get_sentiment_by_symbol(symbol: str) -> Dict[str, Any]:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT symbol, sentiment_score, timestamp
        FROM sentiment_snapshots
        WHERE symbol = ?
    """, (symbol,))
    
    row = cursor.fetchone()
    conn.close()
    
    if row:
        return dict(row)
    return None

# Initialize DB on import
init_db()

def create_bounty(bounty_id: str, title: str, description: str, reward: str, poster_id: str, created_at: int):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO bounties (id, title, description, reward, status, poster_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (bounty_id, title, description, reward, 'OPEN', poster_id, created_at))
    conn.commit()
    conn.close()

def get_all_bounties() -> List[Dict[str, Any]]:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("""
        SELECT * FROM bounties ORDER BY created_at DESC
    """)
    rows = cursor.fetchall()
    
    bounties = []
    for r in rows:
        b = dict(r)
        # Fetch solutions for this bounty
        cursor.execute("SELECT * FROM bounty_solutions WHERE bounty_id = ? ORDER BY submitted_at DESC", (b['id'],))
        sol_rows = cursor.fetchall()
        b['solutions'] = [dict(sr) for sr in sol_rows]
        bounties.append(b)
        
    conn.close()
    return bounties

def submit_solution(solution_id: str, bounty_id: str, solver_id: str, solution_text: str, submitted_at: int):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO bounty_solutions (id, bounty_id, solver_id, solution_text, submitted_at)
        VALUES (?, ?, ?, ?, ?)
    """, (solution_id, bounty_id, solver_id, solution_text, submitted_at))
    conn.commit()
    conn.close()

def approve_solution(bounty_id: str, solver_id: str, solution_text: str):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE bounties
        SET status = 'COMPLETED', solver_id = ?, solution_text = ?
        WHERE id = ?
    """, (solver_id, solution_text, bounty_id))
    conn.commit()
    conn.close()
