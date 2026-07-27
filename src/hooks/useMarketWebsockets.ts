import { useEffect, useRef } from 'react';

export const useMarketWebsockets = (props: any) => {
  const { selectedCoin, selectedExchange, fetchGenerationRef, handleRawTrade, upsertLiveCandle, setMarketStatus, chartInterval, isBacktesting, backendOnline } = props;

useEffect(() => {
    let disposed = false;
    let unsubWs = null;
    let connectTimeout = null;
    const myGeneration = ++fetchGenerationRef.current;

    allCandlesRef.current = [];
    fullCandlesRef.current = [];
    setAllCandles([]);

    const fetchChart = async (initialLoad = false) => {
      try {
        if (initialLoad) {
          setMarketStatus('Loading');
          isFirstLoad.current = true;
        }
        const applyProgress = (partial) => {
          if (disposed || myGeneration !== fetchGenerationRef.current || !partial.length) return;
          if (!replayMode) fullCandlesRef.current = [...partial];
          allCandlesRef.current = partial;
          latestCandleRef.current = { ...partial[partial.length - 1] };
          setAllCandles(partial);
          setLivePrice(partial[partial.length - 1]?.close || 0);
          setMarketStatus('Connected');
        };

        let candles;
        if (initialLoad) {
          const cached = loadCandleCache(selectedExchange, selectedCoin, chartInterval)
            .filter(c => Number.isFinite(c.time) && Number.isFinite(c.close));

          if (cached.length) {
            applyProgress(cached);
            const freshBatch = await fetchCandles(CANDLE_BATCH_SIZE);
            const freshFiltered = freshBatch.filter(c => Number.isFinite(c.time) && Number.isFinite(c.close));
            candles = mergeCandles(cached, freshFiltered);
          } else {
            candles = await fetchInitialHistory((partial) => applyProgress(
              partial.filter(c => Number.isFinite(c.time) && Number.isFinite(c.close))
            ));
          }
        } else {
          candles = await fetchCandles(CANDLE_BATCH_SIZE);
        }
        candles = candles.filter(c => Number.isFinite(c.time) && Number.isFinite(c.close));
        
        if (disposed || myGeneration !== fetchGenerationRef.current) return;
        const historyCap = getHistoryCandleCap(chartInterval);
        const nextCandles = initialLoad
          ? candles.slice(-historyCap)
          : mergeCandles(allCandlesRef.current, candles).slice(-historyCap);

        if (nextCandles.length > 0) latestCandleRef.current = { ...nextCandles[nextCandles.length - 1] };
        if (!replayMode) fullCandlesRef.current = [...nextCandles];
        allCandlesRef.current = nextCandles;
        setAllCandles(nextCandles);
        setLivePrice(nextCandles[nextCandles.length - 1]?.close || 0);
        setMarketStatus('Connected');
        saveCandleCache(selectedExchange, selectedCoin, chartInterval, nextCandles);
      } catch (e) { 
        setMarketStatus('Error');
        setToastMsg(`⚠️ Failed to load ${selectedCoin} on ${selectedExchange}. Invalid pair or API error.`);
        setTimeout(() => setToastMsg(''), 4000);
      }
    };
    fetchChart(true);

    const pollMs = chartInterval === '1m' ? 15000 : chartInterval === '5m' ? 30000 : 60000;
    const pollId = window.setInterval(() => fetchChart(false), pollMs);

    // 30-second Silent Background Data Integrity Re-Checker & Healer
    const gapCheckId = window.setInterval(async () => {
      if (disposed || !allCandlesRef.current || allCandlesRef.current.length < 2) return;
      const candles = allCandlesRef.current;
      let hasGap = false;
      for (let i = 1; i < candles.length; i++) {
        if (candles[i].time - candles[i - 1].time > 90) {
          hasGap = true;
          break;
        }
      }
      if (hasGap) {
        console.log(`[Silent Healer 30s] Gap detected in ${selectedCoin}. Signaling Service 11 Rescue Relay & syncing...`);
        // Non-blocking report to Rust Service 11 Client Rescue Relay
        fetch(`http://127.0.0.1:8080/api/report_corruption?symbol=${selectedCoin}`).catch(() => {});
        try {
          const fresh = await fetchCandles(1000);
          if (fresh && fresh.length > 0 && !disposed) {
            // Strict timestamp sorting & deduplication
            const map = new Map<number, typeof fresh[0]>();
            for (const c of [...allCandlesRef.current, ...fresh]) {
              map.set(c.time, c);
            }
            const aligned = Array.from(map.values()).sort((a, b) => a.time - b.time);
            allCandlesRef.current = aligned;
            fullCandlesRef.current = aligned;
            setAllCandles(aligned);
          }
        } catch (_) {}
      }
    }, 30000);

    connectTimeout = setTimeout(() => {
      if (disposed) return;

      unsubWs = subscribeExchangeKline(
        selectedExchange,
        selectedCoin,
        chartInterval,
        (liveCandle) => {
          if (disposed) return;
          const newPrice = liveCandle.close;
          const prev = prevPriceRef.current || newPrice;
          const color = newPrice >= prev ? '#089981' : '#F23645';
          prevPriceRef.current = newPrice;

          // DOM Bypass updates for instant 60FPS UI
          const elPrice = document.getElementById('topbar-live-price');
          if (elPrice) {
            elPrice.innerText = '$' + newPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
            elPrice.style.color = color;
          }
          
          const elSell = document.getElementById('quick-sell-price');
          if (elSell) elSell.innerText = (newPrice * 0.9998).toFixed(2);
          
          const elBuy = document.getElementById('quick-buy-price');
          if (elBuy) elBuy.innerText = (newPrice * 1.0002).toFixed(2);

          // Throttle React state to 1 update per second
          const now = Date.now();
          if (now - lastReactUpdateRef.current > 1000) {
            lastReactUpdateRef.current = now;
            setLivePrice(newPrice);
            setPriceColor(color);
          }

          upsertLiveCandle(liveCandle);
        },
        (status) => {
          if (!disposed && status) setMarketStatus(status);
        }
      );
    }, 400);

    return () => {
      disposed = true;
      window.clearInterval(pollId);
      window.clearInterval(gapCheckId);
      if (connectTimeout) clearTimeout(connectTimeout);
      if (unsubWs) unsubWs();
    };
  }, [selectedCoin, selectedExchange, fetchGenerationRef, handleRawTrade, upsertLiveCandle, setMarketStatus, chartInterval, isBacktesting, backendOnline]);
};
