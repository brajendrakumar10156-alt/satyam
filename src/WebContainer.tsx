import NativeCanvasEngine from './core_render_canvas2d/NativeCanvasEngine';
// @ts-nocheck
/// <reference types="vite/client" />
import OrderBookPanel from './components/OrderBookPanel';
import MiniChartWrapper from './components/MiniChartWrapper';
import html2canvas from 'html2canvas';
import { useWebContainerBacktest } from './hooks/useWebContainerBacktest';
import { useWebContainerAI } from './hooks/useWebContainerAI';
import { useMarketWebsockets } from './hooks/useMarketWebsockets';
import { useLightweightCharts } from './hooks/useLightweightCharts';
import { useDrawingOverlays } from './hooks/useDrawingOverlays';
import { RightToolbar } from './components/layout/RightToolbar';
import { RightSidebar } from './components/layout/RightSidebar';
import { LeftToolbar } from './components/layout/LeftToolbar';
import React, { useEffect, useRef, useState, useCallback, useMemo, Suspense, lazy } from 'react';


import NativeDrawingLayer from './components/NativeDrawingLayer';
import NativeIndicatorLayer from './components/NativeIndicatorLayer';
import DrawingAxisLabels from './components/DrawingAxisLabels';
// Lazy load heavy components
const WebGLChartEngineLazy = lazy(() => import('./components/WebGLChartEngine'));
const WebGLChartEngine = (props: any) => <Suspense fallback={<div>Loading WebGL Engine...</div>}><WebGLChartEngineLazy {...props} /></Suspense>;

const WebGPUChartEngineLazy = lazy(() => import('./components/WebGPUChartEngine'));
const WebGPUChartEngine = React.forwardRef((props: any, ref) => <Suspense fallback={<div>Loading WebGPU Engine...</div>}><WebGPUChartEngineLazy {...props} ref={ref} /></Suspense>);

const EditorLazy = lazy(() => import('@monaco-editor/react'));
const Editor = (props: any) => <Suspense fallback={<div className="p-4 text-center text-gray-500 text-xs">Loading Code Editor...</div>}><EditorLazy {...props} /></Suspense>;

import { captureViewportSnapshot, generateDrawingId } from './utils/drawingStore';
import { loadDrawingsFromDB, saveDrawingsToDB } from './utils/drawingPersistence';
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
const ArbitrageBotLazy = lazy(() => import('./components/ArbitrageBot'));
const ArbitrageBot = (props: any) => <Suspense fallback={<div className="p-4 text-gray-500 text-xs text-center">Loading Arbitrage Matrix...</div>}><ArbitrageBotLazy {...props} /></Suspense>;

const StrategyTesterLazy = lazy(() => import('./components/StrategyTester'));
const StrategyTester = (props: any) => <Suspense fallback={<div className="p-4 text-gray-500 text-xs text-center">Loading Strategy Engine...</div>}><StrategyTesterLazy {...props} /></Suspense>;

const Level3DepthTapeLazy = lazy(() => import('./components/Level3DepthTape'));
const Level3DepthTape = (props: any) => <Suspense fallback={<div className="p-4 text-gray-500 text-xs text-center">Loading L3 Depth...</div>}><Level3DepthTapeLazy {...props} /></Suspense>;

const AIRiskPanelLazy = lazy(() => import('./components/AIRiskPanel'));
const AIRiskPanel = (props: any) => <Suspense fallback={<div className="p-4 text-gray-500 text-xs text-center">Loading AI Risk Panel...</div>}><AIRiskPanelLazy {...props} /></Suspense>;
import { predictNextCandle } from './utils/predictionEngine';
import PredictionReportModal from './components/PredictionReportModal';
import { startAutoDataVerifier } from './utils/autoDataVerifier';

/** Pure helper: convert OHLCV candles to Heikin-Ashi candles */

import { API_BASE, CANDLE_BATCH_SIZE, INITIAL_HISTORY_BATCHES, MAX_CANDLES_IN_MEMORY, SIX_YEARS_SECONDS, INTERVAL_SECONDS_MAP, CUSTOM_TIMEFRAME_REGEX, intervalToSeconds, getHistoryCandleCap, QUOTE_ASSETS, parseSymbolParts, getBaseAsset, getQuoteAsset, getFngColor, formatUSD, formatShortNumber, COINGECKO_ID_MAP, getCoinGeckoId, coinIconUrl, handleCoinIconError } from './app_core/AppConfig';
import { mergeCandles, toHeikinAshi, hexToRGBA, distanceToLineSegment, throttle } from './utils/chartHelpers';
import { TopNavbar } from './components/layout/TopNavbar';
import TradingPanel from './components/layout/TradingPanel';
import { PineEditorPanel } from './components/layout/PineEditorPanel';
import { IndicatorSearchModal } from './components/layout/IndicatorSearchModal';
import { AlertSettingsModal } from './components/layout/AlertSettingsModal';
import { IndicatorParamsModal } from './components/layout/IndicatorParamsModal';
import { NewsFlashPanel } from './components/layout/NewsFlashPanel';
import { BarReplayControls } from './components/layout/BarReplayControls';
import { ChartBottomBar } from './components/layout/ChartBottomBar';
import { PineEditorPanel } from "./components/layout/PineEditorPanel";

// ─── Helper for eraser hit testing ───




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

export default function WebContainer({ onLogout, onBackToCoins }: { onLogout?: () => void, onBackToCoins?: () => void }) {
  useEffect(() => {
    const handleWebGLInitError = (e) => {
      setRenderEngine('canvas2d');
      showToast('WebGL Init Error: ' + (e.detail?.message || 'Unsupported'));
    };
    window.addEventListener('webgl-init-error', handleWebGLInitError);
    return () => window.removeEventListener('webgl-init-error', handleWebGLInitError);
  }, []);
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
    if (selectedCoin) {
      const rustUrl = import.meta.env.VITE_RUST_SERVER_URL || 'http://127.0.0.1:8080';
      fetch(`${rustUrl}/api/select_symbol?symbol=${selectedCoin}`).catch(() => {});
    }
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

  useEffect(() => {
    startAutoDataVerifier();
  }, []);
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
    
    if (nextMode === 'webgpu') setToastMsg('🚀 WebGPU Engine — Acer Aspire 7 Dedicated GPU Accelerated');
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
        const rustUrl = import.meta.env.VITE_RUST_SERVER_URL || 'http://127.0.0.1:8080';
        const res = await fetch(`${rustUrl}/api/tickers`);
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
        const rustUrl = import.meta.env.VITE_RUST_SERVER_URL || 'http://127.0.0.1:8080';
        const res = await fetch(`${rustUrl}/api/tickers`);
        if (!res.ok) return;
        const dataArray = await res.json();
        const data = Array.isArray(dataArray) ? dataArray.find((t: any) => t.symbol === selectedCoin) : null;
        
        if (data) {
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
  }, [isAtRealtimeEdge, chartStyle, replayMode, chartInterval, selectedExchange, selectedCoin]);

  const requestDraw = useCallback(() => {
    // No-op: rendering engines now redraw automatically via React props
  }, []);
  
  // Dummy functions to prevent crashes before the large HTML cleanup
  const LeftSidePanel = () => null;
  const AiChatPanel = () => null;
  const renderBountyPanel = () => null;
  const renderDiffViewer = () => null;
  const renderEditorPanel = () => (
    <PineEditorPanel 
      t={t}
      darkMode={darkMode}
      loading={loading}
      runBacktest={runBacktest}
      editorRef={editorRef}
      editorContent={editorContent}
      setEditorContent={setEditorContent}
      monacoEditorRef={monacoEditorRef}
      consoleOutput={consoleOutput}
      compileError={compileError}
      renderTriangleRIcon={renderTriangleRIcon}
      setEditorMode={setEditorMode}
      editorMode={editorMode}
      pineCode={pineCode}
      pythonCode={pythonCode}
      showDiff={showDiff}
      setShowDiff={setShowDiff}
      setBaseCode={setBaseCode}
      setSubView={setSubView}
      getSubView={getSubView}
      aiProvider={aiProvider}
      setAiProvider={setAiProvider}
      handleUndo={handleUndo}
      historyIndex={historyIndex}
      codeHistory={codeHistory}
      handleRedo={handleRedo}
      sendAiMessage={sendAiMessage}
      DEFAULT_PYTHON_STRATEGY={DEFAULT_PYTHON_STRATEGY}
      handleCodeChange={handleCodeChange}
      renderDiffViewer={renderDiffViewer}
      AiChatPanel={AiChatPanel}
      syntaxStatus={syntaxStatus}
      checkBackend={checkBackend}
      showToast={showToast}
      backendOnline={backendOnline}
    />
  );
  const renderOHLCHeader = () => null;
  const renderIndValues = () => null;
  const renderChartOverlays = () => null;
  
  // Dummy event handlers for the old inline canvas
  const handlePointerDown = () => {};
  const handlePointerMove = () => {};
  const handlePointerUp = () => {};
  const handleNativeWheel = () => {};
  
  // Dummy helper functions to prevent any other ghost crashes
  const getAltInterval = () => '1h';
  const updateCrosshairDOM = () => {};
  const getSnappedPriceAndTime = () => {};
  const getOHLCDiff = () => {};
  const getChartCoords = () => {};
  const findDrawingAtCoords = () => {};
  const distanceToSegment = () => {};

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
      if (selectedCoin) {
        binanceCoinSetRef.current.add(selectedCoin);
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

  
  useMarketWebsockets({ selectedCoin, selectedExchange, fetchGenerationRef, handleRawTrade, upsertLiveCandle, setMarketStatus, chartInterval, isBacktesting, backendOnline });


  
  useLightweightCharts({ chartRef, renderEngine, chartInstance, candleSeries, t, darkMode, selectedCoin, subChartsMapRef, isDrawing, handleNativeWheel });



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
  
  useDrawingOverlays({ chartInstance, chartCreated, visualIndicators, latestCandleRef });


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
  const sideTools = [
    { id: 'ai', icon: Sparkles, title: 'AI Assistant', action: () => openLeftPanel('ai') },
  ];
  /* renderRightSidePanel extracted to RightSidebar.tsx */

  // LeftToolbar extracted/removed
;

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

  const executeSearch = async (targetCoin) => {
    const cu = targetCoin.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!cu) return;

    let symbol = cu;
    const known = binanceCoinSetRef.current;

    if (known.size > 0) {
      if (known.has(cu)) {
        symbol = cu;
      } else {
        const usdtPair = cu + 'USDT';
        const matches = binanceCoins.filter((c) => c.includes(cu));
        const exactStart = matches.filter((c) => c.startsWith(cu));
        if (known.has(usdtPair)) {
          symbol = usdtPair;
        } else if (exactStart.length >= 1) {
          symbol = exactStart.find((c) => c.endsWith('USDT')) || exactStart[0];
        } else if (matches.length === 1) {
          symbol = matches[0];
        } else if (matches.length === 0) {
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
                <IndicatorSearchModal
                  indicatorSearchQuery={indicatorSearchQuery}
                  setIndicatorSearchQuery={setIndicatorSearchQuery}
                  indicatorCategorySubTab={indicatorCategorySubTab}
                  setIndicatorCategorySubTab={setIndicatorCategorySubTab}
                  selectedIndicatorTab={selectedIndicatorTab}
                  setSelectedIndicatorTab={setSelectedIndicatorTab}
                  visualIndicators={visualIndicators}
                  setVisualIndicators={setVisualIndicators}
                  showToast={showToast}
                  injectIndicator={injectIndicator}
                  closeModal={closeModal}
                  t={t}
                />
              ) : activeModal.type === 'alert_creation' ? (
                <AlertSettingsModal
                  alertCondition={alertCondition}
                  setAlertCondition={setAlertCondition}
                  alertValue={alertValue}
                  setAlertValue={setAlertValue}
                  selectedCoin={selectedCoin}
                  livePrice={livePrice}
                  formatUSD={formatUSD}
                  darkMode={darkMode}
                  closeModal={closeModal}
                  t={t}
                />
              ) : activeModal.type === 'indicator_settings' ? (
                <IndicatorParamsModal
                  editingModalTab={editingModalTab}
                  setEditingModalTab={setEditingModalTab}
                  activeModal={activeModal}
                  tempIndicatorParams={tempIndicatorParams}
                  setTempIndicatorParams={setTempIndicatorParams}
                  tempIndicatorColor={tempIndicatorColor}
                  setTempIndicatorColor={setTempIndicatorColor}
                  tempIndicatorWidth={tempIndicatorWidth}
                  setTempIndicatorWidth={setTempIndicatorWidth}
                  darkMode={darkMode}
                  closeModal={closeModal}
                  setVisualIndicators={setVisualIndicators}
                  showToast={showToast}
                />
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

            <TopNavbar 
              onLaunchDesktopApp={() => {
                setRenderEngine('app');
                setToastMsg('🖥️ Launching Quanta Windows Desktop Native App (app_src)...');
                setTimeout(() => setToastMsg(''), 3000);
              }}
              isMobile={isMobile}
              focusMode={focusMode}
              darkMode={darkMode}
              t={t}
              selectedCoin={selectedCoin}
              livePrice={livePrice}
              watchlistTickers={watchlistTickers}
              isDropdownOpen={isDropdownOpen}
              setIsDropdownOpen={setIsDropdownOpen}
              chartInterval={chartInterval}
              setChartInterval={setChartInterval}
              chartStyle={chartStyle}
              setChartStyle={setChartStyle}
              onBackToCoins={onBackToCoins}
              selectedExchange={selectedExchange}
              handleExchangeChange={handleExchangeChange}
              EXCHANGE_LIST={EXCHANGE_LIST}
              executeSearch={executeSearch}
              coinInput={coinInput}
              setCoinInput={setCoinInput}
              openModal={openModal}
              coinsLoading={coinsLoading}
              filteredCoins={filteredCoins}
              getQuoteAsset={getQuoteAsset}
              fearGreedIndex={fearGreedIndex}
              marketStatus={marketStatus}
              isTimeframeDropdownOpen={isTimeframeDropdownOpen}
              setIsTimeframeDropdownOpen={setIsTimeframeDropdownOpen}
              isStyleDropdownOpen={isStyleDropdownOpen}
              setIsStyleDropdownOpen={setIsStyleDropdownOpen}
              volumeProfile={volumeProfile}
              setVolumeProfile={setVolumeProfile}
              isActionsDropdownOpen={isActionsDropdownOpen}
              setIsActionsDropdownOpen={setIsActionsDropdownOpen}
              chartLayout={chartLayout}
              setChartLayout={setChartLayout}
              isLayoutMenuOpen={isLayoutMenuOpen}
              setIsLayoutMenuOpen={setIsLayoutMenuOpen}
              isAutosave={isAutosave}
              setIsAutosave={setIsAutosave}
              isShareLayout={isShareLayout}
              setIsShareLayout={setIsShareLayout}
              layoutName={layoutName}
              tradingTab={tradingTab}
              setTradingTab={setTradingTab}
              lowerBoxState={lowerBoxState}
              setLowerBoxState={setLowerBoxState}
              takeRealScreenshot={takeRealScreenshot}
              publishStrategy={publishStrategy}
              stealthMode={stealthMode}
              setStealthMode={setStealthMode}
              activeFlyout={activeFlyout}
              setActiveFlyout={setActiveFlyout}
              timezone={timezone}
              setTimezone={setTimezone}
              allCandles={allCandles}
              timeframeButtons={timeframeButtons}
              customTimeframeInput={customTimeframeInput}
              setCustomTimeframeInput={setCustomTimeframeInput}
              applyCustomTimeframe={applyCustomTimeframe}
              loadDeepHistory={loadDeepHistory}
              showToast={showToast}
              getFngColor={getFngColor}
              getExchangeMeta={getExchangeMeta}
              setMobileMenuOpen={setMobileMenuOpen}
              formatNumber={formatNumber}
              coinIconUrl={coinIconUrl}
              handleCoinIconError={handleCoinIconError}
              setRightSidebar={setRightSidebar}
              toggleFullscreen={toggleFullscreen}
              priceColor={priceColor}
              replayMode={replayMode}
              setReplayMode={setReplayMode}
              fullCandlesRef={fullCandlesRef}
              allCandlesRef={allCandlesRef}
              setAllCandles={setAllCandles}
              requestDraw={requestDraw}
              setFocusMode={setFocusMode}
              setDarkMode={setDarkMode}
              onRefreshChart={() => {
                fetchGenerationRef.current = (fetchGenerationRef.current || 0) + 1;
                allCandlesRef.current = [];
                setAllCandles([]);
                setMarketStatus("Loading");
              }}
            />
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
                        
                        </WebGLErrorBoundary>
                      ) : renderEngine === 'webgpu' ? (
                        
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
                            onFallback={() => {
                              console.warn('[App] WebGPU Engine failed, gracefully falling back to WebGL.');
                              setRenderEngine('webgl');
                            }}
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
                        
                      ) : renderEngine === 'app' ? (
                        <div className="w-full h-full absolute inset-0 z-30">
                          <AppContainer onBackToWeb={() => setRenderEngine('webgpu')} />
                        </div>
                      ) : (
                        <div ref={chartRef} className="w-full h-full relative" />
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
                        <div ref={chartRef} className="w-full h-full relative" />
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
                        <div ref={chartRef} className="w-full h-full relative" />
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
                        <div ref={chartRef} className="w-full h-full relative" />
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
              <BarReplayControls
                replayMode={replayMode}
                fullCandlesLength={fullCandlesRef.current.length}
                isReplayPlaying={isReplayPlaying}
                setIsReplayPlaying={setIsReplayPlaying}
                setReplayIndex={setReplayIndex}
                replayIndex={replayIndex}
                replaySpeed={replaySpeed}
                setReplaySpeed={setReplaySpeed}
                allCandlesRef={allCandlesRef}
                fullCandlesRef={fullCandlesRef}
                setAllCandles={setAllCandles}
                setReplayMode={setReplayMode}
                showToast={showToast}
              />

            {/* NEW TRADINGVIEW STYLE BOTTOM BAR */}
            <ChartBottomBar
              darkMode={darkMode}
              applyTimeRange={applyTimeRange}
              showToast={showToast}
            />
            </div>

          </div>
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
          <TradingPanel 
            positions={positions}
            paperOrders={paperOrders}
            selectedCoin={selectedCoin}
            livePrice={livePrice}
            leverage={leverage}
            closeActivePosition={closeActivePosition}
            cancelLimitOrder={cancelLimitOrder}
            handleExecuteArbitrage={handleExecuteArbitrage}
            t={t}
          />
        </div>
      </div>

      {/* Unified Split Right Sidebar Container */}
      {!isMobile && !focusMode && (isEditorOpen || rightSidebar) && (
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
  watchlist={watchlist} setWatchlist={setWatchlist} watchlistTickers={watchlistTickers}
  watchlistSearchInput={watchlistSearchInput} setWatchlistSearchInput={setWatchlistSearchInput}
  watchlistDropdownOpen={watchlistDropdownOpen} setWatchlistDropdownOpen={setWatchlistDropdownOpen}
  binanceCoins={binanceCoins} showToast={showToast} setMarketStatus={setMarketStatus}
  coinIconUrl={coinIconUrl} handleCoinIconError={handleCoinIconError}
  priceColor={priceColor} getBaseAsset={getBaseAsset} isPerpetualSymbol={isPerpetualSymbol}
  futuresLoading={futuresLoading} fundingRate={fundingRate} openInterest={openInterest}
  formatShortNumber={formatShortNumber} fundamentalsLoading={fundamentalsLoading}
  fundamentalsError={fundamentalsError} coinFundamentals={coinFundamentals}
  formatUSD={formatUSD} getFngColor={getFngColor}
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
  OrderBookPanel={OrderBookPanel} livePrice={livePrice} selectedCoin={selectedCoin} setSelectedCoin={setSelectedCoin}
  selectedCoinStats={selectedCoinStats} selectedExchange={selectedExchange} fearGreedIndex={fearGreedIndex}
  watchlist={watchlist} setWatchlist={setWatchlist} watchlistTickers={watchlistTickers}
  watchlistSearchInput={watchlistSearchInput} setWatchlistSearchInput={setWatchlistSearchInput}
  watchlistDropdownOpen={watchlistDropdownOpen} setWatchlistDropdownOpen={setWatchlistDropdownOpen}
  binanceCoins={binanceCoins} showToast={showToast} setMarketStatus={setMarketStatus}
  coinIconUrl={coinIconUrl} handleCoinIconError={handleCoinIconError}
  priceColor={priceColor} getBaseAsset={getBaseAsset} isPerpetualSymbol={isPerpetualSymbol}
  futuresLoading={futuresLoading} fundingRate={fundingRate} openInterest={openInterest}
  formatShortNumber={formatShortNumber} fundamentalsLoading={fundamentalsLoading}
  fundamentalsError={fundamentalsError} coinFundamentals={coinFundamentals}
  formatUSD={formatUSD} getFngColor={getFngColor}
/>
            </div>
          )}
        </div>
      )}

      {/* Unified Combined Vertical Right Toolbar */}
      {!isMobile && !focusMode && (
        <RightToolbar 
          isEditorOpen={isEditorOpen} setIsEditorOpen={setIsEditorOpen} 
          isAutoPredictEnabled={isAutoPredictEnabled} handlePredictClick={handlePredictClick} 
          darkMode={darkMode} rightSidebar={rightSidebar} setRightSidebar={setRightSidebar} t={t} 
        />
      )}
      
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


// MiniChartWrapper extracted/removed


// OrderBookPanel extracted/removed





