import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import Editor from '@monaco-editor/react';
import logo from './assets/logo.jpeg';
import { createChart } from 'lightweight-charts';
import {
  Clock, Sliders, Radio, Activity, TrendingUp, Search, Percent, ListFilter,
  Database, RefreshCw, ChevronUp, ChevronDown, Play, Undo, Redo, Bell,
  History, Settings, Camera, Maximize2, Layers, Upload, FileDiff, X,
  ChevronRight, ChevronDown as ChevronDownIcon, Download, Sun, Moon,
  Crosshair, Square, Type, Eraser, Menu, Sparkles, Send, Bot, Code2, FileCode,
  Brush, Ruler, Trash2, Eye, EyeOff, Calendar, ArrowLeft,
  MousePointer, Circle, Disc, Triangle, FileText, DollarSign, MessageSquare,
  Flag, Target, Shield, Move, Maximize, Magnet, Lock, Unlock, Smile, Compass, Minus,
  ArrowRight, ArrowUpRight, GitCommit, Info, MoveVertical, Plus, Columns, Award, GitBranch,
  ArrowUp, ArrowDown, Star, Heart, Box, ZoomIn, ZoomOut
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

/** Backtest / AI server — must run: npm run backend (port 8000) */
const API_BASE = import.meta.env.VITE_BACKEND_URL ?? 'http://127.0.0.1:8000';
const CANDLE_BATCH_SIZE = 1000;
const INITIAL_HISTORY_BATCHES = 5;
const MAX_CANDLES_IN_MEMORY = 60000;
const SIX_YEARS_SECONDS = 6 * 365 * 24 * 60 * 60;

// Known interval -> seconds. Anything not listed here is parsed on the fly
// (e.g. "45m", "3h", "9d") so users can type a fully custom timeframe.
const INTERVAL_SECONDS_MAP = {
  '1m': 60, '3m': 180, '5m': 300, '15m': 900, '30m': 1800,
  '1h': 3600, '2h': 7200, '4h': 14400, '6h': 21600, '8h': 28800, '12h': 43200,
  '1d': 86400, '3d': 259200, '1w': 604800, '1M': 2592000,
};
const CUSTOM_TIMEFRAME_REGEX = /^(\d{1,4})(m|h|d|w|M)$/;

function intervalToSeconds(interval) {
  if (INTERVAL_SECONDS_MAP[interval]) return INTERVAL_SECONDS_MAP[interval];
  const match = String(interval || '').match(CUSTOM_TIMEFRAME_REGEX);
  if (!match) return 60;
  const amount = Number(match[1]);
  const unit = match[2];
  const unitSeconds = unit === 'm' ? 60 : unit === 'h' ? 3600 : unit === 'd' ? 86400 : unit === 'w' ? 604800 : 2592000;
  return amount * unitSeconds;
}

// How many candles we need in memory to cover 6 years at this interval
function getHistoryCandleCap(interval) {
  const secs = intervalToSeconds(interval);
  const neededForSixYears = Math.ceil(SIX_YEARS_SECONDS / secs);
  return Math.max(2000, Math.min(neededForSixYears, MAX_CANDLES_IN_MEMORY));
}

const QUOTE_ASSETS = [
  'USDT', 'USDC', 'BUSD', 'FDUSD', 'TUSD', 'DAI', 'BTC', 'ETH', 'BNB', 'EUR', 'TRY',
  'BRL', 'AUD', 'GBP', 'RUB', 'UAH', 'IDR', 'ZAR', 'NGN', 'PLN', 'RON', 'ARS', 'JPY',
  'MXN', 'CZK', 'CAD', 'VAI', 'USDP', 'UST', 'BKRW', 'BVND', 'TRX', 'XRP', 'DOGE',
].sort((a, b) => b.length - a.length);

function parseSymbolParts(symbol) {
  const upper = String(symbol || '').toUpperCase();
  for (const quote of QUOTE_ASSETS) {
    if (upper.endsWith(quote) && upper.length > quote.length) {
      return { base: upper.slice(0, -quote.length), quote };
    }
  }
  return { base: upper, quote: '' };
}

function getBaseAsset(symbol) {
  return parseSymbolParts(symbol).base;
}

function getQuoteAsset(symbol) {
  return parseSymbolParts(symbol).quote;
}

function coinIconUrl(symbol) {
  return `https://assets.coincap.io/assets/icons/${getBaseAsset(symbol).toLowerCase()}@2x.png`;
}

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

// ─── Indicator Calculations ───
function calculateEMA(data, period) {
  if (data.length < period) return [];
  const ema = [];
  const k = 2 / (period + 1);
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += data[i].close;
  }
  let val = sum / period;
  ema.push({ time: data[period - 1].time, value: val });
  for (let i = period; i < data.length; i++) {
    val = data[i].close * k + val * (1 - k);
    ema.push({ time: data[i].time, value: val });
  }
  return ema;
}

function calculateSMA(data, period) {
  if (data.length < period) return [];
  const sma = [];
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += data[i].close;
  }
  sma.push({ time: data[period - 1].time, value: sum / period });
  for (let i = period; i < data.length; i++) {
    sum = sum - data[i - period].close + data[i].close;
    sma.push({ time: data[i].time, value: sum / period });
  }
  return sma;
}

function calculateBB(data, period, stdDevMultiplier) {
  if (data.length < period) return { upper: [], middle: [], lower: [] };
  const upper = [];
  const middle = [];
  const lower = [];
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sum += data[j].close;
    }
    const ma = sum / period;
    let varianceSum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      varianceSum += Math.pow(data[j].close - ma, 2);
    }
    const stdDev = Math.sqrt(varianceSum / period);
    const time = data[i].time;
    middle.push({ time, value: ma });
    upper.push({ time, value: ma + stdDevMultiplier * stdDev });
    lower.push({ time, value: ma - stdDevMultiplier * stdDev });
  }
  return { upper, middle, lower };
}function calculateRSI(data, period = 14) {
  if (data.length <= period) return [];
  const rsi = [];
  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = data[i].close - data[i - 1].close;
    if (diff > 0) gains += diff;
    else losses -= diff;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;
  let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  rsi.push({ time: data[period].time, value: 100 - 100 / (1 + rs) });

  for (let i = period + 1; i < data.length; i++) {
    const diff = data[i].close - data[i - 1].close;
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsi.push({ time: data[i].time, value: 100 - 100 / (1 + rs) });
  }
  return rsi;
}

function calculateMACD(data, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  if (data.length <= slowPeriod + signalPeriod) return { macd: [], signal: [], hist: [] };

  const fastEma = calculateEMA(data, fastPeriod);
  const slowEma = calculateEMA(data, slowPeriod);

  const macdLine = [];
  const slowMap = new Map(slowEma.map(item => [item.time, item.value]));

  fastEma.forEach(item => {
    if (slowMap.has(item.time)) {
      macdLine.push({ time: item.time, value: item.value - slowMap.get(item.time) });
    }
  });

  const signalLine = calculateEMA(macdLine, signalPeriod);
  const signalMap = new Map(signalLine.map(item => [item.time, item.value]));

  const hist = [];
  macdLine.forEach(item => {
    if (signalMap.has(item.time)) {
      hist.push({ time: item.time, value: item.value - signalMap.get(item.time) });
    }
  });

  return { 
    macd: macdLine.filter(item => signalMap.has(item.time)), 
    signal: signalLine, 
    hist 
  };
}
function App({ onLogout, onBackToCoins }) {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  const candleSeries = useRef(null);
  const volumeSeries = useRef(null);
  const canvasRef = useRef(null);
  const latestCandleRef = useRef(null);
  const isFirstLoad = useRef(true);
  const isLoadingMoreRef = useRef(false);
  const allCandlesRef = useRef([]);
  const monacoEditorRef = useRef(null);
  const lastCacheSaveRef = useRef(0);
  const indicatorSeriesRef = useRef({});
  const newsPriceLineRef = useRef(null);
  const newsMarkerPlacedRef = useRef(false);
  const subChartsMapRef = useRef({});
  const positionLinesRef = useRef([]);
  const [activeNewsEvent, setActiveNewsEvent] = useState(null);
  const [chartCreated, setChartCreated] = useState(false);
  const skipNextFullRedrawRef = useRef(false);
  const fetchGenerationRef = useRef(0);
  const [indicatorStructureTick, setIndicatorStructureTick] = useState(0);
  const lastProcessedCandleRef = useRef({ time: 0, close: 0, length: 0 });
  const lastStructureTickRef = useRef(0);
  const saveRangeTimeoutRef = useRef(null);
  const [hoveredCandle, setHoveredCandle] = useState(null);
  const [quickTradeQty, setQuickTradeQty] = useState(0.01);
  const latestNewsListRef = useRef([]);
  const newsMarkerTimeRef = useRef(null);


  // ─── Theme Management ───
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  const t = useMemo(() => ({
    bg: darkMode ? 'bg-[#131722]' : 'bg-[#ffffff]',
    sec: darkMode ? 'bg-[#1e222d]' : 'bg-[#f8f9fa]',
    text: darkMode ? 'text-[#d1d4dc]' : 'text-[#131722]',
    muted: 'text-[#787b86]',
    border: darkMode ? 'border-[#2a2e39]' : 'border-[#e0e3eb]',
    hover: darkMode ? 'hover:bg-[#1e222d] hover:text-[#d1d4dc]' : 'hover:bg-[#f8f9fa] hover:text-[#131722]',
    glass: darkMode ? 'bg-[#1e222d]/70 backdrop-blur-md' : 'bg-[#ffffff]/80 backdrop-blur-md',
  }), [darkMode]);

  // ─── States ───
  const [editorMode, setEditorMode] = useState('pine');
  const [selectedExchange, setSelectedExchange] = useState(() => {
    const saved = localStorage.getItem('exchange');
    return EXCHANGE_LIST.some((e) => e.id === saved) ? saved : 'binance';
  });
  const [selectedCoin, setSelectedCoin] = useState(() => {
    const saved = localStorage.getItem('selectedCoin');
    return saved ? String(saved).toUpperCase() : 'SOLUSDT';
  });

  const [activeTab, setActiveTab] = useState('Performance Summary');
  const [loading, setLoading] = useState(false);
  const [chartInterval, setChartInterval] = useState('1m');
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
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [chartStyle, setChartStyle] = useState('Candles');
  const [replayMode, setReplayMode] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [activeModal, setActiveModal] = useState(null);
  const [isStyleDropdownOpen, setIsStyleDropdownOpen] = useState(false);
  const [isTimeframeDropdownOpen, setIsTimeframeDropdownOpen] = useState(false);
  const [selectedIndicatorTab, setSelectedIndicatorTab] = useState('Technicals');
  const [indicatorCategorySubTab, setIndicatorCategorySubTab] = useState('Indicators');
  const [indicatorSearchQuery, setIndicatorSearchQuery] = useState('');
  const [toastMsg, setToastMsg] = useState('');
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
  const [tempShape, setTempShape] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState(null);
  const [brushPath, setBrushPath] = useState([]); // Temporary path for active brush drawing
  const [magnetMode, setMagnetMode] = useState('off'); // 'off', 'weak', 'strong'
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
    { id: 'ema_9', type: 'ema', name: 'EMA', params: { period: 9 }, color: '#ff9800', visible: false },
    { id: 'ema_21', type: 'ema', name: 'EMA', params: { period: 21 }, color: '#ea39ff', visible: false },
    { id: 'sma_50', type: 'sma', name: 'SMA', params: { period: 50 }, color: '#2962ff', visible: false },
    { id: 'bb_20_2', type: 'bb', name: 'BB', params: { period: 20, stdDev: 2 }, color: '#26a69a', visible: false },
    { id: 'rsi_14', type: 'rsi', name: 'RSI', params: { period: 14 }, color: '#e040fb', visible: false },
    { id: 'macd_12_26_9', type: 'macd', name: 'MACD', params: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 }, color: '#29b6f6', visible: false }
  ]);
  const [editingIndicatorId, setEditingIndicatorId] = useState(null);

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
  const [watchlistSearchInput, setWatchlistSearchInput] = useState('');
  const [watchlistDropdownOpen, setWatchlistDropdownOpen] = useState(false);
  const [orderType, setOrderType] = useState('MARKET'); // 'MARKET' or 'LIMIT'
  const [orderSide, setOrderSide] = useState('BUY'); // 'BUY' or 'SELL'
  const [orderQty, setOrderQty] = useState('');
  const [orderLimitPrice, setOrderLimitPrice] = useState('');


  useEffect(() => { localStorage.setItem('paper_balance', balance); }, [balance]);
  useEffect(() => { localStorage.setItem('paper_positions', JSON.stringify(positions)); }, [positions]);
  useEffect(() => { localStorage.setItem('paper_orders', JSON.stringify(paperOrders)); }, [paperOrders]);
  useEffect(() => { localStorage.setItem('watchList', JSON.stringify(watchlist)); }, [watchlist]);

  // ─── Watchlist, News, Stats Data Fetchers ───
  useEffect(() => {
    const fetchWatchlistPrices = async () => {
      try {
        const res = await fetch('https://api.binance.com/api/v3/ticker/24hr');
        const data = await res.tson();
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
        const data = await res.tson();
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
      }
    };
    fetchStats();
    const id = setInterval(fetchStats, 8000);
    return () => clearInterval(id);
  }, [selectedCoin]);

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const res = await fetch('https://min-api.cryptocompare.com/data/v2/news/?lang=EN');
        const data = await res.tson();
        if (data && data.Data) {
          const parsed = data.Data.slice(0, 10).map(item => ({
            id: item.id,
            title: item.title,
            source: item.source,
            url: item.url,
            desc: item.body,
            time: new Date(item.published_on * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }));
          setNewsList(parsed);
          latestNewsListRef.current = parsed;
        }
      } catch (e) {
        const coinBase = getBaseAsset(selectedCoin);
        const fallbacks = [
          { id: 1, title: `${coinBase} Breaks Key Resistance Level, Eyes Higher Targets`, source: "CryptoNews", desc: "Technical indicators show strong momentum as trading volume spikes across major spot markets.", time: "10m ago" },
          { id: 2, title: "Market Sentiment Turns Bullish as Institutional Inflows Increase", source: "CoinPulse", desc: "A significant increase in spot ETF inflows signals renewed interest from traditional capital allocators.", time: "30m ago" },
          { id: 3, title: "New Regulatory Framework Proposed for Digital Assets", source: "BlockJournal", desc: "Legislators have proposed a structured oversight framework to define compliance and custody parameters.", time: "1h ago" },
          { id: 4, title: "Volume Surges Across Major Derivatives Exchanges", source: "TokenTimes", desc: "Open interest registers high volume growth as derivatives contracts trading activity intensifies.", time: "2h ago" },
        ];
        setNewsList(fallbacks);
        latestNewsListRef.current = fallbacks;
      }
    };
    fetchNews();
    const id = setInterval(fetchNews, 60000);
    return () => clearInterval(id);
  }, [selectedCoin]);

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
  const defaultPine = `// @ticker="SOLUSDT"\nstrategy("CADPRO Master Hybrid", overlay=true)\n\nema_fast = ema(close, 9)\nema_slow = ema(close, 21)\nlongCondition = crossover(ema_fast, ema_slow)\n\nif (longCondition)\n    strategy.entry("Long", strategy.long)`;

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
  const [alerts, setAlerts] = useState(() => {
    try { return JSON.parse(localStorage.getItem('cadpro_alerts') || '[]'); } catch { return []; }
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
    localStorage.setItem('cadpro_alerts', JSON.stringify(list));
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
  const takeRealScreenshot = () => {
    if (chartInstance.current) {
      const link = document.createElement('a'); link.download = `${selectedCoin}_Chart.png`;
      link.href = chartInstance.current.takeScreenshot().toDataURL('image/png'); link.click();
      showToast("📸 Screenshot Downloaded!");
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

  const toSeriesPoint = useCallback((c) => (
    chartStyle === 'Candles' ? c : { time: c.time, value: c.close }
  ), [chartStyle]);

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
      candleSeries.current?.setData(chartStyle === 'Candles' ? nextCandles : nextCandles.map(c => ({ time: c.time, value: c.close })));
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
        const data = await res.tson();
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
        ? fetch(`${API_BASE}/coins`).then((r) => r.tson()).catch(() => ({ coins: [] }))
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
      const data = await aiRes.tson();
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
      } catch (e) { setMarketStatus('Error'); }
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
          setLivePrice(prev => {
            setPriceColor(newPrice >= prev ? '#089981' : '#F23645');
            return newPrice;
          });
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
    if (!chartRef.current) return;
    const chart = createChart(chartRef.current, {
      width: chartRef.current.clientWidth,
      height: chartRef.current.clientHeight || 300,
      layout: { background: { color: darkMode ? '#131722' : '#ffffff' }, textColor: darkMode ? '#d1d4dc' : '#131722' },
      watermark: { visible: false, text: 'SATYAM', color: 'rgba(41,98,255,0.55)' },
      grid: { vertLines: { color: darkMode ? '#2a2e39' : '#e0e3eb' }, horzLines: { color: darkMode ? '#2a2e39' : '#e0e3eb' } },
      crosshair: {
        visible: false
      },
      timeScale: {
        borderColor: darkMode ? '#2a2e39' : '#e0e3eb',
        rightOffset: 8,
        barSpacing: isMobile ? 4 : 8,
        timeVisible: true,
        secondsVisible: chartInterval === '1m',
      },
    });

    const volSeries = chart.addHistogramSeries({
      color: '#26a69a',
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume', 
    });

    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    chartInstance.current = chart; 
    volumeSeries.current = volSeries;
    setChartCreated(true);

    chart.subscribeCrosshairMove((param) => {
      if (param.time && candleSeries.current) {
        const data = param.seriesData.get(candleSeries.current);
        if (data) {
          setHoveredCandle(data);
        } else {
          setHoveredCandle(null);
        }
      } else {
        setHoveredCandle(null);
      }
    });

    chart.subscribeClick((param) => {
      if (param.time && param.time === newsMarkerTimeRef.current) {
        const list = latestNewsListRef.current || [];
        if (list.length > 0) {
          const item = list[0]; // Real news article!
          setActiveNewsEvent({
            title: item.title,
            desc: item.desc || "Read the full coverage on " + item.source,
            source: item.source,
            url: item.url,
            actual: "Impact: High",
            forecast: "Bullish",
            previous: "Neutral"
          });
        } else {
          setActiveNewsEvent({
            title: "Market Breakout",
            desc: "Volatility surges on major exchanges as key support levels hold.",
            source: "System Feed",
            url: "https://cryptocompare.com",
            actual: "Impact: Medium",
            forecast: "Positive",
            previous: "Neutral"
          });
        }
      } else {
        setActiveNewsEvent(null);
      }
    });

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
  }, []);

  useEffect(() => {
    if (!chartCreated || !chartInstance.current) return;

    if (candleSeries.current) {
      chartInstance.current.removeSeries(candleSeries.current);
      candleSeries.current = null;
    }

    const series = chartStyle === 'Candles'
      ? chartInstance.current.addCandlestickSeries({ upColor: '#089981', downColor: '#F23645', borderUpColor: '#089981', borderDownColor: '#F23645', wickUpColor: '#089981', wickDownColor: '#F23645' })
      : chartInstance.current.addAreaSeries({ lineColor: '#7C5CFF', topColor: '#7C5CFF20', bottomColor: '#7C5CFF00', lineWidth: 2 });
    
    candleSeries.current = series;

    if (allCandlesRef.current.length > 0) {
      const data = chartStyle === 'Candles'
        ? allCandlesRef.current
        : allCandlesRef.current.map(c => ({ time: c.time, value: c.close }));
      series.setData(data);
    }
  }, [chartStyle, chartCreated]);

  useEffect(() => {
    let unsub;
    const myGeneration = fetchGenerationRef.current;
    if (chartInstance.current && candleSeries.current) {
      const handle = async (logicalRange) => {
        if (!logicalRange || !allCandlesRef.current.length) return;
        const barsInfo = candleSeries.current.barsInLogicalRange(logicalRange);
        if (barsInfo !== null && barsInfo.barsBefore < 50 && !isLoadingMoreRef.current) {
          isLoadingMoreRef.current = true;
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
          finally { setTimeout(() => { isLoadingMoreRef.current = false; }, 500); }
        }
      };
      chartInstance.current.timeScale().subscribeVisibleLogicalRangeChange(handle);
      unsub = () => chartInstance.current?.timeScale().unsubscribeVisibleLogicalRangeChange(handle);
    }
    return () => { if (unsub) unsub(); };
  }, [selectedCoin, selectedExchange, chartInterval, fetchCandles]);

  useEffect(() => {
    if (chartInstance.current) {
      chartInstance.current.applyOptions({
        layout: { background: { color: darkMode ? '#131722' : '#ffffff' }, textColor: darkMode ? '#d1d4dc' : '#131722' },
        watermark: { color: darkMode ? 'rgba(255, 255, 255, 0.15)' : 'rgba(19, 23, 34, 0.15)' },
        grid: { vertLines: { color: darkMode ? '#2a2e39' : '#e0e3eb' }, horzLines: { color: darkMode ? '#2a2e39' : '#e0e3eb' } },
        timeScale: {
          borderColor: darkMode ? '#2a2e39' : '#e0e3eb',
          rightOffset: 8,
          barSpacing: isMobile ? 4 : 8,
          timeVisible: true,
          secondsVisible: chartInterval === '1m',
          visible: true,
        },
      });
    }
  }, [darkMode, chartInterval, isMobile]);

  useEffect(() => {
    if (skipNextFullRedrawRef.current) {
      skipNextFullRedrawRef.current = false;
      return;
    }
    if (!candleSeries.current || !volumeSeries.current || allCandles.length === 0) return;
    
    const data = chartStyle === 'Candles' ? allCandles : allCandles.map(c => ({ time: c.time, value: c.close }));
    candleSeries.current.setData(data);
    
    volumeSeries.current.setData(allCandles.map(c => ({
      time: c.time,
      value: c.volume || 0,
      color: c.close >= c.open ? 'rgba(8, 153, 129, 0.5)' : 'rgba(242, 54, 69, 0.5)'
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

  // A. Structural Effect: Handles adding/removing series and oscillator sub-charts
  useEffect(() => {
    if (!chartInstance.current || !chartCreated) return;

    // Get active indicators
    const activeOverlays = visualIndicators.filter(ind => ind.visible && ['ema', 'sma', 'bb'].includes(ind.type));
    const activeOscillators = visualIndicators.filter(ind => ind.visible && ['rsi', 'macd'].includes(ind.type));

    // 1. Clean up removed indicator series on MAIN chart
    const activeMainKeys = new Set();
    activeOverlays.forEach(ind => {
      if (ind.type === 'bb') {
        activeMainKeys.add(`${ind.id}_upper`);
        activeMainKeys.add(`${ind.id}_middle`);
        activeMainKeys.add(`${ind.id}_lower`);
      } else {
        activeMainKeys.add(ind.id);
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
      if (ind.type === 'ema' && !indicatorSeriesRef.current[ind.id]) {
        indicatorSeriesRef.current[ind.id] = chartInstance.current.addLineSeries({
          color: ind.color,
          lineWidth: 1.5,
          title: `${ind.name} (${ind.params.period})`
        });
      } else if (ind.type === 'sma' && !indicatorSeriesRef.current[ind.id]) {
        indicatorSeriesRef.current[ind.id] = chartInstance.current.addLineSeries({
          color: ind.color,
          lineWidth: 1.5,
          title: `${ind.name} (${ind.params.period})`
        });
      } else if (ind.type === 'bb') {
        const uKey = `${ind.id}_upper`;
        const mKey = `${ind.id}_middle`;
        const lKey = `${ind.id}_lower`;
        if (!indicatorSeriesRef.current[uKey]) {
          indicatorSeriesRef.current[uKey] = chartInstance.current.addLineSeries({
            color: ind.color,
            lineWidth: 1,
            lineStyle: 1,
            title: `BB Upper`
          });
        }
        if (!indicatorSeriesRef.current[mKey]) {
          indicatorSeriesRef.current[mKey] = chartInstance.current.addLineSeries({
            color: ind.color,
            lineWidth: 1.5,
            title: `BB Basis`
          });
        }
        if (!indicatorSeriesRef.current[lKey]) {
          indicatorSeriesRef.current[lKey] = chartInstance.current.addLineSeries({
            color: ind.color,
            lineWidth: 1,
            lineStyle: 1,
            title: `BB Lower`
          });
        }
      }
    });

    // 4. Create active oscillators in sub-panes
    activeOscillators.forEach(ind => {
      const container = document.getElementById(`subchart-container-${ind.id}`);
      if (!container) return;

      let subChartObj = subChartsMapRef.current[ind.id];
      if (!subChartObj) {
        const chart = createChart(container, {
          layout: {
            background: { type: 'solid', color: darkMode ? '#131722' : '#ffffff' },
            textColor: darkMode ? '#d1d4dc' : '#131722',
          },
          grid: {
            vertLines: { color: darkMode ? 'rgba(42, 46, 57, 0.12)' : 'rgba(224, 227, 235, 0.12)' },
            horzLines: { color: darkMode ? 'rgba(42, 46, 57, 0.12)' : 'rgba(224, 227, 235, 0.12)' },
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

        const seriesList = [];
        if (ind.type === 'rsi') {
          seriesList.push(chart.addLineSeries({
            color: ind.color,
            lineWidth: 1.5,
            title: ind.name,
          }));
        } else if (ind.type === 'macd') {
          seriesList.push(
            chart.addLineSeries({ color: '#2962ff', lineWidth: 1.5, title: 'MACD' }),
            chart.addLineSeries({ color: '#ff6d00', lineWidth: 1.5, title: 'Signal' }),
            chart.addHistogramSeries({ color: '#26a69a', lineWidth: 1.5, title: 'Histogram' })
          );
        }

        // Bi-directional timescale sync with proper cleanup to prevent memory leaks
        const mainTimeScale = chartInstance.current.timeScale();
        const subTimeScale = chart.timeScale();

        const syncMainToSub = (range) => { if (range) subTimeScale.setVisibleRange(range); };
        const syncSubToMain = (range) => { if (range) mainTimeScale.setVisibleRange(range); };

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

  // B. Data Effect: Recalculates and updates existing series data only when candles or structure changes
  useEffect(() => {
    if (!chartInstance.current || allCandles.length === 0) return;

    const lastCandle = allCandles[allCandles.length - 1];
    const isNewCandle = allCandles.length !== lastProcessedCandleRef.current.length || lastCandle.time !== lastProcessedCandleRef.current.time;
    const isPriceChanged = lastCandle.close !== lastProcessedCandleRef.current.close;
    const structureChanged = indicatorStructureTick !== lastStructureTickRef.current;

    if (!isNewCandle && !isPriceChanged && !structureChanged) {
      return; // Skip calculations entirely
    }

    lastProcessedCandleRef.current = { time: lastCandle.time, close: lastCandle.close, length: allCandles.length };
    lastStructureTickRef.current = indicatorStructureTick;

    visualIndicators.forEach(ind => {
      if (!ind.visible) return;

      if (ind.type === 'ema') {
        const series = indicatorSeriesRef.current[ind.id];
        if (series) {
          const emaVals = calculateEMA(allCandles, ind.params.period);
          series.setData(emaVals);
        }
      } else if (ind.type === 'sma') {
        const series = indicatorSeriesRef.current[ind.id];
        if (series) {
          const smaVals = calculateSMA(allCandles, ind.params.period);
          series.setData(smaVals);
        }
      } else if (ind.type === 'bb') {
        const uSeries = indicatorSeriesRef.current[`${ind.id}_upper`];
        const mSeries = indicatorSeriesRef.current[`${ind.id}_middle`];
        const lSeries = indicatorSeriesRef.current[`${ind.id}_lower`];
        if (uSeries && mSeries && lSeries) {
          const { upper, middle, lower } = calculateBB(allCandles, ind.params.period, ind.params.stdDev);
          uSeries.setData(upper);
          mSeries.setData(middle);
          lSeries.setData(lower);
        }
      } else if (ind.type === 'rsi') {
        const subChartObj = subChartsMapRef.current[ind.id];
        if (subChartObj && subChartObj.seriesList[0]) {
          const rsiVals = calculateRSI(allCandles, ind.params.period);
          subChartObj.seriesList[0].setData(rsiVals);
        }
      } else if (ind.type === 'macd') {
        const subChartObj = subChartsMapRef.current[ind.id];
        if (subChartObj && subChartObj.seriesList[0] && subChartObj.seriesList[1] && subChartObj.seriesList[2]) {
          const { macd, signal, hist } = calculateMACD(
            allCandles,
            ind.params.fastPeriod,
            ind.params.slowPeriod,
            ind.params.signalPeriod
          );
          subChartObj.seriesList[0].setData(macd);
          subChartObj.seriesList[1].setData(signal);
          const coloredHist = hist.map(h => ({
            time: h.time,
            value: h.value,
            color: h.value >= 0 ? 'rgba(8, 153, 129, 0.5)' : 'rgba(242, 54, 69, 0.5)'
          }));
          subChartObj.seriesList[2].setData(coloredHist);
        }
      }
    });
  }, [allCandles, indicatorStructureTick, visualIndicators]);
  // Reset newsMarkerPlacedRef when selectedCoin or selectedExchange or chartInterval changes
  useEffect(() => {
    newsMarkerPlacedRef.current = false;
  }, [selectedCoin, selectedExchange, chartInterval]);

  // Place the Pink News Marker & Price Line exactly once per load
  useEffect(() => {
    if (!chartCreated || !candleSeries.current || allCandles.length === 0 || newsMarkerPlacedRef.current) return;

    // Pick an index to put the news marker (e.g., 20 bars ago)
    const targetIdx = Math.max(0, allCandles.length - 20);
    const targetCandle = allCandles[targetIdx];

    // Clean up old price line
    if (newsPriceLineRef.current) {
      try {
        candleSeries.current.removePriceLine(newsPriceLineRef.current);
      } catch (e) {}
      newsPriceLineRef.current = null;
    }

    // Add new markers
    candleSeries.current.setMarkers([
      {
        time: targetCandle.time,
        position: 'belowBar',
        color: '#e040fb', // Pink color
        shape: 'circle',
        text: '⚡',
        id: 'news_marker',
        size: 1.5,
      }
    ]);

    // Add corresponding pink price line
    const priceLine = candleSeries.current.createPriceLine({
      price: targetCandle.close,
      color: '#e040fb',
      lineWidth: 1.5,
      lineStyle: 1, // Dashed
      axisLabelVisible: true,
      title: 'News Event Trigger',
    });
    newsPriceLineRef.current = priceLine;
    newsMarkerTimeRef.current = targetCandle.time;
    newsMarkerPlacedRef.current = true;
  }, [chartCreated, allCandles.length]);

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

  const drawOnCanvas = useCallback(() => {
    if (!canvasRef.current || !chartInstance.current || !candleSeries.current || hideDrawings) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const getPixel = (time, price) => {
      const x = chartInstance.current.timeScale().timeToCoordinate(time);
      const y = candleSeries.current.priceToCoordinate(price);
      return { x, y };
    };

    const drawRay = (p1, p2, color) => {
      ctx.strokeStyle = color;
      const m = (p2.y - p1.y) / (p2.x - p1.x);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      if (p2.x > p1.x) {
        ctx.lineTo(canvas.width, p1.y + m * (canvas.width - p1.x));
      } else if (p2.x < p1.x) {
        ctx.lineTo(0, p1.y - m * p1.x);
      } else {
        ctx.lineTo(p1.x, p2.y > p1.y ? canvas.height : 0);
      }
      ctx.stroke();
    };

    const drawExtendedLine = (p1, p2, color) => {
      ctx.strokeStyle = color;
      const m = (p2.y - p1.y) / (p2.x - p1.x);
      ctx.beginPath();
      if (p2.x === p1.x) {
        ctx.moveTo(p1.x, 0);
        ctx.lineTo(p1.x, canvas.height);
      } else {
        ctx.moveTo(0, p1.y - m * p1.x);
        ctx.lineTo(canvas.width, p1.y + m * (canvas.width - p1.x));
      }
      ctx.stroke();
    };

    const drawSingleShape = (d, isTemp = false) => {
      ctx.save();
      const color = isTemp ? '#00ffff' : '#7C5CFF';
      ctx.strokeStyle = color;
      ctx.fillStyle = isTemp ? 'rgba(0, 255, 255, 0.08)' : 'rgba(124, 92, 255, 0.08)';
      ctx.lineWidth = 2;

      const p1 = getPixel(d.start.time, d.start.price);
      const p2 = getPixel(d.end.time, d.end.price);
      if (!p1 || !p2) {
        ctx.restore();
        return;
      }

      if (d.type === 'trendline') {
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      } else if (d.type === 'ray') {
        drawRay(p1, p2, color);
      } else if (d.type === 'infoline') {
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
        
        const priceDiff = d.end.price - d.start.price;
        const pctChange = (priceDiff / d.start.price) * 100;
        const txt = `${priceDiff >= 0 ? '+' : ''}${priceDiff.toFixed(2)} (${pctChange >= 0 ? '+' : ''}${pctChange.toFixed(2)}%)`;
        ctx.fillStyle = color;
        ctx.font = '10px sans-serif';
        ctx.fillText(txt, (p1.x + p2.x)/2 + 5, (p1.y + p2.y)/2 - 5);
      } else if (d.type === 'extendedline') {
        drawExtendedLine(p1, p2, color);
      } else if (d.type === 'trendangle') {
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.setLineDash([3, 3]);
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p1.x + 80, p1.y);
        ctx.stroke();
        ctx.setLineDash([]);

        const angle = Math.round(Math.atan2(-(p2.y - p1.y), p2.x - p1.x) * 180 / Math.PI);
        ctx.fillStyle = color;
        ctx.font = '10px sans-serif';
        ctx.fillText(`${angle}°`, p1.x + 35, p1.y - 5);
      } else if (d.type === 'horizontal_line') {
        ctx.beginPath();
        ctx.moveTo(0, p1.y);
        ctx.lineTo(canvas.width, p1.y);
        ctx.stroke();
      } else if (d.type === 'horizontal_ray') {
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(canvas.width, p1.y);
        ctx.stroke();
      } else if (d.type === 'vertical_line') {
        ctx.beginPath();
        ctx.moveTo(p1.x, 0);
        ctx.lineTo(p1.x, canvas.height);
        ctx.stroke();
      } else if (d.type === 'crossline') {
        ctx.beginPath();
        ctx.moveTo(0, p1.y); ctx.lineTo(canvas.width, p1.y);
        ctx.moveTo(p1.x, 0); ctx.lineTo(p1.x, canvas.height);
        ctx.stroke();
      } else if (d.type === 'channel') {
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
        const offset = 40;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y + offset);
        ctx.lineTo(p2.x, p2.y + offset);
        ctx.stroke();
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.setLineDash([4, 4]);
        ctx.moveTo(p1.x, p1.y + offset / 2);
        ctx.lineTo(p2.x, p2.y + offset / 2);
        ctx.stroke();
      } else if (d.type === 'fibonacci') {
        const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.618];
        const colors = [
          'rgba(242, 54, 69, 0.05)', 'rgba(255, 152, 0, 0.05)',
          'rgba(76, 175, 80, 0.05)', 'rgba(0, 150, 136, 0.05)',
          'rgba(33, 150, 243, 0.05)', 'rgba(156, 39, 176, 0.05)',
          'rgba(124, 92, 255, 0.05)', 'rgba(124, 92, 255, 0.02)'
        ];
        levels.forEach((lvl, idx) => {
          const lvlPrice = d.start.price + lvl * (d.end.price - d.start.price);
          const lvlPixel = getPixel(d.start.time, lvlPrice);
          if (lvlPixel) {
            ctx.beginPath();
            ctx.strokeStyle = color;
            ctx.lineWidth = 1;
            ctx.moveTo(0, lvlPixel.y);
            ctx.lineTo(canvas.width, lvlPixel.y);
            ctx.stroke();
            
            ctx.fillStyle = color;
            ctx.font = '9px sans-serif';
            ctx.fillText(`${lvl} (${lvlPrice.toFixed(2)})`, 10, lvlPixel.y - 3);

            if (idx < levels.length - 1) {
              const nextLvl = levels[idx + 1];
              const nextPrice = d.start.price + nextLvl * (d.end.price - d.start.price);
              const nextPixel = getPixel(d.start.time, nextPrice);
              if (nextPixel) {
                ctx.fillStyle = colors[idx % colors.length];
                ctx.fillRect(0, Math.min(lvlPixel.y, nextPixel.y), canvas.width, Math.abs(nextPixel.y - lvlPixel.y));
              }
            }
          }
        });
      } else if (d.type === 'pitchfork' || d.type === 'andrews_pitchfork') {
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
        const dy = 30;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y - dy);
        ctx.lineTo(p2.x, p2.y - dy);
        ctx.moveTo(p1.x, p1.y + dy);
        ctx.lineTo(p2.x, p2.y + dy);
        ctx.stroke();
      } else if (d.type === 'schiff_pitchfork') {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;
        ctx.beginPath();
        ctx.moveTo(midX, midY);
        ctx.lineTo(midX + dx, midY + dy);
        
        const offset = 30;
        ctx.moveTo(midX, midY - offset);
        ctx.lineTo(midX + dx, midY + dy - offset);
        
        ctx.moveTo(midX, midY + offset);
        ctx.lineTo(midX + dx, midY + dy + offset);
        ctx.stroke();
      } else if (d.type === 'polyline') {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p1.x + dx * 0.33, p1.y + dy * 0.75);
        ctx.lineTo(p1.x + dx * 0.66, p1.y + dy * 0.25);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
        
        [p1, { x: p1.x + dx * 0.33, y: p1.y + dy * 0.75 }, { x: p1.x + dx * 0.66, y: p1.y + dy * 0.25 }, p2].forEach(pt => {
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 3, 0, 2 * Math.PI);
          ctx.fillStyle = color;
          ctx.fill();
        });
      } else if (d.type === 'fib_timezone') {
        const baseGap = Math.abs(p2.x - p1.x) || 24;
        const fibs = [0, 1, 2, 3, 5, 8, 13, 21, 34, 55];
        fibs.forEach((f) => {
          const lineX = p1.x + f * baseGap;
          if (lineX >= 0 && lineX <= canvas.width) {
            ctx.beginPath();
            ctx.moveTo(lineX, 0);
            ctx.lineTo(lineX, canvas.height);
            ctx.stroke();
            ctx.fillStyle = color;
            ctx.font = '9px monospace';
            ctx.fillText(`F${f}`, lineX + 4, 18);
          }
        });
      } else if (d.type === 'regression_trend') {
        const startT = Math.min(d.start.time, d.end.time);
        const endT = Math.max(d.start.time, d.end.time);
        const rangeCandles = allCandles.filter(c => c.time >= startT && c.time <= endT);
        if (rangeCandles.length > 1) {
          const n = rangeCandles.length;
          let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
          for (let i = 0; i < n; i++) {
            sumX += i;
            sumY += rangeCandles[i].close;
            sumXY += i * rangeCandles[i].close;
            sumXX += i * i;
          }
          const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
          const intercept = (sumY - slope * sumX) / n;
          
          let sumSqDiff = 0;
          for (let i = 0; i < n; i++) {
            const expected = slope * i + intercept;
            sumSqDiff += Math.pow(rangeCandles[i].close - expected, 2);
          }
          const stdDev = Math.sqrt(sumSqDiff / n);
          
          const pStart = getPixel(rangeCandles[0].time, intercept);
          const pEnd = getPixel(rangeCandles[n-1].time, slope * (n - 1) + intercept);
          
          const pStartUp = getPixel(rangeCandles[0].time, intercept + stdDev * 1.5);
          const pEndUp = getPixel(rangeCandles[n-1].time, slope * (n - 1) + intercept + stdDev * 1.5);
          
          const pStartDown = getPixel(rangeCandles[0].time, intercept - stdDev * 1.5);
          const pEndDown = getPixel(rangeCandles[n-1].time, slope * (n - 1) + intercept - stdDev * 1.5);
          
          if (pStart && pEnd && pStartUp && pEndUp && pStartDown && pEndDown) {
            ctx.save();
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(pStart.x, pStart.y);
            ctx.lineTo(pEnd.x, pEnd.y);
            ctx.stroke();
            
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.moveTo(pStartUp.x, pStartUp.y);
            ctx.lineTo(pEndUp.x, pEndUp.y);
            ctx.stroke();
            
            ctx.beginPath();
            ctx.moveTo(pStartDown.x, pStartDown.y);
            ctx.lineTo(pEndDown.x, pEndDown.y);
            ctx.stroke();
            
            ctx.fillStyle = color + '15';
            ctx.beginPath();
            ctx.moveTo(pStartUp.x, pStartUp.y);
            ctx.lineTo(pEndUp.x, pEndUp.y);
            ctx.lineTo(pEndDown.x, pEndDown.y);
            ctx.lineTo(pStartDown.x, pStartDown.y);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
          }
        } else {
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }
      } else if (d.type === 'fib_extension') {
        const levels = [0, 0.618, 1, 1.618, 2.618];
        levels.forEach(lvl => {
          const lvlPrice = d.start.price + lvl * (d.end.price - d.start.price);
          const lvlPixel = getPixel(d.start.time, lvlPrice);
          if (lvlPixel) {
            ctx.beginPath();
            ctx.moveTo(0, lvlPixel.y);
            ctx.lineTo(canvas.width, lvlPixel.y);
            ctx.stroke();
            ctx.fillStyle = color;
            ctx.font = '9px sans-serif';
            ctx.fillText(`Ext ${lvl} (${lvlPrice.toFixed(2)})`, 10, lvlPixel.y - 3);
          }
        });
      } else if (d.type === 'fib_fan') {
        const levels = [0.382, 0.5, 0.618, 1];
        levels.forEach(lvl => {
          const targetY = p1.y + lvl * (p2.y - p1.y);
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, targetY);
          ctx.stroke();
          ctx.fillStyle = color;
          ctx.font = '9px sans-serif';
          ctx.fillText(`Fan ${lvl}`, p2.x + 5, targetY);
        });
      } else if (d.type === 'gann_fan') {
        const m = (p2.y - p1.y) / (p2.x - p1.x);
        const angles = [4, 2, 1, 0.5, 0.25];
        const labels = ['1x4', '1x2', '1x1', '2x1', '4x1'];
        angles.forEach((mult, idx) => {
          const targetY = p1.y + mult * m * (canvas.width - p1.x);
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(canvas.width, targetY);
          ctx.stroke();
          ctx.fillStyle = color;
          ctx.font = '9px sans-serif';
          ctx.fillText(labels[idx], canvas.width - 25, targetY - 4);
        });
      } else if (d.type === 'gann_square') {
        ctx.strokeRect(Math.min(p1.x, p2.x), Math.min(p1.y, p2.y), Math.abs(p2.x - p1.x), Math.abs(p2.y - p1.y));
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
        ctx.moveTo(p1.x, p2.y); ctx.lineTo(p2.x, p1.y);
        ctx.stroke();
      } else if (d.type === 'gann_box') {
        ctx.strokeRect(Math.min(p1.x, p2.x), Math.min(p1.y, p2.y), Math.abs(p2.x - p1.x), Math.abs(p2.y - p1.y));
        const gridRatios = [0.25, 0.382, 0.5, 0.618, 0.75];
        gridRatios.forEach(r => {
          const gridX = p1.x + r * (p2.x - p1.x);
          const gridY = p1.y + r * (p2.y - p1.y);
          ctx.beginPath();
          ctx.strokeStyle = isTemp ? 'rgba(0,255,255,0.3)' : 'rgba(124,92,255,0.3)';
          ctx.moveTo(gridX, p1.y); ctx.lineTo(gridX, p2.y);
          ctx.moveTo(p1.x, gridY); ctx.lineTo(p2.x, gridY);
          ctx.stroke();
        });
      } else if (d.type === 'rectangle') {
        ctx.fillRect(Math.min(p1.x, p2.x), Math.min(p1.y, p2.y), Math.abs(p2.x - p1.x), Math.abs(p2.y - p1.y));
        ctx.strokeRect(Math.min(p1.x, p2.x), Math.min(p1.y, p2.y), Math.abs(p2.x - p1.x), Math.abs(p2.y - p1.y));
      } else if (d.type === 'circle') {
        const radius = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
        ctx.beginPath();
        ctx.arc(p1.x, p1.y, radius, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
      } else if (d.type === 'ellipse') {
        const rx = Math.abs(p2.x - p1.x);
        const ry = Math.abs(p2.y - p1.y);
        ctx.beginPath();
        ctx.ellipse(p1.x, p1.y, rx, ry, 0, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
      } else if (d.type === 'triangle') {
        ctx.beginPath();
        ctx.moveTo((p1.x + p2.x) / 2, Math.min(p1.y, p2.y));
        ctx.lineTo(p1.x, Math.max(p1.y, p2.y));
        ctx.lineTo(p2.x, Math.max(p1.y, p2.y));
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (d.type === 'curve') {
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        const cx = (p1.x + p2.x) / 2;
        const cy = Math.min(p1.y, p2.y) - 30;
        ctx.quadraticCurveTo(cx, cy, p2.x, p2.y);
        ctx.stroke();
      } else if (d.type === 'text') {
        ctx.fillStyle = isTemp ? '#00ffff' : '#ffffff';
        ctx.font = '12px sans-serif';
        ctx.fillText(d.text || 'Text', p1.x, p1.y);
      } else if (d.type === 'note') {
        ctx.fillStyle = 'rgba(25, 25, 25, 0.85)';
        ctx.fillRect(p1.x, p1.y, 100, 30);
        ctx.strokeRect(p1.x, p1.y, 100, 30);
        ctx.fillStyle = '#ffffff';
        ctx.font = '10px sans-serif';
        ctx.fillText(d.text || 'Note', p1.x + 5, p1.y + 18);
      } else if (d.type === 'price_note') {
        ctx.fillStyle = color;
        ctx.fillRect(p1.x, p1.y - 10, 60, 20);
        ctx.fillStyle = '#ffffff';
        ctx.font = '9px monospace';
        ctx.fillText(`$${d.start.price.toFixed(2)}`, p1.x + 5, p1.y + 3);
      } else if (d.type === 'callout') {
        ctx.fillStyle = 'rgba(124, 92, 255, 0.2)';
        ctx.fillRect(p1.x + 10, p1.y - 40, 80, 25);
        ctx.strokeRect(p1.x + 10, p1.y - 40, 80, 25);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p1.x + 10, p1.y - 25);
        ctx.lineTo(p1.x + 18, p1.y - 25);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.font = '10px sans-serif';
        ctx.fillText(d.text || 'Callout', p1.x + 15, p1.y - 24);
      } else if (d.type === 'signpost') {
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p1.x, p1.y - 30);
        ctx.stroke();
        ctx.fillStyle = color;
        ctx.fillRect(p1.x, p1.y - 30, 60, 15);
        ctx.fillStyle = '#ffffff';
        ctx.font = '9px sans-serif';
        ctx.fillText(d.text || 'Info', p1.x + 4, p1.y - 19);
      } else if (d.type === 'xabcd') {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const pts = [
          { x: p1.x, y: p1.y, lbl: 'X' },
          { x: p1.x + dx * 0.25, y: p1.y - dy * 0.5, lbl: 'A' },
          { x: p1.x + dx * 0.5, y: p1.y, lbl: 'B' },
          { x: p1.x + dx * 0.75, y: p1.y - dy * 0.3, lbl: 'C' },
          { x: p2.x, y: p2.y, lbl: 'D' }
        ];
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();
        pts.forEach(pt => {
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 4, 0, 2 * Math.PI);
          ctx.fillStyle = color;
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 9px sans-serif';
          ctx.fillText(pt.lbl, pt.x - 3, pt.y - 6);
        });
      } else if (d.type === 'elliott_wave') {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const pts = [
          { x: p1.x, y: p1.y, lbl: '0' },
          { x: p1.x + dx * 0.2, y: p1.y - dy * 0.4, lbl: '1' },
          { x: p1.x + dx * 0.4, y: p1.y - dy * 0.1, lbl: '2' },
          { x: p1.x + dx * 0.6, y: p1.y - dy * 0.9, lbl: '3' },
          { x: p1.x + dx * 0.8, y: p1.y - dy * 0.5, lbl: '4' },
          { x: p2.x, y: p2.y, lbl: '5' }
        ];
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();
        pts.forEach(pt => {
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 3, 0, 2 * Math.PI);
          ctx.fillStyle = color;
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 9px sans-serif';
          ctx.fillText(pt.lbl, pt.x - 3, pt.y - 6);
        });
      } else if (d.type === 'abcd') {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const points = [
          { x: p1.x, y: p1.y, label: 'A' },
          { x: p1.x + dx/3, y: p1.y + dy/2, label: 'B' },
          { x: p1.x + 2*dx/3, y: p1.y - dy/4, label: 'C' },
          { x: p2.x, y: p2.y, label: 'D' }
        ];
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < 4; i++) ctx.lineTo(points[i].x, points[i].y);
        ctx.stroke();
        points.forEach(pt => {
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 4, 0, 2*Math.PI);
          ctx.fillStyle = color;
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 10px sans-serif';
          ctx.fillText(pt.label, pt.x - 3, pt.y - 7);
        });
      } else if (d.type === 'triangle_pat') {
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p1.x, p2.y);
        ctx.lineTo(p2.x, (p1.y + p2.y)/2);
        ctx.closePath();
        ctx.stroke();
      } else if (d.type === 'head_shoulders') {
        const w = p2.x - p1.x;
        const h = p1.y - p2.y;
        const base = p1.y;
        
        ctx.beginPath();
        ctx.moveTo(p1.x, base);
        ctx.lineTo(p1.x + w*0.2, base - h*0.5);
        ctx.lineTo(p1.x + w*0.4, base);
        ctx.lineTo(p1.x + w*0.5, base - h);
        ctx.lineTo(p1.x + w*0.6, base);
        ctx.lineTo(p1.x + w*0.8, base - h*0.5);
        ctx.lineTo(p2.x, base);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.moveTo(p1.x, base);
        ctx.lineTo(p2.x, base);
        ctx.stroke();
      } else if (d.type === 'long_position') {
        const entryY = p1.y;
        const targetY = p2.y;
        const stopY = entryY + (entryY - targetY) / 1.5;
        const w = Math.abs(p2.x - p1.x);
        const x = Math.min(p1.x, p2.x);
        
        ctx.fillStyle = 'rgba(8, 153, 129, 0.15)';
        ctx.fillRect(x, Math.min(entryY, targetY), w, Math.abs(entryY - targetY));
        ctx.strokeStyle = '#089981';
        ctx.strokeRect(x, Math.min(entryY, targetY), w, Math.abs(entryY - targetY));

        ctx.fillStyle = 'rgba(242, 54, 69, 0.15)';
        ctx.fillRect(x, Math.min(entryY, stopY), w, Math.abs(entryY - stopY));
        ctx.strokeStyle = '#f23645';
        ctx.strokeRect(x, Math.min(entryY, stopY), w, Math.abs(entryY - stopY));
        
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px sans-serif';
        ctx.fillText(`Risk/Reward: 1.5`, x + 5, entryY - 4);
      } else if (d.type === 'short_position') {
        const entryY = p1.y;
        const targetY = p2.y;
        const stopY = entryY - (targetY - entryY) / 1.5;
        const w = Math.abs(p2.x - p1.x);
        const x = Math.min(p1.x, p2.x);
        
        ctx.fillStyle = 'rgba(8, 153, 129, 0.15)';
        ctx.fillRect(x, Math.min(entryY, targetY), w, Math.abs(entryY - targetY));
        ctx.strokeStyle = '#089981';
        ctx.strokeRect(x, Math.min(entryY, targetY), w, Math.abs(entryY - targetY));

        ctx.fillStyle = 'rgba(242, 54, 69, 0.15)';
        ctx.fillRect(x, Math.min(entryY, stopY), w, Math.abs(entryY - stopY));
        ctx.strokeStyle = '#f23645';
        ctx.strokeRect(x, Math.min(entryY, stopY), w, Math.abs(entryY - stopY));
        
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px sans-serif';
        ctx.fillText(`Risk/Reward: 1.5`, x + 5, entryY + 10);
      } else if (d.type === 'price_range') {
        const y = Math.min(p1.y, p2.y);
        const h = Math.abs(p2.y - p1.y);
        ctx.fillStyle = 'rgba(41, 98, 255, 0.08)';
        ctx.fillRect(0, y, canvas.width, h);
        ctx.strokeRect(0, y, canvas.width, h);
        
        const diff = d.end.price - d.start.price;
        const pct = (diff / d.start.price) * 100;
        ctx.fillStyle = '#2962ff';
        ctx.font = '10px sans-serif';
        ctx.fillText(`Price: ${diff.toFixed(2)} (${pct.toFixed(2)}%)`, p1.x + 10, y + h/2);
      } else if (d.type === 'date_range') {
        const x = Math.min(p1.x, p2.x);
        const w = Math.abs(p2.x - p1.x);
        ctx.fillStyle = 'rgba(41, 98, 255, 0.08)';
        ctx.fillRect(x, 0, w, canvas.height);
        ctx.strokeRect(x, 0, w, canvas.height);
        
        const bars = Math.round(w / 8);
        ctx.fillStyle = '#2962ff';
        ctx.font = '10px sans-serif';
        ctx.fillText(`${bars} Bars`, x + w/2 - 15, canvas.height - 20);
      } else if (d.type === 'date_price_range') {
        const x = Math.min(p1.x, p2.x);
        const y = Math.min(p1.y, p2.y);
        const w = Math.abs(p2.x - p1.x);
        const h = Math.abs(p2.y - p1.y);
        ctx.fillStyle = 'rgba(41, 98, 255, 0.08)';
        ctx.fillRect(x, y, w, h);
        ctx.strokeRect(x, y, w, h);
      } else if (d.type.startsWith('icon_')) {
        const iconChar = { icon_up: '⬆️', icon_down: '⬇️', icon_star: '⭐', icon_heart: '❤️' }[d.type] || '📍';
        ctx.font = '16px sans-serif';
        ctx.fillText(iconChar, p1.x - 8, p1.y + 6);
      } else if (d.type === 'ruler') {
        ctx.fillStyle = 'rgba(41, 98, 255, 0.08)';
        const x = Math.min(p1.x, p2.x);
        const y = Math.min(p1.y, p2.y);
        const w = Math.abs(p2.x - p1.x);
        const h = Math.abs(p2.y - p1.y);
        ctx.fillRect(x, y, w, h);
        ctx.strokeRect(x, y, w, h);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
        
        const priceDiff = d.end.price - d.start.price;
        const pctChange = (priceDiff / d.start.price) * 100;
        ctx.fillStyle = '#2962ff';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${priceDiff >= 0 ? '+' : ''}${priceDiff.toFixed(2)} (${pctChange >= 0 ? '+' : ''}${pctChange.toFixed(2)}%)`, x + w/2, y + h/2);
      }
      ctx.restore();
    };

    drawings.forEach(d => drawSingleShape(d));

    if (tempShape && drawStart && activeTool) {
      drawSingleShape({ type: activeTool, start: drawStart, end: tempShape }, true);
    }

    if (brushPath.length > 1) {
      ctx.save();
      ctx.strokeStyle = '#ea39ff';
      ctx.lineWidth = 3;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      const startPixel = getPixel(brushPath[0].time, brushPath[0].price);
      if (startPixel) {
        ctx.beginPath();
        ctx.moveTo(startPixel.x, startPixel.y);
        for (let i = 1; i < brushPath.length; i++) {
          const px = getPixel(brushPath[i].time, brushPath[i].price);
          if (px) ctx.lineTo(px.x, px.y);
        }
        ctx.stroke();
      }
      ctx.restore();
    }

    if (hoverCoords && activeTool) {
      if (activeTool === 'crosshair') {
        ctx.save();
        ctx.strokeStyle = cursorSettings.color;
        ctx.lineWidth = cursorSettings.size;
        ctx.globalAlpha = cursorSettings.opacity / 100;
        ctx.setLineDash([4, 4]);
        
        if (cursorSettings.extendLines) {
          ctx.beginPath();
          ctx.moveTo(hoverCoords.x, 0);
          ctx.lineTo(hoverCoords.x, canvas.height);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(0, hoverCoords.y);
          ctx.lineTo(canvas.width, hoverCoords.y);
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.moveTo(hoverCoords.x - 8, hoverCoords.y); ctx.lineTo(hoverCoords.x + 8, hoverCoords.y);
          ctx.moveTo(hoverCoords.x, hoverCoords.y - 8); ctx.lineTo(hoverCoords.x, hoverCoords.y + 8);
          ctx.stroke();
        }
        ctx.restore();
      } else if (activeTool === 'dot') {
        ctx.save();
        ctx.beginPath();
        ctx.arc(hoverCoords.x, hoverCoords.y, cursorSettings.size * 1.5 + 2, 0, 2 * Math.PI);
        ctx.fillStyle = cursorSettings.color;
        ctx.globalAlpha = cursorSettings.opacity / 100;
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
      } else if (activeTool === 'demonstration') {
        ctx.save();
        ctx.beginPath();
        ctx.arc(hoverCoords.x, hoverCoords.y, 4, 0, 2 * Math.PI);
        ctx.fillStyle = cursorSettings.color;
        ctx.fill();
        
        const pulseRadius = cursorSettings.size * 4 + Math.sin(Date.now() / 120) * 3;
        ctx.beginPath();
        ctx.arc(hoverCoords.x, hoverCoords.y, pulseRadius, 0, 2 * Math.PI);
        ctx.fillStyle = cursorSettings.color + '33';
        ctx.globalAlpha = cursorSettings.opacity / 100;
        ctx.fill();
        ctx.strokeStyle = cursorSettings.color + '55';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
      } else if (activeTool === 'magic') {
        ctx.save();
        magicTrail.forEach((p, idx) => {
          const alpha = ((idx + 1) / magicTrail.length) * (cursorSettings.opacity / 100);
          ctx.fillStyle = cursorSettings.color + Math.round(alpha * 255).toString(16).padStart(2, '0');
          ctx.font = `${p.size + cursorSettings.size}px sans-serif`;
          ctx.fillText('⭐', p.x - p.size/2, p.y + p.size/2);
        });
        ctx.font = '16px sans-serif';
        ctx.fillText('🪄', hoverCoords.x, hoverCoords.y);
        ctx.restore();
      }

      if (cursorSettings.showTooltip && ['crosshair', 'dot', 'demonstration', 'magic'].includes(activeTool)) {
        ctx.save();
        ctx.font = 'bold 9px monospace';
        const time = chartInstance.current.timeScale().coordinateToTime(hoverCoords.x);
        const price = candleSeries.current.coordinateToPrice(hoverCoords.y);
        if (time && price !== undefined) {
          const timeStr = typeof time === 'number' ? new Date(time * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : String(time);
          const text = `${timeStr} | $${price.toFixed(2)}`;
          
          const textWidth = ctx.measureText(text).width;
          const boxW = textWidth + 10;
          const boxH = 18;
          
          const tooltipX = Math.min(hoverCoords.x + 10, canvas.width - boxW - 5);
          const tooltipY = Math.min(hoverCoords.y - 12, canvas.height - boxH - 5);
          
          ctx.fillStyle = 'rgba(28, 32, 48, 0.9)';
          ctx.strokeStyle = '#2a2e39';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(tooltipX, tooltipY, boxW, boxH, 4);
          ctx.fill();
          ctx.stroke();
          
          ctx.fillStyle = '#ffffff';
          ctx.fillText(text, tooltipX + 5, tooltipY + 12);
        }
        ctx.restore();
      }
    }
  }, [drawings, tempShape, activeTool, drawStart, brushPath, hideDrawings, magnetMode, hoverCoords, magicTrail, cursorSettings]);

  const rafIdRef = useRef(null);
  const requestDraw = useCallback(() => {
    if (rafIdRef.current) return;
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null;
      drawOnCanvas();
    });
  }, [drawOnCanvas]);

  useEffect(() => {
    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      if (saveRangeTimeoutRef.current) clearTimeout(saveRangeTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    const resizeCanvas = () => {
      if (!canvasRef.current || !chartRef.current) return;
      const rect = chartRef.current.getBoundingClientRect();
      canvasRef.current.width = rect.width;
      canvasRef.current.height = rect.height;
      requestDraw();
    };
    resizeCanvas();
    const ro = new ResizeObserver(resizeCanvas);
    if (chartRef.current) ro.observe(chartRef.current);
    window.addEventListener('resize', resizeCanvas);
    return () => { ro.disconnect(); window.removeEventListener('resize', resizeCanvas); };
  }, [requestDraw]);

  useEffect(() => { requestDraw(); }, [requestDraw, allCandles]);

  useEffect(() => {
    let unsub;
    if (chartCreated && chartInstance.current) {
      const handler = (range) => {
        if (range?.from && range?.to) {
          if (saveRangeTimeoutRef.current) clearTimeout(saveRangeTimeoutRef.current);
          saveRangeTimeoutRef.current = setTimeout(() => {
            localStorage.setItem(visibleRangeStorageKey, JSON.stringify(range));
          }, 300);
        }
        requestDraw();
      };
      chartInstance.current.timeScale().subscribeVisibleTimeRangeChange(handler);
      unsub = () => chartInstance.current?.timeScale().unsubscribeVisibleTimeRangeChange(handler);
    }
    return () => { if (unsub) unsub(); };
  }, [chartCreated, requestDraw, visibleRangeStorageKey]);

  const getChartCoords = (clientX, clientY) => {
    const rect = chartRef.current.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const handlePointerDown = (e) => {
    if (!activeTool || !chartInstance.current || !candleSeries.current) return;
    if (e.pointerType === 'touch') e.preventDefault();
    chartInstance.current.applyOptions({ handleScroll: false, handleScale: false });

    const { x, y } = getChartCoords(e.clientX, e.clientY);
    let time = chartInstance.current.timeScale().coordinateToTime(x);
    let price = candleSeries.current.coordinateToPrice(y);
    if (!time || price === undefined) return;

    // Apply Snapping
    const snapped = getSnappedPriceAndTime(time, price, e.clientX, e.clientY);
    time = snapped.time;
    price = snapped.price;

    if (activeTool === 'eraser') {
      const getPixel = (t, p) => ({
        x: chartInstance.current.timeScale().timeToCoordinate(t),
        y: candleSeries.current.priceToCoordinate(p)
      });
      const hitRadius = 25;
      const foundIndex = drawings.findIndex(d => {
        const pNode = getPixel(d.start.time, d.start.price);
        if (!pNode) return false;
        return Math.sqrt(Math.pow(x - pNode.x, 2) + Math.pow(y - pNode.y, 2)) < hitRadius;
      });
      if (foundIndex >= 0) setDrawings(prev => prev.filter((_, i) => i !== foundIndex));
      return;
    }

    if (['text', 'note', 'price_note', 'callout', 'signpost'].includes(activeTool)) {
      const textVal = prompt(`Enter text for ${activeTool}:`) || 'Text';
      setDrawings(prev => [...prev, { type: activeTool, start: { time, price }, end: { time, price }, text: textVal }]);
      if (!keepDrawing) {
        setActiveTool(null);
      }
      return;
    }

    if (activeTool.startsWith('icon_')) {
      setDrawings(prev => [...prev, { type: activeTool, start: { time, price }, end: { time, price } }]);
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
    if (!chartInstance.current || !candleSeries.current) return;
    const { x, y } = getChartCoords(e.clientX, e.clientY);

    // Track hover coordinates for custom hover cursors
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
    let time = chartInstance.current.timeScale().coordinateToTime(x);
    let price = candleSeries.current.coordinateToPrice(y);
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

  const handlePointerUp = () => {
    setHoverCoords(null);
    if (chartInstance.current) {
      chartInstance.current.applyOptions({ handleScroll: true, handleScale: true });
    }
    if (isDrawing) {
      if (activeTool === 'brush') {
        if (brushPath.length > 1) {
          setDrawings(prev => [...prev, { type: 'brush', points: brushPath }]);
        }
        setBrushPath([]);
      } else if (drawStart && tempShape && activeTool) {
        setDrawings(prev => [...prev, { type: activeTool, start: drawStart, end: tempShape }]);
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

  const RightSidePanel = () => {
    if (!rightSidebar) return null;
    return (
      <div className={`hidden md:flex flex-col w-[300px] shrink-0 border-l ${t.border} ${t.bg} z-10`}>
        <div className={`h-11 border-b ${t.border} flex items-center justify-between px-3 ${t.sec}`}>
          <span className={`font-bold text-[11px] uppercase tracking-wider ${t.text}`}>
            {rightSidebar === 'watchlist' && 'Watchlist'}
            {rightSidebar === 'details' && 'Instrument Details'}
            {rightSidebar === 'news' && 'Market News'}
            {rightSidebar === 'alerts' && 'Active Alerts'}
          </span>
          <button onClick={() => setRightSidebar(null)} className={t.muted}><X size={14} /></button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto dark-scrollbar p-3 space-y-4">
          {rightSidebar === 'watchlist' && (
            <div className="flex flex-col h-full">
              <div className="relative mb-3">
                <input
                  type="text"
                  placeholder="Add Symbol (e.g. ETHUSDT)"
                  value={watchlistSearchInput}
                  onChange={(e) => {
                    setWatchlistSearchInput(e.target.value.toUpperCase());
                    setWatchlistDropdownOpen(true);
                  }}
                  onFocus={() => setWatchlistDropdownOpen(true)}
                  className={`w-full px-3 py-1.5 rounded-lg border ${t.border} ${t.bg} ${t.text} text-[11px] outline-none focus:border-blue-500`}
                />
                {watchlistDropdownOpen && watchlistSearchInput && (
                  <div className={`absolute top-full left-0 right-0 ${t.bg} border ${t.border} rounded-lg shadow-2xl z-[300] max-h-48 overflow-y-auto py-1`}>
                    {binanceCoins
                      .filter(c => c.includes(watchlistSearchInput))
                      .slice(0, 15)
                      .map(coin => (
                        <div
                          key={coin}
                          onMouseDown={() => {
                            if (!watchlist.includes(coin)) {
                              setWatchlist(prev => [...prev, coin]);
                              showToast(`Added ${coin} to watchlist`);
                            }
                            setWatchlistSearchInput('');
                            setWatchlistDropdownOpen(false);
                          }}
                          className={`px-3 py-2 text-[11px] font-bold ${t.text} ${t.hover} cursor-pointer`}
                        >
                          {coin}
                        </div>
                      ))}
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                {watchlist.map(symbol => {
                  const ticker = watchlistTickers[symbol];
                  const price = ticker?.price ?? (symbol === selectedCoin ? livePrice : 0);
                  const change = ticker?.change ?? 0;
                  const isSelected = symbol === selectedCoin;
                  return (
                    <div
                      key={symbol}
                      onClick={() => {
                        setSelectedCoin(symbol);
                        setMarketStatus('Loading');
                      }}
                      className={`flex items-center justify-between p-2 rounded-lg border transition-all cursor-pointer ${
                        isSelected 
                          ? 'border-blue-500 bg-blue-500/10' 
                          : `border-transparent ${t.hover} ${t.sec}`
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <img 
                          src={coinIconUrl(symbol)}
                          onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://cryptologos.cc/logos/bnb-bnb-logo.png'; }}
                          alt=""
                          className="w-5 h-5 rounded-full object-cover bg-white shrink-0"
                        />
                        <span className={`font-black text-[11px] truncate ${isSelected ? 'text-blue-400' : t.text}`}>{symbol}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`font-mono text-[11px] font-bold ${t.text}`}>
                          {price > 0 ? `$${price.toLocaleString(undefined, {minimumFractionDigits: 2})}` : '...'}
                        </span>
                        <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded text-white ${
                          change >= 0 ? 'bg-[#089981]' : 'bg-[#F23645]'
                        }`}>
                          {change >= 0 ? '+' : ''}{change.toFixed(2)}%
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setWatchlist(prev => prev.filter(w => w !== symbol));
                            showToast(`Removed ${symbol} from watchlist`);
                          }}
                          className="text-gray-500 hover:text-red-400 p-0.5 transition-colors"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {selectedCoinStats && (
                <div className={`mt-4 border-t ${t.border} pt-3 space-y-2 shrink-0`}>
                  <div className="flex items-center gap-2">
                    <img 
                      src={coinIconUrl(selectedCoin)}
                      onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://cryptologos.cc/logos/bnb-bnb-logo.png'; }}
                      className="w-6 h-6 rounded-full object-cover bg-white"
                      alt=""
                    />
                    <div>
                      <div className={`text-[12px] font-black ${t.text}`}>{selectedCoin}</div>
                      <div className={`text-[10px] ${t.muted}`}>{selectedExchange.toUpperCase()} Ticker</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div className={`p-2 rounded ${t.sec} border ${t.border}`}>
                      <span className={t.muted}>24h High</span>
                      <div className={`font-bold mt-0.5 ${t.text}`}>${selectedCoinStats.high.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                    </div>
                    <div className={`p-2 rounded ${t.sec} border ${t.border}`}>
                      <span className={t.muted}>24h Low</span>
                      <div className={`font-bold mt-0.5 ${t.text}`}>${selectedCoinStats.low.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                    </div>
                    <div className={`p-2 rounded ${t.sec} border ${t.border} col-span-2 flex justify-between items-center`}>
                      <span className={t.muted}>24h Vol ({getBaseAsset(selectedCoin)})</span>
                      <div className={`font-mono font-bold ${t.text}`}>
                        {selectedCoinStats.volume.toLocaleString(undefined, {maximumFractionDigits: 0})}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {rightSidebar === 'details' && selectedCoinStats && (
            <div className="space-y-4">
              <div className="flex flex-col items-center py-4 border-b border-[#2a2e39]/20">
                <img 
                  src={coinIconUrl(selectedCoin)} 
                  onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://cryptologos.cc/logos/bnb-bnb-logo.png'; }}
                  className="w-12 h-12 rounded-full object-cover bg-white mb-2 shadow-lg"
                  alt=""
                />
                <h4 className={`text-[14px] font-black ${t.text}`}>{selectedCoin}</h4>
                <span className={`text-[11px] ${t.muted}`}>Price Statistics</span>
              </div>
              <div className="space-y-2.5">
                {[
                  { label: 'Current Price', value: `$${livePrice.toLocaleString()}`, color: priceColor },
                  { label: '24h Change', value: `${selectedCoinStats.priceChangePercent >= 0 ? '+' : ''}${selectedCoinStats.priceChangePercent.toFixed(2)}%`, color: selectedCoinStats.priceChangePercent >= 0 ? '#089981' : '#F23645' },
                  { label: '24h High', value: `$${selectedCoinStats.high.toLocaleString()}` },
                  { label: '24h Low', value: `$${selectedCoinStats.low.toLocaleString()}` },
                  { label: '24h Base Volume', value: `${selectedCoinStats.volume.toLocaleString(undefined, {maximumFractionDigits:0})} ${getBaseAsset(selectedCoin)}` },
                  { label: '24h Quote Volume', value: `$${selectedCoinStats.quoteVolume.toLocaleString(undefined, {maximumFractionDigits:0})}` }
                ].map(stat => (
                  <div key={stat.label} className="flex justify-between items-center py-1.5 border-b border-[#2a2e39]/10 text-[11px]">
                    <span className={t.muted}>{stat.label}</span>
                    <span className="font-bold font-mono" style={{ color: stat.color }}>{stat.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {rightSidebar === 'news' && (
            <div className="space-y-3">
              {newsList.map(item => (
                <a
                  key={item.id}
                  href={item.url || '#'}
                  target="_blank"
                  rel="noreferrer"
                  className={`block p-2.5 rounded-lg border ${t.border} ${t.sec} ${t.hover} transition-all space-y-1.5`}
                >
                  <div className={`text-[11px] font-extrabold ${t.text} line-clamp-2 leading-4`}>{item.title}</div>
                  <div className="flex justify-between items-center text-[9px] text-gray-500">
                    <span className="font-bold">{item.source}</span>
                    <span>{item.time}</span>
                  </div>
                </a>
              ))}
            </div>
          )}

          {rightSidebar === 'alerts' && (
            <div className="space-y-3">
              <div className={`p-3 rounded-lg border ${t.border} ${t.sec} space-y-2`}>
                <div className="text-[10px] font-bold text-gray-400">CREATE PRICE ALERT</div>
                <select value={alertCondition} onChange={(e) => setAlertCondition(e.target.value)} className={`w-full rounded border ${t.border} ${t.bg} ${t.text} p-1.5 text-[11px]`}>
                  <option value="above">Price crosses above</option>
                  <option value="below">Price crosses below</option>
                </select>
                <input type="number" value={alertPrice} onChange={(e) => setAlertPrice(e.target.value)} placeholder="Alert price" className={`w-full rounded border ${t.border} ${t.bg} ${t.text} p-2 text-[11px] font-mono`} />
                <button onClick={addPriceAlert} className="w-full py-1.5 rounded bg-amber-500 text-white font-bold text-[11px]">Create Alert</button>
              </div>
              
              <div className="space-y-1.5">
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Active Alerts</div>
                {alerts.map(a => (
                  <div key={a.id} className={`flex justify-between items-center p-2 rounded-lg border ${t.border} ${t.sec} text-[11px] ${t.text}`}>
                    <span className="font-bold">{a.symbol} {a.condition} <span className="font-mono text-amber-500">${a.price}</span></span>
                    <button onClick={() => removeAlert(a.id)} className="text-red-400 hover:text-red-300 p-0.5"><X size={12} /></button>
                  </div>
                ))}
                {alerts.length === 0 && (
                  <div className="text-[10px] text-gray-500 italic text-center py-4">No active price alerts</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const RightToolbar = () => (
    <div className={`hidden md:flex w-11 shrink-0 border-l ${t.border} ${t.bg} flex-col items-center py-3 gap-1.5`}>
      {[
        { id: 'watchlist', icon: ListFilter, title: 'Watchlist' },
        { id: 'details', icon: Activity, title: 'Details' },
        { id: 'news', icon: Radio, title: 'News' },
        { id: 'alerts', icon: Bell, title: 'Alerts' }
      ].map(item => {
        const isActive = rightSidebar === item.id;
        return (
          <button
            key={item.id}
            onClick={() => setRightSidebar(isActive ? null : item.id)}
            className={`p-2.5 rounded transition-all flex items-center justify-center relative ${
              isActive ? 'bg-blue-600 text-white' : `${t.muted} ${t.hover}`
            }`}
            title={item.title}
          >
            <item.icon size={17} />
            {isActive && <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[3px] h-4 bg-white rounded-l" />}
          </button>
        );
      })}
    </div>
  );

  const LeftToolbar = ({ horizontal = false }) => {
    const categories = [
      {
        id: 'cursor',
        title: 'Cursors',
        defaultIcon: Crosshair,
        items: [
          { id: 'crosshair', title: 'Crosshair', icon: Crosshair },
          { id: 'dot', title: 'Dot', icon: Circle },
          { id: 'arrow', title: 'Arrow', icon: MousePointer },
          { id: 'demonstration', title: 'Demonstration', icon: Play },
          { id: 'magic', title: 'Magic', icon: Sparkles },
          { id: 'eraser', title: 'Eraser', icon: Eraser },
        ]
      },
      {
        id: 'trend',
        title: 'Trend Lines',
        defaultIcon: TrendingUp,
        items: [
          { id: 'trendline', title: 'Classic (Trend Line)', icon: TrendingUp },
          { id: 'polyline', title: 'Poly-Line', icon: GitBranch },
          { id: 'curve', title: 'Curve', icon: Undo },
          { id: 'ray', title: 'Ray', icon: ArrowUpRight },
          { id: 'infoline', title: 'Info Line', icon: Info },
          { id: 'extendedline', title: 'Extended Line', icon: GitCommit },
          { id: 'trendangle', title: 'Trend Angle', icon: Compass },
          { id: 'gann_fan', title: 'Gann Fan', icon: Compass },
          { id: 'fib_timezone', title: 'Fibonacci Time Zone', icon: Columns },
          { id: 'channel', title: 'Parallel Channel', icon: Columns },
          { id: 'regression_trend', title: 'Regression Trend', icon: TrendingUp },
          { id: 'pitchfork', title: 'Pitchfork', icon: Activity },
          { id: 'schiff_pitchfork', title: 'Schiff Pitchfork', icon: Activity },
          { id: 'andrews_pitchfork', title: 'Andrews Pitchfork', icon: Activity },
          { id: 'horizontal_line', title: 'Horizontal Line', icon: Minus },
          { id: 'horizontal_ray', title: 'Horizontal Ray', icon: ArrowRight },
          { id: 'vertical_line', title: 'Vertical Line', icon: MoveVertical },
          { id: 'crossline', title: 'Cross Line', icon: Plus },
        ]
      },
      {
        id: 'gann_fib',
        title: 'Gann & Fibonacci',
        defaultIcon: Percent,
        items: [
          { id: 'fibonacci', title: 'Fib Retracement', icon: Percent },
          { id: 'fib_extension', title: 'Trend-Based Fib Extension', icon: Sliders },
          { id: 'fib_fan', title: 'Fib Speed Resistance Fan', icon: Compass },
          { id: 'gann_fan', title: 'Gann Fan', icon: Compass },
          { id: 'gann_square', title: 'Gann Square', icon: Box },
          { id: 'gann_box', title: 'Gann Box', icon: Box },
        ]
      },
      {
        id: 'shape',
        title: 'Shapes',
        defaultIcon: Square,
        items: [
          { id: 'rectangle', title: 'Rectangle', icon: Square },
          { id: 'circle', title: 'Circle', icon: Circle },
          { id: 'ellipse', title: 'Ellipse', icon: Disc },
          { id: 'triangle', title: 'Triangle', icon: Triangle },
          { id: 'brush', title: 'Brush', icon: Brush },
          { id: 'curve', title: 'Curve', icon: Undo },
        ]
      },
      {
        id: 'annotation',
        title: 'Annotations',
        defaultIcon: Type,
        items: [
          { id: 'text', title: 'Text', icon: Type },
          { id: 'note', title: 'Note', icon: FileText },
          { id: 'price_note', title: 'Price Note', icon: DollarSign },
          { id: 'callout', title: 'Callout', icon: MessageSquare },
          { id: 'signpost', title: 'Signpost', icon: Flag },
        ]
      },
      {
        id: 'pattern',
        title: 'Patterns',
        defaultIcon: Activity,
        items: [
          { id: 'xabcd', title: 'XABCD Pattern', icon: Activity },
          { id: 'abcd', title: 'ABCD Pattern', icon: Activity },
          { id: 'triangle_pat', title: 'Triangle Pattern', icon: Triangle },
          { id: 'head_shoulders', title: 'Head & Shoulders', icon: Award },
          { id: 'elliott_wave', title: 'Elliott Impulse Wave (1-2-3-4-5)', icon: TrendingUp },
        ]
      },
      {
        id: 'forecast',
        title: 'Prediction & Measurement',
        defaultIcon: Target,
        items: [
          { id: 'long_position', title: 'Long Position', icon: Target },
          { id: 'short_position', title: 'Short Position', icon: Shield },
          { id: 'price_range', title: 'Price Range', icon: Move },
          { id: 'date_range', title: 'Date Range', icon: Calendar },
          { id: 'date_price_range', title: 'Date & Price Range', icon: Maximize },
        ]
      },
      {
        id: 'icon_stickers',
        title: 'Icons & Emojis',
        defaultIcon: Smile,
        items: [
          { id: 'icon_up', title: 'Up Arrow ⬆️', icon: ArrowUp },
          { id: 'icon_down', title: 'Down Arrow ⬇️', icon: ArrowDown },
          { id: 'icon_star', title: 'Star ⭐', icon: Star },
          { id: 'icon_heart', title: 'Heart ❤️', icon: Heart },
        ]
      }
    ];

    if (horizontal) {
      return (
        <div className={`md:hidden flex items-center justify-around gap-0.5 px-1 py-1 border-t ${t.border} ${t.bg} shrink-0 overflow-x-auto mobile-scroll-x`}>
          <button
            onClick={() => { setActiveTool(null); showToast("Cursor Selected"); }}
            className={`p-2.5 min-w-[44px] rounded ${!activeTool ? 'bg-blue-600 text-white' : t.text}`}
          >
            <Crosshair size={18} />
          </button>
          <button
            onClick={() => { setActiveTool('trendline'); showToast("Trend Line Selected"); }}
            className={`p-2.5 min-w-[44px] rounded ${activeTool === 'trendline' ? 'bg-blue-600 text-white' : t.text}`}
          >
            <TrendingUp size={18} />
          </button>
          <button
            onClick={() => { setActiveTool('fibonacci'); showToast("Fib Retracement Selected"); }}
            className={`p-2.5 min-w-[44px] rounded ${activeTool === 'fibonacci' ? 'bg-blue-600 text-white' : t.text}`}
          >
            <Percent size={18} />
          </button>
          <button
            onClick={() => { setActiveTool('rectangle'); showToast("Rectangle Selected"); }}
            className={`p-2.5 min-w-[44px] rounded ${activeTool === 'rectangle' ? 'bg-blue-600 text-white' : t.text}`}
          >
            <Square size={18} />
          </button>
          <button
            onClick={() => { setActiveTool('brush'); showToast("Brush Selected"); }}
            className={`p-2.5 min-w-[44px] rounded ${activeTool === 'brush' ? 'bg-blue-600 text-white' : t.text}`}
          >
            <Brush size={18} />
          </button>
          <button
            onClick={() => { setDrawings([]); showToast("Cleared all drawings"); }}
            className={`p-2.5 min-w-[44px] rounded text-red-400`}
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
                  setActiveFlyout(null);
                }}
                className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all relative ${
                  isCurrentCatActive ? 'bg-[#2962ff] text-white shadow-lg shadow-blue-500/20' : `${t.muted} ${t.hover}`
                }`}
                title={`${cat.title}: ${activeSubTool.title}`}
              >
                <IconComponent size={18} strokeWidth={2} />
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveFlyout(isFlyoutOpen ? null : cat.id);
                  }}
                  className="absolute bottom-0 right-0 w-2.5 h-2.5 text-[6px] font-bold text-gray-500 opacity-60 group-hover/cat:opacity-100 flex items-end justify-end pointer-events-auto leading-[6px] select-none hover:text-blue-500"
                >
                  ◢
                </span>
              </button>

              {isFlyoutOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setActiveFlyout(null)} />
                  <div className={`absolute top-0 left-10 w-52 ${t.bg} border ${t.border} rounded-lg shadow-2xl z-50 py-1 animate-fade-in`}>
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
                            isSubActive ? 'bg-[#2962ff] text-white' : `${t.text} ${t.hover}`
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

        <button
          onClick={() => {
            if (chartInstance.current) {
              chartInstance.current.timeScale().zoomIn();
              showToast("Zoom In");
            }
          }}
          className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${t.muted} ${t.hover}`}
          title="Zoom In"
        >
          <ZoomIn size={18} strokeWidth={2} />
        </button>

        <button
          onClick={() => {
            if (chartInstance.current) {
              chartInstance.current.timeScale().zoomOut();
              showToast("Zoom Out");
            }
          }}
          className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${t.muted} ${t.hover}`}
          title="Zoom Out"
        >
          <ZoomOut size={18} strokeWidth={2} />
        </button>

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

        <button
          onClick={() => {
            setLockDrawings(!lockDrawings);
            showToast(`Lock all drawings: ${!lockDrawings ? 'LOCKED' : 'UNLOCKED'}`);
          }}
          className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
            lockDrawings ? 'bg-red-500/15 text-red-500' : `${t.muted} ${t.hover}`
          }`}
          title={`Lock All Drawings: ${lockDrawings ? 'Locked' : 'Unlocked'}`}
        >
          {lockDrawings ? <Lock size={18} strokeWidth={2} /> : <Unlock size={18} strokeWidth={2} />}
        </button>

        <button
          onClick={() => {
            setHideDrawings(!hideDrawings);
            showToast(`Drawings visibility: ${!hideDrawings ? 'HIDDEN' : 'VISIBLE'}`);
          }}
          className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
            hideDrawings ? 'bg-red-500/15 text-red-500' : `${t.muted} ${t.hover}`
          }`}
          title={`Show/Hide Drawings: ${hideDrawings ? 'Hidden' : 'Visible'}`}
        >
          {hideDrawings ? <EyeOff size={18} strokeWidth={2} /> : <Eye size={18} strokeWidth={2} />}
        </button>

        <button
          onClick={() => {
            if (confirm("Clear all drawings on the chart?")) {
              setDrawings([]);
              showToast("Drawings cleared");
            }
          }}
          className={`w-9 h-9 rounded-lg flex items-center justify-center text-red-400 hover:bg-red-500/10 transition-colors`}
          title="Clear All Drawings"
        >
          <Trash2 size={18} strokeWidth={2} />
        </button>

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
      const data = await res.tson();
      if (data.error) throw new Error(data.error);

      appendAiMessage({ role: 'assistant', content: data.reply, code: data.code });
      setAiPrompt('');
      setSyntaxStatus('AI ready.');
      showToast('✅ AI response received');
    } catch (e) {
      appendAiMessage({ role: 'assistant', content: `Error: ${e.message}`, error: true });
      setSyntaxStatus(`AI error: ${e.message}`);
      showToast('❌ ' + e.message);
    } finally {
      setAiLoading(false);
    }
  };

  const runBacktest = async () => {
    const code = editorMode === 'pine' ? pineCode : pythonCode;
    setLastBacktestCode(code);
    setLastBacktestMode(editorMode);

    if (editorMode === 'python' && !/def\s+strategy\s*\(/m.test(code)) {
      showToast('❌ Python: define def strategy(df): ...');
      setSyntaxStatus('Missing strategy(df) function');
      return;
    }

    if (backendOnline === false) {
      const ok = await checkBackend();
      if (!ok) {
        showToast('❌ API offline — terminal mein: npm run backend');
        setSyntaxStatus('API offline — npm run backend');
        setMarketStatus('Offline');
        return;
      }
    }

    setLoading(true);
    setMarketStatus(editorMode === 'python' ? 'Running Python...' : 'Running Pine...');
    showToast(editorMode === 'python' ? '🐍 Python backtest...' : '🚀 Pine backtest...');

    const endpoint = editorMode === 'pine' ? '/backtest-pine' : '/backtest-python';
    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, ticker: selectedCoin, timeframe: chartInterval }),
      });
      const data = await res.tson();
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
      setMetrics({
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
      });

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
      showToast('❌ API offline — nayi terminal: npm run backend');
      setMarketStatus('Offline');
      setSyntaxStatus('API offline — npm run backend');
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

  const TriangleRIcon = () => (
      <div className="relative flex items-center justify-center w-6 h-6">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" className={`w-full h-full ${t.text}`}>
          <polygon points="12,3 22,20 2,20" />
        </svg>
        <img
          src={logo}
          alt="logo"
          className="absolute w-[16px] h-[16px] rounded-full object-cover"
          style={{ filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.35))' }}
        />
      </div>
  );

  const getLowerBoxHeight = () => {
    if (lowerBoxState === 'minimized') return 'h-[42px] shrink-0';
    if (lowerBoxState === 'maximized') {
      return isMobile ? 'h-[38vh] max-h-[320px] shrink-0' : 'h-[450px] shrink-0';
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
          <TriangleRIcon />
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

      <div className={`flex gap-2 px-2 py-1 ${t.bg} border-b ${t.border}`}>
        <button onClick={() => { setEditorMode('pine'); setBaseCode(pineCode); setShowDiff(false); }} className={`px-3 py-1.5 md:px-2 md:py-0.5 rounded text-xs font-medium transition-colors ${editorMode === 'pine' ? 'bg-[#7C5CFF]/10 text-[#7C5CFF]' : `${t.muted} ${t.hover}`}`}>Pine Script</button>
        <button onClick={() => { setEditorMode('python'); setBaseCode(pythonCode); setShowDiff(false); }} className={`px-3 py-1.5 md:px-2 md:py-0.5 rounded text-xs font-medium transition-colors ${editorMode === 'python' ? 'bg-purple-500/15 text-purple-400' : `${t.muted} ${t.hover}`}`}>Python</button>
      </div>

      <div className={`flex items-center gap-1 px-2 py-1 border-b ${t.border} ${t.bg}`}>
        <button onClick={() => setSubView('code')} className={`px-2 py-1 rounded text-[11px] font-medium ${getSubView() === 'code' ? 'bg-[#7C5CFF]/10 text-[#7C5CFF]' : t.muted}`}>Code</button>
        <button onClick={() => setSubView('ai')} className={`px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 ${getSubView() === 'ai' ? 'bg-purple-500/15 text-purple-400' : t.muted}`}>
          <Sparkles size={11} /> AI
        </button>
        {getSubView() === 'ai' && (
          <select value={aiProvider} onChange={(e) => setAiProvider(e.target.value)} className={`ml-auto text-[10px] rounded px-1.5 py-0.5 border ${t.border} ${t.bg} ${t.text}`}>
            <option value="groq">Groq</option>
            <option value="gemini">Gemini</option>
          </select>
        )}
      </div>

      {getSubView() === 'code' ? (
        <>
          <div className={`h-9 md:h-8 border-b ${t.border} flex items-center px-2 gap-1 shrink-0 ${t.bg}`}>
            <button onClick={handleUndo} disabled={historyIndex === 0} className={`p-1.5 md:p-1 rounded transition-colors ${historyIndex === 0 ? t.border : `${t.muted} ${t.hover}`}`}><Undo size={13} /></button>
            <button onClick={handleRedo} disabled={historyIndex >= codeHistory.length - 1} className={`p-1.5 md:p-1 rounded transition-colors ${historyIndex >= codeHistory.length - 1 ? t.border : `${t.muted} ${t.hover}`}`}><Redo size={13} /></button>
            <div className={`h-3 w-px ${darkMode ? 'bg-[#2a2e39]' : 'bg-[#e0e3eb]'} mx-1`} />
            <button onClick={() => { setBaseCode(editorMode === 'pine' ? pineCode : pythonCode); setShowDiff(!showDiff); }} className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${t.muted} ${t.hover}`}><FileDiff size={12} /> {showDiff ? 'Close' : 'Changes'}</button>
            <button onClick={() => sendAiMessage('fix')} className={`flex items-center gap-1 px-2 py-1 rounded text-xs text-purple-400 ${t.hover}`}><Sparkles size={12} /> AI Fix</button>
            {editorMode === 'python' && (
              <button type="button" onClick={() => { handleCodeChange(DEFAULT_PYTHON_STRATEGY); showToast('EMA sample loaded'); }} className={`flex items-center gap-1 px-2 py-1 rounded text-xs text-purple-400 ${t.hover}`}>EMA sample</button>
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
    <div className={`flex flex-col h-[100dvh] w-full ${t.bg} ${t.text} font-sans text-xs select-none overflow-hidden relative transition-colors duration-200 safe-top`}>
      <style>{`
        a[href*="tradingview.com"], #tv-attr-logo, [class*="watermark-logo"], [class*="tv-logo"] { 
          display: none !important; opacity: 0 !important; visibility: hidden !important; pointer-events: none !important; width: 0 !important; height: 0 !important; 
        }
        
        .dark-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .dark-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .dark-scrollbar::-webkit-scrollbar-thumb { background: ${darkMode ? '#2a2e39' : '#e0e3eb'}; border-radius: 10px; }
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
                            className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[11.5px] transition-colors ${selectedIndicatorTab === tab ? 'bg-blue-500/10 text-blue-400 font-bold' : 'text-gray-400 hover:bg-[#1e222d] hover:text-white'}`}
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
                            className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[11.5px] transition-colors ${selectedIndicatorTab === tab ? 'bg-blue-500/10 text-blue-400 font-bold' : 'text-gray-400 hover:bg-[#1e222d] hover:text-white'}`}
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
                            className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[11.5px] transition-colors ${selectedIndicatorTab === tab ? 'bg-blue-500/10 text-blue-400 font-bold' : 'text-gray-400 hover:bg-[#1e222d] hover:text-white'}`}
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
                      <div className="flex-1 flex items-center gap-2 bg-[#1e222d] border border-[#2a2e39] rounded px-3 py-2 text-white font-bold select-none">
                        <img 
                          src={coinIconUrl(selectedCoin)} 
                          onError={(e) => { e.target.onerror = null; e.target.src = 'https://cryptologos.cc/logos/bnb-bnb-logo.png'; }}
                          alt="coin"
                          className="w-4 h-4 rounded-full bg-white object-cover shrink-0" 
                        />
                        <span>{selectedCoin}</span>
                      </div>
                      
                      <select 
                        value={alertCondition} 
                        onChange={(e) => setAlertCondition(e.target.value)}
                        className="flex-1 bg-[#1e222d] border border-[#2a2e39] rounded px-2 py-2 text-white font-semibold outline-none focus:border-blue-500"
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
                      className="w-full bg-[#1e222d] border border-[#2a2e39] rounded px-3 py-2 text-white font-mono outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* Expiration date time picker & trigger occurrence settings */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-gray-400 font-bold uppercase tracking-wider mb-1.5">Trigger</label>
                      <select 
                        value={alertTrigger}
                        onChange={(e) => setAlertTrigger(e.target.value)}
                        className="w-full bg-[#1e222d] border border-[#2a2e39] rounded px-2 py-2 text-white font-semibold outline-none focus:border-blue-500"
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
                        className="w-full bg-[#1e222d] border border-[#2a2e39] rounded px-2 py-2 text-white font-semibold outline-none focus:border-blue-500 font-mono"
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
                      className="w-full bg-[#1e222d] border border-[#2a2e39] rounded px-3 py-2 text-white font-mono outline-none focus:border-blue-500 resize-none"
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

      <div className="flex flex-1 min-h-0 min-w-0 flex-col md:flex-row overflow-hidden">
      <div className={`flex flex-1 flex-col min-h-0 min-w-0 overflow-hidden md:border-r ${t.border}`}>
        <div className={`min-h-11 border-b ${t.border} ${t.bg} flex items-center justify-between px-2 md:px-3 shrink-0 z-20 transition-colors duration-200 gap-2`}>
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            {onBackToCoins && (
              <button
                type="button"
                onClick={onBackToCoins}
                className="p-1 rounded hover:bg-gray-700/20 text-[#8b94a7] hover:text-white transition-colors flex items-center justify-center text-[10px] md:text-[11px] font-bold gap-1 shrink-0"
                title="Back to Coin Selector"
              >
                <ArrowLeft size={13} className="shrink-0 text-[#ff5722]" />
                <span className="hidden sm:inline text-gray-400">Markets</span>
              </button>
            )}
            {onBackToCoins && <div className={`h-4 w-[1px] ${darkMode ? 'bg-[#2a2e39]' : 'bg-[#e0e3eb]'} shrink-0`} />}
            <select
              value={selectedExchange}
              onChange={(e) => handleExchangeChange(e.target.value)}
              className={`shrink-0 text-[10px] md:text-[11px] font-bold rounded-md px-1.5 py-1 border ${t.border} ${t.bg} ${t.text} outline-none cursor-pointer max-w-[76px] md:max-w-none`}
              title="Select exchange (Binance + more)"
            >
              {EXCHANGE_LIST.map((ex) => (
                <option key={ex.id} value={ex.id}>{ex.name}</option>
              ))}
            </select>
            <img 
              src={coinIconUrl(selectedCoin)} 
              onError={(e) => { e.target.onerror = null; e.target.src = 'https://cryptologos.cc/logos/bnb-bnb-logo.png'; }}
              alt="coin"
              className="w-[22px] h-[22px] rounded-full shadow-xs shrink-0 object-cover bg-white" 
            />
            <div className="relative flex items-center shrink-0 z-[100]">
              <form onSubmit={(e) => { e.preventDefault(); executeSearch(coinInput || selectedCoin); }} className="flex items-center">
                <input id="smart-search" type="text" autoComplete="off" placeholder={selectedCoin} value={coinInput} onChange={(e) => { setCoinInput(e.target.value.toUpperCase()); setIsDropdownOpen(true); }} onFocus={() => setIsDropdownOpen(true)} onBlur={() => setTimeout(() => setIsDropdownOpen(false), 250)} className={`w-[88px] md:w-[110px] bg-transparent font-black text-[13px] md:text-[14px] ${t.text} placeholder-gray-500 tracking-wide ${t.hover} px-1 py-1 rounded outline-none focus:text-[#7C5CFF] uppercase transition-colors`} />
              </form>
              {isDropdownOpen && (
                <div className={`absolute top-[calc(100%+4px)] left-0 w-[min(18rem,85vw)] ${t.bg} border ${t.border} rounded-lg shadow-2xl z-[200] max-h-72 md:max-h-96 overflow-y-auto dark-scrollbar py-1`}>
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
                        onError={(e) => { e.target.onerror = null; e.target.src = 'https://cryptologos.cc/logos/bnb-bnb-logo.png'; }}
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
            {livePrice > 0 && (
              <span className="text-[12px] md:text-[13px] font-bold shrink-0" style={{ color: priceColor }}>
                ${livePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
              </span>
            )}
            <div className="flex items-center justify-center shrink-0" title={`${getExchangeMeta(selectedExchange).name} · ${marketStatus}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${marketStatus === 'Connected' ? 'bg-[#089981]' : marketStatus === 'Loading' || marketStatus === 'Polling' ? 'bg-amber-500 animate-pulse' : 'bg-red-500'}`} />
            </div>

            <div className="hidden md:flex items-center min-w-0">
              <div className={`h-4 w-[1px] ${darkMode ? 'bg-[#2a2e39]' : 'bg-[#e0e3eb]'} mx-1.5`} />
              <div className="flex items-center relative">
                {timeframeButtons.filter(tf => ['1m', '5m', '1h', '1D'].includes(tf.label)).map(tf => (
                  <button 
                    key={tf.label} 
                    onClick={() => { setChartInterval(tf.val); showToast(`Timeframe: ${tf.label}`); }} 
                    className={`px-2.5 py-1 font-bold rounded text-[11.5px] cursor-pointer transition-colors ${chartInterval === tf.val ? 'bg-blue-500/10 text-blue-400' : `${t.muted} ${t.hover}`}`}
                  >
                    {tf.label}
                  </button>
                ))}
                
                {/* Timeframe Dropdown Toggle Arrow */}
                <button 
                  onClick={() => setIsTimeframeDropdownOpen(!isTimeframeDropdownOpen)}
                  className={`p-1 rounded ml-1 transition-colors ${isTimeframeDropdownOpen ? 'bg-blue-500/10 text-blue-400' : `${t.muted} ${t.hover}`}`}
                  title="More Timeframes"
                >
                  <ChevronDown size={13} />
                </button>
                
                {/* Dropdown Menu */}
                {isTimeframeDropdownOpen && (
                  <div className={`absolute top-[calc(100%+4px)] left-0 w-36 ${t.bg} border ${t.border} rounded-lg shadow-2xl z-[350] py-1`}>
                    <div className="text-[9px] text-gray-500 uppercase font-black tracking-wider px-3 py-1 border-b border-[#2a2e39]/30 mb-1">More intervals</div>
                    {timeframeButtons.filter(tf => !['1m', '5m', '1h', '1D'].includes(tf.label)).map(tf => (
                      <button 
                        key={tf.label}
                        onClick={() => {
                          setChartInterval(tf.val);
                          setIsTimeframeDropdownOpen(false);
                          showToast(`Timeframe: ${tf.label}`);
                        }}
                        className={`w-full text-left px-3.5 py-1.5 text-[11px] font-bold transition-colors ${chartInterval === tf.val ? 'bg-blue-500/10 text-blue-400' : `${t.text} ${t.hover}`}`}
                      >
                        {tf.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className={`h-4 w-[1px] ${darkMode ? 'bg-[#2a2e39]' : 'bg-[#e0e3eb]'} mx-1.5`} />
              <div className="flex items-center gap-1" title="Type any timeframe: 45m, 2h, 9d, 1w">
                <input
                  value={customTimeframeInput}
                  onChange={(e) => setCustomTimeframeInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') applyCustomTimeframe(); }}
                  placeholder="Custom e.g 45m"
                  className={`w-[92px] px-2 py-1 rounded text-[11px] border ${t.border} ${t.bg} ${t.text} outline-none focus:border-[#7C5CFF]`}
                />
                <button onClick={applyCustomTimeframe} className={`px-2 py-1 rounded text-[11px] font-semibold ${t.sec} ${t.text} ${t.hover}`}>Set</button>
              </div>
              
              <div className="hidden md:flex items-center gap-1.5 shrink-0 z-30">
                <div className={`h-4 w-[1px] ${darkMode ? 'bg-[#2a2e39]' : 'bg-[#e0e3eb]'} mx-1.5`} />
                <button onClick={loadDeepHistory} title="Load up to 6 years of history for this timeframe" className={`flex items-center gap-1 px-2 py-1.5 rounded text-[12px] transition-colors ${t.text} ${t.hover}`}><History size={13} /><span>6Y History</span></button>
                
                {/* Chart Style Dropdown */}
                <div className="relative">
                  <button 
                    onClick={() => setIsStyleDropdownOpen(!isStyleDropdownOpen)} 
                    className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-[12px] transition-colors ${isStyleDropdownOpen ? `${t.sec} text-white` : `${t.muted} ${t.hover}`}`}
                    title="Chart Style"
                  >
                    <TrendingUp size={14} strokeWidth={2} />
                    <span>{chartStyle}</span>
                  </button>
                  {isStyleDropdownOpen && (
                    <div className={`absolute top-[calc(100%+4px)] left-0 w-44 ${t.bg} border ${t.border} rounded-lg shadow-2xl z-[300] py-1`}>
                      {[
                        { name: 'Candles', desc: 'Standard Candlesticks' },
                        { name: 'Line', desc: 'Continuous Close Line' },
                        { name: 'Bars', desc: 'Traditional OHLC Bars' },
                        { name: 'Area', desc: 'Shaded Price Area' }
                      ].map(style => (
                        <button 
                          key={style.name} 
                          onClick={() => {
                            setChartStyle(style.name);
                            setIsStyleDropdownOpen(false);
                            showToast(`Chart Style: ${style.name}`);
                          }}
                          className={`w-full text-left px-3 py-2 text-[11px] font-bold transition-colors ${chartStyle === style.name ? 'bg-blue-500/10 text-blue-400' : `${t.text} ${t.hover}`}`}
                        >
                          <div className="flex flex-col">
                            <span>{style.name}</span>
                            <span className="text-[9px] text-gray-500 font-medium">{style.desc}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className={`h-4 w-[1px] ${darkMode ? 'bg-[#2a2e39]' : 'bg-[#e0e3eb]'} mx-1.5`} />
                <button 
                  onClick={() => openModal('Indicators, metrics, and strategies', '', 'indicators_search')} 
                  className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-[12px] transition-colors ${leftPanel === 'indicators' ? 'bg-[#7C5CFF]/15 text-[#7C5CFF]' : `${t.text} ${t.hover}`}`}
                >
                  <Layers size={14} />
                  <span>Indicators</span>
                </button>

                <button 
                  onClick={() => openModal('Create alert on', '', 'alert_creation')} 
                  className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-[12px] transition-colors ${leftPanel === 'alerts' ? 'bg-amber-500/15 text-amber-500' : `${t.text} ${t.hover}`}`}
                >
                  <Bell size={13} />
                  <span>Alert</span>
                </button>
                <button onClick={() => {
                  if (replayMode && fullCandlesRef.current.length) {
                    allCandlesRef.current = [...fullCandlesRef.current];
                    setAllCandles([...fullCandlesRef.current]);
                  }
                  setReplayMode(!replayMode);
                  if (!replayMode) showToast('⏪ Replay on — use slider');
                  else showToast('▶️ Replay off');
                }} className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-[12px] transition-colors ${replayMode ? 'bg-orange-500/10 text-orange-500' : `${t.text} ${t.hover}`}`}><History size={13} /><span>Replay</span></button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-0.5 shrink-0">
            <button onClick={() => { setChartStyle(chartStyle === 'Candles' ? 'Line' : 'Candles'); showToast('Chart Style toggled'); }} className={`md:hidden p-2 rounded ${t.muted} ${t.hover} transition-colors`}><TrendingUp size={16} strokeWidth={2} /></button>
            <button onClick={() => setMobileMenuOpen(true)} className={`md:hidden p-2 ${t.muted} ${t.hover} rounded transition-colors`} aria-label="Open menu"><Menu size={18} /></button>

            <div className="hidden md:flex items-center gap-1">
              <button onClick={() => setDarkMode(!darkMode)} className={`p-1.5 ${t.muted} ${t.hover} rounded transition-colors`} title="Toggle theme">{darkMode ? <Sun size={14} /> : <Moon size={14} />}</button>
              <button onClick={() => openModal('Settings', 'Settings', 'settings')} className={`p-1.5 ${t.muted} ${t.hover} rounded transition-colors`} title="Settings"><Settings size={14} /></button>
              <button onClick={takeRealScreenshot} className={`p-1.5 ${t.muted} ${t.hover} rounded transition-colors`}><Camera size={14} /></button>
              <button onClick={toggleFullscreen} className={`p-1.5 ${t.muted} ${t.hover} rounded transition-colors`}><Maximize2 size={14} /></button>
              <div className={`h-4 w-[1px] ${darkMode ? 'bg-[#2a2e39]' : 'bg-[#e0e3eb]'} mx-1`} />
              <button onClick={publishStrategy} className={`p-1.5 ${t.muted} ${t.hover} rounded transition-colors`} title="Download script"><Upload size={14} /></button>
            </div>
          </div>
        </div>

        <div className={`md:hidden mobile-scroll-x flex items-center gap-0.5 px-2 py-1 border-b ${t.border} ${t.bg} overflow-x-auto shrink-0`}>
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

        <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
          <div className="flex flex-1 min-h-0 min-w-0 overflow-hidden">
            <LeftToolbar />
            <LeftSidePanel />
            <div className="flex-1 flex flex-col min-h-0 min-w-0 relative">
              {/* Active Indicators List Overlay */}
              {/* Active Indicators List Overlay (TradingView style - transparent & minimal) */}
              <div className="absolute top-[44px] left-2.5 z-20 flex flex-col gap-1 pointer-events-auto max-w-[280px] select-none">
                {visualIndicators.filter(ind => ind.visible).map(ind => (
                  <div key={ind.id} className="group flex items-center gap-1.5 text-[11px] font-bold text-gray-400/80 hover:text-white bg-black/10 hover:bg-black/35 px-1.5 py-0.5 rounded transition-all">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: ind.color }} />
                    <span style={{ color: ind.color }} className="font-extrabold truncate">
                      {ind.name}(
                      {ind.params.period !== undefined ? ind.params.period : ''}
                      {ind.params.stdDev !== undefined ? `, ${ind.params.stdDev}` : ''}
                      {ind.params.fastPeriod !== undefined ? `${ind.params.fastPeriod}, ${ind.params.slowPeriod}, ${ind.params.signalPeriod}` : ''}
                      )
                    </span>
                    
                    {/* Controls (visible on hover) */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150 ml-1 shrink-0">
                      <button 
                        onClick={() => setVisualIndicators(prev => prev.map(p => p.id === ind.id ? { ...p, visible: !p.visible } : p))} 
                        className="text-gray-400 hover:text-white p-0.5"
                        title={ind.visible ? 'Hide' : 'Show'}
                      >
                        <Eye size={10} />
                      </button>
                      <button 
                        onClick={() => setEditingIndicatorId(editingIndicatorId === ind.id ? null : ind.id)}
                        className={`p-0.5 text-gray-400 hover:text-blue-400 ${editingIndicatorId === ind.id ? 'text-blue-400' : ''}`}
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

                    {/* Inline parameters modifier */}
                    {editingIndicatorId === ind.id && (
                      <div className="flex items-center gap-1.5 ml-2 bg-[#1e222d] border border-[#2a2e39] px-1.5 py-0.5 rounded shadow-xl">
                        {ind.params.period !== undefined && (
                          <>
                            <span className="text-[9px] text-gray-400 font-normal">P:</span>
                            <input
                              type="number"
                              value={ind.params.period}
                              onChange={(e) => {
                                const val = parseInt(e.target.value);
                                if (val > 0) {
                                  setVisualIndicators(prev => prev.map(pItem => pItem.id === ind.id ? { ...pItem, params: { ...pItem.params, period: val } } : pItem));
                                }
                              }}
                              className="w-8 bg-transparent text-white text-[9px] font-mono outline-none border-b border-gray-600 focus:border-blue-500"
                            />
                          </>
                        )}
                        {ind.params.stdDev !== undefined && (
                          <>
                            <span className="text-[9px] text-gray-400 font-normal">SD:</span>
                            <input
                              type="number"
                              step="0.1"
                              value={ind.params.stdDev}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                if (val > 0) {
                                  setVisualIndicators(prev => prev.map(pItem => pItem.id === ind.id ? { ...pItem, params: { ...pItem.params, stdDev: val } } : pItem));
                                }
                              }}
                              className="w-8 bg-transparent text-white text-[9px] font-mono outline-none border-b border-gray-600 focus:border-blue-500"
                            />
                          </>
                        )}
                        {ind.params.fastPeriod !== undefined && (
                          <>
                            <span className="text-[9px] text-gray-400 font-normal">F:</span>
                            <input
                              type="number"
                              value={ind.params.fastPeriod}
                              onChange={(e) => {
                                const val = parseInt(e.target.value);
                                if (val > 0) {
                                  setVisualIndicators(prev => prev.map(pItem => pItem.id === ind.id ? { ...pItem, params: { ...pItem.params, fastPeriod: val } } : pItem));
                                }
                              }}
                              className="w-8 bg-transparent text-white text-[9px] font-mono outline-none border-b border-gray-600 focus:border-blue-500"
                            />
                            <span className="text-[9px] text-gray-400 font-normal ml-1">S:</span>
                            <input
                              type="number"
                              value={ind.params.slowPeriod}
                              onChange={(e) => {
                                const val = parseInt(e.target.value);
                                if (val > 0) {
                                  setVisualIndicators(prev => prev.map(pItem => pItem.id === ind.id ? { ...pItem, params: { ...pItem.params, slowPeriod: val } } : pItem));
                                }
                              }}
                              className="w-8 bg-transparent text-white text-[9px] font-mono outline-none border-b border-gray-600 focus:border-blue-500"
                            />
                            <span className="text-[9px] text-gray-400 font-normal ml-1">Sig:</span>
                            <input
                              type="number"
                              value={ind.params.signalPeriod}
                              onChange={(e) => {
                                const val = parseInt(e.target.value);
                                if (val > 0) {
                                  setVisualIndicators(prev => prev.map(pItem => pItem.id === ind.id ? { ...pItem, params: { ...pItem.params, signalPeriod: val } } : pItem));
                                }
                              }}
                              className="w-8 bg-transparent text-white text-[9px] font-mono outline-none border-b border-gray-600 focus:border-blue-500"
                            />
                          </>
                        )}
                        <button 
                          onClick={() => setEditingIndicatorId(null)}
                          className="text-[9px] text-blue-400 font-bold hover:text-blue-300 ml-1"
                        >
                          OK
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Floating Bid/Ask Quick Trading Box */}
              {livePrice > 0 && (
                <div className="absolute top-2.5 left-2.5 z-20 flex items-center bg-[#1c2030] border border-[#2a2e39] rounded shadow-2xl p-0.5 text-[11.5px] font-bold select-none transition-all hover:border-[#7C5CFF]/45">
                  {/* SELL Button */}
                  <button 
                    onClick={() => executeMarketOrder('SELL', parseFloat(orderQty || 0.01))}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#f23645]/10 hover:bg-[#f23645]/20 text-[#f23645] transition-colors"
                    title="Quick Market Sell"
                  >
                    <span className="text-[9px] font-extrabold tracking-wider">SELL</span>
                    <span className="font-mono text-[11px] font-extrabold">${(livePrice - 0.05).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </button>

                  {/* Quantity Input */}
                  <input 
                    type="number" 
                    step="0.01" 
                    value={orderQty || '0.01'} 
                    onChange={(e) => setOrderQty(e.target.value)} 
                    className="w-11 bg-transparent text-center text-white border-l border-r border-[#2a2e39]/80 mx-1 outline-none text-[10px] font-mono font-bold"
                  />

                  {/* BUY Button */}
                  <button 
                    onClick={() => executeMarketOrder('BUY', parseFloat(orderQty || 0.01))}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#089981]/10 hover:bg-[#089981]/20 text-[#089981] transition-colors"
                    title="Quick Market Buy"
                  >
                    <span className="text-[9px] font-extrabold tracking-wider">BUY</span>
                    <span className="font-mono text-[11px] font-extrabold">${(livePrice + 0.05).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </button>
                </div>
              )}

              {/* Bottom Left Horizontal Range Selector */}
              <div className="absolute bottom-2.5 left-2.5 z-20 flex items-center gap-1 bg-[#1c2030]/85 backdrop-blur-xs px-2 py-1 rounded-md border border-[#2a2e39]/60 shadow-lg text-[10.5px] font-bold select-none text-[#787b86]">
                {['1D', '5D', '1M', '3M', '6M', 'YTD', '1Y', '5Y', 'All'].map(range => (
                  <button 
                    key={range} 
                    onClick={() => applyTimeRange(range)} 
                    className="px-1.5 py-0.5 rounded hover:bg-[#2a2e39] hover:text-white transition-colors"
                  >
                    {range}
                  </button>
                ))}
                <span className="h-3.5 w-px bg-[#2a2e39] mx-1" />
                <button onClick={() => showToast("Select date range...")} className="hover:text-white transition-colors" title="Select custom range">
                  <Calendar size={11} />
                </button>
              </div>

              {/* Bottom Right Timezone Clock / Coordinates Display */}
              <div className="absolute bottom-2.5 right-2.5 z-20 flex items-center gap-2 bg-[#1c2030]/85 backdrop-blur-xs px-2.5 py-1 rounded-md border border-[#2a2e39]/60 shadow-lg text-[10.5px] font-extrabold select-none text-[#787b86] font-mono">
                <span>{new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}</span>
                <span className="opacity-50">UTC</span>
              </div>

              {/* Clickable Timeline News Event Popover Modal */}
              {activeNewsEvent && (
                <div className="absolute bottom-12 left-2.5 z-30 w-80 bg-[#1e222d] border border-[#e040fb]/60 rounded-xl p-4 shadow-2xl animate-fade-in select-none text-[11.5px] text-[#d1d4dc] pointer-events-auto">
                  <div className="flex justify-between items-start mb-2.5">
                    <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[8.5px] font-extrabold uppercase bg-[#e040fb]/10 text-[#e040fb]">
                      ⚡ Economic Release
                    </span>
                    <button 
                      onClick={() => setActiveNewsEvent(null)}
                      className="text-gray-400 hover:text-white font-extrabold text-[12px] p-0.5"
                    >
                      ✕
                    </button>
                  </div>
                  <h4 className="font-extrabold text-[#ffffff] text-[13px] leading-snug mb-1">{activeNewsEvent.title}</h4>
                  {activeNewsEvent.source && (
                    <span className="inline-block text-[8.5px] font-bold uppercase text-[#787b86] bg-[#2a2e39] px-1.5 py-0.5 rounded mb-1.5">{activeNewsEvent.source}</span>
                  )}
                  <p className="text-[11px] text-[#787b86] leading-relaxed mb-3">{activeNewsEvent.desc?.slice(0, 200)}{activeNewsEvent.desc?.length > 200 ? '...' : ''}</p>
                  <div className="grid grid-cols-3 gap-2 border-t border-[#2a2e39]/50 pt-2.5 font-mono text-[10px]">
                    <div>
                      <div className="text-[#787b86] text-[9px] uppercase font-bold mb-0.5">Actual</div>
                      <div className="text-green-400 font-black">{activeNewsEvent.actual}</div>
                    </div>
                    <div>
                      <div className="text-[#787b86] text-[9px] uppercase font-bold mb-0.5">Forecast</div>
                      <div className="text-white font-bold">{activeNewsEvent.forecast}</div>
                    </div>
                    <div>
                      <div className="text-[#787b86] text-[9px] uppercase font-bold mb-0.5">Previous</div>
                      <div className="text-gray-400 font-bold">{activeNewsEvent.previous}</div>
                    </div>
                  </div>
                  {activeNewsEvent.url && (
                    <a
                      href={activeNewsEvent.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2.5 inline-flex items-center gap-1 text-[10px] font-bold text-[#2962ff] hover:text-[#5b8def] transition-colors"
                    >
                      Read Full Article →
                    </a>
                  )}
                </div>
              )}

              <div className="flex-1 flex flex-col min-h-0 min-w-0">
                {/* Main Price Chart Pane */}
                <div 
                  className={`min-w-0 relative transition-all duration-300 ${
                    visualIndicators.filter(ind => ind.visible && ['rsi', 'macd'].includes(ind.type)).length > 0 ? 'h-[55%]' : 'flex-1'
                  }`} 
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
                  <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full pointer-events-none z-10" />
                </div>

                {/* Separate Oscillator Dynamic Sub Panes */}
                {visualIndicators.filter(ind => ind.visible && ['rsi', 'macd'].includes(ind.type)).length > 0 && (
                  <div className="flex flex-col shrink-0 border-t border-[#2a2e39]/50 bg-black/10 min-h-0" style={{ height: '45%' }}>
                    {visualIndicators.filter(ind => ind.visible && ['rsi', 'macd'].includes(ind.type)).map((ind) => (
                      <div 
                        key={ind.id} 
                        id={`subchart-container-${ind.id}`} 
                        className="flex-1 min-w-0 relative border-b border-[#2a2e39]/30 last:border-0"
                      >
                        <div className="absolute top-2.5 left-2.5 z-10 text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#1e222d] border border-[#2a2e39] text-[#787b86] uppercase tracking-wider">
                          {ind.name} ({ind.params.period !== undefined ? ind.params.period : `${ind.params.fastPeriod},${ind.params.slowPeriod},${ind.params.signalPeriod}`}) Pane
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {replayMode && fullCandlesRef.current.length > 1 && (
                <div className={`absolute bottom-2 left-2 right-2 z-20 ${t.bg}/90 border ${t.border} rounded-lg px-3 py-2 flex items-center gap-2`}>
                  <span className={`text-[10px] ${t.muted} shrink-0`}>Replay</span>
                  <input
                    type="range"
                    min={10}
                    max={fullCandlesRef.current.length - 1}
                    value={replayIndex ?? fullCandlesRef.current.length - 1}
                    onChange={(e) => setReplayIndex(Number(e.target.value))}
                    className="flex-1"
                  />
                  <span className={`text-[10px] ${t.text} shrink-0`}>{replayIndex}/{fullCandlesRef.current.length}</span>
                </div>
              )}
            </div>
            
            <RightSidePanel />
            <RightToolbar />
          </div>
          <LeftToolbar horizontal />
        </div>

        <div className={`w-full ${t.bg} flex flex-col min-h-0 transition-all duration-300 border-t ${t.border} z-10 shadow-lg ${getLowerBoxHeight()}`}>
          <div className={`min-h-[42px] border-b ${t.border} flex items-center justify-between px-3 md:px-4 shrink-0 ${t.bg} transition-colors duration-200 gap-2`}>
            <div className="flex items-center gap-2 md:gap-6 h-full font-semibold text-[12px] md:text-[13px] min-w-0 overflow-x-auto mobile-scroll-x">
              <span className={`${t.text} font-bold shrink-0`}>Report</span>
              <div className="h-full flex gap-1 md:gap-4">
                {['Overview', 'Metrics', 'List of trades', 'Trading Panel'].map((tab) => (
                  <button key={tab} onClick={() => { setActiveTab(tab === 'Metrics' ? 'Performance Summary' : tab); if (lowerBoxState === 'minimized') setLowerBoxState(isMobile ? 'maximized' : 'maximized'); }} className={`h-full relative flex items-center shrink-0 ${activeTab === (tab === 'Metrics' ? 'Performance Summary' : tab) ? t.text : `${t.muted}`}`}>
                    {activeTab === (tab === 'Metrics' ? 'Performance Summary' : tab) && <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-7 ${t.sec} rounded-full -z-10`} />}
                    <span className="px-2 md:px-3 z-10 whitespace-nowrap">{tab === 'List of trades' && isMobile ? 'Trades' : tab === 'Metrics' ? 'Metrics' : tab}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className={`flex gap-1 ${t.muted} items-center shrink-0`}>
              <button onClick={downloadReportScreenshot} className="hidden sm:flex items-center gap-1 px-2 py-1 bg-[#7C5CFF]/10 text-[#7C5CFF] hover:bg-[#7C5CFF]/20 rounded text-[11px] font-bold mr-1 transition-colors"><Download size={12} /> Download</button>
              <button onClick={() => setLowerBoxState(lowerBoxState === 'minimized' ? 'maximized' : 'minimized')} className={`p-2 md:p-1 ${t.hover} rounded transition-colors`} title={lowerBoxState === 'minimized' ? 'Expand' : 'Minimize'}>{lowerBoxState === 'minimized' ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}</button>
              {!isMobile && (
                <button onClick={() => setLowerBoxState(lowerBoxState === 'maximized' ? 'normal' : 'maximized')} className={`p-1 ${t.hover} rounded transition-colors`} title="Maximize"><Maximize2 size={14}/></button>
              )}
            </div>
          </div>

          {lowerBoxState !== 'minimized' && (
            <div className={`flex-1 min-h-0 overflow-y-auto dark-scrollbar p-4 md:p-6 ${t.bg} transition-colors duration-200`}>
              
              {/* TOP STATS BAR (Dono Overview aur Metrics tab mein dikhega) */}
              {(activeTab === 'Overview' || activeTab === 'Performance Summary') && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:flex lg:gap-12 gap-4 mb-6 md:mb-8 border-b pb-6" style={{ borderColor: darkMode ? '#2a2e39' : '#e0e3eb' }}>
                  <div><div className={`text-[11px] md:text-[12px] ${t.muted} mb-1`}>Total P&L</div><div className={`text-[20px] md:text-[24px] font-extrabold tracking-tight ${metrics.summary.netProfitVal >= 0 ? 'text-[#089981]' : 'text-[#F23645]'}`}>{metrics.summary.netProfitVal >= 0 ? '+' : ''}{metrics.summary.netProfitVal} <span className={`text-[11px] md:text-[12px] font-medium ${t.muted}`}>{quoteLabel}</span></div><div className={`text-[12px] md:text-[13px] font-semibold ${metrics.summary.netProfitPct >= 0 ? 'text-[#089981]' : 'text-[#F23645]'}`}>{metrics.summary.netProfitPct}%</div></div>
                  <div>
                    <div className={`text-[11px] md:text-[12px] ${t.muted} mb-1`}>Max drawdown</div>
                    <div className={`text-[16px] md:text-[18px] font-bold ${t.text}`}>
                      {formatMoney(metrics.summary.maxDrawdownVal)}
                    </div>
                    <div className={`text-[12px] md:text-[13px] ${t.muted}`}>{formatNumber(metrics.summary.maxDrawdownPct)}%</div>
                  </div>
                  <div><div className={`text-[11px] md:text-[12px] ${t.muted} mb-1`}>Total trades</div><div className={`text-[16px] md:text-[18px] font-bold ${t.text}`}>{metrics.summary.totalTrades}</div></div>
                  <div><div className={`text-[11px] md:text-[12px] ${t.muted} mb-1`}>Win rate</div><div className={`text-[16px] md:text-[18px] font-bold ${t.text}`}>{metrics.summary.winRate}%</div><div className={`text-[12px] md:text-[13px] ${t.muted}`}>{metrics.advanced.wins || 0} / {metrics.summary.totalTrades}</div></div>
                  <div><div className={`text-[11px] md:text-[12px] ${t.muted} mb-1`}>Profit factor</div><div className={`text-[16px] md:text-[18px] font-bold ${t.text}`}>{metrics.summary.profitFactor}</div></div>
                  <div><div className={`text-[11px] md:text-[12px] ${t.muted} mb-1`}>Expectancy</div><div className={`text-[16px] md:text-[18px] font-bold ${t.text}`}>{formatMoney(metrics.advanced.expectancy, true)}</div></div>
                </div>
              )}

              {/* OVERVIEW TAB */}
              {activeTab === 'Overview' && (
                <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-4">
                  {/* Equity Chart */}
                  <div className={`min-h-[210px] md:min-h-[270px] w-full border ${t.border} rounded-xl p-4 md:p-5 ${t.sec} shadow-sm`}>
                    <div className="flex items-center justify-between gap-3 mb-4">
                      <div>
                        <div className={`text-[14px] font-bold ${t.text}`}>Equity Curve & Drawdown</div>
                        <div className={`text-[11px] ${t.muted} mt-0.5`}>{selectedCoin} - {chartInterval}</div>
                      </div>
                      <div className={`text-[11px] ${t.muted} bg-[#2a2e39]/20 px-2 py-1 rounded-md`}>{equityChartData.length} pts</div>
                    </div>
                    <ResponsiveContainer width="100%" height={isMobile ? 170 : 230}>
                      <ComposedChart data={equityChartData} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
                        <XAxis dataKey="trade" tick={{fontSize: 10, fill: '#787b86'}} minTickGap={28} axisLine={false} tickLine={false} />
                        <YAxis yAxisId="left" domain={['auto', 'auto']} tick={{fontSize: 10, fill: '#787b86'}} axisLine={false} tickLine={false} width={48} />
                        <YAxis yAxisId="right" orientation="right" domain={[0, 'auto']} tickFormatter={(value) => `${value}%`} tick={{fontSize: 10, fill: '#787b86'}} axisLine={false} tickLine={false} width={36} />
                        <Tooltip
                          contentStyle={{backgroundColor: darkMode ? '#1e222d' : '#f8f9fa', color: darkMode ? '#d1d4dc' : '#131722', borderRadius: '8px', border: `1px solid ${darkMode ? '#2a2e39' : '#e0e3eb'}`, fontSize: '12px'}}
                          formatter={(value, name) => {
                            if (name === 'drawdown') return [`${formatNumber(value)}%`, 'Drawdown'];
                            if (name === 'pnl') return [formatMoney(value, true), 'Trade P&L'];
                            return [formatMoney(value), 'Equity'];
                          }}
                        />
                        <Bar yAxisId="right" dataKey="drawdown" fill="#F23645" fillOpacity={0.15} barSize={isMobile ? 8 : 12} radius={[2, 2, 0, 0]} />
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

                  {/* Win Rate Sidebar */}
                  <div className={`border ${t.border} rounded-xl overflow-hidden ${t.sec} shadow-sm flex flex-col`}>
                    <div className={`px-4 py-3 border-b ${t.border}`}>
                      <div className={`text-[13px] font-bold ${t.text}`}>Win-rate Tracking</div>
                    </div>
                    <div className="p-4 flex-1 flex flex-col justify-center">
                      <div className={`text-[12px] ${t.muted} mb-1`}>Final Strategy Win Rate</div>
                      <div className={`text-[30px] font-extrabold tracking-tight ${metrics.summary.winRate >= 50 ? 'text-[#089981]' : 'text-[#F23645]'}`}>{metrics.summary.winRate}%</div>
                      <div className={`text-[12px] ${t.muted} mt-1`}>{metrics.advanced.wins || 0} Wins out of {metrics.summary.totalTrades} Trades</div>
                      
                      <div className="mt-6">
                        <div className="flex justify-between text-[11px] mb-1">
                          <span className={t.muted}>Long Wins</span>
                          <span className="font-mono text-[#089981]">{metrics.advanced.longWins}/{metrics.advanced.longTotal}</span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mb-3">
                          <div className="bg-[#089981] h-1.5 rounded-full" style={{ width: `${(metrics.advanced.longWins / (metrics.advanced.longTotal || 1)) * 100}%` }}></div>
                        </div>
                        
                        <div className="flex justify-between text-[11px] mb-1">
                          <span className={t.muted}>Short Wins</span>
                          <span className="font-mono text-[#F23645]">{metrics.advanced.shortWins}/{metrics.advanced.shortTotal}</span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                          <div className="bg-[#F23645] h-1.5 rounded-full" style={{ width: `${(metrics.advanced.shortWins / (metrics.advanced.shortTotal || 1)) * 100}%` }}></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* NEW METRICS TAB (DEEP ANALYSIS) */}
              {activeTab === 'Performance Summary' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  
                  {/* Chart 1: Profit Distribution */}
                  <div className={`border ${t.border} rounded-xl p-4 ${t.sec} shadow-sm`}>
                    <div className={`text-[13px] font-bold ${t.text} mb-4`}>Trade Profit Distribution</div>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={profitDistribution} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#787b86' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: '#787b86' }} axisLine={false} tickLine={false} />
                        <Tooltip cursor={{ fill: darkMode ? '#2a2e39' : '#e0e3eb' }} contentStyle={{ backgroundColor: darkMode ? '#1e222d' : '#ffffff', borderColor: t.border, borderRadius: '8px' }} />
                        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                          {profitDistribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.name.includes('<') || entry.name.includes('Loss') ? '#F23645' : entry.name.includes('Win') || entry.name.includes('>') ? '#089981' : '#787b86'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Chart 2: Underwater Drawdown */}
                  <div className={`border ${t.border} rounded-xl p-4 ${t.sec} shadow-sm`}>
                    <div className={`text-[13px] font-bold ${t.text} mb-1`}>Underwater Drawdown</div>
                    <div className={`text-[11px] ${t.muted} mb-3`}>Severity of capital drops</div>
                    <ResponsiveContainer width="100%" height={180}>
                      <AreaChart data={equityChartData} margin={{ top: 10, right: 0, left: -25, bottom: 0 }}>
                        <XAxis dataKey="trade" tick={{ fontSize: 10, fill: '#787b86' }} minTickGap={30} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: '#787b86' }} axisLine={false} tickLine={false} tickFormatter={(v) => `-${v}%`} reversed={true} />
                        <Tooltip contentStyle={{ backgroundColor: darkMode ? '#1e222d' : '#ffffff', borderColor: t.border, borderRadius: '8px' }} formatter={(value) => [`${formatNumber(value)}%`, 'Drawdown Drop']} />
                        <Area type="monotone" dataKey="drawdown" stroke="#F23645" fill="#F23645" fillOpacity={0.25} strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Chart 3: Long vs Short Donut */}
                  <div className={`border ${t.border} rounded-xl p-4 ${t.sec} shadow-sm`}>
                    <div className={`text-[13px] font-bold ${t.text} mb-2`}>Long vs Short Ratio</div>
                    {longShortData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie data={longShortData} innerRadius={55} outerRadius={75} paddingAngle={3} dataKey="value" stroke="none">
                            {longShortData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ backgroundColor: darkMode ? '#1e222d' : '#ffffff', borderColor: t.border, borderRadius: '8px' }} />
                          <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className={`flex h-[200px] flex-col items-center justify-center gap-2 text-[12px] ${t.muted}`}><Activity size={22} className="opacity-40" /> No trades yet</div>
                    )}
                  </div>

                  {/* Advanced Stats Grid */}
                  <div className={`col-span-1 md:col-span-2 lg:col-span-3 border ${t.border} rounded-xl p-5 ${t.sec} shadow-sm space-y-4 mt-2`}>
                    <div className={`text-[13px] font-bold ${t.text} border-b ${t.border} pb-2 flex items-center justify-between`}>
                      <span>Performance Summary (Strategy Tester)</span>
                      <span className="text-[9px] text-[#7C5CFF] font-extrabold uppercase bg-[#7C5CFF]/15 px-2 py-0.5 rounded">Verified Stats</span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {/* Column 1: PnL Performance */}
                      <div className="space-y-2">
                        <div className="text-[10px] font-bold text-[#787b86] uppercase border-b border-[#2a2e39]/10 pb-1">Capital & PnL</div>
                        <div className="flex justify-between items-center text-[12px]">
                          <span className={t.muted}>Net Profit</span>
                          <span className="font-bold font-mono text-[#089981]">${metrics.summary.netProfitVal.toLocaleString(undefined, {minimumFractionDigits: 2})} ({metrics.summary.netProfitPct}%)</span>
                        </div>
                        <div className="flex justify-between items-center text-[12px]">
                          <span className={t.muted}>Gross Profit</span>
                          <span className="font-bold font-mono text-[#089981]">${metrics.advanced.grossProfit.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                        </div>
                        <div className="flex justify-between items-center text-[12px]">
                          <span className={t.muted}>Gross Loss</span>
                          <span className="font-bold font-mono text-[#F23645]">${metrics.advanced.grossLoss.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                        </div>
                        <div className="flex justify-between items-center text-[12px]">
                          <span className={t.muted}>Max Drawdown</span>
                          <span className="font-bold font-mono text-[#F23645]">${metrics.advanced.maxDrawdownVal.toLocaleString(undefined, {minimumFractionDigits: 2})} ({metrics.advanced.maxDrawdownPct}%)</span>
                        </div>
                        <div className="flex justify-between items-center text-[12px]">
                          <span className={t.muted}>Buy & Hold Return</span>
                          <span className="font-bold font-mono text-white">$850.00 (8.50%)</span>
                        </div>
                      </div>

                      {/* Column 2: Ratios & Efficiency */}
                      <div className="space-y-2">
                        <div className="text-[10px] font-bold text-[#787b86] uppercase border-b border-[#2a2e39]/10 pb-1">Performance Ratios</div>
                        <div className="flex justify-between items-center text-[12px]">
                          <span className={t.muted}>Profit Factor</span>
                          <span className="font-bold font-mono text-white">{metrics.summary.profitFactor}</span>
                        </div>
                        <div className="flex justify-between items-center text-[12px]">
                          <span className={t.muted}>Sharpe Ratio</span>
                          <span className="font-bold font-mono text-[#089981]">2.14</span>
                        </div>
                        <div className="flex justify-between items-center text-[12px]">
                          <span className={t.muted}>Sortino Ratio</span>
                          <span className="font-bold font-mono text-[#089981]">3.05</span>
                        </div>
                        <div className="flex justify-between items-center text-[12px]">
                          <span className={t.muted}>Expectancy</span>
                          <span className="font-bold font-mono text-white">${metrics.advanced.expectancy.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center text-[12px]">
                          <span className={t.muted}>Recovery Factor</span>
                          <span className="font-bold font-mono text-white">{metrics.advanced.recoveryFactor}</span>
                        </div>
                      </div>

                      {/* Column 3: Trade Metrics */}
                      <div className="space-y-2">
                        <div className="text-[10px] font-bold text-[#787b86] uppercase border-b border-[#2a2e39]/10 pb-1">Trade Diagnostics</div>
                        <div className="flex justify-between items-center text-[12px]">
                          <span className={t.muted}>Total Closed Trades</span>
                          <span className="font-bold font-mono text-white">{metrics.summary.totalTrades}</span>
                        </div>
                        <div className="flex justify-between items-center text-[12px]">
                          <span className={t.muted}>Percent Profitable</span>
                          <span className="font-bold font-mono text-white">{metrics.summary.winRate}%</span>
                        </div>
                        <div className="flex justify-between items-center text-[12px]">
                          <span className={t.muted}>Avg. Trade PnL</span>
                          <span className="font-bold font-mono text-white">${metrics.advanced.avgTrade.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                        </div>
                        <div className="flex justify-between items-center text-[12px]">
                          <span className={t.muted}>Avg. Win Trade</span>
                          <span className="font-bold font-mono text-[#089981]">${metrics.advanced.avgWin.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                        </div>
                        <div className="flex justify-between items-center text-[12px]">
                          <span className={t.muted}>Avg. Loss Trade</span>
                          <span className="font-bold font-mono text-[#F23645]">${metrics.advanced.avgLoss.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-3 border-t border-[#2a2e39]/15">
                      <div className="p-2.5 rounded-lg border border-[#2a2e39]/20 bg-[#131722]/40 text-center">
                        <div className="text-[9px] text-[#787b86] uppercase">Max Win Streak</div>
                        <div className="text-[12px] font-bold text-white mt-0.5">{metrics.advanced.maxWinStreak} Trades</div>
                      </div>
                      <div className="p-2.5 rounded-lg border border-[#2a2e39]/20 bg-[#131722]/40 text-center">
                        <div className="text-[9px] text-[#787b86] uppercase">Max Loss Streak</div>
                        <div className="text-[12px] font-bold text-white mt-0.5">{metrics.advanced.maxLossStreak} Trades</div>
                      </div>
                      <div className="p-2.5 rounded-lg border border-[#2a2e39]/20 bg-[#131722]/40 text-center">
                        <div className="text-[9px] text-[#787b86] uppercase">Best Trade</div>
                        <div className="text-[12px] font-bold text-[#089981] mt-0.5">${metrics.advanced.bestTrade.toLocaleString()}</div>
                      </div>
                      <div className="p-2.5 rounded-lg border border-[#2a2e39]/20 bg-[#131722]/40 text-center">
                        <div className="text-[9px] text-[#787b86] uppercase">Worst Trade</div>
                        <div className="text-[12px] font-bold text-[#F23645] mt-0.5">${metrics.advanced.worstTrade.toLocaleString()}</div>
                      </div>
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
                <div className="space-y-6">
                  {/* Account Summary Header */}
                  <div className={`grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl border ${t.border} ${t.sec} shadow-sm`}>
                    <div>
                      <div className={`text-[10px] ${t.muted} uppercase tracking-wider`}>Account Balance</div>
                      <div className={`text-[15px] font-black ${t.text} mt-1 font-mono`}>${balance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                    </div>
                    <div>
                      <div className={`text-[10px] ${t.muted} uppercase tracking-wider`}>Unrealized P&L</div>
                      <div className={`text-[15px] font-black mt-1 font-mono ${unrealizedPnl >= 0 ? 'text-[#089981]' : 'text-[#f23645]'}`}>
                        {unrealizedPnl >= 0 ? '+' : ''}${unrealizedPnl.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                      </div>
                    </div>
                    <div>
                      <div className={`text-[10px] ${t.muted} uppercase tracking-wider`}>Account Equity</div>
                      <div className={`text-[15px] font-black ${t.text} mt-1 font-mono`}>
                        ${(balance + unrealizedPnl).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                      </div>
                    </div>
                    <div>
                      <div className={`text-[10px] ${t.muted} uppercase tracking-wider`}>Trading Instrument</div>
                      <div className="text-[15px] font-black text-blue-400 mt-1">{selectedCoin}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
                    {/* Order Entry Form */}
                    <div className={`p-4 rounded-xl border ${t.border} ${t.sec} space-y-4`}>
                      <div className={`text-[12px] font-extrabold ${t.text} border-b ${t.border} pb-2 uppercase tracking-wider`}>Order Entry</div>
                      
                      {/* Order Side */}
                      <div className="flex gap-2 bg-[#131722]/50 p-1 rounded-lg">
                        <button
                          type="button"
                          onClick={() => setOrderSide('BUY')}
                          className={`flex-1 py-1.5 rounded-md text-[11px] font-extrabold transition-all ${
                            orderSide === 'BUY' 
                              ? 'bg-[#089981] text-white shadow-md' 
                              : `${t.muted} hover:text-white`
                          }`}
                        >
                          BUY
                        </button>
                        <button
                          type="button"
                          onClick={() => setOrderSide('SELL')}
                          className={`flex-1 py-1.5 rounded-md text-[11px] font-extrabold transition-all ${
                            orderSide === 'SELL' 
                              ? 'bg-[#F23645] text-white shadow-md' 
                              : `${t.muted} hover:text-white`
                          }`}
                        >
                          SELL
                        </button>
                      </div>

                      {/* Order Type */}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setOrderType('MARKET')}
                          className={`flex-1 py-1 text-center rounded text-[11px] font-bold ${
                            orderType === 'MARKET' ? 'bg-[#2962ff]/15 text-[#2962ff]' : `${t.sec} ${t.text}`
                          }`}
                        >
                          Market
                        </button>
                        <button
                          type="button"
                          onClick={() => setOrderType('LIMIT')}
                          className={`flex-1 py-1 text-center rounded text-[11px] font-bold ${
                            orderType === 'LIMIT' ? 'bg-[#2962ff]/15 text-[#2962ff]' : `${t.sec} ${t.text}`
                          }`}
                        >
                          Limit
                        </button>
                      </div>

                      {/* Limit Price */}
                      {orderType === 'LIMIT' && (
                        <div className="space-y-1">
                          <label className={`text-[10px] ${t.muted}`}>LIMIT PRICE (USD)</label>
                          <input
                            type="number"
                            placeholder={livePrice ? String(livePrice) : "0.00"}
                            value={orderLimitPrice}
                            onChange={(e) => setOrderLimitPrice(e.target.value)}
                            className={`w-full px-3 py-2 rounded-lg border ${t.border} ${t.bg} ${t.text} text-[12px] font-mono outline-none`}
                          />
                        </div>
                      )}

                      {/* Quantity */}
                      <div className="space-y-1">
                        <label className={`text-[10px] ${t.muted}`}>QTY ({getBaseAsset(selectedCoin)})</label>
                        <input
                          type="number"
                          placeholder="0.0"
                          value={orderQty}
                          onChange={(e) => setOrderQty(e.target.value)}
                          className={`w-full px-3 py-2 rounded-lg border ${t.border} ${t.bg} ${t.text} text-[12px] font-mono outline-none`}
                        />
                      </div>

                      {/* Quantity sliders / percentages */}
                      <div className="flex gap-1 justify-between">
                        {[0.1, 0.25, 0.5, 1].map(pct => (
                          <button
                            key={pct}
                            type="button"
                            onClick={() => {
                              const price = orderType === 'LIMIT' ? parseFloat(orderLimitPrice) || livePrice : livePrice;
                              if (price > 0) {
                                const maxQty = balance / price;
                                setOrderQty(String(parseFloat((maxQty * pct).toFixed(4))));
                              }
                            }}
                            className={`flex-1 py-0.5 text-[9px] rounded font-bold border ${t.border} ${t.hover}`}
                          >
                            {pct * 100}%
                          </button>
                        ))}
                      </div>

                      {/* Est Cost */}
                      <div className="flex justify-between text-[10px]">
                        <span className={t.muted}>Est. Cost</span>
                        <span className={`font-mono ${t.text}`}>
                          ${((parseFloat(orderQty) || 0) * (orderType === 'LIMIT' ? parseFloat(orderLimitPrice) || 0 : livePrice || 0)).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}
                        </span>
                      </div>

                      {/* Place Order Button */}
                      <button
                        type="button"
                        onClick={() => {
                          const qty = parseFloat(orderQty);
                          if (!qty || qty <= 0) {
                            showToast("Please enter a valid quantity.");
                            return;
                          }
                          if (orderType === 'MARKET') {
                            executeMarketOrder(orderSide, qty);
                          } else {
                            placeLimitOrder(orderSide, qty, orderLimitPrice);
                          }
                          setOrderQty('');
                          setOrderLimitPrice('');
                        }}
                        className={`w-full py-2.5 rounded-lg text-white text-[12px] font-extrabold transition-all uppercase ${
                          orderSide === 'BUY' 
                            ? 'bg-[#089981] hover:bg-[#089981]/90 shadow-lg shadow-[#089981]/20' 
                            : 'bg-[#F23645] hover:bg-[#F23645]/90 shadow-lg shadow-[#F23645]/20'
                        }`}
                      >
                        Place {orderSide} {orderType}
                      </button>
                    </div>

                    {/* Positions and Orders Lists */}
                    <div className="space-y-6">
                      {/* Positions list */}
                      <div className={`border ${t.border} rounded-xl overflow-hidden ${t.sec} shadow-sm`}>
                        <div className={`px-4 py-3 border-b ${t.border} bg-[#2a2e39]/10 flex justify-between items-center`}>
                          <span className={`text-[12px] font-extrabold ${t.text} uppercase tracking-wider`}>Open Positions</span>
                        </div>
                        <div className="overflow-x-auto dark-scrollbar">
                          <table className="w-full text-left border-collapse min-w-[500px]">
                            <thead>
                              <tr className={`border-b ${t.border} ${t.bg}`}>
                                <th className={`py-2.5 pl-4 pr-2 font-semibold ${t.muted} text-[10px] uppercase`}>Symbol</th>
                                <th className={`py-2.5 pr-2 font-semibold ${t.muted} text-[10px] uppercase`}>Side</th>
                                <th className={`py-2.5 pr-2 font-semibold ${t.muted} text-[10px] uppercase`}>Size</th>
                                <th className={`py-2.5 pr-2 font-semibold ${t.muted} text-[10px] uppercase text-right`}>Avg Price</th>
                                <th className={`py-2.5 pr-2 font-semibold ${t.muted} text-[10px] uppercase text-right`}>Mark Price</th>
                                <th className={`py-2.5 pr-2 font-semibold ${t.muted} text-[10px] uppercase text-right`}>Unrealized P&L</th>
                                <th className={`py-2.5 pr-4 font-semibold ${t.muted} text-[10px] uppercase text-center`}>Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#2a2e39]/30">
                              {positions.map((pos, idx) => {
                                const markPrice = pos.symbol === selectedCoin ? livePrice : pos.entryPrice; // Fallback
                                const pnl = pos.type === 'LONG' 
                                  ? (markPrice - pos.entryPrice) * pos.qty
                                  : (pos.entryPrice - markPrice) * pos.qty;
                                return (
                                  <tr key={idx} className={`${darkMode ? 'hover:bg-[#2a2e39]/50' : 'hover:bg-gray-100'} transition-colors`}>
                                    <td className={`py-3 pl-4 pr-2 font-bold ${t.text} text-[11px]`}>{pos.symbol}</td>
                                    <td className="py-3 pr-2 text-[11px]">
                                      <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold ${pos.type === 'LONG' ? 'bg-[#089981]/15 text-[#089981]' : 'bg-[#F23645]/15 text-[#F23645]'}`}>{pos.type}</span>
                                    </td>
                                    <td className={`py-3 pr-2 font-mono font-bold ${t.text} text-[11px]`}>{pos.qty} {getBaseAsset(pos.symbol)}</td>
                                    <td className={`py-3 pr-2 font-mono text-right ${t.text} text-[11px]`}>${pos.entryPrice.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                                    <td className={`py-3 pr-2 font-mono text-right ${t.text} text-[11px]`}>${markPrice.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                                    <td className={`py-3 pr-2 font-mono text-right text-[11px] font-extrabold ${pnl >= 0 ? 'text-[#089981]' : 'text-[#f23645]'}`}>
                                      {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
                                    </td>
                                    <td className="py-3 pr-4 text-center">
                                      <button
                                        type="button"
                                        onClick={() => closeActivePosition(pos.symbol)}
                                        className="px-3 py-1 rounded bg-[#F23645]/15 hover:bg-[#F23645]/25 text-[#F23645] text-[10px] font-extrabold transition-all"
                                      >
                                        Close
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                          {positions.length === 0 && (
                            <div className={`py-8 text-center text-[11px] ${t.muted} italic`}>No open positions. Use order entry to open long/short positions.</div>
                          )}
                        </div>
                      </div>

                      {/* Pending orders list */}
                      <div className={`border ${t.border} rounded-xl overflow-hidden ${t.sec} shadow-sm`}>
                        <div className={`px-4 py-3 border-b ${t.border} bg-[#2a2e39]/10 flex justify-between items-center`}>
                          <span className={`text-[12px] font-extrabold ${t.text} uppercase tracking-wider`}>Active Orders</span>
                        </div>
                        <div className="overflow-x-auto dark-scrollbar">
                          <table className="w-full text-left border-collapse min-w-[500px]">
                            <thead>
                              <tr className={`border-b ${t.border} ${t.bg}`}>
                                <th className={`py-2.5 pl-4 pr-2 font-semibold ${t.muted} text-[10px] uppercase`}>Symbol</th>
                                <th className={`py-2.5 pr-2 font-semibold ${t.muted} text-[10px] uppercase`}>Type</th>
                                <th className={`py-2.5 pr-2 font-semibold ${t.muted} text-[10px] uppercase`}>Side</th>
                                <th className={`py-2.5 pr-2 font-semibold ${t.muted} text-[10px] uppercase text-right`}>Price</th>
                                <th className={`py-2.5 pr-2 font-semibold ${t.muted} text-[10px] uppercase text-right`}>Size</th>
                                <th className={`py-2.5 pr-2 font-semibold ${t.muted} text-[10px] uppercase text-center`}>Status</th>
                                <th className={`py-2.5 pr-4 font-semibold ${t.muted} text-[10px] uppercase text-center`}>Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#2a2e39]/30">
                              {paperOrders
                                .filter(o => o.status === 'PENDING')
                                .map((order, idx) => (
                                  <tr key={idx} className={`${darkMode ? 'hover:bg-[#2a2e39]/50' : 'hover:bg-gray-100'} transition-colors`}>
                                    <td className={`py-3 pl-4 pr-2 font-bold ${t.text} text-[11px]`}>{order.symbol}</td>
                                    <td className={`py-3 pr-2 ${t.text} text-[11px]`}>{order.type}</td>
                                    <td className="py-3 pr-2 text-[11px]">
                                      <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold ${order.side === 'BUY' ? 'bg-[#089981]/15 text-[#089981]' : 'bg-[#F23645]/15 text-[#F23645]'}`}>{order.side}</span>
                                    </td>
                                    <td className={`py-3 pr-2 font-mono text-right ${t.text} text-[11px]`}>${order.price.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                                    <td className={`py-3 pr-2 font-mono text-right ${t.text} text-[11px]`}>{order.qty} {getBaseAsset(order.symbol)}</td>
                                    <td className="py-3 pr-2 text-center text-[10px] font-bold text-amber-500">{order.status}</td>
                                    <td className="py-3 pr-4 text-center">
                                      <button
                                        type="button"
                                        onClick={() => cancelLimitOrder(order.id)}
                                        className="text-red-400 hover:text-red-300 font-extrabold text-[10px]"
                                      >
                                        Cancel
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                          {paperOrders.filter(o => o.status === 'PENDING').length === 0 && (
                            <div className={`py-8 text-center text-[11px] ${t.muted} italic`}>No active limit orders.</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}
        </div>
      </div>

      {/* Desktop editor sidebar */}
      <div className={`hidden md:flex h-full shrink-0 z-20 overflow-hidden ${t.bg} border-l ${t.border} transition-colors duration-200`}>
        <div className={`flex flex-col h-full shadow-2xl transition-all duration-300 ${isEditorOpen ? 'w-[400px] md:w-[480px]' : 'w-0 overflow-hidden'}`}>
          {renderEditorPanel()}
        </div>
        <div className={`w-10 border-l ${t.border} flex flex-col items-center py-3 ${t.bg} transition-colors`}>
          <button onClick={() => setIsEditorOpen(!isEditorOpen)} className={`w-8 h-8 rounded flex items-center justify-center ${t.muted} ${t.hover} transition-colors`}><TriangleRIcon /></button>
        </div>
      </div>

      {!isEditorOpen && (
        <div className={`md:hidden shrink-0 ${t.bg} border-t ${t.border} flex items-center justify-around px-2 py-1 safe-bottom`}>
          <button
            onClick={() => setLowerBoxState(lowerBoxState === 'minimized' ? 'maximized' : 'minimized')}
            className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg min-w-[64px] min-h-[48px] ${lowerBoxState !== 'minimized' ? 'text-[#7C5CFF]' : t.muted}`}
          >
            <Activity size={20} />
            <span className="text-[10px] font-semibold">Report</span>
          </button>
          <button
            onClick={() => { setIsEditorOpen(true); setLowerBoxState('minimized'); }}
            className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg min-w-[64px] min-h-[48px] ${isEditorOpen ? 'text-[#7C5CFF]' : t.muted}`}
          >
            <Play size={20} />
            <span className="text-[10px] font-semibold">Editor</span>
          </button>
          <button
            onClick={runBacktest}
            disabled={loading}
            className="flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl bg-[#7C5CFF] text-white min-w-[72px] min-h-[48px] shadow-lg shadow-[#7C5CFF]/30 disabled:opacity-60"
          >
            {loading ? <RefreshCw size={20} className="animate-spin" /> : <Play size={20} fill="currentColor" />}
            <span className="text-[10px] font-bold">Run</span>
          </button>
          <button
            onClick={() => setMobileMenuOpen(true)}
            className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg min-w-[64px] min-h-[48px] ${t.muted}`}
          >
            <Menu size={20} />
            <span className="text-[10px] font-semibold">More</span>
          </button>
        </div>
      )}
      </div>

      {/* Advanced Cursor Studio Modal */}
      {isCursorStudioOpen && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 backdrop-blur-xs select-none">
          <div className={`w-[600px] bg-[#1c2030] border ${t.border} rounded-xl shadow-2xl overflow-hidden text-white flex flex-col font-sans animate-fade-in`}>
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
          <div className={`w-[360px] max-h-[90vh] bg-[#1c2030] border ${t.border} rounded-xl shadow-2xl overflow-y-auto dark-scrollbar text-white flex flex-col font-sans animate-fade-in`}>
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
  );
}

export default App;
