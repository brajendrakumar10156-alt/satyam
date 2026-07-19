
import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { fetchExchangeSymbols, fetchExchangeCandles, subscribeExchangeKline, isPerpetualSymbol, parseUnifiedSymbol, getExchangeMeta } from '../exchanges';
import { exportTradesCsv, downloadStrategyFile, parseBacktestNumber, normalizeEquityCurve, DEFAULT_PYTHON_STRATEGY } from '../tradingFeatures';
import { loadCandleCache, saveCandleCache } from '../candleCache';
import { captureViewportSnapshot, generateDrawingId } from '../utils/drawingStore';
import { loadDrawingsFromDB, saveDrawingsToDB } from '../utils/drawingPersistence';

export const TradingContext = createContext({});

export function useTradingContext() {
  return useContext(TradingContext);
}

export function TradingProvider({ children, onLogout, onBackToCoins }) {

  const chartRef = useRef(null);
  const chartContainerRef = useRef(null);
  const webGLEngineRef = useRef(null);
  const chartInstance = useRef(null);
  const candleSeries = useRef(null);
  const volumeSeries = useRef(null);
  const drawingLayerRef = useRef(null);
  const latestCandleRef = useRef(null);
  const isFirstLoad = useRef(true);
  const isLoadingMoreRef = useRef(false);
  const [isLoadingOlderData, setIsLoadingOlderData] = useState(false);
  const allCandlesRef = useRef([]);
  const monacoEditorRef = useRef(null);
  const lastCacheSaveRef = useRef(0);
  const indicatorSeriesRef = useRef({});
  const newsPriceLineRef = useRef(null);
  const newsMarkerPlacedRef = useRef(false);
  const subChartsMapRef = useRef({});
  const positionLinesRef = useRef([]);
  const [chartCreated, setChartCreated] = useState(false);
  const skipNextFullRedrawRef = useRef(false);
  const fetchGenerationRef = useRef(0);
  const [indicatorStructureTick, setIndicatorStructureTick] = useState(0);
  const lastProcessedCandleRef = useRef({ time: 0, close: 0, length: 0 });
  const lastStructureTickRef = useRef(0);
  // Removed hoveredCandle from React state for DOM bypass performance
  const [quickTradeQty, setQuickTradeQty] = useState(0.01);
  const latestNewsListRef = useRef([]);
  const lastReactUpdateRef = useRef(0);
  const prevPriceRef = useRef(0);
  const newsMarkerTimeRef = useRef(null);
  const lastBacktestResultsRef = useRef({});
  const saveRangeTimeoutRef = useRef(null);
  const indicatorDataMapRef = useRef({});
  const [backendOfflineNotice, setBackendOfflineNotice] = useState('');
  const [newsFilterType, setNewsFilterType] = useState('symbol');


  // ─── Theme Management ───
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
  const [stealthMode, setStealthMode] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const searchInput = document.getElementById('smart-search');
        if (searchInput) {
          searchInput.focus();
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
  

  const contextValue = {
    onLogout,
    onBackToCoins,
    chartRef,
    chartContainerRef,
    webGLEngineRef,
    chartInstance,
    candleSeries,
    volumeSeries,
    drawingLayerRef,
    latestCandleRef,
    isFirstLoad,
    isLoadingMoreRef,
    isLoadingOlderData,
    setIsLoadingOlderData,
    allCandlesRef,
    monacoEditorRef,
    lastCacheSaveRef,
    indicatorSeriesRef,
    newsPriceLineRef,
    newsMarkerPlacedRef,
    subChartsMapRef,
    positionLinesRef,
    chartCreated,
    setChartCreated,
    skipNextFullRedrawRef,
    fetchGenerationRef,
    indicatorStructureTick,
    setIndicatorStructureTick,
    lastProcessedCandleRef,
    lastStructureTickRef,
    quickTradeQty,
    setQuickTradeQty,
    latestNewsListRef,
    lastReactUpdateRef,
    prevPriceRef,
    newsMarkerTimeRef,
    lastBacktestResultsRef,
    saveRangeTimeoutRef,
    indicatorDataMapRef,
    backendOfflineNotice,
    setBackendOfflineNotice,
    newsFilterType,
    setNewsFilterType,
    darkMode,
    setDarkMode,
    stealthMode,
    setStealthMode,
    focusMode,
    setFocusMode,
    handleGlobalKeyDown,
    searchInput
  };

  return (
    <TradingContext.Provider value={contextValue}>
      {children}
    </TradingContext.Provider>
  );
}
