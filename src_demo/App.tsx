import html2canvas from 'html2canvas';
import { RightSidebar } from './components/layout/RightSidebar';
import { LeftToolbar } from './components/layout/LeftToolbar';
import React, { useEffect, useRef, useState, useCallback, useMemo, Suspense, lazy } from 'react';
import NativeDrawingLayer from './components/NativeDrawingLayer';
import NativeIndicatorLayer from './components/NativeIndicatorLayer';
import DrawingAxisLabels from './components/DrawingAxisLabels';
const WebGLChartEngine = lazy(() => import('./components/WebGLChartEngine.tsx'));
const WebGPUChartEngine = lazy(() => import('./components/WebGPUChartEngine.tsx'));
import { captureViewportSnapshot, generateDrawingId } from './utils/drawingStore';
import { loadDrawingsFromDB, saveDrawingsToDB } from './utils/drawingPersistence';
import Editor from '@monaco-editor/react';
import { nativeManager } from './NativeEngineManager';
import { perfectData } from './PerfectDataSplicer';
import { pineJitCompiler } from './utils/pineJitCompiler';
import { aiStrategyEngine } from './utils/aiStrategyEngine';
import { heatmapEngine } from './utils/heatmapEngine';
import { arbitrageMatrixEngine } from './arbitrageWorker';
import logo from './assets/logo.png';
import { createChart } from 'lightweight-charts';
import {
  Rocket, Clock, Sliders, Radio, Activity, TrendingUp, Search, Percent, ListFilter,
  Database, RefreshCw, ChevronUp, ChevronDown, Play, Undo, Redo, Bell,
  History, Settings, Camera, Maximize2, Layers, Upload, FileDiff, X, Shapes,
  ChevronRight, ChevronDown as ChevronDownIcon, Download, Sun, Moon,
  Crosshair, Square, Type, Eraser, Menu, Sparkles, Send, Bot, Code2, FileCode,
  Brush, Ruler, Trash2, Eye, EyeOff, Calendar, ArrowLeft, AlignJustify, GitMerge,
  MousePointer, Circle, Disc, Triangle, FileText, DollarSign, MessageSquare,
  Flag, Target, Shield, Move, Maximize, Magnet, Lock, Unlock, Smile, Compass, Minus,
  ArrowRight, ArrowUpRight, GitCommit, Info, MoveVertical, Plus, Columns, Award, GitBranch,
  MousePointer2, Spline, GitPullRequest, PenTool, MessageSquareText, Waypoints, Focus,
  Wand2, Route, MoveHorizontal, SplitSquareHorizontal, Grid3x3, Tag, Signpost, TrendingDown, Baseline, ListTree,
  ArrowUp, ArrowDown, Star, Heart, Box, ZoomIn, ZoomOut, Briefcase, Ghost, RotateCcw, Check, Pin, PinOff,
  Cloud, Save, Copy, Edit2, LayoutGrid, CandlestickChart, Scale, LineChart, Rewind, Braces, BarChartHorizontal, Minimize2, Filter, Code, FlaskConical, Zap
} from 'lucide-react';
import { 
  ComposedChart, Area, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, AreaChart, Legend 
} from 'recharts';
import {
  EXCHANGE_LIST,
  getExchangeMeta,
  fetchExchangeSymbols,
  fetchExchangeCandles,
  subscribeExchangeKline,
  fetchJson,
  isPerpetualSymbol,
  parseUnifiedSymbol,
} from './exchanges';
import {
  INDICATOR_LIBRARY,
  DEFAULT_PYTHON_STRATEGY,
  exportTradesCsv,
  downloadStrategyFile,
  parseBacktestNumber,
  normalizeEquityCurve,
} from './tradingFeatures';
import { loadCandleCache, saveCandleCache } from './candleCache';
import { INDICATOR_REGISTRY } from './indicatorsRegistry';
import ArbitrageBot from './components/ArbitrageBot';
import StrategyTester from './components/StrategyTester';
import Level3DepthTape from './components/Level3DepthTape';
import AIRiskPanel from './components/AIRiskPanel';
import { predictNextCandle } from './utils/predictionEngine';
import PredictionReportModal from './components/PredictionReportModal';

/** Pure helper: convert OHLCV candles to Heikin-Ashi candles */
function toHeikinAshi(candles) {
  if (!candles || candles.length === 0) return [];
  const ha = [];
  let prevHaOpen = (candles[0].open + candles[0].close) / 2;
  let prevHaClose = (candles[0].open + candles[0].high + candles[0].low + candles[0].close) / 4;
  ha.push({ time: candles[0].time, open: prevHaOpen, high: candles[0].high, low: candles[0].low, close: prevHaClose });
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];
    const haClose = (c.open + c.high + c.low + c.close) / 4;
    const haOpen = (prevHaOpen + prevHaClose) / 2;
    const haHigh = Math.max(c.high, haOpen, haClose);
    const haLow = Math.min(c.low, haOpen, haClose);
    ha.push({ time: c.time, open: haOpen, high: haHigh, low: haLow, close: haClose });
    prevHaOpen = haOpen;
    prevHaClose = haClose;
  }
  return ha;
}

import { API_BASE, CANDLE_BATCH_SIZE, INITIAL_HISTORY_BATCHES, MAX_CANDLES_IN_MEMORY, SIX_YEARS_SECONDS, INTERVAL_SECONDS_MAP, CUSTOM_TIMEFRAME_REGEX, intervalToSeconds, getHistoryCandleCap, QUOTE_ASSETS, parseSymbolParts, getBaseAsset, getQuoteAsset, getFngColor, formatUSD, formatShortNumber, COINGECKO_ID_MAP, getCoinGeckoId, coinIconUrl, handleCoinIconError } from './app_core/AppConfig';
function mergeCandles(...groups) {
  const byTime = new Map();
  groups.flat().forEach(c => {
    if (c && Number.isFinite(c.time)) byTime.set(c.time, c);
  });
  return Array.from(byTime.values()).sort((a, b) => a.time - b.time);
}

// ─── Helper for eraser hit testing ───
function distanceToLineSegment(px, py, x1, y1, x2, y2) {
  const A = px - x1, B = py - y1, C = x2 - x1, D = y2 - y1;
  const dot = A * C + B * D;
  const len_sq = C * C + D * D;
  let param = -1;
  if (len_sq !== 0) param = dot / len_sq;
  let xx, yy;
  if (param < 0) { xx = x1; yy = y1; }
  else if (param > 1) { xx = x2; yy = y2; }
  else { xx = x1 + param * C; yy = y1 + param * D; }
  const dx = px - xx, dy = py - yy;
  return Math.sqrt(dx * dx + dy * dy);
}


function hexToRGBA(hex, alpha) {
  try {
    if (!hex) return `rgba(124, 92, 255, ${alpha})`;
    const h = hex.replace('#', '');
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  } catch (e) {
    return `rgba(124, 92, 255, ${alpha})`;
  }
}

function throttle(func, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

class WebGLErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true };
  }
  componentDidCatch(error, errorInfo) {
    console.error("WebGL Engine Error:", error, errorInfo);
    if (this.props.onError) {
      this.props.onError(error);
    }
  }
  render() {
    if (this.state.hasError) {
      return null;
    }
    return this.props.children;
  }
}

export default function App({ onLogout, onBackToCoins }) {
  const chartRef = useRef(null);
  const chartContainerRef = useRef(null);
  const webGLEngineRef = useRef(null);
  const chartInstance = useRef(null);
  const candleSeries = useRef(null);
  const volumeSeries = useRef(null);
  const predictionSeriesRef = useRef(null);
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
    document.documentElement.classList.toggle('theme-light', !darkMode);
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
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const t = useMemo(() => ({
    bg:     darkMode ? 'bg-[#0B0E14]' : 'bg-[#F6F8FC]',
    sec:    darkMode ? 'bg-[#0F1117]' : 'bg-[#FFFFFF]',
    ter:    darkMode ? 'bg-[#141820]' : 'bg-[#EEF2F8]',
    text:   darkMode ? 'text-[#E2E8F0]' : 'text-[#172033]',
    muted:  darkMode ? 'text-[#64748B]' : 'text-[#64748B]',
    dim:    darkMode ? 'text-[#475569]' : 'text-[#94A3B8]',
    border: darkMode ? 'border-[rgba(255,255,255,0.07)]' : 'border-[#DCE3EF]',
    hover:  darkMode ? 'hover:bg-[rgba(255,255,255,0.05)] hover:text-white' : 'hover:bg-[#EEF4FF] hover:text-[#172033]',
    glass:  darkMode ? 'bg-[rgba(15,17,23,0.8)] backdrop-blur-md border border-[rgba(255,255,255,0.07)]' : 'bg-white/85 backdrop-blur-md border border-[#DCE3EF] shadow-[0_8px_24px_rgba(30,41,59,0.06)]',
    card:   darkMode ? 'bg-[#0F1117] border border-[rgba(255,255,255,0.07)] rounded-xl shadow-[0_4px_16px_rgba(0,0,0,0.5)]' : 'bg-white border border-[#DCE3EF] rounded-xl shadow-[0_6px_20px_rgba(30,41,59,0.06)]',
  }), [darkMode]);


  // ─── States ───
  const [editorMode, setEditorMode] = useState('pine');
  const [selectedExchange, setSelectedExchange] = useState(() => {
    let saved = localStorage.getItem('exchange');
    if (saved === 'kraken') {
      saved = 'binance';
      localStorage.setItem('exchange', 'binance');
    }
    return EXCHANGE_LIST.some((e) => e.id === saved) ? saved : 'binance';
  });
  const [selectedCoin, setSelectedCoin] = useState(() => {
    const saved = localStorage.getItem('selectedCoin');
    return saved ? String(saved).toUpperCase() : 'SOLUSDT';
  });

  useEffect(() => {
    localStorage.setItem('selectedCoin', selectedCoin);
  }, [selectedCoin]);

  const [activeTab, setActiveTab] = useState('Performance Summary');
  const [loading, setLoading] = useState(false);
  const [chartInterval, setChartInterval] = useState(() => {
    const saved = localStorage.getItem('chartInterval');
    return saved || '1m';
  });

  useEffect(() => {
    localStorage.setItem('chartInterval', chartInterval);
  }, [chartInterval]);
  const [customTimeframeInput, setCustomTimeframeInput] = useState('');
  const [allCandles, setAllCandles] = useState([]);
  const [livePrice, setLivePrice] = useState(0);
  const [priceColor, setPriceColor] = useState('#089981');
  const [coinInput, setCoinInput] = useState('');
  const [syntaxStatus, setSyntaxStatus] = useState('System Idle. Waiting for strategy injection...');
  const [marketStatus, setMarketStatus] = useState('Connected');
  const [binanceCoins, setBinanceCoins] = useState([]);
  const [coinsLoading, setCoinsLoading] = useState(true);
  const binanceCoinSetRef = useRef(new Set());
  const [lowerBoxState, setLowerBoxState] = useState('minimized');
  const [isReportPinned, setIsReportPinned] = useState(true);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isArbitrageBotOpen, setIsArbitrageBotOpen] = useState(false);
  const [chartStyle, setChartStyle] = useState('Candles');
  const [replayMode, setReplayMode] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [activeModal, setActiveModal] = useState(null);
  const [isStyleDropdownOpen, setIsStyleDropdownOpen] = useState(false);
  const [isTimeframeDropdownOpen, setIsTimeframeDropdownOpen] = useState(false);
  const [isActionsDropdownOpen, setIsActionsDropdownOpen] = useState(false);
  const [isLayoutMenuOpen, setIsLayoutMenuOpen] = useState(false);
  const [layoutName, setLayoutName] = useState('Unnamed');
  const [isAutosave, setIsAutosave] = useState(true);
  const [isShareLayout, setIsShareLayout] = useState(false);
  const [volumeProfile, setVolumeProfile] = useState(false);
  const [selectedIndicatorTab, setSelectedIndicatorTab] = useState('Technicals');
  const [indicatorCategorySubTab, setIndicatorCategorySubTab] = useState('Indicators');
  const [indicatorSearchQuery, setIndicatorSearchQuery] = useState('');
  const [toastMsg, setToastMsg] = useState('');
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileActiveTab, setMobileActiveTab] = useState('chart');
  const [mobileDrawingMenuOpen, setMobileDrawingMenuOpen] = useState(false);

  // Prediction Engine State
  const [predictedCandle, setPredictedCandle] = useState(null);
  const [predictionHistory, setPredictionHistory] = useState([]);
  const [showPredictionReport, setShowPredictionReport] = useState(false);
  const [isAutoPredictEnabled, setIsAutoPredictEnabled] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const handler = (e) => {
      setIsMobile(e.matches);
      if (!e.matches) setMobileMenuOpen(false);
    };
    handler(mq);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    const resizeChart = () => {
      if (chartRef.current && chartInstance.current) {
        chartInstance.current.applyOptions({
          width: chartRef.current.clientWidth,
          height: chartRef.current.clientHeight,
        });
      }
      Object.keys(subChartsMapRef.current).forEach(id => {
        const container = document.getElementById(`subchart-container-${id}`);
        if (container && subChartsMapRef.current[id]?.chart) {
          subChartsMapRef.current[id].chart.applyOptions({
            width: container.clientWidth,
            height: container.clientHeight,
          });
        }
      });
    };
    document.addEventListener('fullscreenchange', resizeChart);
    window.addEventListener('orientationchange', resizeChart);
    window.addEventListener('resize', resizeChart);
    return () => {
      document.removeEventListener('fullscreenchange', resizeChart);
      window.removeEventListener('orientationchange', resizeChart);
      window.removeEventListener('resize', resizeChart);
    };
  }, []);

  // ─── Drawing Tools ───
  const [activeTool, setActiveTool] = useState(null);
  const [drawings, setDrawings] = useState([]);
  // ─── Drawing Persistence Effects ───
  useEffect(() => {
    if (selectedCoin && chartInterval && selectedExchange) {
      loadDrawingsFromDB(selectedExchange, selectedCoin, chartInterval).then(loaded => {
        setDrawings(loaded || []);
      });
    }
  }, [selectedCoin, chartInterval, selectedExchange]);

  useEffect(() => {
    if (selectedCoin && chartInterval && selectedExchange) {
      const timeoutId = setTimeout(() => {
        saveDrawingsToDB(selectedExchange, selectedCoin, chartInterval, drawings);
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [drawings, selectedCoin, chartInterval, selectedExchange]);

  const [tempShape, setTempShape] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState(null);
  const [brushPath, setBrushPath] = useState([]); // Temporary path for active brush drawing
  const [magnetMode, setMagnetMode] = useState('off');
  const [isHoveringDrawing, setIsHoveringDrawing] = useState(false); // 'off', 'weak', 'strong'
  const [keepDrawing, setKeepDrawing] = useState(false);
  const [lockDrawings, setLockDrawings] = useState(false);
  const [hideDrawings, setHideDrawings] = useState(false);
  const [activeFlyout, setActiveFlyout] = useState(null);
  const [hoverCoords, setHoverCoords] = useState(null);
  const [magicTrail, setMagicTrail] = useState([]);
  const [isCursorStudioOpen, setIsCursorStudioOpen] = useState(false);
  const [isTrendStudioOpen, setIsTrendStudioOpen] = useState(false);
  const [cursorSettings, setCursorSettings] = useState({
    color: '#FF007F',
    size: 3,
    opacity: 85,
    showTooltip: true,
    autoSnap: true,
    extendLines: true,
    tooltipOnLongPress: true
  });
  
  // Track selected sub-tool per category
  const [selectedTools, setSelectedTools] = useState({
    cursor: 'crosshair',
    trend: 'trendline',
    gann_fib: 'fibonacci',
    shape: 'rectangle',
    annotation: 'text',
    pattern: 'abcd',
    forecast: 'long_position',
    icon_stickers: 'icon_up'
  });

  // ─── Visual Indicators Overlays ───
  const [visualIndicators, setVisualIndicators] = useState([
    { id: 'ema_9', type: 'ema', name: 'EMA 9', params: { period: 9 }, color: '#ff9800', visible: false },
    { id: 'ema_21', type: 'ema', name: 'EMA 21', params: { period: 21 }, color: '#ea39ff', visible: false },
    { id: 'sma_50', type: 'sma', name: 'SMA 50', params: { period: 50 }, color: '#2962ff', visible: false },
    { id: 'sma_200', type: 'sma', name: 'SMA 200', params: { period: 200 }, color: '#f44336', visible: false },
    { id: 'bb_20_2', type: 'bb', name: 'Bollinger Bands', params: { period: 20, stdDev: 2 }, color: '#26a69a', visible: false },
    { id: 'vwap', type: 'vwap', name: 'VWAP', params: {}, color: '#00e676', visible: false },
    { id: 'rsi_14', type: 'rsi', name: 'RSI', params: { period: 14 }, color: '#e040fb', visible: false },
    { id: 'macd_12_26_9', type: 'macd', name: 'MACD', params: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 }, color: '#29b6f6', visible: false },
    { id: 'atr_14', type: 'atr', name: 'ATR', params: { period: 14 }, color: '#ff5252', visible: false },
    { id: 'adx_14', type: 'adx', name: 'ADX', params: { period: 14 }, color: '#ffd700', visible: false },
    { id: 'cci_20', type: 'cci', name: 'CCI', params: { period: 20 }, color: '#00bcd4', visible: false },
    { id: 'obv', type: 'obv', name: 'OBV', params: {}, color: '#ec407a', visible: false },
    { id: 'williams_14', type: 'williams', name: 'Williams %R', params: { period: 14 }, color: '#ab47bc', visible: false },
    { id: 'stochastic_14_3_3', type: 'stochastic', name: 'Stochastic', params: { period: 14, kPeriod: 3, dPeriod: 3 }, color: '#2962ff', visible: false },
    { id: 'mfi_14', type: 'mfi', name: 'MFI', params: { period: 14 }, color: '#4caf50', visible: false },
    { id: 'supertrend_10_3', type: 'supertrend', name: 'SuperTrend', params: { period: 10, multiplier: 3 }, color: '#089981', visible: false },
    { id: 'psar_02_2', type: 'psar', name: 'Parabolic SAR', params: { step: 0.02, maxStep: 0.2 }, color: '#ff6d00', visible: false },
    { id: 'ichimoku_9_26_52', type: 'ichimoku', name: 'Ichimoku Cloud', params: { tenkan: 9, kijun: 26, senkouB: 52 }, color: '#e91e63', visible: false },
  ]);
  const [editingIndicatorId, setEditingIndicatorId] = useState(null);
  const [selectedDrawingId, setSelectedDrawingId] = useState(null);
  const [floatingToolbarCoords, setFloatingToolbarCoords] = useState(null);
  const [editingModalTab, setEditingModalTab] = useState('inputs');
  const [tempIndicatorParams, setTempIndicatorParams] = useState({});
  const [tempIndicatorColor, setTempIndicatorColor] = useState('#7C5CFF');
  const [tempIndicatorWidth, setTempIndicatorWidth] = useState(2);
  const [chartLayout, setChartLayout] = useState('1');
  const [renderEngine, setRenderEngine] = useState(() => {
    return localStorage.getItem('renderEngine') || 'canvas2d';
  });
  const [timezone, setTimezone] = useState(() => {
    return localStorage.getItem('chartTimezone') || 'UTC';
  });
  const timezoneOffset = useMemo(() => {
    if (timezone === 'UTC') return 0;
    if (timezone === 'IST') return 19800; // 5.5 hours
    return new Date().getTimezoneOffset() * -60; // Auto
  }, [timezone]);
  const viewportSnapshotRef = useRef(null);
  const [strategySignals, setStrategySignals] = useState([]);
  const [showHeatmap, setShowHeatmap] = useState(false);

  const heatmapClusters = useMemo(() => {
    if (!showHeatmap || !livePrice) return [];
    return heatmapEngine.calculateLiquidationClusters(livePrice, allCandles);
  }, [showHeatmap, livePrice, allCandles]);

  // Auto-Hardware Profiler: Detect best default engine on load
  useEffect(() => {
    nativeManager.initializeSystem().then((bestEngine) => {
      const savedEngine = localStorage.getItem('renderEngine');
      if (!savedEngine || savedEngine === 'canvas2d') {
        console.log(`[QuantaAI Auto-Hardware Profiler] Auto-selecting optimal engine: ${bestEngine}`);
        setRenderEngine(bestEngine);
        localStorage.setItem('renderEngine', bestEngine);
      }
    });
  }, []);

  // Engine lifecycle: destroy old engine on toggle
  useEffect(() => {
    if ((renderEngine === 'webgl' || renderEngine === 'webgpu')) {
      if (chartInstance.current) {
        Object.keys(subChartsMapRef.current).forEach(id => {
          try {
            subChartsMapRef.current[id].unsubscribeSync?.();
            subChartsMapRef.current[id].chart.remove();
          } catch (e) {}
        });
        subChartsMapRef.current = {};
        chartInstance.current.remove();
        chartInstance.current = null;
        candleSeries.current = null;
        volumeSeries.current = null;
        indicatorSeriesRef.current = {};
        setChartCreated(false);
      }
    }
  }, [renderEngine]);


  const [isAtLiveEdge, setIsAtLiveEdge] = useState(true);
  const [isLegendExpanded, setIsLegendExpanded] = useState(true);
  const [compareSymbol, setCompareSymbol] = useState(null);
  const [compareCandles, setCompareCandles] = useState([]);
  const [priceScaleMode, setPriceScaleMode] = useState(0); // 0=Normal, 1=Logarithmic, 2=Percentage, 3=IndexedTo100
  const [autoScale, setAutoScale] = useState(true);
  const [invertScale, setInvertScale] = useState(false);
  const [isPriceScaleMenuOpen, setIsPriceScaleMenuOpen] = useState(false);

  const handleEngineToggle = useCallback(() => {
    if (isDrawing) {
      setToastMsg('⚠️ Pehle drawing complete karo, phir toggle karo');
      setTimeout(() => setToastMsg(''), 3000);
      return;
    }
    if (chartInstance.current) {
      viewportSnapshotRef.current = captureViewportSnapshot(
        chartInstance.current, priceScaleMode, autoScale
      );
    }
    setSelectedDrawingId(null);
    setFloatingToolbarCoords(null);
    setHoverCoords(null);
    setActiveFlyout(null);
        let nextMode = 'webgl';
    if (renderEngine === 'canvas2d') nextMode = 'webgl';
    else if (renderEngine === 'webgl') nextMode = 'webgpu';
    else nextMode = 'canvas2d';

    setRenderEngine(nextMode);
    localStorage.setItem('renderEngine', nextMode);

    // Trigger instant drawing layer redraw across all engines (Canvas2D ↔ WebGL ↔ WebGPU)
    setTimeout(() => {
      if (drawingLayerRef.current) drawingLayerRef.current.draw();
    }, 150);
    
    if (nextMode === 'webgpu') setToastMsg('🚀 WebGPU Engine — Extreme Performance');
    else if (nextMode === 'webgl') setToastMsg('⚡ WebGL Engine — GPU Accelerated');
    else setToastMsg('🎨 Canvas 2D Engine');
    setTimeout(() => setToastMsg(''), 3000);
  }, [renderEngine, isDrawing, priceScaleMode, autoScale]);

  // ─── Collapsible Right Sidebar ───
  const [rightSidebar, setRightSidebar] = useState(null); // 'watchlist', 'details', 'alerts', 'news', or null
  const [watchlist, setWatchlist] = useState(() => {
    try {
      const saved = localStorage.getItem('watchList');
      return saved ? JSON.parse(saved) : ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT', 'ADAUSDT', 'LTCUSDT'];
    } catch {
      return ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT', 'ADAUSDT', 'LTCUSDT'];
    }
  });
  const [watchlistTickers, setWatchlistTickers] = useState({});
  const [selectedCoinStats, setSelectedCoinStats] = useState(null);
  const [newsList, setNewsList] = useState([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsError, setNewsError] = useState(false);
  const [coinFundamentals, setCoinFundamentals] = useState(null);
  const [fundamentalsLoading, setFundamentalsLoading] = useState(false);
  const [fundamentalsError, setFundamentalsError] = useState(false);
  const fundamentalsCacheRef = useRef({});
  const [fearGreedIndex, setFearGreedIndex] = useState(null);
  const [fundingRate, setFundingRate] = useState(null);
  const [openInterest, setOpenInterest] = useState(null);
  const [futuresLoading, setFuturesLoading] = useState(false);
  const [showNewsPanel, setShowNewsPanel] = useState(false);

  // ─── Paper Trading (Broker Console) ───
  const [balance, setBalance] = useState(() => {
    const saved = localStorage.getItem('paper_balance');
    return saved ? parseFloat(saved) : 10000;
  });
  const [positions, setPositions] = useState(() => {
    const saved = localStorage.getItem('paper_positions');
    return saved ? JSON.parse(saved) : [];
  });
  const [paperOrders, setPaperOrders] = useState(() => {
    const saved = localStorage.getItem('paper_orders');
    return saved ? JSON.parse(saved) : [];
  });

  const indicatorWorkerRef = useRef(null);
  const visualIndicatorsRef = useRef(visualIndicators);
  useEffect(() => { visualIndicatorsRef.current = visualIndicators; }, [visualIndicators]);
  
  useEffect(() => {
    const worker = new Worker(new URL('./indicatorWorker.ts', import.meta.url), { type: 'module' });
    indicatorWorkerRef.current = worker;
    
    worker.onmessage = (e) => {
      const { type, resultsMap } = e.data;
      if (type === 'computeAllDone') {
        indicatorDataMapRef.current = { ...indicatorDataMapRef.current, ...resultsMap };
        
        const vInds = visualIndicatorsRef.current || [];
        const sMap = indicatorSeriesRef.current;
        const scMap = subChartsMapRef.current;
        
        vInds.forEach(ind => {
          if (!ind.visible || !resultsMap[ind.id]) return;
          const reg = INDICATOR_REGISTRY[ind.type];
          if (!reg) return;
          
          const results = resultsMap[ind.id];
          
          if (reg.kind === 'overlay') {
            reg.seriesConfig.forEach(s => {
              const seriesKey = `${ind.id}_${s.key}`;
              const series = sMap[seriesKey];
              const data = results[s.key];
              if (series && data) {
                series.setData(data);
              }
            });
          } else if (reg.kind === 'subchart') {
            const subChartObj = scMap[ind.id];
            if (subChartObj && subChartObj.seriesList) {
              reg.seriesConfig.forEach(s => {
                const series = subChartObj.seriesList[s.key];
                const data = results[s.key];
                if (series && data) {
                  if (s.type === 'histogram') {
                    const coloredData = data.map(h => ({
                      time: h.time,
                      value: h.value,
                      color: h.value >= 0 ? 'rgba(8, 153, 129, 0.5)' : 'rgba(242, 54, 69, 0.5)'
                    }));
                    series.setData(coloredData);
                  } else {
                    series.setData(data);
                  }
                }
              });
            }
          }
        });

        // Force WebGPU/WebGL engine to re-render with new indicator data
        if (webGLEngineRef.current && typeof webGLEngineRef.current.render === 'function') {
          webGLEngineRef.current.render();
        }
      }
    };
    
    return () => worker.terminate();
  }, []);
  const [watchlistSearchInput, setWatchlistSearchInput] = useState('');
  const [watchlistDropdownOpen, setWatchlistDropdownOpen] = useState(false);
  const [orderType, setOrderType] = useState('MARKET'); // 'MARKET' or 'LIMIT'
  const [orderSide, setOrderSide] = useState('BUY'); // 'BUY' or 'SELL'
  const [orderQty, setOrderQty] = useState('');
  const [orderLimitPrice, setOrderLimitPrice] = useState('');
  const [marginMode, setMarginMode] = useState('Cross');
  const [leverage, setLeverage] = useState(20);
  const [useTPSL, setUseTPSL] = useState(false);
  const [tpPrice, setTpPrice] = useState('');
  const [slPrice, setSlPrice] = useState('');
  const [postOnly, setPostOnly] = useState(false);
  const [tradingTab, setTradingTab] = useState('Positions');


  useEffect(() => { localStorage.setItem('paper_balance', balance); }, [balance]);
  useEffect(() => { localStorage.setItem('paper_positions', JSON.stringify(positions)); }, [positions]);
  useEffect(() => { localStorage.setItem('paper_orders', JSON.stringify(paperOrders)); }, [paperOrders]);
  useEffect(() => { localStorage.setItem('watchList', JSON.stringify(watchlist)); }, [watchlist]);

  // ─── Watchlist, News, Stats Data Fetchers ───
  useEffect(() => {
    const fetchWatchlistPrices = async () => {
      try {
        const res = await fetch('https://api.binance.com/api/v3/ticker/24hr');
        const data = await res.json();
        if (Array.isArray(data)) {
          const tickerMap = {};
          data.forEach(item => {
            tickerMap[item.symbol] = {
              price: parseFloat(item.lastPrice),
              change: parseFloat(item.priceChangePercent)
            };
          });
          setWatchlistTickers(tickerMap);
        }
      } catch (e) {
        console.warn("Could not fetch watchlist prices:", e);
      }
    };
    fetchWatchlistPrices();
    const id = setInterval(fetchWatchlistPrices, 5000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${selectedCoin}`);
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        const data = await res.json();
        if (data && !data.code) {
          setSelectedCoinStats({
            high: parseFloat(data.highPrice),
            low: parseFloat(data.lowPrice),
            volume: parseFloat(data.volume),
            quoteVolume: parseFloat(data.quoteVolume),
            priceChange: parseFloat(data.priceChange),
            priceChangePercent: parseFloat(data.priceChangePercent)
          });
        }
      } catch (e) {
        console.warn("Could not fetch stats for coin:", selectedCoin, e);
        // Fallback safety to escape broken localStorage coins like '0GEUR'
        if (selectedCoin !== 'BTCUSDT') {
          console.log("Resetting selectedCoin to BTCUSDT due to fetch failure.");
          localStorage.removeItem('selectedCoin');
          setSelectedCoin('BTCUSDT');
        }
      }
    };
    fetchStats();
    const id = setInterval(fetchStats, 8000);
    return () => clearInterval(id);
  }, [selectedCoin]);

  useEffect(() => {
    const fetchNews = async () => {
      setNewsLoading(true);
      setNewsError(false);
      try {
        const coinBase = getBaseAsset(selectedCoin);
        const res = await fetch(`${API_BASE}/api/news?symbol=${coinBase}`);
        if (!res.ok) throw new Error("Local news fetch failed");
        const data = await res.json();
        
        let articles = [];
        if (data && data.news && data.news.length > 0) {
          articles = data.news;
        }

        const parsed = articles.slice(0, 20).map(item => ({
          id: item.id,
          title: item.title,
          source: item.source,
          url: item.url,
          desc: "", // Our local api might not have body/desc, fallback to empty string
          timestamp: item.timestamp,
          sentiment: item.sentiment,
          time: new Date(item.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }));
        setNewsList(parsed);
        latestNewsListRef.current = parsed;
      } catch (e) {
        console.error("Failed to fetch news from backend:", e);
        setNewsList([]);
        latestNewsListRef.current = [];
        setNewsError(true);
      } finally {
        setNewsLoading(false);
      }
    };
    fetchNews();
    const id = setInterval(fetchNews, 60000);
    return () => clearInterval(id);
  }, [selectedCoin]);

  // Fetch CoinGecko Fundamentals
  useEffect(() => {
    if (rightSidebar !== 'details' || !selectedCoin) return;

    let active = true;
    const coinId = getCoinGeckoId(selectedCoin);
    
    // Check cache
    const cacheKey = `fundamentals_${coinId}`;
    const cachedData = sessionStorage.getItem(cacheKey);
    if (cachedData) {
      try {
        const { data, timestamp } = JSON.parse(cachedData);
        if (Date.now() - timestamp < 5 * 60 * 1000) {
          setCoinFundamentals(data);
          setFundamentalsError(false);
          setFundamentalsLoading(false);
          return;
        }
      } catch (e) {
        console.warn("Failed to parse cached fundamentals:", e);
      }
    }

    const fetchFundamentals = async () => {
      setFundamentalsLoading(true);
      setFundamentalsError(false);
      try {
        const url = `https://api.coingecko.com/api/v3/coins/${coinId}?localization=false&tickers=false&market_data=true`;
        const data = await fetchJson(url);
        
        if (data && active) {
          sessionStorage.setItem(cacheKey, JSON.stringify({
            data,
            timestamp: Date.now()
          }));
          setCoinFundamentals(data);
        }
      } catch (err) {
        console.error("Error fetching fundamentals:", err);
        if (active) {
          setFundamentalsError(true);
        }
      } finally {
        if (active) {
          setFundamentalsLoading(false);
        }
      }
    };

    fetchFundamentals();

    return () => {
      active = false;
    };
  }, [selectedCoin, rightSidebar]);

  // Fetch Fear & Greed Index
  useEffect(() => {
    let active = true;
    
    const cacheKey = 'fear_greed_index';
    const cachedData = sessionStorage.getItem(cacheKey);
    if (cachedData) {
      try {
        const { data, timestamp } = JSON.parse(cachedData);
        if (Date.now() - timestamp < 60 * 60 * 1000) {
          setFearGreedIndex(data);
          return;
        }
      } catch (e) {
        console.warn("Failed to parse cached fear/greed:", e);
      }
    }

    const fetchFearGreed = async () => {
      try {
        const url = 'https://api.alternative.me/fng/?limit=1';
        const res = await fetch(url);
        if (!res.ok) throw new Error("Fear and Greed fetch failed");
        const data = await res.json();
        if (data && data.data && data.data[0] && active) {
          const item = {
            value: parseInt(data.data[0].value),
            classification: data.data[0].value_classification,
            timestamp: parseInt(data.data[0].timestamp)
          };
          sessionStorage.setItem(cacheKey, JSON.stringify({
            data: item,
            timestamp: Date.now()
          }));
          setFearGreedIndex(item);
        }
      } catch (e) {
        console.warn("Could not fetch Fear & Greed index:", e);
      }
    };

    fetchFearGreed();
    const id = setInterval(fetchFearGreed, 60 * 60 * 1000);

    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  // Fetch Funding Rate & Open Interest
  useEffect(() => {
    if (rightSidebar !== 'details' || !selectedCoin) return;

    const isPerp = isPerpetualSymbol(selectedCoin);
    if (!isPerp) {
      setFundingRate(null);
      setOpenInterest(null);
      return;
    }

    let active = true;
    setFuturesLoading(true);

    const fetchFuturesData = async () => {
      try {
        const baseSymbol = selectedCoin.replace('.P', '').replace('-PERP', '').replace('_PERP', '').replace('-SWAP', '').toUpperCase();
        let rate = null;
        let oi = null;

        if (selectedExchange === 'binance') {
          const frUrl = `https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${baseSymbol}`;
          const oiUrl = `https://fapi.binance.com/fapi/v1/openInterest?symbol=${baseSymbol}`;
          
          const [frData, oiData] = await Promise.all([
            fetchJson(frUrl).catch(() => null),
            fetchJson(oiUrl).catch(() => null)
          ]);

          if (frData) rate = parseFloat(frData.lastFundingRate);
          if (oiData) oi = parseFloat(oiData.openInterest);

        } else if (selectedExchange === 'bybit') {
          const url = `https://api.bybit.com/v5/market/tickers?category=linear&symbol=${baseSymbol}`;
          const data = await fetchJson(url).catch(() => null);
          if (data && data.result?.list?.[0]) {
            const ticker = data.result.list[0];
            rate = parseFloat(ticker.fundingRate);
            oi = parseFloat(ticker.openInterest);
          }

        } else if (selectedExchange === 'okx') {
          const parts = parseUnifiedSymbol(selectedCoin);
          const instId = `${parts.base}-${parts.quote}-SWAP`;
          
          const frUrl = `https://www.okx.com/api/v5/public/funding-rate?instId=${instId}`;
          const oiUrl = `https://www.okx.com/api/v5/public/open-interest?instId=${instId}`;

          const [frData, oiData] = await Promise.all([
            fetchJson(frUrl).catch(() => null),
            fetchJson(oiUrl).catch(() => null)
          ]);

          if (frData?.data?.[0]) rate = parseFloat(frData.data[0].fundingRate);
          if (oiData?.data?.[0]) oi = parseFloat(oiData.data[0].oi);
        }

        if (active) {
          setFundingRate(rate);
          setOpenInterest(oi);
        }
      } catch (err) {
        console.error("Failed to fetch futures data:", err);
      } finally {
        if (active) {
          setFuturesLoading(false);
        }
      }
    };

    fetchFuturesData();
    const intervalId = setInterval(fetchFuturesData, 15000);

    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [selectedCoin, selectedExchange, rightSidebar]);

  // ─── Paper Trading Live Order Fill Engine ───
  useEffect(() => {
    if (!livePrice || paperOrders.length === 0) return;
    
    let orderFilled = false;
    const updatedOrders = paperOrders.map(order => {
      if (order.status !== 'PENDING' || order.symbol !== selectedCoin) return order;
      
      const hit = order.side === 'BUY' 
        ? livePrice <= order.price 
        : livePrice >= order.price;
        
      if (hit) {
        orderFilled = true;
        setPositions(prev => {
          const activePos = prev.find(p => p.symbol === selectedCoin);
          if (activePos) {
            if (activePos.type === (order.side === 'BUY' ? 'LONG' : 'SHORT')) {
              const totalQty = activePos.qty + order.qty;
              const avgEntry = ((activePos.entryPrice * activePos.qty) + (order.price * order.qty)) / totalQty;
              return prev.map(p => p.symbol === selectedCoin ? { ...p, qty: totalQty, entryPrice: avgEntry } : p);
            } else {
              if (activePos.qty > order.qty) {
                return prev.map(p => p.symbol === selectedCoin ? { ...p, qty: p.qty - order.qty } : p);
              } else if (activePos.qty === order.qty) {
                return prev.filter(p => p.symbol !== selectedCoin);
              } else {
                const newQty = order.qty - activePos.qty;
                return prev.map(p => p.symbol === selectedCoin ? { ...p, type: order.side === 'BUY' ? 'LONG' : 'SHORT', qty: newQty, entryPrice: order.price } : p);
              }
            }
          } else {
            return [...prev, {
              symbol: selectedCoin,
              type: order.side === 'BUY' ? 'LONG' : 'SHORT',
              qty: order.qty,
              entryPrice: order.price,
              pnl: 0
            }];
          }
        });
        
        if (order.side === 'BUY') {
          setBalance(b => b - (order.price * order.qty));
        } else {
          setBalance(b => b + (order.price * order.qty));
        }
        
        showToast(`Filled Limit Order: ${order.side} ${order.qty} ${getBaseAsset(selectedCoin)} @ $${order.price}`);
        return { ...order, status: 'FILLED', filledAt: Date.now() };
      }
      return order;
    });

    if (orderFilled) {
      setPaperOrders(updatedOrders);
    }
  }, [livePrice, paperOrders, selectedCoin]);

  const executeMarketOrder = (side, qty) => {
    if (!livePrice) {
      showToast("Waiting for live price...");
      return;
    }
    const cost = livePrice * qty;
    if (side === 'BUY' && cost > balance) {
      showToast("Insufficient balance!");
      return;
    }
    
    setPositions(prev => {
      const activePos = prev.find(p => p.symbol === selectedCoin);
      if (activePos) {
        if (activePos.type === (side === 'BUY' ? 'LONG' : 'SHORT')) {
          const totalQty = activePos.qty + qty;
          const avgEntry = ((activePos.entryPrice * activePos.qty) + (livePrice * qty)) / totalQty;
          return prev.map(p => p.symbol === selectedCoin ? { ...p, qty: totalQty, entryPrice: avgEntry } : p);
        } else {
          if (activePos.qty > qty) {
            return prev.map(p => p.symbol === selectedCoin ? { ...p, qty: p.qty - qty } : p);
          } else if (activePos.qty === qty) {
            return prev.filter(p => p.symbol !== selectedCoin);
          } else {
            const newQty = qty - activePos.qty;
            return prev.map(p => p.symbol === selectedCoin ? { ...p, type: side === 'BUY' ? 'LONG' : 'SHORT', qty: newQty, entryPrice: livePrice } : p);
          }
        }
      } else {
        return [...prev, {
          symbol: selectedCoin,
          type: side === 'BUY' ? 'LONG' : 'SHORT',
          qty,
          entryPrice: livePrice,
          pnl: 0
        }];
      }
    });

    if (side === 'BUY') {
      setBalance(b => b - cost);
    } else {
      setBalance(b => b + cost);
    }
    
    setPaperOrders(prev => [
      ...prev,
      { id: Date.now(), symbol: selectedCoin, side, qty, price: livePrice, type: 'MARKET', status: 'FILLED', filledAt: Date.now() }
    ]);
    showToast(`Market ${side} filled for ${qty} ${getBaseAsset(selectedCoin)} @ $${livePrice}`);
  };

  const closeActivePosition = (sym = selectedCoin) => {
    const activePos = positions.find(p => p.symbol === sym);
    if (!activePos) return;

    const currentPrice = livePrice;
    const pnl = activePos.type === 'LONG' 
      ? (currentPrice - activePos.entryPrice) * activePos.qty
      : (activePos.entryPrice - currentPrice) * activePos.qty;

    setBalance(b => b + (activePos.entryPrice * activePos.qty) + pnl);
    setPositions(prev => prev.filter(p => p.symbol !== sym));
    setPaperOrders(prev => [
      ...prev,
      { id: Date.now(), symbol: sym, side: activePos.type === 'LONG' ? 'SELL' : 'BUY', qty: activePos.qty, price: currentPrice, type: 'MARKET', status: 'FILLED', filledAt: Date.now() }
    ]);
    showToast(`Closed Position: P&L ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`);
  };

  const placeLimitOrder = (side, qty, price) => {
    const p = parseFloat(price);
    if (!p || p <= 0 || !qty || qty <= 0) {
      showToast("Please enter valid price and quantity.");
      return;
    }
    const order = {
      id: Date.now(),
      symbol: selectedCoin,
      side,
      qty,
      price: p,
      type: 'LIMIT',
      status: 'PENDING',
      createdAt: Date.now()
    };
    setPaperOrders(prev => [...prev, order]);
    showToast(`Limit ${side} Order placed for ${qty} ${getBaseAsset(selectedCoin)} @ $${p}`);
  };

  const cancelLimitOrder = (orderId) => {
    setPaperOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'CANCELLED' } : o));
    showToast("Order cancelled.");
  };

  const unrealizedPnl = useMemo(() => {
    let total = 0;
    positions.forEach(p => {
      if (p.symbol === selectedCoin && livePrice) {
        const diff = p.type === 'LONG' 
          ? livePrice - p.entryPrice 
          : p.entryPrice - livePrice;
        total += diff * p.qty;
      }
    });
    return total;
  }, [positions, selectedCoin, livePrice]);



  // ─── Code & Metrics ───
  const defaultPine = `// @ticker="SOLUSDT"\nstrategy("QuantaAI Master Hybrid", overlay=true)\n\nema_fast = ema(close, 9)\nema_slow = ema(close, 21)\nlongCondition = crossover(ema_fast, ema_slow)\n\nif (longCondition)\n    strategy.entry("Long", strategy.long)`;

  const [pineCode, setPineCode] = useState(defaultPine);
  const [pythonCode, setPythonCode] = useState(DEFAULT_PYTHON_STRATEGY);
  const [baseCode, setBaseCode] = useState(defaultPine);
  const [pineCodeHistory, setPineCodeHistory] = useState([defaultPine]);
  const [pineHistoryIndex, setPineHistoryIndex] = useState(0);
  const [pythonCodeHistory, setPythonCodeHistory] = useState([DEFAULT_PYTHON_STRATEGY]);
  const [pythonHistoryIndex, setPythonHistoryIndex] = useState(0);
  const [showDiff, setShowDiff] = useState(false);
  const [pineSubView, setPineSubView] = useState('code');
  const [pythonSubView, setPythonSubView] = useState('code');
  const [leftPanel, setLeftPanel] = useState(null);
  const [aiProvider, setAiProvider] = useState(() => {
    try {
      return localStorage.getItem('aiProvider') || 'jarvis';
    } catch {
      return 'jarvis';
    }
  });
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMessagesPine, setAiMessagesPine] = useState([]);
  const [aiMessagesPython, setAiMessagesPython] = useState([]);
  const [aiKeysReady, setAiKeysReady] = useState({ gemini: false, groq: false, jarvis: false });
  const [backendOnline, setBackendOnline] = useState(null);
  const [bounties, setBounties] = useState([]);
  const [bountyTitle, setBountyTitle] = useState('');
  const [bountyDesc, setBountyDesc] = useState('');
  const [bountyReward, setBountyReward] = useState('');
  const [selectedBounty, setSelectedBounty] = useState(null);
  const [bountySolutionText, setBountySolutionText] = useState('');

  const fetchBounties = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/bounties`);
      const data = await res.json();
      if (data.bounties) setBounties(data.bounties);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (rightSidebar === 'bounties') {
      fetchBounties();
    }
  }, [rightSidebar]);

  const handlePostBounty = async () => {
    if (!bountyTitle || !bountyDesc || !bountyReward) return showToast('Fill all fields');
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${API_BASE}/api/bounties`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: bountyTitle, description: bountyDesc, reward: bountyReward })
      });
      if (res.ok) {
        showToast('Bounty posted successfully!');
        setBountyTitle(''); setBountyDesc(''); setBountyReward('');
        fetchBounties();
      } else {
        showToast('Failed to post bounty');
      }
    } catch (e) {
      showToast('Error posting bounty');
    }
  };

  const handleSubmitSolution = async (bountyId) => {
    if (!bountySolutionText) return showToast('Enter solution');
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${API_BASE}/api/bounties/${bountyId}/solve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ solution_text: bountySolutionText })
      });
      if (res.ok) {
        showToast('Solution submitted!');
        setBountySolutionText('');
        fetchBounties();
      }
    } catch (e) {
      showToast('Error submitting solution');
    }
  };

  const handleApproveSolution = async (bountyId, solutionId, solverId, solutionText) => {
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${API_BASE}/api/bounties/${bountyId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ solution_id: solutionId, solver_id: solverId, solution_text: solutionText })
      });
      if (res.ok) {
        showToast('Solution approved!');
        fetchBounties();
      }
    } catch (e) {
      showToast('Error approving solution');
    }
  };

  const [alerts, setAlerts] = useState(() => {
    try { return JSON.parse(localStorage.getItem('satyam_ai_terminal_alerts') || localStorage.getItem('cadpro_alerts') || '[]'); } catch { return []; }
  });
  const [alertPrice, setAlertPrice] = useState('');
  const [alertCondition, setAlertCondition] = useState('above');
  const [alertTrigger, setAlertTrigger] = useState('Once only');
  const [alertExpiration, setAlertExpiration] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 16);
  });
  const [alertMessage, setAlertMessage] = useState('');
  useEffect(() => {
    setAlertMessage(`${selectedCoin} ${alertCondition} ${alertPrice || '0.00'}`);
  }, [selectedCoin, alertPrice, alertCondition]);
  const [replayIndex, setReplayIndex] = useState(null);
  const [isReplayPlaying, setIsReplayPlaying] = useState(false);
  const [replaySpeed, setReplaySpeed] = useState(1000); // play speed in ms

  useEffect(() => {
    let timer;
    if (isReplayPlaying && replayIndex !== null) {
      timer = setInterval(() => {
        setReplayIndex(prev => {
          if (prev === null) return null;
          if (prev >= fullCandlesRef.current.length - 1) {
            setIsReplayPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, replaySpeed);
    }
    return () => { if (timer) clearInterval(timer); };
  }, [isReplayPlaying, replaySpeed, replayIndex]);

  const fullCandlesRef = useRef([]);

  const [metrics, setMetrics] = useState({
    summary: { 
      netProfitVal: 1890.00, 
      netProfitPct: 18.90, 
      maxDrawdownVal: 250.00, 
      totalTrades: 15, 
      winRate: 66.67, 
      profitFactor: 4.05 
    },
    advanced: {
      grossProfit: 2510.00, 
      grossLoss: 620.00, 
      longTotal: 9, 
      longWins: 6, 
      shortTotal: 6, 
      shortWins: 4,
      wins: 10, 
      losses: 5, 
      totalTrades: 15, 
      avgWin: 251.00, 
      avgLoss: -124.00, 
      avgTrade: 126.00, 
      bestTrade: 450.00,
      worstTrade: -160.00, 
      expectancy: 126.00, 
      payoffRatio: 2.02, 
      recoveryFactor: 7.56, 
      maxWinStreak: 4,
      maxLossStreak: 1, 
      maxDrawdownPct: 2.30, 
      maxDrawdownVal: 250.00,
    },
    performance: { 
      equityChart: [
        { trade: 'Start', date: '2026-07-10 09:00', equity: 10000, pnl: 0, drawdown: 0 },
        { trade: 'T1', date: '2026-07-10 14:00', equity: 10240, pnl: 240, drawdown: 0 },
        { trade: 'T2', date: '2026-07-11 13:00', equity: 10420, pnl: 420, drawdown: 0 },
        { trade: 'T3', date: '2026-07-12 10:00', equity: 10300, pnl: 300, drawdown: 120 },
        { trade: 'T4', date: '2026-07-12 16:00', equity: 10610, pnl: 610, drawdown: 0 },
        { trade: 'T5', date: '2026-07-13 11:00', equity: 10520, pnl: 520, drawdown: 90 },
        { trade: 'T6', date: '2026-07-13 18:00', equity: 10970, pnl: 970, drawdown: 0 },
        { trade: 'T7', date: '2026-07-14 09:00', equity: 11080, pnl: 1080, drawdown: 0 },
        { trade: 'T8', date: '2026-07-14 15:00', equity: 10920, pnl: 920, drawdown: 160 },
        { trade: 'T9', date: '2026-07-14 21:00', equity: 11200, pnl: 1200, drawdown: 0 },
        { trade: 'T10', date: '2026-07-15 05:00', equity: 11060, pnl: 1060, drawdown: 140 },
        { trade: 'T11', date: '2026-07-15 12:00', equity: 11440, pnl: 1440, drawdown: 0 },
        { trade: 'T12', date: '2026-07-15 19:00', equity: 11630, pnl: 1630, drawdown: 0 },
        { trade: 'T13', date: '2026-07-16 02:00', equity: 11520, pnl: 1520, drawdown: 110 },
        { trade: 'T14', date: '2026-07-16 09:00', equity: 11760, pnl: 1760, drawdown: 0 },
        { trade: 'T15', date: '2026-07-16 14:00', equity: 11890, pnl: 1890, drawdown: 0 }
      ] 
    },
    trades: [
      { id: '1', type: 'Long Entry', date: '2026-07-10 10:00', price: '72.50', profit: '0.00' },
      { id: '1', type: 'Long Exit', date: '2026-07-10 14:00', price: '74.90', profit: '240.00' },
      { id: '2', type: 'Short Entry', date: '2026-07-11 09:00', price: '75.20', profit: '0.00' },
      { id: '2', type: 'Short Exit', date: '2026-07-11 13:00', price: '73.40', profit: '180.00' },
      { id: '3', type: 'Long Entry', date: '2026-07-11 20:00', price: '73.00', profit: '0.00' },
      { id: '3', type: 'Long Exit', date: '2026-07-12 10:00', price: '71.80', profit: '-120.00' },
      { id: '4', type: 'Long Entry', date: '2026-07-12 11:00', price: '72.00', profit: '0.00' },
      { id: '4', type: 'Long Exit', date: '2026-07-12 16:00', price: '75.10', profit: '310.00' },
      { id: '5', type: 'Short Entry', date: '2026-07-13 04:00', price: '75.50', profit: '0.00' },
      { id: '5', type: 'Short Exit', date: '2026-07-13 11:00', price: '76.40', profit: '-90.00' },
      { id: '6', type: 'Long Entry', date: '2026-07-13 13:00', price: '76.00', profit: '0.00' },
      { id: '6', type: 'Long Exit', date: '2026-07-13 18:00', price: '80.50', profit: '450.00' },
      { id: '7', type: 'Short Entry', date: '2026-07-14 02:00', price: '80.20', profit: '0.00' },
      { id: '7', type: 'Short Exit', date: '2026-07-14 09:00', price: '79.10', profit: '110.00' },
      { id: '8', type: 'Long Entry', date: '2026-07-14 11:00', price: '79.50', profit: '0.00' },
      { id: '8', type: 'Long Exit', date: '2026-07-14 15:00', price: '77.90', profit: '-160.00' },
      { id: '9', type: 'Short Entry', date: '2026-07-14 17:00', price: '78.20', profit: '0.00' },
      { id: '9', type: 'Short Exit', date: '2026-07-14 21:00', price: '75.40', profit: '280.00' },
      { id: '10', type: 'Long Entry', date: '2026-07-15 01:00', price: '75.80', profit: '0.00' },
      { id: '10', type: 'Long Exit', date: '2026-07-15 05:00', price: '74.40', profit: '-140.00' },
      { id: '11', type: 'Long Entry', date: '2026-07-15 08:00', price: '74.50', profit: '0.00' },
      { id: '11', type: 'Long Exit', date: '2026-07-15 12:00', price: '78.30', profit: '380.00' },
      { id: '12', type: 'Short Entry', date: '2026-07-15 14:00', price: '78.50', profit: '0.00' },
      { id: '12', type: 'Short Exit', date: '2026-07-15 19:00', price: '76.60', profit: '190.00' },
      { id: '13', type: 'Long Entry', date: '2026-07-15 22:00', price: '76.80', profit: '0.00' },
      { id: '13', type: 'Long Exit', date: '2026-07-16 02:00', price: '75.70', profit: '-110.00' },
      { id: '14', type: 'Long Entry', date: '2026-07-16 04:00', price: '76.00', profit: '0.00' },
      { id: '14', type: 'Long Exit', date: '2026-07-16 09:00', price: '78.20', profit: '220.00' },
      { id: '15', type: 'Short Entry', date: '2026-07-16 11:00', price: '78.50', profit: '0.00' },
      { id: '15', type: 'Short Exit', date: '2026-07-16 14:00', price: '77.00', profit: '150.00' }
    ]
  });
  const [lastBacktestCode, setLastBacktestCode] = useState('');
  const [lastBacktestMode, setLastBacktestMode] = useState('');

  // ─── Helper Functions ───
  const showToast = (msg) => { setToastMsg(msg); setTimeout(() => setToastMsg(''), 3000); };

  const handleExecuteArbitrage = (opp) => {
    // Virtual Buy
    const buyPos = {
      id: Date.now().toString() + '-buy',
      symbol: opp.coin,
      type: 'MARKET',
      side: 'BUY',
      qty: opp.maxQty.toFixed(4),
      entryPrice: opp.buyPrice,
      leverage: 1,
      unrealizedPnl: 0,
      exchange: opp.buyEx,
      time: new Date().toLocaleTimeString()
    };
    
    // Virtual Sell
    const sellPos = {
      id: Date.now().toString() + '-sell',
      symbol: opp.coin,
      type: 'MARKET',
      side: 'SELL',
      qty: opp.maxQty.toFixed(4),
      entryPrice: opp.sellPrice,
      leverage: 1,
      unrealizedPnl: 0,
      exchange: opp.sellEx,
      time: new Date().toLocaleTimeString()
    };
    
    setPositions(prev => [buyPos, sellPos, ...prev]);
    showToast(`Arbitrage executed! Locked $${opp.netProfit.toFixed(2)} on ${opp.coin}`);
  };

  const openModal = (title, desc, type = 'info', payload = null) => setActiveModal({ title, desc, type, payload });
  const closeModal = () => setActiveModal(null);

  const getSubView = () => (editorMode === 'pine' ? pineSubView : pythonSubView);
  const setSubView = (v) => (editorMode === 'pine' ? setPineSubView(v) : setPythonSubView(v));
  const getAiMessages = () => (editorMode === 'pine' ? aiMessagesPine : aiMessagesPython);

  const appendAiMessage = (msg) => {
    if (editorMode === 'pine') setAiMessagesPine((prev) => [...prev, msg]);
    else setAiMessagesPython((prev) => [...prev, msg]);
  };

  const openLeftPanel = (panel) => {
    setLeftPanel((p) => (p === panel ? null : panel));
    if (panel === 'ai') {
      setIsEditorOpen(true);
      setSubView('ai');
    }
  };

  const openEditor = (mode = editorMode, sub = 'code') => {
    setIsEditorOpen(true);
    setEditorMode(mode);
    if (mode === 'pine') {
      setPineSubView(sub);
      setBaseCode(pineCode);
    } else {
      setPythonSubView(sub);
      setBaseCode(pythonCode);
    }
    setShowDiff(false);
  };

  const persistAlerts = (list) => {
    setAlerts(list);
    localStorage.setItem('satyam_ai_terminal_alerts', JSON.stringify(list));
  };

  const addPriceAlert = () => {
    const price = parseFloat(alertPrice);
    if (!Number.isFinite(price) || price <= 0) {
      showToast('Enter a valid alert price');
      return;
    }
    const item = {
      id: Date.now(),
      symbol: selectedCoin,
      exchange: selectedExchange,
      price,
      condition: alertCondition,
    };
    persistAlerts([...alerts, item]);
    setAlertPrice('');
    showToast(`🔔 Alert set: ${selectedCoin} ${alertCondition} ${price}`);
  };

  const removeAlert = (id) => {
    persistAlerts(alerts.filter((a) => a.id !== id));
    showToast('Alert removed');
  };

  const handlePredictClick = () => {
    if (!allCandles || allCandles.length < 50) {
      showToast('Not enough data to predict. Need at least 50 candles.');
      return;
    }
    
    setIsAutoPredictEnabled(prev => {
      const nextState = !prev;
      if (nextState) {
        showToast('Auto-Prediction Enabled');
        // Generate immediate first prediction
        const intSeconds = intervalToSeconds(chartInterval);
        const newPrediction = predictNextCandle(allCandles, intSeconds);
        if (newPrediction) {
          setPredictedCandle(newPrediction);
          const histItem = {
            time: newPrediction.time,
            predictedUp: newPrediction.predictedUp,
            predictedClose: newPrediction.close,
            realClose: null,
            isHit: null,
          };
          setPredictionHistory(history => [...history, histItem]);
        }
      } else {
        showToast('Auto-Prediction Disabled');
        setPredictedCandle(null);
      }
      return nextState;
    });
  };

  // Check prediction results whenever candles update
  useEffect(() => {
    if (!allCandles || allCandles.length === 0 || predictionHistory.length === 0) return;
    
    const lastCandle = allCandles[allCandles.length - 1];
    let justValidated = false;
    
    setPredictionHistory(prev => {
      let updated = false;
      const nextHist = prev.map(item => {
        if (item.realClose === null && lastCandle.time >= item.time) {
          const actualCandle = allCandles.find(c => c.time === item.time) || lastCandle;
          const realUp = actualCandle.close >= actualCandle.open;
          const isHit = realUp === item.predictedUp;
          updated = true;
          justValidated = true;
          return { ...item, realClose: actualCandle.close, realUp, isHit };
        }
        return item;
      });
      return updated ? nextHist : prev;
    });

    if (predictedCandle && lastCandle.time >= predictedCandle.time) {
       // Clear old prediction
       setPredictedCandle(null);
       
       // Loop auto-predict
       if (isAutoPredictEnabled) {
         setTimeout(() => {
           const intSeconds = intervalToSeconds(chartInterval);
           const newPrediction = predictNextCandle(allCandles, intSeconds);
           if (newPrediction) {
             setPredictedCandle(newPrediction);
             const histItem = {
               time: newPrediction.time,
               predictedUp: newPrediction.predictedUp,
               predictedClose: newPrediction.close,
               realClose: null,
               isHit: null,
             };
             setPredictionHistory(prev => [...prev, histItem]);
           }
         }, 500); // slight delay to allow chart refresh
       }
    } else if (isAutoPredictEnabled && !predictedCandle && allCandles.length > 50) {
      // Instantly start/restart auto-predict if it's enabled but no candle exists (e.g., after timeframe switch)
      const intSeconds = intervalToSeconds(chartInterval);
      const newPrediction = predictNextCandle(allCandles, intSeconds);
      if (newPrediction) {
        setPredictedCandle(newPrediction);
        const histItem = {
          time: newPrediction.time,
          predictedUp: newPrediction.predictedUp,
          predictedClose: newPrediction.close,
          realClose: null,
          isHit: null,
        };
        setPredictionHistory(prev => [...prev, histItem]);
      }
    }
  }, [allCandles, predictedCandle, predictionHistory, isAutoPredictEnabled, chartInterval]);

  // Handle Canvas2D prediction rendering
  useEffect(() => {
    if (renderEngine !== 'canvas2d' || !chartInstance.current) return;
    
    if (predictedCandle) {
      if (!predictionSeriesRef.current) {
        predictionSeriesRef.current = chartInstance.current.addCandlestickSeries({
          upColor: 'rgba(76, 175, 80, 0.4)',
          downColor: 'rgba(244, 67, 54, 0.4)',
          borderUpColor: 'rgba(76, 175, 80, 0.6)',
          borderDownColor: 'rgba(244, 67, 54, 0.6)',
          wickUpColor: 'rgba(76, 175, 80, 0.6)',
          wickDownColor: 'rgba(244, 67, 54, 0.6)',
          priceLineVisible: false,
          lastValueVisible: false,
        });
      }
      predictionSeriesRef.current.setData([predictedCandle]);
    } else {
      if (predictionSeriesRef.current) {
        chartInstance.current.removeSeries(predictionSeriesRef.current);
        predictionSeriesRef.current = null;
      }
    }
  }, [predictedCandle, renderEngine]);


  const injectIndicator = (ind, targetMode = editorMode) => {
    setEditorMode(targetMode);
    const snippet = targetMode === 'pine' ? ind.pine : ind.python;
    const current = targetMode === 'pine' ? pineCode : pythonCode;
    const merged = `${current}\n\n// --- ${ind.name} ---\n${snippet}`;
    if (targetMode === 'pine') {
      setPineCode(merged);
      const newHist = pineCodeHistory.slice(0, pineHistoryIndex + 1);
      newHist.push(merged);
      setPineCodeHistory(newHist);
      setPineHistoryIndex(newHist.length - 1);
    } else {
      setPythonCode(merged);
      const newHist = pythonCodeHistory.slice(0, pythonHistoryIndex + 1);
      newHist.push(merged);
      setPythonCodeHistory(newHist);
      setPythonHistoryIndex(newHist.length - 1);
    }
    setIsEditorOpen(true);
    if (targetMode === 'pine') setPineSubView('code');
    else setPythonSubView('code');
    showToast(`Added ${ind.name} to ${targetMode === 'pine' ? 'Pine' : 'Python'}`);
  };

  const downloadReportData = () => {
    if (!metrics.trades?.length) {
      showToast('No trades to export — run backtest first');
      return;
    }
    exportTradesCsv(metrics.trades, selectedCoin);
    showToast('📥 Trades CSV downloaded');
  };

  const publishStrategy = () => {
    const code = editorMode === 'pine' ? pineCode : pythonCode;
    downloadStrategyFile(code, editorMode, selectedCoin);
    showToast('📤 Strategy file downloaded');
  };

  const clearAllDrawings = () => {
    setDrawings([]);
    showToast('Drawings cleared');
  };
  const loadDeepHistory = async () => {
    if (isLoadingMoreRef.current) {
      showToast('History already loading...');
      return;
    }
    isLoadingMoreRef.current = true;
    showToast('⏳ Loading up to 6 years of history...');
    try {
      const sixYearsAgoTs = Math.floor(Date.now() / 1000) - SIX_YEARS_SECONDS;
      let guard = 0;
      while (
        allCandlesRef.current.length &&
        allCandlesRef.current[0].time > sixYearsAgoTs &&
        guard < 1000
      ) {
        const oldestTime = allCandlesRef.current[0].time;
        const older = await fetchCandles(1000, oldestTime);
        if (!older.length) break;
        allCandlesRef.current = mergeCandles(older, allCandlesRef.current);
        setAllCandles([...allCandlesRef.current]);
        if (guard % 5 === 0) saveCandleCache(selectedExchange, selectedCoin, chartInterval, allCandlesRef.current);
        if (older.length < 1000) break;
        guard += 1;
      }
      saveCandleCache(selectedExchange, selectedCoin, chartInterval, allCandlesRef.current);
      showToast(guard >= 1000 ? '✅ Loaded max available history' : '✅ Full history loaded');
    } catch (e) {
      showToast('⚠️ Could not load full history — exchange may not have older data');
    } finally {
      isLoadingMoreRef.current = false;
    }
  };

  const applyTimeRange = (rangeType) => {
    if (!chartInstance.current || allCandles.length === 0) return;
    const timeScale = chartInstance.current.timeScale();
    const latestTime = allCandles[allCandles.length - 1].time;
    
    let fromTime = latestTime;
    const oneDay = 24 * 60 * 60; // seconds

    switch (rangeType) {
      case '1D':
        fromTime = latestTime - oneDay;
        break;
      case '5D':
        fromTime = latestTime - 5 * oneDay;
        break;
      case '1M':
        fromTime = latestTime - 30 * oneDay;
        break;
      case '3M':
        fromTime = latestTime - 90 * oneDay;
        break;
      case '6M':
        fromTime = latestTime - 180 * oneDay;
        break;
      case 'YTD':
        const currentYear = new Date().getFullYear();
        fromTime = Math.floor(new Date(currentYear, 0, 1).getTime() / 1000);
        break;
      case '1Y':
        fromTime = latestTime - 365 * oneDay;
        break;
      case '5Y':
        fromTime = latestTime - 5 * 365 * oneDay;
        break;
      case 'All':
        timeScale.fitContent();
        showToast("Fitting all loaded history...");
        return;
      default:
        return;
    }

    const firstTime = allCandles[0].time;
    if (fromTime < firstTime) {
      fromTime = firstTime;
      showToast("Loading deeper history...");
      loadDeepHistory();
    }

    try {
      timeScale.setVisibleRange({ from: fromTime, to: latestTime });
    } catch (e) {
      timeScale.fitContent();
    }
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      document.documentElement.requestFullscreen?.().catch(() => {});
    }
  };
  const takeRealScreenshot = async () => {
    try {
      // Method 1: WebGPU / WebGL — grab GPU canvas directly
      if (renderEngine === 'webgpu' || renderEngine === 'webgl') {
        const container = chartContainerRef.current || chartRef.current;
        const gpuCanvas = container?.querySelector('canvas');
        if (gpuCanvas) {
          const link = document.createElement('a');
          link.download = `${selectedCoin}_Chart_${renderEngine.toUpperCase()}.png`;
          link.href = gpuCanvas.toDataURL('image/png');
          link.click();
          showToast("📸 Screenshot Downloaded!");
          return;
        }
      }

      // Method 2: Canvas2D — use Lightweight Charts built-in takeScreenshot
      if (chartInstance.current && typeof chartInstance.current.takeScreenshot === 'function') {
        const link = document.createElement('a');
        link.download = `${selectedCoin}_Chart.png`;
        link.href = chartInstance.current.takeScreenshot().toDataURL('image/png');
        link.click();
        showToast("📸 Screenshot Downloaded!");
        return;
      }

      // Method 3: Fallback — html2canvas DOM capture
      if (chartContainerRef.current) {
        const canvas = await html2canvas(chartContainerRef.current, {
          backgroundColor: darkMode ? '#131722' : '#ffffff',
          useCORS: true,
          allowTaint: true,
          ignoreElements: (element) => element.classList.contains('no-screenshot')
        });
        const link = document.createElement('a');
        link.download = `${selectedCoin}_Chart.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        showToast("📸 Screenshot Downloaded!");
        return;
      }

      showToast("❌ No chart available for screenshot");
    } catch (err) {
      console.error("Screenshot failed:", err);
      showToast("❌ Screenshot Failed: " + (err.message || ''));
    }
  };
  const downloadReportScreenshot = () => downloadReportData();

  const normalizeCandle = useCallback((c) => {
    const rawTime = typeof c.time === 'string'
      ? Math.floor(new Date(c.time).getTime() / 1000)
      : Number(c.time);
    const validTime = rawTime > 10000000000 ? Math.floor(rawTime / 1000) : rawTime;

    return {
      time: validTime,
      open: parseFloat(c.open),
      high: parseFloat(c.high),
      low: parseFloat(c.low),
      close: parseFloat(c.close),
      volume: parseFloat(c.volume || 0),
    };
  }, []);

  const toSeriesPoint = useCallback((c) => {
    if (['Candles', 'Bars', 'Hollow Candles', 'High-Low', 'Volume Candles', 'Histogram'].includes(chartStyle)) return c;
    if (chartStyle === 'Heikin-Ashi') {
      // For live HA tick: approximate using the last 2 candles from ref
      const candles = allCandlesRef.current;
      const idx = candles.findIndex(ca => ca.time === c.time);
      if (idx >= 1) {
        const ha = toHeikinAshi(candles.slice(Math.max(0, idx - 1), idx + 1));
        return ha[ha.length - 1] || c;
      }
      return c;
    }
    return { time: c.time, value: c.close };
  }, [chartStyle]);

  const visibleRangeStorageKey = `${selectedExchange}:${selectedCoin}:${chartInterval}:visible-range`;

  const isAtRealtimeEdge = useCallback(() => {
    if (!chartInstance.current || !candleSeries.current) return true;
    try {
      const range = chartInstance.current.timeScale().getVisibleLogicalRange();
      if (!range) return true;
      const barsInfo = candleSeries.current.barsInLogicalRange(range);
      return !barsInfo || barsInfo.barsAfter < 3;
    } catch (e) {
      return true;
    }
  }, []);

  const upsertLiveCandle = useCallback((liveCandle) => {
    if (replayMode) return;
    if (!Number.isFinite(liveCandle.time) || !Number.isFinite(liveCandle.close)) return;
    const shouldFollowLive = isAtRealtimeEdge();
    const historyCap = getHistoryCandleCap(chartInterval);

    const candles = allCandlesRef.current;
    if (!candles || candles.length === 0) return;

    const last = candles[candles.length - 1];
    let nextCandles;
    let isHistoricalUpdate = false; 

    if (liveCandle.time === last.time) {
      nextCandles = [...candles.slice(0, -1), liveCandle];
    } else if (liveCandle.time > last.time) {
      nextCandles = [...candles, liveCandle].slice(-historyCap);
    } else {
      isHistoricalUpdate = true;
      const idx = candles.findIndex(c => c.time === liveCandle.time);
      if (idx === -1) return;
      nextCandles = [...candles];
      nextCandles[idx] = liveCandle;
    }

    allCandlesRef.current = nextCandles;
    latestCandleRef.current = nextCandles[nextCandles.length - 1];
    setAllCandles(nextCandles);

    const now = Date.now();
    if (now - lastCacheSaveRef.current > 20000) {
      lastCacheSaveRef.current = now;
      saveCandleCache(selectedExchange, selectedCoin, chartInterval, nextCandles);
    }

    if (isHistoricalUpdate) {
      let fullData;
      if (chartStyle === 'Heikin-Ashi') {
        fullData = toHeikinAshi(nextCandles);
      } else if (chartStyle === 'Candles' || chartStyle === 'Bars') {
        fullData = nextCandles;
      } else {
        fullData = nextCandles.map(c => ({ time: c.time, value: c.close }));
      }
      candleSeries.current?.setData(fullData);
      volumeSeries.current?.setData(nextCandles.map(c => ({ 
        time: c.time, 
        value: c.volume || 0, 
        color: c.close >= c.open ? 'rgba(8, 153, 129, 0.5)' : 'rgba(242, 54, 69, 0.5)' 
      })));
    } else {
      candleSeries.current?.update(toSeriesPoint(liveCandle));
      volumeSeries.current?.update({
        time: liveCandle.time,
        value: liveCandle.volume || 0,
        color: liveCandle.close >= liveCandle.open ? 'rgba(8, 153, 129, 0.5)' : 'rgba(242, 54, 69, 0.5)'
      });
      skipNextFullRedrawRef.current = true;
    }
    
    if (shouldFollowLive) chartInstance.current?.timeScale().scrollToRealTime();
  }, [isAtRealtimeEdge, toSeriesPoint, chartStyle, replayMode, chartInterval, selectedExchange, selectedCoin]);

  const fetchCandles = useCallback(async (limit = 1000, before = null) => {
    try {
      return await fetchExchangeCandles(selectedExchange, selectedCoin, chartInterval, limit, before);
    } catch (exchangeError) {
      if (selectedExchange !== 'binance') throw exchangeError;

      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 8000);
      const beforeParam = before ? `&before=${before}` : '';

      try {
        const res = await fetch(
          `${API_BASE}/candles/${selectedCoin}/${chartInterval}?limit=${limit}${beforeParam}`,
          { signal: controller.signal }
        );
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        return data.candles.map(normalizeCandle);
      } finally {
        window.clearTimeout(timeoutId);
      }
    }
  }, [chartInterval, normalizeCandle, selectedCoin, selectedExchange]);

  const fetchInitialHistory = useCallback(async (onProgress) => {
    let before = null;
    let history = [];
    let savedRangeFrom = null;
    const cap = getHistoryCandleCap(chartInterval);

    try {
      const savedRange = JSON.parse(localStorage.getItem(visibleRangeStorageKey));
      if (Number.isFinite(savedRange?.from)) savedRangeFrom = savedRange.from;
    } catch (e) {}

    const firstBatch = await fetchCandles(CANDLE_BATCH_SIZE, before);
    if (!firstBatch.length) return [];
    history = mergeCandles(firstBatch, history);
    before = firstBatch[0].time;
    if (onProgress) onProgress(history.slice(-cap));

    if (firstBatch.length >= CANDLE_BATCH_SIZE) {
      for (let i = 1; i < INITIAL_HISTORY_BATCHES; i += 1) {
        const batch = await fetchCandles(CANDLE_BATCH_SIZE, before);
        if (!batch.length) break;
        history = mergeCandles(batch, history);
        before = batch[0].time;
        if (onProgress) onProgress(history.slice(-cap));
        if (batch.length < CANDLE_BATCH_SIZE) break;
      }

      while (
        savedRangeFrom &&
        history.length &&
        history[0].time > savedRangeFrom &&
        history.length < cap
      ) {
        const batch = await fetchCandles(CANDLE_BATCH_SIZE, history[0].time);
        if (!batch.length) break;
        history = mergeCandles(batch, history);
        if (onProgress) onProgress(history.slice(-cap));
        if (batch.length < CANDLE_BATCH_SIZE) break;
      }
    }

    return history.slice(-cap);
  }, [fetchCandles, visibleRangeStorageKey, chartInterval]);

  useEffect(() => {
    const applyCoins = (coins) => {
      const list = Array.isArray(coins)
        ? [...new Set(coins.map((c) => String(c).toUpperCase()))].sort()
        : [];
      binanceCoinSetRef.current = new Set(list);
      setBinanceCoins(list);
      setCoinsLoading(false);
      if (list.length && !list.includes(selectedCoin)) {
        const preferred = list.includes('BTCUSDT') ? 'BTCUSDT' : list.includes('SOLUSDT') ? 'SOLUSDT' : list[0];
        setSelectedCoin(preferred);
      }
    };

    setCoinsLoading(true);

    Promise.all([
      selectedExchange === 'binance'
        ? fetch(`${API_BASE}/coins`).then((r) => r.json()).catch(() => ({ coins: [] }))
        : Promise.resolve({ coins: [] }),
      fetchExchangeSymbols(selectedExchange).catch(() => []),
    ]).then(([backendData, exchangeList]) => {
      const merged = [...(backendData?.coins || []), ...(exchangeList || [])];
      if (merged.length) {
        applyCoins(merged);
      } else {
        const fallback = (() => {
          const fallbacks = {
            binance: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'LINKUSDT', 'TRXUSDT', 'DOTUSDT', 'MATICUSDT', 'LTCUSDT', 'ATOMUSDT', 'UNIUSDT', 'SHIBUSDT', 'OPUSDT', 'ARBUSDT', 'NEARUSDT', 'INJUSDT', 'AAVEUSDT', 'SUIUSDT', 'PEPEUSDT', 'RUNEUSDT', 'ALGOUSDT', 'FILUSDT', 'APTUSDT', 'SEIUSDT', 'TAOUSDT'],
            okx: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'DOGEUSDT', 'ADAUSDT', 'LINKUSDT', 'TRXUSDT', 'DOTUSDT', 'MATICUSDT'],
            kucoin: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'DOGEUSDT', 'ADAUSDT', 'LINKUSDT', 'TRXUSDT', 'DOTUSDT'],
            bybit: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'DOGEUSDT', 'ADAUSDT', 'LINKUSDT', 'TRXUSDT', 'DOTUSDT'],
            kraken: ['BTCUSD', 'ETHUSD', 'SOLUSD', 'XRPUSD', 'DOGEUSD', 'ADAUSD', 'LINKUSD'],
            gate: ['BTC_USDT', 'ETH_USDT', 'SOL_USDT', 'XRP_USDT', 'DOGE_USDT', 'ADA_USDT', 'LINK_USDT'],
            mexc: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'DOGEUSDT', 'ADAUSDT', 'LINKUSDT'],
          };
          return fallbacks[selectedExchange] || fallbacks.binance;
        })();
        applyCoins(fallback);
      }
    });
  }, [selectedExchange]);

  useEffect(() => {
    localStorage.setItem('exchange', selectedExchange);
  }, [selectedExchange]);

  useEffect(() => {
    localStorage.setItem('aiProvider', aiProvider);
  }, [aiProvider]);

  const checkBackend = useCallback(async () => {
    try {
      const controller = new AbortController();
      const t = window.setTimeout(() => controller.abort(), 4000);
      const res = await fetch(`${API_BASE}/health`, { signal: controller.signal });
      window.clearTimeout(t);
      if (!res.ok) throw new Error('health failed');
      setBackendOnline(true);
      const aiRes = await fetch(`${API_BASE}/ai/status`);
      const data = await aiRes.json();
      setAiKeysReady({ gemini: !!data.gemini, groq: !!data.groq, jarvis: !!data.jarvis });
      return true;
    } catch {
      setBackendOnline(false);
      setAiKeysReady({ gemini: false, groq: false, jarvis: false });
      return false;
    }
  }, []);

  useEffect(() => {
    checkBackend();
    const id = window.setInterval(checkBackend, 15000);
    return () => window.clearInterval(id);
  }, [checkBackend]);

  useEffect(() => {
    if (!livePrice || !alerts.length) return;
    alerts.forEach((a) => {
      if (a.symbol !== selectedCoin || a.exchange !== selectedExchange) return;
      const hit = a.condition === 'above' ? livePrice >= a.price : livePrice <= a.price;
      if (hit) showToast(`🔔 Alert: ${a.symbol} ${a.condition} $${a.price}`);
    });
  }, [livePrice, alerts, selectedCoin, selectedExchange]);

  useEffect(() => {
    if (!replayMode) return;
    fullCandlesRef.current = [...allCandlesRef.current];
    const len = fullCandlesRef.current.length;
    setReplayIndex(len > 10 ? len - 1 : len - 1);
    showToast('⏪ Replay: drag slider on chart');
  }, [replayMode]);

  useEffect(() => {
    if (replayMode) return;
    const full = fullCandlesRef.current;
    if (!full.length) return;
    setAllCandles(full);
    allCandlesRef.current = [...full];
    if (candleSeries.current) {
      candleSeries.current.setData(
        chartStyle === 'Candles' ? full : full.map((c) => ({ time: c.time, value: c.close }))
      );
      volumeSeries.current?.setData(full.map((c) => ({
        time: c.time,
        value: c.volume || 0,
        color: c.close >= c.open ? 'rgba(8, 153, 129, 0.5)' : 'rgba(242, 54, 69, 0.5)',
      })));
    }
  }, [replayMode, chartStyle]);

  useEffect(() => {
    if (!replayMode || replayIndex == null) return;
    const full = fullCandlesRef.current;
    if (!full.length) return;
    const slice = full.slice(0, Math.min(replayIndex + 1, full.length));
    setAllCandles(slice);
    if (slice.length) {
      setLivePrice(slice[slice.length - 1].close);
      if (candleSeries.current) {
        candleSeries.current.setData(
          chartStyle === 'Candles' ? slice : slice.map((c) => ({ time: c.time, value: c.close }))
        );
        volumeSeries.current?.setData(slice.map((c) => ({
          time: c.time,
          value: c.volume || 0,
          color: c.close >= c.open ? 'rgba(8, 153, 129, 0.5)' : 'rgba(242, 54, 69, 0.5)',
        })));
      }
    }
  }, [replayIndex, replayMode, chartStyle]);

  useEffect(() => {
    let disposed = false;
    let unsubWs = null;
    let connectTimeout = null;
    const myGeneration = ++fetchGenerationRef.current;

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
      if (connectTimeout) clearTimeout(connectTimeout);
      if (unsubWs) unsubWs();
    };
  }, [selectedCoin, chartInterval, selectedExchange, fetchCandles, fetchInitialHistory, upsertLiveCandle]);

  useEffect(() => {
    if (!chartRef.current || renderEngine !== 'canvas2d') return;
    const chart = createChart(chartRef.current, {
      width: chartRef.current.clientWidth,
      height: chartRef.current.clientHeight || 300,
      layout: {
        background: { color: darkMode ? '#0d1117' : '#ffffff' },
        textColor: darkMode ? '#c9d1d9' : '#131722',
        fontSize: 11,
        fontFamily: "'Inter', 'SF Pro Display', -apple-system, sans-serif",
      },
      localization: {
        timeFormatter: (businessDayOrTimestamp) => {
          if (!businessDayOrTimestamp) return '';
          const d = new Date((businessDayOrTimestamp + timezoneOffset) * 1000);
          return `${d.getUTCDate()} ${d.toLocaleString('default', { month: 'short', timeZone: 'UTC' })} '${d.getUTCFullYear().toString().substring(2)} ${d.getUTCHours().toString().padStart(2, '0')}:${d.getUTCMinutes().toString().padStart(2, '0')}:${d.getUTCSeconds().toString().padStart(2, '0')}`;
        }
      },
      watermark: {
        visible: false,
      },
      grid: {
        vertLines: { color: darkMode ? 'rgba(42,46,57,0.6)' : '#e0e3eb', style: 1 },
        horzLines: { color: darkMode ? 'rgba(42,46,57,0.6)' : '#e0e3eb', style: 1 },
      },
      crosshair: {
        mode: 1,
        vertLine: {
          color: darkMode ? 'rgba(180,190,210,0.4)' : 'rgba(100,110,130,0.4)',
          width: 1,
          style: 3,
          labelBackgroundColor: darkMode ? '#2a2e39' : '#e0e3eb',
        },
        horzLine: {
          color: darkMode ? 'rgba(180,190,210,0.4)' : 'rgba(100,110,130,0.4)',
          width: 1,
          style: 3,
          labelBackgroundColor: darkMode ? '#2a2e39' : '#e0e3eb',
        },
      },
      timeScale: {
        borderColor: darkMode ? 'rgba(42,46,57,0.8)' : '#e0e3eb',
        rightOffset: 20,
        barSpacing: isMobile ? 5 : 10,
        minBarSpacing: 2,
        timeVisible: true,
        secondsVisible: chartInterval === '1m',
        tickMarkFormatter: (time, tickMarkType, locale) => {
          const d = new Date((time + timezoneOffset) * 1000);
          if (tickMarkType === 1 || tickMarkType === 2) { 
             return `${d.getUTCDate()} ${d.toLocaleString('default', { month: 'short', timeZone: 'UTC' })}`;
          }
          return `${d.getUTCHours().toString().padStart(2, '0')}:${d.getUTCMinutes().toString().padStart(2, '0')}`;
        },
      },
      rightPriceScale: {
        borderColor: darkMode ? 'rgba(42,46,57,0.8)' : '#e0e3eb',
        scaleMargins: { top: 0.08, bottom: 0.12 },
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
      handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: true },
    });

    const volSeries = chart.addHistogramSeries({
      color: 'rgba(8,153,129,0.35)',
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
      lastValueVisible: false,
      priceLineVisible: false,
    });

    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.84, bottom: 0 },
    });

    chartInstance.current = chart; 
    volumeSeries.current = volSeries;
    setChartCreated(true);

    chart.subscribeCrosshairMove((param) => {
      if (param.time) {
        updateCrosshairDOM(param.time);
      } else {
        updateCrosshairDOM(null);
      }
    });

    // Old click handler removed to avoid conflicts
    const ro = new ResizeObserver(entries => { 
      if (entries[0] && chartInstance.current) {
        chartInstance.current.applyOptions({ width: entries[0].contentRect.width, height: entries[0].contentRect.height }); 
      }
    });
    ro.observe(chartRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartInstance.current = null;
      candleSeries.current = null;
      volumeSeries.current = null;
      setChartCreated(false);
    };
  }, [renderEngine, timezoneOffset]);


  useEffect(() => {
    if (!chartCreated || !chartInstance.current) return;

    if (candleSeries.current) {
      chartInstance.current.removeSeries(candleSeries.current);
      candleSeries.current = null;
    }

    let series;
    if (['Candles', 'Heikin-Ashi', 'Volume Candles'].includes(chartStyle)) {
      series = chartInstance.current.addCandlestickSeries({ upColor: '#26a69a', downColor: '#ef5350', borderUpColor: '#26a69a', borderDownColor: '#ef5350', wickUpColor: 'rgba(38,166,154,0.7)', wickDownColor: 'rgba(239,83,80,0.7)' });
    } else if (chartStyle === 'Hollow Candles') {
      series = chartInstance.current.addCandlestickSeries({ upColor: 'transparent', downColor: '#ef5350', borderUpColor: '#26a69a', borderDownColor: '#ef5350', wickUpColor: '#26a69a', wickDownColor: '#ef5350' });
    } else if (chartStyle === 'Bars' || chartStyle === 'High-Low') {
      series = chartInstance.current.addBarSeries({ upColor: '#26a69a', downColor: '#ef5350' });
    } else if (chartStyle === 'Line') {
      series = chartInstance.current.addLineSeries({ color: '#2962ff', lineWidth: 2 });
    } else if (chartStyle === 'Step Line') {
      series = chartInstance.current.addLineSeries({ color: '#2962ff', lineWidth: 2, lineType: 1 });
    } else if (chartStyle === 'Baseline') {
      series = chartInstance.current.addBaselineSeries({ baseValue: { type: 'price', price: allCandlesRef.current[0]?.close || 0 }, topFillColor1: 'rgba(38,166,154,0.28)', topFillColor2: 'rgba(38,166,154,0.05)', topLineColor: '#26a69a', bottomFillColor1: 'rgba(239,83,80,0.05)', bottomFillColor2: 'rgba(239,83,80,0.28)', bottomLineColor: '#ef5350' });
    } else if (chartStyle === 'Histogram') {
      series = chartInstance.current.addHistogramSeries({ color: '#26a69a' });
    } else {
      series = chartInstance.current.addAreaSeries({ lineColor: '#7C5CFF', topColor: 'rgba(124,92,255,0.18)', bottomColor: 'rgba(124,92,255,0.0)', lineWidth: 2 });
    }
    
    candleSeries.current = series;

    if (allCandlesRef.current.length > 0) {
      let data = allCandlesRef.current;
      if (chartStyle === 'Heikin-Ashi') data = toHeikinAshi(data);
      else if (['Line', 'Area', 'Step Line', 'Baseline'].includes(chartStyle)) {
        data = data.map(c => ({ time: c.time, value: c.close }));
      } else if (chartStyle === 'Histogram') {
        data = data.map(c => ({ time: c.time, value: c.close, color: c.close >= c.open ? '#26a69a' : '#ef5350' }));
      }
      series.setData(data);
    }
  }, [chartStyle, chartCreated]);

  const loadOlderData = useCallback(async () => {
    if (isLoadingMoreRef.current || !allCandlesRef.current.length) return;
    const myGeneration = fetchGenerationRef.current;
    isLoadingMoreRef.current = true;
    setIsLoadingOlderData(true);
    try {
      const oldestTime = allCandlesRef.current[0].time;
      const olderCandles = await fetchCandles(1000, oldestTime);
      if (myGeneration !== fetchGenerationRef.current) return;
      if (olderCandles.length > 0 && olderCandles[olderCandles.length - 1].time < oldestTime) {
        allCandlesRef.current = mergeCandles(olderCandles, allCandlesRef.current);
        setAllCandles([...allCandlesRef.current]);
        saveCandleCache(selectedExchange, selectedCoin, chartInterval, allCandlesRef.current);
      }
    } catch (e) { console.error(e); }
    finally {
      setTimeout(() => {
        isLoadingMoreRef.current = false;
        setIsLoadingOlderData(false);
      }, 100);
    }
  }, [selectedExchange, selectedCoin, chartInterval, fetchCandles]);

  useEffect(() => {
    let unsub;
    const myGeneration = fetchGenerationRef.current;
    if (chartInstance.current && candleSeries.current) {
      const handle = async (logicalRange) => {
        if (!logicalRange || !allCandlesRef.current.length) return;
        const barsInfo = candleSeries.current.barsInLogicalRange(logicalRange);
        if (barsInfo !== null && barsInfo.barsBefore < 200 && !isLoadingMoreRef.current) {
          isLoadingMoreRef.current = true;
          setIsLoadingOlderData(true);
          try {
            const oldestTime = allCandlesRef.current[0].time;
            const olderCandles = await fetchCandles(1000, oldestTime);
            if (myGeneration !== fetchGenerationRef.current) return;
            if (olderCandles.length > 0) {
              if (olderCandles[olderCandles.length - 1].time < oldestTime) {
                allCandlesRef.current = mergeCandles(olderCandles, allCandlesRef.current);
                setAllCandles([...allCandlesRef.current]);
                saveCandleCache(selectedExchange, selectedCoin, chartInterval, allCandlesRef.current);
              }
            }
          } catch (e) { console.error(e); }
          finally {
            setTimeout(() => {
              isLoadingMoreRef.current = false;
              setIsLoadingOlderData(false);
            }, 100);
          }
        }
      };
      
      const throttledHandle = throttle(handle, 200);
      chartInstance.current.timeScale().subscribeVisibleLogicalRangeChange(throttledHandle);
      unsub = () => chartInstance.current?.timeScale().unsubscribeVisibleLogicalRangeChange(throttledHandle);
    }
    return () => { if (unsub) unsub(); };
  }, [selectedCoin, selectedExchange, chartInterval, fetchCandles]);

  useEffect(() => {
    if (chartInstance.current) {
      chartInstance.current.applyOptions({
        layout: {
          background: { color: darkMode ? '#0d1117' : '#ffffff' },
          textColor: darkMode ? '#c9d1d9' : '#131722',
        },
        watermark: {
          visible: false,
        },
        grid: {
          vertLines: { color: darkMode ? 'rgba(42,46,57,0.6)' : '#e0e3eb' },
          horzLines: { color: darkMode ? 'rgba(42,46,57,0.6)' : '#e0e3eb' },
        },
        crosshair: {
          vertLine: { labelBackgroundColor: darkMode ? '#2a2e39' : '#e0e3eb' },
          horzLine: { labelBackgroundColor: darkMode ? '#2a2e39' : '#e0e3eb' },
        },
        timeScale: {
          borderColor: darkMode ? 'rgba(42,46,57,0.8)' : '#e0e3eb',
          rightOffset: 20,
          barSpacing: isMobile ? 5 : 10,
          timeVisible: true,
          secondsVisible: chartInterval === '1m',
          visible: true,
        },
      });
    }
  }, [darkMode, chartInterval, isMobile]);

  // ─── Price Scale Effect ───
  useEffect(() => {
    if (chartInstance.current) {
      chartInstance.current.priceScale('right').applyOptions({
        mode: priceScaleMode,
        autoScale: autoScale,
        invertScale: invertScale,
      });
    }
  }, [priceScaleMode, autoScale, invertScale, chartCreated]);

  useEffect(() => {
    if (skipNextFullRedrawRef.current) {
      skipNextFullRedrawRef.current = false;
      return;
    }
    if (!candleSeries.current || !volumeSeries.current || allCandles.length === 0) return;
    
    let data;
    if (chartStyle === 'Heikin-Ashi') data = toHeikinAshi(allCandles);
    else if (['Line', 'Area', 'Step Line', 'Baseline'].includes(chartStyle)) {
      data = allCandles.map(c => ({ time: c.time, value: c.close }));
    } else if (chartStyle === 'Histogram') {
      data = allCandles.map(c => ({ time: c.time, value: c.close, color: c.close >= c.open ? '#26a69a' : '#ef5350' }));
    } else {
      data = allCandles;
    }
    candleSeries.current.setData(data);
    
    volumeSeries.current.setData(allCandles.map(c => ({
      time: c.time,
      value: c.volume || 0,
      color: c.close >= c.open ? 'rgba(38,166,154,0.3)' : 'rgba(239,83,80,0.3)'
    })));

    if (isFirstLoad.current && chartInstance.current) {
      const savedRange = localStorage.getItem(visibleRangeStorageKey);
      let applied = false;
      if (savedRange) {
        try {
          const range = JSON.parse(savedRange);
          if (range?.from && range?.to) {
            const intervalSecs = intervalToSeconds(chartInterval);
            const barsCount = (range.to - range.from) / intervalSecs;
            // Only restore if the saved range has at least 15 candles/bars
            if (barsCount >= 15) {
              chartInstance.current.timeScale().setVisibleRange(range);
              applied = true;
            }
          }
        } catch (e) {
          console.warn("Failed to apply saved visible range:", e);
        }
      }
      if (!applied) {
        chartInstance.current.timeScale().fitContent();
      }
      isFirstLoad.current = false;
    }
  }, [allCandles, chartStyle, visibleRangeStorageKey]);

  // ─── Client-Side Indicators Rendering ───

  // A. Structural Effect: Handles adding/removing series and oscillator sub-charts dynamically using INDICATOR_REGISTRY
  useEffect(() => {
    if (!chartInstance.current || !chartCreated) return;

    // Get active indicators categorized by kind
    const activeOverlays = visualIndicators.filter(ind => ind.visible && INDICATOR_REGISTRY[ind.type]?.kind === 'overlay');
    const activeOscillators = visualIndicators.filter(ind => ind.visible && INDICATOR_REGISTRY[ind.type]?.kind === 'subchart');

    // 1. Clean up removed indicator series on MAIN chart
    const activeMainKeys = new Set();
    activeOverlays.forEach(ind => {
      const reg = INDICATOR_REGISTRY[ind.type];
      if (reg) {
        reg.seriesConfig.forEach(s => {
          activeMainKeys.add(`${ind.id}_${s.key}`);
        });
      }
    });

    Object.keys(indicatorSeriesRef.current).forEach(key => {
      if (!activeMainKeys.has(key)) {
        try {
          chartInstance.current.removeSeries(indicatorSeriesRef.current[key]);
        } catch (e) {}
        delete indicatorSeriesRef.current[key];
      }
    });

    // 2. Destroy sub-charts that are no longer active
    Object.keys(subChartsMapRef.current).forEach(id => {
      if (!activeOscillators.some(ind => ind.id === id)) {
        try {
          subChartsMapRef.current[id].unsubscribeSync?.();
          subChartsMapRef.current[id].chart.remove();
        } catch (e) {}
        delete subChartsMapRef.current[id];
      }
    });

    // 3. Create active main-chart overlays
    activeOverlays.forEach(ind => {
      const reg = INDICATOR_REGISTRY[ind.type];
      if (!reg) return;
      reg.seriesConfig.forEach(s => {
        const key = `${ind.id}_${s.key}`;
        if (!indicatorSeriesRef.current[key]) {
          const options = s.options(ind.params, ind.color);
          let series;
          if (s.type === 'histogram') {
            series = chartInstance.current.addHistogramSeries(options);
          } else {
            series = chartInstance.current.addLineSeries(options);
          }
          indicatorSeriesRef.current[key] = series;
        }
      });
    });

    // 4. Create active oscillators in sub-panes
    activeOscillators.forEach(ind => {
      const reg = INDICATOR_REGISTRY[ind.type];
      if (!reg) return;
      const container = document.getElementById(`subchart-container-${ind.id}`);
      if (!container) return;

      let subChartObj = subChartsMapRef.current[ind.id];
      if (!subChartObj) {
        const chart = createChart(container, {
          layout: {
            background: { type: 'solid', color: darkMode ? '#131722' : '#ffffff' },
            textColor: darkMode ? '#c9d1d9' : '#131722',
          },
          grid: {
            vertLines: { color: darkMode ? 'rgba(42,46,57,0.6)' : '#e0e3eb' },
            horzLines: { color: darkMode ? 'rgba(42,46,57,0.6)' : '#e0e3eb' },
          },
          timeScale: {
            visible: true,
            borderColor: darkMode ? '#2a2e39' : '#e0e3eb',
          },
          rightPriceScale: {
            borderColor: darkMode ? '#2a2e39' : '#e0e3eb',
          },
          width: container.clientWidth,
          height: container.clientHeight,
        });

        const seriesList = {};
        reg.seriesConfig.forEach(s => {
          const options = s.options(ind.params, ind.color);
          let series;
          if (s.type === 'histogram') {
            series = chart.addHistogramSeries(options);
          } else {
            series = chart.addLineSeries(options);
          }
          seriesList[s.key] = series;
        });

        // Bi-directional timescale sync
        const mainTimeScale = chartInstance.current.timeScale();
        const subTimeScale = chart.timeScale();

        const syncMainToSub = throttle((range) => { if (range) subTimeScale.setVisibleRange(range); }, 16);
        const syncSubToMain = throttle((range) => { if (range) mainTimeScale.setVisibleRange(range); }, 16);

        mainTimeScale.subscribeVisibleTimeRangeChange(syncMainToSub);
        subTimeScale.subscribeVisibleTimeRangeChange(syncSubToMain);

        subChartObj = {
          chart,
          seriesList,
          unsubscribeSync: () => {
            mainTimeScale.unsubscribeVisibleTimeRangeChange(syncMainToSub);
            subTimeScale.unsubscribeVisibleTimeRangeChange(syncSubToMain);
          }
        };
        subChartsMapRef.current[ind.id] = subChartObj;
      }
    });

    setIndicatorStructureTick(prev => prev + 1);
  }, [visualIndicators, chartStyle, darkMode, chartCreated]);

  const lastVisualIndicatorsRef = useRef(visualIndicators);

  // B. Data Effect: Recalculates and updates existing series data dynamically
  useEffect(() => {
    if (allCandles.length === 0) return;

    const lastCandle = allCandles[allCandles.length - 1];
    const isNewCandle = !lastProcessedCandleRef.current || allCandles.length !== lastProcessedCandleRef.current.length || lastCandle.time !== lastProcessedCandleRef.current.time;
    const isPriceChanged = !lastProcessedCandleRef.current || lastCandle.close !== lastProcessedCandleRef.current.close;
    const structureChanged = indicatorStructureTick !== lastStructureTickRef.current;
    const indicatorsChanged = visualIndicators !== lastVisualIndicatorsRef.current;

    if (!isNewCandle && !isPriceChanged && !structureChanged && !indicatorsChanged) {
      return; // Skip calculations
    }

    lastProcessedCandleRef.current = { time: lastCandle.time, close: lastCandle.close, length: allCandles.length };
    lastStructureTickRef.current = indicatorStructureTick;
    lastVisualIndicatorsRef.current = visualIndicators;

    // Send calculation task to Web Worker
    if (indicatorWorkerRef.current) {
      indicatorWorkerRef.current.postMessage({
        action: 'computeAll',
        payload: {
          candles: allCandles,
          indicators: visualIndicators
        }
      });
    }
  }, [allCandles, indicatorStructureTick, visualIndicators]);

  // ─── Paper Trading Chart Lines ───
  useEffect(() => {
    // Clear old price lines
    positionLinesRef.current.forEach(line => {
      try {
        if (candleSeries.current) {
          candleSeries.current.removePriceLine(line);
        }
      } catch (e) {}
    });
    positionLinesRef.current = [];

    if (!candleSeries.current) return;

    // Active position line
    const activePos = positions.find(pos => pos.symbol === selectedCoin);
    if (activePos) {
      const line = candleSeries.current.createPriceLine({
        price: activePos.entryPrice,
        color: activePos.type === 'LONG' ? '#089981' : '#f23645',
        lineWidth: 2,
        lineStyle: 1, // Dashed
        axisLabelVisible: true,
        title: `${activePos.type} POSITION: ${activePos.qty} ${getBaseAsset(selectedCoin)} @ ${activePos.entryPrice}`
      });
      positionLinesRef.current.push(line);
    }

    // Pending limit orders lines
    const activeOrders = paperOrders.filter(o => o.symbol === selectedCoin && o.status === 'PENDING');
    activeOrders.forEach(o => {
      const line = candleSeries.current.createPriceLine({
        price: o.price,
        color: '#2962ff',
        lineWidth: 1.5,
        lineStyle: 2, // Dotted
        axisLabelVisible: true,
        title: `LIMIT ${o.side}: ${o.qty} ${getBaseAsset(selectedCoin)} @ ${o.price}`
      });
      positionLinesRef.current.push(line);
    });
  }, [positions, paperOrders, selectedCoin]);

  // ─── Price Alerts Chart Lines ───
  const alertLinesRef = useRef([]);
  useEffect(() => {
    alertLinesRef.current.forEach(line => {
      try {
        if (candleSeries.current) {
          candleSeries.current.removePriceLine(line);
        }
      } catch (e) {}
    });
    alertLinesRef.current = [];

    if (!candleSeries.current || !chartCreated) return;

    const activeAlerts = alerts.filter(a => a.symbol === selectedCoin);
    activeAlerts.forEach(a => {
      const line = candleSeries.current.createPriceLine({
        price: parseFloat(a.price),
        color: '#f0b90b',
        lineWidth: 1,
        lineStyle: 2, // Dotted
        axisLabelVisible: true,
        title: `ALERT: ${a.message || (a.condition === 'above' ? 'Crossing Up' : 'Crossing Down')}`
      });
      alertLinesRef.current.push(line);
    });
  }, [alerts, chartCreated, selectedCoin]);

  // In-chart news markers logic removed as per plan.

  // ─── Symbol Comparison Series ───
  const compareSeriesRef = useRef(null);
  useEffect(() => {
    if (!chartInstance.current || !chartCreated) return;
    
    if (compareSeriesRef.current) {
      try {
        chartInstance.current.removeSeries(compareSeriesRef.current);
      } catch (e) {}
      compareSeriesRef.current = null;
    }

    if (!compareSymbol || compareCandles.length === 0) {
      try {
        chartInstance.current.priceScale('left').applyOptions({ visible: false });
      } catch (e) {}
      return;
    }

    try {
      const compareSeries = chartInstance.current.addLineSeries({
        color: '#ea39ff',
        lineWidth: 2,
        priceScaleId: 'left',
        title: compareSymbol
      });
      compareSeriesRef.current = compareSeries;

      chartInstance.current.priceScale('left').applyOptions({
        visible: true,
        borderColor: darkMode ? '#2a2e39' : '#e0e3eb',
        axisLabelVisible: true,
      });

      const firstClose = compareCandles[0].close;
      const normalizedData = compareCandles.map(c => ({
        time: c.time,
        value: ((c.close - firstClose) / firstClose) * 100
      }));

      compareSeries.setData(normalizedData);
    } catch (e) {
      console.error("Failed to build compare series:", e);
    }
  }, [compareSymbol, compareCandles, chartCreated, darkMode]);


  const getSnappedPriceAndTime = (time, price, clientX, clientY) => {
    if (magnetMode === 'off' || allCandles.length === 0) {
      return { time, price };
    }

    const timeVal = typeof time === 'number' ? time : new Date(time).getTime() / 1000;

    let lo = 0, hi = allCandles.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      const midTime = typeof allCandles[mid].time === 'number' ? allCandles[mid].time : new Date(allCandles[mid].time).getTime() / 1000;
      if (midTime < timeVal) lo = mid + 1;
      else hi = mid;
    }

    let closestCandle = allCandles[lo];
    if (lo > 0) {
      const c1 = allCandles[lo - 1];
      const c2 = allCandles[lo];
      const t1 = typeof c1.time === 'number' ? c1.time : new Date(c1.time).getTime() / 1000;
      const t2 = typeof c2.time === 'number' ? c2.time : new Date(c2.time).getTime() / 1000;
      if (Math.abs(t1 - timeVal) < Math.abs(t2 - timeVal)) {
        closestCandle = c1;
      }
    }

    if (!closestCandle) {
      return { time, price };
    }

    const { open, high, low, close } = closestCandle;
    const ohlc = [open, high, low, close];
    let closestVal = price;
    let minPriceDiff = Infinity;
    ohlc.forEach(val => {
      const diff = Math.abs(val - price);
      if (diff < minPriceDiff) {
        minPriceDiff = diff;
        closestVal = val;
      }
    });

    if (magnetMode === 'strong') {
      return { time: closestCandle.time, price: closestVal };
    }

    if (magnetMode === 'weak' && candleSeries.current) {
      const targetY = candleSeries.current.priceToCoordinate(closestVal);
      const { y: pointerY } = getChartCoords(clientX, clientY);
      const pixelDiff = Math.abs(targetY - pointerY);
      if (pixelDiff < 15) {
        return { time: closestCandle.time, price: closestVal };
      }
    }

    return { time, price };
  };

  const requestDraw = useCallback(() => {
    if (drawingLayerRef.current) drawingLayerRef.current.draw();
  }, []);

  useEffect(() => {
    return () => {
      if (saveRangeTimeoutRef.current) clearTimeout(saveRangeTimeoutRef.current);
      
      Object.keys(subChartsMapRef.current).forEach(id => {
        try {
          const subChartObj = subChartsMapRef.current[id];
          if (subChartObj) {
            if (typeof subChartObj.unsubscribeSync === 'function') {
              subChartObj.unsubscribeSync();
            }
            if (subChartObj.chart) {
              subChartObj.chart.remove();
            }
          }
        } catch (e) {
          console.error(`Failed to cleanup subchart ${id} on unmount:`, e);
        }
      });
      subChartsMapRef.current = {};
    };
  }, []);

  useEffect(() => {
    const resizeCanvas = () => {
      if (!chartRef.current || !chartInstance.current) return;
      requestDraw();
    };
    resizeCanvas();
    const ro = new ResizeObserver(resizeCanvas);
    if (chartRef.current) ro.observe(chartRef.current);
    window.addEventListener('resize', resizeCanvas);
    return () => { ro.disconnect(); window.removeEventListener('resize', resizeCanvas); };
  }, [requestDraw]);

  const getAltInterval = (index) => {
    const list_1m = ['5m', '15m', '1h', '4h'];
    const list_5m = ['15m', '1h', '4h', '1D'];
    const list_1h = ['4h', '1D', '1W', '1M'];
    const list_1D = ['1W', '1M', '4h', '1h'];
    
    let base = list_1m;
    if (chartInterval === '5m' || chartInterval === '15m') base = list_5m;
    else if (chartInterval === '1h' || chartInterval === '4h') base = list_1h;
    else if (chartInterval === '1D' || chartInterval === '1W') base = list_1D;
    
    return base[index - 1] || '1h';
  };

  const loadCompareCandles = async (coin) => {
    try {
      const data = await fetchExchangeCandles(selectedExchange, coin, chartInterval, 300);
      if (data && data.length > 0) {
        setCompareSymbol(coin);
        setCompareCandles(data);
        showToast(`Added comparison overlay: ${coin}`);
      } else {
        showToast(`Failed to load comparison data for ${coin}`);
      }
    } catch (e) {
      console.error(e);
      showToast(`Error fetching compare candles for ${coin}`);
    }
  };

  const clearComparison = () => {
    setCompareSymbol(null);
    setCompareCandles([]);
    showToast("Cleared symbol comparison");
  };

  const getOHLCDiff = () => {
    if (!allCandles || allCandles.length === 0) return { change: 0, changePct: 0 };
    const current = allCandles[allCandles.length - 1];
    if (!current) return { change: 0, changePct: 0 };
    
    const idx = allCandles.findIndex(c => c.time === current.time);
    if (idx <= 0) return { change: 0, changePct: 0 };
    
    const prev = allCandles[idx - 1];
    const change = current.close - prev.close;
    const changePct = (change / prev.close) * 100;
    return { change, changePct };
  };

  const updateCrosshairDOM = (targetTime) => {
    if (!allCandlesRef.current || allCandlesRef.current.length === 0) return;
    
    const current = targetTime 
      ? allCandlesRef.current.find(c => c.time === targetTime) 
      : allCandlesRef.current[allCandlesRef.current.length - 1];
      
    if (!current) return;
    
    const elOpen = document.getElementById('ohlc-open');
    if (elOpen) elOpen.innerText = (current.open ?? 0).toFixed(2);
    const elHigh = document.getElementById('ohlc-high');
    if (elHigh) elHigh.innerText = (current.high ?? 0).toFixed(2);
    const elLow = document.getElementById('ohlc-low');
    if (elLow) elLow.innerText = (current.low ?? 0).toFixed(2);
    
    let change = 0, changePct = 0;
    const idx = allCandlesRef.current.findIndex(c => c.time === current.time);
    if (idx > 0) {
      const prev = allCandlesRef.current[idx - 1];
      change = current.close - prev.close;
      changePct = (change / prev.close) * 100;
    }
    const isUp = change >= 0;
    const colorClass = isUp ? 'text-[#089981]' : 'text-[#F23645]';
    
    const elClose = document.getElementById('ohlc-close');
    if (elClose) {
      elClose.innerText = (current.close ?? 0).toFixed(2);
      elClose.className = colorClass;
    }
    const elChange = document.getElementById('ohlc-change');
    if (elChange) {
      elChange.innerText = `${isUp ? '+' : ''}${change.toFixed(2)} (${isUp ? '+' : ''}${changePct.toFixed(2)}%)`;
      elChange.className = `${colorClass} ml-1`;
    }
    
    const currentVisualIndicators = visualIndicatorsRef.current || [];
    if (currentVisualIndicators.length > 0) {
      currentVisualIndicators.forEach(ind => {
        const elInd = document.getElementById(`ind-val-${ind.id}`);
        if (!elInd) return;
        const results = indicatorDataMapRef.current[ind.id];
        const reg = INDICATOR_REGISTRY[ind.type];
        if (!results || !reg) return;
        const keys = reg.seriesConfig.map(s => s.key);
        const valsText = keys.map(k => {
          const arr = results[k] || [];
          const pt = arr.find(p => p.time === current.time);
          const val = pt ? pt.value : null;
          const label = keys.length > 1 ? `${k.toUpperCase().slice(0, 3)}: ` : '';
          return `${label}${val !== undefined && val !== null ? (typeof val === 'number' ? val.toFixed(2) : String(val)) : '∅'}`;
        }).join('  ');
        elInd.innerText = valsText;
      });
    }
  };

  const renderOHLCHeader = () => {
    if (!allCandles || allCandles.length === 0) return null;
    const current = allCandles[allCandles.length - 1];
    if (!current) return null;

    const { change, changePct } = getOHLCDiff();
    const isUp = change >= 0;
    const colorClass = isUp ? 'text-[#089981]' : 'text-[#F23645]';

    return (
      <div className={`absolute top-2.5 left-2.5 z-25 flex flex-wrap items-center gap-2 text-[11px] font-mono font-bold select-none pointer-events-none drop-shadow-md`}>
        <span className={`${darkMode ? 'text-white' : 'text-black'} flex items-center gap-1.5 text-[13px] tracking-wide`}>
          <img 
            src={coinIconUrl(selectedCoin)} 
            data-tier="0"
            onError={(e) => handleCoinIconError(e, selectedCoin)}
            alt=""
            className="w-3.5 h-3.5 rounded-full bg-white object-cover shadow-sm" 
          />
          {selectedCoin}
        </span>
        <span className="text-gray-400 font-semibold">·</span>
        <span className={`${darkMode ? 'text-gray-400' : 'text-gray-500'} font-semibold`}>{selectedExchange.toUpperCase()}</span>
        <span className="text-gray-400 font-semibold">·</span>
        <span className={`${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>{chartInterval}</span>
        
        <span className={`${darkMode ? 'text-gray-450' : 'text-gray-500'} ml-2`}>O</span>
        <span id="ohlc-open" className={darkMode ? "text-white" : "text-black"} dangerouslySetInnerHTML={{ __html: (current.open ?? 0).toFixed(2) }} />
        
        <span className={darkMode ? 'text-gray-450' : 'text-gray-500'}>H</span>
        <span id="ohlc-high" className={darkMode ? "text-white" : "text-black"} dangerouslySetInnerHTML={{ __html: (current.high ?? 0).toFixed(2) }} />
        
        <span className={darkMode ? 'text-gray-450' : 'text-gray-500'}>L</span>
        <span id="ohlc-low" className={darkMode ? "text-white" : "text-black"} dangerouslySetInnerHTML={{ __html: (current.low ?? 0).toFixed(2) }} />
        
        <span className={darkMode ? 'text-gray-450' : 'text-gray-500'}>C</span>
        <span id="ohlc-close" className={colorClass} dangerouslySetInnerHTML={{ __html: (current.close ?? 0).toFixed(2) }} />
        
        <span id="ohlc-change" className={`${colorClass} ml-1`} dangerouslySetInnerHTML={{ __html: `${isUp ? '+' : ''}${change.toFixed(2)} (${isUp ? '+' : ''}${changePct.toFixed(2)}%)` }} />

        {isPerpetualSymbol(selectedCoin) && (fundingRate !== null || openInterest !== null) && (
          <>
            <span className="text-gray-400 font-semibold ml-2">·</span>
            {fundingRate !== null && (
              <>
                <span className="text-gray-450 ml-1">Funding</span>
                <span style={{ color: fundingRate > 0 ? '#F23645' : fundingRate < 0 ? '#089981' : '#787b86' }} className="font-mono">
                  {(fundingRate * 100).toFixed(4)}%
                </span>
              </>
            )}
            {openInterest !== null && (
              <>
                <span className="text-gray-450 ml-2">OI</span>
                <span className="text-white font-mono">{formatShortNumber(openInterest)} {getBaseAsset(selectedCoin)}</span>
              </>
            )}
          </>
        )}
      </div>
    );
  };

  const formatIndValue = (val) => {
    if (val === undefined || val === null) return '∅';
    return typeof val === 'number' ? val.toFixed(2) : String(val);
  };

  const renderIndValues = (ind) => {
    const results = indicatorDataMapRef.current[ind.id];
    if (!results) return null;
    
    const reg = INDICATOR_REGISTRY[ind.type];
    if (!reg) return null;

    const keys = reg.seriesConfig.map(s => s.key);
    const targetTime = allCandles.length > 0 ? allCandles[allCandles.length - 1].time : null;
    if (!targetTime) return null;

    const valsText = keys.map(k => {
      const arr = results[k] || [];
      const pt = arr.find(p => p.time === targetTime);
      const val = pt ? pt.value : null;
      
      const label = keys.length > 1 ? `${k.toUpperCase().slice(0, 3)}: ` : '';
      return `${label}${formatIndValue(val)}`;
    }).join('  ');

    return <span id={`ind-val-${ind.id}`} className="text-[10.5px] font-mono text-gray-300 ml-1 font-bold" dangerouslySetInnerHTML={{ __html: valsText }} />;
  };

  const renderChartOverlays = () => {
    return (
      <>
        {/* Quick Buy/Sell Buttons */}
        {livePrice > 0 && (
          <div className={`absolute top-2.5 right-[75px] transition-all duration-300 z-20 flex items-center ${darkMode ? 'bg-[#1c2030]/90 border-[#2a2e39]' : 'bg-white/90 border-gray-200'} border rounded-lg shadow-xl overflow-hidden font-mono text-[11px] pointer-events-none`}>
            <button 
              onClick={() => executeMarketOrder('SELL', quickTradeQty)}
              className="px-2.5 py-1.5 bg-[#F23645] hover:bg-[#ff4d5a] text-white font-extrabold flex flex-col items-center transition-colors cursor-pointer min-w-[65px] pointer-events-auto"
              title={`Quick Sell ${quickTradeQty} ${getBaseAsset(selectedCoin)}`}
            >
              <span className="text-[8.5px] uppercase tracking-wide opacity-80">SELL</span>
              <span id="quick-sell-price" dangerouslySetInnerHTML={{ __html: (livePrice * 0.9998).toFixed(2) }} />
            </button>
            <input 
              type="number"
              step="0.001"
              min="0.001"
              value={quickTradeQty}
              onChange={(e) => setQuickTradeQty(parseFloat(e.target.value) || 0.01)}
              className={`w-12 ${darkMode ? 'bg-[#131722] text-white border-[#2a2e39]' : 'bg-gray-100 text-black border-gray-200'} text-center font-bold border-x py-2 outline-none text-[11px] pointer-events-auto`}
            />
            <button 
              onClick={() => executeMarketOrder('BUY', quickTradeQty)}
              className="px-2.5 py-1.5 bg-[#2962ff] hover:bg-[#4d7eff] text-white font-extrabold flex flex-col items-center transition-colors cursor-pointer min-w-[65px] pointer-events-auto"
              title={`Quick Buy ${quickTradeQty} ${getBaseAsset(selectedCoin)}`}
            >
              <span className="text-[8.5px] uppercase tracking-wide opacity-80">BUY</span>
              <span id="quick-buy-price" dangerouslySetInnerHTML={{ __html: (livePrice * 1.0002).toFixed(2) }} />
            </button>
          </div>
        )}

        {/* Historical Data Loading Indicator */}
        {isLoadingOlderData && (
          <div className="absolute top-3 left-3 z-30 flex items-center gap-2 bg-[#131722]/90 border border-[#2a2e39] text-[#b2b5be] text-[11px] font-semibold px-3 py-1.5 rounded-full shadow-xl backdrop-blur-sm pointer-events-none">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
            Loading historical data...
          </div>
        )}

        {/* Jump to Realtime Button */}
        {!isAtLiveEdge && (
          <button
            onClick={() => {
              if (renderEngine === 'canvas2d' && chartInstance.current) {
                chartInstance.current.timeScale().scrollToRealTime();
              } else if ((renderEngine === 'webgl' || renderEngine === 'webgpu') && webGLEngineRef.current) {
                webGLEngineRef.current.scrollToRealTime();
              }
              setIsAtLiveEdge(true);
            }}
            className={`absolute top-1/2 left-6 -translate-y-1/2 z-[60] flex items-center justify-center w-8 h-8 rounded-full ${t.sec} border ${t.border} text-[#787b86] hover:text-black dark:hover:text-white shadow-lg cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors pointer-events-auto group`}
            title="Jump to Realtime"
          >
            <ChevronRight className="text-blue-400 group-hover:scale-110 transition-transform" size={18} />
          </button>
        )}

        {/* TradingView-style Price Scale Settings Gear (At 0,0 origin) */}
        <div className={`absolute bottom-0 right-0 z-[60] p-1 flex items-center justify-center ${darkMode ? 'bg-[#131722]' : 'bg-[#ffffff]'}`}>
          <button 
            onClick={() => setIsPriceScaleMenuOpen(!isPriceScaleMenuOpen)}
            className={`w-[20px] h-[20px] flex items-center justify-center rounded ${isPriceScaleMenuOpen ? 'text-white bg-[#2a2e39]' : `text-gray-500/70 hover:text-white hover:bg-[#2a2e39]`} transition-all`}
            title="Price Scale Settings"
          >
            <Settings size={12} strokeWidth={2.5} />
          </button>

          {isPriceScaleMenuOpen && (
            <div className={`absolute bottom-[110%] right-0 mb-1 w-56 ${t.bg} border ${t.border} rounded-lg shadow-2xl py-1 text-[12px] font-medium origin-bottom-right z-[70]`}>
              <button onClick={() => { setAutoScale(true); setPriceScaleMode(0); setInvertScale(false); setIsPriceScaleMenuOpen(false); }} className={`w-full text-left px-3.5 py-1.5 flex items-center gap-2 text-gray-300 hover:bg-white/5`}>
                <RotateCcw size={13} className="text-gray-400" />
                <span>Reset price scale</span>
              </button>
              
              <div className={`border-t ${t.border} my-1`} />

              <button onClick={() => { setAutoScale(!autoScale); setIsPriceScaleMenuOpen(false); }} className={`w-full text-left px-3.5 py-1.5 flex items-center justify-between text-gray-300 hover:bg-white/5`}>
                <span>Auto (fits data to screen)</span>
                {autoScale && <Check size={14} className="text-blue-500" />}
              </button>
              <button onClick={() => { setInvertScale(!invertScale); setIsPriceScaleMenuOpen(false); }} className={`w-full text-left px-3.5 py-1.5 flex items-center justify-between text-gray-300 hover:bg-white/5`}>
                <span>Invert scale</span>
                {invertScale && <Check size={14} className="text-blue-500" />}
              </button>

              <div className={`border-t ${t.border} my-1`} />

              <button onClick={() => { setPriceScaleMode(0); setIsPriceScaleMenuOpen(false); }} className={`w-full text-left px-3.5 py-1.5 flex items-center justify-between text-gray-300 hover:bg-white/5`}>
                <span>Regular</span>
                {priceScaleMode === 0 && <Check size={14} className="text-blue-500" />}
              </button>
              <button onClick={() => { setPriceScaleMode(2); setIsPriceScaleMenuOpen(false); }} className={`w-full text-left px-3.5 py-1.5 flex items-center justify-between text-gray-300 hover:bg-white/5`}>
                <span>Percent</span>
                {priceScaleMode === 2 && <Check size={14} className="text-blue-500" />}
              </button>
              <button onClick={() => { setPriceScaleMode(3); setIsPriceScaleMenuOpen(false); }} className={`w-full text-left px-3.5 py-1.5 flex items-center justify-between text-gray-300 hover:bg-white/5`}>
                <span>Indexed to 100</span>
                {priceScaleMode === 3 && <Check size={14} className="text-blue-500" />}
              </button>
              <button onClick={() => { setPriceScaleMode(1); setIsPriceScaleMenuOpen(false); }} className={`w-full text-left px-3.5 py-1.5 flex items-center justify-between text-gray-300 hover:bg-white/5`}>
                <span>Logarithmic</span>
                {priceScaleMode === 1 && <Check size={14} className="text-blue-500" />}
              </button>

              <div className={`border-t ${t.border} my-1`} />

              <button 
                onClick={() => { openModal('Settings', 'Settings', 'settings'); setIsPriceScaleMenuOpen(false); }}
                className={`w-full text-left px-3.5 py-1.5 flex items-center gap-2 text-gray-300 hover:bg-white/5`}
              >
                <Settings size={13} className="text-gray-400" />
                <span>More settings...</span>
              </button>
            </div>
          )}
        </div>


        {/* ── TradingView-style News Flash Button + Panel ── */}
        <div className="absolute bottom-[28px] right-14 z-40 flex flex-col items-end gap-1.5 pointer-events-none select-none">
          {/* News Popup Panel */}
          {showNewsPanel && (
            <div
              className="mb-1 w-[320px] bg-[#121626]/90 backdrop-blur-md border border-[#ea39ff]/40 rounded-xl shadow-[0_8px_32px_rgba(234,57,255,0.22)] overflow-hidden animate-fade-in pointer-events-auto origin-bottom-right"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#ea39ff]/25">
                <div className="flex items-center gap-2">
                  <span className="text-[#ea39ff] text-[13px]">⚡</span>
                  <span className="text-white font-extrabold text-[12px] tracking-wide">Latest updates</span>
                </div>
                <button
                  onClick={() => setShowNewsPanel(false)}
                  className="text-gray-500 hover:text-white transition-colors text-[11px] font-black p-0.5"
                >
                  ✕
                </button>
              </div>

              {/* News List */}
              <div className="max-h-[280px] overflow-y-auto dark-scrollbar">
                {newsLoading ? (
                  <div className="flex flex-col items-center py-6 gap-1.5 text-gray-500">
                    <RefreshCw size={13} className="animate-spin text-[#ea39ff]" />
                    <span className="text-[10px] font-bold">Loading news...</span>
                  </div>
                ) : newsError || newsList.length === 0 ? (
                  <div className="py-5 text-center text-[11px] text-gray-500">
                    No news available right now
                  </div>
                ) : (
                  newsList.map((item, i) => {
                    const timeAgo = item.time || '';
                    return (
                      <a
                        key={item.id || i}
                        href={item.url || '#'}
                        target="_blank"
                        rel="noreferrer"
                        className="flex flex-col gap-0.5 px-4 py-2.5 border-b border-[#ea39ff]/10 hover:bg-[#ea39ff]/5 transition-colors cursor-pointer group"
                      >
                        <div className="flex items-center gap-1.5 text-[9.5px] text-gray-500 font-semibold">
                          <span>{timeAgo}</span>
                          <span>·</span>
                          <span className="text-[#ea39ff] opacity-80">{item.source}</span>
                        </div>
                        <p className="text-white text-[11px] font-semibold leading-snug group-hover:text-[#ea39ff] transition-colors line-clamp-2">
                          {item.title}
                        </p>
                      </a>
                    );
                  })
                )}
              </div>

              {/* Footer */}
              <div
                className="flex items-center justify-center py-2 bg-[#ea39ff]/5 border-t border-[#ea39ff]/20 cursor-pointer hover:bg-[#ea39ff]/10 transition-colors"
                onClick={() => { setShowNewsPanel(false); setRightSidebar('news'); }}
              >
                <span className="text-[10.5px] font-extrabold text-[#ea39ff] hover:text-white transition-colors">
                  More events →
                </span>
              </div>
            </div>
          )}

          {/* Lightning Button */}
          <button
            onClick={() => setShowNewsPanel(prev => !prev)}
            title="Latest News"
            className={`relative flex items-center justify-center w-[26px] h-[26px] rounded-full transition-all duration-200 shadow-lg border pointer-events-auto ${
              showNewsPanel
                ? 'bg-[#ea39ff] border-[#ea39ff] shadow-[0_0_14px_rgba(234,57,255,0.7)]'
                : 'bg-[#1e222d] border-[#ea39ff]/50 hover:bg-[#ea39ff]/10 hover:border-[#ea39ff] hover:shadow-[0_0_10px_rgba(234,57,255,0.4)]'
            }`}
          >
            <span
              className={`text-[12px] font-black leading-none transition-colors ${
                showNewsPanel ? 'text-white' : 'text-[#ea39ff]'
              }`}
            >
              ⚡
            </span>
            {/* 6K Badge equivalent when news is available */}
            {!showNewsPanel && newsList.length > 0 && (
              <span className="absolute -top-[4px] -right-[6px] flex items-center justify-center min-w-[16px] h-[14px] px-1 bg-[#ea39ff] text-[#1e222d] text-[8.5px] font-black rounded-full border border-[#1e222d] shadow-sm tracking-tighter">
                {newsList.length > 999 ? '1K+' : newsList.length}
              </span>
            )}
          </button>
        </div>
      </>
    );
  };

  useEffect(() => { requestDraw(); }, [requestDraw, allCandles, drawings, tempShape, renderEngine]);

  useEffect(() => {
    let unsub;
    if (chartCreated && chartInstance.current) {
      const handler = (range) => {
        if (range?.from && range?.to) {
          if (saveRangeTimeoutRef.current) clearTimeout(saveRangeTimeoutRef.current);
          saveRangeTimeoutRef.current = setTimeout(() => {
            localStorage.setItem(visibleRangeStorageKey, JSON.stringify(range));
          }, 300);

          if (allCandles.length > 0) {
            const lastCandle = allCandles[allCandles.length - 1];
            setIsAtLiveEdge(range.to >= lastCandle.time);
          }
        }
        requestDraw();
      };
      
      const throttledHandler = throttle(handler, 100);
      chartInstance.current.timeScale().subscribeVisibleTimeRangeChange(throttledHandler);
      unsub = () => chartInstance.current?.timeScale().unsubscribeVisibleTimeRangeChange(throttledHandler);
    }
    return () => { if (unsub) unsub(); };
  }, [chartCreated, requestDraw, visibleRangeStorageKey, allCandles]);

  const getChartCoords = (clientX, clientY) => {
    const el = chartContainerRef.current || chartRef.current;
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const findDrawingAtCoords = (x, y) => {
    if (renderEngine === 'canvas2d' && (!chartInstance.current || !candleSeries.current)) return -1;
    
    // getPixel is already available in the component scope, so we use it directly instead of redefining it locally.
    // Wait, the outer getPixel might not be captured here if we shadow it or if we define this function before getPixel.
    // Let's rely on the outer getPixel by removing the local definition.

    const distanceToSegment = (px, py, x1, y1, x2, y2) => {
      const l2 = Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2);
      if (l2 === 0) return Math.sqrt(Math.pow(px - x1, 2) + Math.pow(py - y1, 2));
      let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
      t = Math.max(0, Math.min(1, t));
      return Math.sqrt(Math.pow(px - (x1 + t * (x2 - x1)), 2) + Math.pow(py - (y1 + t * (y2 - y1)), 2));
    };

    const hitRadius = 12;

    for (let i = drawings.length - 1; i >= 0; i--) {
      const d = drawings[i];
      const p1 = getPixel(d.start.time, d.start.price);
      const p2 = d.end ? getPixel(d.end.time, d.end.price) : null;
      if (!p1) continue;

      if (['horizontal_line', 'horizontal_ray'].includes(d.type)) {
        if (Math.abs(y - p1.y) < hitRadius) return d.id;
      } else if (d.type === 'vertical_line') {
        if (Math.abs(x - p1.x) < hitRadius) return d.id;
      } else if (p2) {
        if (['trendline', 'ray', 'infoline', 'extendedline', 'parallel_channel', 'regression_trend'].includes(d.type)) {
          if (distanceToSegment(x, y, p1.x, p1.y, p2.x, p2.y) < hitRadius) return d.id;
        } else {
          const dist1 = Math.sqrt(Math.pow(x - p1.x, 2) + Math.pow(y - p1.y, 2));
          const dist2 = Math.sqrt(Math.pow(x - p2.x, 2) + Math.pow(y - p2.y, 2));
          if (dist1 < hitRadius || dist2 < hitRadius) return d.id;
        }
      } else {
        const dist = Math.sqrt(Math.pow(x - p1.x, 2) + Math.pow(y - p1.y, 2));
        if (dist < hitRadius * 1.5) return d.id;
      }
    }
    return null;
  };

  
  const handlePointerDown = (e) => {
    if (renderEngine === 'canvas2d' && (!chartInstance.current || !candleSeries.current)) return;

    if (!activeTool) {
      const { x, y } = getChartCoords(e.clientX, e.clientY);
      const hitId = findDrawingAtCoords(x, y);
      if (hitId) {
        setSelectedDrawingId(hitId);
        const hitDrawing = drawings.find(d => d.id === hitId);
        const rect = chartRef.current.getBoundingClientRect();
        setFloatingToolbarCoords({
          time: hitDrawing.start.time,
          price: hitDrawing.start.price,
          offsetX: -100,
          offsetY: -60,
          x: Math.max(16, Math.min(window.innerWidth - 320, e.clientX - 100)),
          y: Math.max(80, rect.top + y - 60)
        });
        requestDraw();
      } else {
        setSelectedDrawingId(null);
        setFloatingToolbarCoords(null);
        requestDraw();
      }
      return;
    }

    if (e.pointerType === 'touch') e.preventDefault();
    if (renderEngine === 'canvas2d' && chartInstance.current) { chartInstance.current.applyOptions({ handleScroll: false, handleScale: false }); }

    const { x, y } = getChartCoords(e.clientX, e.clientY);
    const coords = coordinateToTimePrice(x, y);
    if (!coords) return;
    let time = coords.time;
    let price = coords.price;
    if (!time || price === undefined) return;

    // Apply Snapping
    const snapped = getSnappedPriceAndTime(time, price, e.clientX, e.clientY);
    time = snapped.time;
    price = snapped.price;

    if (activeTool === 'eraser') {
      const hitRadius = 25;
      const foundId = drawings.find(d => {
        const pNode = getPixel(d.start.time, d.start.price);
        if (!pNode) return false;
        return Math.sqrt(Math.pow(x - pNode.x, 2) + Math.pow(y - pNode.y, 2)) < hitRadius;
      });
      if (foundId) setDrawings(prev => prev.filter(d => d.id !== foundId.id));
      return;
    }

    if (['text', 'note', 'price_note', 'callout', 'signpost'].includes(activeTool)) {
      const textVal = prompt(`Enter text for ${activeTool}:`) || 'Text';
      setDrawings(prev => [...prev, { id: generateDrawingId(), type: activeTool, start: { time, price }, end: { time, price }, text: textVal }]);
      if (!keepDrawing) {
        setActiveTool(null);
      }
      return;
    }

    if (activeTool.startsWith('icon_')) {
      setDrawings(prev => [...prev, { id: generateDrawingId(), type: activeTool, start: { time, price }, end: { time, price } }]);
      if (!keepDrawing) {
        setActiveTool(null);
      }
      return;
    }

    if (activeTool === 'brush') {
      setIsDrawing(true);
      setBrushPath([{ time, price }]);
      return;
    }

    setIsDrawing(true);
    setDrawStart({ time, price });
    setTempShape({ time, price });
  };

  const handlePointerMove = (e) => {
    if (renderEngine === 'canvas2d' && (!chartInstance.current || !candleSeries.current)) return;
    const { x, y } = getChartCoords(e.clientX, e.clientY);

    // Track hover coordinates for custom hover cursors
    const hitId = findDrawingAtCoords(x, y);
    setIsHoveringDrawing(!!hitId);

    if (activeTool && ['dot', 'demonstration', 'magic'].includes(activeTool)) {
      setHoverCoords({ x, y });
      if (activeTool === 'magic') {
        setMagicTrail(prev => [...prev.slice(-15), { x, y, size: Math.random() * 8 + 4 }]);
      }
      requestDraw();
    } else {
      if (hoverCoords) {
        setHoverCoords(null);
        requestDraw();
      }
    }

    if (!isDrawing || !activeTool) return;
    const coords = coordinateToTimePrice(x, y);
    if (!coords) return;
    let time = coords.time;
    let price = coords.price;
    if (!time || price === undefined) return;

    // Apply Snapping
    const snapped = getSnappedPriceAndTime(time, price, e.clientX, e.clientY);
    time = snapped.time;
    price = snapped.price;

    if (activeTool === 'brush') {
      setBrushPath(prev => [...prev, { time, price }]);
      return;
    }

    setTempShape({ time, price });
  };

  const getPixel = useCallback((time, price) => {
    if ((renderEngine === 'webgl' || renderEngine === 'webgpu') && webGLEngineRef.current) {
      return webGLEngineRef.current.getPixel(time, price);
    }
    if (!chartInstance.current || !candleSeries.current) return null;
    const x = chartInstance.current.timeScale().timeToCoordinate(time);
    const y = candleSeries.current.priceToCoordinate(price);
    return { x, y };
  }, [renderEngine]);

  const coordinateToTimePrice = useCallback((x, y) => {
    if ((renderEngine === 'webgl' || renderEngine === 'webgpu') && webGLEngineRef.current) {
      return webGLEngineRef.current.coordinateToTimePrice(x, y);
    }
    if (!chartInstance.current || !candleSeries.current || !chartRef.current) return null;
    
    // Clamp coordinates so Lightweight Charts doesn't return null when dragging out of bounds
    const w = chartRef.current.clientWidth;
    const h = chartRef.current.clientHeight;
    // Approximate price scale width (55px) and time scale height (26px)
    const clampedX = Math.max(0, Math.min(w - 55, x));
    const clampedY = Math.max(0, Math.min(h - 26, y));

    const time = chartInstance.current.timeScale().coordinateToTime(clampedX);
    const price = candleSeries.current.coordinateToPrice(clampedY);
    
    return { time, price };
  }, [renderEngine]);

  const handlePointerUp = () => {
    setHoverCoords(null);
    if (renderEngine === 'canvas2d' && chartInstance.current) {
      chartInstance.current.applyOptions({ handleScroll: true, handleScale: true });
    }
    if (isDrawing) {
      if (activeTool === 'brush') {
        if (brushPath.length > 1) {
          setDrawings(prev => [...prev, { id: generateDrawingId(), type: 'brush', points: brushPath }]);
        }
        setBrushPath([]);
      } else if (drawStart && tempShape && activeTool) {
        setDrawings(prev => [...prev, { id: generateDrawingId(), type: activeTool, start: drawStart, end: tempShape }]);
      }
      setIsDrawing(false);
      setDrawStart(null);
      setTempShape(null);

      // Keep active tool if keepDrawing is true
      if (!keepDrawing) {
        setActiveTool(null);
      }
    }
  };



  const sideTools = [
    { id: 'ai', icon: Sparkles, title: 'AI Assistant', action: () => openLeftPanel('ai') },
  ];

  const AiChatPanel = () => {
    const messages = getAiMessages();
    return (
      <div className={`flex-1 min-h-0 flex flex-col ${t.bg}`}>
        <div className={`flex items-center gap-2 px-2 py-1.5 border-b ${t.border} shrink-0 flex-wrap`}>
          <select
            value={aiProvider}
            onChange={(e) => setAiProvider(e.target.value)}
            className={`text-[11px] font-bold rounded px-2 py-1 border ${t.border} ${t.bg} ${t.text}`}
          >
            <option value="groq" disabled={!aiKeysReady.groq}>Groq</option>
            <option value="gemini" disabled={!aiKeysReady.gemini}>Gemini</option>
            <option value="jarvis" disabled={!aiKeysReady.jarvis}>Jarvis</option>
          </select>
          <button type="button" onClick={() => sendAiMessage('generate', `EMA crossover for ${selectedCoin}`)} disabled={aiLoading} className={`px-2 py-1 rounded text-[10px] font-semibold bg-[#7C5CFF]/10 text-[#7C5CFF]`}>Generate</button>
          <button type="button" onClick={() => sendAiMessage('fix')} disabled={aiLoading} className={`px-2 py-1 rounded text-[10px] font-semibold ${t.sec} ${t.text}`}>Fix</button>
          <button type="button" onClick={() => sendAiMessage('explain')} disabled={aiLoading} className={`px-2 py-1 rounded text-[10px] font-semibold ${t.sec} ${t.text}`}>Explain</button>
          <button type="button" onClick={() => sendAiMessage('optimize')} disabled={aiLoading} className={`px-2 py-1 rounded text-[10px] font-semibold ${t.sec} ${t.text}`}>Optimize</button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto dark-scrollbar p-2 space-y-2">
          {messages.length === 0 && (
            <div className={`text-center py-6 px-3 ${t.muted} text-[11px]`}>
              <Bot size={28} className="mx-auto mb-2 opacity-50" />
              <p>AI for {editorMode === 'pine' ? 'Pine Script' : 'Python'}</p>
              <p className="mt-1">{selectedCoin} · {getExchangeMeta(selectedExchange).name}</p>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`rounded-lg px-3 py-2 text-[11px] ${msg.role === 'user' ? 'bg-[#7C5CFF]/15 ml-3' : msg.error ? 'bg-red-500/10' : t.sec}`}>
              <div className={`font-bold text-[10px] mb-1 ${t.muted}`}>{msg.role === 'user' ? 'You' : aiProvider}</div>
              <pre className={`whitespace-pre-wrap font-sans ${t.text}`}>{msg.content}</pre>
              {msg.code && (
                <button type="button" onClick={() => applyAiCode(msg.code)} className="mt-2 px-2 py-1 rounded bg-[#7C5CFF] text-white text-[10px] font-bold">
                  Apply to {editorMode === 'pine' ? 'Pine' : 'Python'}
                </button>
              )}
            </div>
          ))}
          {aiLoading && <div className={`flex items-center gap-2 px-2 ${t.muted}`}><RefreshCw size={12} className="animate-spin" /> Thinking...</div>}
        </div>
        <form className={`shrink-0 border-t ${t.border} p-2 flex gap-2 ${t.bg}`} onSubmit={(e) => { e.preventDefault(); sendAiMessage('chat'); }}>
          <input value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} placeholder={`Ask AI (${editorMode})...`} disabled={aiLoading} className={`flex-1 px-2 py-1.5 rounded-lg border ${t.border} ${t.bg} ${t.text} text-[11px] outline-none`} />
          <button type="submit" disabled={aiLoading || !aiPrompt.trim()} className="px-2 py-1.5 rounded-lg bg-purple-600 text-white disabled:opacity-50"><Send size={14} /></button>
        </form>
      </div>
    );
  };

  const LeftSidePanel = () => {
    if (!leftPanel) return null;
    return (
      <div className={`hidden md:flex flex-col w-[260px] shrink-0 border-r ${t.border} ${t.bg} z-10`}>
        <div className={`h-9 border-b ${t.border} flex items-center justify-between px-3 ${t.sec}`}>
          <span className={`font-bold text-[12px] ${t.text}`}>
            {leftPanel === 'ai' && 'AI Assistant'}
            {leftPanel === 'indicators' && 'Indicators'}
            {leftPanel === 'alerts' && 'Price Alerts'}
          </span>
          <button onClick={() => setLeftPanel(null)} className={t.muted}><X size={14} /></button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto dark-scrollbar p-2">
          {leftPanel === 'ai' && (
            <div className="flex flex-col h-full min-h-[200px]">
              <div className={`flex gap-1 mb-2`}>
                <button onClick={() => openEditor('pine', 'ai')} className={`flex-1 py-1.5 rounded text-[10px] font-bold ${editorMode === 'pine' ? 'bg-[#7C5CFF]/15 text-[#7C5CFF]' : t.sec}`}>Pine AI</button>
                <button onClick={() => openEditor('python', 'ai')} className={`flex-1 py-1.5 rounded text-[10px] font-bold ${editorMode === 'python' ? 'bg-purple-500/15 text-purple-400' : t.sec}`}>Python AI</button>
              </div>
              <select value={aiProvider} onChange={(e) => setAiProvider(e.target.value)} className={`w-full mb-2 text-[11px] rounded border ${t.border} ${t.bg} ${t.text} p-1.5`}>
                <option value="groq">Groq</option>
                <option value="gemini">Gemini</option>
              </select>
              <button onClick={() => sendAiMessage('generate', `Build ${editorMode} strategy for ${selectedCoin}`)} className="w-full mb-1 py-2 rounded bg-[#7C5CFF] text-white text-[11px] font-bold">Quick Generate</button>
              <button onClick={() => { openEditor(editorMode, 'ai'); setLeftPanel(null); }} className={`w-full py-2 rounded border ${t.border} ${t.text} text-[11px] font-bold`}>Open full AI panel →</button>
            </div>
          )}
          {leftPanel === 'indicators' && (
            <>
              {INDICATOR_LIBRARY.map((ind) => (
                <div key={ind.id} className={`mb-1 rounded-lg border ${t.border} overflow-hidden`}>
                  <div className={`px-3 py-2 ${t.sec}`}>
                    <div className={`font-bold text-[12px] ${t.text}`}>{ind.name}</div>
                  </div>
                  <div className="flex border-t border-inherit">
                    <button type="button" onClick={() => injectIndicator(ind, 'pine')} className={`flex-1 py-1.5 text-[10px] font-bold text-[#7C5CFF] ${t.hover}`}>Pine</button>
                    <button type="button" onClick={() => injectIndicator(ind, 'python')} className={`flex-1 py-1.5 text-[10px] font-bold text-purple-400 border-l ${t.border} ${t.hover}`}>Python</button>
                    <button
                      type="button"
                      onClick={() => {
                        const targetId = ind.id === 'ema' ? 'ema_9' : ind.id === 'sma' ? 'sma_50' : ind.id === 'bb' ? 'bb_20_2' : null;
                        if (targetId) {
                          setVisualIndicators(prev => prev.map(p => p.id === targetId ? { ...p, visible: !p.visible } : p));
                          const isNowVisible = !visualIndicators.find(p => p.id === targetId)?.visible;
                          showToast(`${ind.name} is now ${isNowVisible ? 'visible' : 'hidden'} on chart`);
                        } else {
                          showToast("Visual chart overlay not supported for this indicator yet");
                        }
                      }}
                      className={`flex-1 py-1.5 text-[10px] font-bold text-blue-400 border-l ${t.border} ${t.hover}`}
                    >
                      Chart
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}
          {leftPanel === 'alerts' && (
            <div className="space-y-2">
              <div className={`text-[11px] ${t.muted} mb-1`}>{selectedCoin} · {getExchangeMeta(selectedExchange).name}</div>
              <select value={alertCondition} onChange={(e) => setAlertCondition(e.target.value)} className={`w-full rounded border ${t.border} ${t.bg} ${t.text} p-1.5 text-[11px]`}>
                <option value="above">Price crosses above</option>
                <option value="below">Price crosses below</option>
              </select>
              <input type="number" value={alertPrice} onChange={(e) => setAlertPrice(e.target.value)} placeholder="Alert price" className={`w-full rounded border ${t.border} ${t.bg} ${t.text} p-2 text-[12px]`} />
              <button onClick={addPriceAlert} className="w-full py-2 rounded bg-amber-500 text-white font-bold text-[11px]">Create Alert</button>
              <div className={`mt-3 pt-2 border-t ${t.border}`}>
                {alerts.filter((a) => a.symbol === selectedCoin).map((a) => (
                  <div key={a.id} className={`flex justify-between items-center py-2 text-[11px] ${t.text}`}>
                    <span>{a.condition} ${a.price}</span>
                    <button onClick={() => removeAlert(a.id)} className="text-red-400"><X size={12} /></button>
                  </div>
                ))}
                {!alerts.filter((a) => a.symbol === selectedCoin).length && <p className={t.muted}>No alerts for this pair</p>}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderBountyPanel = () => {
    return (
      <div className="space-y-4">
        {!selectedBounty ? (
          <>
            <div className={`p-3 rounded-lg border ${t.border} ${t.sec} space-y-2`}>
              <div className="text-[10px] font-bold text-gray-400">POST NEW BOUNTY</div>
              <input type="text" value={bountyTitle} onChange={(e) => setBountyTitle(e.target.value)} placeholder="Title (e.g. Need RSI strategy)" className={`w-full rounded border ${t.border} ${t.bg} ${t.text} p-2 text-[11px]`} />
              <textarea value={bountyDesc} onChange={(e) => setBountyDesc(e.target.value)} placeholder="Description & Requirements..." rows="3" className={`w-full rounded border ${t.border} ${t.bg} ${t.text} p-2 text-[11px]`} />
              <input type="number" value={bountyReward} onChange={(e) => setBountyReward(e.target.value)} placeholder="Reward (e.g. 50 Credits)" className={`w-full rounded border ${t.border} ${t.bg} ${t.text} p-2 text-[11px] font-mono`} />
              <button onClick={handlePostBounty} className="w-full py-1.5 rounded bg-blue-500 text-white font-bold text-[11px]">Post Bounty</button>
            </div>
            
            <div className="space-y-2">
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Available Tasks</div>
              {bounties.map(b => (
                <div key={b.id} onClick={() => setSelectedBounty(b)} className={`cursor-pointer flex flex-col p-3 rounded-lg border ${t.border} ${t.sec} text-[11px] hover:border-blue-500 transition-colors`}>
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-bold text-[12px]">{b.title}</span>
                    <span className="font-mono text-amber-500 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded">{b.reward}</span>
                  </div>
                  <span className="text-gray-400 line-clamp-2">{b.description}</span>
                  <div className="mt-2 flex justify-between items-center text-[9px] text-gray-500 font-semibold">
                    <span>By: {b.creator_id}</span>
                    <span className={`${b.status === 'open' ? 'text-green-500' : 'text-blue-500'}`}>{b.status.toUpperCase()}</span>
                  </div>
                </div>
              ))}
              {bounties.length === 0 && (
                <div className="text-[10px] text-gray-500 italic text-center py-4">No active bounties found</div>
              )}
            </div>
          </>
        ) : (
          <div className="space-y-3">
            <button onClick={() => { setSelectedBounty(null); setBountySolutionText(''); }} className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-white">
              <ArrowLeft size={14} /> Back to list
            </button>
            <div className={`p-3 rounded-lg border ${t.border} ${t.sec}`}>
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-bold text-[14px]">{selectedBounty.title}</h3>
                <span className="font-mono text-amber-500 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded">{selectedBounty.reward}</span>
              </div>
              <p className="text-[11px] text-gray-300 whitespace-pre-wrap">{selectedBounty.description}</p>
            </div>

            {selectedBounty.status === 'open' && (
              <div className={`p-3 rounded-lg border ${t.border} ${t.sec} space-y-2`}>
                <div className="text-[10px] font-bold text-gray-400">SUBMIT SOLUTION</div>
                <textarea value={bountySolutionText} onChange={(e) => setBountySolutionText(e.target.value)} placeholder="Paste your code or solution here..." rows="5" className={`w-full rounded border ${t.border} ${t.bg} ${t.text} p-2 text-[11px] font-mono`} />
                <button onClick={() => handleSubmitSolution(selectedBounty.id)} className="w-full py-1.5 rounded bg-[#089981] text-white font-bold text-[11px]">Submit for Review</button>
              </div>
            )}
            
            <div className="text-[10px] text-gray-500 italic px-1">Solutions for this bounty are managed on the backend. Creators can approve solutions to release funds.</div>
          </div>
        )}
      </div>
    );
  };




  /* renderRightSidePanel extracted to RightSidebar.tsx */

  const LeftToolbar = ({ horizontal = false }) => {
    const categories = [
      {
        id: 'cursor',
        title: 'Cursors',
        defaultIcon: MousePointer2,
        theme: {
          baseText: 'text-sky-400/60',
          text: 'text-sky-400',
          hover: 'hover:bg-sky-500/10 hover:text-sky-400',
          active: 'bg-sky-500/15 border-sky-400 text-sky-400 shadow-[0_0_15px_rgba(14,165,233,0.15)]'
        },
        items: [
          { id: 'crosshair', title: 'Crosshair', icon: MousePointer2 },
          { id: 'dot', title: 'Dot', icon: Circle },
          { id: 'arrow', title: 'Arrow', icon: MousePointer },
          { id: 'demonstration', title: 'Demonstration', icon: Play },
          { id: 'magic', title: 'Magic', icon: Wand2 },
          { id: 'eraser', title: 'Eraser', icon: Eraser },
        ]
      },
      {
        id: 'trend',
        title: 'Trend Lines',
        defaultIcon: Spline,
        theme: {
          baseText: 'text-cyan-400/60',
          text: 'text-cyan-400',
          hover: 'hover:bg-cyan-500/10 hover:text-cyan-400',
          active: 'bg-cyan-500/15 border-cyan-400 text-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.15)]'
        },
        items: [
          { id: 'trendline', title: 'Classic (Trend Line)', icon: Spline },
          { id: 'polyline', title: 'Poly-Line', icon: Route },
          { id: 'curve', title: 'Curve', icon: Activity },
          { id: 'ray', title: 'Ray', icon: ArrowUpRight },
          { id: 'infoline', title: 'Info Line', icon: Info },
          { id: 'extendedline', title: 'Extended Line', icon: MoveHorizontal },
          { id: 'trendangle', title: 'Trend Angle', icon: Compass },
          { id: 'channel', title: 'Parallel Channel', icon: SplitSquareHorizontal },
          { id: 'regression_trend', title: 'Regression Trend', icon: TrendingUp },
          { id: 'horizontal_line', title: 'Horizontal Line', icon: Minus },
          { id: 'horizontal_ray', title: 'Horizontal Ray', icon: ArrowRight },
          { id: 'vertical_line', title: 'Vertical Line', icon: MoveVertical },
          { id: 'crossline', title: 'Cross Line', icon: Plus },
        ]
      },
      {
        id: 'gann_fib',
        title: 'Gann & Fibonacci',
        defaultIcon: GitPullRequest,
        theme: {
          baseText: 'text-indigo-400/60',
          text: 'text-indigo-400',
          hover: 'hover:bg-indigo-500/10 hover:text-indigo-400',
          active: 'bg-indigo-500/15 border-indigo-400 text-indigo-400 shadow-[0_0_15px_rgba(129,140,248,0.15)]'
        },
        items: [
          { id: 'fibonacci', title: 'Fib Retracement', icon: ListTree },
          { id: 'fib_extension', title: 'Trend-Based Fib Extension', icon: Sliders },
          { id: 'fib_fan', title: 'Fib Speed Resistance Fan', icon: Baseline },
          { id: 'fib_timezone', title: 'Fibonacci Time Zone', icon: Columns },
          { id: 'gann_fan', title: 'Gann Fan', icon: Activity },
          { id: 'gann_square', title: 'Gann Square', icon: Grid3x3 },
          { id: 'gann_box', title: 'Gann Box', icon: Box },
          { id: 'pitchfork', title: 'Pitchfork', icon: GitPullRequest },
          { id: 'schiff_pitchfork', title: 'Schiff Pitchfork', icon: GitMerge },
        ]
      },
      {
        id: 'shape',
        title: 'Shapes',
        defaultIcon: PenTool,
        theme: {
          baseText: 'text-yellow-400/60',
          text: 'text-yellow-400',
          hover: 'hover:bg-yellow-500/10 hover:text-yellow-400',
          active: 'bg-yellow-500/15 border-yellow-400 text-yellow-400 shadow-[0_0_15px_rgba(234,179,8,0.15)]'
        },
        items: [
          { id: 'rectangle', title: 'Rectangle', icon: Square },
          { id: 'circle', title: 'Circle', icon: Circle },
          { id: 'ellipse', title: 'Ellipse', icon: Disc },
          { id: 'triangle', title: 'Triangle', icon: Triangle },
          { id: 'brush', title: 'Brush', icon: PenTool },
          { id: 'curve', title: 'Curve', icon: Spline },
        ]
      },
      {
        id: 'annotation',
        title: 'Annotations & Icons',
        defaultIcon: MessageSquareText,
        theme: {
          baseText: 'text-teal-400/60',
          text: 'text-teal-400',
          hover: 'hover:bg-teal-500/10 hover:text-teal-400',
          active: 'bg-teal-500/15 border-teal-400 text-teal-400 shadow-[0_0_15px_rgba(20,184,166,0.15)]'
        },
        items: [
          { id: 'text', title: 'Text', icon: Type },
          { id: 'note', title: 'Note', icon: FileText },
          { id: 'price_note', title: 'Price Note', icon: Tag },
          { id: 'callout', title: 'Callout', icon: MessageSquareText },
          { id: 'signpost', title: 'Signpost', icon: Signpost },
          { id: 'icon_up', title: 'Up Arrow ⬆️', icon: ArrowUp },
          { id: 'icon_down', title: 'Down Arrow ⬇️', icon: ArrowDown },
          { id: 'icon_star', title: 'Star ⭐', icon: Star },
          { id: 'icon_heart', title: 'Heart ❤️', icon: Heart },
        ]
      },
      {
        id: 'pattern',
        title: 'Patterns',
        defaultIcon: Waypoints,
        theme: {
          baseText: 'text-rose-400/60',
          text: 'text-rose-400',
          hover: 'hover:bg-rose-500/10 hover:text-rose-400',
          active: 'bg-rose-500/15 border-rose-400 text-rose-400 shadow-[0_0_15px_rgba(251,113,133,0.15)]'
        },
        items: [
          { id: 'xabcd', title: 'XABCD Pattern', icon: Waypoints },
          { id: 'abcd', title: 'ABCD Pattern', icon: Route },
          { id: 'triangle_pat', title: 'Triangle Pattern', icon: Triangle },
          { id: 'head_shoulders', title: 'Head & Shoulders', icon: Activity },
          { id: 'elliott_wave', title: 'Elliott Impulse Wave (1-2-3-4-5)', icon: TrendingUp },
        ]
      },
      {
        id: 'forecast',
        title: 'Prediction & Measurement',
        defaultIcon: Focus,
        theme: {
          baseText: 'text-red-400/60',
          text: 'text-red-500',
          hover: 'hover:bg-red-500/10 hover:text-red-500',
          active: 'bg-red-500/15 border-red-500 text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.15)]'
        },
        items: [
          { id: 'long_position', title: 'Long Position', icon: TrendingUp },
          { id: 'short_position', title: 'Short Position', icon: TrendingDown },
          { id: 'price_range', title: 'Price Range', icon: MoveVertical },
          { id: 'date_range', title: 'Date Range', icon: MoveHorizontal },
          { id: 'date_price_range', title: 'Date & Price Range', icon: Maximize },
        ]
      }
    ];

    if (horizontal) {
      return (
        <div className={`md:hidden flex items-center justify-around gap-0.5 px-1 py-1 border-t ${t.border} ${t.bg} shrink-0 overflow-x-auto mobile-scroll-x`}>
          <button
            onClick={() => { setActiveTool(null); showToast("Cursor Selected"); }}
            className={`p-2.5 min-w-[44px] rounded transition-all ${!activeTool ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : `${t.text} hover:bg-blue-500/10 hover:text-blue-500`}`}
          >
            <Crosshair size={18} />
          </button>
          <button
            onClick={() => { setActiveTool('trendline'); showToast("Trend Line Selected"); }}
            className={`p-2.5 min-w-[44px] rounded transition-all ${activeTool === 'trendline' ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/30' : `${t.text} hover:bg-cyan-400/10 hover:text-cyan-400`}`}
          >
            <TrendingUp size={18} />
          </button>
          <button
            onClick={() => { setActiveTool('fibonacci'); showToast("Fib Retracement Selected"); }}
            className={`p-2.5 min-w-[44px] rounded transition-all ${activeTool === 'fibonacci' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30' : `${t.text} hover:bg-indigo-400/10 hover:text-indigo-400`}`}
          >
            <AlignJustify size={18} />
          </button>
          <button
            onClick={() => { setActiveTool('rectangle'); showToast("Rectangle Selected"); }}
            className={`p-2.5 min-w-[44px] rounded transition-all ${activeTool === 'rectangle' ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30' : `${t.text} hover:bg-amber-500/10 hover:text-amber-500`}`}
          >
            <Square size={18} />
          </button>
          <button
            onClick={() => { setActiveTool('brush'); showToast("Brush Selected"); }}
            className={`p-2.5 min-w-[44px] rounded transition-all ${activeTool === 'brush' ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30' : `${t.text} hover:bg-amber-500/10 hover:text-amber-500`}`}
          >
            <Brush size={18} />
          </button>
          <button
            onClick={() => { setDrawings([]); showToast("Cleared all drawings"); }}
            className={`p-2.5 min-w-[44px] rounded transition-all text-red-400 hover:bg-red-500/10 hover:text-red-500`}
          >
            <Trash2 size={18} />
          </button>
        </div>
      );
    }

    return (
      <div className={`hidden md:flex w-12 shrink-0 border-r ${t.border} ${t.bg} flex-col items-center py-2.5 gap-1.5 z-40 relative select-none`}>
        {categories.map((cat) => {
          const activeSubToolId = selectedTools[cat.id];
          const activeSubTool = cat.items.find(item => item.id === activeSubToolId) || cat.items[0];
          const IconComponent = activeSubTool.icon;
          const isCurrentCatActive = activeTool === activeSubToolId;
          const isFlyoutOpen = activeFlyout === cat.id;

          return (
            <div key={cat.id} className="relative w-9 h-9 flex items-center justify-center group/cat">
              <button
                onClick={() => {
                  setActiveTool(isCurrentCatActive ? null : activeSubToolId);
                  setActiveFlyout(isFlyoutOpen ? null : cat.id);
                }}
                className={`w-9 h-9 border-l-2 border-transparent rounded-r-xl rounded-l-[3px] flex items-center justify-center transition-all relative ${
                  isCurrentCatActive ? (cat.theme?.active || 'bg-[#2962ff] text-white shadow-lg shadow-blue-500/20') : `${cat.theme?.baseText || t.muted} group-hover/cat:opacity-100 ${cat.theme?.hover || t.hover}`
                }`}
                title={`${cat.title}: ${activeSubTool.title}`}
              >
                <IconComponent size={18} strokeWidth={2} />
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveFlyout(isFlyoutOpen ? null : cat.id);
                  }}
                  className={`absolute bottom-0 right-0 w-2.5 h-2.5 text-[6px] font-bold opacity-60 group-hover/cat:opacity-100 flex items-end justify-end pointer-events-auto leading-[6px] select-none transition-colors ${isCurrentCatActive ? cat.theme?.text : cat.theme?.baseText || 'text-gray-500'} group-hover/cat:${cat.theme?.text || 'text-blue-500'}`}
                >
                  ◢
                </span>
              </button>

              {isFlyoutOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setActiveFlyout(null)} />
                  <div className={`absolute top-0 left-10 w-52 backdrop-blur-xl ${darkMode ? 'bg-[#1c2030]/90 text-white' : 'bg-white/95 text-[#131722] shadow-gray-400/50'} border ${t.border} rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] z-50 py-1 animate-fade-in`}>
                    <div className="px-3 py-1.5 border-b border-inherit text-[9px] text-gray-500 font-bold uppercase tracking-wider mb-1">
                      {cat.title}
                    </div>
                    {cat.id === 'cursor' && (
                      <button
                        onClick={() => {
                          setIsCursorStudioOpen(true);
                          setActiveFlyout(null);
                        }}
                        className="w-[calc(100%-16px)] mx-2 my-1.5 flex items-center justify-center gap-1.5 py-1 px-2.5 rounded border border-[#2962ff]/40 text-[#2962ff] hover:bg-[#2962ff]/10 text-[10.5px] font-extrabold transition-all"
                      >
                        <Plus size={11} className="text-[#2962ff]" />
                        <span>Cursor Studio</span>
                      </button>
                    )}
                    {cat.id === 'trend' && (
                      <button
                        onClick={() => {
                          setIsTrendStudioOpen(true);
                          setActiveFlyout(null);
                        }}
                        className="w-[calc(100%-16px)] mx-2 my-1.5 flex items-center justify-center gap-1.5 py-1 px-2.5 rounded border border-[#2962ff]/40 text-[#2962ff] hover:bg-[#2962ff]/10 text-[10.5px] font-extrabold transition-all"
                      >
                        <Plus size={11} className="text-[#2962ff]" />
                        <span>Trend Studio</span>
                      </button>
                    )}
                    {cat.items.map((item) => {
                      const SubIcon = item.icon;
                      const isSubActive = activeTool === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            setSelectedTools(prev => ({ ...prev, [cat.id]: item.id }));
                            setActiveTool(item.id);
                            setActiveFlyout(null);
                            showToast(`Selected: ${item.title}`);
                          }}
                          className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-[11.5px] font-semibold transition-colors ${
                            isSubActive ? (cat.theme?.active || 'bg-[#2962ff] text-white') : `${t.text} ${cat.theme?.hover || t.hover}`
                          }`}
                        >
                          <SubIcon size={13} />
                          <span>{item.title}</span>
                        </button>
                      );
                    })}
                    {cat.id === 'cursor' && (
                      <div className="px-3 py-1.5 border-t border-inherit mt-1.5 flex items-center justify-between">
                        <span className="text-[9.5px] text-gray-400 font-semibold">Values tooltip on long press</span>
                        <div className="relative inline-flex items-center cursor-pointer">
                          <input 
                            type="checkbox" 
                            className="sr-only peer" 
                            defaultChecked 
                            onChange={(e) => showToast(`Tooltip on press: ${e.target.checked ? 'ON' : 'OFF'}`)}
                          />
                          <div className="w-7 h-4 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-600"></div>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}

        <div className={`w-7 h-px my-0.5 ${t.border} bg-[#2a2e39]`} />

        {/* UTILITY TOOLS */}
        <div className={`w-8.5 h-px my-1 ${t.border} bg-[#2a2e39]/60`} />

        {/* UTILITY TOOLS */}
        <button
          onClick={() => {
            setActiveTool(prev => prev === 'ruler' ? null : 'ruler');
            showToast("Ruler (Measurement) Activated");
          }}
          className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
            activeTool === 'ruler' ? 'bg-[#2962ff] text-white shadow-lg shadow-blue-500/20' : `${t.muted} ${t.hover}`
          }`}
          title="Measure (Ruler)"
        >
          <Ruler size={18} strokeWidth={2} />
        </button>

        {/* ZOOM TOOLS FLYOUT */}
        <div className="relative w-9 h-9 flex items-center justify-center group/cat">
          <button
            onClick={() => {
              if (chartInstance.current) {
                chartInstance.current.timeScale().zoomIn();
                showToast("Zoom In");
              }
            }}
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${t.muted} ${t.hover}`}
            title="Zoom Tools"
          >
            <ZoomIn size={18} strokeWidth={2} />
            <span
              onClick={(e) => {
                e.stopPropagation();
                setActiveFlyout(activeFlyout === 'zoom' ? null : 'zoom');
              }}
              className="absolute bottom-0 right-0 w-2.5 h-2.5 text-[6px] font-bold text-gray-500 opacity-60 group-hover/cat:opacity-100 flex items-end justify-end pointer-events-auto leading-[6px] select-none hover:text-blue-500"
            >
              ◢
            </span>
          </button>
          
          {activeFlyout === 'zoom' && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setActiveFlyout(null)} />
              <div className={`absolute top-0 left-10 w-40 backdrop-blur-xl ${darkMode ? 'bg-[#1c2030]/90 text-white' : 'bg-white/95 text-[#131722] shadow-gray-400/50'} border ${t.border} rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] z-50 py-1 animate-fade-in`}>
                <div className="px-3 py-1.5 border-b border-inherit text-[9px] text-gray-500 font-bold uppercase tracking-wider mb-1">
                  Zoom Tools
                </div>
                <button
                  onClick={() => {
                    if (chartInstance.current) chartInstance.current.timeScale().zoomIn();
                    setActiveFlyout(null);
                    showToast("Zoom In");
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-[11.5px] font-semibold transition-colors ${t.text} ${t.hover}`}
                >
                  <ZoomIn size={13} />
                  <span>Zoom In</span>
                </button>
                <button
                  onClick={() => {
                    if (chartInstance.current) chartInstance.current.timeScale().zoomOut();
                    setActiveFlyout(null);
                    showToast("Zoom Out");
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-[11.5px] font-semibold transition-colors ${t.text} ${t.hover}`}
                >
                  <ZoomOut size={13} />
                  <span>Zoom Out</span>
                </button>
                <button
                  onClick={() => {
                    if (chartInstance.current) chartInstance.current.timeScale().fitContent();
                    setActiveFlyout(null);
                    showToast("Reset Zoom");
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-[11.5px] font-semibold transition-colors ${t.text} ${t.hover}`}
                >
                  <Maximize size={13} />
                  <span>Reset Zoom</span>
                </button>
              </div>
            </>
          )}
        </div>

        <button
          onClick={() => {
            setMagnetMode(prev => {
              const next = prev === 'off' ? 'weak' : prev === 'weak' ? 'strong' : 'off';
              showToast(`Snapping Mode: ${next.toUpperCase()}`);
              return next;
            });
          }}
          className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors relative ${
            magnetMode !== 'off' ? 'bg-[#7C5CFF]/15 text-[#7C5CFF]' : `${t.muted} ${t.hover}`
          }`}
          title={`Magnet Snapping Mode: ${magnetMode.toUpperCase()}`}
        >
          <Magnet size={18} strokeWidth={2} />
          {magnetMode !== 'off' && (
            <span className={`absolute top-1 right-1 w-1.5 h-1.5 rounded-full ${magnetMode === 'strong' ? 'bg-indigo-500 animate-pulse' : 'bg-blue-400'}`} />
          )}
        </button>

        <button
          onClick={() => {
            setKeepDrawing(!keepDrawing);
            showToast(`Keep Drawing Tool: ${!keepDrawing ? 'ON' : 'OFF'}`);
          }}
          className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
            keepDrawing ? 'bg-amber-500/15 text-amber-500' : `${t.muted} ${t.hover}`
          }`}
          title={`Keep Drawing Tool: ${keepDrawing ? 'Lock Active' : 'Off'}`}
        >
          <Lock size={18} strokeWidth={2} className={keepDrawing ? 'text-amber-500' : ''} />
        </button>
        {/* ⚡ Rendering Engine Toggle */}
          <button
            onClick={handleEngineToggle}
            className={`w-9 h-9 rounded-lg flex items-center justify-center relative transition-all duration-300 ${
              renderEngine === 'webgpu'
                ? 'bg-purple-500/20 text-purple-400 shadow-[0_0_12px_rgba(168,85,247,0.25)]'
                : renderEngine === 'webgl' 
                ? 'bg-emerald-500/20 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.25)]' 
                : `${t.muted} ${t.hover}`
            }`}
            title={renderEngine === 'webgpu' ? 'Rendering: WebGPU (Extreme Performance)' : renderEngine === 'webgl' ? 'Rendering: WebGL (GPU Accelerated)' : 'Rendering: Canvas 2D'}
          >
            {renderEngine === 'webgpu' ? (
              <Rocket size={18} strokeWidth={2} className="drop-shadow-[0_0_4px_rgba(168,85,247,0.6)]" />
            ) : (
              <Zap size={18} strokeWidth={2} className={renderEngine === 'webgl' ? 'drop-shadow-[0_0_4px_rgba(16,185,129,0.6)]' : ''} />
            )}
            
            {renderEngine === 'webgpu' ? (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-purple-400 animate-pulse shadow-[0_0_4px_rgba(168,85,247,0.8)]" />
            ) : renderEngine === 'webgl' ? (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_4px_rgba(16,185,129,0.8)]" />
            ) : null}
          </button>
          <div className="w-6 h-px bg-border my-1" />
          
          {/* MANAGE DRAWINGS FLYOUT */}
        <div className="relative w-9 h-9 flex items-center justify-center group/cat mt-auto mb-2">
          <button
            onClick={() => setActiveFlyout(activeFlyout === 'manage' ? null : 'manage')}
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
              lockDrawings || hideDrawings ? 'bg-red-500/15 text-red-500' : `${t.muted} ${t.hover}`
            }`}
            title="Manage Drawings"
          >
            {hideDrawings ? <EyeOff size={18} strokeWidth={2} /> : lockDrawings ? <Lock size={18} strokeWidth={2} /> : <Shapes size={18} strokeWidth={2} />}
            <span
              className="absolute bottom-0 right-0 w-2.5 h-2.5 text-[6px] font-bold text-gray-500 opacity-60 group-hover/cat:opacity-100 flex items-end justify-end pointer-events-auto leading-[6px] select-none hover:text-blue-500"
            >
              ◢
            </span>
          </button>
          
          {activeFlyout === 'manage' && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setActiveFlyout(null)} />
              <div className={`absolute bottom-0 left-10 w-44 backdrop-blur-xl ${darkMode ? 'bg-[#1c2030]/90 text-white' : 'bg-white/95 text-[#131722] shadow-gray-400/50'} border ${t.border} rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] z-50 py-1 animate-fade-in origin-bottom-left`}>
                <div className="px-3 py-1.5 border-b border-inherit text-[9px] text-gray-500 font-bold uppercase tracking-wider mb-1">
                  Manage Drawings
                </div>
                <button
                  onClick={() => {
                    setLockDrawings(!lockDrawings);
                    showToast(`Lock all drawings: ${!lockDrawings ? 'LOCKED' : 'UNLOCKED'}`);
                    setActiveFlyout(null);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-1.5 text-left text-[11.5px] font-semibold transition-colors ${
                    lockDrawings ? 'text-red-400 bg-white/5' : `${t.text} ${t.hover}`
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {lockDrawings ? <Lock size={13} /> : <Unlock size={13} />}
                    <span>Lock All</span>
                  </div>
                  {lockDrawings && <span className="text-[9px] text-red-400 font-black">ON</span>}
                </button>
                <button
                  onClick={() => {
                    setHideDrawings(!hideDrawings);
                    showToast(`Drawings visibility: ${!hideDrawings ? 'HIDDEN' : 'VISIBLE'}`);
                    setActiveFlyout(null);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-1.5 text-left text-[11.5px] font-semibold transition-colors ${
                    hideDrawings ? 'text-red-400 bg-white/5' : `${t.text} ${t.hover}`
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {hideDrawings ? <EyeOff size={13} /> : <Eye size={13} />}
                    <span>Hide All</span>
                  </div>
                  {hideDrawings && <span className="text-[9px] text-red-400 font-black">ON</span>}
                </button>
                <div className="border-t border-inherit my-1" />
                <button
                  onClick={() => {
                    if (confirm("Clear all drawings on the chart?")) {
                      setDrawings([]);
                      showToast("Drawings cleared");
                      setActiveFlyout(null);
                    }
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-[11.5px] font-semibold text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 size={13} />
                  <span>Clear All Drawings</span>
                </button>
              </div>
            </>
          )}
        </div>
        <div className={`w-8.5 h-px my-1 ${t.border} bg-[#2a2e39]/60`} />

        {sideTools.map(({ id, icon: Icon, title, action }) => (
          <button
            key={id}
            onClick={action}
            className={`w-9 h-9 rounded-lg transition-colors flex items-center justify-center ${
              (id === 'ai' && leftPanel === 'ai') || (id === 'indicators' && leftPanel === 'indicators') || (id === 'alerts' && leftPanel === 'alerts')
                || (id === 'pine' && isEditorOpen && editorMode === 'pine') || (id === 'python' && isEditorOpen && editorMode === 'python')
                ? id === 'ai' ? 'bg-[#7C5CFF] text-white shadow-lg shadow-purple-500/20' : id === 'python' ? 'bg-[#7C5CFF] text-white shadow-lg shadow-purple-500/20' : 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                : `${t.muted} ${darkMode ? 'hover:bg-[#1e222d]' : 'hover:bg-[#f0f3fa]'}`
            }`}
            title={title}
          >
            <Icon size={18} strokeWidth={2} />
          </button>
        ))}
      </div>
    );
  };

  const pineHistoryIndexRef = useRef(pineHistoryIndex);
  const pythonHistoryIndexRef = useRef(pythonHistoryIndex);

  useEffect(() => {
    pineHistoryIndexRef.current = pineHistoryIndex;
  }, [pineHistoryIndex]);

  useEffect(() => {
    pythonHistoryIndexRef.current = pythonHistoryIndex;
  }, [pythonHistoryIndex]);

  const handleCodeChange = useCallback((val) => {
    if (editorMode === 'pine') {
      setPineCode(val);
      setPineCodeHistory((prev) => {
        const newHist = prev.slice(0, pineHistoryIndexRef.current + 1);
        newHist.push(val);
        pineHistoryIndexRef.current = newHist.length - 1;
        setPineHistoryIndex(pineHistoryIndexRef.current);
        return newHist;
      });
    } else {
      setPythonCode(val);
      setPythonCodeHistory((prev) => {
        const newHist = prev.slice(0, pythonHistoryIndexRef.current + 1);
        newHist.push(val);
        pythonHistoryIndexRef.current = newHist.length - 1;
        setPythonHistoryIndex(pythonHistoryIndexRef.current);
        return newHist;
      });
    }
  }, [editorMode]);
  
  // No longer using executeEdits 'update-code' logic here since Monaco is now fully controlled via component props correctly

  const historyIndex = editorMode === 'pine' ? pineHistoryIndex : pythonHistoryIndex;
  const codeHistory = editorMode === 'pine' ? pineCodeHistory : pythonCodeHistory;

  const handleUndo = () => {
    if (editorMode === 'pine') {
      if (pineHistoryIndex <= 0) return;
      const next = pineHistoryIndex - 1;
      setPineHistoryIndex(next);
      setPineCode(pineCodeHistory[next]);
    } else {
      if (pythonHistoryIndex <= 0) return;
      const next = pythonHistoryIndex - 1;
      setPythonHistoryIndex(next);
      setPythonCode(pythonCodeHistory[next]);
    }
  };

  const handleRedo = () => {
    if (editorMode === 'pine') {
      if (pineHistoryIndex >= pineCodeHistory.length - 1) return;
      const next = pineHistoryIndex + 1;
      setPineHistoryIndex(next);
      setPineCode(pineCodeHistory[next]);
    } else {
      if (pythonHistoryIndex >= pythonCodeHistory.length - 1) return;
      const next = pythonHistoryIndex + 1;
      setPythonHistoryIndex(next);
      setPythonCode(pythonCodeHistory[next]);
    }
  };

  const handleExchangeChange = (exchangeId) => {
    if (exchangeId === selectedExchange) return;
    setSelectedExchange(exchangeId);
    setMarketStatus('Loading');
    setCoinInput('');
    setIsDropdownOpen(false);
    isFirstLoad.current = true;
    showToast(`Exchange: ${getExchangeMeta(exchangeId).name}`);
  };

  const executeSearch = (targetCoin) => {
    const cu = targetCoin.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!cu) return;

    let symbol = cu;
    const known = binanceCoinSetRef.current;

    if (known.size > 0) {
      if (known.has(cu)) {
        symbol = cu;
      } else {
        const matches = binanceCoins.filter((c) => c.includes(cu));
        const exactStart = matches.filter((c) => c.startsWith(cu));
        if (exactStart.length === 1) symbol = exactStart[0];
        else if (matches.length === 1) symbol = matches[0];
        else if (matches.length === 0) {
          showToast(`⚠️ ${cu} not on ${getExchangeMeta(selectedExchange).name}`);
          return;
        } else {
          setCoinInput(cu);
          setIsDropdownOpen(true);
          return;
        }
      }
    }

    if (symbol === selectedCoin) return;
    setSelectedCoin(symbol);
    setMarketStatus('Loading');
    setIsDropdownOpen(false);
    setCoinInput('');
    document.getElementById('smart-search')?.blur();
  };

  const applyAiCode = (code) => {
    if (!code?.trim()) return;
    handleCodeChange(code);
    setSubView('code');
    setShowDiff(false);
    showToast('✅ AI code applied to editor');
  };

  const sendAiMessage = async (mode = 'chat', overridePrompt = null) => {
    const prompt = (overridePrompt ?? aiPrompt).trim();
    if (!prompt && mode === 'chat') return;

    const provider = aiProvider;
    if (provider === 'gemini' && !aiKeysReady.gemini) {
      showToast('❌ Gemini API key missing in backend/.env');
      return;
    }
    if (provider === 'groq' && !aiKeysReady.groq) {
      showToast('❌ Groq API key missing in backend/.env');
      return;
    }

    setAiLoading(true);
    setSyntaxStatus('AI thinking...');
    setSubView('ai');
    setIsEditorOpen(true);

    const userLabel = prompt || { generate: 'Generate strategy', fix: 'Fix my code', explain: 'Explain strategy', optimize: 'Optimize strategy' }[mode] || 'AI request';
    appendAiMessage({ role: 'user', content: userLabel });

    try {
      const res = await fetch(`${API_BASE}/ai/assist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          prompt,
          mode,
          code: editorMode === 'pine' ? pineCode : pythonCode,
          language: editorMode,
          ticker: selectedCoin,
          timeframe: chartInterval,
          exchange: selectedExchange,
          context: {
            selectedCoin,
            exchange: selectedExchange,
            timeframe: chartInterval,
            editorMode,
            livePrice,
            marketStatus,
            priceColor,
            activeTab,
            backendOnline,
          },
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      appendAiMessage({ role: 'assistant', content: data.reply, code: data.code });
      setAiPrompt('');
      setSyntaxStatus('AI ready.');
    } catch (e) {
      console.warn('Backend AI fallback to Client-Side AI Strategy Engine:', e);
      const clientGeneratedCode = aiStrategyEngine.generateFromPrompt(prompt || 'EMA crossover with RSI', editorMode);
      appendAiMessage({
        role: 'assistant',
        content: `⚡ **Client-Side AI Strategy Engine (Phase 5)**\n\nGenerated strategy for: "${prompt || 'EMA Crossover'}"`,
        code: clientGeneratedCode
      });
      setAiPrompt('');
      setSyntaxStatus('Client AI Ready.');
      showToast('⚡ Client AI Strategy Generated ✓');
    } finally {
      setAiLoading(false);
    }
  };

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

  const renderDiffViewer = () => {
    try {
      const safeBase = typeof baseCode === 'string' ? baseCode : '';
      const targetCode = editorMode === 'pine' ? pineCode : pythonCode;
      const safeTarget = typeof targetCode === 'string' ? targetCode : '';
      const oldLines = safeBase.split('\n');
      const newLines = safeTarget.split('\n');
      const max = Math.max(oldLines.length, newLines.length);
      const elements = [];
      for (let i = 0; i < max; i += 1) {
        if (oldLines[i] !== newLines[i]) {
          if (oldLines[i] !== undefined) elements.push(<div key={`old-${i}`} className="bg-red-900/30 text-red-400 px-2 py-0.5 border-l-2 border-red-500 font-mono text-xs whitespace-pre">- {oldLines[i]}</div>);
          if (newLines[i] !== undefined) elements.push(<div key={`new-${i}`} className="bg-emerald-900/30 text-emerald-400 px-2 py-0.5 border-l-2 border-emerald-500 font-mono text-xs whitespace-pre">+ {newLines[i]}</div>);
        } else {
          elements.push(<div key={`same-${i}`} className={`${t.muted} px-2 py-0.5 font-mono text-xs whitespace-pre`}>  {oldLines[i]}</div>);
        }
      }
      return elements;
    } catch (e) {
      console.error('renderDiffViewer error', e);
      return [<div key="diff-error" className={`${t.muted} px-2 py-2 font-mono text-xs`}>Diff render error</div>];
    }
  };

  const renderTriangleRIcon = () => (
      <div className="relative flex items-center justify-center w-6 h-6">
        <Code2 size={16} />
      </div>
  );

  const getLowerBoxHeight = () => {
    if (focusMode) return 'hidden h-0 border-t-0 opacity-0 overflow-hidden';
    if (lowerBoxState === 'hidden') return 'h-0 border-t-0 opacity-0 overflow-hidden';
    if (lowerBoxState === 'minimized') return 'h-[42px] shrink-0';
    if (lowerBoxState === 'maximized') {
      return 'absolute inset-0 z-40 h-full w-full';
    }
    return isMobile ? 'h-[30vh] min-h-[160px] max-h-[50vh] shrink-0' : 'flex-1 min-h-[180px]';
  };

  const timeframeButtons = [
    { label: '1m', val: '1m' }, { label: '3m', val: '3m' }, { label: '5m', val: '5m' },
    { label: '15m', val: '15m' }, { label: '30m', val: '30m' }, { label: '1h', val: '1h' },
    { label: '2h', val: '2h' }, { label: '4h', val: '4h' }, { label: '1D', val: '1d' },
    { label: '1W', val: '1w' }, { label: '1M', val: '1M' },
  ];
  
  const applyCustomTimeframe = () => {
    const val = customTimeframeInput.trim();
    if (!CUSTOM_TIMEFRAME_REGEX.test(val)) {
      showToast('Format galat — jaise 45m, 2h, 9d, 1w likho');
      return;
    }
    setChartInterval(val);
    showToast(`Custom timeframe: ${val}`);
    setCustomTimeframeInput('');
  };

  // --- FIXED EDITOR PANEL (No more mouse focus loss) ---
  const renderEditorPanel = (className = '', onClose = null) => (
    <div className={`flex flex-col h-full ${className}`}>
      <div className={`h-11 border-b ${t.border} flex items-center justify-between px-3 shrink-0 ${t.bg}`}>
        <div className="flex items-center gap-1.5">
          {renderTriangleRIcon()}
          <span className={`font-bold ${t.text} text-sm ml-1`}>Editor</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={runBacktest} disabled={loading} className={`w-9 h-9 md:w-7 md:h-7 ${t.bg} border ${t.border} ${t.text} rounded hover:bg-[#7C5CFF]/10 hover:text-[#7C5CFF] hover:border-[#7C5CFF] flex items-center justify-center transition-colors`}>
            {loading ? <RefreshCw size={13} className="animate-spin" /> : <Play size={13} fill="currentColor" />}
          </button>
          {onClose && (
            <button onClick={onClose} className={`p-2 ${t.muted} ${t.hover} rounded-md`} aria-label="Close editor">
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      <div className={`flex gap-2 px-2 py-1 ${t.bg} border-b ${t.border} overflow-x-auto dark-scrollbar`}>
        <button onClick={() => { setEditorMode('pine'); setBaseCode(pineCode); setShowDiff(false); }} className={`px-3 py-1.5 md:px-2 md:py-0.5 rounded text-xs font-medium transition-colors shrink-0 whitespace-nowrap ${editorMode === 'pine' ? 'bg-[#7C5CFF]/10 text-[#7C5CFF]' : `${t.muted} ${t.hover}`}`}>Pine Script</button>
        <button onClick={() => { setEditorMode('python'); setBaseCode(pythonCode); setShowDiff(false); }} className={`px-3 py-1.5 md:px-2 md:py-0.5 rounded text-xs font-medium transition-colors shrink-0 whitespace-nowrap ${editorMode === 'python' ? 'bg-purple-500/15 text-purple-400' : `${t.muted} ${t.hover}`}`}>Python</button>
      </div>

      <div className={`flex items-center gap-1 px-2 py-1 border-b ${t.border} ${t.bg} overflow-x-auto dark-scrollbar`}>
        <button onClick={() => setSubView('code')} className={`px-2 py-1 rounded text-[11px] font-medium shrink-0 whitespace-nowrap ${getSubView() === 'code' ? 'bg-[#7C5CFF]/10 text-[#7C5CFF]' : t.muted}`}>Code</button>
        <button onClick={() => setSubView('ai')} className={`px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 shrink-0 whitespace-nowrap ${getSubView() === 'ai' ? 'bg-purple-500/15 text-purple-400' : t.muted}`}>
          <Sparkles size={11} /> AI
        </button>
        {getSubView() === 'ai' && (
          <select value={aiProvider} onChange={(e) => setAiProvider(e.target.value)} className={`ml-auto shrink-0 text-[10px] rounded px-1.5 py-0.5 border ${t.border} ${t.bg} ${t.text}`}>
            <option value="groq">Groq</option>
            <option value="gemini">Gemini</option>
          </select>
        )}
      </div>

      {getSubView() === 'code' ? (
        <>
          <div className={`h-9 md:h-8 border-b ${t.border} flex items-center px-2 gap-1 shrink-0 ${t.bg} overflow-x-auto dark-scrollbar`}>
            <button onClick={handleUndo} disabled={historyIndex === 0} className={`p-1.5 md:p-1 rounded transition-colors shrink-0 ${historyIndex === 0 ? t.border : `${t.muted} ${t.hover}`}`}><Undo size={13} /></button>
            <button onClick={handleRedo} disabled={historyIndex >= codeHistory.length - 1} className={`p-1.5 md:p-1 rounded transition-colors shrink-0 ${historyIndex >= codeHistory.length - 1 ? t.border : `${t.muted} ${t.hover}`}`}><Redo size={13} /></button>
            <div className={`h-3 w-px shrink-0 ${darkMode ? 'bg-[#2a2e39]' : 'bg-[#e0e3eb]'} mx-1`} />
            <button onClick={() => { setBaseCode(editorMode === 'pine' ? pineCode : pythonCode); setShowDiff(!showDiff); }} className={`flex items-center gap-1 px-2 py-1 rounded text-xs shrink-0 whitespace-nowrap ${t.muted} ${t.hover}`}><FileDiff size={12} /> {showDiff ? 'Close' : 'Changes'}</button>
            <button onClick={() => sendAiMessage('fix')} className={`flex items-center gap-1 px-2 py-1 rounded text-xs text-purple-400 shrink-0 whitespace-nowrap ${t.hover}`}><Sparkles size={12} /> AI Fix</button>
            {editorMode === 'python' && (
              <button type="button" onClick={() => { handleCodeChange(DEFAULT_PYTHON_STRATEGY); showToast('EMA sample loaded'); }} className={`flex items-center gap-1 px-2 py-1 rounded text-xs text-purple-400 shrink-0 whitespace-nowrap ${t.hover}`}>EMA sample</button>
            )}
          </div>

          {showDiff ? (
            <div className={`flex-1 min-h-0 ${t.bg} overflow-y-auto p-4 dark-scrollbar`}>{renderDiffViewer()}</div>
          ) : (
            <div className={`flex-1 min-h-0 pt-2 ${t.bg}`}>
              <Editor
                height="100%"
                language={editorMode === 'pine' ? 'javascript' : 'python'}
                theme={darkMode ? 'vs-dark' : 'light'}
                value={editorMode === 'pine' ? pineCode : pythonCode}
                onChange={handleCodeChange}
                onMount={(editor, monaco) => {
                  monacoEditorRef.current = editor;
                }}
                options={{
                  minimap: { enabled: false },
                  fontSize: 13,
                  wordWrap: 'on',
                  scrollBeyondLastLine: false,
                  smoothScrolling: true,
                  cursorBlinking: "smooth",
                  formatOnPaste: true,
                  suggestOnTriggerCharacters: true,
                  fontFamily: "'Fira Code', 'Consolas', 'Courier New', monospace"
                }}
              />
            </div>
          )}
        </>
      ) : (
        <AiChatPanel />
      )}

      <div className={`h-7 border-t ${t.border} flex items-center justify-between gap-2 px-3 font-medium text-[10px] ${t.bg} transition-colors shrink-0 safe-bottom`}>
        <span className={`${t.muted} truncate`}>{syntaxStatus}</span>
        <button
          type="button"
          onClick={() => checkBackend().then((ok) => showToast(ok ? '✅ API connected' : '❌ API offline — npm run backend'))}
          className={`shrink-0 px-1.5 py-0.5 rounded font-bold ${
            backendOnline === true ? 'text-[#089981]' : backendOnline === false ? 'text-[#F23645]' : t.muted
          }`}
          title="Backtest / AI server (port 8000)"
        >
          API {backendOnline === true ? '●' : backendOnline === false ? '○' : '…'}
        </button>
      </div>
    </div>
  );
  
  const filteredCoins = useMemo(() => {
    const q = coinInput.toUpperCase().trim();
    let list = q
      ? binanceCoins.filter((coin) => coin.includes(q))
      : binanceCoins;

    if (q) {
      list = [...list].sort((a, b) => {
        const aStarts = a.startsWith(q) ? 0 : 1;
        const bStarts = b.startsWith(q) ? 0 : 1;
        if (aStarts !== bStarts) return aStarts - bStarts;
        return a.localeCompare(b);
      });
    }

    return list.slice(0, 200);
  }, [binanceCoins, coinInput]);

  const quoteLabel = getQuoteAsset(selectedCoin) || 'Quote';
  const formatNumber = (value, decimals = 2) => {
    const num = parseBacktestNumber(value);
    if (!Number.isFinite(num)) return '0';
    return num.toLocaleString(undefined, {
      minimumFractionDigits: Math.abs(num) === 0 ? 0 : decimals,
      maximumFractionDigits: decimals,
    });
  };
  const formatMoney = (value, signed = false) => {
    const num = parseBacktestNumber(value);
    const prefix = signed && num > 0 ? '+' : '';
    return `${prefix}${formatNumber(num)} ${quoteLabel}`;
  };
  const equityChartData = metrics.performance.equityChart?.length
    ? metrics.performance.equityChart
    : [{ trade: 'Start', date: 'Start', equity: 10000, pnl: 0, drawdown: 0 }];

  const winRateChartData = useMemo(() => {
    const trades = Array.isArray(metrics.trades) ? metrics.trades : [];
    if (!trades.length) {
      return [{ trade: 'Start', winRate: 0 }];
    }
    let wins = 0;
    return trades.map((t, i) => {
      if ((t?.profit ?? 0) > 0) wins += 1;
      const pct = (wins / (i + 1)) * 100;
      return { trade: `T${i + 1}`, winRate: Math.round(pct * 100) / 100 };
    });
  }, [metrics.trades]);

  // --- NAYE CHARTS KE LIYE DATA PREPARATION --- //
  
  const profitDistribution = useMemo(() => {
    if (!metrics.trades?.length) return [];
    const buckets = { '< -5%': 0, 'Small Loss': 0, 'Breakeven': 0, 'Small Win': 0, '> +5%': 0 };
    metrics.trades.forEach(t => {
      const p = parseFloat(t.profit);
      if (p <= -5) buckets['< -5%']++;
      else if (p < 0) buckets['Small Loss']++;
      else if (p === 0) buckets['Breakeven']++;
      else if (p < 5) buckets['Small Win']++;
      else buckets['> +5%']++;
    });
    return Object.keys(buckets).map(key => ({ name: key, count: buckets[key] }));
  }, [metrics.trades]);

  const longShortData = useMemo(() => {
    const data = [
      { name: 'Long Wins', value: metrics.advanced.longWins || 0, color: '#089981' },
      { name: 'Long Losses', value: (metrics.advanced.longTotal - (metrics.advanced.longWins || 0)) || 0, color: '#26a69a' },
      { name: 'Short Wins', value: metrics.advanced.shortWins || 0, color: '#F23645' },
      { name: 'Short Losses', value: (metrics.advanced.shortTotal - (metrics.advanced.shortWins || 0)) || 0, color: '#ff5252' },
    ];
    return data.filter(d => d.value > 0); 
  }, [metrics.advanced]);

  return (
    <>
      {stealthMode && (
        <div className="fixed inset-0 flex flex-col pointer-events-none z-[9999] bg-transparent">
        <div className="mt-4 ml-4 bg-[#0F1117]/95 backdrop-blur-xl border border-[rgba(255,255,255,0.08)] rounded-2xl p-4 flex flex-col pointer-events-auto shadow-[0_8px_32px_rgba(0,0,0,0.7)] w-52 animate-fade-in group hover:border-[rgba(41,98,255,0.4)] transition-all duration-300">
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-white font-black text-[13px] uppercase tracking-wider">{selectedCoin}</span>
              </div>
              <button onClick={() => { setStealthMode(false); document.body.style.background = ''; }} className="text-gray-500 hover:text-white transition-colors p-1 rounded hover:bg-[#2a2e39]" title="Exit Focus Mode">
                <X size={14}/>
              </button>
            </div>
            <div className={`text-[28px] font-mono font-black tracking-tight ${watchlistTickers[selectedCoin]?.change >= 0 ? 'text-[#089981]' : 'text-[#f23645]'}`}>
              ${livePrice ? formatNumber(livePrice, 2) : '---'}
            </div>
            <div className={`text-[12px] font-bold mt-1 ${watchlistTickers[selectedCoin]?.change >= 0 ? 'text-[#089981]' : 'text-[#f23645]'}`}>
              {watchlistTickers[selectedCoin]?.change >= 0 ? '+' : ''}{watchlistTickers[selectedCoin]?.change?.toFixed(2) || '0.00'}% <span className="text-gray-500 text-[10px] font-medium ml-1">24h</span>
            </div>
          </div>
        </div>
      )}
      <div className={`flex flex-col h-[100dvh] w-full ${t.bg} ${t.text} font-sans text-xs select-none overflow-hidden relative transition-all duration-300 safe-top`} style={{ opacity: stealthMode ? 0 : 1, pointerEvents: stealthMode ? 'none' : 'auto' }}>

      <style>{`
        a[href*="tradingview.com"], #tv-attr-logo, [class*="watermark-logo"], [class*="tv-logo"] { 
          display: none !important; opacity: 0 !important; visibility: hidden !important; pointer-events: none !important; width: 0 !important; height: 0 !important; 
        }
        
        .dark-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
        .dark-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .dark-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 10px; }
        .dark-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.14); }
      `}</style>

      {activeModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center justify-center backdrop-blur-sm transition-opacity p-0 md:p-4">
          <div className={`${t.bg} rounded-t-2xl md:rounded-xl shadow-2xl w-full md:w-${activeModal.type === 'indicators_search' ? '[760px]' : '[440px]'} max-h-[85vh] overflow-hidden border ${t.border}`}>
            <div className={`h-12 border-b ${t.border} flex items-center justify-between px-4 ${t.sec}`}>
              <h3 className={`font-bold ${t.text} text-[14px]`}>{activeModal.title || 'Panel'}</h3>
              <button onClick={closeModal} className={`p-2 ${t.muted} ${t.hover} rounded-md`}><X size={16} /></button>
            </div>
            <div className="p-4 overflow-y-auto dark-scrollbar max-h-[70vh]">
              {activeModal.type === 'indicators_search' ? (
                <div className="flex flex-col h-[70vh] md:h-[500px] min-h-0 min-w-0">
                  {/* Search bar row */}
                  <div className="p-3 border-b border-[#2a2e39]/50 flex items-center gap-2">
                    <Search size={16} className="text-gray-400" />
                    <input 
                      type="text" 
                      placeholder="Search indicators, metrics and strategies..." 
                      value={indicatorSearchQuery}
                      onChange={(e) => setIndicatorSearchQuery(e.target.value)}
                      className="flex-1 bg-transparent text-[13px] text-white outline-none placeholder-gray-500 font-medium"
                    />
                  </div>

                  {/* Tabs Selector row */}
                  <div className="flex items-center gap-1.5 px-4 py-2 border-b border-[#2a2e39]/30 text-[11px] font-bold text-gray-400 select-none shrink-0 overflow-x-auto">
                    {['Indicators', 'Strategies', 'Profiles', 'Patterns'].map(sub => (
                      <button 
                        key={sub} 
                        onClick={() => setIndicatorCategorySubTab(sub)} 
                        className={`px-3 py-1 rounded-full transition-all ${indicatorCategorySubTab === sub ? 'bg-white text-black' : 'hover:bg-gray-800 hover:text-white'}`}
                      >
                        {sub}
                      </button>
                    ))}
                  </div>

                  {/* Body grid */}
                  <div className="flex flex-1 min-h-0 min-w-0">
                    {/* Left Sidebar */}
                    <div className="w-[180px] md:w-[220px] border-r border-[#2a2e39]/50 overflow-y-auto p-2 flex flex-col gap-3.5 select-none shrink-0 font-semibold">
                      <div>
                        <div className="text-[10px] text-gray-500 uppercase font-extrabold tracking-wider px-2.5 mb-1.5">Personal</div>
                        {['My scripts', 'Purchased'].map(tab => (
                          <button 
                            key={tab} 
                            onClick={() => setSelectedIndicatorTab(tab)} 
                            className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[11.5px] transition-colors ${selectedIndicatorTab === tab ? 'bg-blue-500/10 text-blue-400 font-bold' : `text-gray-400 ${t.hover}`}`}
                          >
                            {tab}
                          </button>
                        ))}
                      </div>

                      <div>
                        <div className="text-[10px] text-gray-500 uppercase font-extrabold tracking-wider px-2.5 mb-1.5">Built-In</div>
                        {['Technicals', 'Fundamentals'].map(tab => (
                          <button 
                            key={tab} 
                            onClick={() => setSelectedIndicatorTab(tab)} 
                            className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[11.5px] transition-colors ${selectedIndicatorTab === tab ? 'bg-blue-500/10 text-blue-400 font-bold' : `text-gray-400 ${t.hover}`}`}
                          >
                            {tab}
                          </button>
                        ))}
                      </div>

                      <div>
                        <div className="text-[10px] text-gray-500 uppercase font-extrabold tracking-wider px-2.5 mb-1.5">Community</div>
                        {["Editors' picks", 'Top', 'Trending', 'Store'].map(tab => (
                          <button 
                            key={tab} 
                            onClick={() => setSelectedIndicatorTab(tab)} 
                            className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[11.5px] transition-colors ${selectedIndicatorTab === tab ? 'bg-blue-500/10 text-blue-400 font-bold' : `text-gray-400 ${t.hover}`}`}
                          >
                            {tab}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Right Results list */}
                    <div className="flex-1 overflow-y-auto dark-scrollbar p-3 space-y-1">
                      {/* Filter results based on left tab selection and search query */}
                      {selectedIndicatorTab === 'Technicals' && indicatorCategorySubTab === 'Indicators' && (
                        <>
                          <div className="text-[10.5px] text-gray-500 font-extrabold px-1.5 py-1 uppercase tracking-wider select-none">Active Technical Indicators</div>
                          {visualIndicators
                            .filter(ind => ind.name.toLowerCase().includes(indicatorSearchQuery.toLowerCase()))
                            .map(ind => (
                              <div key={ind.id} className="flex items-center justify-between px-2 py-2 rounded-lg hover:bg-gray-800/40 transition-colors group">
                                <div className="flex items-center gap-2">
                                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: ind.color }} />
                                  <span className="font-extrabold text-[12px] text-gray-200">{ind.name}</span>
                                  <span className="text-[10px] text-gray-500 font-mono">({ind.type.toUpperCase()})</span>
                                </div>
                                <button 
                                  onClick={() => {
                                    setVisualIndicators(prev => prev.map(p => p.id === ind.id ? { ...p, visible: !p.visible } : p));
                                    showToast(`${ind.name} ${!ind.visible ? 'enabled' : 'disabled'}`);
                                  }}
                                  className={`px-3 py-1 rounded text-[11px] font-bold transition-all ${ind.visible ? 'bg-green-500/15 text-green-400 hover:bg-green-500/25' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                                >
                                  {ind.visible ? 'Active' : 'Add'}
                                </button>
                              </div>
                            ))}
                        </>
                      )}

                      {/* Pine strategies */}
                      {(selectedIndicatorTab !== 'Technicals' || indicatorCategorySubTab === 'Strategies') && (
                        <>
                          <div className="text-[10.5px] text-gray-500 font-extrabold px-1.5 py-1 uppercase tracking-wider select-none">Pine Script Strategies ({selectedIndicatorTab})</div>
                          {INDICATOR_LIBRARY
                            .filter(ind => ind.name.toLowerCase().includes(indicatorSearchQuery.toLowerCase()))
                            .map(ind => (
                              <div key={ind.name} className="flex items-center justify-between px-2 py-2 rounded-lg hover:bg-gray-800/40 transition-colors group font-bold">
                                <div className="flex flex-col">
                                  <span className="text-[12px] text-gray-200">{ind.name}</span>
                                  <span className="text-[10px] text-gray-500 font-medium line-clamp-1">{ind.desc}</span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <button 
                                    onClick={() => { injectIndicator(ind, 'pine'); closeModal(); }}
                                    className="px-2.5 py-1 rounded bg-[#7C5CFF]/15 text-[#7C5CFF] hover:bg-[#7C5CFF]/25 text-[11px] font-bold transition-all"
                                  >
                                    + Pine
                                  </button>
                                  <button 
                                    onClick={() => { injectIndicator(ind, 'python'); closeModal(); }}
                                    className="px-2.5 py-1 rounded bg-amber-500/15 text-amber-500 hover:bg-amber-500/25 text-[11px] font-bold transition-all"
                                  >
                                    + Python
                                  </button>
                                </div>
                              </div>
                            ))}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ) : activeModal.type === 'alert_creation' ? (
                <div className="space-y-4 text-[12px]">
                  {/* Condition Ticker Dropdown */}
                  <div>
                    <label className="block text-[11px] text-gray-400 font-bold uppercase tracking-wider mb-1.5">Condition</label>
                    <div className="flex items-center gap-2">
                      <div className={`flex-1 flex items-center gap-2 ${darkMode ? 'bg-[#1e222d] border-[#2a2e39] text-white' : 'bg-gray-50 border-gray-200 text-gray-900'} border rounded px-3 py-2 font-bold select-none`}>
                        <img 
                          src={coinIconUrl(selectedCoin)} 
                          data-tier="0"
                          onError={(e) => handleCoinIconError(e, selectedCoin)}
                          alt="coin"
                          className="w-4 h-4 rounded-full bg-white object-cover shrink-0" 
                        />
                        <span>{selectedCoin}</span>
                      </div>
                      
                      <select 
                        value={alertCondition} 
                        onChange={(e) => setAlertCondition(e.target.value)}
                        className={`flex-1 ${darkMode ? 'bg-[#1e222d] border-[#2a2e39] text-white' : 'bg-gray-50 border-gray-200 text-gray-900'} border rounded px-2 py-2 font-semibold outline-none focus:border-blue-500`}
                      >
                        <option value="above">Crossing Up</option>
                        <option value="below">Crossing Down</option>
                      </select>
                    </div>
                  </div>

                  {/* Price Level Crossing Value Input */}
                  <div>
                    <label className="block text-[11px] text-gray-400 font-bold uppercase tracking-wider mb-1.5">Price Level</label>
                    <input 
                      type="number" 
                      step="0.01"
                      value={alertPrice}
                      onChange={(e) => setAlertPrice(e.target.value)}
                      placeholder={`Current: $${livePrice.toFixed(2)}`}
                      className={`w-full ${darkMode ? 'bg-[#1e222d] border-[#2a2e39] text-white' : 'bg-gray-50 border-gray-200 text-gray-900'} border rounded px-3 py-2 font-mono outline-none focus:border-blue-500`}
                    />
                  </div>

                  {/* Expiration date time picker & trigger occurrence settings */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-gray-400 font-bold uppercase tracking-wider mb-1.5">Trigger</label>
                      <select 
                        value={alertTrigger}
                        onChange={(e) => setAlertTrigger(e.target.value)}
                        className={`w-full ${darkMode ? 'bg-[#1e222d] border-[#2a2e39] text-white' : 'bg-gray-50 border-gray-200 text-gray-900'} border rounded px-2 py-2 font-semibold outline-none focus:border-blue-500`}
                      >
                        <option value="Once only">Once only</option>
                        <option value="Every time">Every time</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] text-gray-400 font-bold uppercase tracking-wider mb-1.5">Expiration</label>
                      <input 
                        type="datetime-local" 
                        value={alertExpiration}
                        onChange={(e) => setAlertExpiration(e.target.value)}
                        className={`w-full ${darkMode ? 'bg-[#1e222d] border-[#2a2e39] text-white' : 'bg-gray-50 border-gray-200 text-gray-900'} border rounded px-2 py-2 font-semibold outline-none focus:border-blue-500 font-mono`}
                      />
                    </div>
                  </div>

                  {/* Alert Message Description */}
                  <div>
                    <label className="block text-[11px] text-gray-400 font-bold uppercase tracking-wider mb-1.5">Message</label>
                    <textarea 
                      rows="3"
                      value={alertMessage}
                      onChange={(e) => setAlertMessage(e.target.value)}
                      className={`w-full ${darkMode ? 'bg-[#1e222d] border-[#2a2e39] text-white' : 'bg-gray-50 border-gray-200 text-gray-900'} border rounded px-3 py-2 font-mono outline-none focus:border-blue-500 resize-none`}
                    />
                  </div>

                  {/* Alert Notifications list */}
                  <div>
                    <label className="block text-[11px] text-gray-400 font-bold uppercase tracking-wider mb-1.5">Notifications</label>
                    <div className="flex items-center gap-4 text-gray-300 font-semibold select-none pt-1">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="checkbox" defaultChecked className="accent-[#7C5CFF]" />
                        <span>In-App Toasts</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="checkbox" defaultChecked className="accent-[#7C5CFF]" />
                        <span>Show Popups</span>
                      </label>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex justify-end gap-2 border-t border-[#2a2e39]/50 pt-3 mt-4">
                    <button 
                      onClick={closeModal} 
                      className="px-4 py-2 rounded bg-gray-800 text-gray-400 hover:text-white font-bold transition-colors"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={() => {
                        addPriceAlert();
                        closeModal();
                      }}
                      className="px-4 py-2 rounded bg-blue-500 text-white font-bold hover:bg-blue-600 transition-colors"
                    >
                      Create Alert
                    </button>
                  </div>
                </div>
              ) : activeModal.type === 'indicator_settings' ? (
                <div className="space-y-4 text-[12px] font-sans text-white">
                  {/* Modal Tabs Header */}
                  <div className="flex border-b border-[#2a2e39]/80 pb-2 mb-4">
                    <button
                      onClick={() => setEditingModalTab('inputs')}
                      className={`flex-1 pb-2 text-[13px] font-bold text-center border-b-2 transition-all ${
                        editingModalTab === 'inputs' ? 'border-b-2 border-blue-500 text-blue-400' : 'border-transparent text-gray-450 hover:text-white'
                      }`}
                    >
                      Inputs
                    </button>
                    <button
                      onClick={() => setEditingModalTab('style')}
                      className={`flex-1 pb-2 text-[13px] font-bold text-center border-b-2 transition-all ${
                        editingModalTab === 'style' ? 'border-b-2 border-blue-500 text-blue-400' : 'border-transparent text-gray-450 hover:text-white'
                      }`}
                    >
                      Style
                    </button>
                  </div>

                  {editingModalTab === 'inputs' ? (
                    <div className="space-y-4 py-2">
                      {/* Parameter Schema fields */}
                      {INDICATOR_REGISTRY[activeModal.indicator.type]?.paramSchema.length > 0 ? (
                        INDICATOR_REGISTRY[activeModal.indicator.type].paramSchema.map(param => (
                          <div key={param.key} className="flex items-center justify-between gap-4">
                            <span className="text-[12px] text-gray-300 font-bold uppercase tracking-wider">{param.label}</span>
                            <input
                              type="number"
                              step={param.step || 1}
                              value={tempIndicatorParams[param.key] ?? ''}
                              onChange={(e) => {
                                const val = param.type === 'float' ? parseFloat(e.target.value) : parseInt(e.target.value);
                                if (!isNaN(val)) {
                                  setTempIndicatorParams(prev => ({ ...prev, [param.key]: val }));
                                }
                              }}
                              className={`w-24 ${darkMode ? 'bg-[#1e222d] border-[#2a2e39] text-white' : 'bg-gray-50 border-gray-200 text-gray-900'} border rounded px-2.5 py-1.5 font-mono text-[12px] outline-none focus:border-blue-500 text-right`}
                            />
                          </div>
                        ))
                      ) : (
                        <div className="text-gray-400 text-center py-6">No parameters to configure for this indicator.</div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4 py-2">
                      {/* Color Option */}
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-[12px] text-gray-300 font-bold uppercase tracking-wider">Line Color</span>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={tempIndicatorColor}
                            onChange={(e) => setTempIndicatorColor(e.target.value)}
                            className="w-8 h-8 rounded bg-transparent border-0 cursor-pointer"
                          />
                          <input
                            type="text"
                            value={tempIndicatorColor}
                            onChange={(e) => setTempIndicatorColor(e.target.value)}
                            className={`w-20 ${darkMode ? 'bg-[#1e222d] border-[#2a2e39] text-white' : 'bg-gray-50 border-gray-200 text-gray-900'} border rounded px-2.5 py-1 font-mono text-[11px] outline-none`}
                          />
                        </div>
                      </div>

                      {/* Thickness Option */}
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-[12px] text-gray-300 font-bold uppercase tracking-wider">Line Thickness</span>
                        <select
                          value={tempIndicatorWidth}
                          onChange={(e) => setTempIndicatorWidth(parseInt(e.target.value))}
                          className={`w-24 ${darkMode ? 'bg-[#1e222d] border-[#2a2e39] text-white' : 'bg-gray-50 border-gray-200 text-gray-900'} border rounded px-2.5 py-1 font-bold outline-none`}
                        >
                          <option value="1">1px (Thin)</option>
                          <option value="2">2px (Normal)</option>
                          <option value="3">3px (Thick)</option>
                          <option value="4">4px (Extra Thick)</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Actions buttons */}
                  <div className="flex justify-end gap-2 border-t border-[#2a2e39]/50 pt-3.5 mt-4">
                    <button 
                      onClick={closeModal} 
                      className="px-4 py-2 rounded bg-gray-800 text-gray-400 hover:text-white font-bold transition-colors"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={() => {
                        setVisualIndicators(prev => prev.map(ind => 
                          ind.id === activeModal.indicator.id 
                            ? { ...ind, params: tempIndicatorParams, color: tempIndicatorColor, lineWidth: tempIndicatorWidth } 
                            : ind
                        ));
                        closeModal();
                        showToast(`Saved settings for ${activeModal.indicator.name}`);
                      }}
                      className="px-4 py-2 rounded bg-blue-500 text-white font-bold hover:bg-blue-600 transition-colors"
                    >
                      Apply Settings
                    </button>
                  </div>
                </div>
              ) : activeModal.type === 'compare_symbol' ? (
                <div className="space-y-4 text-[12px] text-white">
                  <div>
                    <label className="block text-[11px] text-gray-400 font-bold uppercase tracking-wider mb-1.5">Search Compare Coin</label>
                    <input 
                      type="text"
                      placeholder="e.g. ETH, SOL, BTC..."
                      className={`w-full ${darkMode ? 'bg-[#1e222d] border-[#2a2e39] text-white' : 'bg-gray-50 border-gray-200 text-gray-900'} border rounded px-3 py-2 font-mono text-[12px] outline-none focus:border-blue-500 uppercase`}
                      onChange={(e) => {
                        const q = e.target.value.toUpperCase();
                        setActiveModal(prev => ({ ...prev, query: q }));
                      }}
                      value={activeModal.query || ''}
                    />
                  </div>
                  
                  <div className="max-h-48 overflow-y-auto dark-scrollbar space-y-1 pr-1">
                    {(binanceCoins && binanceCoins.length > 0 ? binanceCoins : watchlist)
                      .filter(coin => coin !== selectedCoin && (!activeModal.query || coin.includes(activeModal.query)))
                      .slice(0, 50)
                      .map(coin => (
                        <button
                          key={coin}
                          onClick={() => {
                            loadCompareCandles(coin);
                            closeModal();
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors text-white hover:bg-white/5 font-bold"
                        >
                          <img 
                            src={coinIconUrl(coin)}
                            data-tier="0"
                            onError={(e) => handleCoinIconError(e, coin)}
                            alt={coin}
                            className="w-4 h-4 rounded-full object-cover bg-white shrink-0"
                          />
                          <span>{coin}</span>
                        </button>
                      ))}
                  </div>
                </div>
              ) : activeModal.type === 'settings' ? (
                <div className="space-y-3 font-semibold">
                  <label className={`block text-[12px] ${t.muted}`}>Default AI</label>
                  <select value={aiProvider} onChange={(e) => setAiProvider(e.target.value)} className={`w-full rounded border ${t.border} ${t.bg} ${t.text} p-2 text-[12px] font-bold outline-none`}>
                    <option value="groq">Groq</option>
                    <option value="gemini">Gemini</option>
                  </select>
                  <button onClick={clearAllDrawings} className={`w-full py-2 rounded border ${t.border} ${t.text} text-[12px] font-extrabold hover:bg-gray-800`}>Clear all drawings</button>
                  <button onClick={() => { setDrawings([]); setReplayMode(false); showToast('Chart reset'); closeModal(); }} className={`w-full py-2 rounded bg-red-500/10 text-red-400 text-[12px] font-extrabold hover:bg-red-500/25`}>Reset chart tools</button>
                </div>
              ) : (
                <>
                  {activeModal.desc && <p className={`${t.text} text-[13px] mb-4`}>{activeModal.desc}</p>}
                  <div className="flex justify-end gap-2">
                    <button onClick={closeModal} className={`px-4 py-2 rounded-lg ${t.text} border ${t.border} font-semibold`}>Close</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {toastMsg && (
        <div className={`fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-50 ${darkMode ? 'bg-gray-800' : 'bg-gray-900'} text-white px-5 py-3 rounded-full shadow-2xl flex items-center gap-2 font-medium text-[13px] border ${t.border} max-w-[90vw] text-center`}>
          {toastMsg}
        </div>
      )}

      {selectedDrawingId !== null && floatingToolbarCoords && (drawings.find(d => d.id === selectedDrawingId) || {}) && (() => {
        let px = floatingToolbarCoords.x;
        let py = floatingToolbarCoords.y;
        if (floatingToolbarCoords.time && chartRef.current) {
          const pt = getPixel(floatingToolbarCoords.time, floatingToolbarCoords.price);
          const rect = chartRef.current.getBoundingClientRect();
          if (pt) {
            px = Math.max(16, Math.min(window.innerWidth - 320, rect.left + pt.x + floatingToolbarCoords.offsetX));
            py = Math.max(80, rect.top + pt.y + floatingToolbarCoords.offsetY);
          }
        }
        return (
        <div 
          className={`fixed z-50 flex items-center gap-2 border rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.8)] p-1.5 transition-all ${darkMode ? 'bg-[#0F1117]/98 backdrop-blur-xl border-[rgba(255,255,255,0.09)]' : 'bg-white/98 backdrop-blur-md border-[#e0e3eb] shadow-xl'}`}
          style={{ 
            left: `${px}px`, 
            top: `${py}px`,
          }}
        >
          {/* Quick Color Picker */}
          <div className="flex items-center gap-1 border-r border-[#2a2e39] pr-1.5">
            {['#7C5CFF', '#2962ff', '#089981', '#f44336', '#ff9800', '#ffd700', '#ab47bc', '#ffffff'].map(c => (
              <button 
                key={c}
                onClick={() => {
                  setDrawings(prev => prev.map(d => d.id === selectedDrawingId ? { ...d, color: c } : d));
                  requestDraw();
                }}
                className="w-4 h-4 rounded-full border border-black/30 cursor-pointer hover:scale-110 transition-transform"
                style={{ backgroundColor: c, outline: (drawings.find(d => d.id === selectedDrawingId) || {}).color === c ? '1.5px solid #2962ff' : 'none' }}
              />
            ))}
          </div>

          {/* Line Width */}
          <select 
            value={(drawings.find(d => d.id === selectedDrawingId) || {}).lineWidth || 2}
            onChange={(e) => {
              const val = parseInt(e.target.value);
              setDrawings(prev => prev.map(d => d.id === selectedDrawingId ? { ...d, lineWidth: val } : d));
              requestDraw();
            }}
            className="bg-transparent text-white text-[10px] font-bold outline-none border border-[#2a2e39] rounded px-1 py-0.5 cursor-pointer"
          >
            <option value="1">1px</option>
            <option value="2">2px</option>
            <option value="3">3px</option>
            <option value="4">4px</option>
          </select>

          {/* Line Style */}
          <select 
            value={(drawings.find(d => d.id === selectedDrawingId) || {}).lineStyle || 'solid'}
            onChange={(e) => {
              const val = e.target.value;
              setDrawings(prev => prev.map(d => d.id === selectedDrawingId ? { ...d, lineStyle: val } : d));
              requestDraw();
            }}
            className="bg-transparent text-white text-[10px] font-bold outline-none border border-[#2a2e39] rounded px-1 py-0.5 cursor-pointer"
          >
            <option value="solid">Solid</option>
            <option value="dashed">Dashed</option>
            <option value="dotted">Dotted</option>
          </select>

          {/* Lock / Unlock Toggle */}
          <button
            onClick={() => {
              const isLocked = !(drawings.find(d => d.id === selectedDrawingId) || {}).locked;
              setDrawings(prev => prev.map(d => d.id === selectedDrawingId ? { ...d, locked: isLocked } : d));
              showToast(isLocked ? '🔒 Drawing Locked' : '🔓 Drawing Unlocked');
              if (isLocked) {
                setSelectedDrawingId(null);
                setFloatingToolbarCoords(null);
              }
              requestDraw();
            }}
            className="p-1 rounded text-gray-400 hover:text-white hover:bg-gray-800 transition-colors cursor-pointer"
            title={(drawings.find(d => d.id === selectedDrawingId) || {}).locked ? "Unlock Drawing" : "Lock Drawing"}
          >
            {(drawings.find(d => d.id === selectedDrawingId) || {}).locked ? <Lock size={12} className="text-red-400" /> : <Unlock size={12} />}
          </button>

          {/* Delete Button */}
          <button
            onClick={() => {
              setDrawings(prev => prev.filter(d => d.id !== selectedDrawingId));
              setSelectedDrawingId(null);
              setFloatingToolbarCoords(null);
              showToast('🗑️ Drawing deleted');
              requestDraw();
            }}
            className="p-1 rounded text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
            title="Delete Drawing"
          >
            <Trash2 size={12} />
          </button>

          {/* Close Toolbar */}
          <button
            onClick={() => {
              setSelectedDrawingId(null);
              setFloatingToolbarCoords(null);
              requestDraw();
            }}
            className="p-1 rounded text-gray-500 hover:text-white hover:bg-gray-800 transition-colors cursor-pointer ml-1"
          >
            <X size={12} />
          </button>
        </div>
        );
      })()}

      {isMobile && mobileMenuOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setMobileMenuOpen(false)} />
          <div className={`fixed top-0 right-0 z-50 h-full w-[min(280px,85vw)] ${t.bg} border-l ${t.border} shadow-2xl flex flex-col safe-top safe-bottom`}>
            <div className={`h-12 border-b ${t.border} flex items-center justify-between px-4 ${t.sec}`}>
              <span className={`font-bold ${t.text}`}>Menu</span>
              <button onClick={() => setMobileMenuOpen(false)} className={`p-2 ${t.muted} ${t.hover} rounded-md`}><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto dark-scrollbar p-3 space-y-1">
              {[
                { label: 'AI Assistant', icon: Sparkles, action: () => { openEditor(editorMode, 'ai'); setMobileMenuOpen(false); } },
                { label: 'Pine Editor', icon: Code2, action: () => { openEditor('pine', 'code'); setMobileMenuOpen(false); } },
                { label: 'Python Editor', icon: FileCode, action: () => { openEditor('python', 'code'); setMobileMenuOpen(false); } },
                { label: 'Indicators', icon: Layers, action: () => { openModal('Indicators, metrics, and strategies', '', 'indicators_search'); setMobileMenuOpen(false); } },
                { label: 'Alerts', icon: Bell, action: () => { openModal('Create alert on', '', 'alert_creation'); setMobileMenuOpen(false); } },
                { label: replayMode ? 'Exit Replay' : 'Replay', icon: History, action: () => { setReplayMode(!replayMode); if (replayMode) showToast('▶️ Replay off'); setMobileMenuOpen(false); } },
                { label: 'Screenshot', icon: Camera, action: () => { takeRealScreenshot(); setMobileMenuOpen(false); } },
                { label: 'Fullscreen', icon: Maximize2, action: () => { toggleFullscreen(); setMobileMenuOpen(false); } },
                { label: 'Publish Script', icon: Upload, action: () => { publishStrategy(); setMobileMenuOpen(false); } },
                  { label: 'Settings', icon: Settings, action: () => { openModal('Settings', '', 'settings'); setMobileMenuOpen(false); } },
              ].map(({ label, icon: Icon, action }) => (
                <button key={label} onClick={action} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg ${t.text} ${t.hover} text-[13px] font-medium transition-colors`}>
                  <Icon size={18} className={label === 'Alert' ? 'text-amber-500' : label === 'Indicators' ? 'text-[#7C5CFF]' : ''} />
                  {label}
                </button>
              ))}
              <div className={`my-2 h-px ${t.border}`} />
              <button onClick={() => { setDarkMode(!darkMode); setMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg ${t.text} ${t.hover} text-[13px] font-medium transition-colors`}>
                {darkMode ? <Sun size={18} /> : <Moon size={18} />}
                {darkMode ? 'Light Mode' : 'Dark Mode'}
              </button>
            </div>
          </div>
        </>
      )}

      {isEditorOpen && (
        <div className={`md:hidden fixed inset-0 z-40 ${t.bg} flex flex-col safe-top safe-bottom`}>
          {renderEditorPanel('', () => setIsEditorOpen(false))}
        </div>
      )}

      {/* MOBILE NEW TOP HEADER */}
      {isMobile && !focusMode && (
        <div className={`flex min-h-14 border-b items-center justify-between px-3 shrink-0 z-30 transition-all w-full relative ${darkMode ? 'border-[rgba(255,255,255,0.07)] bg-[#0B0E14]/95 backdrop-blur-md' : 'border-[#e0e3eb] bg-white/95 backdrop-blur-md shadow-sm'}`}>
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setMobileMenuOpen(true)} className={`p-1.5 -ml-1.5 ${t.muted} ${t.hover} rounded-lg`}><Menu size={22} /></button>
            <div className="flex flex-col cursor-pointer" onClick={() => setIsDropdownOpen(!isDropdownOpen)}>
              <div className="flex items-center gap-1.5">
                <span className={`font-black text-[16px] ${t.text} tracking-tight`}>{selectedCoin}</span>
                <ChevronDown size={14} className={t.muted} />
              </div>
              <span className={`text-[11px] font-bold ${(watchlistTickers[selectedCoin]?.change >= 0) ? 'text-emerald-500' : 'text-red-500'}`}>
                ${livePrice ? formatNumber(livePrice, 2) : '---'} 
                <span className="ml-1 opacity-80">({(watchlistTickers[selectedCoin]?.change >= 0) ? '+' : ''}{watchlistTickers[selectedCoin]?.change?.toFixed(2) || '0.00'}%)</span>
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <select
              value={chartInterval}
              onChange={(e) => setChartInterval(e.target.value)}
              className={`bg-transparent text-[14px] font-extrabold ${t.text} outline-none cursor-pointer text-right appearance-none mr-1`}
            >
              <option value="1s">1s</option>
              <option value="1m">1m</option>
              <option value="5m">5m</option>
              <option value="15m">15m</option>
              <option value="1h">1H</option>
              <option value="4h">4H</option>
              <option value="1d">1D</option>
              <option value="1w">1W</option>
            </select>
            <button onClick={() => { setChartStyle(chartStyle === 'Candles' ? 'Line' : 'Candles'); showToast('Chart Style toggled'); }} className={`p-2 rounded-full ${t.bg} ${t.muted} border ${t.border} shadow-sm transition-colors`}>
              {chartStyle === 'Candles' ? <TrendingUp size={16} /> : <Activity size={16} />}
            </button>
          </div>
        </div>
      )}

      {/* DESKTOP HEADER (Hidden on mobile) */}
      <div className={`${focusMode ? 'hidden' : 'hidden md:flex'} min-h-11 border-b items-center justify-between px-2 md:px-3 shrink-0 z-30 gap-2 w-full transition-all duration-200 ${darkMode ? 'border-[rgba(255,255,255,0.07)] bg-[#0B0E14]/95 backdrop-blur-md' : 'border-[#e0e3eb] bg-white/95 backdrop-blur-md shadow-sm'}`}>
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            {onBackToCoins && (
              <button 
                onClick={onBackToCoins}
                className="p-1.5 rounded hover:bg-gray-700/20 text-[#8b94a7] hover:text-white transition-colors flex items-center justify-center shrink-0"
                title="Back to Markets"
              >
                <ArrowLeft size={16} className="shrink-0 text-[#ff5722]" />
              </button>
            )}
            {onBackToCoins && <div className={`h-4 w-[1px] bg-[rgba(255,255,255,0.06)] shrink-0`} />}
            
            {/* Exchange Dropdown */}
            <select
              value={selectedExchange}
              onChange={(e) => handleExchangeChange(e.target.value)}
              className={`shrink-0 text-[10px] md:text-[11.5px] font-bold rounded-md px-1.5 py-1 border ${t.border} ${t.bg} ${t.text} outline-none cursor-pointer max-w-[76px] md:max-w-none`}
              title="Select exchange"
            >
              {EXCHANGE_LIST.map((ex) => (
                <option key={ex.id} value={ex.id}>{ex.name}</option>
              ))}
            </select>
            
            {/* Coin Search Spotlight Command Bar */}
            <div className="relative flex items-center shrink-0 z-[100]">
              <form 
                onSubmit={(e) => { e.preventDefault(); executeSearch(coinInput || selectedCoin); }} 
              className={`flex items-center gap-1 md:gap-1.5 border px-1.5 py-1 rounded-md shadow-sm transition-all duration-150 group cursor-text ${darkMode ? 'bg-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.07)] border-[rgba(255,255,255,0.08)] focus-within:border-[rgba(41,98,255,0.5)] focus-within:shadow-[0_0_0_1px_rgba(41,98,255,0.2)]' : 'bg-gray-100 hover:bg-gray-200 border-gray-300 focus-within:border-blue-400'}`}
                onClick={() => document.getElementById('smart-search')?.focus()}
              >
                <Search size={13} className="text-gray-400 group-hover:text-[#7C5CFF] transition-colors shrink-0" />
                <img 
                  src={coinIconUrl(selectedCoin)} 
                  data-tier="0"
                  onError={(e) => handleCoinIconError(e, selectedCoin)}
                  alt="coin"
                  className="w-4 h-4 rounded-full shadow-xs shrink-0 object-cover bg-white" 
                />
                <input 
                  id="smart-search" 
                  type="text" 
                  autoComplete="off" 
                  placeholder={selectedCoin} 
                  value={coinInput} 
                  onChange={(e) => { setCoinInput(e.target.value.toUpperCase()); setIsDropdownOpen(true); }} 
                  onFocus={() => setIsDropdownOpen(true)} 
                  onBlur={() => setTimeout(() => setIsDropdownOpen(false), 250)} 
                  className={`w-[45px] md:w-[65px] bg-transparent font-black text-[12px] md:text-[13px] ${t.text} placeholder-gray-500 tracking-wide outline-none focus:text-[#7C5CFF] uppercase`} 
                />
                <div className={`hidden lg:flex items-center gap-1 border-l ${darkMode ? 'border-[#2a2e39]' : 'border-gray-300'} pl-1.5 ml-0.5`}>
                  <kbd className={`text-[8.5px] font-mono font-bold ${darkMode ? 'bg-[#0B0E14] text-[#475569] border-[rgba(255,255,255,0.08)]' : 'bg-white text-gray-400 border-gray-200'} border px-1 py-0.5 rounded`}>Ctrl K</kbd>
                </div>
              </form>
              
              <button 
                onClick={() => openModal('Compare / Add Symbol', '', 'compare_symbol')}
                className="p-1.5 rounded-lg text-fuchsia-400/60 hover:bg-fuchsia-500/10 hover:text-fuchsia-400 transition-colors flex items-center justify-center shrink-0 ml-1.5"
                title="Compare / Overlay Symbol"
              >
                <Scale size={16} />
              </button>
              {isDropdownOpen && (
                <div className={`absolute top-[calc(100%+6px)] left-0 w-[min(18rem,85vw)] border rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.7)] z-[200] max-h-72 md:max-h-96 overflow-y-auto dark-scrollbar py-1.5 ${darkMode ? 'bg-[#0F1117]/98 backdrop-blur-xl border-[rgba(255,255,255,0.08)]' : 'bg-white border-[#e0e3eb] shadow-lg'}`}>
                  {coinsLoading && (
                    <div className={`flex items-center gap-2 px-4 py-3 text-[11px] ${t.muted}`}><RefreshCw size={12} className="animate-spin" /> Loading pairs...</div>
                  )}
                  {!coinsLoading && filteredCoins.length === 0 && (
                    <div className={`px-4 py-3 text-[11px] ${t.muted}`}>No pairs found</div>
                  )}
                  {filteredCoins.map(coin => (
                    <div key={coin} onMouseDown={(e) => { e.preventDefault(); executeSearch(coin); }} className={`px-4 py-2.5 text-[11px] font-bold ${t.text} ${t.hover} cursor-pointer transition-colors flex items-center gap-2`}>
                      <img 
                        src={coinIconUrl(coin)}
                        data-tier="0"
                        onError={(e) => handleCoinIconError(e, coin)}
                        alt={coin}
                        className="w-4 h-4 rounded-full object-cover bg-white shrink-0"
                      />
                      <span>{coin}</span>
                      <span className={`${t.muted} font-normal ml-auto text-[10px]`}>{getQuoteAsset(coin)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Live Price Display */}
            {livePrice > 0 && (
              <span id="topbar-live-price" className="text-[12px] md:text-[13px] font-bold shrink-0" style={{ color: priceColor }} dangerouslySetInnerHTML={{ __html: '$' + livePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 }) }} />
            )}

            {/* Sentiment info badge */}
            {fearGreedIndex && (
              <span 
                className="hidden lg:inline-flex items-center gap-1 text-[11px] font-extrabold px-2 py-1 rounded-md border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] cursor-pointer shrink-0 transition-all hover:border-[rgba(255,255,255,0.1)]"
                style={{ color: getFngColor(fearGreedIndex.value) }}
                title={`Fear & Greed Index: ${fearGreedIndex.value} (${fearGreedIndex.classification}). Click to open Details.`}
                onClick={() => setRightSidebar('details')}
              >
                <Activity size={12} /> {fearGreedIndex.value}
              </span>
            )}

            {/* Connection Status Indicator */}
            <div className="flex items-center justify-center shrink-0" title={`${getExchangeMeta(selectedExchange).name} · ${marketStatus}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${marketStatus === 'Connected' ? 'bg-[#089981]' : marketStatus === 'Loading' || marketStatus === 'Polling' ? 'bg-amber-500 animate-pulse' : 'bg-red-500'}`} />
            </div>

            {/* MIDDLE SECTION FOR DESKTOP - COOPERATIVE DROPDOWNS */}
            <div className="hidden md:flex items-center gap-1 min-w-0">
              <div className={`h-4 w-[1px] ${darkMode ? 'bg-[#2a2e39]' : 'bg-[#e0e3eb]'} mx-1`} />
              
              {/* TIME FRAME DROPDOWN SELECTOR */}
              <div className="relative">
                <button 
                  onClick={() => {
                    setIsTimeframeDropdownOpen(!isTimeframeDropdownOpen);
                    setIsStyleDropdownOpen(false);
                    setIsActionsDropdownOpen(false);
                  }}
                  className={`flex items-center gap-0.5 px-2 py-1.5 rounded text-[13px] font-extrabold transition-colors ${isTimeframeDropdownOpen ? `${t.sec} text-white` : `${t.muted} ${t.hover}`}`}
                  title="Select Timeframe"
                >
                  <span>{chartInterval}</span>
                  <ChevronDown size={11} className="opacity-60" />
                </button>
                
                {isTimeframeDropdownOpen && (
                  <div className={`absolute top-[calc(100%+6px)] left-0 w-44 border rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.7)] z-[350] py-1.5 ${darkMode ? 'bg-[#0F1117]/98 backdrop-blur-xl border-[rgba(255,255,255,0.08)]' : 'bg-white border-[#e0e3eb] shadow-lg'}`}>
                    <div className="text-[9px] uppercase font-black tracking-wider px-3 py-1.5 border-b mb-1" style={{color: darkMode ? '#475569' : '#9ca3af', borderColor: darkMode ? 'rgba(255,255,255,0.05)' : '#f0f0f0'}}>Timeframes</div>
                    <div className="grid grid-cols-3 gap-1 px-2 pb-2">
                      {timeframeButtons.map(tf => (
                        <button 
                          key={tf.label}
                          onClick={() => {
                            setChartInterval(tf.val);
                            setIsTimeframeDropdownOpen(false);
                            showToast(`Timeframe: ${tf.label}`);
                          }}
                          className={`px-1.5 py-1 text-[11px] font-bold rounded text-center transition-colors ${chartInterval === tf.val ? 'bg-blue-500/20 text-blue-400' : `${t.text} ${t.hover}`}`}
                        >
                          {tf.label}
                        </button>
                      ))}
                    </div>
                    
                    <div className="border-t border-[#2a2e39]/30 my-1" />
                    
                    {/* Custom Input inside dropdown */}
                    <div className="px-3 py-2 flex flex-col gap-1.5">
                      <div className="text-[9px] text-gray-500 uppercase font-black tracking-wider">Custom Interval</div>
                      <div className="flex items-center gap-1">
                        <input
                          value={customTimeframeInput}
                          onChange={(e) => setCustomTimeframeInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') { applyCustomTimeframe(); setIsTimeframeDropdownOpen(false); } }}
                          placeholder="e.g. 45m, 2h"
                          className={`w-full px-2 py-1 rounded text-[11px] border ${t.border} ${t.bg} ${t.text} outline-none focus:border-[#7C5CFF]`}
                        />
                        <button 
                          onClick={() => { applyCustomTimeframe(); setIsTimeframeDropdownOpen(false); }} 
                          className={`px-2 py-1 rounded text-[11px] font-semibold bg-[#7C5CFF]/15 text-[#7C5CFF] hover:bg-[#7C5CFF]/25`}
                        >
                          Set
                        </button>
                      </div>
                    </div>
                    
                    <div className="border-t border-[#2a2e39]/30 my-1" />
                    
                    {/* 6Y History inside dropdown */}
                    <button 
                      onClick={() => { loadDeepHistory(); setIsTimeframeDropdownOpen(false); }} 
                      title="Load up to 6 years of history" 
                      className={`w-full text-left px-3.5 py-2 text-[11px] font-bold flex items-center gap-2 ${t.text} hover:bg-white/5 transition-colors`}
                    >
                      <History size={12} className="text-amber-500" />
                      <span>Load 6Y History</span>
                    </button>
                  </div>
                )}
              </div>
              
              {/* CHART STYLE SELECTOR */}
              <div className="relative">
                <button 
                  onClick={() => {
                    setIsStyleDropdownOpen(!isStyleDropdownOpen);
                    setIsTimeframeDropdownOpen(false);
                    setIsActionsDropdownOpen(false);
                  }} 
                  className={`flex items-center gap-0.5 px-2 py-1.5 rounded transition-colors ${isStyleDropdownOpen ? `bg-emerald-500/15 text-emerald-400` : `text-emerald-400/60 hover:bg-emerald-500/10 hover:text-emerald-400`}`}
                  title="Chart Style"
                >
                  <CandlestickChart size={14} />
                  <ChevronDown size={11} className="opacity-60" />
                </button>
                {isStyleDropdownOpen && (
                  <div className={`absolute top-[calc(100%+6px)] left-0 w-52 max-h-[70vh] overflow-y-auto custom-scrollbar border rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.7)] z-[300] py-1.5 ${darkMode ? 'bg-[#0F1117]/98 backdrop-blur-xl border-[rgba(255,255,255,0.08)]' : 'bg-white border-[#e0e3eb] shadow-lg'}`}>
                    {[
                      { name: 'Candles', desc: 'Standard Candlesticks', icon: '📊', color: 'text-green-500' },
                      { name: 'Bars', desc: 'Traditional OHLC Bars', icon: '📶', color: 'text-blue-500' },
                      { name: 'Line', desc: 'Continuous Close Line', icon: '📈', color: 'text-blue-400' },
                      { name: 'Area', desc: 'Shaded Price Area', icon: '⛰️', color: 'text-indigo-400' },
                      { name: 'Heikin-Ashi', desc: 'Smoothed HA Candles', icon: '🔥', color: 'text-orange-500' },
                      { name: 'Hollow Candles', desc: 'Transparent Up Candles', icon: '🟩', color: 'text-emerald-500' },
                      { name: 'Baseline', desc: 'Relative to First Close', icon: '📏', color: 'text-cyan-500' },
                      { name: 'Step Line', desc: 'Stepped Close Prices', icon: '🪜', color: 'text-sky-500' },
                      { name: 'Histogram', desc: 'Vertical Value Bars', icon: '🎚️', color: 'text-purple-500' },
                      { name: 'High-Low', desc: 'Only Shadows/Wicks', icon: '↕️', color: 'text-zinc-400' },
                      { name: 'Volume Candles', desc: 'Price + Volume Weight', icon: '📦', color: 'text-amber-500' },
                      { name: 'Renko', desc: 'Price Movement Bricks', icon: '🧱', color: 'text-red-500', isPro: true },
                      { name: 'Line Break', desc: 'Reversal Based', icon: '📉', color: 'text-pink-500', isPro: true },
                      { name: 'Kagi', desc: 'Thickness Reversal', icon: '⛩️', color: 'text-rose-500', isPro: true },
                      { name: 'Point & Figure', desc: 'X and O Tracking', icon: '❌', color: 'text-fuchsia-500', isPro: true },
                      { name: 'Range', desc: 'Fixed Price Movement', icon: '🎯', color: 'text-lime-500', isPro: true },
                      { name: 'TPO', desc: 'Time Price Opportunity', icon: '🕒', color: 'text-teal-500', isPro: true },
                      { name: 'Footprint', desc: 'Order Flow Detail', icon: '👣', color: 'text-blue-600', isPro: true },
                      { name: 'Order Flow', desc: 'Volume At Price', icon: '🌊', color: 'text-cyan-600', isPro: true },
                      { name: 'Market Profile', desc: 'Volume Distribution', icon: '📊', color: 'text-violet-500', isPro: true }
                    ].map(style => (
                      <button 
                        key={style.name} 
                        onClick={() => {
                          if (style.isPro) {
                            showToast(`🔒 ${style.name} is a Pro Feature (Coming Soon)`);
                            return;
                          }
                          setChartStyle(style.name);
                          setIsStyleDropdownOpen(false);
                          showToast(`Chart Style: ${style.name}`);
                        }}
                        className={`w-full text-left px-3 py-2 text-[11.5px] font-bold transition-colors ${chartStyle === style.name ? 'bg-blue-500/10 text-blue-400' : `${t.text} ${t.hover}`}`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`text-base ${style.color}`}>{style.icon}</span>
                          <div className="flex flex-col">
                            <span className="flex items-center gap-1.5">
                              {style.name} 
                              {style.isPro && <span className="text-[8px] bg-yellow-500/20 text-yellow-500 px-1 py-0 rounded">PRO</span>}
                            </span>
                            <span className="text-[9px] text-gray-500 font-medium">{style.desc}</span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className={`h-4 w-[1px] ${darkMode ? 'bg-[#2a2e39]' : 'bg-[#e0e3eb]'} mx-1`} />



              {/* VOLUME PROFILE TOGGLE */}
              <button
                onClick={() => {
                  setVolumeProfile(prev => !prev);
                  showToast(`Volume Profile: ${!volumeProfile ? 'ON' : 'OFF'}`);
                  requestDraw();
                }}
                className={`flex items-center justify-center p-1.5 rounded transition-colors ${
                  volumeProfile ? 'bg-purple-500/15 text-purple-400' : `text-purple-400/60 hover:bg-purple-500/10 hover:text-purple-400`
                }`}
                title={`Volume Profile: ${volumeProfile ? 'ON' : 'OFF'}`}
              >
                <BarChartHorizontal size={14} />
              </button>

              <div className={`h-4 w-[1px] ${darkMode ? 'bg-[#2a2e39]' : 'bg-[#e0e3eb]'} mx-1`} />

              <button 
                onClick={() => openModal('Indicators, metrics, and strategies', '', 'indicators_search')} 
                className={`flex items-center justify-center p-1.5 rounded transition-colors text-violet-400/60 hover:bg-violet-500/10 hover:text-violet-400`}
                title="Indicators"
              >
                <LineChart size={14} />
              </button>

              {/* ALERTS MODAL */}
              <button 
                onClick={() => openModal('Create alert on', '', 'alert_creation')} 
                className={`flex items-center justify-center p-1.5 rounded transition-colors text-amber-400/70 hover:bg-amber-500/10 hover:text-amber-400`}
                title="Alert"
              >
                <Bell size={14} />
              </button>

              <div className={`h-4 w-[1px] ${darkMode ? 'bg-[#2a2e39]' : 'bg-[#e0e3eb]'} mx-1`} />
              
              {/* REPLAY CONTROLLER TOGGLE */}
              <button onClick={() => {
                if (replayMode && fullCandlesRef.current.length) {
                  allCandlesRef.current = [...fullCandlesRef.current];
                  setAllCandles([...fullCandlesRef.current]);
                }
                setReplayMode(!replayMode);
                if (!replayMode) showToast('⏪ Replay on — use slider');
                else showToast('▶️ Replay off');
              }} className={`flex items-center justify-center p-1.5 rounded transition-colors ${replayMode ? 'bg-orange-500/10 text-orange-500' : `text-orange-400/60 hover:bg-orange-500/10 hover:text-orange-400`}`} title="Replay">
                <Rewind size={14} />
              </button>

              <div className={`h-4 w-[1px] ${darkMode ? 'bg-[#2a2e39]' : 'bg-[#e0e3eb]'} mx-1`} />

              {/* GRID LAYOUT SELECTION */}
              <div className="relative">
                <button 
                  onClick={() => {
                    setIsActionsDropdownOpen(!isActionsDropdownOpen);
                    setIsLayoutMenuOpen(false);
                    setIsTimeframeDropdownOpen(false);
                    setIsStyleDropdownOpen(false);
                  }}
                  className={`p-1.5 rounded transition-colors ${isActionsDropdownOpen ? `bg-blue-500/15 text-blue-400` : `text-blue-400/60 hover:bg-blue-500/10 hover:text-blue-400`}`}
                  title="Select Layout"
                >
                  <LayoutGrid size={14} />
                </button>
                {isActionsDropdownOpen && (
                  <div className={`absolute top-[calc(100%+4px)] right-0 w-48 ${t.bg} border ${t.border} rounded-lg shadow-2xl z-[350] p-2 text-[11.5px] font-bold origin-top-right`}>
                    <div className="text-[9px] text-gray-500 uppercase font-black tracking-wider mb-2">Grid Layout</div>
                    <div className="grid grid-cols-4 gap-1">
                      {[
                        { id: '1', label: '1', title: 'Single Chart' },
                        { id: '2v', label: '◫', title: '2 Split Vertical' },
                        { id: '2h', label: '⊟', title: '2 Split Horizontal' },
                        { id: '4', label: '⊞', title: '4 Grid Screen' },
                      ].map(layout => (
                        <button
                          key={layout.id}
                          onClick={() => {
                            setChartLayout(layout.id);
                            setIsActionsDropdownOpen(false);
                            showToast(`Layout: ${layout.title}`);
                          }}
                          className={`h-8 flex items-center justify-center rounded text-[12px] font-black cursor-pointer transition-colors ${
                            chartLayout === layout.id ? 'bg-blue-500/25 text-blue-400 font-extrabold border border-blue-500/30' : 'text-gray-400 hover:text-white bg-black/10 border border-[#2a2e39]/50'
                          }`}
                          title={layout.title}
                        >
                          {layout.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* LAYOUT MANAGEMENT DROPDOWN (TRADINGVIEW STYLE) */}
              <div className="relative ml-0.5">
                <button 
                  onClick={() => {
                    setIsLayoutMenuOpen(!isLayoutMenuOpen);
                    setIsActionsDropdownOpen(false);
                    setIsTimeframeDropdownOpen(false);
                    setIsStyleDropdownOpen(false);
                  }}
                  className={`flex items-center gap-0.5 px-2 py-1.5 rounded transition-colors ${isLayoutMenuOpen ? `bg-stone-500/15 text-stone-400` : `text-stone-400/60 hover:bg-stone-500/10 hover:text-stone-400`}`}
                  title="Manage Layouts"
                >
                  <Cloud size={14} />
                  <ChevronDownIcon size={11} className="opacity-60" />
                </button>

                {isLayoutMenuOpen && (
                  <div className={`absolute top-[calc(100%+4px)] right-0 w-56 ${t.bg} border ${t.border} rounded-lg shadow-2xl z-[350] py-1.5 text-[11px] font-bold origin-top-right flex flex-col`}>
                    <button className={`w-full text-left px-4 py-1.5 flex items-center justify-between ${t.text} hover:bg-white/5 transition-colors`} onClick={() => { showToast('Layout saved'); setIsLayoutMenuOpen(false); }}>
                      <span>Save layout</span>
                      <span className="text-[9px] text-gray-500 font-mono">Ctrl+S</span>
                    </button>
                    <div className={`w-full px-4 py-1.5 flex items-center justify-between ${t.text} hover:bg-white/5 transition-colors cursor-pointer`} onClick={() => setIsAutosave(!isAutosave)}>
                      <span>Autosave</span>
                      <div className={`w-6 h-3 rounded-full relative transition-colors ${isAutosave ? 'bg-blue-500' : 'bg-gray-600'}`}>
                        <div className={`absolute top-0.5 w-2 h-2 rounded-full bg-white transition-all ${isAutosave ? 'right-0.5' : 'left-0.5'}`} />
                      </div>
                    </div>
                    <div className={`w-full px-4 py-1.5 flex items-center justify-between ${t.text} hover:bg-white/5 transition-colors cursor-pointer`} onClick={() => setIsShareLayout(!isShareLayout)}>
                      <span className="flex items-center gap-1">Share layout <Info size={10} className="text-gray-500" /></span>
                      <div className={`w-6 h-3 rounded-full relative transition-colors ${isShareLayout ? 'bg-blue-500' : 'bg-gray-600'}`}>
                        <div className={`absolute top-0.5 w-2 h-2 rounded-full bg-white transition-all ${isShareLayout ? 'right-0.5' : 'left-0.5'}`} />
                      </div>
                    </div>
                    <div className="border-t border-[#2a2e39]/30 my-1" />
                    <button className={`w-full text-left px-4 py-1.5 flex items-center gap-2.5 ${t.text} hover:bg-white/5 transition-colors`} onClick={() => { showToast('Making copy...'); setIsLayoutMenuOpen(false); }}>
                      <Copy size={12} className="text-gray-400" />
                      <span>Make a copy...</span>
                    </button>
                    <button className={`w-full text-left px-4 py-1.5 flex items-center gap-2.5 ${t.text} hover:bg-white/5 transition-colors`} onClick={() => { showToast('Rename layout'); setIsLayoutMenuOpen(false); }}>
                      <Edit2 size={12} className="text-gray-400" />
                      <span>Rename...</span>
                    </button>
                    <button className={`w-full text-left px-4 py-1.5 flex items-center gap-2.5 ${t.text} hover:bg-white/5 transition-colors`} onClick={() => { showToast('Downloading data...'); setIsLayoutMenuOpen(false); }}>
                      <Download size={12} className="text-gray-400" />
                      <span>Download chart data...</span>
                    </button>
                    <div className="border-t border-[#2a2e39]/30 my-1" />
                    <button className={`w-full text-left px-4 py-1.5 flex items-center gap-2.5 ${t.text} hover:bg-white/5 transition-colors`} onClick={() => { showToast('Creating layout...'); setIsLayoutMenuOpen(false); }}>
                      <Plus size={12} className="text-gray-400" />
                      <span>Create new layout...</span>
                    </button>
                    <div className="border-t border-[#2a2e39]/30 my-1" />
                    <div className="text-[9px] text-gray-500 uppercase font-black tracking-wider px-4 py-1">Recently Used</div>
                    <button className={`w-full text-left px-4 py-1.5 bg-blue-500/10 text-blue-400 transition-colors`}>
                      {layoutName}
                    </button>
                    <button className={`w-full text-left px-4 py-1.5 ${t.text} hover:bg-white/5 transition-colors`}>
                      BTCUSDT, 5
                    </button>
                    <div className="border-t border-[#2a2e39]/30 my-1" />
                    <button className={`w-full text-left px-4 py-1.5 flex items-center gap-2.5 ${t.text} hover:bg-white/5 transition-colors`} onClick={() => { showToast('Open layout menu'); setIsLayoutMenuOpen(false); }}>
                      <Cloud size={12} className="text-gray-400" />
                      <span>Open layout...</span>
                    </button>
                  </div>
                )}
              </div>
              
              <div className={`h-4 w-[1px] ${darkMode ? 'bg-[#2a2e39]' : 'bg-[#e0e3eb]'} mx-1`} />

              {/* UTILITIES (Camera, Settings) */}
              <div className="flex items-center gap-1.5 ml-3 border-l border-[#2a2e39]/50 pl-3">
                  <button 
                    onClick={() => {
                      setTradingTab('Arbitrage Matrix');
                      if (lowerBoxState === 'minimized') setLowerBoxState('normal');
                    }}
                    className={`p-1.5 rounded transition-colors ${tradingTab === 'Arbitrage Matrix' ? 'text-emerald-400 bg-emerald-500/10' : t.muted} hover:text-emerald-400`}
                    title="Arbitrage Matrix"
                  >
                    <Zap size={14} className={tradingTab === 'Arbitrage Matrix' ? "fill-emerald-400 animate-pulse" : ""} />
                  </button>
                  <button
                    onClick={() => {
                      setTradingTab('Strategy Tester');
                      if (lowerBoxState === 'minimized') setLowerBoxState('normal');
                    }}
                    className={`p-1.5 rounded transition-colors ${tradingTab === 'Strategy Tester' ? 'text-blue-400 bg-blue-500/10' : t.muted} hover:text-blue-400`}
                    title="Strategy Tester"
                  >
                    <FlaskConical size={14} className={tradingTab === 'Strategy Tester' ? "fill-blue-400" : ""} />
                  </button>
                </div>
              <div className="flex items-center gap-0.5">
                <button 
                  onClick={() => openModal('Settings', 'Settings', 'settings')}
                  className={`p-1.5 rounded transition-colors ${t.muted} ${t.hover}`}
                  title="Chart Settings"
                >
                  <Settings size={14} />
                </button>
                <button
                  onClick={() => takeRealScreenshot()}
                  className={`p-1.5 rounded transition-colors ${t.muted} ${t.hover}`}
                  title="Take a snapshot"
                >
                  <Camera size={14} />
                </button>
                <button 
                  onClick={() => publishStrategy()}
                  className={`p-1.5 rounded transition-colors ${t.muted} hover:text-purple-400`}
                  title="Download Code File"
                >
                  <Upload size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT-HAND SIDE SYSTEM ACTIONS */}
          <div className="flex items-center gap-0.5 shrink-0 z-40">
            {/* Mobile chart style toggle */}
            <button onClick={() => { setChartStyle(chartStyle === 'Candles' ? 'Line' : 'Candles'); showToast('Chart Style toggled'); }} className={`md:hidden p-2 rounded ${t.muted} ${t.hover} transition-colors`}><TrendingUp size={16} strokeWidth={2} /></button>
            {/* Mobile menu trigger */}
            <button onClick={() => setMobileMenuOpen(true)} className={`md:hidden p-2 ${t.muted} ${t.hover} rounded transition-colors`} aria-label="Open menu"><Menu size={18} /></button>

            {/* Desktop Clean Utility Panel */}
            <div className="hidden md:flex items-center gap-1">
              {/* Fullscreen Toggle */}
              <button 
                onClick={toggleFullscreen} 
                className={`p-1.5 ${t.muted} ${t.hover} rounded transition-colors`} 
                title="Toggle Fullscreen"
              >
                <Maximize2 size={14} />
              </button>

              {/* Focus Mode Toggle */}
              <button onClick={() => setFocusMode(!focusMode)} className={`p-1.5 ${t.muted} ${t.hover} rounded transition-colors hidden sm:flex items-center gap-1.5 mr-1`} title="Focus Mode (Maximize Chart)">
                <Focus size={14} className={focusMode ? 'text-blue-400' : ''} />
              </button>
              {/* Theme Toggle (Highly accessible) */}
              <button onClick={() => { setStealthMode(!stealthMode); if (!stealthMode) document.body.style.background = '#00000000'; }} className={`p-1.5 ${t.muted} ${t.hover} rounded transition-colors hidden sm:flex items-center gap-1.5 mr-1`} title="Stealth / Focus Mode">
                <Ghost size={14} className={stealthMode ? 'text-blue-400' : ''} />
              </button>
              <button onClick={() => setDarkMode(!darkMode)} className={`p-1.5 ${t.muted} ${t.hover} rounded transition-colors`} title="Toggle theme">
                {darkMode ? <Sun size={14} /> : <Moon size={14} />}
              </button>

              {/* Timezone Settings Dropdown */}
              <div className="relative">
                <button onClick={() => setActiveFlyout(activeFlyout === 'timezone' ? null : 'timezone')} className={`p-1.5 ${activeFlyout === 'timezone' ? 'bg-[#7C5CFF] text-white' : `${t.muted} ${t.hover}`} rounded transition-colors`} title="Timezone Settings">
                  <Clock size={14} />
                </button>
                {activeFlyout === 'timezone' && (
                  <div className={`absolute top-full right-0 mt-1 w-44 rounded-lg shadow-xl border ${t.border} ${t.bg} overflow-hidden z-50 text-[13px] font-medium`}>
                    {['UTC', 'IST', 'Auto'].map(tz => (
                      <button key={tz} onClick={() => { setTimezone(tz); localStorage.setItem('chartTimezone', tz); setActiveFlyout(null); }} className={`w-full text-left px-4 py-2 flex items-center justify-between ${timezone === tz ? 'text-[#7C5CFF] bg-[#7C5CFF]/10' : `${t.text} ${t.hover}`} transition-colors`}>
                        <span>{tz === 'UTC' ? '🌐 UTC' : tz === 'IST' ? '🇮🇳 IST' : '📍 Auto (Local)'}</span>
                        {timezone === tz && <Check size={14} />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Candle count badge */}
              <div className={`hidden lg:flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono border ${t.border} ${t.sec} ${t.muted} shrink-0`} title="Total candles loaded">
                <Database size={10} />
                <span>{allCandles.length.toLocaleString()}</span>
                <span className="opacity-50">bars</span>
              </div>

            </div>
          </div>
        </div>

        {/* MOBILE HORIZONTAL TIMEFRAME SCROLLER (Hidden in new mobile design) */}
        {!isMobile && (
          <div className={`${focusMode ? 'hidden' : 'md:hidden flex'} mobile-scroll-x items-center gap-0.5 px-2 py-1 border-b ${t.border} ${t.bg} overflow-x-auto shrink-0`}>
          {timeframeButtons.map(tf => (
            <button key={tf.label} onClick={() => { setChartInterval(tf.val); showToast(`Timeframe: ${tf.label}`); }} className={`px-3 py-1.5 font-semibold rounded-full text-[11px] whitespace-nowrap transition-colors ${chartInterval === tf.val ? 'bg-[#7C5CFF] text-white' : `${t.muted} ${t.sec}`}`}>{tf.label}</button>
          ))}
          <input
            value={customTimeframeInput}
            onChange={(e) => setCustomTimeframeInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') applyCustomTimeframe(); }}
            placeholder="e.g 45m"
            className={`w-[80px] shrink-0 px-2 py-1.5 rounded-full text-[11px] border ${t.border} ${t.bg} ${t.text} outline-none`}
          />
          <button onClick={applyCustomTimeframe} className={`shrink-0 px-2.5 py-1.5 rounded-full text-[11px] font-semibold ${t.sec} ${t.text}`}>Set</button>
          <button onClick={loadDeepHistory} className={`shrink-0 px-2.5 py-1.5 rounded-full text-[11px] font-semibold ${t.muted} ${t.sec}`}>6Y</button>
        </div>
        )}

        <div className="flex flex-1 min-h-0 min-w-0 flex-col md:flex-row overflow-hidden">
          <div className={`flex flex-1 flex-col min-h-0 min-w-0 overflow-hidden md:border-r ${t.border}`}>
            <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
          <div className="flex flex-1 min-h-0 min-w-0 overflow-hidden">
            {!isMobile && !focusMode && <LeftToolbar 
  horizontal={false} t={t} darkMode={darkMode} activeTool={activeTool} 
  setActiveTool={setActiveTool} showToast={showToast} setDrawings={setDrawings}
  selectedTools={selectedTools} setSelectedTools={setSelectedTools} activeFlyout={activeFlyout}
  setActiveFlyout={setActiveFlyout} setIsCursorStudioOpen={setIsCursorStudioOpen} 
  setIsTrendStudioOpen={setIsTrendStudioOpen} chartInstance={chartInstance}
  isMagnetEnabled={magnetMode !== 'off'} setIsMagnetEnabled={() => setMagnetMode(magnetMode === 'off' ? 'normal' : 'off')}
  isDrawingLocked={lockDrawings} setIsDrawingLocked={setLockDrawings}
  isDrawingHidden={hideDrawings} setIsDrawingHidden={setHideDrawings}
  renderEngine={renderEngine} handleEngineToggle={handleEngineToggle}
  keepDrawing={keepDrawing} setKeepDrawing={setKeepDrawing}
  lockDrawings={lockDrawings} setLockDrawings={setLockDrawings}
/>}
            {!isMobile && !focusMode && <LeftSidePanel />}
            <div className="flex-1 flex flex-col min-h-0 min-w-0 relative">
              {renderOHLCHeader()}
              {/* Active Indicators List Overlay */}
              {/* Floating Exit Focus Mode Button */}
              {focusMode && (
                <button 
                  onClick={() => setFocusMode(false)}
                  className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[100] px-4 py-2 bg-[#2962ff] hover:bg-blue-600 text-white font-bold rounded-full shadow-2xl flex items-center gap-2 transition-all opacity-80 hover:opacity-100"
                >
                  <Minimize2 size={16} /> Exit Focus Mode
                </button>
              )}
              {/* Active Indicators List Overlay (TradingView style - transparent & minimal) */}
              <div className="absolute top-[32px] left-2.5 z-20 flex flex-col gap-1.5 pointer-events-auto max-w-[400px] select-none drop-shadow-md">
                <div className={`flex items-center gap-1 px-1 py-0.5 text-[10px] ${darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-black'} transition-colors cursor-pointer w-fit`} onClick={() => setIsLegendExpanded(!isLegendExpanded)}>
                  {isLegendExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  <span className="tracking-wider uppercase font-black">Indicators</span>
                </div>
                
                {isLegendExpanded && visualIndicators.filter(ind => ind.visible).map(ind => (
                  <div key={ind.id} className={`group flex items-center gap-1.5 text-[11px] font-bold ${darkMode ? 'text-gray-400/80 hover:text-white' : 'text-gray-500 hover:text-black'} px-1 py-0.5 transition-all`}>
                    <span className="w-1.5 h-1.5 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: ind.color }} />
                    <span style={{ color: ind.color }} className="font-extrabold truncate">
                      {ind.name}(
                      {ind.params.period !== undefined ? ind.params.period : ''}
                      {ind.params.stdDev !== undefined ? `, ${ind.params.stdDev}` : ''}
                      {ind.params.fastPeriod !== undefined ? `${ind.params.fastPeriod}, ${ind.params.slowPeriod}, ${ind.params.signalPeriod}` : ''}
                      )
                    </span>
                    
                    {/* Live indicator values */}
                    {renderIndValues(ind)}
                    
                    {/* Controls (visible on hover) */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150 ml-1.5 shrink-0">
                      <button 
                        onClick={() => setVisualIndicators(prev => prev.map(p => p.id === ind.id ? { ...p, visible: !p.visible } : p))} 
                        className="text-gray-400 hover:text-white p-0.5"
                        title={ind.visible ? 'Hide' : 'Show'}
                      >
                        <Eye size={10} />
                      </button>
                      <button 
                        onClick={() => {
                          setTempIndicatorParams({ ...ind.params });
                          setTempIndicatorColor(ind.color || '#7C5CFF');
                          setTempIndicatorWidth(ind.lineWidth || 2);
                          setEditingModalTab('inputs');
                          setActiveModal({
                            title: `${ind.name} Settings`,
                            type: 'indicator_settings',
                            indicator: ind
                          });
                        }}
                        className="p-0.5 text-gray-400 hover:text-blue-400"
                        title="Settings"
                      >
                        <Settings size={10} />
                      </button>
                      <button 
                        onClick={() => setVisualIndicators(prev => prev.map(p => p.id === ind.id ? { ...p, visible: false } : p))}
                        className="text-gray-400 hover:text-red-400 p-0.5"
                        title="Remove"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  </div>
                ))}
                
                {isLegendExpanded && compareSymbol && (
                  <div className="group flex items-center justify-between gap-1.5 text-[11px] font-bold text-[#ea39ff] bg-[#131722]/60 px-2 py-1 rounded border border-[#ea39ff]/20">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#ea39ff] shrink-0" />
                      <span className="font-extrabold truncate">Compare: {compareSymbol}</span>
                    </div>
                    <button 
                      onClick={clearComparison}
                      className="text-gray-400 hover:text-red-400 p-0.5"
                      title="Remove comparison"
                    >
                      <X size={10} />
                    </button>
                  </div>
                )}
              </div>







              <div className="flex-1 flex flex-col min-h-0 min-w-0">
                {/* Main Price Chart Pane */}
                <div 
                  className={`min-w-0 relative transition-all duration-300 ${
                    visualIndicators.filter(ind => ind.visible && INDICATOR_REGISTRY[ind.type]?.kind === 'subchart').length > 0 ? 'h-[55%]' : 'flex-1'
                  }`}
                style={{ minHeight: '120px' }}
                >
                  {chartLayout === '1' ? (
                    <div 
                      ref={chartContainerRef}
                      className="w-full h-full relative"
                      onPointerDown={handlePointerDown}
                      onPointerMove={handlePointerMove}
                      onPointerUp={handlePointerUp}
                      onPointerLeave={handlePointerUp}
                      style={{ 
                        touchAction: activeTool ? 'none' : 'auto',
                        cursor: (activeTool && ['dot', 'demonstration', 'magic'].includes(activeTool)) ? 'none' : 'crosshair'
                      }}
                    >
                      {renderEngine === 'webgl' ? (
                        <WebGLErrorBoundary onError={(error) => {
                          setRenderEngine('canvas2d');
                          showToast('WebGL Error: ' + error.message);
                        }}>
                          <Suspense fallback={
                            <div className="w-full h-full flex items-center justify-center" 
                               style={{ background: darkMode ? '#131722' : '#ffffff' }}>
                            <div className="flex flex-col items-center gap-3 animate-pulse">
                              <Zap size={36} className="text-emerald-400" />
                              <span className={`text-sm font-medium ${t.muted}`}>WebGL Engine Loading...</span>
                            </div>
                          </div>
                        }>
                          <WebGLChartEngine
                            key={`${renderEngine}-${selectedCoin}-${chartInterval}`}
                            ref={webGLEngineRef}
                            isHoveringDrawing={isHoveringDrawing}
                            candles={allCandles}
                            predictedCandle={predictedCandle}
                            drawings={drawings}
                            brushPath={brushPath}
                            tempShape={tempShape}
                            drawStart={drawStart}
                            activeTool={activeTool}
                            visualIndicators={visualIndicators}
                            indicatorDataMap={indicatorDataMapRef.current}
                            darkMode={darkMode}
                            chartStyle={chartStyle}
                            chartInterval={chartInterval}
                            selectedCoin={selectedCoin}
                            volumeProfile={volumeProfile}
                            priceScaleMode={priceScaleMode}
                            timezoneOffset={timezoneOffset}
                            autoScale={autoScale}
                            invertScale={invertScale}
                            hideDrawings={hideDrawings}
                            cursorSettings={cursorSettings}
                            hoverCoords={hoverCoords}
                            selectedDrawingId={selectedDrawingId}
                            initialVisibleRange={viewportSnapshotRef.current}
                            onCrosshairMove={(x, y) => { /* Optional crosshair sync */ }}
                            onVisibleRangeChange={(range) => {
                              if (drawingLayerRef.current) drawingLayerRef.current.draw();
                              if (range?.from && range?.to) {
                                viewportSnapshotRef.current = { visibleRange: range };
                                if (saveRangeTimeoutRef.current) clearTimeout(saveRangeTimeoutRef.current);
                                saveRangeTimeoutRef.current = setTimeout(() => {
                                  localStorage.setItem(visibleRangeStorageKey, JSON.stringify(range));
                                }, 300);

                                if (allCandles.length > 0) {
                                  const lastTime = allCandles[allCandles.length - 1].time;
                                  setIsAtLiveEdge(range.to >= lastTime - 100);

                                  const avgTime = (allCandles[allCandles.length - 1].time - allCandles[0].time) / allCandles.length;
                                  if (range.from < allCandles[0].time + (avgTime * 100)) {
                                    loadOlderData();
                                  }
                                }
                              }
                            }}
                            onChartReady={() => {
                              // Preserved viewport
                            }}
                          />
                        </Suspense>
                        </WebGLErrorBoundary>
                      ) : renderEngine === 'webgpu' ? (
                        <Suspense fallback={
                          <div className="w-full h-full flex items-center justify-center"
                               style={{ background: '#0d1117' }}>
                            <div className="flex flex-col items-center gap-3 animate-pulse">
                              <Rocket size={36} className="text-purple-400" />
                              <span className="text-sm font-medium text-purple-300">WebGPU Engine Loading...</span>
                            </div>
                          </div>
                        }>
                          <WebGPUChartEngine
                            key={`${renderEngine}-${selectedCoin}-${chartInterval}`}
                            ref={webGLEngineRef}
                            candles={allCandles}
                            darkMode={darkMode}
                            chartStyle={chartStyle}
                            autoScale={autoScale}
                            invertScale={invertScale}
                            priceScaleMode={priceScaleMode}
                            timezoneOffset={timezoneOffset}
                            activeTool={activeTool}
                            isHoveringDrawing={isHoveringDrawing}
                            drawings={drawings}
                            tempShape={tempShape}
                            drawStart={drawStart}
                            visualIndicators={visualIndicators}
                            indicatorDataMap={indicatorDataMapRef.current}
                            volumeProfile={volumeProfile}
                            hoverCoords={hoverCoords}
                            selectedDrawingId={selectedDrawingId}
                            hideDrawings={hideDrawings}
                            cursorSettings={cursorSettings}
                            strategySignals={strategySignals}
                            showHeatmap={showHeatmap}
                            heatmapClusters={heatmapClusters}
                            initialVisibleRange={viewportSnapshotRef.current}
                            onVisibleRangeChange={(range) => {
                              if (drawingLayerRef.current) drawingLayerRef.current.draw();
                              if (range?.from && range?.to) {
                                viewportSnapshotRef.current = { visibleRange: range };
                                if (saveRangeTimeoutRef.current) clearTimeout(saveRangeTimeoutRef.current);
                                saveRangeTimeoutRef.current = setTimeout(() => {
                                  localStorage.setItem(visibleRangeStorageKey, JSON.stringify(range));
                                }, 300);

                                if (allCandles.length > 0) {
                                  const lastTime = allCandles[allCandles.length - 1].time;
                                  setIsAtLiveEdge(range.to >= lastTime - 100);

                                  const avgTime = (allCandles[allCandles.length - 1].time - allCandles[0].time) / allCandles.length;
                                  if (range.from < allCandles[0].time + (avgTime * 100)) {
                                    loadOlderData();
                                  }
                                }
                              }
                            }}
                            onChartReady={() => {
                              // Preserved viewport
                            }}
                          />
                        </Suspense>
                      ) : (
                        <div ref={chartRef} className="w-full h-full absolute top-0 left-0" />
                      )}
          <NativeIndicatorLayer preference="webgl" visualIndicators={visualIndicators} indicatorDataMap={indicatorDataMapRef.current} visibleRange={viewportSnapshotRef.current?.visibleRange || (chartInstance.current ? chartInstance.current.timeScale().getVisibleRange() : null)} />
          <NativeDrawingLayer
            preference="webgl" 
            ref={drawingLayerRef}
            drawings={drawings}
            brushPath={brushPath}
            tempShape={tempShape}
            drawStart={drawStart}
            activeTool={activeTool}
            getPixel={getPixel}
            coordinateToTimePrice={coordinateToTimePrice}
            allCandles={allCandles}
            visibleRange={viewportSnapshotRef.current?.visibleRange || (chartInstance.current ? chartInstance.current.timeScale().getVisibleRange() : null)}
            selectedDrawingId={selectedDrawingId}
            hideDrawings={hideDrawings}
            volumeProfile={volumeProfile}
            darkMode={darkMode}
            cursorSettings={cursorSettings}
            hoverCoords={hoverCoords}
            magicTrail={magicTrail}
          />
          <DrawingAxisLabels drawings={drawings} getPixel={getPixel} />
                      {renderChartOverlays()}
                    </div>
                  ) : chartLayout === '2v' ? (
                    <div className="w-full h-full grid grid-cols-2 gap-2 p-1 bg-black/20">
                      <div 
                        ref={chartContainerRef}
                        className="w-full h-full relative border border-blue-500/20 rounded overflow-hidden"
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerLeave={handlePointerUp}
                        style={{ 
                          touchAction: activeTool ? 'none' : 'auto',
                          cursor: (activeTool && ['dot', 'demonstration', 'magic'].includes(activeTool)) ? 'none' : 'crosshair'
                        }}
                      >
                        <div ref={chartRef} className="w-full h-full absolute top-0 left-0" />
          <NativeIndicatorLayer preference="webgl" visualIndicators={visualIndicators} indicatorDataMap={indicatorDataMapRef.current} visibleRange={viewportSnapshotRef.current?.visibleRange || (chartInstance.current ? chartInstance.current.timeScale().getVisibleRange() : null)} />
          <NativeDrawingLayer
            preference="webgl" 
            ref={drawingLayerRef}
            drawings={drawings}
            brushPath={brushPath}
            tempShape={tempShape}
            drawStart={drawStart}
            activeTool={activeTool}
            getPixel={getPixel}
            coordinateToTimePrice={coordinateToTimePrice}
            allCandles={allCandles}
            visibleRange={viewportSnapshotRef.current?.visibleRange || (chartInstance.current ? chartInstance.current.timeScale().getVisibleRange() : null)}
            selectedDrawingId={selectedDrawingId}
            hideDrawings={hideDrawings}
            volumeProfile={volumeProfile}
            darkMode={darkMode}
            cursorSettings={cursorSettings}
            hoverCoords={hoverCoords}
            magicTrail={magicTrail}
          />
          <DrawingAxisLabels drawings={drawings} getPixel={getPixel} />
                        {renderChartOverlays()}
                      </div>
                      <MiniChartWrapper coin={selectedCoin} interval={getAltInterval(1)} darkMode={darkMode} />
                    </div>
                  ) : chartLayout === '2h' ? (
                    <div className="w-full h-full grid grid-rows-2 gap-2 p-1 bg-black/20">
                      <div 
                        ref={chartContainerRef}
                        className="w-full h-full relative border border-blue-500/20 rounded overflow-hidden"
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerLeave={handlePointerUp}
                        style={{ 
                          touchAction: activeTool ? 'none' : 'auto',
                          cursor: (activeTool && ['dot', 'demonstration', 'magic'].includes(activeTool)) ? 'none' : 'crosshair'
                        }}
                      >
                        <div ref={chartRef} className="w-full h-full absolute top-0 left-0" />
          <NativeIndicatorLayer preference="webgl" visualIndicators={visualIndicators} indicatorDataMap={indicatorDataMapRef.current} visibleRange={viewportSnapshotRef.current?.visibleRange || (chartInstance.current ? chartInstance.current.timeScale().getVisibleRange() : null)} />
          <NativeDrawingLayer
            preference="webgl" 
            ref={drawingLayerRef}
            drawings={drawings}
            brushPath={brushPath}
            tempShape={tempShape}
            drawStart={drawStart}
            activeTool={activeTool}
            getPixel={getPixel}
            coordinateToTimePrice={coordinateToTimePrice}
            allCandles={allCandles}
            visibleRange={viewportSnapshotRef.current?.visibleRange || (chartInstance.current ? chartInstance.current.timeScale().getVisibleRange() : null)}
            selectedDrawingId={selectedDrawingId}
            hideDrawings={hideDrawings}
            volumeProfile={volumeProfile}
            darkMode={darkMode}
            cursorSettings={cursorSettings}
            hoverCoords={hoverCoords}
            magicTrail={magicTrail}
          />
          <DrawingAxisLabels drawings={drawings} getPixel={getPixel} />
                        {renderChartOverlays()}
                      </div>
                      <MiniChartWrapper coin={selectedCoin} interval={getAltInterval(1)} darkMode={darkMode} />
                    </div>
                  ) : (
                    <div className="w-full h-full grid grid-cols-2 grid-rows-2 gap-2 p-1 bg-black/20">
                      <div 
                        ref={chartContainerRef}
                        className="w-full h-full relative border border-blue-500/20 rounded overflow-hidden"
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerLeave={handlePointerUp}
                        style={{ 
                          touchAction: activeTool ? 'none' : 'auto',
                          cursor: (activeTool && ['dot', 'demonstration', 'magic'].includes(activeTool)) ? 'none' : 'crosshair'
                        }}
                      >
                        <div ref={chartRef} className="w-full h-full absolute top-0 left-0" />
          <NativeIndicatorLayer preference="webgl" visualIndicators={visualIndicators} indicatorDataMap={indicatorDataMapRef.current} visibleRange={viewportSnapshotRef.current?.visibleRange || (chartInstance.current ? chartInstance.current.timeScale().getVisibleRange() : null)} />
          <NativeDrawingLayer
            preference="webgl" 
            ref={drawingLayerRef}
            drawings={drawings}
            brushPath={brushPath}
            tempShape={tempShape}
            drawStart={drawStart}
            activeTool={activeTool}
            getPixel={getPixel}
            coordinateToTimePrice={coordinateToTimePrice}
            allCandles={allCandles}
            visibleRange={viewportSnapshotRef.current?.visibleRange || (chartInstance.current ? chartInstance.current.timeScale().getVisibleRange() : null)}
            selectedDrawingId={selectedDrawingId}
            hideDrawings={hideDrawings}
            volumeProfile={volumeProfile}
            darkMode={darkMode}
            cursorSettings={cursorSettings}
            hoverCoords={hoverCoords}
            magicTrail={magicTrail}
          />
          <DrawingAxisLabels drawings={drawings} getPixel={getPixel} />
                        {renderChartOverlays()}
                      </div>
                      <MiniChartWrapper coin={selectedCoin} interval={getAltInterval(1)} darkMode={darkMode} />
                      <MiniChartWrapper coin={selectedCoin} interval={getAltInterval(2)} darkMode={darkMode} />
                      <MiniChartWrapper coin={selectedCoin} interval={getAltInterval(3)} darkMode={darkMode} />
                    </div>
                  )}
                </div>

                {/* Separate Oscillator Dynamic Sub Panes */}
                {visualIndicators.filter(ind => ind.visible && INDICATOR_REGISTRY[ind.type]?.kind === 'subchart').length > 0 && (
                  <div className="flex flex-col shrink-0 border-t border-[#2a2e39]/50 bg-black/10 min-h-0" style={{ height: '45%' }}>
                    {visualIndicators.filter(ind => ind.visible && INDICATOR_REGISTRY[ind.type]?.kind === 'subchart').map((ind) => (
                      <div 
                        key={ind.id} 
                        id={`subchart-container-${ind.id}`} 
                        className="flex-1 min-w-0 relative border-b border-[#2a2e39]/30 last:border-0"
                      >
                        <div className="absolute top-2.5 left-2.5 z-10 text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#1e222d] border border-[#2a2e39] text-[#787b86] uppercase tracking-wider">
                          {ind.name} ({INDICATOR_REGISTRY[ind.type]?.paramSchema.map(p => ind.params[p.key]).join(',') || 'Default'}) Pane
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {replayMode && fullCandlesRef.current.length > 1 && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 bg-[#1e222d]/95 border border-[#2a2e39] rounded-xl px-4 py-2.5 flex items-center gap-3 shadow-2xl animate-fade-in text-white min-w-[340px] md:min-w-[480px]">
                  {/* Title Badge */}
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-orange-500/10 border border-orange-500/20 text-orange-400 text-[10px] font-bold uppercase tracking-wider shrink-0">
                    <History size={11} />
                    <span>Replay</span>
                  </div>

                  {/* Play / Pause */}
                  <button
                    onClick={() => setIsReplayPlaying(!isReplayPlaying)}
                    className="p-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition-colors cursor-pointer shrink-0"
                    title={isReplayPlaying ? "Pause Playback" : "Start Playback"}
                  >
                    {isReplayPlaying ? <Minus size={14} className="rotate-90" /> : <Play size={14} />}
                  </button>

                  {/* Step Forward */}
                  <button
                    onClick={() => {
                      setIsReplayPlaying(false);
                      setReplayIndex(prev => {
                        if (prev === null) return 0;
                        if (prev >= fullCandlesRef.current.length - 1) return prev;
                        return prev + 1;
                      });
                    }}
                    className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition-colors cursor-pointer shrink-0"
                    title="Step Forward (1 Bar)"
                  >
                    <ArrowRight size={14} />
                  </button>

                  {/* Progress Range Slider */}
                  <input
                    type="range"
                    min={10}
                    max={fullCandlesRef.current.length - 1}
                    value={replayIndex ?? fullCandlesRef.current.length - 1}
                    onChange={(e) => {
                      setIsReplayPlaying(false);
                      setReplayIndex(Number(e.target.value));
                    }}
                    className="flex-1 accent-blue-500 h-1.5 rounded-lg bg-gray-700 appearance-none cursor-pointer"
                  />

                  {/* Frame index text */}
                  <span className="text-[10px] font-mono text-gray-400 shrink-0">
                    {replayIndex ?? 0}/{fullCandlesRef.current.length}
                  </span>

                  {/* Speed Selector */}
                  <select
                    value={replaySpeed}
                    onChange={(e) => setReplaySpeed(Number(e.target.value))}
                    className="bg-[#131722] border border-[#2a2e39] text-white text-[10px] font-bold rounded px-1.5 py-1 outline-none cursor-pointer shrink-0"
                    title="Playback Speed"
                  >
                    <option value="2000">0.5s / bar</option>
                    <option value="1000">1.0s / bar</option>
                    <option value="500">2.0s / bar</option>
                    <option value="200">5.0s / bar</option>
                  </select>

                  {/* Close / Exit Replay */}
                  <button
                    onClick={() => {
                      setIsReplayPlaying(false);
                      if (fullCandlesRef.current.length) {
                        allCandlesRef.current = [...fullCandlesRef.current];
                        setAllCandles([...fullCandlesRef.current]);
                      }
                      setReplayMode(false);
                      showToast('▶️ Replay off');
                    }}
                    className="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition-colors cursor-pointer shrink-0 ml-1"
                    title="Exit Replay"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

            {/* NEW TRADINGVIEW STYLE BOTTOM BAR */}
            <div className={`shrink-0 w-full flex items-center justify-between px-2 py-0.5 ${darkMode ? 'bg-[#131722]' : 'bg-[#ffffff]'} border-t ${darkMode ? 'border-[#2a2e39]' : 'border-gray-200'} select-none z-20`}>
              {/* Left: Date Range */}
              <div className="flex items-center gap-1 text-[10px] font-bold text-[#787b86]">
                {['1D', '5D', '1M', '3M', '6M', 'YTD', '1Y', '5Y', 'All'].map(range => (
                  <button 
                    key={range} 
                    onClick={() => applyTimeRange(range)} 
                    className={`px-1.5 py-0.5 rounded transition-colors ${darkMode ? 'hover:bg-[#2a2e39] hover:text-[#d1d4dc]' : 'hover:bg-gray-100 hover:text-black'}`}
                  >
                    {range}
                  </button>
                ))}
                <button onClick={() => showToast("Select date range...")} className={`hover:text-black dark:hover:text-[#d1d4dc] transition-colors p-0.5 ml-1`} title="Select custom range">
                  <Calendar size={11} />
                </button>
              </div>
              
              {/* Right: Time and Options */}
              <div className="flex items-center gap-2 text-[10.5px] font-bold text-[#787b86]">
                <span className="font-mono">{new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })} <span className="opacity-70">UTC</span></span>
                <span className={`h-3 w-px ${darkMode ? 'bg-[#2a2e39]' : 'bg-gray-300'} mx-1`} />
                <button className={`px-1.5 py-0.5 rounded transition-colors ${darkMode ? 'hover:bg-[#2a2e39] hover:text-[#d1d4dc]' : 'hover:bg-gray-100 hover:text-black'}`} title="Percentage Scale">%</button>
                <button className={`px-1.5 py-0.5 rounded transition-colors ${darkMode ? 'hover:bg-[#2a2e39] hover:text-[#d1d4dc]' : 'hover:bg-gray-100 hover:text-black'}`} title="Logarithmic Scale">log</button>
                <button className={`px-1.5 py-0.5 rounded transition-colors ${darkMode ? 'hover:bg-[#2a2e39] hover:text-[#d1d4dc]' : 'hover:bg-gray-100 hover:text-black'}`} title="Auto Scale">auto</button>
              </div>
            </div>
            </div>

          </div>
          <LeftToolbar 
  horizontal={true} t={t} darkMode={darkMode} activeTool={activeTool} 
  setActiveTool={setActiveTool} showToast={showToast} setDrawings={setDrawings}
  selectedTools={selectedTools} setSelectedTools={setSelectedTools} activeFlyout={activeFlyout}
  setActiveFlyout={setActiveFlyout} setIsCursorStudioOpen={setIsCursorStudioOpen} 
  setIsTrendStudioOpen={setIsTrendStudioOpen} chartInstance={chartInstance}
  isMagnetEnabled={magnetMode !== 'off'} setIsMagnetEnabled={() => setMagnetMode(magnetMode === 'off' ? 'normal' : 'off')}
  isDrawingLocked={lockDrawings} setIsDrawingLocked={setLockDrawings}
  isDrawingHidden={hideDrawings} setIsDrawingHidden={setHideDrawings}
  renderEngine={renderEngine} handleEngineToggle={handleEngineToggle}
  keepDrawing={keepDrawing} setKeepDrawing={setKeepDrawing}
  lockDrawings={lockDrawings} setLockDrawings={setLockDrawings}
/>
        </div>

        {lowerBoxState === 'hidden' && (
          <div 
            className="absolute bottom-0 left-0 w-full h-3 z-50 cursor-pointer"
            onMouseEnter={() => setLowerBoxState('minimized')}
            title="Hover to show Report Panel"
          />
        )}

        <div 
          className={`w-full ${t.bg} flex flex-col min-h-0 transition-all duration-300 ${lowerBoxState === 'hidden' ? '' : `border-t ${t.border} shadow-lg`} z-10 ${getLowerBoxHeight()}`}
          onMouseLeave={() => { 
            if (!isReportPinned && lowerBoxState === 'minimized') {
              setLowerBoxState('hidden'); 
            }
          }}
        >
          {/* Main Top Header */}
          <div className={`min-h-[42px] flex items-center justify-between px-3 md:px-4 shrink-0 ${t.bg} transition-colors duration-200 gap-2`}>
            <div className="flex items-center gap-4 md:gap-8 h-full">
              {/* Strategy Name */}
              <div className="flex items-center gap-2 font-bold text-[13px] md:text-[14px] shrink-0">
                <div className={`w-5 h-5 rounded flex items-center justify-center ${darkMode ? 'bg-white/10' : 'bg-black/10'}`}>
                  <Activity size={13} className={t.text} />
                </div>
                <span className={t.text}>Strategy Tester</span>
                <ChevronDown size={14} className={t.muted} />
              </div>
              
              {/* Main Tabs */}
              <div className="h-full flex gap-1 md:gap-4 font-semibold text-[12px] md:text-[13px] overflow-x-auto mobile-scroll-x">
                {['Overview', 'List of trades', 'Trading Panel'].map((tab) => (
                  <button key={tab} onClick={() => { setActiveTab(tab); if (lowerBoxState === 'minimized') setLowerBoxState(isMobile ? 'maximized' : 'maximized'); }} className={`h-full relative flex items-center shrink-0 transition-colors ${activeTab === tab || (tab === 'Overview' && activeTab === 'Performance Summary') ? t.text : `${t.muted} hover:text-blue-500`}`}>
                    {(activeTab === tab || (tab === 'Overview' && activeTab === 'Performance Summary')) && <div className={`absolute bottom-0 left-0 w-full h-[2px] bg-blue-500 rounded-t-sm`} />}
                    <span className="px-1 md:px-2 z-10 whitespace-nowrap">{tab === 'List of trades' && isMobile ? 'Trades' : tab === 'Trading Panel' && isMobile ? 'Trade' : tab}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className={`flex gap-1 ${t.muted} items-center shrink-0`}>
              <button 
                onClick={() => setShowPredictionReport(true)} 
                className={`hidden sm:flex items-center gap-1 px-2 py-1 ${darkMode ? 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'} rounded text-[11px] font-bold mr-1 transition-colors`}
              >
                <BarChartHorizontal size={12} /> Prediction Report
              </button>
              <button onClick={downloadReportScreenshot} className="hidden sm:flex items-center gap-1 px-2 py-1 bg-[#7C5CFF]/10 text-[#7C5CFF] hover:bg-[#7C5CFF]/20 rounded text-[11px] font-bold mr-1 transition-colors"><Download size={12} /> Download</button>
              <button onClick={() => setIsReportPinned(!isReportPinned)} className={`p-2 md:p-1 ${t.hover} rounded transition-colors ${isReportPinned ? 'text-blue-500' : ''}`} title={isReportPinned ? 'Unpin (Auto-hide)' : 'Pin panel'}>
                {isReportPinned ? <Pin size={14} className="fill-current" /> : <PinOff size={14} />}
              </button>
              <button onClick={() => setLowerBoxState(lowerBoxState === 'minimized' ? 'maximized' : 'minimized')} className={`p-2 md:p-1 ${t.hover} rounded transition-colors`} title={lowerBoxState === 'minimized' ? 'Expand' : 'Minimize'}>{lowerBoxState === 'minimized' ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}</button>
              <button 
                onClick={() => setLowerBoxState(lowerBoxState === 'maximized' ? 'normal' : 'maximized')} 
                className={`p-1.5 md:p-1 ${t.hover} rounded transition-colors`} 
                title={lowerBoxState === 'maximized' ? 'Restore size' : 'Fullscreen / Maximize'}
              >
                {lowerBoxState === 'maximized' ? <Minimize2 size={14}/> : <Maximize2 size={14}/>}
              </button>
            </div>
          </div>

          {/* Secondary Sub-header Toolbar */}
          <div className={`min-h-[36px] border-b ${t.border} flex items-center px-4 shrink-0 bg-transparent transition-colors duration-200 gap-5 text-[11.5px] font-semibold text-[#787b86] overflow-x-auto mobile-scroll-x`}>
            <div className={`flex items-center gap-1.5 cursor-pointer hover:text-blue-500 transition-colors whitespace-nowrap`}>
              <Calendar size={13} />
              <span>Jun 8, 2026 - Jul 18, 2026</span>
              <ChevronDown size={12} className="opacity-70" />
            </div>
            <div className={`flex items-center gap-1.5 cursor-pointer hover:text-blue-500 transition-colors whitespace-nowrap`}>
              <DollarSign size={13} />
              <span>10K USDT</span>
              <ChevronDown size={12} className="opacity-70" />
            </div>
            <div className={`flex items-center gap-1.5 cursor-pointer hover:text-blue-500 transition-colors whitespace-nowrap`}>
              <Filter size={13} />
              <span>Default detalization</span>
              <ChevronDown size={12} className="opacity-70" />
            </div>
            <div className={`flex items-center gap-1.5 cursor-pointer hover:text-blue-500 transition-colors whitespace-nowrap`}>
              <Code size={13} />
              <span>Script execution</span>
              <Info size={12} className="opacity-70" />
              <ChevronDown size={12} className="opacity-70" />
            </div>
          </div>


          {lowerBoxState !== 'minimized' && (
            <div className={`flex-1 min-h-0 overflow-y-auto dark-scrollbar p-4 md:p-6 ${t.bg} transition-colors duration-200`}>
              {backendOfflineNotice && (
                <div className="mb-4 px-3 py-2 bg-yellow-500/10 border border-yellow-500/30 text-yellow-500 rounded-lg text-[11px] font-bold flex items-center gap-1.5 animate-pulse">
                  <Info size={12} />
                  <span>{backendOfflineNotice}</span>
                </div>
              )}
              
              {/* === NEW TRADINGVIEW STRATEGY TESTER LAYOUT === */}
              {(activeTab === 'Overview' || activeTab === 'Performance Summary') && (
                <div className="flex flex-col w-full max-w-[1200px] mx-auto pb-10">
                  
                  {/* EQUITY CURVE (Top Chart) */}
                  <div className="w-full mb-8">
                    <div className="flex items-center justify-between mb-4 px-2">
                      <div className={`text-[16px] font-bold ${t.text}`}>Strategy Performance</div>
                      <div className={`text-[11px] ${t.muted} bg-[#2a2e39]/20 px-2 py-1 rounded-md`}>{equityChartData.length} pts</div>
                    </div>
                    <div className="h-[200px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={equityChartData} margin={{ top: 8, right: 0, left: -18, bottom: 0 }}>
                          <XAxis dataKey="trade" tick={{fontSize: 10, fill: '#787b86'}} minTickGap={28} axisLine={false} tickLine={false} />
                          <YAxis yAxisId="left" domain={['auto', 'auto']} tick={{fontSize: 10, fill: '#787b86'}} axisLine={false} tickLine={false} width={48} />
                          <Tooltip
                            contentStyle={{backgroundColor: darkMode ? '#1e222d' : '#f8f9fa', color: darkMode ? '#d1d4dc' : '#131722', borderRadius: '8px', border: `1px solid ${darkMode ? '#2a2e39' : '#e0e3eb'}`, fontSize: '12px'}}
                            formatter={(value, name) => {
                              if (name === 'drawdown') return [`${formatNumber(value)}%`, 'Drawdown'];
                              if (name === 'pnl') return [formatMoney(value, true), 'Trade P&L'];
                              return [formatMoney(value), 'Equity'];
                            }}
                          />
                          <Area yAxisId="left" type="step" dataKey="equity" stroke="#7C5CFF" fill="url(#colorEquity)" strokeWidth={2} activeDot={{r: 4, fill: '#7C5CFF', stroke: darkMode ? '#131722' : '#ffffff'}} />
                          <defs>
                            <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#7C5CFF" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#7C5CFF" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className={`h-px w-full ${darkMode ? 'bg-[#2a2e39]/50' : 'bg-gray-200'} mb-8`} />

                  {/* 1. RETURN DETAILS */}
                  <div className="mb-10 px-2">
                    <div className={`text-[16px] font-bold ${t.text} mb-3`}>Return details</div>
                    <div className="flex gap-2 mb-6">
                      {['Overview', 'Returns', 'Benchmarking', 'Risk-adjusted performance'].map(p => (
                        <button key={p} className={`px-3 py-1 text-[11px] font-semibold rounded-full transition-colors ${p === 'Overview' ? (darkMode ? 'bg-white text-black' : 'bg-black text-white') : (darkMode ? 'bg-[#2a2e39]/50 text-gray-400 hover:bg-[#2a2e39]' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}`}>
                          {p}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
                      <div>
                        <div className={`text-[11px] ${t.muted} mb-1`}>Open PnL</div>
                        <div className="text-[14px] font-mono font-bold text-[#089981]">+{metrics.summary.netProfitVal > 0 ? (metrics.summary.netProfitVal * 0.05).toFixed(2) : '7.23'} USDT <span className="text-[11px]">+0.08%</span></div>
                      </div>
                      <div>
                        <div className={`text-[11px] ${t.muted} mb-1`}>Expected payoff</div>
                        <div className={`text-[14px] font-mono font-bold ${t.text}`}>${metrics.advanced.expectancy.toFixed(2)} USDT</div>
                      </div>
                      <div>
                        <div className={`text-[11px] ${t.muted} mb-1`}>Strategy outperformance</div>
                        <div className="text-[14px] font-mono font-bold text-[#F23645]">-{Math.abs(metrics.summary.netProfitVal - 850).toFixed(2)} USDT <span className="text-[11px]">-6.17%</span></div>
                      </div>
                      <div>
                        <div className={`text-[11px] ${t.muted} mb-1`}>Sharpe ratio</div>
                        <div className={`text-[14px] font-mono font-bold ${t.text}`}>2.14</div>
                      </div>
                    </div>

                    {/* Return Details Charts */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      {/* Profit Structure */}
                      <div>
                        <div className={`text-[12px] font-bold ${t.text} mb-4`}>Profit structure</div>
                        <div className={`h-[180px] w-full border-b ${darkMode ? 'border-[#2a2e39]/50' : 'border-gray-200'} relative flex items-end px-4`}>
                          <div className="w-1/4 h-[80%] bg-[#089981] relative"></div>
                          <div className="w-1/4 h-[90%] bg-[#F23645] relative left-4"></div>
                          <div className="w-1/4 h-[5%] bg-amber-500 relative left-8"></div>
                          <div className="w-1/4 h-[20%] bg-blue-500 relative left-12"></div>
                          
                          {/* Y-axis labels */}
                          <div className="absolute right-0 top-0 text-[10px] text-[#787b86]">4.50K</div>
                          <div className="absolute right-0 top-[33%] text-[10px] text-[#787b86]">3.00K</div>
                          <div className="absolute right-0 top-[66%] text-[10px] text-[#787b86]">1.50K</div>
                          <div className="absolute right-0 bottom-0 text-[10px] text-[#787b86]">0.00</div>
                        </div>
                        <div className="flex gap-4 mt-4 text-[10px] text-[#787b86] justify-center">
                          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#089981]" /> Total profit</div>
                          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-cyan-700" /> Open PnL</div>
                          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#F23645]" /> Total loss</div>
                          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-500" /> Commission</div>
                          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500" /> Total PnL</div>
                        </div>
                      </div>

                      {/* Benchmarking */}
                      <div>
                        <div className={`text-[12px] font-bold ${t.text} mb-4`}>Benchmarking</div>
                        <div className={`h-[180px] w-full border-b ${darkMode ? 'border-[#2a2e39]/50' : 'border-gray-200'} relative flex items-center justify-center`}>
                          
                          <div className="w-full flex items-center justify-between px-10">
                            {/* Orange side (Buy & Hold) */}
                            <div className="flex flex-col items-end gap-2 w-1/3">
                              <div className="flex items-center w-full">
                                <div className="bg-amber-600 text-white text-[9px] px-1 font-bold z-10 w-[40px] text-center">Max</div>
                                <div className="bg-amber-500 text-white text-[9px] px-1 text-right w-full font-mono">5.74%</div>
                              </div>
                              <div className="flex items-center w-full scale-105">
                                <div className="bg-amber-600 text-white text-[9px] px-1 font-bold z-10 w-[40px] text-center">Current</div>
                                <div className="bg-amber-500 text-white text-[9px] px-1 text-right w-full font-mono">1.07%</div>
                              </div>
                              <div className="flex items-center w-full">
                                <div className="bg-amber-600 text-white text-[9px] px-1 font-bold z-10 w-[40px] text-center">Min</div>
                                <div className="bg-amber-500 text-white text-[9px] px-1 text-right w-full font-mono">-7.69%</div>
                              </div>
                            </div>

                            {/* Connecting dashed lines */}
                            <svg className="absolute left-1/3 w-1/3 h-[180px] z-0" style={{ pointerEvents: 'none' }}>
                               <path d="M0,60 L130,90" stroke="#787b86" strokeDasharray="2,2" fill="none" />
                               <path d="M0,90 L130,90" stroke="#787b86" strokeDasharray="2,2" fill="none" />
                               <path d="M0,120 L130,90" stroke="#787b86" strokeDasharray="2,2" fill="none" />
                            </svg>

                            {/* Blue side (Strategy) */}
                            <div className="flex flex-col items-start gap-2 w-1/3">
                              <div className="flex items-center w-full">
                                <div className="bg-blue-600 text-white text-[9px] px-1 font-bold z-10 w-[40px] text-center">Max</div>
                                <div className="bg-blue-500 text-white text-[9px] px-1 text-left w-full font-mono">1.27%</div>
                              </div>
                              <div className="flex items-center w-full scale-105">
                                <div className="bg-blue-600 text-white text-[9px] px-1 font-bold z-10 w-[40px] text-center">Current</div>
                                <div className="bg-blue-500 text-white text-[9px] px-1 text-left w-full font-mono">-4.99%</div>
                              </div>
                              <div className="flex items-center w-full">
                                <div className="bg-blue-600 text-white text-[9px] px-1 font-bold z-10 w-[40px] text-center">Min</div>
                                <div className="bg-blue-500 text-white text-[9px] px-1 text-left w-full font-mono">-8.09%</div>
                              </div>
                            </div>
                          </div>

                          {/* Y-axis labels */}
                          <div className="absolute right-0 top-[20%] text-[10px] text-[#787b86]">10.00%</div>
                          <div className="absolute right-0 top-[40%] text-[10px] text-[#787b86]">5.00%</div>
                          <div className="absolute right-0 top-[60%] text-[10px] text-[#787b86]">0.00%</div>
                          <div className="absolute right-0 top-[80%] text-[10px] text-[#787b86]">-5.00%</div>
                        </div>
                        <div className="flex gap-4 mt-4 text-[10px] text-[#787b86] justify-center">
                          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-500" /> Buy and hold PnL</div>
                          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500" /> Strategy PnL</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className={`h-px w-full ${darkMode ? 'bg-[#2a2e39]/50' : 'bg-gray-200'} mb-8`} />

                  {/* 2. TRADES ANALYSIS */}
                  <div className="mb-10 px-2">
                    <div className={`text-[16px] font-bold ${t.text} mb-3`}>Trades analysis</div>
                    <div className="flex gap-2 mb-6">
                      <button className={`px-3 py-1 text-[11px] font-semibold rounded-full transition-colors ${darkMode ? 'bg-white text-black' : 'bg-black text-white'}`}>Overview</button>
                      <button className={`px-3 py-1 text-[11px] font-semibold rounded-full transition-colors ${darkMode ? 'bg-[#2a2e39]/50 text-gray-400 hover:bg-[#2a2e39]' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>Trades analysis details</button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
                      <div>
                        <div className={`text-[11px] ${t.muted} mb-1`}>Average PnL</div>
                        <div className={`text-[14px] font-mono font-bold ${t.text}`}>-${Math.abs(metrics.advanced.avgLoss).toFixed(2)} USDT <span className="text-[11px] text-[#787b86]">-0.02%</span></div>
                      </div>
                      <div>
                        <div className={`text-[11px] ${t.muted} mb-1`}>Average bars in trades</div>
                        <div className={`text-[14px] font-mono font-bold ${t.text}`}>21</div>
                      </div>
                      <div>
                        <div className={`text-[11px] ${t.muted} mb-1`}>Largest profit</div>
                        <div className={`text-[14px] font-mono font-bold ${t.text}`}>${metrics.advanced.bestTrade.toFixed(2)} USDT</div>
                      </div>
                      <div>
                        <div className={`text-[11px] ${t.muted} mb-1`}>Largest loss</div>
                        <div className={`text-[14px] font-mono font-bold ${t.text}`}>${metrics.advanced.worstTrade.toFixed(2)} USDT</div>
                      </div>
                    </div>
                  </div>

                  <div className={`h-px w-full ${darkMode ? 'bg-[#2a2e39]/50' : 'bg-gray-200'} mb-8`} />

                  {/* 3. EQUITY RUN-UPS AND DRAWDOWNS */}
                  <div className="mb-10 px-2">
                    <div className={`text-[16px] font-bold ${t.text} mb-3`}>Equity run-ups and drawdowns</div>
                    <div className="flex gap-2 mb-6">
                      <button className={`px-3 py-1 text-[11px] font-semibold rounded-full transition-colors ${darkMode ? 'bg-white text-black' : 'bg-black text-white'}`}>Overview</button>
                      <button className={`px-3 py-1 text-[11px] font-semibold rounded-full transition-colors ${darkMode ? 'bg-[#2a2e39]/50 text-gray-400 hover:bg-[#2a2e39]' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>Run-ups</button>
                      <button className={`px-3 py-1 text-[11px] font-semibold rounded-full transition-colors ${darkMode ? 'bg-[#2a2e39]/50 text-gray-400 hover:bg-[#2a2e39]' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>Drawdowns</button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
                      <div>
                        <div className={`text-[11px] ${t.muted} mb-1`}>Average run-up duration</div>
                        <div className={`text-[14px] font-bold ${t.text}`}>7 days</div>
                      </div>
                      <div>
                        <div className={`text-[11px] ${t.muted} mb-1`}>Average drawdown duration</div>
                        <div className={`text-[14px] font-bold ${t.text}`}>5 days</div>
                      </div>
                      <div>
                        <div className={`text-[11px] ${t.muted} mb-1`}>Max drawdown as % of initial capital</div>
                        <div className={`text-[14px] font-mono font-bold ${t.text}`}>{metrics.summary.maxDrawdownPct}%</div>
                      </div>
                      <div>
                        <div className={`text-[11px] ${t.muted} mb-1`}>Return of max drawdown</div>
                        <div className={`text-[14px] font-mono font-bold ${t.text}`}>-0.50 USDT</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      {/* Alternating Growth and Decline */}
                      <div>
                        <div className={`text-[12px] font-bold ${t.text} mb-4`}>Alternating growth and decline</div>
                        <div className={`h-[180px] w-full border-b ${darkMode ? 'border-[#2a2e39]/50' : 'border-gray-200'} relative flex items-end gap-1 px-4`}>
                          <div className="w-[15%] h-[30%] bg-[#F23645]"></div>
                          <div className="w-[15%] h-[35%] bg-[#089981]"></div>
                          <div className="w-[15%] h-[5%] bg-[#F23645]"></div>
                          <div className="w-[15%] h-[15%] bg-[#089981]"></div>
                          <div className="w-[15%] h-[80%] bg-[#F23645]"></div>
                          <div className="w-[15%] h-[25%] bg-[#089981]"></div>
                          
                          {/* Y-axis labels */}
                          <div className="absolute right-0 top-[20%] text-[10px] text-[#787b86]">8.00%</div>
                          <div className="absolute right-0 top-[40%] text-[10px] text-[#787b86]">6.00%</div>
                          <div className="absolute right-0 top-[60%] text-[10px] text-[#787b86]">4.00%</div>
                          <div className="absolute right-0 top-[80%] text-[10px] text-[#787b86]">2.00%</div>
                          <div className="absolute right-0 bottom-0 text-[10px] text-[#787b86]">0.00%</div>
                        </div>
                        <div className="flex gap-4 mt-4 text-[10px] text-[#787b86] justify-center">
                          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#089981]" /> Run-up</div>
                          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#F23645]" /> Drawdown</div>
                          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-cyan-700" /> Current run-up</div>
                        </div>
                      </div>

                      {/* Comparison of growth and decline periods */}
                      <div>
                        <div className={`text-[12px] font-bold ${t.text} mb-4`}>Comparison of growth and decline periods</div>
                        <div className="w-full flex flex-col gap-6">
                          
                          {/* Run-up Group */}
                          <div>
                            <div className="text-[11px] text-[#787b86] mb-2">Run-up</div>
                            <div className="flex flex-col gap-1.5">
                              <div className="flex items-center gap-2">
                                <div className="text-[10px] text-[#787b86] w-16">Maximum</div>
                                <div className={`flex-1 ${darkMode ? 'bg-[#2a2e39]/30' : 'bg-gray-100'} h-4 relative`}>
                                  <div className="absolute top-0 left-0 h-full bg-[#089981]" style={{width: '90%'}}></div>
                                </div>
                                <div className={`text-[10px] ${t.text} w-10 text-right`}>3.70%</div>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="text-[10px] text-[#787b86] w-16">Average</div>
                                <div className={`flex-1 ${darkMode ? 'bg-[#2a2e39]/30' : 'bg-gray-100'} h-4 relative`}>
                                  <div className="absolute top-0 left-0 h-full bg-[#089981]" style={{width: '60%'}}></div>
                                </div>
                                <div className={`text-[10px] ${t.text} w-10 text-right`}>2.86%</div>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="text-[10px] text-[#787b86] w-16">Current</div>
                                <div className={`flex-1 ${darkMode ? 'bg-[#2a2e39]/30' : 'bg-gray-100'} h-4 relative`}>
                                  <div className="absolute top-0 left-0 h-full bg-[#089981]" style={{width: '75%'}}></div>
                                </div>
                                <div className={`text-[10px] ${t.text} w-10 text-right`}>3.37%</div>
                              </div>
                            </div>
                          </div>

                          {/* Drawdown Group */}
                          <div>
                            <div className="text-[11px] text-[#787b86] mb-2">Drawdown</div>
                            <div className="flex flex-col gap-1.5">
                              <div className="flex items-center gap-2">
                                <div className="text-[10px] text-[#787b86] w-16">Maximum</div>
                                <div className={`flex-1 ${darkMode ? 'bg-[#2a2e39]/30' : 'bg-gray-100'} h-4 relative`}>
                                  <div className="absolute top-0 left-0 h-full bg-[#F23645]" style={{width: '100%'}}></div>
                                </div>
                                <div className={`text-[10px] ${t.text} w-10 text-right`}>9.24%</div>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="text-[10px] text-[#787b86] w-16">Average</div>
                                <div className={`flex-1 ${darkMode ? 'bg-[#2a2e39]/30' : 'bg-gray-100'} h-4 relative`}>
                                  <div className="absolute top-0 left-0 h-full bg-[#F23645]" style={{width: '45%'}}></div>
                                </div>
                                <div className={`text-[10px] ${t.text} w-10 text-right`}>4.44%</div>
                              </div>
                            </div>
                          </div>

                        </div>
                      </div>
                    </div>
                  </div>

                  <div className={`h-px w-full ${darkMode ? 'bg-[#2a2e39]/50' : 'bg-gray-200'} mb-8`} />

                  {/* 4. CAPITAL EFFICIENCY */}
                  <div className="mb-4 px-2">
                    <div className={`text-[16px] font-bold ${t.text} mb-3`}>Capital efficiency</div>
                    <div className="flex gap-2">
                      <button className={`px-3 py-1 text-[11px] font-semibold rounded-full transition-colors ${darkMode ? 'bg-white text-black' : 'bg-black text-white'}`}>Overview</button>
                      <button className={`px-3 py-1 text-[11px] font-semibold rounded-full transition-colors ${darkMode ? 'bg-[#2a2e39]/50 text-gray-400 hover:bg-[#2a2e39]' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>Capital usage</button>
                      <button className={`px-3 py-1 text-[11px] font-semibold rounded-full transition-colors ${darkMode ? 'bg-[#2a2e39]/50 text-gray-400 hover:bg-[#2a2e39]' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>Margin usage</button>
                    </div>
                  </div>

                </div>
              )}

              {/* LIST OF TRADES TAB */}
              {activeTab === 'List of trades' && (
                <div className={`w-full overflow-x-auto dark-scrollbar border ${t.border} rounded-xl shadow-sm ${t.sec}`}>
                  <table className="w-full text-left border-collapse min-w-[480px]">
                    <thead className={`sticky top-0 ${t.bg} z-10 shadow-sm border-b ${t.border}`}>
                      <tr>
                        <th className={`font-semibold ${t.muted} py-3 pl-4 pr-2 text-[11px] uppercase tracking-wider`}>Trade #</th>
                        <th className={`font-semibold ${t.muted} py-3 pr-2 text-[11px] uppercase tracking-wider`}>Type</th>
                        <th className={`font-semibold ${t.muted} py-3 pr-2 text-[11px] uppercase tracking-wider`}>Date</th>
                        <th className={`font-semibold ${t.muted} py-3 text-right text-[11px] uppercase tracking-wider`}>Price</th>
                        <th className={`font-semibold ${t.muted} py-3 text-right pr-4 text-[11px] uppercase tracking-wider`}>Profit / Loss</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2a2e39]/30">
                      {metrics.trades && metrics.trades.map(tData => (
                        <tr key={tData.id} className={`${darkMode ? 'hover:bg-[#2a2e39]/50' : 'hover:bg-gray-100'} transition-colors`}>
                          <td className="text-[#7C5CFF] font-medium py-3 pl-4 pr-2 text-[12px]">{tData.id}</td>
                          <td className={`${t.text} py-3 pr-2 font-medium`}>
                            <span className={`px-2 py-0.5 rounded text-[10px] ${tData.type.toLowerCase().includes('long') ? 'bg-[#089981]/15 text-[#089981]' : 'bg-[#F23645]/15 text-[#F23645]'}`}>
                              {tData.type}
                            </span>
                          </td>
                          <td className={`${t.muted} py-3 pr-2 text-[11px]`}>{tData.date}</td>
                          <td className={`text-right font-mono ${t.text} py-3 text-[12px]`}>{tData.price}</td>
                          <td className={`text-right font-mono font-medium py-3 pr-4 text-[12px] ${tData.profit > 0 ? 'text-[#089981]' : tData.profit < 0 ? 'text-[#F23645]' : t.muted}`}>
                            {tData.profit > 0 ? '+' : ''}{tData.profit}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!metrics.trades?.length && (
                    <div className={`py-10 flex flex-col items-center gap-2 text-[12px] ${t.muted}`}><ListFilter size={22} className="opacity-40" /> No trades available to display.</div>
                  )}
                </div>
              )}

              {/* TRADING PANEL TAB */}
              {activeTab === 'Trading Panel' && (
                <div className="flex flex-col h-full bg-[#0b0e14]">
                  {/* Account Summary Header - Binance/Bybit Style */}
                  <div className={`grid grid-cols-2 md:grid-cols-5 gap-2 md:gap-4 p-3 border-b ${t.border} bg-[#131722] shrink-0`}>
                    <div className="flex flex-col justify-center">
                      <span className="text-[#848e9c] text-[10px] md:text-[11px] font-semibold mb-0.5">Total Equity (USD)</span>
                      <span className="text-white text-[13px] md:text-[15px] font-mono font-bold">${(balance + unrealizedPnl).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                    </div>
                    <div className="flex flex-col justify-center">
                      <span className="text-[#848e9c] text-[10px] md:text-[11px] font-semibold mb-0.5">Available Balance</span>
                      <span className="text-white text-[13px] md:text-[15px] font-mono font-bold">${balance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                    </div>
                    <div className="flex flex-col justify-center">
                      <span className="text-[#848e9c] text-[10px] md:text-[11px] font-semibold mb-0.5">Unrealized PNL</span>
                      <span className={`text-[13px] md:text-[15px] font-mono font-bold ${unrealizedPnl >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
                        {unrealizedPnl >= 0 ? '+' : ''}${unrealizedPnl.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                      </span>
                    </div>
                    <div className="flex flex-col justify-center">
                      <span className="text-[#848e9c] text-[10px] md:text-[11px] font-semibold mb-0.5">Margin Usage</span>
                      <span className="text-white text-[13px] md:text-[15px] font-mono font-bold">
                        {positions.length > 0 ? ((positions.reduce((acc, p) => acc + p.qty * (p.symbol === selectedCoin ? livePrice : p.entryPrice), 0) / leverage) / (balance + unrealizedPnl) * 100).toFixed(2) : '0.00'}%
                      </span>
                    </div>
                    <div className="flex flex-col justify-center items-end pr-2 hidden md:flex">
                      <span className="text-[#848e9c] text-[10px] md:text-[11px] font-semibold mb-0.5">Instrument</span>
                      <span className="text-blue-400 text-[13px] md:text-[15px] font-bold">{selectedCoin}</span>
                    </div>
                  </div>

                  <div className="flex flex-col lg:flex-row flex-1 min-h-0 bg-[#0b0e14]">
                    {/* Advanced Order Entry Sidebar */}
                    <div className={`w-full lg:w-[320px] xl:w-[340px] shrink-0 border-r border-b lg:border-b-0 ${t.border} bg-[#131722] flex flex-col h-auto lg:h-full overflow-y-auto custom-scrollbar`}>
                      
                      {/* Margin & Leverage */}
                      <div className={`flex items-center justify-between p-3 border-b ${t.border}`}>
                        <div className="flex bg-[#2b3139] rounded overflow-hidden">
                          <button 
                            className={`px-3 py-1 text-[11px] font-bold transition-colors ${marginMode === 'Cross' ? 'bg-blue-600 text-white' : 'text-[#848e9c] hover:text-white'}`}
                            onClick={() => setMarginMode('Cross')}
                          >Cross</button>
                          <button 
                            className={`px-3 py-1 text-[11px] font-bold transition-colors ${marginMode === 'Isolated' ? 'bg-blue-600 text-white' : 'text-[#848e9c] hover:text-white'}`}
                            onClick={() => setMarginMode('Isolated')}
                          >Isolated</button>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-[#848e9c] font-semibold">{leverage}x</span>
                          <button 
                            className="bg-[#2b3139] hover:bg-[#3b414a] text-white px-2 py-1 rounded text-[11px] font-bold transition-colors"
                            onClick={() => {
                              const newLev = prompt('Enter Leverage (1-125):', leverage);
                              if(newLev && !isNaN(newLev)) setLeverage(Math.min(125, Math.max(1, parseInt(newLev))));
                            }}
                          >Edit</button>
                        </div>
                      </div>

                      <div className="p-4 space-y-5">
                        {/* Order Type Tabs */}
                        <div className="flex gap-4 border-b border-[#2b3139]">
                          {['LIMIT', 'MARKET', 'STOP LIMIT'].map(type => (
                            <button
                              key={type}
                              onClick={() => setOrderType(type === 'STOP LIMIT' ? 'LIMIT' : type)} // Mocking stop limit as limit for paper
                              className={`pb-2 text-[12px] font-bold transition-all relative ${orderType === type || (type === 'LIMIT' && orderType === 'LIMIT' && !useTPSL) ? 'text-white' : 'text-[#848e9c] hover:text-[#b7bdc6]'}`}
                            >
                              {type}
                              {(orderType === type || (type === 'LIMIT' && orderType === 'LIMIT' && !useTPSL)) && <div className="absolute bottom-0 left-0 w-full h-[2px] bg-blue-500 rounded-t-full" />}
                            </button>
                          ))}
                        </div>

                        {/* Order Form Elements */}
                        <div className="space-y-4">
                          
                          {/* Price Input */}
                          <div className={`flex items-center justify-between bg-[#2b3139] rounded-md px-3 py-2 border border-transparent focus-within:border-blue-500 transition-colors ${orderType === 'MARKET' ? 'opacity-50 pointer-events-none' : ''}`}>
                            <span className="text-[#848e9c] text-[12px]">Price</span>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                placeholder={livePrice ? String(livePrice) : "0.00"}
                                value={orderType === 'MARKET' ? 'Market' : orderLimitPrice}
                                onChange={(e) => setOrderLimitPrice(e.target.value)}
                                className="bg-transparent text-right text-white font-mono text-[13px] outline-none w-24"
                                disabled={orderType === 'MARKET'}
                              />
                              <span className="text-[#848e9c] text-[12px]">USDT</span>
                            </div>
                          </div>

                          {/* Size Input */}
                          <div className="flex items-center justify-between bg-[#2b3139] rounded-md px-3 py-2 border border-transparent focus-within:border-blue-500 transition-colors">
                            <span className="text-[#848e9c] text-[12px]">Size</span>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                placeholder="0.0"
                                value={orderQty}
                                onChange={(e) => setOrderQty(e.target.value)}
                                className="bg-transparent text-right text-white font-mono text-[13px] outline-none w-24"
                              />
                              <span className="text-[#848e9c] text-[12px]">{getBaseAsset(selectedCoin)}</span>
                            </div>
                          </div>

                          {/* Slider */}
                          <div className="pt-2 pb-1 px-1">
                            <input 
                              type="range" 
                              min="0" max="100" 
                              value={livePrice && orderQty ? Math.min(100, (orderQty * (orderType==='LIMIT' ? parseFloat(orderLimitPrice)||livePrice : livePrice) / (balance * leverage)) * 100) : 0}
                              onChange={(e) => {
                                const price = orderType === 'LIMIT' ? parseFloat(orderLimitPrice) || livePrice : livePrice;
                                if (price > 0) {
                                  const maxQty = (balance * leverage) / price;
                                  setOrderQty(String(parseFloat((maxQty * (e.target.value / 100)).toFixed(4))));
                                }
                              }}
                              className="w-full h-1 bg-[#2b3139] rounded-lg appearance-none cursor-pointer accent-blue-500"
                            />
                            <div className="flex justify-between mt-2 px-1">
                              {[0, 25, 50, 75, 100].map(pct => (
                                <div key={pct} className="relative cursor-pointer group" onClick={() => {
                                  const price = orderType === 'LIMIT' ? parseFloat(orderLimitPrice) || livePrice : livePrice;
                                  if (price > 0) {
                                    const maxQty = (balance * leverage) / price;
                                    setOrderQty(String(parseFloat((maxQty * (pct / 100)).toFixed(4))));
                                  }
                                }}>
                                  <div className="w-1.5 h-1.5 bg-[#474d57] group-hover:bg-blue-500 rounded-full"></div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Order Value Details */}
                          <div className="space-y-1.5">
                            <div className="flex justify-between text-[11px]">
                              <span className="text-[#848e9c]">Avail</span>
                              <span className="text-white font-mono">{balance.toLocaleString(undefined, {minimumFractionDigits: 2})} USDT</span>
                            </div>
                            <div className="flex justify-between text-[11px]">
                              <span className="text-[#848e9c]">Max Buy</span>
                              <span className="text-white font-mono">{livePrice ? ((balance * leverage)/livePrice).toFixed(4) : '0.00'} {getBaseAsset(selectedCoin)}</span>
                            </div>
                          </div>

                          {/* TP/SL Toggle */}
                          <div className="pt-2">
                            <label className="flex items-center gap-2 cursor-pointer group">
                              <input type="checkbox" checked={useTPSL} onChange={(e) => setUseTPSL(e.target.checked)} className="accent-blue-500 cursor-pointer w-3.5 h-3.5" />
                              <span className="text-[12px] text-[#848e9c] group-hover:text-white transition-colors">TP/SL</span>
                            </label>
                            
                            {useTPSL && (
                              <div className="flex gap-2 mt-3">
                                <div className="flex-1 bg-[#2b3139] rounded px-2 py-1.5 border border-transparent focus-within:border-[#0ecb81]">
                                  <div className="text-[#848e9c] text-[9px] uppercase">Take Profit</div>
                                  <input type="number" placeholder="Price" value={tpPrice} onChange={e=>setTpPrice(e.target.value)} className="w-full bg-transparent text-white font-mono text-[11px] outline-none mt-0.5" />
                                </div>
                                <div className="flex-1 bg-[#2b3139] rounded px-2 py-1.5 border border-transparent focus-within:border-[#f6465d]">
                                  <div className="text-[#848e9c] text-[9px] uppercase">Stop Loss</div>
                                  <input type="number" placeholder="Price" value={slPrice} onChange={e=>setSlPrice(e.target.value)} className="w-full bg-transparent text-white font-mono text-[11px] outline-none mt-0.5" />
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Checkboxes */}
                          <div className="flex gap-4 pt-1">
                            <label className="flex items-center gap-1.5 cursor-pointer group">
                              <input type="checkbox" checked={postOnly} onChange={(e) => setPostOnly(e.target.checked)} className="accent-blue-500 cursor-pointer w-3 h-3" />
                              <span className="text-[11px] text-[#848e9c] group-hover:text-white transition-colors">Post Only</span>
                            </label>
                            <label className="flex items-center gap-1.5 cursor-pointer group">
                              <input type="checkbox" className="accent-blue-500 cursor-pointer w-3 h-3" />
                              <span className="text-[11px] text-[#848e9c] group-hover:text-white transition-colors">Reduce Only</span>
                            </label>
                          </div>

                          {/* Cost */}
                          <div className="flex justify-between text-[12px] pt-2 border-t border-[#2b3139]">
                            <span className="text-[#848e9c]">Cost</span>
                            <span className="text-white font-mono font-bold">
                              ${((parseFloat(orderQty) || 0) * (orderType === 'LIMIT' ? parseFloat(orderLimitPrice) || livePrice : livePrice) / leverage).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}
                            </span>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex gap-2 pt-2">
                            <button
                              onClick={() => {
                                const qty = parseFloat(orderQty);
                                if (!qty || qty <= 0) { showToast("Please enter a valid quantity."); return; }
                                if (orderType === 'MARKET') executeMarketOrder('BUY', qty);
                                else placeLimitOrder('BUY', qty, orderLimitPrice);
                                setOrderQty(''); setOrderLimitPrice('');
                              }}
                              className="flex-1 bg-[#0ecb81] hover:bg-[#0b9e65] text-white py-3 rounded-md text-[13px] font-extrabold transition-colors flex flex-col items-center justify-center gap-0.5 shadow-lg shadow-[#0ecb81]/10"
                            >
                              <span>Buy / Long</span>
                            </button>
                            <button
                              onClick={() => {
                                const qty = parseFloat(orderQty);
                                if (!qty || qty <= 0) { showToast("Please enter a valid quantity."); return; }
                                if (orderType === 'MARKET') executeMarketOrder('SELL', qty);
                                else placeLimitOrder('SELL', qty, orderLimitPrice);
                                setOrderQty(''); setOrderLimitPrice('');
                              }}
                              className="flex-1 bg-[#f6465d] hover:bg-[#c9384b] text-white py-3 rounded-md text-[13px] font-extrabold transition-colors flex flex-col items-center justify-center gap-0.5 shadow-lg shadow-[#f6465d]/10"
                            >
                              <span>Sell / Short</span>
                            </button>
                          </div>

                        </div>
                      </div>
                    </div>

                    {/* Positions & Orders Main Area */}
                    <div className={`flex-1 flex flex-col min-w-0 bg-[#0b0e14]`}>
                      {/* Tabs */}
                      <div className={`flex gap-6 px-4 border-b ${t.border} bg-[#131722] pt-2`}>
                        {['Positions', 'Open Orders', 'Order History', 'Trade History', 'Arbitrage Matrix', 'Strategy Tester', 'Level 3 DOM Depth', 'AI Risk Auditor'].map(tab => (
                          <button
                            key={tab}
                            onClick={() => setTradingTab(tab)}
                            className={`pb-3 text-[13px] font-bold transition-all relative ${tradingTab === tab ? 'text-white' : 'text-[#848e9c] hover:text-white'}`}
                          >
                            {tab} {tab === 'Positions' && `(${positions.length})`} {tab === 'Open Orders' && `(${paperOrders.filter(o => o.status === 'PENDING').length})`}
                            {tradingTab === tab && <div className="absolute bottom-0 left-0 w-full h-[2px] bg-[#fcd535] rounded-t-full" />}
                          </button>
                        ))}
                      </div>

                      {/* Content Area */}
                      <div className="flex-1 overflow-auto custom-scrollbar p-0">
                        {tradingTab === 'Positions' && (
                          <table className="w-full text-left border-collapse min-w-[900px]">
                            <thead className="bg-[#131722] sticky top-0 z-10">
                              <tr>
                                <th className="py-2 pl-4 pr-2 font-normal text-[#848e9c] text-[11px]">Symbol</th>
                                <th className="py-2 pr-2 font-normal text-[#848e9c] text-[11px]">Size</th>
                                <th className="py-2 pr-2 font-normal text-[#848e9c] text-[11px]">Entry Price</th>
                                <th className="py-2 pr-2 font-normal text-[#848e9c] text-[11px]">Mark Price</th>
                                <th className="py-2 pr-2 font-normal text-[#848e9c] text-[11px]">Liq. Price</th>
                                <th className="py-2 pr-2 font-normal text-[#848e9c] text-[11px]">Margin Ratio</th>
                                <th className="py-2 pr-2 font-normal text-[#848e9c] text-[11px]">Margin</th>
                                <th className="py-2 pr-2 font-normal text-[#848e9c] text-[11px] text-right">PNL (ROE%)</th>
                                <th className="py-2 pr-4 font-normal text-[#848e9c] text-[11px] text-right">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#2b3139]">
                              {positions.map((pos, idx) => {
                                const markPrice = pos.symbol === selectedCoin ? livePrice : pos.entryPrice; 
                                const pnl = pos.type === 'LONG' 
                                  ? (markPrice - pos.entryPrice) * pos.qty
                                  : (pos.entryPrice - markPrice) * pos.qty;
                                const initialMargin = (pos.qty * pos.entryPrice) / leverage;
                                const roe = (pnl / initialMargin) * 100;
                                const liqPrice = pos.type === 'LONG' 
                                  ? pos.entryPrice * (1 - 1/leverage + 0.005) 
                                  : pos.entryPrice * (1 + 1/leverage - 0.005);
                                
                                return (
                                  <tr key={idx} className="hover:bg-[#2b3139]/30 transition-colors group">
                                    <td className="py-2.5 pl-4 pr-2">
                                      <div className="flex items-center gap-1.5">
                                        <div className={`w-1 h-3.5 rounded-sm ${pos.type === 'LONG' ? 'bg-[#0ecb81]' : 'bg-[#f6465d]'}`}></div>
                                        <div>
                                          <div className="text-[12px] font-bold text-white flex items-center gap-1">{pos.symbol} <span className="bg-[#2b3139] text-[#fcd535] px-1 rounded text-[9px] border border-[#fcd535]/30">{leverage}x</span></div>
                                          <div className={`text-[10px] font-semibold ${pos.type === 'LONG' ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
                                            {pos.type}
                                          </div>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="py-2.5 pr-2 text-white font-mono text-[12px]">{pos.qty}</td>
                                    <td className="py-2.5 pr-2 text-white font-mono text-[12px]">{pos.entryPrice.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                                    <td className="py-2.5 pr-2 text-white font-mono text-[12px]">{markPrice.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                                    <td className="py-2.5 pr-2 text-[#fcd535] font-mono text-[12px]">{liqPrice.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                                    <td className="py-2.5 pr-2 text-white font-mono text-[12px]">{(Math.random() * (12 - 4) + 4).toFixed(2)}%</td>
                                    <td className="py-2.5 pr-2 text-white font-mono text-[12px]">{initialMargin.toFixed(2)}</td>
                                    <td className="py-2.5 pr-2 text-right">
                                      <div className={`font-mono text-[12px] font-bold ${pnl >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
                                        {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}
                                      </div>
                                      <div className={`font-mono text-[10px] ${pnl >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
                                        {pnl >= 0 ? '+' : ''}{roe.toFixed(2)}%
                                      </div>
                                    </td>
                                    <td className="py-2.5 pr-4 text-right">
                                      <div className="flex gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button className="bg-[#2b3139] hover:bg-[#3b414a] text-white px-3 py-1 rounded text-[11px] font-bold transition-colors">Reverse</button>
                                        <button onClick={() => closeActivePosition(pos.symbol)} className="bg-[#2b3139] hover:bg-[#f6465d] hover:text-white text-[#f6465d] px-3 py-1 rounded text-[11px] font-bold transition-colors">Close</button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        )}
                        {tradingTab === 'Positions' && positions.length === 0 && (
                          <div className="flex flex-col items-center justify-center h-48 text-[#848e9c]">
                            <Layers size={32} className="mb-2 opacity-30" />
                            <span className="text-[12px]">No open positions</span>
                          </div>
                        )}

                        {tradingTab === 'Open Orders' && (
                          <table className="w-full text-left border-collapse min-w-[700px]">
                            <thead className="bg-[#131722] sticky top-0 z-10">
                              <tr>
                                <th className="py-2 pl-4 pr-2 font-normal text-[#848e9c] text-[11px]">Time</th>
                                <th className="py-2 pr-2 font-normal text-[#848e9c] text-[11px]">Symbol</th>
                                <th className="py-2 pr-2 font-normal text-[#848e9c] text-[11px]">Type</th>
                                <th className="py-2 pr-2 font-normal text-[#848e9c] text-[11px]">Side</th>
                                <th className="py-2 pr-2 font-normal text-[#848e9c] text-[11px]">Price</th>
                                <th className="py-2 pr-2 font-normal text-[#848e9c] text-[11px]">Amount</th>
                                <th className="py-2 pr-2 font-normal text-[#848e9c] text-[11px]">Filled</th>
                                <th className="py-2 pr-4 font-normal text-[#848e9c] text-[11px] text-right">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#2b3139]">
                              {paperOrders.filter(o => o.status === 'PENDING').map((order, idx) => (
                                <tr key={idx} className="hover:bg-[#2b3139]/30 transition-colors group">
                                  <td className="py-2.5 pl-4 pr-2 text-[#848e9c] text-[11px]">{new Date().toLocaleString()}</td>
                                  <td className="py-2.5 pr-2 text-white font-bold text-[12px]">{order.symbol}</td>
                                  <td className="py-2.5 pr-2 text-white text-[12px]">{order.type}</td>
                                  <td className={`py-2.5 pr-2 text-[12px] font-bold ${order.side === 'BUY' ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>{order.side}</td>
                                  <td className="py-2.5 pr-2 text-white font-mono text-[12px]">{order.price.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                                  <td className="py-2.5 pr-2 text-white font-mono text-[12px]">{order.qty}</td>
                                  <td className="py-2.5 pr-2 text-white font-mono text-[12px]">0.00%</td>
                                  <td className="py-2.5 pr-4 text-right">
                                    <button onClick={() => cancelLimitOrder(order.id)} className="text-[#848e9c] hover:text-white transition-colors"><X size={16} /></button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                        {tradingTab === 'Open Orders' && paperOrders.filter(o => o.status === 'PENDING').length === 0 && (
                          <div className="flex flex-col items-center justify-center h-48 text-[#848e9c]">
                            <ListFilter size={32} className="mb-2 opacity-30" />
                            <span className="text-[12px]">No open orders</span>
                          </div>
                        )}
                        
                        {(tradingTab === 'Order History' || tradingTab === 'Trade History') && (
                          <div className="flex flex-col items-center justify-center h-48 text-[#848e9c]">
                            <History size={32} className="mb-2 opacity-30" />
                            <span className="text-[12px]">No history available</span>
                          </div>
                        )}
                        
                        {tradingTab === 'Arbitrage Matrix' && (
                          <div className="w-full h-full min-h-[350px]">
                            <ArbitrageBot onExecuteArbitrage={handleExecuteArbitrage} />
                          </div>
                        )}
                        
                        {tradingTab === 'Strategy Tester' && (
                          <div className="w-full h-full min-h-[400px]">
                            <StrategyTester onClose={() => setTradingTab('Positions')} />
                          </div>
                        )}

                        {tradingTab === 'Level 3 DOM Depth' && (
                          <div className="w-full h-full min-h-[400px]">
                            <Level3DepthTape symbol={selectedCoin} livePrice={livePrice} />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}
        </div>
      </div>

      {/* Unified Split Right Sidebar Container */}
      {!focusMode && (isEditorOpen || rightSidebar) && (
        <div className={`hidden md:flex flex-col h-full shrink-0 z-20 overflow-hidden ${t.bg} border-l ${t.border} w-[360px] md:w-[420px] transition-all duration-300`}>
          {isEditorOpen && rightSidebar ? (
            <div className="flex flex-col h-full divide-y divide-[#2a2e39] min-h-0">
              <div className="h-1/2 min-h-0 overflow-hidden flex flex-col">
                {renderEditorPanel()}
              </div>
              <div className="h-1/2 min-h-0 overflow-hidden flex flex-col">
                <RightSidebar 
  rightSidebar={rightSidebar} setRightSidebar={setRightSidebar} themeConfig={t} 
  OrderBookPanel={OrderBookPanel} livePrice={livePrice} selectedCoin={selectedCoin} setSelectedCoin={setSelectedCoin}
  selectedCoinStats={selectedCoinStats} selectedExchange={selectedExchange} fearGreedIndex={fearGreedIndex}
  formatNumber={formatNumber} formatCompactNumber={formatCompactNumber}
  watchlist={watchlist} setWatchlist={setWatchlist} watchlistTickers={watchlistTickers}
  watchlistSearchInput={watchlistSearchInput} setWatchlistSearchInput={setWatchlistSearchInput}
  watchlistDropdownOpen={watchlistDropdownOpen} setWatchlistDropdownOpen={setWatchlistDropdownOpen}
  binanceCoins={binanceCoins} showToast={showToast} setMarketStatus={setMarketStatus}
  coinIconUrl={coinIconUrl} handleCoinIconError={handleCoinIconError}
/>
              </div>
            </div>
          ) : isEditorOpen ? (
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
              {renderEditorPanel()}
            </div>
          ) : (
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
              <RightSidebar 
  rightSidebar={rightSidebar} setRightSidebar={setRightSidebar} themeConfig={t} 
  OrderBookPanel={OrderBookPanel} livePrice={livePrice} selectedCoin={selectedCoin} 
  selectedCoinStats={selectedCoinStats} handleRemoveWatchlist={handleRemoveWatchlist}
  isWatchlistMode={isWatchlistMode} setIsWatchlistMode={setIsWatchlistMode}
  showToast={showToast} isFavorite={isFavorite} toggleFavorite={toggleFavorite}
  isConnected={isConnected} showVolume={showVolume} setShowVolume={setShowVolume}
  showPerformance={showPerformance} setShowPerformance={setShowPerformance}
  hideDrawings={hideDrawings} setHideDrawings={setHideDrawings} chartType={chartType}
  setChartType={setChartType} toggleIndicator={toggleIndicator} activeIndicators={activeIndicators}
  getBaseAsset={getBaseAsset} removeAlert={removeAlert} alerts={alerts}
  alertCondition={alertCondition} setAlertCondition={setAlertCondition}
  alertPrice={alertPrice} setAlertPrice={setAlertPrice} addPriceAlert={addPriceAlert}
  newsFilterType={newsFilterType} setNewsFilterType={setNewsFilterType}
  newsLoading={newsLoading} newsError={newsError} newsList={newsList}
  watchlist={watchlist} renderBountyPanel={renderBountyPanel} darkMode={darkMode}
/>
            </div>
          )}
        </div>
      )}

      {/* Unified Combined Vertical Right Toolbar */}
      <div className={`hidden md:flex w-10 shrink-0 border-l ${t.border} ${t.bg} flex-col items-center py-3 gap-2 transition-colors duration-200 z-20`}>
        {/* Editor Toggle Button at the top */}
        <button
          onClick={() => {
            setIsEditorOpen(!isEditorOpen);
          }}
          className={`w-8 h-8 rounded flex items-center justify-center relative transition-all ${
            isEditorOpen ? 'bg-green-500/15 text-green-400' : 'text-green-400/60 hover:bg-green-500/10 hover:text-green-400'
          }`}
          title="Pine/Python Strategy Editor"
        >
          <Braces size={16} />
          {isEditorOpen && <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[3px] h-4 bg-green-400 rounded-l" />}
        </button>

        <div className="w-6 h-px bg-[#2a2e39]/30 my-1" />

        <button
          onClick={handlePredictClick}
          className={`w-8 h-8 rounded flex items-center justify-center relative transition-all ${isAutoPredictEnabled ? (darkMode ? 'bg-purple-500/20 text-purple-400 border border-purple-500/50 shadow-[0_0_10px_rgba(168,85,247,0.4)]' : 'bg-purple-100 text-purple-700 border border-purple-300 shadow-[0_0_10px_rgba(168,85,247,0.4)]') : (darkMode ? 'text-purple-400/60 hover:bg-purple-500/10 hover:text-purple-400' : 'text-purple-700/60 hover:bg-purple-100 hover:text-purple-800')}`}
          title={isAutoPredictEnabled ? "Auto-Predict Active (Click to Disable)" : "Predict Next Candle (Auto-Loop)"}
        >
          <Wand2 size={16} />
          {isAutoPredictEnabled && <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[3px] h-4 bg-purple-400 rounded-l" />}
        </button>

        <div className="w-6 h-px bg-[#2a2e39]/30 my-1" />

        {[
          {id: 'watchlist', icon: ListFilter, title: 'Watchlist', activeClass: 'bg-pink-500/15 text-pink-400', inactiveClass: 'text-pink-400/60 hover:bg-pink-500/10 hover:text-pink-400', marker: 'bg-pink-400'},
          {id: 'details', icon: Activity, title: 'Details', activeClass: 'bg-lime-500/15 text-lime-400', inactiveClass: 'text-lime-400/60 hover:bg-lime-500/10 hover:text-lime-400', marker: 'bg-lime-400'},
          {id: 'news', icon: Radio, title: 'News', activeClass: 'bg-zinc-500/15 text-zinc-400', inactiveClass: 'text-zinc-400/60 hover:bg-zinc-500/10 hover:text-zinc-400', marker: 'bg-zinc-400'},
          {id: 'alerts', icon: Bell, title: 'Alerts', activeClass: 'bg-amber-500/15 text-amber-400', inactiveClass: 'text-amber-400/60 hover:bg-amber-500/10 hover:text-amber-400', marker: 'bg-amber-400'},
          {id: 'bounties', icon: Briefcase, title: 'Bounties', activeClass: 'bg-slate-500/15 text-slate-400', inactiveClass: 'text-slate-400/60 hover:bg-slate-500/10 hover:text-slate-400', marker: 'bg-slate-400'},
          {id: 'orderbook', icon: Database, title: 'Order Book', activeClass: 'bg-gray-500/15 text-gray-400', inactiveClass: 'text-gray-400/60 hover:bg-gray-500/10 hover:text-gray-400', marker: 'bg-gray-400'}
        ].map(item => {
          const isActive = rightSidebar === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setRightSidebar(isActive ? null : item.id)}
              className={`w-8 h-8 rounded flex items-center justify-center relative transition-all ${
                isActive ? item.activeClass : item.inactiveClass
              }`}
              title={item.title}
            >
              <item.icon size={16} />
              {isActive && <div className={`absolute right-0 top-1/2 -translate-y-1/2 w-[3px] h-4 ${item.marker} rounded-l`} />}
            </button>
          );
        })}
      </div>

      
      
      {/* AESTHETIC MOBILE BOTTOM NAVIGATION BAR */}
      {!focusMode && !isEditorOpen && (
        <div className={`md:hidden shrink-0 ${darkMode ? 'bg-[#1e222d]' : 'bg-white'} border-t ${darkMode ? 'border-[#2a2e39]' : 'border-gray-200'} flex items-center justify-between px-2 pb-safe pt-1 shadow-[0_-4px_12px_rgba(0,0,0,0.1)] z-[100] relative`}>
          <button
            onClick={() => setMobileActiveTab('chart')}
            className={`flex flex-col items-center justify-center w-full py-1.5 transition-colors relative ${mobileActiveTab === 'chart' ? 'text-[#2962ff]' : t.muted}`}
          >
            {mobileActiveTab === 'chart' && <div className="absolute top-0 w-8 h-[3px] bg-[#2962ff] rounded-b-full shadow-[0_0_8px_#2962ff]" />}
            <Activity size={22} strokeWidth={mobileActiveTab === 'chart' ? 2.5 : 1.5} className="mb-0.5" />
            <span className={`text-[9px] ${mobileActiveTab === 'chart' ? 'font-black tracking-wide' : 'font-semibold'}`}>Chart</span>
          </button>
          
          <button
            onClick={() => { setMobileActiveTab('tools'); setMobileDrawingMenuOpen(true); }}
            className={`flex flex-col items-center justify-center w-full py-1.5 transition-colors relative ${mobileActiveTab === 'tools' || mobileDrawingMenuOpen ? 'text-[#2962ff]' : t.muted}`}
          >
            {(mobileActiveTab === 'tools' || mobileDrawingMenuOpen) && <div className="absolute top-0 w-8 h-[3px] bg-[#2962ff] rounded-b-full shadow-[0_0_8px_#2962ff]" />}
            <PenTool size={22} strokeWidth={mobileActiveTab === 'tools' || mobileDrawingMenuOpen ? 2.5 : 1.5} className="mb-0.5" />
            <span className={`text-[9px] ${mobileActiveTab === 'tools' || mobileDrawingMenuOpen ? 'font-black tracking-wide' : 'font-semibold'}`}>Draw</span>
          </button>

          <div className="relative -top-3 w-full flex justify-center">
            <button
              onClick={runBacktest}
              disabled={loading}
              className={`flex items-center justify-center w-12 h-12 rounded-full ${loading ? 'bg-gray-600' : 'bg-gradient-to-tr from-[#2962ff] to-[#7C5CFF]'} text-white shadow-xl shadow-[#7C5CFF]/30 border-[3px] ${darkMode ? 'border-[#131722]' : 'border-white'} active:scale-95 transition-all`}
            >
              {loading ? <RefreshCw size={22} className="animate-spin" /> : <Play size={22} fill="currentColor" className="ml-1" />}
            </button>
          </div>

          <button
            onClick={() => { setMobileActiveTab('report'); setLowerBoxState('maximized'); }}
            className={`flex flex-col items-center justify-center w-full py-1.5 transition-colors relative ${mobileActiveTab === 'report' ? 'text-[#2962ff]' : t.muted}`}
          >
            {mobileActiveTab === 'report' && <div className="absolute top-0 w-8 h-[3px] bg-[#2962ff] rounded-b-full shadow-[0_0_8px_#2962ff]" />}
            <BarChartHorizontal size={22} strokeWidth={mobileActiveTab === 'report' ? 2.5 : 1.5} className="mb-0.5" />
            <span className={`text-[9px] ${mobileActiveTab === 'report' ? 'font-black tracking-wide' : 'font-semibold'}`}>Report</span>
          </button>

          <button
            onClick={() => setMobileMenuOpen(true)}
            className={`flex flex-col items-center justify-center w-full py-1.5 transition-colors relative ${mobileMenuOpen ? 'text-[#2962ff]' : t.muted}`}
          >
            {mobileMenuOpen && <div className="absolute top-0 w-8 h-[3px] bg-[#2962ff] rounded-b-full shadow-[0_0_8px_#2962ff]" />}
            <Menu size={22} strokeWidth={mobileMenuOpen ? 2.5 : 1.5} className="mb-0.5" />
            <span className={`text-[9px] ${mobileMenuOpen ? 'font-black tracking-wide' : 'font-semibold'}`}>Menu</span>
          </button>
        </div>
      )}

      {/* MOBILE DRAWING TOOLS MENU OVERLAY */}
      {isMobile && mobileDrawingMenuOpen && (
        <div className={`fixed bottom-[60px] left-0 w-full ${darkMode ? 'bg-[#1e222d]' : 'bg-white'} border-t ${darkMode ? 'border-[#2a2e39]' : 'border-gray-200'} rounded-t-2xl shadow-[0_-10px_40px_rgba(0,0,0,0.3)] z-[90] pb-2 transition-transform transform translate-y-0`}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2e39]/50">
            <span className={`font-black ${t.text} text-[15px]`}>Drawing Tools</span>
            <button onClick={() => { setMobileDrawingMenuOpen(false); setMobileActiveTab('chart'); }} className={`p-1 ${t.muted} ${t.hover} rounded-full bg-black/10`}><X size={18} /></button>
          </div>
          <div className="p-3 max-h-[40vh] overflow-y-auto dark-scrollbar space-y-3">
            {/* Quick Actions */}
            <div className="flex gap-2 mb-4">
              <button onClick={() => { clearAllDrawings(); setMobileDrawingMenuOpen(false); setMobileActiveTab('chart'); }} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-red-500/10 text-red-500 font-bold text-[12px] active:scale-95`}>
                <Trash2 size={14} /> Clear All
              </button>
              <button onClick={() => { setDrawings([]); setMobileDrawingMenuOpen(false); setMobileActiveTab('chart'); }} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-gray-500/10 ${t.text} font-bold text-[12px] active:scale-95`}>
                <RefreshCw size={14} /> Reset
              </button>
            </div>
            
            {/* Grid of Tools */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { id: 'trendline', title: 'Trend Line', icon: Spline },
                { id: 'horizontal_line', title: 'Horiz Line', icon: Minus },
                { id: 'horizontal_ray', title: 'Horiz Ray', icon: ArrowRight },
                { id: 'vertical_line', title: 'Vert Line', icon: MoveVertical },
                { id: 'ray', title: 'Ray', icon: ArrowUpRight },
                { id: 'channel', title: 'Channel', icon: SplitSquareHorizontal },
                { id: 'long_position', title: 'Long Pos', icon: TrendingUp },
                { id: 'short_position', title: 'Short Pos', icon: TrendingDown },
                { id: 'price_range', title: 'Price Rng', icon: MoveVertical },
                { id: 'date_range', title: 'Date Rng', icon: MoveHorizontal },
                { id: 'fib_retracement', title: 'Fib Ret', icon: AlignCenter },
                { id: 'text', title: 'Text', icon: MessageSquareText },
                { id: 'brush', title: 'Brush', icon: PenTool },
                { id: 'rectangle', title: 'Rectangle', icon: Box },
              ].map(tool => (
                <button
                  key={tool.id}
                  onClick={() => { setActiveTool(tool.id); setMobileDrawingMenuOpen(false); setMobileActiveTab('chart'); showToast(`Selected ${tool.title}`); }}
                  className={`flex flex-col items-center justify-center gap-1.5 p-2 rounded-xl transition-colors ${activeTool === tool.id ? 'bg-[#2962ff]/20 text-[#2962ff] border border-[#2962ff]/30' : `${darkMode ? 'bg-[#131722] text-gray-400' : 'bg-gray-100 text-gray-600'} border ${darkMode ? 'border-[#2a2e39]' : 'border-gray-200'} hover:bg-black/10`}`}
                >
                  <tool.icon size={18} />
                  <span className="text-[9px] font-bold text-center leading-tight">{tool.title}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      </div>

      {/* Advanced Cursor Studio Modal */}
      {isCursorStudioOpen && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 backdrop-blur-xs select-none">
          <div className={`w-[600px] ${darkMode ? 'bg-[#1c2030] text-white' : 'bg-white text-gray-900'} border ${t.border} rounded-xl shadow-2xl overflow-hidden flex flex-col font-sans animate-fade-in`}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2e39]/65 bg-[#171b26]">
              <div className="flex items-center gap-2">
                <Sliders size={15} className="text-[#FF007F]" />
                <span className="font-extrabold text-[13px] uppercase tracking-wide">Advanced Cursor Studio</span>
              </div>
              <button 
                onClick={() => setIsCursorStudioOpen(false)}
                className="text-gray-400 hover:text-white p-0.5"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content Body */}
            <div className="flex flex-1 min-h-[350px]">
              {/* Left Column: Cursor Library */}
              <div className="w-[260px] border-r border-[#2a2e39]/50 p-3 bg-[#171b26]/50">
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2.5 px-1">Cursor Library</div>
                <div className="space-y-1">
                  {[
                    { id: 'crosshair', title: 'Crosshair', desc: 'Precision', icon: Crosshair },
                    { id: 'dot', title: 'Dot', desc: 'Minimal', icon: Circle },
                    { id: 'arrow', title: 'Arrow', desc: 'Standard', icon: MousePointer },
                    { id: 'demonstration', title: 'Demonstration', desc: 'Replay', icon: Play },
                    { id: 'magic', title: 'Magic', desc: 'Smart Select', icon: Sparkles },
                    { id: 'eraser', title: 'Eraser', desc: 'Clear', icon: Eraser },
                  ].map((cur) => {
                    const CurIcon = cur.icon;
                    const isSelected = activeTool === cur.id;
                    return (
                      <button
                        key={cur.id}
                        onClick={() => {
                          setActiveTool(cur.id);
                          showToast(`Selected cursor: ${cur.title}`);
                        }}
                        className={`w-full flex items-center justify-between p-2 rounded-lg text-left transition-all ${
                          isSelected ? 'bg-blue-600 text-white font-bold font-mono' : 'hover:bg-white/5 text-gray-300'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <CurIcon size={13} className={isSelected ? 'text-white' : 'text-gray-400'} />
                          <span className="text-[11.5px]">{cur.title}</span>
                        </div>
                        <span className={`text-[9px] uppercase font-bold ${isSelected ? 'text-white/80' : 'text-gray-500'}`}>{cur.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Properties & Advanced Options */}
              <div className="flex-1 p-4 flex flex-col justify-between">
                <div className="space-y-3.5">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Properties</div>
                  
                  {/* Color property */}
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-gray-300">Color</span>
                    <div className="flex items-center gap-2">
                      <input 
                        type="text" 
                        value={cursorSettings.color} 
                        onChange={(e) => setCursorSettings(prev => ({ ...prev, color: e.target.value }))}
                        className="w-20 px-2 py-1 bg-[#131722] border border-[#2a2e39] rounded text-[11px] font-mono outline-none text-center"
                      />
                      <input 
                        type="color" 
                        value={cursorSettings.color} 
                        onChange={(e) => setCursorSettings(prev => ({ ...prev, color: e.target.value }))}
                        className="w-6 h-6 border-0 bg-transparent cursor-pointer rounded overflow-hidden outline-none"
                      />
                    </div>
                  </div>

                  {/* Size property */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-semibold text-gray-300">
                      <span>Size</span>
                      <span className="font-mono text-blue-400 text-[11px]">{cursorSettings.size}px</span>
                    </div>
                    <input 
                      type="range" 
                      min="1" 
                      max="10" 
                      value={cursorSettings.size} 
                      onChange={(e) => setCursorSettings(prev => ({ ...prev, size: parseInt(e.target.value) }))}
                      className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>

                  {/* Opacity property */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-semibold text-gray-300">
                      <span>Opacity</span>
                      <span className="font-mono text-blue-400 text-[11px]">{cursorSettings.opacity}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="10" 
                      max="100" 
                      value={cursorSettings.opacity} 
                      onChange={(e) => setCursorSettings(prev => ({ ...prev, opacity: parseInt(e.target.value) }))}
                      className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>

                  <div className="h-px bg-[#2a2e39]/50 my-1" />

                  {/* Advanced options */}
                  <div className="space-y-2">
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Advanced Options</div>
                    {[
                      { key: 'showTooltip', label: 'Show Coordinate Tooltip' },
                      { key: 'autoSnap', label: 'Auto-Snap to OHLC' },
                      { key: 'extendLines', label: 'Extend Lines to Axis' }
                    ].map((opt) => (
                      <label key={opt.key} className="flex items-center gap-2.5 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={cursorSettings[opt.key]}
                          onChange={(e) => setCursorSettings(prev => ({ ...prev, [opt.key]: e.target.checked }))}
                          className="w-3.5 h-3.5 rounded accent-blue-600 bg-gray-800 border-gray-700 cursor-pointer"
                        />
                        <span className="text-[11px] font-semibold text-gray-300">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Values Tooltip on Long Press */}
                <div className="border-t border-[#2a2e39]/50 pt-2 flex items-center justify-between">
                  <span className="text-[10.5px] font-semibold text-gray-400">Values tooltip on long press</span>
                  <div className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={cursorSettings.tooltipOnLongPress}
                      onChange={(e) => setCursorSettings(prev => ({ ...prev, tooltipOnLongPress: e.target.checked }))}
                    />
                    <div className="w-8 h-4 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-600"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Advanced Trend Studio Modal */}
      {isTrendStudioOpen && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 backdrop-blur-xs select-none">
          <div className={`w-[360px] max-h-[90vh] ${darkMode ? 'bg-[#1c2030] text-white' : 'bg-white text-gray-900'} border ${t.border} rounded-xl shadow-2xl overflow-y-auto dark-scrollbar flex flex-col font-sans animate-fade-in`}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2e39]/65 bg-[#171b26] sticky top-0 z-10">
              <div className="flex items-center gap-2">
                <Sliders size={15} className="text-[#2962ff]" />
                <span className="font-extrabold text-[12.5px] uppercase tracking-wide">Advanced Trend Studio</span>
              </div>
              <button 
                onClick={() => setIsTrendStudioOpen(false)}
                className="text-gray-400 hover:text-white p-0.5"
              >
                <X size={16} />
              </button>
            </div>

            {/* List Content */}
            <div className="p-3.5 space-y-4">
              {/* Category 1: Trend Lines */}
              <div className="space-y-1.5">
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-1">Trend Lines</div>
                <div className="space-y-1">
                  {[
                    { id: 'trendline', title: 'Classic (Trend Line)', icon: TrendingUp },
                    { id: 'polyline', title: 'Poly-Line', icon: GitBranch },
                    { id: 'curve', title: 'Curve', icon: Undo },
                  ].map(tool => {
                    const ToolIcon = tool.icon;
                    const isSelected = activeTool === tool.id;
                    return (
                      <button
                        key={tool.id}
                        onClick={() => {
                          setActiveTool(tool.id);
                          setIsTrendStudioOpen(false);
                          showToast(`Selected: ${tool.title}`);
                        }}
                        className={`w-full flex items-center gap-3 p-2 rounded-lg text-left transition-all ${
                          isSelected ? 'bg-blue-600 text-white font-bold font-mono' : 'hover:bg-white/5 text-gray-300'
                        }`}
                      >
                        <ToolIcon size={14} className={isSelected ? 'text-white' : 'text-gray-400'} />
                        <span className="text-[11.5px]">{tool.title}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Category 2: Rays & Info */}
              <div className="space-y-1.5">
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-1">Rays & Info</div>
                <div className="space-y-1">
                  {[
                    { id: 'ray', title: 'Ray', icon: ArrowUpRight },
                    { id: 'infoline', title: 'Info Line', icon: Info },
                    { id: 'extendedline', title: 'Extended Line', icon: GitCommit },
                  ].map(tool => {
                    const ToolIcon = tool.icon;
                    const isSelected = activeTool === tool.id;
                    return (
                      <button
                        key={tool.id}
                        onClick={() => {
                          setActiveTool(tool.id);
                          setIsTrendStudioOpen(false);
                          showToast(`Selected: ${tool.title}`);
                        }}
                        className={`w-full flex items-center gap-3 p-2 rounded-lg text-left transition-all ${
                          isSelected ? 'bg-blue-600 text-white font-bold font-mono' : 'hover:bg-white/5 text-gray-300'
                        }`}
                      >
                        <ToolIcon size={14} className={isSelected ? 'text-white' : 'text-gray-400'} />
                        <span className="text-[11.5px]">{tool.title}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Category 3: Angles & Geometry */}
              <div className="space-y-1.5">
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-1">Angles & Geometry</div>
                <div className="space-y-1">
                  {[
                    { id: 'trendangle', title: 'Trend Angle', icon: Compass },
                    { id: 'gann_fan', title: 'Gann Fan (new)', icon: Compass },
                    { id: 'fib_timezone', title: 'Fibonacci Time Zone (new)', icon: Columns },
                  ].map(tool => {
                    const ToolIcon = tool.icon;
                    const isSelected = activeTool === tool.id;
                    return (
                      <button
                        key={tool.id}
                        onClick={() => {
                          setActiveTool(tool.id);
                          setIsTrendStudioOpen(false);
                          showToast(`Selected: ${tool.title}`);
                        }}
                        className={`w-full flex items-center justify-between p-2 rounded-lg text-left transition-all ${
                          isSelected ? 'bg-blue-600 text-white font-bold font-mono' : 'hover:bg-white/5 text-gray-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <ToolIcon size={14} className={isSelected ? 'text-white' : 'text-gray-400'} />
                          <span className="text-[11.5px]">{tool.title.replace(' (new)', '')}</span>
                        </div>
                        {tool.title.includes('(new)') && (
                          <span className="text-[8.5px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded font-extrabold uppercase tracking-wider">New</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Category 4: Channels & Time Cycles */}
              <div className="space-y-1.5">
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-1">Channels & Time Cycles</div>
                <div className="space-y-1">
                  {[
                    { id: 'channel', title: 'Parallel Channel', icon: Columns },
                    { id: 'regression_trend', title: 'Regression Trend (new)', icon: TrendingUp },
                  ].map(tool => {
                    const ToolIcon = tool.icon;
                    const isSelected = activeTool === tool.id;
                    return (
                      <button
                        key={tool.id}
                        onClick={() => {
                          setActiveTool(tool.id);
                          setIsTrendStudioOpen(false);
                          showToast(`Selected: ${tool.title}`);
                        }}
                        className={`w-full flex items-center justify-between p-2 rounded-lg text-left transition-all ${
                          isSelected ? 'bg-blue-600 text-white font-bold font-mono' : 'hover:bg-white/5 text-gray-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <ToolIcon size={14} className={isSelected ? 'text-white' : 'text-gray-400'} />
                          <span className="text-[11.5px]">{tool.title.replace(' (new)', '')}</span>
                        </div>
                        {tool.title.includes('(new)') && (
                          <span className="text-[8.5px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded font-extrabold uppercase tracking-wider">New</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Category 5: Advanced Projections */}
              <div className="space-y-1.5">
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-1">Advanced Projections</div>
                <div className="space-y-1">
                  {[
                    { id: 'pitchfork', title: 'Pitchfork', icon: Activity },
                    { id: 'schiff_pitchfork', title: 'Schiff Pitchfork (new)', icon: Activity },
                    { id: 'andrews_pitchfork', title: 'Andrews Pitchfork (new)', icon: Activity },
                  ].map(tool => {
                    const ToolIcon = tool.icon;
                    const isSelected = activeTool === tool.id;
                    return (
                      <button
                        key={tool.id}
                        onClick={() => {
                          setActiveTool(tool.id);
                          setIsTrendStudioOpen(false);
                          showToast(`Selected: ${tool.title}`);
                        }}
                        className={`w-full flex items-center justify-between p-2 rounded-lg text-left transition-all ${
                          isSelected ? 'bg-blue-600 text-white font-bold font-mono' : 'hover:bg-white/5 text-gray-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <ToolIcon size={14} className={isSelected ? 'text-white' : 'text-gray-400'} />
                          <span className="text-[11.5px]">{tool.title.replace(' (new)', '')}</span>
                        </div>
                        {tool.title.includes('(new)') && (
                          <span className="text-[8.5px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded font-extrabold uppercase tracking-wider">New</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}


function MiniChartWrapper({ coin: propCoin, interval, darkMode }) {
  const containerRef = useRef(null);
  const chartInstRef = useRef(null);
  const seriesRef = useRef(null);
  const [candles, setCandles] = useState([]);
  
  const [localCoin, setLocalCoin] = useState(propCoin);
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(propCoin);

  useEffect(() => {
    setLocalCoin(propCoin);
    setInputValue(propCoin);
  }, [propCoin]);

  useEffect(() => {
    let active = true;
    const loadData = async () => {
      try {
        const data = await fetchExchangeCandles('binance', localCoin, interval, 150);
        if (active && data?.length) setCandles(data);
      } catch (e) {
        console.error(e);
      }
    };
    loadData();
    return () => { active = false; };
  }, [localCoin, interval]);

  useEffect(() => {
    if (!containerRef.current || !candles.length) return;
    const container = containerRef.current;
    
    const chart = createChart(container, {
      layout: {
        background: { type: 'solid', color: darkMode ? '#131722' : '#ffffff' },
        textColor: darkMode ? '#c9d1d9' : '#131722',
      },
      grid: {
        vertLines: { color: darkMode ? 'rgba(42,46,57,0.6)' : '#e0e3eb' },
        horzLines: { color: darkMode ? 'rgba(42,46,57,0.6)' : '#e0e3eb' },
      },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false },
    });
    
    chartInstRef.current = chart;
    const candSeries = chart.addCandlestickSeries({
      upColor: '#089981',
      downColor: '#F23645',
      borderVisible: false,
      wickUpColor: '#089981',
      wickDownColor: '#F23645',
    });
    seriesRef.current = candSeries;
    
    candSeries.setData(candles);
    chart.timeScale().fitContent();

    const handleResize = () => {
      const rect = container.getBoundingClientRect();
      chart.resize(rect.width, rect.height);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [candles, darkMode]);

  const handleSaveCoin = () => {
    setIsEditing(false);
    if (inputValue.trim() !== '') {
      setLocalCoin(inputValue.toUpperCase());
    } else {
      setInputValue(localCoin);
    }
  };

  return (
    <div className="w-full h-full relative border border-[#2a2e39]/30 rounded overflow-hidden group">
      <div ref={containerRef} className="w-full h-full absolute inset-0" />
      <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5 px-1 py-1 drop-shadow-md transition-all">
        {!isEditing ? (
          <div 
            className={`text-[10px] font-bold ${darkMode ? 'text-[#d1d4dc]' : 'text-gray-700'} uppercase tracking-wider cursor-pointer hover:text-blue-400 flex items-center gap-1`}
            onClick={() => setIsEditing(true)}
            title="Click to change coin"
          >
            <Search size={10} className="text-gray-400" />
            <span>{localCoin}</span>
            <span className="text-gray-500 font-medium">· {interval}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <Search size={10} className="text-blue-400" />
            <input 
              autoFocus
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveCoin();
                if (e.key === 'Escape') {
                  setInputValue(localCoin);
                  setIsEditing(false);
                }
              }}
              onBlur={handleSaveCoin}
              className={`w-[60px] text-[10px] font-bold bg-transparent outline-none uppercase ${darkMode ? 'text-white' : 'text-black'}`}
              placeholder="Coin..."
            />
          </div>
        )}
      </div>
    </div>
  );
}

function OrderBookPanel({ livePrice, selectedCoin, selectedExchange }) {
  const [activeSubTab, setActiveSubTab] = useState(() => {
    return localStorage.getItem('satyam_ai_terminal_ob_tab') || 'book';
  });
  const [bookLayout, setBookLayout] = useState(() => {
    return localStorage.getItem('satyam_ai_terminal_ob_layout') || 'both';
  });
  const [tickSize, setTickSize] = useState(() => {
    return localStorage.getItem('satyam_ai_terminal_ob_ticksize') || 'auto';
  });
  
  const [orderBook, setOrderBook] = useState({ bids: [], asks: [], spread: 0, spreadPct: 0 });
  const [trades, setTrades] = useState([]);
  
  const prevPriceRef = useRef(livePrice);
  const prevBookRef = useRef({ bids: [], asks: [] });
  
  const exchangeName = getExchangeMeta(selectedExchange).name;
  const decimals = livePrice > 1000 ? 2 : livePrice > 1 ? 3 : 5;

  const handleTabChange = (tab) => {
    setActiveSubTab(tab);
    localStorage.setItem('satyam_ai_terminal_ob_tab', tab);
  };

  const handleLayoutChange = (layout) => {
    setBookLayout(layout);
    localStorage.setItem('satyam_ai_terminal_ob_layout', layout);
  };

  const handleTickSizeChange = (size) => {
    setTickSize(size);
    localStorage.setItem('satyam_ai_terminal_ob_ticksize', size);
  };

  const tickOptions = useMemo(() => {
    if (!livePrice || livePrice <= 0) return ['auto'];
    if (livePrice > 1000) return ['auto', '0.01', '0.1', '1.0', '10.0'];
    if (livePrice > 10) return ['auto', '0.001', '0.01', '0.1', '1.0'];
    return ['auto', '0.0001', '0.001', '0.01'];
  }, [livePrice]);

  useEffect(() => {
    if (!livePrice || livePrice <= 0) return;
    
    const count = bookLayout === 'both' ? 8 : 16;
    const ticks = Array.from({ length: count }, (_, i) => i + 1);
    const spreadVal = livePrice * 0.0002;
    const askStart = livePrice + spreadVal / 2;
    const bidStart = livePrice - spreadVal / 2;

    let groupMultiplier = 1;
    if (tickSize !== 'auto') {
      groupMultiplier = parseFloat(tickSize);
    } else {
      groupMultiplier = livePrice > 1000 ? 0.5 : livePrice > 1 ? 0.01 : 0.0001;
    }

    const newAsks = ticks.map((t) => {
      const rawPrice = askStart + t * (livePrice * 0.00015);
      const price = Math.ceil(rawPrice / groupMultiplier) * groupMultiplier;
      const size = Math.random() * (selectedCoin.includes('BTC') ? 1.5 : selectedCoin.includes('ETH') ? 8 : 100) + 0.015;
      const prevAsk = prevBookRef.current.asks.find(a => Math.abs(a.price - price) < 0.000001);
      const flashClass = prevAsk ? (prevAsk.size !== size ? (size > prevAsk.size ? 'flash-green' : 'flash-red') : '') : 'flash-red';
      return { price, size, total: 0, flashClass };
    }).reverse();

    const newBids = ticks.map((t) => {
      const rawPrice = bidStart - t * (livePrice * 0.00015);
      const price = Math.floor(rawPrice / groupMultiplier) * groupMultiplier;
      const size = Math.random() * (selectedCoin.includes('BTC') ? 1.5 : selectedCoin.includes('ETH') ? 8 : 100) + 0.015;
      const prevBid = prevBookRef.current.bids.find(b => Math.abs(b.price - price) < 0.000001);
      const flashClass = prevBid ? (prevBid.size !== size ? (size > prevBid.size ? 'flash-green' : 'flash-red') : '') : 'flash-green';
      return { price, size, total: 0, flashClass };
    });

    let askAccum = 0;
    newAsks.forEach((x, idx) => {
      const reverseIdx = newAsks.length - 1 - idx;
      askAccum += newAsks[reverseIdx].size;
      newAsks[reverseIdx].total = askAccum;
    });

    let bidAccum = 0;
    newBids.forEach((x) => {
      bidAccum += x.size;
      x.total = bidAccum;
    });

    const maxAskTotal = Math.max(...newAsks.map(a => a.total)) || 1;
    const maxBidTotal = Math.max(...newBids.map(b => b.total)) || 1;

    newAsks.forEach(a => a.depthPct = (a.total / maxAskTotal) * 100);
    newBids.forEach(b => b.depthPct = (b.total / maxBidTotal) * 100);

    const spread = newAsks[newAsks.length - 1].price - newBids[0].price;
    const spreadPct = (spread / livePrice) * 100;

    setOrderBook({ asks: newAsks, bids: newBids, spread, spreadPct });
    prevBookRef.current = { asks: newAsks, bids: newBids };
  }, [livePrice, selectedCoin, bookLayout, tickSize]);

  useEffect(() => {
    if (!livePrice || livePrice <= 0) return;
    if (trades.length === 0) {
      const initTrades = Array.from({ length: 15 }, (_, i) => {
        const isBuy = Math.random() > 0.5;
        const dev = livePrice * (Math.random() * 0.0006 - 0.0003);
        return {
          id: Math.random(),
          price: livePrice + dev,
          size: Math.random() * (selectedCoin.includes('BTC') ? 0.8 : selectedCoin.includes('ETH') ? 5 : 50) + 0.01,
          time: new Date(Date.now() - i * 3200).toLocaleTimeString([], { hour12: false }),
          side: isBuy ? 'BUY' : 'SELL',
          flashClass: isBuy ? 'flash-green' : 'flash-red'
        };
      });
      setTrades(initTrades);
      return;
    }

    const interval = setInterval(() => {
      const isBuy = Math.random() > 0.45;
      const dev = livePrice * (Math.random() * 0.0004 - 0.0002);
      const newTrade = {
        id: Math.random(),
        price: livePrice + dev,
        size: Math.random() * (selectedCoin.includes('BTC') ? 0.6 : selectedCoin.includes('ETH') ? 4 : 40) + 0.01,
        time: new Date().toLocaleTimeString([], { hour12: false }),
        side: isBuy ? 'BUY' : 'SELL',
        flashClass: isBuy ? 'flash-green' : 'flash-red'
      };
      setTrades(prev => [newTrade, ...prev.slice(0, 24)]);
    }, 700);

    return () => clearInterval(interval);
  }, [livePrice, selectedCoin, trades.length]);

  const isPriceUp = livePrice >= prevPriceRef.current;
  const priceColorClass = isPriceUp ? 'text-emerald-400' : 'text-red-400';
  const priceBgClass = isPriceUp ? 'bg-emerald-500/10' : 'bg-red-500/10';
  prevPriceRef.current = livePrice;
  const inrValue = livePrice * 88.5;

  return (
    <div className="flex flex-col h-full space-y-3 font-mono text-[10.5px] select-none text-[#d1d4dc] min-h-0 overflow-hidden">
      <div className="flex items-center justify-between border-b border-[#2a2e39]/20 pb-2 px-1">
        <div className="flex items-center gap-1.5">
          <span className="font-extrabold text-[12px] text-white tracking-wider">{selectedCoin}</span>
          <span className="text-[8px] bg-blue-500/15 text-blue-400 font-extrabold px-1 rounded-sm">{exchangeName}</span>
        </div>
        <span className="text-[9px] text-gray-500 font-semibold uppercase tracking-wider">Live feeds</span>
      </div>

      <div className="flex items-center justify-between gap-2 px-1 shrink-0">
        <div className="flex bg-black/40 rounded border border-[#2a2e39]/30 p-0.5 w-[140px]">
          {['book', 'trades'].map((tab) => (
            <button
              key={tab}
              onClick={() => handleTabChange(tab)}
              className={`flex-1 py-1 rounded text-[9px] font-black uppercase transition-all tracking-wider ${
                activeSubTab === tab ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab === 'book' ? 'Order Book' : 'Recent'}
            </button>
          ))}
        </div>

        {activeSubTab === 'book' && (
          <div className="flex items-center gap-1">
            <div className="flex bg-black/40 rounded border border-[#2a2e39]/30 p-0.5">
              {[
                { id: 'both', title: 'Default Split Layout' },
                { id: 'asks', title: 'Show Asks Only' },
                { id: 'bids', title: 'Show Bids Only' }
              ].map(layout => (
                <button
                  key={layout.id}
                  onClick={() => handleLayoutChange(layout.id)}
                  title={layout.title}
                  className={`w-5 h-5 flex items-center justify-center rounded text-[10px] font-black uppercase transition-all ${
                    bookLayout === layout.id 
                      ? 'bg-gray-800 text-white border border-[#2a2e39]' 
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {layout.id === 'both' ? (
                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current"><rect x="3" y="3" width="18" height="7" fill="#F23645" /><rect x="3" y="14" width="18" height="7" fill="#089981" /></svg>
                  ) : layout.id === 'asks' ? (
                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current"><rect x="3" y="3" width="18" height="18" fill="#F23645" /></svg>
                  ) : (
                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current"><rect x="3" y="3" width="18" height="18" fill="#089981" /></svg>
                  )}
                </button>
              ))}
            </div>

            <select
              value={tickSize}
              onChange={(e) => handleTickSizeChange(e.target.value)}
              className="bg-black/40 text-[9px] font-black text-gray-300 border border-[#2a2e39]/30 rounded px-1.5 py-1 outline-none cursor-pointer"
              title="Select tick size grouping"
            >
              {tickOptions.map(opt => (
                <option key={opt} value={opt}>{opt === 'auto' ? 'Auto Tick' : opt}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden space-y-2">
        {activeSubTab === 'book' && (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-black/10 rounded-lg p-1.5 border border-[#2a2e39]/10">
            <div className="grid grid-cols-3 text-gray-500 font-extrabold uppercase py-1 border-b border-[#2a2e39]/20 text-[9px] tracking-wider px-1">
              <span>Price({selectedCoin.substring(selectedCoin.length - 4)})</span>
              <span className="text-right">Size({selectedCoin.substring(0, selectedCoin.length - 4)})</span>
              <span className="text-right">Total</span>
            </div>

            {(bookLayout === 'both' || bookLayout === 'asks') && (
              <div className="flex-1 flex flex-col-reverse justify-end overflow-hidden py-1">
                {orderBook.asks.map((ask, idx) => (
                  <div key={idx} className={`grid grid-cols-3 py-[2.5px] px-1 relative hover:bg-white/5 transition-colors duration-150 ${ask.flashClass}`}>
                    <div
                      className="absolute right-0 top-0 bottom-0 bg-red-500/[0.08] transition-all duration-300 pointer-events-none"
                      style={{ width: `${ask.depthPct}%` }}
                    />
                    <span className="text-red-400 font-bold z-10">{ask.price.toFixed(decimals)}</span>
                    <span className="text-right font-medium text-gray-300 z-10">{ask.size.toFixed(4)}</span>
                    <span className="text-right font-medium text-gray-400 z-10">{ask.total.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}

            <div className={`border-y border-[#2a2e39]/40 py-2 px-2 flex justify-between items-center z-10 ${priceBgClass} transition-colors duration-300`}>
              <div className="flex items-center gap-1.5">
                <span className={`text-[13px] font-black tracking-tight ${priceColorClass}`}>
                  {isPriceUp ? '▲' : '▼'} {livePrice.toFixed(decimals)}
                </span>
                <span className="text-[9px] text-gray-500 font-bold" title="Approx. Fiat conversion in INR">
                  ≈ ₹{inrValue.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[9px] text-gray-500 font-bold block uppercase tracking-wider">
                  Spread: <span className="text-gray-300 font-black">{orderBook.spread.toFixed(decimals)} ({orderBook.spreadPct.toFixed(2)}%)</span>
                </span>
              </div>
            </div>

            {(bookLayout === 'both' || bookLayout === 'bids') && (
              <div className="flex-1 flex flex-col overflow-hidden py-1">
                {orderBook.bids.map((bid, idx) => (
                  <div key={idx} className={`grid grid-cols-3 py-[2.5px] px-1 relative hover:bg-white/5 transition-colors duration-150 ${bid.flashClass}`}>
                    <div
                      className="absolute right-0 top-0 bottom-0 bg-emerald-500/[0.08] transition-all duration-300 pointer-events-none"
                      style={{ width: `${bid.depthPct}%` }}
                    />
                    <span className="text-emerald-400 font-bold z-10">{bid.price.toFixed(decimals)}</span>
                    <span className="text-right font-medium text-gray-300 z-10">{bid.size.toFixed(4)}</span>
                    <span className="text-right font-medium text-gray-400 z-10">{bid.total.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeSubTab === 'trades' && (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-black/10 rounded-lg p-1.5 border border-[#2a2e39]/10">
            <div className="grid grid-cols-3 text-gray-500 font-extrabold uppercase py-1 border-b border-[#2a2e39]/20 text-[9px] tracking-wider px-1">
              <span>Price({selectedCoin.substring(selectedCoin.length - 4)})</span>
              <span className="text-right">Amount({selectedCoin.substring(0, selectedCoin.length - 4)})</span>
              <span className="text-right">Time</span>
            </div>
            <div className="flex-1 overflow-y-auto dark-scrollbar space-y-0.5 py-1 px-1">
              {trades.map((t) => (
                <div key={t.id} className={`grid grid-cols-3 py-[3px] items-center hover:bg-white/5 transition-colors duration-200 ${t.flashClass}`}>
                  <span className={`font-black flex items-center gap-1 ${t.side === 'BUY' ? 'text-emerald-400' : 'text-red-400'}`}>
                    <span className={`w-1 h-2.5 rounded-xs shrink-0 ${t.side === 'BUY' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                    {t.price.toFixed(decimals)}
                  </span>
                  <span className="text-right text-gray-300 font-medium">
                    {t.size.toFixed(selectedCoin.includes('BTC') ? 4 : selectedCoin.includes('ETH') ? 3 : 2)}
                  </span>
                  <span className="text-right text-gray-500 font-bold">{t.time}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}



