import { useCallback } from 'react';

export const useWebContainerBacktest = ({
  editorMode, pineCode, pythonCode, setLastBacktestCode, setLastBacktestMode,
  setBackendOfflineNotice, selectedCoin, chartInterval, backendOnline, checkBackend,
  lastBacktestResultsRef, setMetrics, showToast, setMarketStatus, setActiveTab,
  setSyntaxStatus, lowerBoxState, setLowerBoxState, runRustBacktest, loading, setLoading
}: any) => {
  const runBacktest = async () => {
    const code = editorMode === 'pine' ? pineCode : pythonCode;
    setLastBacktestCode(code);
    setLastBacktestMode(editorMode);
    setBackendOfflineNotice('');

    if (editorMode === 'python' && !/def\s+strategy\s*\(/m.test(code)) {
      showToast('❌ Python: define def strategy(df): ...');
      setSyntaxStatus('Missing strategy(df) function');
      return;
    }

    const key = `${editorMode}_${selectedCoin}_${chartInterval}`;

    if (backendOnline === false) {
      const ok = await checkBackend();
      if (!ok) {
        const cached = lastBacktestResultsRef.current[key];
        if (cached) {
          setMetrics(cached.metrics);
          setBackendOfflineNotice(`Showing cached result from ${cached.timestamp} (Strategy backend offline — check connection)`);
          showToast('⚠️ Strategy backend offline — Showing cached result');
          setMarketStatus('Connected (Cached)');
          setActiveTab('Overview');
          setSyntaxStatus('Offline fallbacks active');
          if (lowerBoxState === 'minimized') setLowerBoxState('normal');
          return;
        }
        showToast('❌ API offline — terminal mein: npm run backend');
        setSyntaxStatus('API offline — npm run backend');
        setMarketStatus('Offline');
        setBackendOfflineNotice('Strategy backend unavailable — check connection. Terminal mein `npm run backend` run karein.');
        return;
      }
    }

    setLoading(true);
    setMarketStatus(editorMode === 'python' ? 'Running Python...' : 'Running WASM Pine JIT...');
    showToast(editorMode === 'python' ? '🐍 Python backtest...' : '⚡ WASM Pine JIT (< 3ms)...');

    if (editorMode === 'pine') {
      try {
        const closes = allCandles.map(c => c.close);
        const result = await pineJitCompiler.compileAndRun(pineCode, closes, allCandles);
        setStrategySignals(result.signals || []);
        if (result.metrics) {
          setMetrics(result.metrics);
        }
        showToast(`⚡ Pine JIT Executed in ${result.executionTimeMs} ms ✓`);
        setSyntaxStatus(`WASM JIT Ready (${result.executionTimeMs} ms)`);
        setMarketStatus('Connected (WASM JIT)');
        setLoading(false);
        if (lowerBoxState === 'minimized') setLowerBoxState('normal');
        return;
      } catch (jitErr) {
        console.warn('Pine JIT fallback to backend:', jitErr);
      }
    }

    const endpoint = editorMode === 'pine' ? '/backtest-pine' : '/backtest-python';
    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, ticker: selectedCoin, timeframe: chartInterval }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        const err = data.error || data.detail || `HTTP ${res.status}`;
        showToast('❌ ' + err);
        setMarketStatus('Error');
        setSyntaxStatus(String(err).slice(0, 80));
        return;
      }

      const adv = data.advanced_stats || {};
      const trades = data.trades || [];
      const totalTrades = data.summary?.totalTrades || trades.length || 0;
      const maxDrawdownPct = adv.maxDrawdownPct ?? parseBacktestNumber(data.summary?.maxDrawdown);
      const maxDrawdownVal = adv.maxDrawdownVal ?? parseBacktestNumber(data.summary?.maxDrawdownValue);
      
      const newMetrics = {
        summary: {
          netProfitVal: parseBacktestNumber(data.summary?.totalPnL),
          netProfitPct: parseBacktestNumber(data.summary?.pct),
          maxDrawdownVal,
          maxDrawdownPct,
          totalTrades,
          winRate: parseBacktestNumber(data.summary?.profitableTrades),
          profitFactor: parseBacktestNumber(data.summary?.profitFactor) || data.summary?.profitFactor || 0,
        },
        advanced: {
          grossProfit: adv.grossProfit ?? 0, grossLoss: adv.grossLoss ?? 0, longTotal: adv.longTotal ?? 0,
          longWins: adv.longWins ?? 0, shortTotal: adv.shortTotal ?? 0, shortWins: adv.shortWins ?? 0,
          wins: adv.wins ?? 0, losses: adv.losses ?? 0, totalTrades, avgWin: adv.avgWin ?? 0,
          avgLoss: adv.avgLoss ?? 0, avgTrade: adv.avgTrade ?? 0, bestTrade: adv.bestTrade ?? 0,
          worstTrade: adv.worstTrade ?? 0, expectancy: adv.expectancy ?? 0, payoffRatio: adv.payoffRatio ?? 0,
          recoveryFactor: adv.recoveryFactor ?? 0, maxWinStreak: adv.maxWinStreak ?? 0, maxLossStreak: adv.maxLossStreak ?? 0,
          maxDrawdownPct, maxDrawdownVal,
        },
        trades,
        performance: { equityChart: normalizeEquityCurve(data.equity_curve) },
      };

      setMetrics(newMetrics);
      
      // Save to cache
      lastBacktestResultsRef.current[key] = {
        metrics: newMetrics,
        timestamp: new Date().toLocaleTimeString()
      };
      setBackendOfflineNotice('');

      setMarketStatus('Connected');
      setActiveTab('Overview');
      if (lowerBoxState === 'minimized') setLowerBoxState(isMobile ? 'maximized' : 'maximized');
      setSyntaxStatus(
        data.summary?.totalTrades
          ? `✅ ${data.summary.totalTrades} trades`
          : '✅ Done — 0 trades (try 1D timeframe or edit strategy)'
      );
      showToast(
        data.summary?.totalTrades
          ? `✅ ${editorMode === 'python' ? 'Python' : 'Pine'}: ${data.summary.totalTrades} trades`
          : '⚠️ No trades — use 1D timeframe or adjust strategy'
      );
      if (lowerBoxState === 'minimized') setLowerBoxState('normal');
    } catch (e) {
      console.error(e);
      setBackendOnline(false);
      
      const cached = lastBacktestResultsRef.current[key];
      if (cached) {
        setMetrics(cached.metrics);
        setBackendOfflineNotice(`Showing cached result from ${cached.timestamp} (Strategy backend offline — check connection)`);
        showToast('⚠️ Strategy backend offline — Showing cached result');
        setMarketStatus('Connected (Cached)');
        setActiveTab('Overview');
        setSyntaxStatus('Offline fallbacks active');
        if (lowerBoxState === 'minimized') setLowerBoxState('normal');
      } else {
        showToast('❌ API offline — Terminal mein run karein: npm run backend');
        setMarketStatus('Offline');
        setSyntaxStatus('API offline — npm run backend');
        setBackendOfflineNotice('Strategy backend unavailable — check connection. Terminal mein `npm run backend` run karein.');
      }
    } finally {
      setLoading(false);
    }
  };

  return { runBacktest };
};
