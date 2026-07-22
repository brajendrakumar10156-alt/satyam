import numpy as np
from numba import njit
import time

@njit(fastmath=True, cache=True)
def _calculate_arbitrage_matrix(exchange_a_prices, exchange_b_prices, min_spread_pct):
    """
    JIT-Compiled Arbitrage Calculator.
    Compares two price streams instantly using CPU vectorization (Machine Code).
    
    :param exchange_a_prices: Array of prices from Exchange A (e.g. Local)
    :param exchange_b_prices: Array of prices from Exchange B (e.g. Binance)
    :param min_spread_pct: Minimum profit spread required (e.g. 0.01 for 1%)
    
    Returns:
    (buy_a_sell_b_spreads, buy_b_sell_a_spreads) Arrays of profitable spreads
    """
    n = len(exchange_a_prices)
    
    # Pre-allocate output arrays (we don't know the exact size yet, so we use max possible)
    # We'll just return the spread percentages for matching indices
    buy_a_spreads = np.zeros(n, dtype=np.float64)
    buy_b_spreads = np.zeros(n, dtype=np.float64)
    
    count_a = 0
    count_b = 0
    
    for i in range(n):
        price_a = exchange_a_prices[i]
        price_b = exchange_b_prices[i]
        
        if price_a > 0 and price_b > 0:
            # Check Buy Exchange A, Sell Exchange B
            spread_a = (price_b - price_a) / price_a
            if spread_a >= min_spread_pct:
                buy_a_spreads[count_a] = spread_a
                count_a += 1
                
            # Check Buy Exchange B, Sell Exchange A
            spread_b = (price_a - price_b) / price_b
            if spread_b >= min_spread_pct:
                buy_b_spreads[count_b] = spread_b
                count_b += 1
                
    return buy_a_spreads[:count_a], buy_b_spreads[:count_b]


class ArbitrageEngine:
    """
    HFT Arbitrage Engine leveraging Numba (JIT Machine Code)
    for extreme speed spread calculations across exchanges.
    """
    def __init__(self, min_profit_pct=0.005):
        self.min_profit_pct = min_profit_pct
        
    def find_opportunities(self, exchange_a_data: np.ndarray, exchange_b_data: np.ndarray):
        """
        Calculates arbitrage opportunities in nanoseconds.
        Data should be numpy arrays of prices.
        """
        start = time.perf_counter_ns()
        
        # Numba will execute this at C++ speed
        buy_a, buy_b = _calculate_arbitrage_matrix(
            exchange_a_data, 
            exchange_b_data, 
            self.min_profit_pct
        )
        
        end = time.perf_counter_ns()
        latency_ns = end - start
        
        return {
            "buy_local_sell_binance": buy_a.tolist(),
            "buy_binance_sell_local": buy_b.tolist(),
            "computation_time_ns": latency_ns
        }

# Example Usage
if __name__ == "__main__":
    engine = ArbitrageEngine(min_profit_pct=0.01)
    
    # Mock data: 1 million prices from 2 exchanges
    mock_local = np.random.uniform(100, 105, 1000000).astype(np.float64)
    mock_binance = np.random.uniform(100, 105, 1000000).astype(np.float64)
    
    print("Warming up JIT compiler...")
    engine.find_opportunities(mock_local[:10], mock_binance[:10])
    
    print("Testing 1 Million price pairs...")
    result = engine.find_opportunities(mock_local, mock_binance)
    
    print(f"Found {len(result['buy_local_sell_binance'])} Local->Binance ops")
    print(f"Found {len(result['buy_binance_sell_local'])} Binance->Local ops")
    print(f"Calculation Time: {result['computation_time_ns'] / 1_000_000:.3f} ms")
