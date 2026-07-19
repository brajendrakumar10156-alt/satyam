import os
import time
import hashlib
import requests
import xml.etree.ElementTree as ET
from datetime import datetime
from email.utils import parsedate_to_datetime

from timestamps import normalize_timestamp
from db import upsert_news_event

def generate_id(source: str, identifier: str) -> str:
    """Generate a consistent ID based on source and URL/ID"""
    return hashlib.md5(f"{source}_{identifier}".encode('utf-8')).hexdigest()

def fetch_universal_news_instantly():
    print(f"[{datetime.now()}] Running background universal news fetcher (CoinTelegraph RSS)...")
    url = "https://cointelegraph.com/rss"
    
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }
        response = requests.get(url, headers=headers, timeout=15)
        
        if response.status_code == 200:
            root = ET.fromstring(response.content)
            items = root.findall('.//item')
            
            for item in items:
                title = item.find('title').text if item.find('title') is not None else ''
                url_link = item.find('link').text if item.find('link') is not None else ''
                pub_date_str = item.find('pubDate').text if item.find('pubDate') is not None else ''
                
                if not title or not url_link:
                    continue
                    
                # Convert pubDate (RFC 2822) to Unix timestamp
                try:
                    dt = parsedate_to_datetime(pub_date_str)
                    ts = int(dt.timestamp())
                except:
                    ts = int(time.time())
                
                source = 'CoinTelegraph'
                event_id = generate_id('cointelegraph', url_link)
                sentiment = 'neutral' # RSS doesn't give sentiment
                
                # We save it as universal 'BTC' because the new DB query will show it everywhere
                upsert_news_event(event_id, 'BTC', title, source, url_link, ts, sentiment)
                    
            print(f"[{datetime.now()}] Fetch complete. Parsed {len(items)} articles.")
            return items
        else:
            print(f"[{datetime.now()}] Error fetching news: {response.status_code}")
            return None
            
    except Exception as e:
        print(f"[{datetime.now()}] Fetch fail ho gaya: {e}")
        return None

def fetch_all_news():
    fetch_universal_news_instantly()

if __name__ == "__main__":
    fetch_all_news()
