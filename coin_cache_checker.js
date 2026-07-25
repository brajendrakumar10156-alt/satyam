// Paste this in Chrome/Edge DevTools Console to see all downloaded coins
(function() {
  const PREFIX = 'satyam_ai_terminal_candle_cache:';
  const entries = [];
  let totalCandles = 0;
  let totalBytes = 0;

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(PREFIX)) {
      try {
        const raw = localStorage.getItem(key);
        const parsed = JSON.parse(raw);
        const candles = parsed?.candles || [];
        const bytes = raw.length;
        const parts = key.replace(PREFIX, '').split(':');
        entries.push({
          exchange: parts[0],
          symbol: parts[1],
          interval: parts[2],
          candles: candles.length,
          kb: (bytes / 1024).toFixed(1),
          savedAt: parsed?.savedAt ? new Date(parsed.savedAt).toLocaleString() : 'unknown'
        });
        totalCandles += candles.length;
        totalBytes += bytes;
      } catch(e) {}
    }
  }

  console.log('%c=== COIN CACHE REPORT ===', 'color:#00ff88;font-size:16px;font-weight:bold');
  console.log('%cTotal Symbols: ' + entries.length, 'color:#7C5CFF;font-weight:bold');
  console.log('%cTotal Candles: ' + totalCandles.toLocaleString(), 'color:#7C5CFF;font-weight:bold');
  console.log('%cTotal Size: ' + (totalBytes / 1024).toFixed(1) + ' KB (' + (totalBytes / 1024 / 1024).toFixed(2) + ' MB)', 'color:#7C5CFF;font-weight:bold');
  console.log('%c--- Symbol Breakdown ---', 'color:#888');
  entries.sort((a,b) => b.candles - a.candles)
         .forEach(e => console.log(`  ${e.exchange} | ${e.symbol} | ${e.interval} | ${e.candles} candles | ${e.kb} KB | saved: ${e.savedAt}`));
  return entries;
})();
