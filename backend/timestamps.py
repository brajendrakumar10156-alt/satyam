
import datetime
from typing import Union

def normalize_timestamp(raw: Union[str, int, float], source: str = "") -> int:
    """
    Converts various timestamp formats into a strict Unix timestamp in seconds.
    """
    if not raw:
        return int(datetime.datetime.now(datetime.timezone.utc).timestamp())
    
    if isinstance(raw, (int, float)):
        # If it's a huge number, it's likely milliseconds or microseconds
        if raw > 1e11:
            raw = raw / 1000.0
        return int(raw)
        
    if isinstance(raw, str):
        raw = raw.strip()
        # Handle stringified integers
        if raw.isdigit():
            val = int(raw)
            if val > 1e11:
                val = val / 1000.0
            return int(val)
            
        # Handle ISO 8601 strings
        try:
            # Handle 'Z' suffix for UTC
            if raw.endswith('Z'):
                raw = raw[:-1] + '+00:00'
            dt = datetime.datetime.fromisoformat(raw)
            return int(dt.timestamp())
        except ValueError:
            pass
            
        # Fallback to current time if unparseable
        return int(datetime.datetime.now(datetime.timezone.utc).timestamp())
        
    return int(datetime.datetime.now(datetime.timezone.utc).timestamp())
