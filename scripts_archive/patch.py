import re

with open('src/CoinSelectPage.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Replace state definition
old_state = r"const \[tickers, setTickers\] = useState\(\{\}\);"
new_state = "const [tickerData, setTickerData] = useState({ buffer: new Float32Array(0), indexMap: new Map() });"
content = re.sub(old_state, new_state, content)

# 2. Replace loadTickers
old_load_tickers = r"""const map = \{\};\s*if \(Array\.isArray\(data\)\) \{\s*for \(const t of data\) \{\s*map\[t\.symbol\] = \{\s*price: parseFloat\(t\.lastPrice\) \|\| 0,\s*change: parseFloat\(t\.priceChangePercent\) \|\| 0,\s*high: parseFloat\(t\.highPrice\) \|\| 0,\s*low: parseFloat\(t\.lowPrice\) \|\| 0,\s*open: parseFloat\(t\.openPrice\) \|\| 0,\s*volume: parseFloat\(t\.volume\) \|\| 0,\s*quoteVolume: parseFloat\(t\.quoteVolume\) \|\| 0\s*\};\s*\}\s*\}\s*setTickers\(map\);"""
new_load_tickers = """if (Array.isArray(data)) {
          const buffer = new Float32Array(data.length * 7);
          const indexMap = new Map();
          for (let i = 0; i < data.length; i++) {
            const t = data[i];
            indexMap.set(t.symbol, i);
            buffer[i * 7 + 0] = parseFloat(t.lastPrice) || 0;
            buffer[i * 7 + 1] = parseFloat(t.priceChangePercent) || 0;
            buffer[i * 7 + 2] = parseFloat(t.highPrice) || 0;
            buffer[i * 7 + 3] = parseFloat(t.lowPrice) || 0;
            buffer[i * 7 + 4] = parseFloat(t.openPrice) || 0;
            buffer[i * 7 + 5] = parseFloat(t.volume) || 0;
            buffer[i * 7 + 6] = parseFloat(t.quoteVolume) || 0;
          }
          setTickerData({ buffer, indexMap });
        }"""
content = re.sub(old_load_tickers, new_load_tickers, content)

# 3. Replace getTickerInfo deps
content = re.sub(r"\}, \[tickers\]\);", "}, [tickerData]);", content)

# 4. Replace getTickerInfo lookup
old_lookup = r"""if \(tickers\[clean\]\) \{\s*return tickers\[clean\];\s*\}"""
new_lookup = """const idx = tickerData.indexMap.get(clean);
      if (idx !== undefined) {
        const base = idx * 7;
        return {
          price: tickerData.buffer[base + 0],
          change: tickerData.buffer[base + 1],
          high: tickerData.buffer[base + 2],
          low: tickerData.buffer[base + 3],
          open: tickerData.buffer[base + 4],
          volume: tickerData.buffer[base + 5],
          quoteVolume: tickerData.buffer[base + 6]
        };
      }"""
content = re.sub(old_lookup, new_lookup, content)

# 5. Replace loadCoins for IndexedDB
old_load_coins = r"""const exchangeIds = exchangeMode === 'all' \? EXCHANGE_LIST\.map\(\(e\) => e\.id\) : \[selectedExchange\];"""
new_load_coins = """const cacheKey = COIN_LIST__;
        
        // 1. Try Virtual RAM (IndexedDB)
        const cachedList = await getLocalCoinList(cacheKey);
        if (cachedList && cachedList.length > 0) {
          if (mounted) {
            setCoins(cachedList);
            if (!activeCoinId) setActiveCoinId(cachedList[0].id);
            setCoinsLoading(false); // Instant render!
          }
        }

        // 2. Background Sync
        const exchangeIds = exchangeMode === 'all' ? EXCHANGE_LIST.map((e) => e.id) : [selectedExchange];"""
content = re.sub(old_load_coins, new_load_coins, content)

# 6. Save back to Virtual RAM
old_sort_coins = r"""combined\.sort\(\(a, b\) => a\.symbol\.localeCompare\(b\.symbol\)\);\s*setCoins\(combined\);\s*if \(combined\.length > 0 && !activeCoinId\) \{\s*setActiveCoinId\(combined\[0\]\.id\);\s*\}"""
new_sort_coins = """combined.sort((a, b) => a.symbol.localeCompare(b.symbol));
        
        // 3. Save updated list back to Virtual RAM
        await saveLocalCoinList(cacheKey, combined);
        
        if (mounted) {
          setCoins(combined);
          if (combined.length > 0 && !activeCoinId) {
            setActiveCoinId(combined[0].id);
          }
        }"""
content = re.sub(old_sort_coins, new_sort_coins, content)

with open('src/CoinSelectPage.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('Patched successfully!')
